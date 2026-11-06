import { supabase, isCurrentUserAdmin } from "./supabase-client.js";

let products = [];
let editingProductId = null;
let editingImagePath = null;

const byId = (id) => document.getElementById(id);

function showMessage(message) {
  window.alert(message);
}

function showTab(tabId, element) {
  document.querySelectorAll(".tab-section").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  byId(tabId).classList.add("active");
  if (element) element.classList.add("active");
  if (tabId === "tabProducts") loadProducts();
  if (tabId === "tabOrders") loadOrders();
  if (tabId === "tabReviews") { loadReviewProductOptions(); loadReviews(); }
  if (tabId === "tabSettings") loadSettings();
}
window.showTab = showTab;

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text === null || text === undefined ? "" : String(text);
  return cell;
}

async function loadProducts() {
  const tbody = byId("productsTableBody");
  tbody.replaceChildren();
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    showMessage("প্রোডাক্ট লোড হয়নি। Supabase policy ও connection পরীক্ষা করুন।");
    console.error(error);
    return;
  }
  products = data || [];
  populateReviewProducts();
  products.forEach((product) => {
    const row = document.createElement("tr");
    const imageCell = document.createElement("td");
    const image = document.createElement("img");
    image.src = product.image_url || "";
    image.alt = product.name;
    image.loading = "lazy";
    image.style.cssText = "width:40px;height:40px;object-fit:contain;";
    imageCell.appendChild(image);

    const nameCell = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const tag = document.createElement("small");
    tag.textContent = product.tag || "";
    tag.style.cssText = "display:block;color:#777;";
    nameCell.append(name, tag);

    const stockCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + (product.in_stock ? "badge-done" : "badge-pending");
    badge.textContent = product.in_stock ? "ইন স্টক" : "স্টক আউট";
    stockCell.appendChild(badge);

    const actions = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn-primary";
    editButton.style.cssText = "padding:6px 10px;margin-right:6px;";
    editButton.textContent = "এডিট";
    editButton.addEventListener("click", () => startProductEdit(product.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-danger";
    deleteButton.textContent = "ডিলিট";
    deleteButton.addEventListener("click", () => deleteProduct(product.id));
    actions.append(editButton, deleteButton);

    row.append(
      imageCell,
      nameCell,
      makeCell(product.category || "N/A"),
      makeCell("৳ " + Number(product.price_num).toLocaleString("en-US")),
      stockCell,
      actions
    );
    tbody.appendChild(row);
  });
}

function populateReviewProducts() {
  const select = byId("reviewProduct");
  if (!select) return;
  const selected = select.value;
  select.replaceChildren(new Option("প্রোডাক্ট নির্বাচন করুন", ""));
  products.forEach((product) => select.add(new Option(product.name, String(product.id))));
  if (selected && products.some((product) => String(product.id) === selected)) select.value = selected;
}

async function loadReviewProductOptions() {
  if (!products.length) {
    const { data, error } = await supabase.from("products").select("id,name").order("name");
    if (error) { console.error("Review product list failed:", error); return showMessage("প্রোডাক্ট তালিকা লোড হয়নি।"); }
    products = data || [];
  }
  populateReviewProducts();
}

async function loadReviews() {
  const tbody = byId("reviewsTableBody");
  tbody.replaceChildren();
  const { data, error } = await supabase.from("reviews")
    .select("id,product_id,customer_name,rating,comment,is_approved,created_at,products(name)")
    .order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("Reviews load failed:", error);
    showMessage("রিভিউ লোড হয়নি। Review SQL এবং Supabase policy পরীক্ষা করুন।");
    return;
  }
  (data || []).forEach((review) => {
    const row = document.createElement("tr");
    row.appendChild(makeCell(review.products?.name || "প্রোডাক্ট ডিলিট হয়েছে"));
    row.appendChild(makeCell(`${review.customer_name} · ${"★".repeat(Number(review.rating))}`));
    const commentCell = makeCell(review.comment);
    commentCell.className = "review-content";
    row.appendChild(commentCell);
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "badge " + (review.is_approved ? "badge-done" : "badge-pending");
    status.textContent = review.is_approved ? "প্রকাশিত" : "অনুমোদনের অপেক্ষায়";
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actions = document.createElement("td");
    const approval = document.createElement("button");
    approval.type = "button";
    approval.className = review.is_approved ? "btn-danger" : "btn-primary";
    approval.textContent = review.is_approved ? "লুকান" : "অনুমোদন";
    approval.addEventListener("click", () => setReviewApproval(review.id, !review.is_approved));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-danger";
    remove.style.marginLeft = "6px";
    remove.textContent = "ডিলিট";
    remove.addEventListener("click", () => deleteReview(review.id));
    actions.append(approval, remove);
    row.appendChild(actions);
    tbody.appendChild(row);
  });
}

