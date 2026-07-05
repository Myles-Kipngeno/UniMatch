import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

// DOM references
const greetingLine    = document.getElementById("greetingLine");
const welcomeName     = document.getElementById("welcomeName");
const profileSummary  = document.getElementById("profileSummary");
const profilePhoto    = document.getElementById("profilePhoto");
const heroName        = document.getElementById("heroName");
const navPhoto        = document.getElementById("navPhoto");
const completionBar   = document.getElementById("completionBar");
const completionPct   = document.getElementById("completionPct");
const editProfileBtn  = document.getElementById("editProfileBtn");
const profileViewsEl  = document.getElementById("profileViews");
const likesReceivedEl = document.getElementById("likesReceived");
const totalMatchesEl  = document.getElementById("totalMatches");
const matchBadge      = document.getElementById("matchBadge");
const msgBadge        = document.getElementById("msgBadge");
const activityFeed    = document.getElementById("activityFeed");
const recentChats     = document.getElementById("recentChats");
const chatsEmpty      = document.getElementById("chatsEmpty");
const previewName     = document.getElementById("previewName");
const previewMeta     = document.getElementById("previewMeta");
const previewTags     = document.getElementById("previewTags");
const previewPhoto    = document.getElementById("previewPhoto");
const pickName        = document.getElementById("pickName");
const pickMeta        = document.getElementById("pickMeta");
const pickTags        = document.getElementById("pickTags");
const pickPhoto       = document.getElementById("pickPhoto");
const pickCompat      = document.getElementById("pickCompat");
const pickViewBtn     = document.getElementById("pickViewBtn");

let currentUid  = null;
let currentData = {};

// BOOTSTRAP
(async () => {
  try {
    const user = await requireAuth();
    currentUid = user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUid)
      .single();

    currentData = profile || {};

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 12  ? "Good morning"
                   : hour >= 12 && hour < 17 ? "Good afternoon"
                   : hour >= 17 && hour < 21 ? "Good evening"
                   : "Good night";
    const name = currentData.name || user.email?.split("@")[0] || "Student";

    if (greetingLine) greetingLine.textContent = greeting;
    if (welcomeName)  welcomeName.textContent  = name;
    if (heroName)     heroName.textContent     = name;
    if (profileSummary) {
      profileSummary.textContent = [currentData.course, currentData.campus].filter(Boolean).join(" • ") || "Complete your profile";
    }

    // Photos
    if (currentData.photo_url) {
      if (profilePhoto) profilePhoto.src = currentData.photo_url;
      if (navPhoto)     navPhoto.src     = currentData.photo_url;
    }

    updateCompletion(currentData);

    // Initial stats and Realtime listeners
    loadStats(currentUid);
    loadRecentChats(currentUid);
    loadActivityFeed(currentUid, currentData);
    loadDiscoverPreview(currentUid, currentData);
    loadTodaysPick(currentUid, currentData);
    animateCampusPulse();
    rotateIcebreaker();

    // Subscribe to Realtime notifications and likes
    setupRealtimeSubscriptions(currentUid);

  } catch (err) {
    console.error("Dashboard boot error:", err);
    window.location.replace("login.html");
  }
})();

// PROFILE COMPLETION
function updateCompletion(data) {
  const fields = ["name","bio","course","campus","photo_url","age","gender","interests"];
  const filled = fields.filter(f => data[f] && (Array.isArray(data[f]) ? data[f].length > 0 : String(data[f]).trim() !== "")).length;
  const pct = Math.round((filled / fields.length) * 100);

  if (completionBar) {
    setTimeout(() => { completionBar.style.width = pct + "%"; }, 300);
  }
  if (completionPct) completionPct.textContent = pct + "% Complete";
  if (editProfileBtn) {
    editProfileBtn.textContent = pct >= 100 ? "Edit Profile" : "Complete Profile";
    editProfileBtn.onclick = () => location.href = "profile.html?edit=true";
  }
}

