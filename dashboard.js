import { auth, db } from "./firebase.js";
import {
  doc, getDoc, getDocs, setDoc,
  collection, query, where, onSnapshot, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAuth } from "./auth-guard.js";

const DEFAULT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

// DOM
const welcomeName     = document.getElementById("welcomeName");
const greetingLine    = document.getElementById("greetingLine");
const profileSummary  = document.getElementById("profileSummary");
const profilePhoto    = document.getElementById("profilePhoto");
const navPhoto        = document.getElementById("navPhoto");
const chatCard        = document.getElementById("chatCard");
const matchesCard     = document.getElementById("matchesCard");
const matchCountEl    = document.getElementById("matchCount");
const matchBadge      = document.getElementById("matchBadge");
const unreadBadge     = document.getElementById("unreadBadge");
const msgBadge        = document.getElementById("msgBadge");
const editProfileBtn  = document.getElementById("editProfileBtn");
const profileViewsEl  = document.getElementById("profileViews");
const likesReceivedEl = document.getElementById("likesReceived");
const totalMatchesEl  = document.getElementById("totalMatches");

let currentUid = null;

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
(async () => {
  try {
    const user = await requireAuth();
    currentUid = user.uid;

    const snap = await getDoc(doc(db, "users", currentUid));
    if (!snap.exists() || !snap.data().profileComplete) {
      window.location.replace("profile.html");
      return;
    }

    const data = snap.data();

    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Good night";
    if (greetingLine)   greetingLine.textContent  = greeting;
    if (welcomeName)    welcomeName.textContent    = data.name;
    if (profileSummary) profileSummary.textContent = `${data.course} • ${data.campus}`;

    if (data.photoURL) {
      if (profilePhoto) profilePhoto.src = data.photoURL;
      if (navPhoto)     navPhoto.src     = data.photoURL;
    }

    listenMatches(currentUid);
    listenStats(currentUid);
    listenUnread(currentUid);
    initStatPills();

  } catch (err) {
    console.error("Dashboard boot error:", err);
    window.location.replace("login.html");
  }
})();

// ─────────────────────────────────────────
// MATCHES
// ─────────────────────────────────────────
function listenMatches(uid) {
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(q, snap => {
    const count = snap.size;
    if (matchCountEl) {
      matchCountEl.textContent = count > 0
        ? `${count} match${count !== 1 ? "es" : ""}`
        : "See who liked you back";
    }
    if (matchBadge) {
      matchBadge.textContent   = count;
      matchBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
    if (totalMatchesEl) {
      totalMatchesEl.textContent = formatCount(count);
      animatePop(totalMatchesEl);
    }
  });
}

// ─────────────────────────────────────────
// UNREAD
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
    if (unreadBadge) {
      unreadBadge.textContent   = `${totalUnread} new`;
      unreadBadge.style.display = totalUnread > 0 ? "inline-flex" : "none";
    }
  });
}

// ─────────────────────────────────────────
// STATS
// ─────────────────────────────────────────
function listenStats(uid) {
  onSnapshot(
    query(collection(db, "likes"), where("to", "==", uid)),
    snap => {
      if (likesReceivedEl) { likesReceivedEl.textContent = formatCount(snap.size); animatePop(likesReceivedEl); }
    }
  );
  onSnapshot(
    query(collection(db, "views"), where("targetUid", "==", uid)),
    snap => {
      if (!profileViewsEl) return;
      profileViewsEl.textContent = formatCount(snap.size);
      animatePop(profileViewsEl);
    }
  );
}

function animatePop(el) {
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)";
}

// Format numbers like Instagram/TikTok:
// 0–9999 → full number (e.g. 9,999)
// 10K–999K → e.g. 10K, 10.5K, 999K
// 1M+ → e.g. 1M, 2.4M
function formatCount(n) {
  if (n < 1000)    return n.toString();
  if (n < 10000)   return n.toLocaleString();           // e.g. 1,234 — 9,999
  if (n < 1000000) {
    const k = n / 1000;
    return (k % 1 === 0 ? k : parseFloat(k.toFixed(1))) + "K";  // e.g. 10K, 10.5K
  }
  const m = n / 1000000;
  return (m % 1 === 0 ? m : parseFloat(m.toFixed(1))) + "M";    // e.g. 1M, 2.4M
}

