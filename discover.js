import { auth, db } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";
import {
  collection, getDocs, getDoc, doc,
  setDoc, deleteDoc, updateDoc,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container     = document.getElementById("discoverContainer");
const passIndicator = document.querySelector(".indicator.pass");
const likeIndicator = document.querySelector(".indicator.like");

// All card elements in order (index 0 = front/active)
let cardStack        = [];
let activeLikeAction = null;
let activePassAction = null;
let currentUser      = null;

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

    const [usersSnap, likesSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("profileComplete", "==", true))),
      getDocs(query(collection(db, "likes"), where("from", "==", currentUser.uid)))
    ]);

    const likedUids = new Set(likesSnap.docs.map(d => d.data().to));

    // Filter candidates
    const candidates = usersSnap.docs.filter(snap => {
      const targetUid = snap.id;
      const data      = snap.data();
      return !(
        targetUid === currentUser.uid ||
        (me.preference !== "all" && data.gender !== me.preference) ||
        data.campus !== me.campus
      );
    });

    if (candidates.length === 0) {
      showEmpty("No More Profiles",
        "You've seen everyone in your area. Check back later!",
        "Back to Dashboard", () => location.href = "dashboard.html");
      disableIndicators();
      return;
    }

    // Build all cards and add to stack (first = front)
    cardStack = [];
    for (const snap of candidates) {
      const card = buildCard(snap.data(), snap.id, likedUids, currentUser);
      container.appendChild(card);
      cardStack.push(card);
    }

    applyStackPositions();
    bindFrontCard();

  } catch (err) {
    console.error("Discover error:", err);
    showEmpty("Something Went Wrong",
      "We couldn't load profiles. Please try again.",
      "Retry", () => location.reload());
    disableIndicators();
  }
})();

// ─────────────────────────────────────────
// STACK POSITION CLASSES
// Assigns .card-pos-0 (front), .card-pos-1, .card-pos-2, etc.
// ─────────────────────────────────────────
function applyStackPositions() {
  const posClasses = ["card-pos-0","card-pos-1","card-pos-2","card-pos-3","card-pos-hidden"];

  cardStack.forEach((card, i) => {
    // Remove all existing position classes
    card.classList.remove(...posClasses);

    if (i === 0) {
      card.classList.add("card-pos-0");
    } else if (i === 1) {
      card.classList.add("card-pos-1");
    } else if (i === 2) {
      card.classList.add("card-pos-2");
    } else if (i === 3) {
      card.classList.add("card-pos-3");
    } else {
      card.classList.add("card-pos-hidden");
    }
  });

  updateQueueLabel();
}

// Shows "X more" label below the front card
function updateQueueLabel() {
  // Remove any existing label
  const old = container.querySelector(".queue-label");
  if (old) old.remove();

  const remaining = cardStack.length - 1;
  if (remaining <= 0 || cardStack.length === 0) return;

  const label = document.createElement("div");
  label.className = "queue-label";
  label.textContent = remaining === 1 ? "1 more profile" : `${remaining} more profiles`;
  cardStack[0].appendChild(label);
}

// ─────────────────────────────────────────
// BIND ACTIONS TO FRONT CARD
// ─────────────────────────────────────────
function bindFrontCard() {
  if (cardStack.length === 0) {
    activeLikeAction = null;
    activePassAction = null;
    disableIndicators();
    return;
  }

  const front = cardStack[0];
  activeLikeAction = front._likeAction;
  activePassAction = front._passAction;

  // Sync the like indicator state
  const likedUids = front._likedUids;
  updateLikeIndicator(likedUids && likedUids.has(front._targetUid));
  enableIndicators();
}

// ─────────────────────────────────────────
// ADVANCE STACK — removes front card and re-positions
// ─────────────────────────────────────────
function advanceStack() {
  if (cardStack.length === 0) return;

  cardStack.shift(); // remove front
  applyStackPositions();
  bindFrontCard();

  if (cardStack.length === 0) {
    setTimeout(() => {
      showEmpty("No More Profiles",
        "You've seen everyone in your area. Check back later!",
        "Back to Dashboard", () => location.href = "dashboard.html");
      disableIndicators();
    }, 500);
  }
}

