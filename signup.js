// Import Firebase
import { auth } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// Firebase config (PASTE YOUR OWN)
const firebaseConfig = {
  apiKey: "AIzaSyDrau2Su12koSelSlEqceXbPsGJwj_wr7M",
  authDomain: "unimatch-296fa.firebaseapp.com",
  projectId: "unimatch-296fa",
  storageBucket: "unimatch-296fa.firebasestorage.app",
  messagingSenderId: "904727075849",
  appId: "1:904727075849:web:f657e89c98f1937f6eacd8"
};

// Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);

// Allowed university domains
const allowedDomains = [".ac.ke", ".edu", ".ac.uk"];

const form = document.getElementById("signupForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

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

  // 2️⃣ Check password
  if (password !== confirmPassword) {
    error.textContent = "Passwords do not match.";
    return;
  }

  try {
    // 3️⃣ Create user in Firebase
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 4️⃣ Send verification email
    await sendEmailVerification(userCredential.user);

    alert("Account created! Please verify your email before logging in.");
    window.location.href = "login.html";

  } catch (err) {
    error.textContent = err.message;
  }
});
