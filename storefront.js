import { supabase, productFromRow } from "./supabase-client.js";

let products = [];
let currentIndex = 0;
let selectedExtraPrice = 0;
let selectedPack = "standard";
let cart = [];
let checkoutItems = [];
let deliveryCharge = 70;

const appFrame = document.getElementById("appFrame");
const ambientLight = document.getElementById("ambientLight");
const stageArea = document.getElementById("stageArea");
const productWrapper = document.getElementById("productWrapper");
const realProductImg = document.getElementById("realProductImg");

function toBengaliNum(value) {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/\d/g, (digit) => bnDigits[Number(digit)]);
}

function currentProduct() {
  return products[currentIndex] || null;
}

async function fetchStorefrontData() {
  try {
    const [{ data: productRows, error: productsError }, { data: config, error: settingsError }] =
      await Promise.all([
        supabase.from("products").select("*").eq("is_published", true).eq("in_stock", true).order("created_at"),
        supabase.from("site_settings").select("*").eq("id", "store").maybeSingle()
      ]);

    if (productsError) throw productsError;
    if (settingsError) throw settingsError;

    products = (productRows || []).map(productFromRow);
    if (config) {
      if (config.brand_name) {
        document.getElementById("headerBrandTitle").innerHTML =
          "✨ " + escapeHtml(config.brand_name) + " <span>Studio Care</span>";
      }
      if (config.delivery_charge !== null && config.delivery_charge !== undefined) {
        deliveryCharge = Number(config.delivery_charge);
      }
      if (config.footer_notice) {
        document.getElementById("footerSupportText").textContent = config.footer_notice;
      }
    }

    if (products.length) {
      switchProduct(0, 1);
    } else {
      document.getElementById("prodTitle").textContent = "এখনো কোনো প্রোডাক্ট যোগ করা হয়নি";
      document.getElementById("prodDesc").textContent = "অ্যাডমিন প্যানেল থেকে প্রোডাক্ট যোগ করুন।";
      document.getElementById("prodTag").textContent = "";
      document.getElementById("prodPrice").textContent = "৳ ০";
      document.getElementById("orderNowBtn").disabled = true;
      document.getElementById("addToCartBtn").disabled = true;
      document.getElementById("nextBtn").disabled = true;
      document.getElementById("prevBtn").disabled = true;
    }
  } catch (error) {
    console.error("Storefront load failed:", error);
    document.getElementById("prodTitle").textContent = "প্রোডাক্ট লোড করা যায়নি";
    document.getElementById("prodDesc").textContent =
      "Supabase সংযোগ পরীক্ষা করুন অথবা পরে আবার চেষ্টা করুন।";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function updatePriceDisplay() {
  const product = currentProduct();
  if (!product) return;
  document.getElementById("prodPrice").textContent =
    "৳ " + toBengaliNum(product.priceNum + selectedExtraPrice);
}

function switchProduct(index, direction = 1) {
  if (!products.length) return;
  currentIndex = index;
  const product = currentProduct();
  appFrame.style.background = product.bgGradient || "";
  ambientLight.style.setProperty("--ambient-glow", product.ambientGlow || "rgba(255,255,255,0.2)");

  const textIds = ["#prodTitle", "#prodDesc", "#prodPrice", "#prodOldPrice", "#prodTag"];
  if (window.gsap) {
    window.gsap.to(textIds, {
      opacity: 0, y: -18 * direction, duration: 0.22, ease: "power2.in",
      onComplete: () => {
        document.getElementById("prodTitle").textContent = product.name;
        document.getElementById("prodDesc").textContent = product.desc;
        document.getElementById("prodOldPrice").textContent = product.oldPrice;
        document.getElementById("prodTag").textContent = product.tag;
        updatePriceDisplay();
        window.gsap.to(textIds, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out" });
      }
    });
    window.gsap.to(realProductImg, {
      opacity: 0, scale: 0.8, y: -30 * direction, duration: 0.25, ease: "power2.in",
      onComplete: () => {
        realProductImg.src = product.image;
        window.gsap.to(realProductImg, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(1.2)" });
      }
    });
  } else {
    document.getElementById("prodTitle").textContent = product.name;
    document.getElementById("prodDesc").textContent = product.desc;
    document.getElementById("prodOldPrice").textContent = product.oldPrice;
    document.getElementById("prodTag").textContent = product.tag;
    realProductImg.src = product.image;
    updatePriceDisplay();
  }
}

document.getElementById("nextBtn").onclick = () => {
  if (products.length) switchProduct((currentIndex + 1) % products.length, 1);
};
document.getElementById("prevBtn").onclick = () => {
  if (products.length) switchProduct((currentIndex - 1 + products.length) % products.length, -1);
};

function handleParallax(clientX, clientY) {
  const rect = stageArea.getBoundingClientRect();
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  productWrapper.style.transform =
    "rotateX(" + ((-y / rect.height) * 26) + "deg) rotateY(" + ((x / rect.width) * 26) + "deg) scale(1.04)";
}

stageArea.addEventListener("mousemove", (event) => handleParallax(event.clientX, event.clientY));
stageArea.addEventListener("mouseleave", () => {
  productWrapper.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
});
stageArea.addEventListener("touchmove", (event) => {
  if (event.touches.length) handleParallax(event.touches[0].clientX, event.touches[0].clientY);
}, { passive: true });
stageArea.addEventListener("touchend", () => {
  productWrapper.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
});

document.querySelectorAll(".size-pill").forEach((pill) => {
  pill.addEventListener("click", function () {
    document.querySelectorAll(".size-pill").forEach((item) => item.classList.remove("active"));
    this.classList.add("active");
    selectedExtraPrice = Number(this.dataset.extra || 0);
    selectedPack = selectedExtraPrice === 200 ? "large" : "standard";
    updatePriceDisplay();
  });
});

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
searchInput.addEventListener("input", (event) => {
  const query = event.target.value.toLowerCase().trim();
  searchResults.replaceChildren();
  if (!query) {
    searchResults.style.display = "none";
    return;
  }
  const matches = products.filter((product) =>
    product.name.toLowerCase().includes(query) || product.tag.toLowerCase().includes(query)
  );
  if (!matches.length) {
    searchResults.style.display = "none";
    return;
  }
  searchResults.style.display = "block";
  matches.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.name + " (৳ " + toBengaliNum(item.priceNum) + ")";
    li.addEventListener("click", () => {
      const targetIndex = products.findIndex((product) => product.id === item.id);
      if (targetIndex !== -1) switchProduct(targetIndex, 1);
      searchInput.value = "";
      searchResults.style.display = "none";
    });
    searchResults.appendChild(li);
  });
});
document.addEventListener("click", (event) => {
  if (!searchInput.contains(event.target)) searchResults.style.display = "none";
});

const orderModal = document.getElementById("orderModal");
const cartModal = document.getElementById("cartModal");
document.getElementById("orderNowBtn").onclick = () => {
  const product = currentProduct();
  if (!product) return;
  checkoutItems = [{ product_id: product.id, quantity: 1, pack: selectedPack }];
  document.getElementById("orderSummaryTitle").textContent = "প্রোডাক্ট: " + product.name;
  document.getElementById("orderSummaryPrice").textContent =
    "মূল্য: ৳ " + toBengaliNum(product.priceNum + selectedExtraPrice) +
    " + ডেলিভারি (৳ " + toBengaliNum(deliveryCharge) + ")";
  orderModal.classList.add("open");
};

document.getElementById("closeOrderModal").onclick = () => orderModal.classList.remove("open");
document.getElementById("closeCartModal").onclick = () => cartModal.classList.remove("open");
document.getElementById("addToCartBtn").onclick = () => {
  const product = currentProduct();
  if (!product) return;
  cart.push({ ...product, pack: selectedPack, extra: selectedExtraPrice });
  document.getElementById("cartBadge").textContent = toBengaliNum(cart.length);
  alert('"' + product.name + '" ব্যাগে যোগ করা হয়েছে!');
};
document.getElementById("openCartBtn").onclick = () => {
  renderCartItems();
  cartModal.classList.add("open");
};

function renderCartItems() {
  const list = document.getElementById("cartItemsList");
  list.replaceChildren();
  if (!cart.length) {
    const empty = document.createElement("p");
    empty.textContent = "আপনার ব্যাগ খালি!";
    empty.style.cssText = "color:#777; text-align:center; padding:15px;";
    list.appendChild(empty);
    document.getElementById("cartTotalPrice").textContent = "৳ ০";
    return;
  }
  let total = 0;
  cart.forEach((item, index) => {
    total += item.priceNum + item.extra;
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f0f0f0;";
    const info = document.createElement("div");
    info.style.cssText = "display:flex; align-items:center; gap:10px;";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.style.cssText = "width:36px; height:36px; object-fit:contain;";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name + (item.pack === "large" ? " (লার্জ প্যাক)" : "");
    name.style.fontSize = "13.5px";
    const price = document.createElement("p");
    price.textContent = "৳ " + toBengaliNum(item.priceNum + item.extra);
    price.style.cssText = "font-size:12px; color:#666;";
    text.append(name, price);
    const remove = document.createElement("button");
    remove.textContent = "মুছুন";
    remove.style.cssText =
      "background:none; border:none; color:#ff4757; cursor:pointer; font-size:13px; font-weight:600;";
    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      document.getElementById("cartBadge").textContent = toBengaliNum(cart.length);
      renderCartItems();
    });
    info.append(image, text);
    row.append(info, remove);
    list.appendChild(row);
  });
  document.getElementById("cartTotalPrice").textContent = "৳ " + toBengaliNum(total);
}

