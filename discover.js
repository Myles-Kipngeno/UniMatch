import { auth, db } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";
import {
  collection, getDocs, getDoc, doc,
  setDoc, deleteDoc, updateDoc, arrayUnion,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Curated Hobbies & Interests List (mirrored from profile.js)
const CURATED_INTERESTS = [
  { name: "Music", emoji: "🎵" },
  { name: "Sports", emoji: "⚽" },
  { name: "Gaming", emoji: "🎮" },
  { name: "Coding", emoji: "💻" },
  { name: "Traveling", emoji: "✈️" },
  { name: "Movies", emoji: "🍿" },
  { name: "Books", emoji: "📚" },
  { name: "Cooking", emoji: "🍳" },
  { name: "Hiking", emoji: "🥾" },
  { name: "Art", emoji: "🎨" },
  { name: "Photography", emoji: "📷" },
  { name: "Dancing", emoji: "💃" },
  { name: "Gym", emoji: "🏋️" },
  { name: "Coffee", emoji: "☕" },
  { name: "Writing", emoji: "✍️" },
  { name: "Music Instruments", emoji: "🎹" },
  { name: "Netflix & Chill", emoji: "🎬" },
  { name: "Partying/Clubbing", emoji: "🍻" },
  { name: "TikTok & Reels", emoji: "📱" },
  { name: "Anime & Manga", emoji: "🌸" },
  { name: "Memes & Humor", emoji: "😂" },
  { name: "Sleeping/Naps", emoji: "😴" },
  { name: "Fast Food/Foodie", emoji: "🍔" },
  { name: "Studying/Library", emoji: "📖" },
  { name: "Board Games", emoji: "🎲" },
  { name: "e-sports", emoji: "🏆" },
  { name: "Podcasts", emoji: "🎙️" },
  { name: "Volunteering", emoji: "🤝" }
];

const PERSONALITIES = ["Adventurer 🏕️", "Intellect 🧠", "Creative 🎨", "Socialite 🥳", "Harmonizer ☕"];

// DOM elements
const container = document.getElementById("discoverContainer");
const indicatorPass = document.getElementById("indicatorPass");
const indicatorLike = document.getElementById("indicatorLike");
const indicatorSuperLike = document.getElementById("indicatorSuperLike");
const recsList = document.getElementById("recommendationsList");

// Filters elements
const filterCampus = document.getElementById("filterCampus");
const filterCourse = document.getElementById("filterCourse");
const filterYear = document.getElementById("filterYear");
const filterPreference = document.getElementById("filterPreference");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const openInterestsModalBtn = document.getElementById("openInterestsModalBtn");
const interestsFilterTags = document.getElementById("interestsFilterTags");
const interestsCountSpan = document.getElementById("interestsCount");

// Interests Modal elements
const interestsModalOverlay = document.getElementById("interestsModalOverlay");
const closeInterestsModalBtn = document.getElementById("closeInterestsModalBtn");
const modalInterestsGrid = document.getElementById("modalInterestsGrid");
const applyInterestsBtn = document.getElementById("applyInterestsBtn");

// Mobile Filters elements
const mobileFilterTriggerBtn = document.getElementById("mobileFilterTriggerBtn");
const mobileFiltersOverlay = document.getElementById("mobileFiltersOverlay");
const closeFiltersModalBtn = document.getElementById("closeFiltersModalBtn");
const mobileFiltersBody = document.getElementById("mobileFiltersBody");
const mobileApplyFiltersBtn = document.getElementById("mobileApplyFiltersBtn");

// Match Celebration Modal
const matchCelebrationOverlay = document.getElementById("matchCelebrationOverlay");
const celebrationMatchName = document.getElementById("celebrationMatchName");
const celebrationViewerPhoto = document.getElementById("celebrationViewerPhoto");
const celebrationTargetPhoto = document.getElementById("celebrationTargetPhoto");
const celebrationIcebreakers = document.getElementById("celebrationIcebreakers");
const celebrationChatBtn = document.getElementById("celebrationChatBtn");
const celebrationCloseBtn = document.getElementById("celebrationCloseBtn");

// State variables
let currentUser = null;
let currentUserData = null;
let allUsers = [];            // Raw candidates loaded from DB
let candidates = [];          // Filtered list of candidates in play
let likedUids = new Set();
let passedUids = new Set();
let passedLane = [];          // Swipe history (left) - newest at index 0
let likedLane = [];           // Swipe history (right) - newest at index 0

// Swipe gesture state
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let activeCardElement = null;

// Filter Selected Interests
let selectedFilterInterests = new Set();

// ─────────────────────────────────────────
// BOOTSTRAP DISCOVERY
// ─────────────────────────────────────────
(async () => {
  try {
    currentUser = await requireAuth();
    container.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Connecting to campus network...</p></div>`;

    // Fetch self user doc
    const meSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (!meSnap.exists() || !meSnap.data().profileComplete) {
      showEmpty("Complete Your Profile", "Finish setting up your profile to start discovering connections.", "Complete Profile", () => location.href = "profile.html");
      return;
    }

    currentUserData = meSnap.data();
    if (currentUserData.photoURL) {
      const navPhoto = document.getElementById("navPhoto");
      if (navPhoto) navPhoto.src = currentUserData.photoURL;
    }

    // Initialize Filter tag counts and preferences
    if (currentUserData.preference) {
      filterPreference.value = currentUserData.preference;
    }

    // Parallel fetch collections
    const [usersSnap, likesSnap, passesSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("profileComplete", "==", true))),
      getDocs(query(collection(db, "likes"),  where("from", "==", currentUser.uid))),
      getDocs(query(collection(db, "passes"), where("from", "==", currentUser.uid)))
    ]);

    likedUids = new Set(likesSnap.docs.map(d => d.data().to));
    passedUids = new Set(passesSnap.docs.map(d => d.data().to));

    // Populate passed/liked lanes from DB for pulling back functionality
    allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    // Reconstruct swipe history arrays
    for (const toUid of likedUids) {
      const uData = allUsers.find(u => u.uid === toUid);
      if (uData) likedLane.push({ uid: toUid, data: uData });
    }
    for (const toUid of passedUids) {
      const uData = allUsers.find(u => u.uid === toUid);
      if (uData) passedLane.push({ uid: toUid, data: uData });
    }

    updateCarouselCountBadges();

    // Prepare core discovery pool (excluding self, already liked/passed users)
    applyClientFiltering(true);
    
    // Bind interaction elements
    setupInterestsModal();
    setupFilters();
    setupMobileFilters();
    setupKeyboardControls();

  } catch (err) {
    console.error("Discover boot error:", err);
    showEmpty("Connection Failed", "Unable to establish secure database connection. Please try again.", "Retry", () => location.reload());
  }
})();

// ─────────────────────────────────────────
// FILTERING & DATA COMPILING
// ─────────────────────────────────────────
function applyClientFiltering(resetDeck = false) {
  // Read inputs
  const campusVal = filterCampus.value.toLowerCase().trim();
  const courseVal = filterCourse.value.toLowerCase().trim();
  const yearVal = filterYear.value;
  const prefVal = filterPreference.value;

  // Filter candidates
  candidates = allUsers.filter(u => {
    if (u.uid === currentUser.uid) return false;
    if (likedUids.has(u.uid) || passedUids.has(u.uid)) return false;

    // Preference mapping
    if (prefVal !== "all" && u.gender !== prefVal) return false;

    // Optional inputs
    if (campusVal && (!u.campus || !u.campus.toLowerCase().includes(campusVal))) return false;
    if (courseVal && (!u.course || !u.course.toLowerCase().includes(courseVal))) return false;
    if (yearVal && u.yearOfStudy !== yearVal) return false;

    // Selected Interests (requires candidate to have at least one of the selected filter interests, if any are selected)
    if (selectedFilterInterests.size > 0) {
      const targetInterests = u.interests || [];
      const hasOverlap = targetInterests.some(i => selectedFilterInterests.has(i));
      if (!hasOverlap) return false;
    }

    return true;
  });

  // Calculate compatibility for each candidate and sort by score
  candidates.forEach(c => {
    c._compatibility = calculateCompatibility(currentUserData, c);
  });
  candidates.sort((a, b) => b._compatibility - a._compatibility);

  // Re-render
  renderSwiperDeck();
  renderRecommendations();
}

function calculateCompatibility(me, target) {
  let score = 30; // base score (for randomized campus vibe)

  // 1. Same campus check (+30%)
  if (me.campus && target.campus && me.campus.toLowerCase().trim() === target.campus.toLowerCase().trim()) {
    score += 30;
  }
  
  // 2. Common major/course major check (+15%)
  if (me.course && target.course && me.course.toLowerCase().trim() === target.course.toLowerCase().trim()) {
    score += 15;
  }

  // 3. Shared interests (+10% per interest, max +40%)
  const myInterests = me.interests || [];
  const targetInterests = target.interests || [];
  const commonInterests = targetInterests.filter(i => myInterests.includes(i));
  score += Math.min(commonInterests.length * 10, 40);

  // 4. Age proximity (+15% if within 1 year)
  if (me.age && target.age && Math.abs(me.age - target.age) <= 1) {
    score += 15;
  }

  // Cap at 99%
  return Math.min(score, 99);
}

function getPersonalityType(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PERSONALITIES[Math.abs(hash) % PERSONALITIES.length];
}

function getMatchReasons(me, target) {
  const reasons = [];
  
  // Same campus
  if (me.campus && target.campus && me.campus.toLowerCase().trim() === target.campus.toLowerCase().trim()) {
    reasons.push("Same Campus");
  }

  // Common interests
  const myInterests = me.interests || [];
  const targetInterests = target.interests || [];
  const common = targetInterests.filter(i => myInterests.includes(i));
  if (common.length > 0) {
    reasons.push(`${common.length} Common Interest${common.length > 1 ? 's' : ''}`);
  }

  // Personality match (deterministic)
  const myPers = getPersonalityType(me.uid || currentUser.uid);
  const targetPers = getPersonalityType(target.uid);
  if (myPers === targetPers) {
    reasons.push("Matching Vibe");
  } else {
    reasons.push("Complementary Vibe");
  }

  return reasons;
}

// ─────────────────────────────────────────
// DECK RENDER & physics GESTURE BINDING
// ─────────────────────────────────────────
function renderSwiperDeck() {
  container.innerHTML = "";
  if (candidates.length === 0) {
    showEmptyDeck();
    return;
  }

  // Show up to 3 cards in the deck for 3D stacking depth
  const cardsToRender = candidates.slice(0, 3);
  cardsToRender.forEach((user, index) => {
    const card = buildCardElement(user, index);
    container.appendChild(card);
    
    // Bind touch/drag events only on the active front card
    if (index === 0) {
      bindSwipeGestures(card);
    }
  });
}

function showEmptyDeck() {
  container.innerHTML = `
    <div class="empty-state">
      <h3>No Profiles Found</h3>
      <p>Adjust your discovery parameters in the filter sidebar to find more students on campus.</p>
      <button id="resetFiltersDeckBtn">Clear Filters</button>
    </div>`;

  const btn = document.getElementById("resetFiltersDeckBtn");
  if (btn) {
    btn.onclick = () => {
      resetAllFilters();
    };
  }
  disableControls();
}

function buildCardElement(user, index) {
  const card = document.createElement("div");
  card.className = "user-card";
  
  // Assign 3D stack classes
  if (index === 0) card.classList.add("active-card");
  else if (index === 1) card.classList.add("next-card");
  else if (index === 2) card.classList.add("third-card");
  else card.classList.add("hidden-card");

  const myPers = getPersonalityType(user.uid);
  const reasons = getMatchReasons(currentUserData, user);
  const interestsList = user.interests || [];

  // Year label helper
  const getYearLabel = (val) => {
    const mapping = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year", "5": "Graduate" };
    return mapping[val] || "Undergrad";
  };

  card.innerHTML = `
    <!-- Action Stamps -->
    <div class="stamp stamp-like">Like</div>
    <div class="stamp stamp-nope">Nope</div>
    <div class="stamp stamp-super">Crush</div>

    <img src="${user.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'}" alt="${user.name}">
    
    <button class="info-btn" data-action="info">
      <i class="fa-solid fa-circle-info"></i>
    </button>

    <div class="card-info">
      <div class="card-title-row">
        <span class="card-name">${user.name}</span>
        <span class="card-age">${user.age}</span>
        <span class="card-compat-badge">${user._compatibility}% Match</span>
      </div>
      
      <div class="card-meta-row">
        <div class="card-meta-item"><i class="fa-solid fa-graduation-cap"></i> <span>${user.course} (${getYearLabel(user.yearOfStudy)})</span></div>
        <div class="card-meta-item"><i class="fa-solid fa-building-columns"></i> <span>${user.campus}</span></div>
      </div>

      <p class="card-bio">${user.bio || "No campus bio updated yet."}</p>

      <!-- Match Reasons tags -->
      <div class="match-reasons-container">
        <span class="reason-tag" style="background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.3); color: #c084fc;">
          <i class="fa-solid fa-user-tag"></i> ${myPers}
        </span>
        ${reasons.map(r => `
          <span class="reason-tag">
            <i class="fa-solid ${r.includes('Campus') ? 'fa-map-pin' : r.includes('Vibe') ? 'fa-bolt' : 'fa-heart'}"></i> ${r}
          </span>
        `).join("")}
      </div>

      <!-- Interests Preview -->
      <div class="card-interests">
        ${interestsList.slice(0, 3).map(interest => {
          const isShared = (currentUserData?.interests || []).includes(interest);
          const matchItem = CURATED_INTERESTS.find(i => i.name === interest);
          const emoji = matchItem ? matchItem.emoji : "✨";
          return `
            <span class="card-interest-pill ${isShared ? 'shared-interest' : ''}">
              <span>${emoji}</span>
              <span>${interest}</span>
            </span>
          `;
        }).join("")}
      </div>
    </div>
  `;

  // Details button click -> Opens Modal
  card.querySelector('[data-action="info"]').onclick = (e) => {
    e.stopPropagation();
    showProfileModal(user, user.uid);
  };

  card._uid = user.uid;
  card._data = user;
  return card;
}

// ─────────────────────────────────────────
// CARD GESTURES & INTERACTION
// ─────────────────────────────────────────
function bindSwipeGestures(card) {
  activeCardElement = card;
  card.addEventListener("mousedown", onDragStart);
  card.addEventListener("touchstart", onDragStart, { passive: true });
}

function onDragStart(e) {
  if (e.target.closest(".info-btn") || e.target.closest(".card-interests") || e.target.closest("button")) return;
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  startX = clientX;
  startY = clientY;

  activeCardElement.style.transition = "none";
  activeCardElement.style.cursor = "grabbing";

  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("mouseup", onDragEnd);
  document.addEventListener("touchend", onDragEnd);
}

function onDragMove(e) {
  if (!isDragging || !activeCardElement) return;
  if (e.cancelable) e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  currentX = clientX - startX;
  currentY = clientY - startY;

  // Swiping calculations (rotation and displacement)
  const rotation = currentX * 0.08;
  activeCardElement.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotation}deg)`;

  // Stamp opacities
  const stampLike = activeCardElement.querySelector(".stamp-like");
  const stampNope = activeCardElement.querySelector(".stamp-nope");
  const stampSuper = activeCardElement.querySelector(".stamp-super");

  if (currentY < -60 && Math.abs(currentX) < Math.abs(currentY)) {
    // Upward drag -> Super Like / Secret Crush stamp
    if (stampSuper) stampSuper.style.opacity = Math.min(Math.abs(currentY) / 120, 0.95);
    if (stampLike) stampLike.style.opacity = 0;
    if (stampNope) stampNope.style.opacity = 0;
  } else if (currentX > 0) {
    // Right drag -> Like
    if (stampLike) stampLike.style.opacity = Math.min(currentX / 120, 0.95);
    if (stampNope) stampNope.style.opacity = 0;
    if (stampSuper) stampSuper.style.opacity = 0;
  } else {
    // Left drag -> Nope
    if (stampNope) stampNope.style.opacity = Math.min(Math.abs(currentX) / 120, 0.95);
    if (stampLike) stampLike.style.opacity = 0;
    if (stampSuper) stampSuper.style.opacity = 0;
  }
}

function onDragEnd() {
  if (!isDragging || !activeCardElement) return;
  isDragging = false;
  activeCardElement.style.cursor = "grab";

  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("touchmove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
  document.removeEventListener("touchend", onDragEnd);

  const threshold = 130;
  if (currentX > threshold) {
    swipeAction("right");
  } else if (currentX < -threshold) {
    swipeAction("left");
  } else if (currentY < -threshold) {
    swipeAction("up");
  } else {
    // Snap back
    activeCardElement.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    activeCardElement.style.transform = "translate3d(0,0,0) rotate(0deg)";
    
    // Hide stamps
    const stamps = activeCardElement.querySelectorAll(".stamp");
    stamps.forEach(s => s.style.opacity = 0);
  }
}

function swipeAction(direction) {
  if (!activeCardElement) return;
  const card = activeCardElement;
  const uid = card._uid;
  const uData = card._data;
  
  let targetTransform = "";
  if (direction === "right") {
    targetTransform = `translate3d(${window.innerWidth + 200}px, ${currentY}px, 0) rotate(45deg)`;
  } else if (direction === "left") {
    targetTransform = `translate3d(${-window.innerWidth - 200}px, ${currentY}px, 0) rotate(-45deg)`;
  } else if (direction === "up") {
    targetTransform = `translate3d(${currentX}px, ${-window.innerHeight - 200}px, 0) rotate(0deg)`;
  }

  // Animate card fly-off
  card.style.transition = "transform 0.45s ease-in, opacity 0.45s ease-in";
  card.style.transform = targetTransform;
  card.style.opacity = 0;

  // Shift from main swiper queue in memory
  candidates.shift();

  // Execute database operations after animation finish
  setTimeout(async () => {
    card.remove();
    
    if (direction === "right") {
      await registerLike(uid, uData, false);
    } else if (direction === "left") {
      registerPass(uid, uData);
    } else if (direction === "up") {
      await registerLike(uid, uData, true); // superLike = true
    }

    renderSwiperDeck();
  }, 250);
}

// ─────────────────────────────────────────
// BUTTON CLICKS / KEYBOARD SWIPES
// ─────────────────────────────────────────
if (indicatorPass) indicatorPass.onclick = () => buttonSwipe("left");
if (indicatorLike) indicatorLike.onclick = () => buttonSwipe("right");
if (indicatorSuperLike) indicatorSuperLike.onclick = () => buttonSwipe("up");

function buttonSwipe(direction) {
  const card = container.querySelector(".active-card");
  if (!card) return;
  
  activeCardElement = card;
  const stamp = card.querySelector(`.stamp-${direction === "right" ? "like" : direction === "left" ? "nope" : "super"}`);
  if (stamp) {
    stamp.style.opacity = 0.95;
    stamp.style.transform = "scale(1.1) rotate(0deg)";
  }

  setTimeout(() => {
    swipeAction(direction);
  }, 100);
}

function setupKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    // Only swipe if no modal or text inputs are open
    if (document.querySelector(".profile-modal") || 
        document.querySelector(".mobile-filters-overlay.open") || 
        document.querySelector(".interests-modal-overlay.open") ||
        document.activeElement.tagName === "INPUT" || 
        document.activeElement.tagName === "SELECT") return;

    if (e.key === "ArrowRight") {
      buttonSwipe("right");
    } else if (e.key === "ArrowLeft") {
      buttonSwipe("left");
    } else if (e.key === "ArrowUp") {
      buttonSwipe("up");
    }
  });
}

function disableControls() {
  if (indicatorPass) indicatorPass.style.pointerEvents = "none";
  if (indicatorLike) indicatorLike.style.pointerEvents = "none";
  if (indicatorSuperLike) indicatorSuperLike.style.pointerEvents = "none";
}

function enableControls() {
  if (indicatorPass) indicatorPass.style.pointerEvents = "auto";
  if (indicatorLike) indicatorLike.style.pointerEvents = "auto";
  if (indicatorSuperLike) indicatorSuperLike.style.pointerEvents = "auto";
}

// ─────────────────────────────────────────
// FIRESTORE ACTIONS & MATCHES
// ─────────────────────────────────────────
async function registerLike(targetUid, targetData, isSuperLike = false) {
  const from = currentUser.uid;
  const to = targetUid;
  const likeId = `${from}_${to}`;
  const reverseLikeId = `${to}_${from}`;
  const matchId = [from, to].sort().join("_");

  likedUids.add(to);
  likedLane.unshift({ uid: to, data: targetData });
  updateCarouselCountBadges();

  try {
    // Save like to Firestore
    await setDoc(doc(db, "likes", likeId), {
      from,
      to,
      superLike: isSuperLike,
      createdAt: serverTimestamp()
    });

    // Check for match
    const revSnap = await getDoc(doc(db, "likes", reverseLikeId));
    if (revSnap.exists()) {
      // Create match document
      await setDoc(doc(db, "matches", matchId), {
        users: [from, to],
        createdAt: serverTimestamp(),
        unreadCounts: { [from]: 0, [to]: 0 },
        lastMessage: isSuperLike ? "🌟 Sent a Super Like! Say hello 👋" : "You matched! Say hello 👋",
        lastMessageAt: serverTimestamp()
      });

      // Trigger Celebration!
      showCelebrationOverlay(targetData);
    } else {
      showSideToast(isSuperLike ? "⭐ Super Liked profile!" : "💚 Profile liked!", "green");
    }

  } catch (err) {
    console.error("Like save failed:", err);
    showSideToast("Action failed. Connection error.", "red");
  }
}

async function registerPass(targetUid, targetData) {
  const from = currentUser.uid;
  const to = targetUid;
  const passId = `${from}_${to}`;

  passedUids.add(to);
  passedLane.unshift({ uid: to, data: targetData });
  updateCarouselCountBadges();

  // Show undo panel popup for a quick undo callback
  showUndoNotification(() => {
    // Undo callback
    pullFromPassed(to);
  });

  try {
    await setDoc(doc(db, "passes", passId), {
      from,
      to,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Pass save failed:", err);
  }
}

async function pullFromPassed(uid) {
  const idx = passedLane.findIndex(e => e.uid === uid);
  if (idx === -1) return;
  
  const entry = passedLane.splice(idx, 1)[0];
  passedUids.delete(uid);
  updateCarouselCountBadges();

  // Return to swiper deck list
  candidates.unshift(entry.data);
  renderSwiperDeck();
  enableControls();

  try {
    await deleteDoc(doc(db, "passes", `${currentUser.uid}_${uid}`));
    showSideToast("🔄 Restored profile to campus list!", "blue");
  } catch (err) {
    console.error("Pass undo failed:", err);
  }
}

async function pullFromLiked(uid) {
  const idx = likedLane.findIndex(e => e.uid === uid);
  if (idx === -1) return;
  
  const entry = likedLane.splice(idx, 1)[0];
  likedUids.delete(uid);
  updateCarouselCountBadges();

  candidates.unshift(entry.data);
  renderSwiperDeck();
  enableControls();

  try {
    await deleteDoc(doc(db, "likes", `${currentUser.uid}_${uid}`));
    const matchId = [currentUser.uid, uid].sort().join("_");
    await deleteDoc(doc(db, "matches", matchId)).catch(() => {});
    showSideToast("🔄 Restored profile to campus list!", "blue");
  } catch (err) {
    console.error("Like undo failed:", err);
  }
}

// ─────────────────────────────────────────
// RECOMMENDATIONS SIDEBAR (DESKTOP)
// ─────────────────────────────────────────
function renderRecommendations() {
  if (!recsList) return;
  recsList.innerHTML = "";

  const available = allUsers.filter(u => {
    return u.uid !== currentUser.uid && !likedUids.has(u.uid) && !passedUids.has(u.uid);
  });

  if (available.length === 0) {
    recsList.innerHTML = `<p class="rec-empty-msg">No suggestions. Try clearing likes or passes.</p>`;
    return;
  }

  // Calculate compatibility, sort, and grab top 3
  const scored = available.map(u => ({
    ...u,
    _compatibility: calculateCompatibility(currentUserData, u)
  })).sort((a, b) => b._compatibility - a._compatibility).slice(0, 3);

  scored.forEach(u => {
    const item = document.createElement("div");
    item.className = "rec-item";
    
    const myPers = getPersonalityType(u.uid);
    const commonInterests = (u.interests || []).filter(i => (currentUserData.interests || []).includes(i));
    const reasonText = commonInterests.length > 0 
      ? `Shared: ${commonInterests.slice(0, 2).join(', ')}` 
      : `Vibe: ${myPers.split(' ')[0]}`;

    item.innerHTML = `
      <img class="rec-avatar" src="${u.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'}">
      <div class="rec-info">
        <div class="rec-name-wrap">
          <span class="rec-name">${u.name}</span>
          <span class="rec-score">${u._compatibility}%</span>
        </div>
        <div class="rec-meta">${u.campus}</div>
        <div class="rec-reasons"><i class="fa-solid fa-sparkles" style="color:var(--primary); font-size:10px;"></i> ${reasonText}</div>
      </div>
    `;

    // Click triggers modal display
    item.onclick = () => showProfileModal(u, u.uid);
    recsList.appendChild(item);
  });
}

// ─────────────────────────────────────────
// INTERESTS SELECTOR MODAL
// ─────────────────────────────────────────
function setupInterestsModal() {
  if (!openInterestsModalBtn) return;

  // Render modal selector pills
  modalInterestsGrid.innerHTML = "";
  CURATED_INTERESTS.forEach(item => {
    const pill = document.createElement("div");
    pill.className = "interest-selector-pill";
    pill.innerHTML = `<span>${item.emoji}</span><span>${item.name}</span>`;
    
    pill.onclick = () => {
      if (selectedFilterInterests.has(item.name)) {
        selectedFilterInterests.delete(item.name);
        pill.classList.remove("active");
      } else {
        selectedFilterInterests.add(item.name);
        pill.classList.add("active");
      }
    };
    modalInterestsGrid.appendChild(pill);
  });

  openInterestsModalBtn.onclick = () => {
    // Sync active state from state set
    modalInterestsGrid.querySelectorAll(".interest-selector-pill").forEach(pill => {
      const name = pill.querySelector("span:last-child").textContent;
      pill.classList.toggle("active", selectedFilterInterests.has(name));
    });
    interestsModalOverlay.classList.add("open");
  };

  closeInterestsModalBtn.onclick = () => interestsModalOverlay.classList.remove("open");
  
  applyInterestsBtn.onclick = () => {
    interestsModalOverlay.classList.remove("open");
    interestsCountSpan.textContent = selectedFilterInterests.size;
    
    // Render selected filter tags
    interestsFilterTags.innerHTML = "";
    selectedFilterInterests.forEach(name => {
      const tag = document.createElement("span");
      tag.className = "filter-tag";
      tag.innerHTML = `<span>${name}</span><span class="remove-tag">✕</span>`;
      tag.querySelector(".remove-tag").onclick = (e) => {
        e.stopPropagation();
        selectedFilterInterests.delete(name);
        interestsCountSpan.textContent = selectedFilterInterests.size;
        tag.remove();
        applyClientFiltering();
      };
      interestsFilterTags.appendChild(tag);
    });

    applyClientFiltering();
  };
}

// ─────────────────────────────────────────
// FILTER FORMS BINDING
// ─────────────────────────────────────────
function setupFilters() {
  if (!applyFiltersBtn) return;

  applyFiltersBtn.onclick = () => {
    applyClientFiltering();
  };

  resetFiltersBtn.onclick = () => {
    resetAllFilters();
  };
}

function resetAllFilters() {
  filterCampus.value = "";
  filterCourse.value = "";
  filterYear.value = "";
  filterPreference.value = currentUserData.preference || "all";
  selectedFilterInterests.clear();
  if (interestsCountSpan) interestsCountSpan.textContent = "0";
  if (interestsFilterTags) interestsFilterTags.innerHTML = "";
  
  // Reset mobile ones too if open
  const mCampus = document.getElementById("mFilterCampus");
  const mCourse = document.getElementById("mFilterCourse");
  const mYear = document.getElementById("mFilterYear");
  const mPref = document.getElementById("mFilterPreference");
  if (mCampus) mCampus.value = "";
  if (mCourse) mCourse.value = "";
  if (mYear) mYear.value = "";
  if (mPref) mPref.value = currentUserData.preference || "all";

  applyClientFiltering();
  showSideToast("Filters reset successfully!", "blue");
}

function setupMobileFilters() {
  if (!mobileFilterTriggerBtn) return;

  // Build mobile menu form
  mobileFilterTriggerBtn.onclick = () => {
    mobileFiltersBody.innerHTML = `
      <form class="filters-form" id="mobileFormWrapper">
        <div class="filter-group">
          <label class="filter-label">Campus</label>
          <input type="text" id="mFilterCampus" value="${filterCampus.value}" placeholder="e.g. Main Campus">
        </div>
        <div class="filter-group">
          <label class="filter-label">Course / Major</label>
          <input type="text" id="mFilterCourse" value="${filterCourse.value}" placeholder="e.g. Computer Science">
        </div>
        <div class="filter-group">
          <label class="filter-label">Year of Study</label>
          <select id="mFilterYear">
            <option value="" ${filterYear.value === "" ? "selected" : ""}>All Years</option>
            <option value="1" ${filterYear.value === "1" ? "selected" : ""}>1st Year</option>
            <option value="2" ${filterYear.value === "2" ? "selected" : ""}>2nd Year</option>
            <option value="3" ${filterYear.value === "3" ? "selected" : ""}>3rd Year</option>
            <option value="4" ${filterYear.value === "4" ? "selected" : ""}>4th Year</option>
            <option value="5" ${filterYear.value === "5" ? "selected" : ""}>Graduate</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Show Me</label>
          <select id="mFilterPreference">
            <option value="all" ${filterPreference.value === "all" ? "selected" : ""}>Everyone</option>
            <option value="male" ${filterPreference.value === "male" ? "selected" : ""}>Men</option>
            <option value="female" ${filterPreference.value === "female" ? "selected" : ""}>Women</option>
            <option value="nonbinary" ${filterPreference.value === "nonbinary" ? "selected" : ""}>Non-Binary</option>
          </select>
        </div>
      </form>
    `;
    mobileFiltersOverlay.classList.add("open");
  };

  closeFiltersModalBtn.onclick = () => mobileFiltersOverlay.classList.remove("open");

  mobileApplyFiltersBtn.onclick = () => {
    // Sync mobile values back to desktop inputs
    filterCampus.value = document.getElementById("mFilterCampus").value;
    filterCourse.value = document.getElementById("mFilterCourse").value;
    filterYear.value = document.getElementById("mFilterYear").value;
    filterPreference.value = document.getElementById("mFilterPreference").value;

    mobileFiltersOverlay.classList.remove("open");
    applyClientFiltering();
  };
}

// ─────────────────────────────────────────
// PROFILE FULL-SCREEN DETAILS MODAL
// ─────────────────────────────────────────
function showProfileModal(userData, userId) {
  const existing = document.querySelector(".profile-modal");
  if (existing) existing.remove();

  const photos = userData.photoPosts && userData.photoPosts.length > 0 
    ? userData.photoPosts 
    : [userData.photoURL || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+"];

  const photoItems = photos.map((url, i) => `
    <div class="pm-photo-item ${i === 0 ? "active" : ""}">
      <img src="${url}" alt="${userData.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'">
    </div>
  `).join("");

  const dots = photos.length > 1 ? `
    <div class="pm-dots">
      ${photos.map((_, i) => `<span class="pm-dot ${i === 0 ? "active" : ""}"></span>`).join("")}
    </div>` : "";

  const navBtns = photos.length > 1 ? `
    <button class="pm-nav pm-prev"><i class="fa-solid fa-chevron-left"></i></button>
    <button class="pm-nav pm-next"><i class="fa-solid fa-chevron-right"></i></button>` : "";

  const modal = document.createElement("div");
  modal.className = "profile-modal";

  const getYearLabel = (val) => {
    const mapping = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year", "5": "Graduate" };
    return mapping[val] || "Undergrad";
  };

  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="pm-card">
      <div class="pm-gallery">
        ${navBtns}
        <div class="pm-photos">${photoItems}</div>
        ${dots}
      </div>

      <div class="pm-card-overlay">
        <div class="pm-card-name">${userData.name || "UniMatch User"}, ${userData.age || ""}</div>
        <div class="pm-card-meta">
          <span><i class="fa-solid fa-graduation-cap"></i> ${userData.course || "Course"} (${getYearLabel(userData.yearOfStudy)})</span>
          <span><i class="fa-solid fa-building-columns"></i> ${userData.campus || "Campus"}</span>
        </div>
      </div>

      <button class="pm-close"><i class="fa-solid fa-xmark"></i></button>
      <button class="pm-about-btn" id="pm-about-btn"><i class="fa-solid fa-arrow-up"></i></button>

      <!-- Slides up about panel details -->
      <div class="pm-about-panel" id="pm-about-panel">
        <div class="pm-about-handle"></div>
        <div class="pm-about-name">${userData.name || "User"}</div>
        <div class="pm-about-row"><span>👤</span><span>Gender: ${userData.gender}</span></div>
        <div class="pm-about-row"><span>📍</span><span>Campus: ${userData.campus}</span></div>
        <div class="pm-about-row"><span>📚</span><span>Major: ${userData.course}</span></div>
        
        <div class="pm-about-bio">
          <h3>About Me</h3>
          <p>${userData.bio || "No bio updated yet."}</p>
        </div>

        <div style="margin-top: 20px;">
          <h3 style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--primary); margin-bottom:8px;">Campus Interests</h3>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(userData.interests || []).map(i => {
              const isShared = (currentUserData.interests || []).includes(i);
              const mItem = CURATED_INTERESTS.find(cur => cur.name === i);
              return `
                <span style="
                  background:${isShared ? 'rgba(108,71,255,0.14)' : 'rgba(255,255,255,0.04)'};
                  color:${isShared ? '#c084fc' : 'var(--text-secondary)'};
                  border:1px solid ${isShared ? 'rgba(108,71,255,0.3)' : 'rgba(255,255,255,0.08)'};
                  padding:5px 12px; border-radius:50px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;
                ">
                  <span>${mItem ? mItem.emoji : "✨"}</span>
                  <span>${i}</span>
                </span>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("show"), 10);

  // Gallery Navigation logic
  if (photos.length > 1) {
    let idx = 0;
    const items = modal.querySelectorAll(".pm-photo-item");
    const dotsList = modal.querySelectorAll(".pm-dot");
    const goTo = (i) => {
      items.forEach((item, j) => item.classList.toggle("active", j === i));
      dotsList.forEach((dot, j) => dot.classList.toggle("active", j === i));
      idx = i;
    };
    modal.querySelector(".pm-prev").onclick = () => goTo(idx > 0 ? idx - 1 : items.length - 1);
    modal.querySelector(".pm-next").onclick = () => goTo(idx < items.length - 1 ? idx + 1 : 0);
    dotsList.forEach((dot, i) => dot.onclick = () => goTo(i));
  }

  // Bio Drawer slide toggle
  const aboutBtn = modal.querySelector("#pm-about-btn");
  const aboutPanel = modal.querySelector("#pm-about-panel");
  aboutBtn.onclick = () => {
    const open = aboutPanel.classList.toggle("open");
    aboutBtn.classList.toggle("active", open);
    aboutBtn.innerHTML = open ? `<i class="fa-solid fa-arrow-down"></i>` : `<i class="fa-solid fa-arrow-up"></i>`;
  };

  // Close handlers
  const closeModal = () => {
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 350);
  };
  modal.querySelector(".pm-close").onclick = closeModal;
  modal.querySelector(".modal-overlay").onclick = closeModal;
}

// ─────────────────────────────────────────
// DYNAMIC MATCH CELEBRATION (FULL SCREEN)
// ─────────────────────────────────────────
function showCelebrationOverlay(matchUser) {
  if (!matchCelebrationOverlay) return;

  celebrationMatchName.textContent = matchUser.name;
  
  // Photos load
  if (currentUserData.photoURL) celebrationViewerPhoto.src = currentUserData.photoURL;
  if (matchUser.photoURL) celebrationTargetPhoto.src = matchUser.photoURL;

  // Generate suggested icebreakers
  const common = (matchUser.interests || []).filter(i => (currentUserData.interests || []).includes(i));
  
  const starters = [
    `Hey ${matchUser.name}! I noticed we both love ${common[0] || 'Coding'}. What project are you working on?`,
    `Happy Match! 🎉 Same campus too, are you usually at the library or student center?`,
    `Hey! Your bio was awesome. Up for grabbing a coffee at the campus café sometime this week?`
  ];

  celebrationIcebreakers.innerHTML = starters.map(txt => `
    <div class="icebreaker-pill" data-starter="${encodeURIComponent(txt)}">
      "${txt}"
    </div>
  `).join("");

  // Sparkles/Confetti canvas-like animation inside overlay
  const sparklesWrap = matchCelebrationOverlay.querySelector(".sparkles-container");
  sparklesWrap.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const s = document.createElement("div");
    s.style.position = "absolute";
    s.style.width = Math.random() * 8 + 4 + "px";
    s.style.height = s.style.width;
    s.style.borderRadius = "50%";
    s.style.background = ["#ff4b72", "#2ce687", "#3b82f6", "#f59e0b", "#a855f7"][Math.floor(Math.random() * 5)];
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.opacity = Math.random();
    s.style.transform = `scale(${Math.random()})`;
    sparklesWrap.appendChild(s);
  }

  matchCelebrationOverlay.classList.add("show");

  // Interaction handlers
  const closeCel = () => {
    matchCelebrationOverlay.classList.remove("show");
  };

  celebrationCloseBtn.onclick = closeCel;

  celebrationChatBtn.onclick = () => {
    // Navigate straight to matches messaging panel with open trigger parameter
    const matchId = [currentUser.uid, matchUser.uid].sort().join("_");
    location.href = `matches.html?open=${matchId}`;
  };

  celebrationIcebreakers.querySelectorAll(".icebreaker-pill").forEach(pill => {
    pill.onclick = async () => {
      const text = decodeURIComponent(pill.dataset.starter);
      const matchId = [currentUser.uid, matchUser.uid].sort().join("_");
      
      // Save opener directly in Firestore subcollection messages
      try {
        const msgRef = doc(collection(db, "chats", matchId, "messages"));
        await setDoc(msgRef, {
          senderId: currentUser.uid,
          text,
          createdAt: serverTimestamp(),
          read: false
        });
        
        // Also update match preview doc
        await updateDoc(doc(db, "matches", matchId), {
          lastMessage: text,
          lastMessageAt: serverTimestamp()
        });

      } catch (err) {
        console.error("Opener send failed:", err);
      }

      location.href = `matches.html?open=${matchId}`;
    };
  });
}

// ─────────────────────────────────────────
// HISTORY DRAWER (FROM WORKSPACE BASE)
// ─────────────────────────────────────────
const historyBtn = document.getElementById("historyBtn");
const histDrawer = document.getElementById("histDrawer");
const histBackdrop = document.getElementById("histBackdrop");
const histClose = document.getElementById("histClose");
const histBody = document.getElementById("histBody");

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

if (historyBtn) historyBtn.onclick = openHistory;
if (histClose) histClose.onclick = closeHistory;
if (histBackdrop) histBackdrop.onclick = closeHistory;

document.querySelectorAll(".hist-tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".hist-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    histActiveTab = tab.dataset.tab;
    loadHistoryTab(histActiveTab);
  };
});

async function loadHistoryTab(tab) {
  if (!currentUser) return;
  
  // Render memory state immediately for fast feedback
  const list = tab === "liked" ? likedLane : passedLane;
  renderHistoryRows(list, tab);
}

function renderHistoryRows(list, tab) {
  if (!list.length) {
    const msg = tab === "liked" ? "No liked profiles yet." : "No passed profiles yet.";
    const icon = tab === "liked" ? "❤️" : "✕";
    histBody.innerHTML = `<div class="hist-empty"><span class="hist-empty-icon">${icon}</span><span>${msg}</span></div>`;
    return;
  }

  histBody.innerHTML = list.map((item, i) => `
    <div class="hist-user-row" data-uid="${item.uid}">
      <img class="hist-avatar" src="${item.data.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+'}">
      <div class="hist-info">
        <div class="hist-name">${item.data.name}, ${item.data.age}</div>
        <div class="hist-meta">${item.data.course} • ${item.data.campus}</div>
      </div>
      <div class="hist-actions">
        <button class="hist-action-btn ${tab === 'liked' ? 'like-btn active-like' : 'like-btn'}" data-uid="${item.uid}" title="Like">❤️</button>
        <button class="hist-action-btn ${tab === 'passed' ? 'pass-btn active-pass' : 'pass-btn'}" data-uid="${item.uid}" title="Pass">✕</button>
      </div>
    </div>
    ${i < list.length - 1 ? `<div class="hist-divider"></div>` : ""}
  `).join("");

  // Click row -> detailed profile
  histBody.querySelectorAll(".hist-user-row").forEach(row => {
    row.onclick = (e) => {
      if (e.target.closest(".hist-action-btn")) return;
      const uid = row.dataset.uid;
      const item = list.find(e => e.uid === uid);
      if (item) showProfileModal(item.data, uid);
    };
  });

  // Action toggles (changing mind in history)
  histBody.querySelectorAll(".like-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      closeHistory();
      if (tab === "liked") {
        // Unlike -> pull back
        await pullFromLiked(uid);
      } else {
        // Move passed -> liked
        const idx = passedLane.findIndex(item => item.uid === uid);
        if (idx !== -1) {
          const entry = passedLane.splice(idx, 1)[0];
          passedUids.delete(uid);
          await registerLike(uid, entry.data, false);
          try {
            await deleteDoc(doc(db, "passes", `${currentUser.uid}_${uid}`));
          } catch (_) {}
          renderSwiperDeck();
        }
      }
    };
  });

  histBody.querySelectorAll(".pass-btn").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const uid = btn.dataset.uid;
      closeHistory();
      if (tab === "passed") {
        // Unpass -> pull back
        await pullFromPassed(uid);
      } else {
        // Move liked -> passed
        const idx = likedLane.findIndex(item => item.uid === uid);
        if (idx !== -1) {
          const entry = likedLane.splice(idx, 1)[0];
          likedUids.delete(uid);
          await registerPass(uid, entry.data);
          try {
            await deleteDoc(doc(db, "likes", `${currentUser.uid}_${uid}`));
            const matchId = [currentUser.uid, uid].sort().join("_");
            await deleteDoc(doc(db, "matches", matchId)).catch(() => {});
          } catch (_) {}
          renderSwiperDeck();
        }
      }
    };
  });
}

function updateCarouselCountBadges() {
  // Arrow buttons updating on mobile if drawer is present
  const passedBadge = document.getElementById("passedBadge");
  const likedBadge = document.getElementById("likedBadge");
  if (passedBadge) passedBadge.textContent = passedLane.length;
  if (likedBadge) likedBadge.textContent = likedLane.length;
}

// ─────────────────────────────────────────
// UI GENERAL HELPERS
// ─────────────────────────────────────────
function showEmpty(title, msg, btnText, btnAction) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${msg}</p>
      <button id="emptyBtn">${btnText}</button>
    </div>`;
  const btn = document.getElementById("emptyBtn");
  if (btn) btn.onclick = btnAction;
  disableControls();
}

function showSideToast(msg, color) {
  const existing = document.querySelector(".side-toast");
  if (existing) existing.remove();
  
  const t = document.createElement("div");
  t.className = "side-toast";
  t.style.setProperty("--toast-color", color === "green" ? "var(--like-color)" : color === "blue" ? "var(--primary)" : "var(--nope-color)");
  t.textContent = msg;
  
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 350);
  }, 2500);
}

function showUndoNotification(undoCallback) {
  const existing = document.querySelector(".undo-notification");
  if (existing) existing.remove();
  
  const n = document.createElement("div");
  n.className = "undo-notification";
  n.innerHTML = `<span>Profile passed.</span><button class="undo-btn">Undo</button>`;
  
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
    if (!clicked && n.parentNode) {
      n.classList.remove("show");
      setTimeout(() => n.remove(), 300);
    }
  }, 3500);
}