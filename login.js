import { supabase, isCurrentUserAdmin } from "./supabase-client.js";

const form = document.getElementById("adminLoginForm");
const errorBox = document.getElementById("errBox");
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.style.display = "none";
  submitButton.disabled = true;

  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    errorBox.textContent = "ইমেইল বা পাসওয়ার্ড সঠিক নয়।";
    errorBox.style.display = "block";
    submitButton.disabled = false;
    return;
  }

  const { isAdmin, error } = await isCurrentUserAdmin();
  if (error || !isAdmin) {
    await supabase.auth.signOut();
    errorBox.textContent = "এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।";
    errorBox.style.display = "block";
    submitButton.disabled = false;
    return;
  }

  window.location.href = "./admin.html";
});
