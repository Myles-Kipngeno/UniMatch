/**
 * auth-guard.js
 * ==============
 * Waits for Firebase Auth to fully initialize, then resolves ONCE.
 * Enforces profileComplete verification before resolving.
 *
 * requireAuth()       → protected pages  (redirects to login if not logged in, or profile if incomplete)
 * redirectIfLoggedIn() → login/signup pages (redirects to dashboard/profile depending on status)
 */

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Check if we are already authenticated in this session to bypass transition overlay
const isAuthenticatedCached = sessionStorage.getItem("authenticated") === "true";

if (!isAuthenticatedCached) {
  // Show a branded loading overlay instead of a blank white page
  const _authOverlay = document.createElement("div");
  _authOverlay.id = "auth-guard-overlay";
  _authOverlay.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;
      background:#f7f6fb;
      transition:opacity 0.2s ease,visibility 0.2s ease;
    ">
      <div style="
        width:48px;height:48px;border-radius:14px;
        background:linear-gradient(135deg,#6c47ff,#a855f7);
        color:#fff;font-size:24px;font-weight:800;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 20px rgba(108,71,255,0.35);
        animation:authPulse 1.2s ease-in-out infinite;
      ">U</div>
      <div style="font-family:'Outfit',sans-serif;font-size:13px;color:#8b8a9a;font-weight:500;letter-spacing:0.3px;">Loading...</div>
    </div>
  `;
  const _authStyle = document.createElement("style");
  _authStyle.textContent = `@keyframes authPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.85}}`;
  document.head.appendChild(_authStyle);
  document.body.appendChild(_authOverlay);
}

function showBody() {
  const overlay = document.getElementById("auth-guard-overlay");
  if (overlay) {
    const inner = overlay.firstElementChild;
    if (inner) {
      inner.style.opacity = "0";
      inner.style.visibility = "hidden";
    }
    setTimeout(() => overlay.remove(), 200);
  }
  document.body.classList.add("auth-checked");
}

/**
 * Waits for Firebase Auth to resolve, then:
 * - If logged in and profile complete → returns user object
 * - If not logged in → redirects to login.html
 * - If logged in but profile NOT complete → redirects to profile.html
 */
export function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // fire ONCE only

      if (!user) {
        sessionStorage.removeItem("authenticated");
        window.location.replace(redirectTo);
        return;
      }

      try {
        sessionStorage.setItem("authenticated", "true");
        // Show page contents now that verification has passed
        showBody();
        resolve(user); // ✅ confirmed logged in
      } catch (err) {
        sessionStorage.removeItem("authenticated");
        console.error("Auth guard check failed:", err);
        window.location.replace(redirectTo);
      }
    });
  });
}

/**
 * For login/signup pages — redirects away if already logged in.
 * Resolves with null if not logged in (stays on login page).
 */
export function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists() && snap.data().profileComplete) {
            window.location.replace(redirectTo);
          } else {
            window.location.replace("profile.html");
          }
        } catch (_) {
          window.location.replace(redirectTo);
        }
        return;
      }

      showBody(); // Show page if not logged in
      resolve(null); // not logged in — stay on page
    });
  });
}