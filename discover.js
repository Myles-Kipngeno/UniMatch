import { auth, db } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";
import {
  collection, getDocs, getDoc, doc,
  setDoc, deleteDoc, updateDoc, arrayUnion,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container     = document.getElementById("discoverContainer");
const passIndicator = document.querySelector(".indicator.pass");
const likeIndicator = document.querySelector(".indicator.like");

// ─── Three-lane carousel state ───────────────────────────────────
// passedLane  ← left  (blurry red tint)
// centerLane  ← active card
// likedLane   → right (blurry green tint)
let passedLane  = [];   // [{card, uid, data}]  newest at index 0
let centerQueue = [];   // [{card, uid, data}]  0 = front/active
let likedLane   = [];   // [{card, uid, data}]  newest at index 0

let activeLikeAction = null;
let activePassAction = null;
let currentUser      = null;
let currentUserData  = null;
let likedUids        = new Set();
let passedUids       = new Set();

if (passIndicator) passIndicator.addEventListener("click", () => { if (activePassAction) activePassAction(); });
if (likeIndicator) likeIndicator.addEventListener("click", () => { if (activeLikeAction) activeLikeAction(); });

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
(async () => {
  try {
    currentUser = await requireAuth();
    container.innerHTML = "";

    const meSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (!meSnap.exists() || !meSnap.data().profileComplete) {
      showEmpty("Complete Your Profile",
        "Finish setting up your profile to start discovering connections",
        "Complete Profile", () => location.href = "profile.html");
      return;
    }

    const me = meSnap.data();
    currentUserData = me;

    if (me.photoURL) {
      const navPhoto = document.getElementById("navPhoto");
      if (navPhoto) navPhoto.src = me.photoURL;
    }

    const [usersSnap, likesSnap, passesSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("profileComplete", "==", true))),
      getDocs(query(collection(db, "likes"),  where("from", "==", currentUser.uid))),
      getDocs(query(collection(db, "passes"), where("from", "==", currentUser.uid)))
    ]);

    likedUids  = new Set(likesSnap.docs.map(d => d.data().to));
    passedUids = new Set(passesSnap.docs.map(d => d.data().to));

    // Restore liked lane from Firestore (right side)
    for (const d of likesSnap.docs) {
      const toUid = d.data().to;
      const uSnap = usersSnap.docs.find(s => s.id === toUid);
      if (uSnap) {
        const card = buildCard(uSnap.data(), toUid);
        container.appendChild(card);
        likedLane.push({ card, uid: toUid, data: uSnap.data() });
      }
    }

    // Restore passed lane from Firestore (left side)
    for (const d of passesSnap.docs) {
      const toUid = d.data().to;
      const uSnap = usersSnap.docs.find(s => s.id === toUid);
      if (uSnap) {
        const card = buildCard(uSnap.data(), toUid);
        container.appendChild(card);
        passedLane.push({ card, uid: toUid, data: uSnap.data() });
      }
    }

    const candidates = usersSnap.docs.filter(snap => {
      const targetUid = snap.id;
      const data      = snap.data();
      return !(
        targetUid === currentUser.uid ||
        likedUids.has(targetUid)  ||
        passedUids.has(targetUid) ||
        (me.preference !== "all" && data.gender !== me.preference) ||
        data.campus !== me.campus
      );
    });

    // ─── SORT CANDIDATES BY SHARED INTERESTS ───
    candidates.sort((aSnap, bSnap) => {
      const a = aSnap.data();
      const b = bSnap.data();
      const aInterests = a.interests || [];
      const bInterests = b.interests || [];
      const myInterests = me.interests || [];
      
      const aSharedCount = aInterests.filter(i => myInterests.includes(i)).length;
      const bSharedCount = bInterests.filter(i => myInterests.includes(i)).length;
      
      return bSharedCount - aSharedCount; // descending order
    });

    if (candidates.length === 0 && likedLane.length === 0 && passedLane.length === 0) {
      showEmpty("No More Profiles",
        "You've seen everyone in your area. Check back later!",
        "Back to Dashboard", () => location.href = "dashboard.html");
      disableIndicators();
      return;
    }

    centerQueue = [];
    for (const snap of candidates) {
      const card = buildCard(snap.data(), snap.id);
      container.appendChild(card);
      centerQueue.push({ card, uid: snap.id, data: snap.data() });
    }

    renderCarousel();
    bindFrontCard();
    if (centerQueue.length > 0) {
      recordView(centerQueue[0].uid, centerQueue[0].data, currentUser.uid, me);
    }

  } catch (err) {
    console.error("Discover error:", err);
    showEmpty("Something Went Wrong",
      "We couldn't load profiles. Please try again.",
      "Retry", () => location.reload());
    disableIndicators();
  }
})();