// ─────────────────────────────────────────
// STAT PILLS → MODALS
// ─────────────────────────────────────────
function initStatPills() {
  const viewsPill   = profileViewsEl?.closest(".stat-pill");
  const likesPill   = likesReceivedEl?.closest(".stat-pill");
  const matchesPill = totalMatchesEl?.closest(".stat-pill");

  [viewsPill, likesPill, matchesPill].forEach(p => { if (p) p.style.cursor = "pointer"; });

  viewsPill?.addEventListener("click",   () => openModal("views"));
  likesPill?.addEventListener("click",   () => openModal("likes"));
  matchesPill?.addEventListener("click", () => openModal("matches"));
}

// ─────────────────────────────────────────
// STATS LIST MODAL
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
      <div class="sm-header">
        <div class="sm-header-left">
          <div id="sm-icon" class="sm-icon"></div>
          <div>
            <div id="sm-title" class="sm-title"></div>
            <div id="sm-subtitle" class="sm-subtitle"></div>
          </div>
        </div>
        <button id="sm-close" class="sm-close">&#x2715;</button>
      </div>
      <div id="sm-body" class="sm-body"></div>
    </div>`;
  document.body.appendChild(_modal);
  _modal.addEventListener("click", e => { if (e.target === _modal) closeModal(); });
  document.getElementById("sm-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
}

function closeModal() { _modal?.classList.remove("open"); }

async function openModal(type) {
  ensureModal();
  _modalType = type;
  const cfg = MODAL_CFG[type];

  const icon = document.getElementById("sm-icon");
  icon.textContent = cfg.icon;
  icon.className   = `sm-icon ${cfg.iconCls}`;
  document.getElementById("sm-title").textContent    = cfg.title;
  document.getElementById("sm-subtitle").textContent = cfg.subtitle;

  const body = document.getElementById("sm-body");
  body.innerHTML = `<div class="sm-loading"><div class="sm-spinner"></div><span>Loading...</span></div>`;
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
}

function renderList(body, users, cfg) {
  if (!users.length) {
    body.innerHTML = `
      <div class="sm-empty">
        <span class="sm-empty-icon">${cfg.emptyIcon}</span>
        <span>${cfg.emptyMsg}</span>
      </div>`;
    return;
  }

  body.innerHTML = users.map((u, i) => {
    const badge = cfg.showViewCount && u.viewCount
      ? `<span class="sm-badge ${cfg.badgeCls} sm-badge--viewcount">👁 ${u.viewCount}×</span>`
      : `<span class="sm-badge ${cfg.badgeCls}">${cfg.badgeLabel}</span>`;
    return `
    <div class="sm-user-row" data-uid="${u.uid || ""}" data-viewcount="${u.viewCount || 0}">
      <img class="sm-avatar"
        src="${u.photoURL || DEFAULT_AVATAR}"
        alt="${u.name || "User"}"
        onerror="this.src='${DEFAULT_AVATAR}'">
      <div class="sm-info">
        <div class="sm-name">${u.name || "Unknown User"}</div>
        <div class="sm-meta">${[u.course, u.campus].filter(Boolean).join(" • ") || "UniMatch user"}</div>
      </div>
      ${badge}
    </div>
    ${i < users.length - 1 ? '<div class="sm-divider"></div>' : ""}
  `;}).join("");

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
      viewerUid,
      targetUid,
      viewerName:   vd.name     || "",
      viewerPhoto:  vd.photoURL || "",
      viewerCourse: vd.course   || "",
      viewerCampus: vd.campus   || "",
      viewedAt:     serverTimestamp()
    });
  } catch (err) { console.error("writeView error:", err); }
}

// ─────────────────────────────────────────
// PROFILE VIEWER
// ─────────────────────────────────────────
async function showProfileViewer(uid, viewCount, modalType) {
  const existing = document.getElementById("pv-modal");
  if (existing) existing.remove();

  await writeView(uid, currentUid);

  const pv = document.createElement("div");
  pv.id        = "pv-modal";
  pv.className = "pv-backdrop";
  pv.innerHTML = `<div class="pv-panel"><div class="sm-loading"><div class="sm-spinner"></div><span>Loading...</span></div></div>`;
  document.body.appendChild(pv);
  setTimeout(() => pv.classList.add("open"), 10);
  document.addEventListener("keydown", pvEsc);

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      pv.querySelector(".pv-panel").innerHTML = `<div class="sm-empty"><span class="sm-empty-icon">😕</span><span>Profile not found</span></div>`;
      return;
    }

    const d      = snap.data();
    const photos = (d.photoPosts && d.photoPosts.length > 0) ? d.photoPosts : [d.photoURL || DEFAULT_AVATAR];

    let myViewCount = viewCount || 0;
    if (!myViewCount) {
      try {
        const vSnap = await getDocs(query(
          collection(db, "views"),
          where("targetUid", "==", uid),
          where("viewerUid", "==", currentUid)
        ));
        myViewCount = vSnap.size;
      } catch (_) {}
    }

    // ── Build gallery layer items (photoPosts)
    const galleryPhotos = (d.photoPosts && d.photoPosts.length > 0) ? d.photoPosts : [d.photoURL || DEFAULT_AVATAR];
    const profilePhoto  = d.photoURL || DEFAULT_AVATAR;

    const photoItems = galleryPhotos.map((url, i) =>
      `<div class="pv-photo-item ${i === 0 ? "active" : ""}">
        <img src="${url}" alt="photo" onerror="this.src='${DEFAULT_AVATAR}'">
      </div>`
    ).join("");

    const dots = galleryPhotos.length > 1
      ? `<div class="pv-dots">${galleryPhotos.map((_, i) =>
          `<span class="pv-dot ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";

    const navBtns = galleryPhotos.length > 1
      ? `<button class="pv-nav pv-prev">&#8249;</button><button class="pv-nav pv-next">&#8250;</button>` : "";

    pv.querySelector(".pv-panel").innerHTML = `
      <div class="pv-card">

        <!-- ── LAYER 1: Profile photo (default view) ── -->
        <div class="pv-profile-layer" id="pv-profile-layer">
          <img src="${profilePhoto}" class="pv-profile-img" alt="profile"
               onerror="this.src='${DEFAULT_AVATAR}'">

          <div class="pv-card-overlay">
            <div class="pv-card-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
            <div class="pv-card-meta">
              ${d.campus ? `<span>📍 ${d.campus}</span>` : ""}
              ${d.course ? `<span>📚 ${d.course}</span>` : ""}
            </div>
            ${myViewCount > 0 ? `<div class="pv-view-badge">👁 Viewed ${myViewCount}×</div>` : ""}
          </div>
        </div>

        <!-- ── LAYER 2: Gallery (slides in when ℹ️ clicked) ── -->
        <div class="pv-gallery-layer" id="pv-gallery-layer">
          ${navBtns}
          <div class="pv-photos">${photoItems}</div>
          ${dots}

          <!-- About panel slides up inside gallery -->
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

          <!-- ℹ️ inside gallery → about panel -->
          <button class="pv-info-btn" id="pv-gallery-info-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- ✕ close — always visible -->
        <button class="pv-close-btn" id="pv-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- ℹ️ on profile layer → opens gallery -->
        <button class="pv-info-btn" id="pv-info-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Action buttons (peek from bottom on profile layer) -->
        <div class="pv-about-panel pv-actions-panel" id="pv-actions-panel">
          <div class="pv-about-handle"></div>
          <div class="pv-about-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
          <div class="pv-actions" id="pv-actions"></div>
        </div>

      </div>`;

    // ── Close ──
    document.getElementById("pv-close").addEventListener("click", closePV);
    pv.addEventListener("click", e => { if (e.target === pv) closePV(); });

    const profileLayer  = document.getElementById("pv-profile-layer");
    const galleryLayer  = document.getElementById("pv-gallery-layer");
    const aboutPanel    = document.getElementById("pv-about-panel");
    const actionsPanel  = document.getElementById("pv-actions-panel");
    const infoBtn       = document.getElementById("pv-info-btn");
    const galleryInfoBtn = document.getElementById("pv-gallery-info-btn");

    // ℹ️ on profile → slide in gallery layer
    infoBtn.addEventListener("click", () => {
      galleryLayer.classList.add("visible");
      infoBtn.style.display = "none";
      actionsPanel.classList.remove("open");
    });

    // ℹ️ inside gallery → toggle about panel
    galleryInfoBtn.addEventListener("click", () => {
      const open = aboutPanel.classList.toggle("open");
      galleryInfoBtn.classList.toggle("active", open);
    });

    // Gallery nav
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

    // ── Action buttons ── (peek actions panel up)
    setTimeout(() => { actionsPanel.classList.add("open"); }, 80);
    const actionsEl  = document.getElementById("pv-actions");
    const heartEmpty = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`;
    const heartFull  = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor"/></svg>`;
    const msgIcon    = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    function makeMsgBtn() {
      const btn = document.createElement("button");
      btn.className = "pv-action-btn pv-action-msg";
      btn.innerHTML = msgIcon + " Message";
      btn.addEventListener("click", () => {
        closePV();
        location.href = "chat.html?match=" + uid;
      });
      return btn;
    }

    if (modalType === "matches") {
      actionsEl.appendChild(makeMsgBtn());

    } else if (modalType === "views" || modalType === "likes") {
      const matchId = [currentUid, uid].sort().join("_");

      // Check existing match
      let isMatch = false;
      try {
        const mSnap = await getDoc(doc(db, "matches", matchId));
        isMatch = mSnap.exists();
      } catch (_) {}

      if (isMatch) {
        actionsEl.appendChild(makeMsgBtn());
      } else {
        // Check if already liked
        let alreadyLiked = false;
        try {
          const lSnap = await getDoc(doc(db, "likes", currentUid + "_" + uid));
          alreadyLiked = lSnap.exists();
        } catch (_) {}

        const likeBtn = document.createElement("button");
        likeBtn.className = "pv-action-btn pv-action-like" + (alreadyLiked ? " liked" : "");
        likeBtn.innerHTML = alreadyLiked
          ? heartFull + " Liked ✓"
          : heartEmpty + " Like Back";

        likeBtn.addEventListener("click", async () => {
          if (likeBtn.classList.contains("liked")) return;
          try {
            await setDoc(doc(db, "likes", currentUid + "_" + uid), {
              from: currentUid, to: uid, createdAt: serverTimestamp()
            });
            // Check if they liked back → create match
            const rev = await getDoc(doc(db, "likes", uid + "_" + currentUid));
            if (rev.exists()) {
              await setDoc(doc(db, "matches", matchId), {
                users: [currentUid, uid], createdAt: serverTimestamp()
              });
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
// FETCHERS
// ─────────────────────────────────────────
async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? { uid, ...snap.data() } : { uid };
  } catch { return { uid }; }
}

async function fetchViewers(uid) {
  try {
    const snap = await getDocs(
      query(collection(db, "views"), where("targetUid", "==", uid))
    );
    if (snap.empty) return [];

    const seen = new Map();
    snap.forEach(d => {
      const v  = d.data();
      if (!v.viewerUid || v.viewerUid === uid) return;
      const ts = v.viewedAt?.toMillis?.() || 0;
      const existing = seen.get(v.viewerUid);
      if (!existing) {
        seen.set(v.viewerUid, {
          uid:       v.viewerUid,
          name:      v.viewerName   || "",
          photoURL:  v.viewerPhoto  || "",
          course:    v.viewerCourse || "",
          campus:    v.viewerCampus || "",
          viewCount: 1,
          _ts: ts
        });
      } else {
        existing.viewCount += 1;
        if (ts > existing._ts) existing._ts = ts;
      }
    });

    return Array.from(seen.values()).sort((a, b) => b._ts - a._ts);
  } catch (e) { console.error("fetchViewers:", e); return []; }
}

async function fetchLikers(uid) {
  try {
    const snap = await getDocs(
      query(collection(db, "likes"), where("to", "==", uid), orderBy("createdAt", "desc"), limit(50))
    );
    if (!snap.empty) {
      const out = [];
      for (const d of snap.docs) {
        const from = d.data().from;
        if (from && from !== uid) out.push(await getProfile(from));
      }
      return out;
    }
  } catch (_) {}

  try {
    const snap = await getDocs(
      query(collection(db, "likes"), where("to", "==", uid), limit(50))
    );
    const out = [];
    for (const d of snap.docs) {
      const from = d.data().from;
      if (from && from !== uid) out.push(await getProfile(from));
    }
    return out;
  } catch (e) { console.error("fetchLikers:", e); return []; }
}

async function fetchMatches(uid) {
  try {
    const snap = await getDocs(
      query(collection(db, "matches"), where("users", "array-contains", uid))
    );
    const out = [];
    for (const d of snap.docs) {
      const other = (d.data().users || []).find(u => u !== uid);
      if (other) out.push(await getProfile(other));
    }
    return out;
  } catch (e) { console.error("fetchMatches:", e); return []; }
}

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
if (chatCard)       chatCard.onclick       = () => location.href = "matches.html";
if (matchesCard)    matchesCard.onclick    = () => location.href = "matches.html";
if (editProfileBtn) editProfileBtn.onclick = () => location.href = "profile.html?edit=true";

let startX = 0;
document.addEventListener("touchstart", e => { startX = e.touches[0].clientX; });
document.addEventListener("touchend", e => {
  const diff = startX - e.changedTouches[0].clientX;
  if (diff > 80)  setTimeout(() => location.href = "discover.html", 200);
  if (diff < -80) setTimeout(() => location.href = "matches.html",  200);
});