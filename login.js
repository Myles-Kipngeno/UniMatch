import { supabase } from "./js/supabase.js";
import { redirectIfLoggedIn } from "./auth-guard.js";

// Check if already logged in -> redirect to dashboard
redirectIfLoggedIn();

const form = document.getElementById("loginForm");
const error = document.getElementById("loginError");
const resendBtn = document.getElementById("resendBtn");
const verifyNotice = document.getElementById("verifyNotice");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    error.textContent = "";
    if (verifyNotice) verifyNotice.style.display = "none";
    if (resendBtn) resendBtn.style.display = "none";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      const user = data.user;

      // Check if email confirmation is required
      if (user && user.email_confirmed_at === null && !user.email_confirmed) {
        error.textContent = "Please verify your email before logging in.";
        if (verifyNotice) verifyNotice.style.display = "block";
        if (resendBtn) resendBtn.style.display = "block";
        return;
      }

      sessionStorage.setItem("authenticated", "true");
      window.location.href = "dashboard.html";

    } catch (err) {
      console.error("Login error:", err);
      error.textContent = err.message || "Invalid email or password.";
    }
  });
}

if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      if (resendErr) throw resendErr;
      alert("Verification email resent! Check your SPAM or inbox folder.");
    } catch (err) {
      alert(err.message || "Failed to resend verification email.");
    }
  });
}

// Show / Hide password
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("loginPassword");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");
  });
}
