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

// Hide body immediately to prevent flashing while checking profile status
const styleEl = document.createElement("style");
styleEl.id = "auth-guard-style";
styleEl.innerHTML = "body { opacity: 0 !important; }";
document.head.appendChild(styleEl);

function showBody() {
  if (styleEl && styleEl.parentNode) {
    styleEl.parentNode.removeChild(styleEl);
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
        window.location.replace(redirectTo);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || !snap.data().profileComplete) {
          window.location.replace("profile.html");
          return;
        }

        // Show page contents now that verification has passed
        showBody();
        resolve(user); // ✅ confirmed logged in and profile complete
      } catch (err) {
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