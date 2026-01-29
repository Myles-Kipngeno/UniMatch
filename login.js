import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById("loginForm");
const error = document.getElementById("loginError");
const resendBtn = document.getElementById("resendBtn");
const verifyNotice = document.getElementById("verifyNotice");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Reset UI
  error.textContent = "";
  verifyNotice.style.display = "none";
  resendBtn.style.display = "none";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    // 🔒 Block login if email not verified
    if (!user.emailVerified) {
      alert("Verification email sent! Check your SPAM or inbox folder.");
      error.textContent = "Please verify your email before logging in.";
      verifyNotice.style.display = "block";
      resendBtn.style.display = "block";
      return;
    }

    // ✅ Email verified
    window.location.href = "dashboard.html";

  } catch (err) {
    error.textContent = "Invalid email or password.";
    console.error(err);
  }
});

// 🔁 Resend verification email
resendBtn.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    alert("Please log in first.");
    return;
  }

  try {
    await sendEmailVerification(user);
    alert("Verification email sent! Check your SPAM or inbox folder.");
  } catch (err) {
    alert("Failed to resend verification email.");
    console.error(err);
  }
});

// 👁 Show / Hide password
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("loginPassword");

togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  togglePassword.classList.toggle("fa-eye");
  togglePassword.classList.toggle("fa-eye-slash");
});