async function handleAdminReviewCreate(event) {
  event.preventDefault();
  const productId = byId("reviewProduct").value;
  const customerName = byId("reviewCustomerName").value.trim();
  const rating = Number(byId("reviewRating").value);
  const comment = byId("reviewComment").value.trim();
  if (!productId || customerName.length < 2 || customerName.length > 80 || comment.length < 3 || comment.length > 1000) {
    return showMessage("প্রোডাক্ট, সঠিক নাম, রেটিং ও ৩–১০০০ অক্ষরের মতামত দিন।");
  }
  const { error } = await supabase.from("reviews").insert({
    product_id: Number(productId), customer_name: customerName, rating, comment, is_approved: true
  });
  if (error) {
    console.error("Admin review insert failed:", error);
    return showMessage("রিভিউ যোগ হয়নি। Review SQL/RLS policy পরীক্ষা করুন।");
  }
  byId("adminReviewForm").reset();
  await loadReviews();
  showMessage("রিভিউ যোগ হয়েছে এবং ওয়েবসাইটে প্রকাশিত হয়েছে।");
}
window.handleAdminReviewCreate = handleAdminReviewCreate;

async function setReviewApproval(id, isApproved) {
  const { error } = await supabase.from("reviews").update({ is_approved: isApproved }).eq("id", id);
  if (error) { console.error("Review approval failed:", error); return showMessage("রিভিউয়ের অবস্থা বদলানো যায়নি।"); }
  await loadReviews();
}

async function deleteReview(id) {
  if (!window.confirm("এই রিভিউটি স্থায়ীভাবে ডিলিট করবেন?")) return;
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) { console.error("Review delete failed:", error); return showMessage("রিভিউ ডিলিট হয়নি।"); }
  await loadReviews();
}

function startProductEdit(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  editingProductId = product.id;
  editingImagePath = product.image_path || null;
  byId("newProdName").value = product.name || "";
  byId("newProdTag").value = product.tag || "";
  byId("newProdPrice").value = product.price_num || "";
  byId("newProdOldPrice").value = product.old_price || "";
  byId("newProdCategory").value = product.category || "Face Care";
  byId("newProdBg").value = product.bg_gradient || "";
  byId("newProdDesc").value = product.description || "";
  byId("fileInput").value = "";
  byId("liveImgPreview").src = product.image_url || "";
  byId("previewContainer").style.display = product.image_url ? "flex" : "none";
  byId("productSubmitButton").textContent = "পরিবর্তন সেভ করুন";
  byId("cancelProductEdit").style.display = "inline-block";
  showTab("tabAddProduct", document.querySelectorAll(".nav-link")[1]);
}

async function deleteProduct(id) {
  if (!window.confirm("আপনি কি নিশ্চিতভাবে এই প্রোডাক্টটি ডিলিট করতে চান?")) return;
  const product = products.find((item) => item.id === id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    showMessage("প্রোডাক্ট ডিলিট হয়নি।");
    console.error(error);
    return;
  }
  if (product?.image_path) {
    const { error: storageError } = await supabase.storage.from("product-images").remove([product.image_path]);
    if (storageError) console.error("Image cleanup failed:", storageError);
  }
  await loadProducts();
}

function validateImage(file) {
  if (!file) return "";
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) return "শুধু PNG, JPEG বা WebP ছবি দিন।";
  if (file.size > 5 * 1024 * 1024) return "ছবির আকার 5 MB-এর মধ্যে রাখুন।";
  return "";
}

async function uploadProductImage(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
  const path = "products/" + crypto.randomUUID() + "-" + safeName;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function handleProductCreate(event) {
  event.preventDefault();
  const file = byId("fileInput").files[0];
  const imageError = validateImage(file);
  if (imageError) return showMessage(imageError);
  if (!editingProductId && !file) return showMessage("প্রোডাক্টের ছবি নির্বাচন করুন।");

  const payload = {
    name: byId("newProdName").value.trim(),
    tag: byId("newProdTag").value.trim(),
    price_num: Number(byId("newProdPrice").value),
    old_price: byId("newProdOldPrice").value.trim(),
    category: byId("newProdCategory").value,
    bg_gradient: byId("newProdBg").value,
    description: byId("newProdDesc").value.trim(),
    in_stock: true,
    is_published: true
  };
  if (!payload.name || !payload.tag || !Number.isFinite(payload.price_num) || payload.price_num < 0 || !payload.description) {
    return showMessage("সব প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।");
  }

  const submitButton = byId("productSubmitButton");
  submitButton.disabled = true;
  let uploaded = null;
  try {
    if (file) {
      uploaded = await uploadProductImage(file);
      payload.image_path = uploaded.path;
      payload.image_url = uploaded.url;
    }

    let result;
    if (editingProductId) {
      result = await supabase.from("products").update(payload).eq("id", editingProductId);
    } else {
      result = await supabase.from("products").insert(payload);
    }
    if (result.error) throw result.error;

    if (uploaded && editingImagePath) {
      const { error: removeError } = await supabase.storage.from("product-images").remove([editingImagePath]);
      if (removeError) console.error("Old image cleanup failed:", removeError);
    }
    showMessage(editingProductId ? "প্রোডাক্ট আপডেট হয়েছে।" : "প্রোডাক্ট যোগ হয়েছে।");
    resetProductForm();
    await loadProducts();
    showTab("tabProducts", document.querySelectorAll(".nav-link")[0]);
  } catch (error) {
    if (uploaded) await supabase.storage.from("product-images").remove([uploaded.path]);
    console.error("Product save failed:", error);
    showMessage("প্রোডাক্ট সেভ হয়নি। Storage ও database policy পরীক্ষা করুন।");
  } finally {
    submitButton.disabled = false;
  }
}
window.handleProductCreate = handleProductCreate;

function resetProductForm() {
  editingProductId = null;
  editingImagePath = null;
  byId("addProductForm").reset();
  byId("previewContainer").style.display = "none";
  byId("liveImgPreview").src = "";
  byId("productSubmitButton").textContent = "প্রোডাক্ট পাবলিশ করুন";
  byId("cancelProductEdit").style.display = "none";
}

byId("fileInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  const error = validateImage(file);
  if (error) {
    event.target.value = "";
    return showMessage(error);
  }
  if (!file) return;
  byId("liveImgPreview").src = URL.createObjectURL(file);
  byId("previewContainer").style.display = "flex";
});
byId("cancelProductEdit").addEventListener("click", resetProductForm);

