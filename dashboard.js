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
    initRadar(currentUid);
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

// ═══════════════════════════════════════
//  CAMPUS PULSE ENGINE
// ═══════════════════════════════════════
const CAMPUS_SPOTS = [
  { id: "library", name: "Library", emoji: "📚" },
  { id: "cafe", name: "Café", emoji: "☕" },
  { id: "halls", name: "Lecture Halls", emoji: "🏛️" },
  { id: "gym", name: "Campus Gym", emoji: "🏋️" },
  { id: "hostels", name: "Student Hostels", emoji: "🏢" }
];

const SWEEP_SPEED      = 0.022; // radians per frame
const TRAIL_ANGLE      = Math.PI * 0.42;
const DOT_LERP         = 0.06;

let myCurrentSpot      = null;
let radarDots          = [];   // { id, x, y, tx, ty, pingTime }
let radarSweepAngle    = 0;
let radarAnimId        = null;
let myRadarLat         = null;
let myRadarLng         = null;
let currentRadarRange  = 2000; // default 2km
let radarCanvas, radarCtx, radarSz, radarCx, radarCy, radarR;

// ── Main entry point ──────────────────
function initRadar(uid) {
  // Initialize tabs toggle
  const tabBtnSpots = document.getElementById("tabBtnSpots");
  const tabBtnRadar = document.getElementById("tabBtnRadar");
  const contentSpots = document.getElementById("pulseContentSpots");
  const contentRadar = document.getElementById("pulseContentRadar");

  if (tabBtnSpots && tabBtnRadar && contentSpots && contentRadar) {
    tabBtnSpots.addEventListener("click", () => {
      tabBtnSpots.classList.add("active");
      tabBtnRadar.classList.remove("active");
      contentSpots.style.display = "block";
      contentRadar.style.display = "none";
    });

    tabBtnRadar.addEventListener("click", () => {
      tabBtnRadar.classList.add("active");
      tabBtnSpots.classList.remove("active");
      contentSpots.style.display = "none";
      contentRadar.style.display = "block";
      
      // Fit canvas size
      if (radarCanvas) {
        const sz = Math.min(radarCanvas.parentElement.clientWidth || 280, 280);
        radarCanvas.width  = sz;
        radarCanvas.height = sz;
        radarSz = sz;
        radarCx = sz / 2;
        radarCy = sz / 2;
        radarR  = sz / 2 - 8;
      }
    });
  }

  // Initialize range selectors
  const rangeButtons = document.querySelectorAll("#radarRanges .range-btn");
  rangeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRadarRange = parseInt(btn.dataset.range, 10);
      const countEl = document.getElementById("radarOnlineCount");
      if (myRadarLat != null) {
        loadRadarDots(uid, countEl);
      } else {
        loadRadarFallback(uid, countEl);
      }
    });
  });

  // Setup Canvas
  radarCanvas = document.getElementById("radarCanvas");
  if (radarCanvas) {
    const wrap = radarCanvas.parentElement;
    const sz   = Math.min(wrap.clientWidth || 280, 280);
    radarCanvas.width  = sz;
    radarCanvas.height = sz;
    radarSz = sz;
    radarCx = sz / 2;
    radarCy = sz / 2;
    radarR  = sz / 2 - 8;
    radarCtx = radarCanvas.getContext("2d");
    startRadarLoop();
  }

  // Load spots & location
  loadSpotsData(uid);
  requestRadarLocation(uid);
}

