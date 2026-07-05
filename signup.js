import { supabase } from "./js/supabase.js";
import { redirectIfLoggedIn } from "./auth-guard.js";

redirectIfLoggedIn();

const KABARAK_DOMAIN = "@kabarak.ac.ke";
const UNIVERSITY_NAME = "Kabarak University";

const form = document.getElementById("signupForm");
const error = document.getElementById("error");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (error) error.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // 1️⃣ Check Kabarak University email ONLY
    if (!email.endsWith(KABARAK_DOMAIN)) {
      if (error) {
        error.textContent = `Only ${UNIVERSITY_NAME} email addresses (${KABARAK_DOMAIN}) are allowed.`;
        error.style.display = "block";
      }
      return;
    }

    // 2️⃣ Validate email format
    const emailRegex = /^[a-zA-Z0-9._-]+@kabarak\.ac\.ke$/;
    if (!emailRegex.test(email)) {
      if (error) {
        error.textContent = "Please enter a valid Kabarak University email address.";
        error.style.display = "block";
      }
      return;
    }

    // 3️⃣ Check password strength
    if (password.length < 6) {
      if (error) {
        error.textContent = "Password must be at least 6 characters long.";
        error.style.display = "block";
      }
      return;
    }

    // 4️⃣ Check password match
    if (password !== confirmPassword) {
      if (error) {
        error.textContent = "Passwords do not match.";
        error.style.display = "block";
      }
      return;
    }

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Submit";
    if (submitBtn) {
      submitBtn.textContent = "Creating account...";
      submitBtn.disabled = true;
    }

    try {
      // 5️⃣ Create user in Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            university: UNIVERSITY_NAME,
            email_domain: KABARAK_DOMAIN
          }
        }
      });

      if (signUpErr) throw signUpErr;

      const user = data.user;

      // 6️⃣ Upsert profile data in PostgreSQL
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          name: name,
          university: UNIVERSITY_NAME,
          email_domain: KABARAK_DOMAIN,
          profile_complete: false
        });
      }

      alert(`Account created! Please check your ${UNIVERSITY_NAME} email to verify your account before logging in.`);
      window.location.href = "login.html";

    } catch (err) {
      console.error("Signup error:", err);
      if (error) {
        error.textContent = err.message || "An error occurred during signup. Please try again.";
        error.style.display = "block";
      }
      if (submitBtn) {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    }
  });
}

// Password toggle controls
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

const emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    if (value.length > 0 && !value.includes("@")) {
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