async function loadOrders() {
  const tbody = byId("ordersTableBody");
  tbody.replaceChildren();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (error) {
    showMessage("অর্ডার লোড হয়নি।");
    console.error(error);
    return;
  }
  (data || []).forEach((order) => {
    const row = document.createElement("tr");
    const customerCell = document.createElement("td");
    const customer = document.createElement("strong");
    customer.textContent = order.customer_name;
    const phone = document.createElement("small");
    phone.textContent = order.phone;
    phone.style.cssText = "display:block;color:#666;";
    customerCell.append(customer, phone);
    const itemNames = (order.order_items || []).map((item) =>
      item.product_name + " × " + item.quantity
    ).join(", ");
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + (order.status === "Completed" ? "badge-done" : "badge-pending");
    badge.textContent = order.status;
    statusCell.appendChild(badge);

    const actionCell = document.createElement("td");
    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = order.status === "Pending" ? "btn-primary" : "btn-danger";
    statusButton.style.cssText = "padding:4px 8px;font-size:11px;";
    statusButton.textContent = order.status === "Pending" ? "মার্ক ডেলিভার্ড" : "পেন্ডিং করুন";
    statusButton.addEventListener("click", () =>
      updateOrderStatus(order.id, order.status === "Pending" ? "Completed" : "Pending")
    );
    actionCell.appendChild(statusButton);
    row.append(
      makeCell(order.order_number),
      customerCell,
      makeCell(order.address),
      makeCell(itemNames),
      makeCell("৳ " + Number(order.total_amount).toLocaleString("en-US")),
      statusCell,
      actionCell
    );
    tbody.appendChild(row);
  });
}

async function updateOrderStatus(id, status) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) {
    showMessage("অর্ডারের status বদলানো যায়নি।");
    console.error(error);
    return;
  }
  await loadOrders();
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", "store")
    .maybeSingle();
  if (error) {
    showMessage("Website settings লোড হয়নি।");
    console.error(error);
    return;
  }
  byId("cfgBrandName").value = data?.brand_name || "";
  byId("cfgDeliveryCharge").value = data?.delivery_charge ?? 70;
  byId("cfgFooterNotice").value = data?.footer_notice || "";
}

async function handleSettingsUpdate(event) {
  event.preventDefault();
  const payload = {
    id: "store",
    brand_name: byId("cfgBrandName").value.trim(),
    delivery_charge: Number(byId("cfgDeliveryCharge").value),
    footer_notice: byId("cfgFooterNotice").value.trim()
  };
  const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "id" });
  if (error) {
    showMessage("Website settings সেভ হয়নি।");
    console.error(error);
    return;
  }

  const newPassword = byId("cfgNewPass").value;
  if (newPassword) {
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordError) {
      byId("cfgNewPass").value = "";
      return showMessage("Settings সেভ হয়েছে, কিন্তু password update হয়নি।");
    }
    byId("cfgNewPass").value = "";
  }
  showMessage("Settings সেভ হয়েছে।");
}
window.handleSettingsUpdate = handleSettingsUpdate;

async function logoutAdmin() {
  await supabase.auth.signOut();
  window.location.href = "./login.html";
}
window.logoutAdmin = logoutAdmin;

async function initAdmin() {
  const { isAdmin } = await isCurrentUserAdmin();
  if (!isAdmin) {
    await supabase.auth.signOut();
    window.location.href = "./login.html";
    return;
  }
  await loadProducts();
}

initAdmin();