// ─────────────────────────────────────────
// CAROUSEL RENDERER
// Three lanes: passed(left) | center | liked(right)
// ─────────────────────────────────────────
function renderCarousel() {
  // Remove all position classes from every card in play
  const allEntries = [...passedLane, ...centerQueue, ...likedLane];
  allEntries.forEach(e => {
    e.card.className = "user-card";
    e.card.style.cssText = "";
    // Make sure it's in DOM
    if (!container.contains(e.card)) container.appendChild(e.card);
  });

  // ── CENTER QUEUE (right-to-left stacking, front = index 0) ──
  centerQueue.forEach((e, i) => {
    if (i === 0) {
      e.card.classList.add("lane-center");
    } else if (i === 1) {
      e.card.classList.add("lane-queue-1");
    } else if (i === 2) {
      e.card.classList.add("lane-queue-2");
    } else {
      e.card.classList.add("lane-queue-hidden");
    }
  });

  // ── PASSED LANE (left side) ──
  passedLane.forEach((e, i) => {
    if (i === 0) e.card.classList.add("lane-passed-0");
    else if (i === 1) e.card.classList.add("lane-passed-1");
    else              e.card.classList.add("lane-side-hidden");
  });

  // ── LIKED LANE (right side) ──
  likedLane.forEach((e, i) => {
    if (i === 0) e.card.classList.add("lane-liked-0");
    else if (i === 1) e.card.classList.add("lane-liked-1");
    else              e.card.classList.add("lane-side-hidden");
  });

  // Side lane click targets — pulse hint on first items
  if (passedLane.length > 0) {
    passedLane[0].card.classList.add("lane-clickable");
  }
  if (likedLane.length > 0) {
    likedLane[0].card.classList.add("lane-clickable");
  }

  updateCarouselCountBadges();

  if (centerQueue.length === 0) {
    disableIndicators();
    if (passedLane.length === 0 && likedLane.length === 0) {
      setTimeout(() => {
        showEmpty("No More Profiles",
          "You've seen everyone in your area. Check back later!",
          "Back to Dashboard", () => location.href = "dashboard.html");
      }, 400);
    }
  }
}

function updateCarouselCountBadges() {
  // Remove old inline badges
  container.querySelectorAll(".lane-badge").forEach(b => b.remove());

  // Update side arrow buttons
  const leftArrow   = document.getElementById("sideArrowLeft");
  const rightArrow  = document.getElementById("sideArrowRight");
  const passedBadge = document.getElementById("passedBadge");
  const likedBadge  = document.getElementById("likedBadge");

  if (leftArrow) {
    leftArrow.style.display = passedLane.length > 0 ? "flex" : "none";
    if (passedBadge) passedBadge.textContent = passedLane.length;
  }
  if (rightArrow) {
    rightArrow.style.display = likedLane.length > 0 ? "flex" : "none";
    if (likedBadge) likedBadge.textContent = likedLane.length;
  }
}

// Wire up arrow buttons once DOM is ready
document.getElementById("sideArrowLeft")?.addEventListener("click",  () => openSideDrawer("passed"));
document.getElementById("sideArrowRight")?.addEventListener("click", () => openSideDrawer("liked"));

// ─────────────────────────────────────────
// BIND ACTIONS TO FRONT CARD
// ─────────────────────────────────────────
function bindFrontCard() {
  if (centerQueue.length === 0) {
    activeLikeAction = null;
    activePassAction = null;
    disableIndicators();
    return;
  }
  const front = centerQueue[0];
  activeLikeAction = front.card._likeAction;
  activePassAction = front.card._passAction;
  updateLikeIndicator(likedUids.has(front.uid));
  enableIndicators();
}

