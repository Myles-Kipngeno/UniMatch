/**
 * auth-guard.js
 * ==============
 * Supabase Auth Guard
 * Ensures user is authenticated and manages profile redirection.
 */

import { supabase } from "./js/supabase.js";

// Check if authenticated in session to bypass transition overlay
const isAuthenticatedCached = sessionStorage.getItem("authenticated") === "true";

if (!isAuthenticatedCached) {
  const _authOverlay = document.createElement("div");
  _authOverlay.id = "auth-guard-overlay";
  _authOverlay.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;
      background:#09080f;
      transition:opacity 0.2s ease,visibility 0.2s ease;
    ">
      <div style="
        width:48px;height:48px;border-radius:14px;
        background:linear-gradient(135deg,#7c3aed,#9333ea);
        color:#fff;font-size:24px;font-weight:800;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 20px rgba(124,58,237,0.35);
        animation:authPulse 1.2s ease-in-out infinite;
      ">U</div>
      <div style="font-family:'Outfit',sans-serif;font-size:13px;color:#8b7fa8;font-weight:500;letter-spacing:0.3px;">Loading UniMatch...</div>
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
 * requireAuth() → protected pages
 * Redirects to login.html if not logged in.
 * Resolves with the user object if logged in.
 */
export async function requireAuth(redirectTo = "login.html") {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session || !session.user) {
      sessionStorage.removeItem("authenticated");
      window.location.replace(redirectTo);
      return Promise.reject("Not authenticated");
    }

    const user = session.user;
    sessionStorage.setItem("authenticated", "true");

    // Fetch profile status
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    showBody();
    return { ...user, uid: user.id, ...profile };
  } catch (err) {
    sessionStorage.removeItem("authenticated");
    console.error("Auth guard error:", err);
    window.location.replace(redirectTo);
    return Promise.reject(err);
  }
}

/**
 * redirectIfLoggedIn() → login/signup pages
 * Redirects away if user is already logged in.
 */
export async function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_complete")
        .eq("id", session.user.id)
        .single();

      if (profile && profile.profile_complete) {
        window.location.replace(redirectTo);
      } else {
        window.location.replace("profile.html");
      }
      return session.user;
    }

    showBody();
    return null;
  } catch (_) {
    showBody();
    return null;
  }
}