// ── Canvas draw loop ──────────────────
function startRadarLoop() {
  if (radarAnimId) cancelAnimationFrame(radarAnimId);

  function frame() {
    if (!radarCtx) return;
    const ctx = radarCtx;
    const cx = radarCx, cy = radarCy, r = radarR;
    const now = performance.now();

    ctx.clearRect(0, 0, radarSz, radarSz);

    // ── Dark radar background ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bgGrad.addColorStop(0, "#0e0b1e");
    bgGrad.addColorStop(1, "#060412");
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(130, 80, 255, 0.5)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Clip everything inside circle ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // ── Range rings ──
    [0.33, 0.60, 0.87].forEach((frac, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(110, 70, 255, ${0.08 + i * 0.06})`;
      ctx.lineWidth   = 1;
      ctx.stroke();

      // Ring distance labels
      ctx.save();
      ctx.fillStyle = "rgba(160, 130, 255, 0.35)";
      ctx.font = "8px Outfit, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      let lbl = "";
      if (currentRadarRange === 100) {
        lbl = i === 0 ? "30m" : i === 1 ? "60m" : "100m";
      } else if (currentRadarRange === 500) {
        lbl = i === 0 ? "150m" : i === 1 ? "300m" : "500m";
      } else if (currentRadarRange === 1000) {
        lbl = i === 0 ? "300m" : i === 1 ? "600m" : "1km";
      } else {
        lbl = i === 0 ? "600m" : i === 1 ? "1.3km" : "2km";
      }
      ctx.fillText(lbl, cx, cy - (r * frac) + 7);
      ctx.restore();
    });

    // ── Crosshair lines ──
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = "rgba(110, 70, 255, 0.13)";
    ctx.lineWidth   = 1;
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ── Rotating sweep ──
    radarSweepAngle = (radarSweepAngle + SWEEP_SPEED) % (Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radarSweepAngle);

    // Trailing glow fan
    const STEPS = 55;
    for (let s = 0; s < STEPS; s++) {
      const frac  = s / STEPS;
      const start = -TRAIL_ANGLE * (1 - frac);
      const end   = start + (TRAIL_ANGLE / STEPS) + 0.005;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = `rgba(120, 70, 255, ${frac * frac * 0.28})`;
      ctx.fill();
    }

    // Leading edge line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r, 0);
    ctx.strokeStyle = "rgba(200, 160, 255, 0.9)";
    ctx.lineWidth   = 2;
    ctx.shadowColor = "rgba(160, 100, 255, 0.8)";
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();

    // ── User dots ──
    radarDots.forEach(dot => {
      // Smooth lerp toward target position
      dot.x += (dot.tx - dot.x) * DOT_LERP;
      dot.y += (dot.ty - dot.y) * DOT_LERP;

      // Detect when sweep passes over dot
      const dotAngle   = ((Math.atan2(dot.y - cy, dot.x - cx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const sweepNorm  = ((radarSweepAngle - TRAIL_ANGLE * 0.05) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const diff       = Math.abs(sweepNorm - dotAngle);
      if (diff < SWEEP_SPEED * 2.5 || diff > Math.PI * 2 - SWEEP_SPEED * 2.5) {
        dot.pingTime = now;
      }

      const pingAge   = now - (dot.pingTime || 0);
      const pingAlpha = pingAge < 2200 ? Math.max(0, 1 - pingAge / 2200) : 0;

      // Expanding ping ring
      if (pingAlpha > 0.02) {
        const ringR = 5 + (1 - pingAlpha) * 18;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 220, 255, ${pingAlpha * 0.7})`;
        ctx.lineWidth   = 1.2;
        ctx.stroke();
      }

      // Glow halo
      const halo = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, 12);
      halo.addColorStop(0, `rgba(80, 200, 255, ${0.25 + pingAlpha * 0.5})`);
      halo.addColorStop(1, "rgba(80, 200, 255, 0)");
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // Dot core
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130, 220, 255, ${0.75 + pingAlpha * 0.25})`;
      ctx.shadowColor = "rgba(80, 200, 255, 0.9)";
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });

    ctx.restore(); // end clip

    // ── Center dot — YOU ──
    const pulse = 0.5 + 0.5 * Math.sin(now / 420);

    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 120, 255, ${0.25 + pulse * 0.2})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Inner glow
    const youGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    youGlow.addColorStop(0, "rgba(220, 170, 255, 1)");
    youGlow.addColorStop(1, "rgba(130, 60,  255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle   = youGlow;
    ctx.shadowColor = "rgba(160, 80, 255, 0.9)";
    ctx.shadowBlur  = 12;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // White core
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // YOU label
    ctx.fillStyle   = "rgba(255, 255, 255, 0.65)";
    ctx.font        = `bold ${Math.max(8, radarSz * 0.034)}px Outfit, sans-serif`;
    ctx.textAlign   = "center";
    ctx.fillText("YOU", cx, cy + 20);

    radarAnimId = requestAnimationFrame(frame);
  }

  radarAnimId = requestAnimationFrame(frame);
}

// ── Geolocation + presence upsert ─────
async function requestRadarLocation(uid) {
  const hintEl  = document.getElementById("radarHint");
  const countEl = document.getElementById("radarOnlineCount");

  if (!navigator.geolocation) {
    if (hintEl) hintEl.textContent = "GPS unavailable — showing online students";
    await loadRadarFallback(uid, countEl);
    setupRadarRealtime(uid, countEl);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      myRadarLat = Math.round(pos.coords.latitude  * 100) / 100; // ~1.1 km fuzzy
      myRadarLng = Math.round(pos.coords.longitude * 100) / 100;

      await upsertPresence(uid, myRadarLat, myRadarLng);
      if (hintEl) hintEl.textContent = `Showing students within ~${currentRadarRange >= 1000 ? (currentRadarRange/1000)+'km' : currentRadarRange+'m'}`;
      await loadRadarDots(uid, countEl);
      setupRadarRealtime(uid, countEl);

      // Refresh position every 60 s
      setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          async p => {
            myRadarLat = Math.round(p.coords.latitude  * 100) / 100;
            myRadarLng = Math.round(p.coords.longitude * 100) / 100;
            await upsertPresence(uid, myRadarLat, myRadarLng);
            await loadRadarDots(uid, countEl);
          },
          () => {},
          { maximumAge: 30000 }
        );
      }, 60000);
    },
    async () => {
      if (hintEl) hintEl.textContent = "Location off — showing online students";
      await loadRadarFallback(uid, countEl);
      setupRadarRealtime(uid, countEl);
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

async function upsertPresence(uid, lat, lng) {
  try {
    await supabase.from("presence").upsert(
      { user_id: uid, online: true, lat, lng, location_name: myCurrentSpot, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) {
    console.warn("Presence upsert:", e);
  }
}

// ── Load real GPS dots ────────────────
async function loadRadarDots(uid, countEl) {
  if (!radarCanvas) return;
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("presence")
      .select("user_id, lat, lng")
      .eq("online", true)
      .neq("user_id", uid)
      .gte("updated_at", cutoff);

    // Approximate distance filter (in meters)
    const filtered = (data || []).filter(d => {
      if (d.lat == null || d.lng == null || !myRadarLat) return false;
      const distM = Math.hypot(d.lat - myRadarLat, d.lng - myRadarLng) * 111000;
      return distM <= currentRadarRange;
    });

    if (countEl) countEl.textContent = filtered.length;
    if (!myRadarLat) { await loadRadarFallback(uid, countEl); return; }

    const rangeDeg = currentRadarRange / 111000;
    const mapped = filtered.map(d => {
      const dLat = d.lat - myRadarLat;
      const dLng = d.lng - myRadarLng;
      // Map ± rangeDeg → ± radarR * 0.88
      const tx = radarCx + (dLng / rangeDeg) * radarR * 0.88;
      const ty = radarCy - (dLat / rangeDeg) * radarR * 0.88;
      // Clamp to inside the circle
      const dist = Math.hypot(tx - radarCx, ty - radarCy);
      const maxD = radarR * 0.88;
      const cx   = dist > maxD ? radarCx + (tx - radarCx) * maxD / dist : tx;
      const cy   = dist > maxD ? radarCy + (ty - radarCy) * maxD / dist : ty;

      const old = radarDots.find(r => r.id === d.user_id);
      return { id: d.user_id, x: old?.x ?? cx, y: old?.y ?? cy, tx: cx, ty: cy, pingTime: old?.pingTime ?? 0 };
    });

    radarDots = mapped;
    
    const hintEl = document.getElementById("radarHint");
    if (hintEl) {
      hintEl.textContent = `Showing students within ~${currentRadarRange >= 1000 ? (currentRadarRange/1000)+'km' : currentRadarRange+'m'}`;
    }
  } catch (e) {
    console.warn("Radar dots error:", e);
  }
}

// ── Fallback: anonymous random dots ──
async function loadRadarFallback(uid, countEl) {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("presence")
      .select("user_id")
      .eq("online", true)
      .neq("user_id", uid)
      .gte("updated_at", cutoff);

    if (countEl) countEl.textContent = (data || []).length;

    radarDots = (data || []).map(d => {
      // Deterministic scatter from user_id characters
      const hash  = [...d.user_id].reduce((a, c) => a + c.charCodeAt(0), 0);
      const angle = (hash * 137.508) % 360 * (Math.PI / 180);
      const dist  = (((hash * 7919) % 72) + 16) / 100 * radarR * 0.85;
      const tx    = radarCx + Math.cos(angle) * dist;
      const ty    = radarCy + Math.sin(angle) * dist;
      const old   = radarDots.find(r => r.id === d.user_id);
      return { id: d.user_id, x: old?.x ?? tx, y: old?.y ?? ty, tx, ty, pingTime: old?.pingTime ?? 0 };
    });
  } catch (e) {
    console.warn("Radar fallback error:", e);
  }
}

// ── Realtime ──────────────────────────
function setupRadarRealtime(uid, countEl) {
  supabase
    .channel("campus_radar")
    .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, () => {
      if (myRadarLat != null) loadRadarDots(uid, countEl);
      else                    loadRadarFallback(uid, countEl);
      loadSpotsData(uid);
    })
    .subscribe();
}

// ── Spots Logic ───────────────────────
async function loadSpotsData(uid) {
  const listEl = document.getElementById("spotsList");
  if (!listEl) return;

  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Fetch active presences
    const { data: presenceData } = await supabase
      .from("presence")
      .select("location_name, user_id")
      .eq("online", true)
      .gte("updated_at", cutoff);
      
    // Find my checked-in spot
    const myPresence = (presenceData || []).find(p => p.user_id === uid);
    myCurrentSpot = myPresence ? myPresence.location_name : null;

    // Calculate spot counts
    const counts = {};
    (presenceData || []).forEach(p => {
      if (p.location_name) {
        counts[p.location_name] = (counts[p.location_name] || 0) + 1;
      }
    });

    // Render spots
    listEl.innerHTML = CAMPUS_SPOTS.map(spot => {
      const isHere = (myCurrentSpot === spot.name);
      const activeClass = isHere ? "active" : "";
      const spotCount = counts[spot.name] || 0;
      const countLabel = spotCount === 1 ? "1 student here" : `${spotCount} students here`;
      
      return `
        <div class="spot-card ${activeClass}" data-spot-name="${spot.name}">
          <span class="spot-emoji">${spot.emoji}</span>
          <div class="spot-info">
            <div class="spot-name">${spot.name}</div>
            <div class="spot-count">${countLabel}</div>
          </div>
          <button class="spot-btn">
            ${isHere ? "Check-out ✕" : "Check-in 📍"}
          </button>
        </div>
      `;
    }).join("");

    // Add click listeners to toggle check-in
    listEl.querySelectorAll(".spot-card").forEach(card => {
      const spotName = card.dataset.spotName;
      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCheckin(uid, spotName);
      });
    });

    // Show checked-in users list if I am currently checked in
    if (myCurrentSpot) {
      loadCheckedInUsers(uid, myCurrentSpot);
    } else {
      document.getElementById("spotCheckedUsers").style.display = "none";
    }

  } catch(e) {
    console.warn("Load spots error:", e);
    listEl.innerHTML = `<div class="spot-card-error">Failed to load spots. Please refresh.</div>`;
  }
}

async function toggleCheckin(uid, spotName) {
  const isCheckingOut = (myCurrentSpot === spotName);
  myCurrentSpot = isCheckingOut ? null : spotName;
  
  try {
    await supabase.from("presence").upsert(
      { 
        user_id: uid, 
        online: true, 
        location_name: myCurrentSpot,
        lat: myRadarLat, 
        lng: myRadarLng, 
        updated_at: new Date().toISOString() 
      },
      { onConflict: "user_id" }
    );
    
    // Refresh spots count & rendering
    await loadSpotsData(uid);
    
  } catch(e) {
    console.warn("Toggle check-in error:", e);
  }
}

async function loadCheckedInUsers(uid, spotName) {
  const listEl = document.getElementById("spotDetailGrid");
  const wrapEl = document.getElementById("spotCheckedUsers");
  const titleEl = document.getElementById("spotDetailTitle");
  if (!listEl || !wrapEl || !titleEl) return;
  
  titleEl.textContent = `Students at the ${spotName} right now`;
  listEl.innerHTML = `<div class="spot-loading">Checking who's here...</div>`;
  wrapEl.style.display = "block";
  
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("presence")
      .select("user_id, profiles!presence_user_id_fkey(name, photo_url, course, campus)")
      .eq("location_name", spotName)
      .eq("online", true)
      .neq("user_id", uid)
      .gte("updated_at", cutoff);
      
    if (!data || data.length === 0) {
      listEl.innerHTML = `<p class="sc-empty-msg">You're the only one checked-in here. Spread the word! 📣</p>`;
      return;
    }
    
    listEl.innerHTML = data.map(p => {
      const prof = p.profiles || {};
      const avatar = prof.photo_url || DEFAULT_AVATAR;
      const subText = [prof.course, prof.campus].filter(Boolean).join(" · ") || "UniMatch student";
      return `
        <div class="sc-user-card" onclick="location.href='discover.html'">
          <img class="sc-user-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'" alt="${prof.name || 'Student'}">
          <div class="sc-user-info">
            <div class="sc-user-name">${prof.name || 'Unknown'}</div>
            <div class="sc-user-sub">${subText}</div>
          </div>
          <div class="sc-user-chat-btn">Say Hi 👋</div>
        </div>
      `;
    }).join("");
  } catch(e) {
    console.warn("Checked-in users error:", e);
    listEl.innerHTML = `<p class="sc-error-msg">Failed to load students. Please try again.</p>`;
  }
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