// ─────────────────────────────────────────
// LIKE — moves card to right liked lane
// ─────────────────────────────────────────
async function doLikeCard() {
  if (centerQueue.length === 0) return;
  const entry  = centerQueue[0];
  const { card, uid, data } = entry;
  const from          = currentUser.uid;
  const to            = uid;
  const likeId        = `${from}_${to}`;
  const reverseLikeId = `${to}_${from}`;
  const matchId       = [from, to].sort().join("_");

  if (likeIndicator) likeIndicator.disabled = true;

  try {
    if (likedUids.has(to)) {
      // Already liked — unlike it, pull from liked lane back to center
      await deleteDoc(doc(db, "likes", likeId));
      likedUids.delete(to);
      try { await deleteDoc(doc(db, "matches", matchId)); } catch (_) {}
      // Find in liked lane and pull back
      const idx = likedLane.findIndex(e => e.uid === uid);
      if (idx !== -1) likedLane.splice(idx, 1);
      centerQueue.unshift(entry);
      updateLikeIndicator(false);
    } else {
      // Like — move to liked lane
      await setDoc(doc(db, "likes", likeId), { from, to, createdAt: serverTimestamp() });
      likedUids.add(to);
      card.classList.add("swiping-right");

      const rev = await getDoc(doc(db, "likes", reverseLikeId));
      if (rev.exists()) {
        await setDoc(doc(db, "matches", matchId), { users: [from, to], createdAt: serverTimestamp() });
        setTimeout(() => showMatchNotification(data.name || "Someone"), 350);
      }

      // Remove from passed lane if it was there
      const pi = passedLane.findIndex(e => e.uid === uid);
      if (pi !== -1) passedLane.splice(pi, 1);

      centerQueue.shift();
      likedLane.unshift(entry);

      // Record view for new front card
      if (centerQueue.length > 0) {
        recordView(centerQueue[0].uid, centerQueue[0].data, currentUser.uid, currentUserData || {});
      }
    }
  } catch (err) {
    console.error("Like error:", err);
    card.classList.remove("swiping-right");
    alert(err.code === "permission-denied"
      ? "Permission denied. Check your Firestore rules."
      : `Action failed: ${err.message}`);
  }

  if (likeIndicator) likeIndicator.disabled = false;
  renderCarousel();
  bindFrontCard();
  refreshHistoryIfOpen();
}

// ─────────────────────────────────────────
// PASS — moves card to left passed lane
// ─────────────────────────────────────────
async function doPassCard() {
  if (centerQueue.length === 0) return;
  const entry  = centerQueue[0];
  const { card, uid, data } = entry;

  card.classList.add("swiping-left");

  centerQueue.shift();
  passedLane.unshift(entry);
  passedUids.add(uid);

  // Persist to Firestore
  try {
    await setDoc(doc(db, "passes", `${currentUser.uid}_${uid}`), {
      from: currentUser.uid, to: uid, createdAt: serverTimestamp()
    });
  } catch (err) { console.error("Pass write error:", err); }

  if (centerQueue.length > 0) {
    recordView(centerQueue[0].uid, centerQueue[0].data, currentUser.uid, currentUserData || {});
  }

  renderCarousel();
  bindFrontCard();
  refreshHistoryIfOpen();
}

// ─────────────────────────────────────────
// PULL SIDE CARD BACK TO CENTER
// ─────────────────────────────────────────
// SIDE DRAWER
// ─────────────────────────────────────────
function openSideDrawer(side) {
  // side = "liked" | "passed"
  const lane    = side === "liked" ? likedLane : passedLane;
  const color   = side === "liked" ? "#43e97b" : "#ff4458";
  const label   = side === "liked" ? "💚 Liked" : "✕ Passed";
  const emptyMsg = side === "liked" ? "No liked profiles yet" : "No passed profiles yet";

  const existing = document.getElementById("side-drawer-backdrop");
  if (existing) existing.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "side-drawer-backdrop";
  backdrop.className = "side-drawer-backdrop";
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeSideDrawer(); });

  const drawer = document.createElement("div");
  drawer.className = `side-drawer side-drawer-${side}`;
  drawer.innerHTML = `
    <div class="side-drawer-header">
      <span class="side-drawer-title">${label}</span>
      <button class="side-drawer-close" onclick="closeSideDrawer()">✕</button>
    </div>
    <div class="side-drawer-body" id="side-drawer-body">
      ${lane.length === 0
        ? `<div class="side-drawer-empty">${emptyMsg}</div>`
        : lane.map(e => `
          <div class="side-drawer-row" data-uid="${e.uid}">
            <img class="side-drawer-avatar"
              src="${e.data.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'}"
              onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'">
            <div class="side-drawer-info">
              <div class="side-drawer-name">${e.data.name || ""}${e.data.age ? `, ${e.data.age}` : ""}</div>
              <div class="side-drawer-meta">${[e.data.course, e.data.campus].filter(Boolean).join(" · ")}</div>
            </div>
            <button class="side-drawer-pull-btn" data-uid="${e.uid}" data-side="${side}">
              Pull back
            </button>
          </div>`).join("")
      }
    </div>`;

  backdrop.appendChild(drawer);
  document.body.appendChild(backdrop);
  setTimeout(() => { backdrop.classList.add("open"); drawer.classList.add("open"); }, 10);

  // Pull back buttons
  drawer.querySelectorAll(".side-drawer-pull-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const uid  = btn.dataset.uid;
      const side = btn.dataset.side;
      closeSideDrawer();
      if (side === "liked")  pullFromLiked(uid);
      else                   pullFromPassed(uid);
    });
  });
}

function closeSideDrawer() {
  const backdrop = document.getElementById("side-drawer-backdrop");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  backdrop.querySelector(".side-drawer").classList.remove("open");
  setTimeout(() => backdrop.remove(), 300);
}