// ─────────────────────────────────────────
// BUILD CARD
// ─────────────────────────────────────────
function buildCard(data, targetUid, likedUids, user) {
  const card = document.createElement("div");
  card.className = "user-card";

  card.innerHTML = `
    <img src="${data.photoURL || "./assets/images/default-avatar.png"}" alt="${data.name}">
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
    </div>`;

  // Info button — only works on front card
  card.querySelector('[data-action="info"]').onclick = async (e) => {
    e.stopPropagation();
    if (cardStack[0] !== card) return; // ignore taps on background cards
    try {
      const userRef  = doc(db, "users", targetUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { profileViews: (userSnap.data().profileViews || 0) + 1 });
      }
    } catch (err) { console.error("View count error:", err); }
    showProfileModal(data, targetUid);
  };

  // ── LIKE ACTION ──
  const doLike = async () => {
    if (!likeIndicator || likeIndicator.disabled) return;
    likeIndicator.disabled = true;

    const from          = user.uid;
    const to            = targetUid;
    const likeId        = `${from}_${to}`;
    const reverseLikeId = `${to}_${from}`;
    const matchId       = [from, to].sort().join("_");

    try {
      if (likedUids.has(to)) {
        // Unlike
        await deleteDoc(doc(db, "likes", likeId));
        likedUids.delete(to);
        updateLikeIndicator(false);
        try { await deleteDoc(doc(db, "matches", matchId)); } catch (_) {}
      } else {
        // Like — flash green, fly off right
        card.classList.add("swiping-right");
        await setDoc(doc(db, "likes", likeId), { from, to, createdAt: serverTimestamp() });
        likedUids.add(to);

        // Check for mutual like → create match
        const rev = await getDoc(doc(db, "likes", reverseLikeId));
        if (rev.exists()) {
          await setDoc(doc(db, "matches", matchId), {
            users: [from, to], createdAt: serverTimestamp()
          });
          setTimeout(() => alert("🎉 It's a Match! Check your matches page!"), 350);
        }

        // Animate away, then advance stack
        setTimeout(() => {
          card.classList.add("swipe-right");
          setTimeout(() => {
            card.remove();
            advanceStack();
          }, 480);
        }, 100);
      }
    } catch (err) {
      console.error("Like error:", err);
      alert(err.code === "permission-denied"
        ? "Permission denied. Check your Firestore rules."
        : `Action failed: ${err.message}`);
      card.classList.remove("swiping-right");
    }

    likeIndicator.disabled = false;
  };

  // ── PASS ACTION ──
  const doPass = () => {
    card.classList.add("swiping-left");

    showUndoNotification(() => {
      // Undo — put card back at front of stack
      card.classList.remove("swiping-left", "swipe-left");
      cardStack.unshift(card);
      container.appendChild(card); // move to top of DOM
      applyStackPositions();
      bindFrontCard();
    });

    setTimeout(() => {
      card.classList.add("swipe-left");
      setTimeout(() => {
        card.style.display = "none";
        advanceStack();
      }, 480);
    }, 100);
  };

  card._likeAction = doLike;
  card._passAction = doPass;
  card._targetUid  = targetUid;
  card._likedUids  = likedUids;

  return card;
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
// PROFILE MODAL
// ─────────────────────────────────────────
async function showProfileModal(userData, userId) {
  const existing = document.querySelector(".profile-modal");
  if (existing) existing.remove();

  let photoPosts = [];
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) photoPosts = userDoc.data().photoPosts || [];
  } catch (err) { console.error("Photo fetch error:", err); }

  const modal = document.createElement("div");
  modal.className = "profile-modal";

  const photosHTML = photoPosts.length === 0
    ? `<div class="no-photos">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
          <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>No photos yet</p>
       </div>`
    : photoPosts.map((url, i) =>
        `<div class="photo-item ${i === 0 ? "active" : ""}">
           <img src="${url}" alt="${userData.name}'s photo">
         </div>`
      ).join("");

  const totalPhotos = photoPosts.length;

  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <button class="modal-close">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="photo-gallery">
        ${totalPhotos > 1 ? `<button class="gallery-nav prev"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ""}
        <div class="photo-container">${photosHTML}</div>
        ${totalPhotos > 1 ? `
          <button class="gallery-nav next"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          <div class="photo-dots">
            ${photoPosts.map((_, i) => `<span class="dot ${i === 0 ? "active" : ""}" data-index="${i}"></span>`).join("")}
          </div>` : ""}
      </div>
      <div class="profile-details">
        <h2>${userData.name}, ${userData.age}</h2>
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/><path d="M10 18c-4.478 0-8-2.015-8-4.5S5.522 9 10 9s8 2.015 8 4.5S14.478 18 10 18z" stroke="currentColor" stroke-width="1.5"/></svg>
          <span>${userData.gender || "Not specified"}</span>
        </div>
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2C6.134 2 3 5.134 3 9c0 5.25 7 11 7 11s7-5.75 7-11c0-3.866-3.134-7-7-7z" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="9" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
          <span>${userData.campus}</span>
        </div>
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>${userData.course}</span>
        </div>
        ${userData.bio ? `<div class="bio-section"><h3>About</h3><p>${userData.bio}</p></div>` : ""}
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("show"), 10);

  if (totalPhotos > 1) {
    let idx = 0;
    const items = modal.querySelectorAll(".photo-item");
    const dots  = modal.querySelectorAll(".dot");
    const show  = (i) => {
      items.forEach((el, j) => el.classList.toggle("active", j === i));
      dots.forEach((d, j)  => d.classList.toggle("active", j === i));
      idx = i;
    };
    modal.querySelector(".gallery-nav.prev").onclick = () => show(idx > 0 ? idx - 1 : items.length - 1);
    modal.querySelector(".gallery-nav.next").onclick = () => show(idx < items.length - 1 ? idx + 1 : 0);
    dots.forEach((d, i) => { d.onclick = () => show(i); });
  }

  const close = () => { modal.classList.remove("show"); setTimeout(() => modal.remove(), 300); };
  modal.querySelector(".modal-close").onclick   = close;
  modal.querySelector(".modal-overlay").onclick = close;
}