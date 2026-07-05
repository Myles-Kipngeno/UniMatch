import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

const notifList      = document.getElementById("notifList");
const markAllReadBtn = document.getElementById("markAllReadBtn");

let currentUser  = null;
let allNotifs    = [];
let activeCat    = "all";

(async () => {
  try {
    currentUser = await requireAuth();
    loadNotifications();
    setupTabs();
    setupRealtimeNotifications();

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener("click", async () => {
        allNotifs.forEach(n => n.unread = false);
        renderNotifications();
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", currentUser.id);
      });
    }
  } catch (err) {
    console.error("Notifications boot error:", err);
  }
})();

function setupTabs() {
  document.querySelectorAll(".notif-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".notif-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeCat = tab.dataset.cat;
      renderNotifications();
    });
  });
}

async function loadNotifications() {
  const uid = currentUser.id;
  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*, sender:profiles!notifications_sender_id_fkey(name, photo_url)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allNotifs = (notifications || []).map(n => ({
      id: n.id,
      cat: n.type === "message" ? "messages" : n.type === "like" ? "likes" : n.type === "match" ? "matches" : "views",
      icon: n.type === "match" ? "💕" : n.type === "like" ? "❤️" : n.type === "message" ? "💬" : "👀",
      iconCls: `notif-icon--${n.type}s`,
      text: n.body || n.title || "New notification",
      time: n.created_at ? new Date(n.created_at) : new Date(),
      unread: !n.is_read,
      link: n.link || "dashboard.html"
    }));

    renderNotifications();
  } catch (e) {
    console.error("Error loading notifications:", e);
  }
}

function setupRealtimeNotifications() {
  supabase
    .channel("notifications_realtime")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${currentUser.id}` }, () => {
      loadNotifications();
    })
    .subscribe();
}

function renderNotifications() {
  if (!notifList) return;
  const filtered = activeCat === "all" ? allNotifs : allNotifs.filter(n => n.cat === activeCat);

  if (filtered.length === 0) {
    notifList.innerHTML = `
      <div class="notif-empty">
        <span style="font-size:36px">🔔</span>
        <span>No notifications in this category yet.</span>
      </div>`;
    return;
  }

  notifList.innerHTML = filtered.map(n => `
    <div class="notif-card ${n.unread ? "unread" : ""}" onclick="location.href='${n.link}'">
      <div class="notif-icon-wrap ${n.iconCls}">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${formatTime(n.time)}</div>
      </div>
      ${n.unread ? `<div class="notif-unread-dot"></div>` : ""}
    </div>
  `).join("");
}

function formatTime(d) {
  if (!(d instanceof Date) || isNaN(d)) return "Recently";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}
