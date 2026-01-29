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
// Allowed university domains
// ===============================
const allowedDomains = [".ac.ke", ".edu", ".ac.uk"];

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
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // 1️⃣ Check university email
  const isUniversityEmail = allowedDomains.some(domain =>
    email.endsWith(domain)
  );

  if (!isUniversityEmail) {
    error.textContent = "Only university email addresses are allowed.";
    return;
  }

  // 2️⃣ Check password match
  if (password !== confirmPassword) {
    error.textContent = "Passwords do not match.";
    return;
  }

  try {
    // 3️⃣ Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    // 4️⃣ Create Firestore user document (createdAt GOES HERE ✅)
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: user.email,
      createdAt: serverTimestamp(),
      emailVerified: false
    });

    // 5️⃣ Send verification email
    await sendEmailVerification(user);

    alert("Account created! Please verify your email before logging in.");
    window.location.href = "login.html";

  } catch (err) {
    error.textContent = err.message;
    console.error(err);
  }
});

// ===============================
// 👁 Show / Hide password
// ===============================
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.classList.toggle("fa-eye");
  togglePassword.classList.toggle("fa-eye-slash");
});

// ===============================
// 👁 Show / Hide confirm password
// ===============================
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");

toggleConfirmPassword.addEventListener("click", () => {
  const isHidden = confirmPasswordInput.type === "password";
  confirmPasswordInput.type = isHidden ? "text" : "password";
  toggleConfirmPassword.classList.toggle("fa-eye");
  toggleConfirmPassword.classList.toggle("fa-eye-slash");
});