async function pullFromLiked(uid) {
  const idx = likedLane.findIndex(e => e.uid === uid);
  if (idx === -1) return;
  const entry = likedLane.splice(idx, 1)[0];
  entry.card.classList.remove("swiping-right");
  centerQueue.unshift(entry);
  likedUids.delete(uid);

  // Remove like + match from Firestore
  try {
    await deleteDoc(doc(db, "likes", `${currentUser.uid}_${uid}`));
    const matchId = [currentUser.uid, uid].sort().join("_");
    try { await deleteDoc(doc(db, "matches", matchId)); } catch (_) {}
  } catch (err) { console.error("Unlike error:", err); }

  showSideToast("💚 Pulled back — like again or pass?", "green");
  renderCarousel();
  bindFrontCard();
  refreshHistoryIfOpen();
}

async function pullFromPassed(uid) {
  const idx = passedLane.findIndex(e => e.uid === uid);
  if (idx === -1) return;
  const entry = passedLane.splice(idx, 1)[0];
  entry.card.classList.remove("swiping-left");
  centerQueue.unshift(entry);
  passedUids.delete(uid);

  // Remove from Firestore
  try {
    await deleteDoc(doc(db, "passes", `${currentUser.uid}_${uid}`));
  } catch (err) { console.error("Unpass error:", err); }

  showSideToast("🔄 Back in play — decide again!", "blue");
  renderCarousel();
  bindFrontCard();
  refreshHistoryIfOpen();
}

// ─────────────────────────────────────────
// BUILD CARD
// ─────────────────────────────────────────
function buildCard(data, targetUid) {
  const card = document.createElement("div");
  card.className = "user-card";

  card.innerHTML = `
    <img src="${data.photoURL || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+"}" alt="${data.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'">
    <button class="info-btn" data-action="info">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M10 14v-4M10 6h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="card-info">
      <h3>${data.name}, ${data.age}</h3>
      <p>📍 ${data.campus}</p>
      <p>📚 ${data.course}</p>
      ${(() => {
        const myInterests = currentUserData?.interests || [];
        const targetInterests = data.interests || [];
        if (targetInterests.length === 0) return "";
        
        // Show up to 3 interests, prioritizing shared ones
        const sortedTargetInterests = [...targetInterests].sort((a, b) => {
          const aShared = myInterests.includes(a);
          const bShared = myInterests.includes(b);
          if (aShared && !bShared) return -1;
          if (!aShared && bShared) return 1;
          return 0;
        });

        return `
          <div class="card-interests" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
            ${sortedTargetInterests.slice(0, 3).map(interest => {
              const isShared = myInterests.includes(interest);
              const emojiMap = {
                "Music": "🎵", "Sports": "⚽", "Gaming": "🎮", "Coding": "💻", 
                "Traveling": "✈️", "Movies": "🍿", "Books": "📚", "Cooking": "🍳", 
                "Hiking": "🥾", "Art": "🎨", "Photography": "📷", "Dancing": "💃", 
                "Gym": "🏋️", "Coffee": "☕", "Writing": "✍️", "Music Instruments": "🎹"
              };
              const emoji = emojiMap[interest] || "✨";
              return `
                <span class="card-interest-pill" style="
                  padding: 4px 8px;
                  border-radius: 50px;
                  font-size: 10.5px;
                  font-weight: 600;
                  display: inline-flex;
                  align-items: center;
                  gap: 3px;
                  background: ${isShared ? 'rgba(108,71,255,0.18)' : 'rgba(255,255,255,0.06)'};
                  color: ${isShared ? '#a78bfa' : '#9e9bb8'};
                  border: 1px solid ${isShared ? 'rgba(108,71,255,0.3)' : 'rgba(255,255,255,0.1)'};
                ">
                  <span>${emoji}</span>
                  <span>${interest}</span>
                </span>
              `;
            }).join("")}
          </div>
        `;
      })()}
    </div>`;

  // Info button — only when card is center-front
  card.querySelector('[data-action="info"]').onclick = async (e) => {
    e.stopPropagation();
    const isFront = centerQueue.length > 0 && centerQueue[0].uid === targetUid;
    const isInLiked  = likedLane.some(e => e.uid === targetUid);
    const isInPassed = passedLane.some(e => e.uid === targetUid);
    if (!isFront && !isInLiked && !isInPassed) return;
    await recordView(targetUid, data, currentUser.uid, currentUserData || {});
    showProfileModal(data, targetUid);
  };

  card._likeAction = doLikeCard;
  card._passAction = doPassCard;
  card._targetUid  = targetUid;
  card._data       = data;
  return card;
}
// ─────────────────────────────────────────
// RECORD VIEW
// ─────────────────────────────────────────
async function recordView(targetUid, targetData, viewerUid, viewerData) {
  if (!targetUid || !viewerUid || targetUid === viewerUid) return;
  try {
    // Write to views collection — viewer writes about themselves viewing target
    // This works with standard Firestore rules (user writing their own activity)
    const viewId = `${viewerUid}_${targetUid}_${Date.now()}`;
    await setDoc(doc(db, "views", viewId), {
      viewerUid,
      targetUid,
      viewerName:     viewerData.name     || "",
      viewerPhoto:    viewerData.photoURL || "",
      viewerCourse:   viewerData.course   || "",
      viewerCampus:   viewerData.campus   || "",
      viewedAt:       serverTimestamp()
    });

    // Also increment profileViews on own doc (viewer writes to their own tracking)
    // Update target's profileViews counter via the views collection count instead
  } catch (err) { console.error("recordView error:", err); }
}


// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function updateLikeIndicator(isLiked) {
  if (!likeIndicator) return;
  const span = likeIndicator.querySelector("span");
  likeIndicator.classList.toggle("liked", isLiked);
  if (span) span.textContent = isLiked ? "Unlike" : "Like";
}

function enableIndicators() {
  if (passIndicator) passIndicator.style.pointerEvents = "auto";
  if (likeIndicator) likeIndicator.style.pointerEvents = "auto";
}

function disableIndicators() {
  if (passIndicator) passIndicator.style.pointerEvents = "none";
  if (likeIndicator) likeIndicator.style.pointerEvents = "none";
}

function showEmpty(title, msg, btnText, btnAction) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${msg}</p>
      <button id="emptyBtn">${btnText}</button>
    </div>`;
  const btn = document.getElementById("emptyBtn");
  if (btn) btn.onclick = btnAction;
}

function showSideToast(msg, color) {
  const existing = document.querySelector(".side-toast");
  if (existing) existing.remove();
  const t = document.createElement("div");
  t.className = "side-toast";
  t.style.setProperty("--toast-color", color === "green" ? "#43e97b" : color === "red" ? "#ff4458" : "#667eea");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2500);
}

function showUndoNotification(undoCallback) {
  const existing = document.querySelector(".undo-notification");
  if (existing) existing.remove();
  const n = document.createElement("div");
  n.className = "undo-notification";
  n.innerHTML = `<span>Profile passed</span><button class="undo-btn">Undo</button>`;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add("show"), 10);
  let clicked = false;
  n.querySelector(".undo-btn").onclick = () => {
    clicked = true;
    undoCallback();
    n.classList.remove("show");
    setTimeout(() => n.remove(), 300);
  };
  setTimeout(() => {
    if (!clicked) { n.classList.remove("show"); setTimeout(() => n.remove(), 300); }
  }, 3000);
}

// ─────────────────────────────────────────
// MATCH NOTIFICATION
// ─────────────────────────────────────────
function showMatchNotification(matchName) {
  const existing = document.querySelector(".match-notification");
  if (existing) existing.remove();

  const n = document.createElement("div");
  n.className = "match-notification";
  n.innerHTML = `
    <div class="match-notif-inner">
      <div class="match-notif-emoji">🎉</div>
      <div class="match-notif-text">
        <strong>It's a Match!</strong>
        <span>You and ${matchName} liked each other</span>
      </div>
      <button class="match-notif-btn" onclick="location.href='matches.html'">View</button>
      <button class="match-notif-close">✕</button>
    </div>`;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add("show"), 10);

  n.querySelector(".match-notif-close").onclick = () => {
    n.classList.remove("show");
    setTimeout(() => n.remove(), 400);
  };

  setTimeout(() => {
    if (document.body.contains(n)) {
      n.classList.remove("show");
      setTimeout(() => n.remove(), 400);
    }
  }, 5000);
}

// ─────────────────────────────────────────
// PROFILE MODAL
// ─────────────────────────────────────────
async function showProfileModal(userData, userId) {
  const existing = document.querySelector(".profile-modal");
  if (existing) existing.remove();

  let freshData = userData;
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) freshData = { ...userData, ...userDoc.data() };
  } catch (err) { console.error("Modal fetch error:", err); }

  const photos  = (freshData.photoPosts && freshData.photoPosts.length > 0)
                  ? freshData.photoPosts
                  : [freshData.photoURL || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+"];

  const photoItems = photos.map((url, i) =>
    `<div class="pm-photo-item ${i === 0 ? "active" : ""}">
       <img src="${url}" alt="${freshData.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'">
     </div>`
  ).join("");

  const dots = photos.length > 1
    ? `<div class="pm-dots">${photos.map((_, i) =>
        `<span class="pm-dot ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";

  const navBtns = photos.length > 1
    ? `<button class="pm-nav pm-prev">&#8249;</button><button class="pm-nav pm-next">&#8250;</button>` : "";

  const modal = document.createElement("div");
  modal.className = "profile-modal";
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="pm-card">

      <!-- Photos fill the card -->
      <div class="pm-gallery">
        ${navBtns}
        <div class="pm-photos">${photoItems}</div>
        ${dots}
      </div>

      <!-- Gradient + name/meta always visible at bottom -->
      <div class="pm-card-overlay">
        <div class="pm-card-name">${freshData.name || ""}${freshData.age ? `, ${freshData.age}` : ""}</div>
        <div class="pm-card-meta">
          ${freshData.campus ? `<span>📍 ${freshData.campus}</span>` : ""}
          ${freshData.course ? `<span>📚 ${freshData.course}</span>` : ""}
        </div>
      </div>

      <!-- Close btn top left -->
      <button class="pm-close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- ℹ️ btn top right — slides up about panel -->
      <button class="pm-about-btn" id="pm-about-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- About panel slides up from bottom -->
      <div class="pm-about-panel" id="pm-about-panel">
        <div class="pm-about-handle"></div>
        <div class="pm-about-name">${freshData.name || ""}${freshData.age ? `, ${freshData.age}` : ""}</div>
        ${freshData.gender ? `<div class="pm-about-row"><span>👤</span><span>${freshData.gender}</span></div>` : ""}
        ${freshData.campus ? `<div class="pm-about-row"><span>📍</span><span>${freshData.campus}</span></div>` : ""}
        ${freshData.course ? `<div class="pm-about-row"><span>📚</span><span>${freshData.course}</span></div>` : ""}
        ${freshData.bio    ? `<div class="pm-about-bio"><h3>About</h3><p>${freshData.bio}</p></div>` : ""}
        ${freshData.interests && freshData.interests.length > 0 ? `
          <div class="pm-about-interests" style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
            <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b6882; margin-bottom: 8px;">Interests</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${freshData.interests.map(i => {
                const emojiMap = {
                  "Music": "🎵", "Sports": "⚽", "Gaming": "🎮", "Coding": "💻", 
                  "Traveling": "✈️", "Movies": "🍿", "Books": "📚", "Cooking": "🍳", 
                  "Hiking": "🥾", "Art": "🎨", "Photography": "📷", "Dancing": "💃", 
                  "Gym": "🏋️", "Coffee": "☕", "Writing": "✍️", "Music Instruments": "🎹"
                };
                const emoji = emojiMap[i] || "✨";
                const isShared = (currentUserData?.interests || []).includes(i);
                return `
                  <span style="
                    padding: 4px 10px;
                    border-radius: 50px;
                    font-size: 11px;
                    font-weight: 600;
                    background: ${isShared ? 'rgba(108,71,255,0.18)' : 'rgba(255,255,255,0.06)'};
                    color: ${isShared ? '#a78bfa' : '#9e9bb8'};
                    border: 1px solid ${isShared ? 'rgba(108,71,255,0.3)' : 'rgba(255,255,255,0.1)'};
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                  ">
                    <span>${emoji}</span>
                    <span>${i}</span>
                  </span>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}
      </div>

    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("show"), 10);

  // Gallery navigation
  if (photos.length > 1) {
    let idx = 0;
    const photoEls = modal.querySelectorAll(".pm-photo-item");
    const dotEls   = modal.querySelectorAll(".pm-dot");
    const goTo = (i) => {
      photoEls.forEach((el, j) => el.classList.toggle("active", j === i));
      dotEls.forEach((el, j)   => el.classList.toggle("active", j === i));
      idx = i;
    };
    modal.querySelector(".pm-prev").onclick = () => goTo(idx > 0 ? idx - 1 : photoEls.length - 1);
    modal.querySelector(".pm-next").onclick = () => goTo(idx < photoEls.length - 1 ? idx + 1 : 0);
    dotEls.forEach((el, i) => { el.onclick = () => goTo(i); });
  }

  // ℹ️ toggle about panel
  const aboutBtn   = modal.querySelector("#pm-about-btn");
  const aboutPanel = modal.querySelector("#pm-about-panel");
  aboutBtn.addEventListener("click", () => {
    const open = aboutPanel.classList.toggle("open");
    aboutBtn.classList.toggle("active", open);
  });

  // Close
  const close = () => {
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 300);
  };
  modal.querySelector(".pm-close").onclick         = close;
  modal.querySelector(".modal-overlay").onclick    = close;
}
// ─────────────────────────────────────────
// HISTORY DRAWER
// ─────────────────────────────────────────
const historyBtn   = document.getElementById("historyBtn");
const histDrawer   = document.getElementById("histDrawer");
const histBackdrop = document.getElementById("histBackdrop");
const histClose    = document.getElementById("histClose");
const histBody     = document.getElementById("histBody");

