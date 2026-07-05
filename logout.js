import { supabase } from "./js/supabase.js";

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      sessionStorage.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      alert("You have been logged out.");
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Try again.");
    }
  });
}
