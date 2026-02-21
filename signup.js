// ===============================
// Firebase imports
// ===============================
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===============================
// Kabarak University email domain
// ===============================
const KABARAK_DOMAIN = "@kabarak.ac.ke";
const UNIVERSITY_NAME = "Kabarak University";

// ===============================
// DOM elements
// ===============================
const form = document.getElementById("signupForm");
const error = document.getElementById("error");

// ===============================
// Signup logic
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // 1️⃣ Check Kabarak University email ONLY
  if (!email.endsWith(KABARAK_DOMAIN)) {
    error.textContent = `Only ${UNIVERSITY_NAME} email addresses (${KABARAK_DOMAIN}) are allowed.`;
    error.style.display = "block";
    return;
  }

  // 2️⃣ Validate email format
  const emailRegex = /^[a-zA-Z0-9._-]+@kabarak\.ac\.ke$/;
  if (!emailRegex.test(email)) {
    error.textContent = "Please enter a valid Kabarak University email address.";
    error.style.display = "block";
    return;
  }

  // 3️⃣ Check password strength
  if (password.length < 6) {
    error.textContent = "Password must be at least 6 characters long.";
    error.style.display = "block";
    return;
  }

  // 4️⃣ Check password match
  if (password !== confirmPassword) {
    error.textContent = "Passwords do not match.";
    error.style.display = "block";
    return;
  }

  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  submitBtn.textContent = "Creating account...";
  submitBtn.disabled = true;

  try {
    // 5️⃣ Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    // 6️⃣ Create Firestore user document
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: user.email,
      university: UNIVERSITY_NAME,
      emailDomain: KABARAK_DOMAIN,
      createdAt: serverTimestamp(),
      emailVerified: false,
      profileComplete: false,
      onlineStatus: "offline",
      lastSeen: serverTimestamp()
    });

    console.log("✅ User document created for:", user.email);

    // 7️⃣ Send verification email
    await sendEmailVerification(user);

    console.log("✅ Verification email sent");

    alert(`Account created! Please check your ${UNIVERSITY_NAME} email to verify your account before logging in.`);
    window.location.href = "login.html";

  } catch (err) {
    console.error("❌ Signup error:", err);
    
    // User-friendly error messages
    if (err.code === "auth/email-already-in-use") {
      error.textContent = "This email is already registered. Please log in instead.";
    } else if (err.code === "auth/invalid-email") {
      error.textContent = "Invalid email address format.";
    } else if (err.code === "auth/weak-password") {
      error.textContent = "Password is too weak. Please use a stronger password.";
    } else if (err.code === "auth/network-request-failed") {
      error.textContent = "Network error. Please check your internet connection.";
    } else {
      error.textContent = err.message || "An error occurred during signup. Please try again.";
    }
    
    error.style.display = "block";
    
    // Restore button
    submitBtn.textContent = originalBtnText;
    submitBtn.disabled = false;
  }
});

// ===============================
// 👁 Show / Hide password
// ===============================
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");
  });
}

// ===============================
// 👁 Show / Hide confirm password
// ===============================
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

if (toggleConfirmPassword && confirmPasswordInput) {
  toggleConfirmPassword.addEventListener("click", () => {
    const isHidden = confirmPasswordInput.type === "password";
    confirmPasswordInput.type = isHidden ? "text" : "password";
    toggleConfirmPassword.classList.toggle("fa-eye");
    toggleConfirmPassword.classList.toggle("fa-eye-slash");
  });
}

// ===============================
// Email input helper text
// ===============================
const emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    
    // Auto-suggest domain if user is typing
    if (value.length > 0 && !value.includes("@")) {
      // Show helper text
      let helperText = document.getElementById("emailHelper");
      if (!helperText) {
        helperText = document.createElement("small");
        helperText.id = "emailHelper";
        helperText.style.color = "#667eea";
        helperText.style.fontSize = "12px";
        helperText.style.marginTop = "4px";
        helperText.style.display = "block";
        emailInput.parentElement.appendChild(helperText);
      }
      helperText.textContent = `Use your ${UNIVERSITY_NAME} email: ${value}${KABARAK_DOMAIN}`;
    } else {
      const helperText = document.getElementById("emailHelper");
      if (helperText) helperText.remove();
    }
  });
}