let histActiveTab = "liked";

function openHistory() {
  histDrawer.classList.add("open");
  histBackdrop.classList.add("open");
  loadHistoryTab(histActiveTab);
}

function closeHistory() {
  histDrawer.classList.remove("open");
  histBackdrop.classList.remove("open");
}

function refreshHistoryIfOpen() {
  if (histDrawer && histDrawer.classList.contains("open")) {
    loadHistoryTab(histActiveTab);
  }
}

if (historyBtn)   historyBtn.addEventListener("click", openHistory);
if (histClose)    histClose.addEventListener("click", closeHistory);
if (histBackdrop) histBackdrop.addEventListener("click", closeHistory);

document.querySelectorAll(".hist-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".hist-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    histActiveTab = tab.dataset.tab;
    loadHistoryTab(histActiveTab);
  });
});

async function loadHistoryTab(tab) {
  if (!currentUser) return;

  // ── Step 1: render instantly from in-memory lanes (no spinner, no wait) ──
  if (tab === "liked") {
    const profiles = likedLane.map(e => ({ uid: e.uid, likeDocId: `${currentUser.uid}_${e.uid}`, ...e.data }));
    renderHistoryRows(profiles, "liked");
  } else {
    const profiles = passedLane.map(e => ({ uid: e.uid, ...e.data }));
    renderHistoryRows(profiles, "passed");
  }

  // ── Step 2: silently merge any Firestore-only records (persisted from prev sessions) ──
  try {
    if (tab === "liked") {
      const liveUids = new Set(likedLane.map(e => e.uid));
      const snap = await getDocs(query(collection(db, "likes"), where("from", "==", currentUser.uid)));
      const extras = [];
      for (const d of snap.docs) {
        const toUid = d.data().to;
        if (!toUid || liveUids.has(toUid)) continue;
        const uSnap = await getDoc(doc(db, "users", toUid));
        if (uSnap.exists()) {
          extras.push({ uid: toUid, likeDocId: d.id, ...uSnap.data() });
          liveUids.add(toUid); // prevent duplicates
        }
      }
      if (extras.length) {
        const profiles = [
          ...likedLane.map(e => ({ uid: e.uid, likeDocId: `${currentUser.uid}_${e.uid}`, ...e.data })),
          ...extras
        ];
        renderHistoryRows(profiles, "liked");
      }
    } else {
      const liveUids = new Set(passedLane.map(e => e.uid));
      const snap = await getDocs(query(collection(db, "passes"), where("from", "==", currentUser.uid)));
      const extras = [];
      for (const d of snap.docs) {
        const toUid = d.data().to;
        if (!toUid || liveUids.has(toUid)) continue;
        const uSnap = await getDoc(doc(db, "users", toUid));
        if (uSnap.exists()) {
          extras.push({ uid: toUid, ...uSnap.data() });
          liveUids.add(toUid);
        }
      }
      if (extras.length) {
        const profiles = [
          ...passedLane.map(e => ({ uid: e.uid, ...e.data })),
          ...extras
        ];
        renderHistoryRows(profiles, "passed");
      }
    }
  } catch (_) {}
}

