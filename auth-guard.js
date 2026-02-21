/**
 * auth-guard.js
 * ==============
 * THE FIX: Uses onAuthStateChanged but immediately unsubscribes
 * after the first resolution — so it fires EXACTLY ONCE and stops.
 *
 * The old code kept listening → Firebase re-fired with null during
 * token refresh → every page redirected to login.html mid-session.
 *
 * USAGE on every protected page:
 *   import { requireAuth } from "./auth-guard.js";
 *   const user = await requireAuth();
 *   // safe to use user here — guaranteed logged in
 */

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Waits for Firebase Auth to fully initialize, then resolves ONCE.
 * - If logged in + email verified → returns user object
 * - If not logged in → redirects to login.html
 * - If email not verified → redirects to login.html?unverified=1
 */
export function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    // unsubscribe stops the listener after first fire — this is the key fix
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // ← CRITICAL: stop listening immediately after first resolution

      if (!user) {
        window.location.replace(redirectTo);
        return;
      }

      if (!user.emailVerified) {
        window.location.replace(`${redirectTo}?unverified=1`);
        return;
      }

      resolve(user); // ✅ user is confirmed logged in
    });
  });
}

/**
 * For login/signup pages — redirects AWAY if already logged in.
 * Resolves with null if not logged in (stays on login page).
 */
export function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // fire once only

      if (user && user.emailVerified) {
        window.location.replace(redirectTo);
        return;
      }

      resolve(null); // not logged in — stay on page
    });
  });
}