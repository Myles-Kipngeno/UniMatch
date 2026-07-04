import { auth, db } from "./firebase.js";
import {
  doc, getDoc, getDocs, setDoc,
  collection, query, where, onSnapshot, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAuth } from "./auth-guard.js";

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

// ── DOM references ──
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

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
(async () => {
  try {
    const user = await requireAuth();
    currentUid = user.uid;

    let data = {};
    try {
      const snap = await getDoc(doc(db, "users", currentUid));
      if (snap.exists()) data = snap.data();
    } catch (_) {
      console.warn("Could not fetch user profile, using defaults");
    }
    currentData = data;

    // ── Greeting ──
    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 12  ? "Good morning"
                   : hour >= 12 && hour < 17 ? "Good afternoon"
                   : hour >= 17 && hour < 21 ? "Good evening"
                   : "Good night";
    const name = data.name || user.email?.split("@")[0] || "Student";

    if (greetingLine) greetingLine.textContent = greeting;
    if (welcomeName)  welcomeName.textContent  = name;
    if (heroName)     heroName.textContent     = name;
    if (profileSummary) {
      profileSummary.textContent = [data.course, data.campus].filter(Boolean).join(" • ") || "Complete your profile";
    }

    // ── Photos ──
    if (data.photoURL) {
      if (profilePhoto) profilePhoto.src = data.photoURL;
      if (navPhoto)     navPhoto.src     = data.photoURL;
    }

    // ── Profile completion ──
    updateCompletion(data);

    // ── Firestore listeners ──
    listenMatches(currentUid);
    listenStats(currentUid);
    listenUnread(currentUid);
    loadRecentChats(currentUid);

    // ── Non-blocking features ──
    loadActivityFeed(currentUid, data);
    loadDiscoverPreview(currentUid, data);
    loadTodaysPick(currentUid, data);
    animateCampusPulse();
    rotateIcebreaker();

  } catch (err) {
    console.error("Dashboard boot error:", err);
    window.location.replace("login.html");
  }
})();

// ─────────────────────────────────────────
// PROFILE COMPLETION
// ─────────────────────────────────────────
function updateCompletion(data) {
  const fields = ["name","bio","course","campus","photoURL","age","gender","interests"];
  const filled = fields.filter(f => data[f] && (Array.isArray(data[f]) ? data[f].length > 0 : String(data[f]).trim() !== "")).length;
  const pct = Math.round((filled / fields.length) * 100);
  if (completionBar) {
    setTimeout(() => { completionBar.style.width = pct + "%"; }, 300);
  }
  if (completionPct) completionPct.textContent = pct + "% Complete";
  if (editProfileBtn) {
    editProfileBtn.textContent = pct >= 100 ? "Edit Profile" : "Complete Profile";
  }
}