// ANIMATED COUNT-UP
function animateCount(el, target) {
  if (!el) return;
  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  const tick = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = current.toString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// STATS FETCH
async function loadStats(uid) {
  try {
    // 1. Likes count
    const { count: likesCount } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("to_user_id", uid);

    if (likesReceivedEl) animateCount(likesReceivedEl, likesCount || 0);

    // 2. Views count
    const { count: viewsCount } = await supabase
      .from("views")
      .select("*", { count: "exact", head: true })
      .eq("target_id", uid);

    if (profileViewsEl) animateCount(profileViewsEl, viewsCount || 0);

    // 3. Matches count
    const { data: matches } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, user1_unread, user2_unread")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);

    const matchesCount = matches ? matches.length : 0;
    if (totalMatchesEl) animateCount(totalMatchesEl, matchesCount);

    if (matchBadge) {
      matchBadge.textContent = matchesCount;
      matchBadge.style.display = matchesCount > 0 ? "flex" : "none";
    }

    // Calculate unread
    let unreadTotal = 0;
    (matches || []).forEach(m => {
      unreadTotal += m.user1_id === uid ? (m.user1_unread || 0) : (m.user2_unread || 0);
    });

    if (msgBadge) {
      msgBadge.textContent = unreadTotal > 99 ? "99+" : unreadTotal;
      msgBadge.style.display = unreadTotal > 0 ? "flex" : "none";
    }
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

// REALTIME SUBSCRIPTIONS
function setupRealtimeSubscriptions(uid) {
  supabase
    .channel("dashboard_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `to_user_id=eq.${uid}` }, () => loadStats(uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => loadStats(uid))
    .on("postgres_changes", { event: "*", schema: "public", table: "views", filter: `target_id=eq.${uid}` }, () => loadStats(uid))
    .subscribe();
}

// ACTIVITY FEED
async function loadActivityFeed(uid, userData) {
  if (!activityFeed) return;
  const events = [];

  try {
    // Profile Views
    const { data: views } = await supabase
      .from("views")
      .select("id, created_at, profiles!views_viewer_id_fkey(name)")
      .eq("target_id", uid)
      .order("created_at", { ascending: false })
      .limit(3);

    (views || []).forEach(v => {
      events.push({
        type: "view",
        name: v.profiles?.name || "Someone",
        time: new Date(v.created_at),
        emoji: "👀",
        cls: "activity-dot--view"
      });
    });

    // Likes
    const { data: likes } = await supabase
      .from("likes")
      .select("id, created_at, profiles!likes_from_user_id_fkey(name)")
      .eq("to_user_id", uid)
      .order("created_at", { ascending: false })
      .limit(2);

    (likes || []).forEach(l => {
      events.push({
        type: "like",
        name: l.profiles?.name || "Someone",
        time: new Date(l.created_at),
        emoji: "❤️",
        cls: "activity-dot--like"
      });
    });

  } catch (e) {
    console.warn("Activity feed query error:", e);
  }

  if (events.length === 0) {
    events.push(
      { type: "join", name: "UniMatch", time: null, emoji: "🎉", cls: "activity-dot--join", text: "Welcome to UniMatch! Start swiping to find matches" },
      { type: "view", name: "Get started", time: null, emoji: "👀", cls: "activity-dot--view", text: "Complete your profile to get more views" }
    );
  }

  activityFeed.innerHTML = events.slice(0, 5).map(ev => `
    <div class="activity-item">
      <div class="activity-dot ${ev.cls}">${ev.emoji}</div>
      <div class="activity-text">${ev.text || `<strong>${ev.name}</strong> ${ev.type === 'view' ? 'viewed your profile' : 'liked your profile'}`}</div>
      <div class="activity-time">${ev.time ? relativeTime(ev.time) : 'Just now'}</div>
    </div>
  `).join("");
}

// DISCOVER PREVIEW
async function loadDiscoverPreview(uid, myData) {
  if (!previewName) return;
  try {
    // Exclude liked / passed
    const { data: liked } = await supabase.from("likes").select("to_user_id").eq("from_user_id", uid);
    const { data: passed } = await supabase.from("passes").select("to_user_id").eq("from_user_id", uid);

    const excludedIds = [uid, ...(liked || []).map(l => l.to_user_id), ...(passed || []).map(p => p.to_user_id)];

    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .eq("profile_complete", true)
      .not("id", "in", `(${excludedIds.join(",")})`)
      .limit(10);

    if (!candidates || candidates.length === 0) {
      if (previewName) previewName.textContent = "No new profiles yet";
      if (previewMeta) previewMeta.textContent = "Check back soon!";
      return;
    }

    const next = candidates[0];
    if (previewPhoto && next.photo_url) previewPhoto.src = next.photo_url;
    if (previewName) previewName.textContent = next.name || "Student";
    if (previewMeta) previewMeta.textContent = [next.course, next.campus].filter(Boolean).join(" · ") || "UniMatch student";
    if (previewTags) {
      previewTags.innerHTML = (next.interests || []).slice(0, 3).map(t => `<span class="dp-tag">${t}</span>`).join("");
    }
  } catch (err) {
    console.warn("Preview load error:", err);
  }
}

// TODAY'S PICK
async function loadTodaysPick(uid, myData) {
  if (!pickName) return;
  try {
    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", uid)
      .eq("profile_complete", true)
      .limit(15);

    if (!candidates || candidates.length === 0) return;

    const myInterests = myData.interests || [];
    candidates.forEach(c => {
      const shared = (c.interests || []).filter(i => myInterests.includes(i)).length;
      c._shared = shared;
    });

    candidates.sort((a, b) => b._shared - a._shared);
    const pick = candidates[0];

    const compatPct = Math.min(99, Math.round(65 + pick._shared * 10));

    if (pickPhoto && pick.photo_url) pickPhoto.src = pick.photo_url;
    if (pickName) pickName.textContent = pick.name || "Student";
    if (pickMeta) pickMeta.textContent = [pick.course, pick.campus].filter(Boolean).join(" · ") || "UniMatch student";
    if (pickCompat) pickCompat.textContent = compatPct + "%";
    if (pickTags) {
      pickTags.innerHTML = (pick.interests || []).slice(0, 3).map(t => `<span class="pick-tag">${t}</span>`).join("");
    }
    if (pickViewBtn) pickViewBtn.onclick = () => location.href = "discover.html";
  } catch (err) {
    console.warn("Today's pick error:", err);
  }
}

// RECENT CHATS
async function loadRecentChats(uid) {
  if (!recentChats) return;

  try {
    const { data: matches } = await supabase
      .from("matches")
      .select("*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order("last_message_at", { ascending: false })
      .limit(3);

    if (!matches || matches.length === 0) {
      if (chatsEmpty) chatsEmpty.style.display = "flex";
      return;
    }

    if (chatsEmpty) chatsEmpty.style.display = "none";

    recentChats.innerHTML = matches.map(m => {
      const other = m.user1_id === uid ? m.p2 : m.p1;
      const unread = m.user1_id === uid ? m.user1_unread : m.user2_unread;
      return `
        <div class="chat-item" onclick="location.href='matches.html?matchId=${m.id}'">
          <div class="chat-avatar-wrap">
            <img class="chat-avatar" src="${other?.photo_url || DEFAULT_AVATAR}" alt="${other?.name || 'Match'}" onerror="this.src='${DEFAULT_AVATAR}'">
            ${other?.online ? `<div class="chat-online"></div>` : ""}
          </div>
          <div class="chat-meta">
            <div class="chat-name">${other?.name || "Match"}</div>
            <div class="chat-preview">${m.last_message || "Say hello 👋"}</div>
          </div>
          <div class="chat-right">
            <div class="chat-time">${m.last_message_at ? relativeTime(new Date(m.last_message_at)) : ""}</div>
            ${unread > 0 ? `<span class="chat-unread">${unread}</span>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.warn("Recent chats error:", err);
  }
}

// CAMPUS PULSE
function animateCampusPulse() {
  const base = { library: 18, cafe: 9, event: 14, online: 56 };
  const els  = {
    library: document.getElementById("pulseLibrary"),
    cafe:    document.getElementById("pulseCafe"),
    event:   document.getElementById("pulseEvent"),
    online:  document.getElementById("pulseOnline"),
  };
  Object.keys(els).forEach(k => { if (els[k]) animateCount(els[k], base[k]); });
}

// DAILY ICEBREAKER
const ICEBREAKERS = [
  '"What\'s your dream vacation?"',
  '"What would you do if money wasn\'t an issue?"',
  '"Describe your perfect Sunday morning."',
  '"What\'s the best meal you\'ve ever had?"',
  '"What three things can you not live without?"'
];
function rotateIcebreaker() {
  const el = document.getElementById("icebreakerQ");
  if (!el) return;
  el.textContent = ICEBREAKERS[Math.floor(Date.now() / 86400000) % ICEBREAKERS.length];
}

function relativeTime(date) {
  if (!(date instanceof Date) || isNaN(date)) return "Recently";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

// MODAL SHEET PRESERVED
window.openModal = async function(type) {
  alert(`Viewing ${type} list on Supabase!`);
};