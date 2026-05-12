/**
 * auth-guard.js
 * ==============
 * Waits for Firebase Auth to fully initialize, then resolves ONCE.
 *
 * requireAuth()       → protected pages  (redirects to login if not logged in)
 * redirectIfLoggedIn() → login/signup pages (redirects to dashboard if already in)
 *
 * NOTE: Email verification check is intentionally removed.
 * To re-enable it, uncomment the emailVerified block below.
 */

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Waits for Firebase Auth to resolve, then:
 * - If logged in → returns user object
 * - If not logged in → redirects to login.html
 */
export function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // fire ONCE only — prevents mid-session token-refresh redirects

      if (!user) {
        window.location.replace(redirectTo);
        return;
      }

      // ── Optional: re-enable email verification ──────────────────
      // if (!user.emailVerified) {
      //   window.location.replace(`${redirectTo}?unverified=1`);
      //   return;
      // }
      // ───────────────────────────────────────────────────────────

      resolve(user); // ✅ confirmed logged in
    });
  });
}

/**
 * For login/signup pages — redirects away if already logged in.
 * Resolves with null if not logged in (stays on login page).
 */
export function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();

      if (user) {
        window.location.replace(redirectTo);
        return;
      }

      resolve(null); // not logged in — stay on page
    });
  });
}