// ─────────────────────────────────────────
// ANIMATED NUMBER COUNTER
// ─────────────────────────────────────────
function animateCount(el, target) {
  if (!el) return;
  const start     = 0;
  const duration  = 800;
  const startTime = performance.now();
  const fmt       = formatCount;

  const tick = (now) => {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current  = Math.round(start + (target - start) * ease);
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function formatCount(n) {
  if (n < 1000)    return n.toString();
  if (n < 10000)   return n.toLocaleString();
  if (n < 1000000) {
    const k = n / 1000;
    return (k % 1 === 0 ? k : parseFloat(k.toFixed(1))) + "K";
  }
  const m = n / 1000000;
  return (m % 1 === 0 ? m : parseFloat(m.toFixed(1))) + "M";
}

// ─────────────────────────────────────────
// MATCHES LISTENER
// ─────────────────────────────────────────
function listenMatches(uid) {
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(q, snap => {
    const count = snap.size;
    if (matchBadge) {
      matchBadge.textContent   = count;
      matchBadge.style.display = count > 0 ? "flex" : "none";
    }
    if (totalMatchesEl) animateCount(totalMatchesEl, count);
  });
}

// ─────────────────────────────────────────
// UNREAD LISTENER
// ─────────────────────────────────────────
function listenUnread(uid) {
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(q, snap => {
    let totalUnread = 0;
    snap.forEach(docSnap => {
      const counts = docSnap.data().unreadCounts;
      if (counts && typeof counts[uid] === "number") totalUnread += counts[uid];
    });
    if (msgBadge) {
      msgBadge.textContent   = totalUnread > 99 ? "99+" : totalUnread;
      msgBadge.style.display = totalUnread > 0 ? "flex" : "none";
    }
  });
}

// ─────────────────────────────────────────
// STATS LISTENERS
// ─────────────────────────────────────────
function listenStats(uid) {
  onSnapshot(
    query(collection(db, "likes"), where("to", "==", uid)),
    snap => { if (likesReceivedEl) animateCount(likesReceivedEl, snap.size); }
  );
  onSnapshot(
    query(collection(db, "views"), where("targetUid", "==", uid)),
    snap => { if (profileViewsEl) animateCount(profileViewsEl, snap.size); }
  );
}

// ─────────────────────────────────────────
// ACTIVITY FEED
// ─────────────────────────────────────────
async function loadActivityFeed(uid, userData) {
  if (!activityFeed) return;

  const events = [];

  // Real: recent profile views
  try {
    const viewSnap = await getDocs(
      query(collection(db, "views"), where("targetUid", "==", uid), orderBy("viewedAt", "desc"), limit(3))
    );
    viewSnap.forEach(d => {
      const v = d.data();
      if (v.viewerUid && v.viewerUid !== uid) {
        events.push({ type: "view", name: v.viewerName || "Someone", time: v.viewedAt?.toDate(), emoji: "👀", cls: "activity-dot--view" });
      }
    });
  } catch (_) {}

  // Real: recent likes
  try {
    const likeSnap = await getDocs(
      query(collection(db, "likes"), where("to", "==", uid), orderBy("createdAt", "desc"), limit(2))
    );
    for (const d of likeSnap.docs) {
      const from = d.data().from;
      if (from && from !== uid) {
        try {
          const uSnap = await getDoc(doc(db, "users", from));
          const uData = uSnap.exists() ? uSnap.data() : {};
          events.push({ type: "like", name: uData.name || "Someone", time: d.data().createdAt?.toDate(), emoji: "❤️", cls: "activity-dot--like" });
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Real: recent matches
  try {
    const matchSnap = await getDocs(
      query(collection(db, "matches"), where("users", "array-contains", uid), orderBy("createdAt", "desc"), limit(2))
    );
    for (const d of matchSnap.docs) {
      const other = (d.data().users || []).find(u => u !== uid);
      if (other) {
        try {
          const uSnap = await getDoc(doc(db, "users", other));
          const uData = uSnap.exists() ? uSnap.data() : {};
          events.push({ type: "match", name: uData.name || "Someone", time: d.data().createdAt?.toDate(), emoji: "🔥", cls: "activity-dot--match" });
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Sort by time desc
  events.sort((a, b) => (b.time?.getTime?.() || 0) - (a.time?.getTime?.() || 0));

  // Always show at least some placeholder activity
  if (events.length === 0) {
    events.push(
      { type: "join",  name: "UniMatch",   time: null, emoji: "🎉", cls: "activity-dot--join",   text: "Welcome to UniMatch! Start swiping to find matches" },
      { type: "view",  name: "Get started", time: null, emoji: "👀", cls: "activity-dot--view",   text: "Complete your profile to get more views" },
    );
  }

  activityFeed.innerHTML = events.slice(0, 5).map(ev => {
    const text = ev.text || buildActivityText(ev);
    const timeStr = ev.time ? relativeTime(ev.time) : "Just now";
    return `
      <div class="activity-item">
        <div class="activity-dot ${ev.cls}">${ev.emoji}</div>
        <div class="activity-text">${text}</div>
        <div class="activity-time">${timeStr}</div>
      </div>`;
  }).join("");
}

function buildActivityText(ev) {
  const n = `<strong>${ev.name}</strong>`;
  switch (ev.type) {
    case "view":  return `${n} viewed your profile`;
    case "like":  return `${n} liked your profile`;
    case "match": return `You matched with ${n} 🎉`;
    case "join":  return `${n} joined your campus today`;
    default:      return `${n} is active`;
  }
}

function relativeTime(date) {
  if (!(date instanceof Date) || isNaN(date)) return "Recently";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)  return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return "Recently";
}

// ─────────────────────────────────────────
// DISCOVER PREVIEW
// ─────────────────────────────────────────
async function loadDiscoverPreview(uid, myData) {
  if (!previewName) return;
  try {
    // Get passed/liked UIDs to exclude
    const excluded = new Set([uid]);
    try {
      const likedSnap = await getDocs(query(collection(db, "likes"), where("from", "==", uid)));
      likedSnap.forEach(d => excluded.add(d.data().to));
    } catch (_) {}

    const usersSnap = await getDocs(query(collection(db, "users"), limit(20)));
    const candidates = [];
    usersSnap.forEach(d => {
      if (!excluded.has(d.id)) candidates.push({ uid: d.id, ...d.data() });
    });

    if (candidates.length === 0) {
      if (previewName) previewName.textContent = "No new profiles yet";
      if (previewMeta) previewMeta.textContent = "Check back soon!";
      return;
    }

    // Pick best candidate by shared interests
    const myInterests = myData.interests || [];
    candidates.sort((a, b) => {
      const aInt = (a.interests || []).filter(i => myInterests.includes(i)).length;
      const bInt = (b.interests || []).filter(i => myInterests.includes(i)).length;
      return bInt - aInt;
    });

    const next = candidates[0];
    if (previewPhoto && next.photoURL) previewPhoto.src = next.photoURL;
    if (previewName)  previewName.textContent  = next.name  || "Student";
    if (previewMeta) {
      const parts = [next.course, next.campus].filter(Boolean);
      previewMeta.textContent = parts.join(" · ") || "UniMatch student";
    }
    if (previewTags) {
      const tags = (next.interests || []).slice(0, 3);
      previewTags.innerHTML = tags.map(t => `<span class="dp-tag">${t}</span>`).join("");
    }
  } catch (err) {
    console.warn("Preview load failed:", err);
  }
}

// ─────────────────────────────────────────
// TODAY'S PICK
// ─────────────────────────────────────────
async function loadTodaysPick(uid, myData) {
  if (!pickName) return;
  try {
    const excluded = new Set([uid]);
    const myInterests = myData.interests || [];

    const usersSnap = await getDocs(query(collection(db, "users"), limit(30)));
    const candidates = [];
    usersSnap.forEach(d => {
      if (!excluded.has(d.id)) {
        const shared = (d.data().interests || []).filter(i => myInterests.includes(i)).length;
        candidates.push({ uid: d.id, ...d.data(), shared });
      }
    });

    if (candidates.length === 0) {
      if (pickName) pickName.textContent = "No recommendations yet";
      return;
    }

    // Pick top match by shared interests
    candidates.sort((a, b) => b.shared - a.shared);
    const pick = candidates[0];

    const maxPossible = Math.max(myInterests.length, 1);
    const compatPct   = Math.min(100, Math.round(60 + (pick.shared / maxPossible) * 34));

    if (pickPhoto && pick.photoURL)  pickPhoto.src  = pick.photoURL;
    if (pickName)   pickName.textContent   = pick.name  || "Student";
    if (pickMeta)   pickMeta.textContent   = [pick.course, pick.campus].filter(Boolean).join(" · ") || "UniMatch student";
    if (pickCompat) pickCompat.textContent = compatPct + "%";
    if (pickTags) {
      const tags = (pick.interests || []).slice(0, 3);
      pickTags.innerHTML = tags.map(t => `<span class="pick-tag">${t}</span>`).join("");
    }
    if (pickViewBtn) {
      pickViewBtn.onclick = () => location.href = "discover.html";
    }
  } catch (err) {
    console.warn("Today's pick load failed:", err);
  }
}

// ─────────────────────────────────────────
// RECENT CHATS
// ─────────────────────────────────────────
async function loadRecentChats(uid) {
  if (!recentChats) return;

  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(q, async snap => {
    if (snap.empty) {
      if (chatsEmpty) chatsEmpty.style.display = "flex";
      return;
    }

    const chats = [];
    for (const d of snap.docs) {
      const mData   = d.data();
      const otherId = (mData.users || []).find(u => u !== uid);
      if (!otherId) continue;

      try {
        const uSnap = await getDoc(doc(db, "users", otherId));
        const uData = uSnap.exists() ? uSnap.data() : {};
        const unread = (mData.unreadCounts?.[uid] || 0);
        const lastMsg = mData.lastMessage || "";
        const lastAt  = mData.lastMessageAt?.toDate?.() || null;
        chats.push({ otherId, name: uData.name || "Match", photo: uData.photoURL, lastMsg, lastAt, unread, matchId: d.id });
      } catch (_) {}
    }

    chats.sort((a, b) => (b.lastAt?.getTime?.() || 0) - (a.lastAt?.getTime?.() || 0));

    if (chats.length === 0) {
      if (chatsEmpty) chatsEmpty.style.display = "flex";
      return;
    }

    if (chatsEmpty) chatsEmpty.style.display = "none";

    const html = chats.slice(0, 3).map(c => {
      const isTyping = false; // could be from a typing indicator collection
      const preview  = isTyping ? "Typing..." : (c.lastMsg || "Say hello 👋");
      const timeStr  = c.lastAt ? relativeTime(c.lastAt) : "";
      const unreadHtml = c.unread > 0
        ? `<span class="chat-unread">${c.unread}</span>`
        : "";
      return `
        <div class="chat-item" onclick="location.href='matches.html'">
          <div class="chat-avatar-wrap">
            <img class="chat-avatar" src="${c.photo || DEFAULT_AVATAR}" alt="${c.name}" onerror="this.src='${DEFAULT_AVATAR}'">
            <div class="chat-online"></div>
          </div>
          <div class="chat-meta">
            <div class="chat-name">${c.name}</div>
            <div class="chat-preview ${isTyping ? "typing" : ""}">${preview}</div>
          </div>
          <div class="chat-right">
            <div class="chat-time">${timeStr}</div>
            ${unreadHtml}
          </div>
        </div>`;
    }).join("");

    recentChats.innerHTML = html;
  });
}

// ─────────────────────────────────────────
// CAMPUS PULSE (Simulated + animated)
// ─────────────────────────────────────────
function animateCampusPulse() {
  const base = { library: 18, cafe: 9, event: 14, online: 56 };
  const els  = {
    library: document.getElementById("pulseLibrary"),
    cafe:    document.getElementById("pulseCafe"),
    event:   document.getElementById("pulseEvent"),
    online:  document.getElementById("pulseOnline"),
  };

  // Animate initial numbers
  Object.keys(els).forEach(k => {
    if (els[k]) animateCount(els[k], base[k]);
  });

  // Simulate live fluctuation every 8s
  setInterval(() => {
    if (els.online) {
      const val = base.online + Math.floor(Math.random() * 8 - 4);
      animateCount(els.online, Math.max(40, val));
    }
    if (els.library) {
      const val = base.library + Math.floor(Math.random() * 4 - 2);
      animateCount(els.library, Math.max(5, val));
    }
  }, 8000);
}

// ─────────────────────────────────────────
// DAILY ICEBREAKER
// ─────────────────────────────────────────
const ICEBREAKERS = [
  '"What\'s your dream vacation?"',
  '"What would you do if money wasn\'t an issue?"',
  '"Describe your perfect Sunday morning."',
  '"What\'s the best meal you\'ve ever had?"',
  '"What three things can you not live without?"',
  '"Mountains or beach — and why?"',
  '"What\'s your most memorable campus moment?"',
  '"If you could have any superpower, what would it be?"',
  '"What song always puts you in a good mood?"',
  '"What\'s your go-to late-night snack?"',
];

function rotateIcebreaker() {
  const el = document.getElementById("icebreakerQ");
  if (!el) return;
  // Use date to get a consistent daily question
  const dayIndex = Math.floor(Date.now() / 86400000) % ICEBREAKERS.length;
  el.textContent = ICEBREAKERS[dayIndex];
}

// ─────────────────────────────────────────
// STATS MODAL (full preserved + restyled)
// ─────────────────────────────────────────
const MODAL_CFG = {
  views: {
    _type: "views",
    icon: "👀", iconCls: "sm-icon--views",
    title: "Profile Views", subtitle: "People who visited your profile",
    emptyIcon: "👀", emptyMsg: "No profile views yet",
    badgeCls: "sm-badge--views", badgeLabel: "Viewed",
    showViewCount: true,
  },
  likes: {
    _type: "likes",
    icon: "❤️", iconCls: "sm-icon--likes",
    title: "Likes Received", subtitle: "People who liked your profile",
    emptyIcon: "💛", emptyMsg: "No likes yet — keep swiping!",
    badgeCls: "sm-badge--likes", badgeLabel: "Liked you ❤️",
  },
  matches: {
    _type: "matches",
    icon: "✨", iconCls: "sm-icon--matches",
    title: "Your Matches", subtitle: "People you matched with",
    emptyIcon: "💚", emptyMsg: "No matches yet — start discovering!",
    badgeCls: "sm-badge--matches", badgeLabel: "Matched ✨",
  },
};

let _modal    = null;
let _modalType = null;

function ensureModal() {
  if (_modal) return;
  _modal = document.createElement("div");
  _modal.className = "sm-backdrop";
  _modal.innerHTML = `
    <div class="sm-panel">
      <div class="sm-handle"></div>
      <div class="sm-header">
        <div id="sm-icon" class="sm-icon"></div>
        <div>
          <div id="sm-title" class="sm-title"></div>
          <div id="sm-subtitle" class="sm-subtitle"></div>
        </div>
        <button id="sm-close" class="sm-close">✕</button>
      </div>
      <div id="sm-body" class="sm-body"></div>
    </div>`;
  document.body.appendChild(_modal);
  _modal.addEventListener("click", e => { if (e.target === _modal) closeModal(); });
  document.getElementById("sm-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}

function closeModal() { _modal?.classList.remove("open"); }

window.openModal = async function(type) {
  ensureModal();
  _modalType = type;
  const cfg = MODAL_CFG[type];

  const icon = document.getElementById("sm-icon");
  icon.textContent = cfg.icon;
  icon.className   = `sm-icon ${cfg.iconCls}`;
  document.getElementById("sm-title").textContent    = cfg.title;
  document.getElementById("sm-subtitle").textContent = cfg.subtitle;

  const body = document.getElementById("sm-body");
  body.innerHTML = `<div class="sm-loading"><div class="sm-spinner"></div></div>`;
  _modal.classList.add("open");

  try {
    let rows = [];
    if (type === "views")   rows = await fetchViewers(currentUid);
    if (type === "likes")   rows = await fetchLikers(currentUid);
    if (type === "matches") rows = await fetchMatches(currentUid);

    if (type === "views" && rows.length) {
      const totalVisits = rows.reduce((sum, r) => sum + (r.viewCount || 1), 0);
      const uniqueCount = rows.length;
      document.getElementById("sm-subtitle").textContent =
        `${uniqueCount} ${uniqueCount === 1 ? "person" : "people"} · ${totalVisits} total visit${totalVisits === 1 ? "" : "s"}`;
    }

    renderList(body, rows, cfg);
  } catch (err) {
    console.error("Modal error:", err);
    body.innerHTML = `<div class="sm-empty"><span class="sm-empty-icon">⚠️</span><span>Couldn't load data</span></div>`;
  }
};

function renderList(body, users, cfg) {
  if (!users.length) {
    body.innerHTML = `
      <div class="sm-empty">
        <span class="sm-empty-icon">${cfg.emptyIcon}</span>
        <span class="sm-empty-msg">${cfg.emptyMsg}</span>
      </div>`;
    return;
  }

  body.innerHTML = users.map(u => {
    const badge = cfg.showViewCount && u.viewCount
      ? `<span class="sm-badge ${cfg.badgeCls}">👁 ${u.viewCount}×</span>`
      : `<span class="sm-badge ${cfg.badgeCls}">${cfg.badgeLabel}</span>`;
    return `
    <div class="sm-user-row" data-uid="${u.uid || ""}" data-viewcount="${u.viewCount || 0}">
      <img class="sm-user-photo"
        src="${u.photoURL || DEFAULT_AVATAR}"
        alt="${u.name || "User"}"
        onerror="this.src='${DEFAULT_AVATAR}'">
      <div>
        <div class="sm-user-name">${u.name || "Unknown User"}</div>
        <div class="sm-user-sub">${[u.course, u.campus].filter(Boolean).join(" • ") || "UniMatch user"}</div>
      </div>
      ${badge}
    </div>`;
  }).join("");

  body.querySelectorAll(".sm-user-row").forEach(row => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const uid       = row.dataset.uid;
      const viewCount = parseInt(row.dataset.viewcount) || 0;
      if (uid) showProfileViewer(uid, viewCount, _modalType);
    });
  });
}

// ─────────────────────────────────────────
// WRITE VIEW
// ─────────────────────────────────────────
async function writeView(targetUid, viewerUid) {
  if (!targetUid || !viewerUid || targetUid === viewerUid) return;
  try {
    const viewerSnap = await getDoc(doc(db, "users", viewerUid));
    const vd = viewerSnap.exists() ? viewerSnap.data() : {};
    await setDoc(doc(db, "views", `${viewerUid}_${targetUid}_${Date.now()}`), {
      viewerUid, targetUid,
      viewerName: vd.name || "", viewerPhoto: vd.photoURL || "",
      viewerCourse: vd.course || "", viewerCampus: vd.campus || "",
      viewedAt: serverTimestamp()
    });
  } catch (err) { console.error("writeView error:", err); }
}

// ─────────────────────────────────────────
// PROFILE VIEWER MODAL (fully preserved)
// ─────────────────────────────────────────
async function showProfileViewer(uid, viewCount, modalType) {
  const existing = document.getElementById("pv-modal");
  if (existing) existing.remove();

  await writeView(uid, currentUid);

  const pv = document.createElement("div");
  pv.id        = "pv-modal";
  pv.className = "pv-backdrop";
  pv.innerHTML = `<div class="pv-panel"><div class="sm-loading"><div class="sm-spinner"></div></div></div>`;
  document.body.appendChild(pv);
  setTimeout(() => pv.classList.add("open"), 10);
  document.addEventListener("keydown", pvEsc);

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      pv.querySelector(".pv-panel").innerHTML = `<div class="sm-empty"><span class="sm-empty-icon">😕</span><span>Profile not found</span></div>`;
      return;
    }
    const d = snap.data();
    const galleryPhotos = (d.photoPosts && d.photoPosts.length > 0) ? d.photoPosts : [d.photoURL || DEFAULT_AVATAR];
    const profilePhotoUrl = d.photoURL || DEFAULT_AVATAR;

    let myViewCount = viewCount || 0;
    if (!myViewCount) {
      try {
        const vSnap = await getDocs(query(collection(db, "views"), where("targetUid", "==", uid), where("viewerUid", "==", currentUid)));
        myViewCount = vSnap.size;
      } catch (_) {}
    }

    const photoItems = galleryPhotos.map((url, i) =>
      `<div class="pv-photo-item ${i === 0 ? "active" : ""}"><img src="${url}" alt="photo" onerror="this.src='${DEFAULT_AVATAR}'"></div>`
    ).join("");
    const dots = galleryPhotos.length > 1
      ? `<div class="pv-dots">${galleryPhotos.map((_, i) => `<span class="pv-dot ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";
    const navBtns = galleryPhotos.length > 1
      ? `<button class="pv-nav pv-prev">&#8249;</button><button class="pv-nav pv-next">&#8250;</button>` : "";

    pv.querySelector(".pv-panel").innerHTML = `
      <div class="pv-card">
        <div class="pv-profile-layer" id="pv-profile-layer">
          <img src="${profilePhotoUrl}" class="pv-profile-img" alt="profile" onerror="this.src='${DEFAULT_AVATAR}'">
          <div class="pv-card-overlay">
            <div class="pv-card-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
            <div class="pv-card-meta">
              ${d.campus ? `<span>📍 ${d.campus}</span>` : ""}
              ${d.course ? `<span>📚 ${d.course}</span>` : ""}
            </div>
            ${myViewCount > 0 ? `<div class="pv-view-badge">👁 Viewed ${myViewCount}×</div>` : ""}
          </div>
        </div>
        <div class="pv-gallery-layer" id="pv-gallery-layer">
          ${navBtns}
          <div class="pv-photos">${photoItems}</div>
          ${dots}
          <div class="pv-about-panel" id="pv-about-panel">
            <div class="pv-about-handle"></div>
            <div class="pv-about-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
            <div class="pv-about-details">
              ${d.gender ? `<div class="pv-about-row"><span>👤</span><span>${d.gender}</span></div>` : ""}
              ${d.campus ? `<div class="pv-about-row"><span>📍</span><span>${d.campus}</span></div>` : ""}
              ${d.course ? `<div class="pv-about-row"><span>📚</span><span>${d.course}</span></div>` : ""}
              ${d.bio    ? `<div class="pv-about-bio"><h3>About</h3><p>${d.bio}</p></div>` : ""}
            </div>
          </div>
          <button class="pv-info-btn" id="pv-gallery-info-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <button class="pv-close-btn" id="pv-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        </button>
        <button class="pv-info-btn" id="pv-info-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="pv-about-panel pv-actions-panel" id="pv-actions-panel">
          <div class="pv-about-handle"></div>
          <div class="pv-about-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
          <div class="pv-actions" id="pv-actions"></div>
        </div>
      </div>`;

    document.getElementById("pv-close").addEventListener("click", closePV);
    pv.addEventListener("click", e => { if (e.target === pv) closePV(); });

    const profileLayer   = document.getElementById("pv-profile-layer");
    const galleryLayer   = document.getElementById("pv-gallery-layer");
    const aboutPanel     = document.getElementById("pv-about-panel");
    const actionsPanel   = document.getElementById("pv-actions-panel");
    const infoBtn        = document.getElementById("pv-info-btn");
    const galleryInfoBtn = document.getElementById("pv-gallery-info-btn");

    infoBtn.addEventListener("click", () => {
      galleryLayer.classList.add("visible");
      infoBtn.style.display = "none";
      actionsPanel.classList.remove("open");
    });
    galleryInfoBtn.addEventListener("click", () => {
      const open = aboutPanel.classList.toggle("open");
      galleryInfoBtn.classList.toggle("active", open);
    });

    if (galleryPhotos.length > 1) {
      let idx = 0;
      const photoEls = galleryLayer.querySelectorAll(".pv-photo-item");
      const dotEls   = galleryLayer.querySelectorAll(".pv-dot");
      const goTo = (i) => {
        photoEls.forEach((el, j) => el.classList.toggle("active", j === i));
        dotEls.forEach((el, j)   => el.classList.toggle("active", j === i));
        idx = i;
      };
      galleryLayer.querySelector(".pv-prev").onclick = () => goTo(idx > 0 ? idx - 1 : photoEls.length - 1);
      galleryLayer.querySelector(".pv-next").onclick = () => goTo(idx < photoEls.length - 1 ? idx + 1 : 0);
      dotEls.forEach((el, i) => { el.onclick = () => goTo(i); });
    }

    setTimeout(() => { actionsPanel.classList.add("open"); }, 80);

    const actionsEl  = document.getElementById("pv-actions");
    const heartEmpty = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;
    const heartFull  = `<svg width="17" height="17" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="#ec4899"/></svg>`;
    const msgIcon    = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

    function makeMsgBtn() {
      const btn = document.createElement("button");
      btn.className = "pv-action-btn pv-action-msg";
      btn.innerHTML = msgIcon + " Message";
      btn.addEventListener("click", () => { closePV(); location.href = "matches.html"; });
      return btn;
    }

    if (modalType === "matches") {
      actionsEl.appendChild(makeMsgBtn());
    } else if (modalType === "views" || modalType === "likes") {
      const matchId = [currentUid, uid].sort().join("_");
      let isMatch = false;
      try { const mSnap = await getDoc(doc(db, "matches", matchId)); isMatch = mSnap.exists(); } catch (_) {}

      if (isMatch) {
        actionsEl.appendChild(makeMsgBtn());
      } else {
        let alreadyLiked = false;
        try { const lSnap = await getDoc(doc(db, "likes", currentUid + "_" + uid)); alreadyLiked = lSnap.exists(); } catch (_) {}

        const likeBtn = document.createElement("button");
        likeBtn.className = "pv-action-btn pv-action-like" + (alreadyLiked ? " liked" : "");
        likeBtn.innerHTML = alreadyLiked ? heartFull + " Liked ✓" : heartEmpty + " Like Back";
        likeBtn.addEventListener("click", async () => {
          if (likeBtn.classList.contains("liked")) return;
          try {
            await setDoc(doc(db, "likes", currentUid + "_" + uid), { from: currentUid, to: uid, createdAt: serverTimestamp() });
            const rev = await getDoc(doc(db, "likes", uid + "_" + currentUid));
            if (rev.exists()) {
              await setDoc(doc(db, "matches", matchId), { users: [currentUid, uid], createdAt: serverTimestamp() });
              likeBtn.innerHTML = heartFull + " It's a Match! 🎉";
              likeBtn.classList.add("liked", "matched");
            } else {
              likeBtn.innerHTML = heartFull + " Liked ✓";
              likeBtn.classList.add("liked");
            }
          } catch (err) { console.error("Like error:", err); }
        });
        actionsEl.appendChild(likeBtn);
      }
    }
  } catch (err) {
    console.error("Profile viewer error:", err);
    pv.querySelector(".pv-panel").innerHTML = `<div class="sm-empty"><span class="sm-empty-icon">⚠️</span><span>Couldn't load profile</span></div>`;
  }
}

function closePV() {
  const pv = document.getElementById("pv-modal");
  if (!pv) return;
  pv.classList.remove("open");
  setTimeout(() => pv.remove(), 250);
  document.removeEventListener("keydown", pvEsc);
}
function pvEsc(e) { if (e.key === "Escape") closePV(); }

// ─────────────────────────────────────────
// FETCHERS (preserved)
// ─────────────────────────────────────────
async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? { uid, ...snap.data() } : { uid };
  } catch { return { uid }; }
}

async function fetchViewers(uid) {
  try {
    const snap = await getDocs(query(collection(db, "views"), where("targetUid", "==", uid)));
    if (snap.empty) return [];
    const seen = new Map();
    snap.forEach(d => {
      const v = d.data();
      if (!v.viewerUid || v.viewerUid === uid) return;
      const ts = v.viewedAt?.toMillis?.() || 0;
      const ex = seen.get(v.viewerUid);
      if (!ex) seen.set(v.viewerUid, { uid: v.viewerUid, name: v.viewerName || "", photoURL: v.viewerPhoto || "", course: v.viewerCourse || "", campus: v.viewerCampus || "", viewCount: 1, _ts: ts });
      else { ex.viewCount++; if (ts > ex._ts) ex._ts = ts; }
    });
    return Array.from(seen.values()).sort((a, b) => b._ts - a._ts);
  } catch (e) { console.error("fetchViewers:", e); return []; }
}

async function fetchLikers(uid) {
  try {
    const snap = await getDocs(query(collection(db, "likes"), where("to", "==", uid), orderBy("createdAt", "desc"), limit(50)));
    const out = [];
    for (const d of snap.docs) {
      const from = d.data().from;
      if (from && from !== uid) out.push(await getProfile(from));
    }
    return out;
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "likes"), where("to", "==", uid), limit(50)));
      const out = [];
      for (const d of snap.docs) {
        const from = d.data().from;
        if (from && from !== uid) out.push(await getProfile(from));
      }
      return out;
    } catch (e) { console.error("fetchLikers:", e); return []; }
  }
}

async function fetchMatches(uid) {
  try {
    const snap = await getDocs(query(collection(db, "matches"), where("users", "array-contains", uid)));
    const out = [];
    for (const d of snap.docs) {
      const other = (d.data().users || []).find(u => u !== uid);
      if (other) out.push(await getProfile(other));
    }
    return out;
  } catch (e) { console.error("fetchMatches:", e); return []; }
}

// ─────────────────────────────────────────
// SWIPE NAV (preserved)
// ─────────────────────────────────────────
let startX = 0;
document.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
document.addEventListener("touchend", e => {
  const diff = startX - e.changedTouches[0].clientX;
  if (diff > 80)  setTimeout(() => location.href = "discover.html", 200);
  if (diff < -80) setTimeout(() => location.href = "matches.html",  200);
}, { passive: true });