function renderHistoryRows(profiles, tab) {
  if (!profiles.length) {
    const msg = tab === "liked" ? "You haven't liked anyone yet" : "No passed profiles yet";
    const ico = tab === "liked" ? "💛" : "👋";
    histBody.innerHTML = `<div class="hist-empty"><span class="hist-empty-icon">${ico}</span><span>${msg}</span></div>`;
    return;
  }

  histBody.innerHTML = profiles.map((u, i) => `
    <div class="hist-user-row" data-uid="${u.uid}">
      <img class="hist-avatar"
        src="${u.photoURL || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+"}"
        alt="${u.name || "User"}"
        onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'">
      <div class="hist-info">
        <div class="hist-name">${u.name || "Unknown"}${u.age ? `, ${u.age}` : ""}</div>
        <div class="hist-meta">${[u.course, u.campus].filter(Boolean).join(" • ") || "UniMatch user"}</div>
      </div>
      <div class="hist-actions">
        <button class="hist-action-btn like-btn ${tab === "liked" ? "active-like" : ""}" data-uid="${u.uid}" data-likedocid="${u.likeDocId || ""}" title="Like">❤️</button>
        <button class="hist-action-btn pass-btn ${tab === "passed" ? "active-pass" : ""}" data-uid="${u.uid}" title="Pass">✕</button>
      </div>
    </div>
    ${i < profiles.length - 1 ? '<div class="hist-divider"></div>' : ""}
  `).join("");

  // Row click → view profile
  histBody.querySelectorAll(".hist-user-row").forEach(row => {
    row.addEventListener("click", e => {
      if (e.target.closest(".hist-action-btn")) return;
      showProfileModal({}, row.dataset.uid);
    });
  });

  // Helper: get profile data object for a uid (from either lane)
  function getProfileData(uid) {
    const fromLiked  = likedLane.find(e => e.uid === uid);
    const fromPassed = passedLane.find(e => e.uid === uid);
    return (fromLiked || fromPassed)?.data || null;
  }

  // Like button
  histBody.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      const toUid     = btn.dataset.uid;
      const likeDocId = btn.dataset.likedocid;
      const isLiked   = btn.classList.contains("active-like");

      if (isLiked) {
        // Unlike → remove from likedLane, put back in centerQueue
        const idx = likedLane.findIndex(e => e.uid === toUid);
        if (idx !== -1) likedLane.splice(idx, 1);
        likedUids.delete(toUid);
        // Restore card to center so user can re-decide
        const data = getProfileData(toUid) || {};
        const card = buildCard(data, toUid);
        container.appendChild(card);
        centerQueue.unshift({ card, uid: toUid, data });
        try {
          await deleteDoc(doc(db, "likes", likeDocId || `${currentUser.uid}_${toUid}`));
          const matchId = [currentUser.uid, toUid].sort().join("_");
          try { await deleteDoc(doc(db, "matches", matchId)); } catch (_) {}
        } catch (err) { console.error("Unlike error:", err); }
        renderCarousel();
        loadHistoryTab(histActiveTab);

      } else {
        // Pass → Like: move from passedLane to likedLane immediately
        const idx = passedLane.findIndex(e => e.uid === toUid);
        const entry = idx !== -1 ? passedLane.splice(idx, 1)[0] : null;
        passedUids.delete(toUid);
        const data = entry?.data || getProfileData(toUid) || {};
        const card = entry?.card || buildCard(data, toUid);
        likedLane.unshift({ card, uid: toUid, data });
        likedUids.add(toUid);
        try {
          try { await deleteDoc(doc(db, "passes", `${currentUser.uid}_${toUid}`)); } catch (_) {}
          const likeId = `${currentUser.uid}_${toUid}`;
          await setDoc(doc(db, "likes", likeId), { from: currentUser.uid, to: toUid, createdAt: serverTimestamp() });
          const rev = await getDoc(doc(db, "likes", `${toUid}_${currentUser.uid}`));
          if (rev.exists()) {
            const matchId = [currentUser.uid, toUid].sort().join("_");
            await setDoc(doc(db, "matches", matchId), { users: [currentUser.uid, toUid], createdAt: serverTimestamp() });
            showMatchNotification((await getDoc(doc(db, "users", toUid))).data()?.name || "Someone");
          }
        } catch (err) { console.error("Like error:", err); }
        renderCarousel();
        loadHistoryTab(histActiveTab);
      }
    });
  });

  // Pass button
  histBody.querySelectorAll(".pass-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      const toUid    = btn.dataset.uid;
      const isPassed = btn.classList.contains("active-pass");

      if (isPassed) {
        // Unpass → restore to centerQueue
        const idx = passedLane.findIndex(e => e.uid === toUid);
        const entry = idx !== -1 ? passedLane.splice(idx, 1)[0] : null;
        passedUids.delete(toUid);
        const data = entry?.data || getProfileData(toUid) || {};
        const card = entry?.card || buildCard(data, toUid);
        container.appendChild(card);
        centerQueue.unshift({ card, uid: toUid, data });
        try {
          await deleteDoc(doc(db, "passes", `${currentUser.uid}_${toUid}`));
        } catch (err) { console.error("Unpass error:", err); }
        renderCarousel();
        loadHistoryTab(histActiveTab);

      } else {
        // Like → Pass: move from likedLane to passedLane immediately
        const idx = likedLane.findIndex(e => e.uid === toUid);
        const entry = idx !== -1 ? likedLane.splice(idx, 1)[0] : null;
        likedUids.delete(toUid);
        const data = entry?.data || getProfileData(toUid) || {};
        const card = entry?.card || buildCard(data, toUid);
        passedLane.unshift({ card, uid: toUid, data });
        passedUids.add(toUid);
        try {
          await deleteDoc(doc(db, "likes", `${currentUser.uid}_${toUid}`));
          const matchId = [currentUser.uid, toUid].sort().join("_");
          try { await deleteDoc(doc(db, "matches", matchId)); } catch (_) {}
          await setDoc(doc(db, "passes", `${currentUser.uid}_${toUid}`), { from: currentUser.uid, to: toUid, createdAt: serverTimestamp() });
        } catch (err) { console.error("Pass error:", err); }
        renderCarousel();
        loadHistoryTab(histActiveTab);
      }
    });
  });
}

function addToPassed(uid, userData) {}
function removeFromPassed(uid) {}
function recordPassedProfile(uid, data) {}