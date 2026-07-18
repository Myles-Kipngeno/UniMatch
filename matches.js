import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

const matchesContainer   = document.getElementById("matchesContainer");
const noMatchesContainer = document.getElementById("noMatchesContainer");
const loadingContainer   = document.getElementById("loadingContainer");

let currentUser = null;
let realtimeChannel = null;

async function init() {
  try {
    currentUser = await requireAuth();
    await loadAndRenderMatches();
    setupRealtimeSubscription();
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

async function loadAndRenderMatches() {
  if (loadingContainer) loadingContainer.style.display = "flex";

  const uid = currentUser.id;

  try {
    const { data: matches, error } = await supabase
      .from("matches")
      .select(`
        *,
        p1:profiles!matches_user1_id_fkey(id, name, age, campus, course, photo_url),
        p2:profiles!matches_user2_id_fkey(id, name, age, campus, course, photo_url)
      `)
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order("last_message_at", { ascending: false });

    if (loadingContainer) loadingContainer.style.display = "none";

    if (error) {
      console.error("Error loading matches:", error);
      return;
    }

    if (!matches || matches.length === 0) {
      if (matchesContainer) matchesContainer.innerHTML = "";
      if (noMatchesContainer) noMatchesContainer.style.display = "flex";
      return;
    }

    if (noMatchesContainer) noMatchesContainer.style.display = "none";
    if (matchesContainer) {
      matchesContainer.innerHTML = "";

      matches.forEach((match) => {
        const other = match.user1_id === uid ? match.p2 : match.p1;
        if (!other) return;

        const matchId = match.id;
        const unreadCount = match.user1_id === uid ? (match.user1_unread || 0) : (match.user2_unread || 0);

        const card = document.createElement("div");
        card.className = "match-card";

        const badgeHTML = unreadCount > 0
          ? `<div class="card-badge" style="
               position:absolute;
               top:-10px;
               right:-10px;
               min-width:26px;
               height:26px;
               padding:0 7px;
               border-radius:50px;
               background:linear-gradient(135deg,#f093fb,#f5576c);
               color:#fff;
               font-size:13px;
               font-weight:700;
               display:flex;
               align-items:center;
               justify-content:center;
               box-shadow:0 2px 10px rgba(245,87,108,0.6);
               border:2px solid white;
               z-index:999;
             ">${unreadCount}</div>`
          : "";

        card.innerHTML = `
          ${badgeHTML}
          <img src="${other.photo_url || './default-avatar.png'}" alt="${other.name}" onerror="this.src='./default-avatar.png'">
          <h3>${other.name}, ${other.age}</h3>
          <p>📍 ${other.campus}</p>
          <p>📚 ${other.course}</p>
          <button onclick="location.href='chat.html?matchId=${matchId}'">
            💬 Start Chat
          </button>`;

        matchesContainer.appendChild(card);
      });
    }
  } catch (err) {
    console.error("Error loading matches:", err);
    if (loadingContainer) loadingContainer.style.display = "none";
  }
}

function setupRealtimeSubscription() {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
  }

  realtimeChannel = supabase
    .channel("matches_realtime_js")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      () => {
        loadAndRenderMatches();
      }
    )
    .subscribe();
}

init();