window.proceedCartOrder = () => {
  if (!cart.length) return alert("ব্যাগে কোনো প্রোডাক্ট নেই!");
  checkoutItems = cart.map((item) => ({
    product_id: item.id,
    quantity: 1,
    pack: item.pack
  }));
  const total = cart.reduce((sum, item) => sum + item.priceNum + item.extra, 0);
  document.getElementById("orderSummaryTitle").textContent =
    "মোট প্রোডাক্ট সংখ্যা: " + toBengaliNum(cart.length) + " টি";
  document.getElementById("orderSummaryPrice").textContent =
    "সর্বমোট: ৳ " + toBengaliNum(total) + " + ডেলিভারি চার্জ (৳ " + toBengaliNum(deliveryCharge) + ")";
  cartModal.classList.remove("open");
  orderModal.classList.add("open");
};

window.handleOrderSubmit = async (event) => {
  event.preventDefault();
  const submitButton = document.querySelector("#orderForm button[type='submit']");
  submitButton.disabled = true;
  const payload = {
    p_customer_name: document.getElementById("custName").value.trim(),
    p_phone: document.getElementById("custPhone").value.trim(),
    p_address: [
      document.getElementById("custAddress").value.trim(),
      document.getElementById("custCity").value.trim(),
      document.getElementById("custDivision").value
    ].filter(Boolean).join(", "),
    p_items: checkoutItems
  };

  try {
    const { data, error } = await supabase.rpc("create_store_order", payload);
    if (error) throw error;
    const order = Array.isArray(data) ? data[0] : data;
    if (!order?.order_number) throw new Error("অর্ডার নম্বর পাওয়া যায়নি।");
    alert("ধন্যবাদ! অর্ডারটি নিশ্চিত হয়েছে। ট্র্যাকিং আইডি: " + order.order_number);
    orderModal.classList.remove("open");
    document.getElementById("orderForm").reset();
    cart = [];
    checkoutItems = [];
    document.getElementById("cartBadge").textContent = "০";
  } catch (error) {
    console.error("Order submission failed:", error);
    alert("অর্ডার জমা হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
  } finally {
    submitButton.disabled = false;
  }
};

fetchStorefrontData();