// ═══════════════════════════════════════
//  STATS MODAL SHEET
// ═══════════════════════════════════════
const smBackdrop = document.getElementById("smBackdrop");
const smSheet    = document.getElementById("smSheet");
const smClose    = document.getElementById("smClose");
const smIcon     = document.getElementById("smIcon");
const smTitle    = document.getElementById("smTitle");
const smSubtitle = document.getElementById("smSubtitle");
const smBody     = document.getElementById("smBody");

function openSheet() {
  smBackdrop.classList.add("sm-open");
  smSheet.classList.add("sm-open");
  document.body.style.overflow = "hidden";
}

function closeSheet() {
  smBackdrop.classList.remove("sm-open");
  smSheet.classList.remove("sm-open");
  document.body.style.overflow = "";
}

if (smClose)    smClose.addEventListener("click", closeSheet);
if (smBackdrop) smBackdrop.addEventListener("click", closeSheet);

// Swipe-down to close
let touchStartY = 0;
if (smSheet) {
  smSheet.addEventListener("touchstart", e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  smSheet.addEventListener("touchend",   e => {
    if (e.changedTouches[0].clientY - touchStartY > 60) closeSheet();
  }, { passive: true });
}

window.openModal = async function(type) {
  if (!currentUid) return;

  // Configure header
  const configs = {
    views:   { icon: "👀", title: "Profile Views",    subtitle: "People who visited your profile" },
    likes:   { icon: "❤️", title: "Likes Received",   subtitle: "People who liked your profile"  },
    matches: { icon: "🔥", title: "Your Matches",     subtitle: "Mutual connections on UniMatch"  },
  };
  const cfg = configs[type];
  if (!cfg) return;

  smIcon.textContent     = cfg.icon;
  smTitle.textContent    = cfg.title;
  smSubtitle.textContent = cfg.subtitle;
  smBody.innerHTML       = `<div class="sm-loading"><div class="sm-spinner"></div></div>`;
  openSheet();

  try {
    let rows = [];

    if (type === "views") {
      const { data } = await supabase
        .from("views")
        .select("id, created_at, profiles!views_viewer_id_fkey(id, name, photo_url, course, campus)")
        .eq("target_id", currentUid)
        .order("created_at", { ascending: false })
        .limit(50);
      rows = (data || []).map(r => ({
        id:       r.profiles?.id,
        name:     r.profiles?.name     || "Unknown",
        photo:    r.profiles?.photo_url || null,
        sub:      [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(" · ") || "UniMatch student",
        time:     r.created_at,
        badge:    null,
      }));
    }

    if (type === "likes") {
      const { data } = await supabase
        .from("likes")
        .select("id, created_at, profiles!likes_from_user_id_fkey(id, name, photo_url, course, campus)")
        .eq("to_user_id", currentUid)
        .order("created_at", { ascending: false })
        .limit(50);
      rows = (data || []).map(r => ({
        id:    r.profiles?.id,
        name:  r.profiles?.name     || "Unknown",
        photo: r.profiles?.photo_url || null,
        sub:   [r.profiles?.course, r.profiles?.campus].filter(Boolean).join(" · ") || "UniMatch student",
        time:  r.created_at,
        badge: "❤️ Liked you",
      }));
    }

    if (type === "matches") {
      const { data } = await supabase
        .from("matches")
        .select("id, created_at, p1:profiles!matches_user1_id_fkey(id, name, photo_url, course, campus), p2:profiles!matches_user2_id_fkey(id, name, photo_url, course, campus)")
        .or(`user1_id.eq.${currentUid},user2_id.eq.${currentUid}`)
        .order("created_at", { ascending: false })
        .limit(50);
      rows = (data || []).map(m => {
        const other = m.p1?.id === currentUid ? m.p2 : m.p1;
        return {
          id:      m.id,
          otherId: other?.id,
          name:    other?.name     || "Unknown",
          photo:   other?.photo_url || null,
          sub:     [other?.course, other?.campus].filter(Boolean).join(" · ") || "UniMatch student",
          time:    m.created_at,
          badge:   "🔥 Match",
          matchId: m.id,
        };
      });
    }

    if (rows.length === 0) {
      smBody.innerHTML = `
        <div class="sm-empty">
          <div class="sm-empty-icon">${cfg.icon}</div>
          <p class="sm-empty-msg">No ${type} yet — keep exploring!</p>
        </div>`;
      return;
    }

    smBody.innerHTML = rows.map(r => {
      const avatarSrc = r.photo || DEFAULT_AVATAR;
      const timeStr   = r.time ? relativeTime(new Date(r.time)) : "";
      const chatHref  = r.matchId ? `matches.html?matchId=${r.matchId}` : "discover.html";
      return `
        <div class="sm-row" onclick="location.href='${chatHref}'" role="button" tabindex="0">
          <img class="sm-avatar" src="${avatarSrc}" alt="${r.name}"
               onerror="this.src='${DEFAULT_AVATAR}'">
          <div class="sm-row-info">
            <div class="sm-row-name">${r.name}</div>
            <div class="sm-row-sub">${r.sub}</div>
          </div>
          <div class="sm-row-right">
            ${r.badge ? `<span class="sm-badge">${r.badge}</span>` : ""}
            <span class="sm-time">${timeStr}</span>
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    console.error("Modal load error:", err);
    smBody.innerHTML = `<div class="sm-empty"><p class="sm-empty-msg">Failed to load data. Please try again.</p></div>`;
  }
};