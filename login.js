"use strict";

const SUPABASE_URL = "https://amtsjbqioyksauxkzdfp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Gmvk5dgtn6IPfDsXMF34kQ_EvFv61Bj";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";
  loginMessage.textContent = "";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    loginMessage.textContent = error.message;
    loginButton.disabled = false;
    loginButton.textContent = "Log In";
    return;
  }

  loginMessage.textContent = "Login successful.";

  console.log("Authenticated user:", data.user);

  setTimeout(() => {
    window.location.href = "social/social-media-calendar.html";
  }, 500);
});