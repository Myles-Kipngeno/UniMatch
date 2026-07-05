import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

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
const container           = document.getElementById("cardStack") || document.getElementById("discoverContainer");
const indicatorPass       = document.getElementById("indicatorPass") || document.getElementById("btnPass");
const indicatorLike       = document.getElementById("indicatorLike") || document.getElementById("btnLike");
const indicatorSuperLike  = document.getElementById("indicatorSuperLike") || document.getElementById("btnSuper");

// Filters elements
const filterCampus        = document.getElementById("filterCampus");
const filterCourse        = document.getElementById("filterCourse");
const filterYear          = document.getElementById("filterYear");
const filterPreference    = document.getElementById("filterPreference");
const applyFiltersBtn    = document.getElementById("applyFiltersBtn");
const resetFiltersBtn    = document.getElementById("resetFiltersBtn");

// Match Celebration Modal
const matchCelebrationOverlay = document.getElementById("matchCelebrationOverlay");
const celebrationMatchName    = document.getElementById("celebrationMatchName");
const celebrationViewerPhoto  = document.getElementById("celebrationViewerPhoto");
const celebrationTargetPhoto  = document.getElementById("celebrationTargetPhoto");
const celebrationChatBtn      = document.getElementById("celebrationChatBtn");
const celebrationCloseBtn     = document.getElementById("celebrationCloseBtn");

// State variables
let currentUser     = null;
let currentUserData = null;
let allUsers        = [];
let candidates      = [];
let likedUids       = new Set();
let passedUids      = new Set();

// Swipe gesture state
let startX = 0, startY = 0, currentX = 0, currentY = 0, isDragging = false;
let activeCardElement = null;

// BOOTSTRAP DISCOVERY
(async () => {
  try {
    currentUser = await requireAuth();
    if (container) {
      container.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Connecting to campus network...</p></div>`;
    }

    // Fetch user profile
    const { data: meProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (!meProfile || !meProfile.profile_complete) {
      showEmpty("Complete Your Profile", "Finish setting up your profile to start discovering connections.", "Complete Profile", () => location.href = "profile.html");
      return;
    }

    currentUserData = meProfile;

    if (currentUserData.preference && filterPreference) {
      filterPreference.value = currentUserData.preference;
    }

    // Fetch existing likes and passes
    const [likesRes, passesRes, usersRes] = await Promise.all([
      supabase.from("likes").select("to_user_id").eq("from_user_id", currentUser.id),
      supabase.from("passes").select("to_user_id").eq("from_user_id", currentUser.id),
      supabase.from("profiles").select("*").eq("profile_complete", true)
    ]);

    likedUids = new Set((likesRes.data || []).map(l => l.to_user_id));
    passedUids = new Set((passesRes.data || []).map(p => p.to_user_id));
    allUsers = (usersRes.data || []).map(u => ({ uid: u.id, ...u }));

    applyClientFiltering(true);
    setupFilters();
    setupKeyboardControls();

  } catch (err) {
    console.error("Discover boot error:", err);
    showEmpty("Connection Failed", "Unable to establish database connection.", "Retry", () => location.reload());
  }
})();

// FILTERING & DATA COMPILING
function applyClientFiltering(resetDeck = false) {
  const campusVal = filterCampus ? filterCampus.value.toLowerCase().trim() : "";
  const courseVal = filterCourse ? filterCourse.value.toLowerCase().trim() : "";
  const yearVal   = filterYear ? filterYear.value : "";
  const prefVal   = filterPreference ? filterPreference.value : "all";

  candidates = allUsers.filter(u => {
    if (u.uid === currentUser.id) return false;
    if (likedUids.has(u.uid) || passedUids.has(u.uid)) return false;

    if (prefVal !== "all" && u.gender !== prefVal) return false;
    if (campusVal && (!u.campus || !u.campus.toLowerCase().includes(campusVal))) return false;
    if (courseVal && (!u.course || !u.course.toLowerCase().includes(courseVal))) return false;
    if (yearVal && u.year_of_study !== yearVal) return false;

    return true;
  });

  candidates.forEach(c => {
    c._compatibility = calculateCompatibility(currentUserData, c);
  });
  candidates.sort((a, b) => b._compatibility - a._compatibility);

  renderSwiperDeck();
}

function calculateCompatibility(me, target) {
  let score = 35;
  if (me.campus && target.campus && me.campus.toLowerCase().trim() === target.campus.toLowerCase().trim()) {
    score += 30;
  }
  if (me.course && target.course && me.course.toLowerCase().trim() === target.course.toLowerCase().trim()) {
    score += 15;
  }
  const myInterests = me.interests || [];
  const targetInterests = target.interests || [];
  const commonInterests = targetInterests.filter(i => myInterests.includes(i));
  score += Math.min(commonInterests.length * 10, 40);

  return Math.min(score, 99);
}

function getPersonalityType(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PERSONALITIES[Math.abs(hash) % PERSONALITIES.length];
}

// SWIPER DECK RENDER & GESTURES
function renderSwiperDeck() {
  if (!container) return;
  container.innerHTML = "";

  if (candidates.length === 0) {
    showEmptyDeck();
    return;
  }

  const cardsToRender = candidates.slice(0, 3);
  cardsToRender.forEach((user, index) => {
    const card = buildCardElement(user, index);
    container.appendChild(card);
    if (index === 0) bindSwipeGestures(card);
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
  if (btn) btn.onclick = () => resetAllFilters();
}

function buildCardElement(user, index) {
  const card = document.createElement("div");
  card.className = "user-card";

  if (index === 0) card.classList.add("active-card");
  else if (index === 1) card.classList.add("next-card");
  else if (index === 2) card.classList.add("third-card");
  else card.classList.add("hidden-card");

  const myPers = getPersonalityType(user.uid);
  const interestsList = user.interests || [];

  card.innerHTML = `
    <div class="stamp stamp-like">Like</div>
    <div class="stamp stamp-nope">Nope</div>
    <div class="stamp stamp-super">Super</div>

    <img src="${user.photo_url || DEFAULT_AVATAR}" alt="${user.name}" onerror="this.src='${DEFAULT_AVATAR}'">

    <div class="card-info">
      <div class="card-title-row">
        <span class="card-name">${user.name}</span>
        <span class="card-age">${user.age || ''}</span>
        <span class="card-compat-badge">${user._compatibility}% Match</span>
      </div>

      <div class="card-meta-row">
        <div class="card-meta-item"><span>🎓 ${user.course || 'Student'} (${user.year_of_study ? user.year_of_study + ' Year' : 'Undergrad'})</span></div>
        <div class="card-meta-item"><span>📍 ${user.campus || 'Main Campus'}</span></div>
      </div>

      <p class="card-bio">${user.bio || "No campus bio updated yet."}</p>

      <div class="card-interests">
        ${interestsList.slice(0, 3).map(interest => {
          const isShared = (currentUserData?.interests || []).includes(interest);
          const matchItem = CURATED_INTERESTS.find(i => i.name === interest);
          const emoji = matchItem ? matchItem.emoji : "✨";
          return `<span class="card-interest-pill ${isShared ? 'shared-interest' : ''}"><span>${emoji}</span><span>${interest}</span></span>`;
        }).join("")}
      </div>
    </div>
  `;

  card._uid = user.uid;
  card._data = user;
  return card;
}

// SWIPE GESTURE BINDING
function bindSwipeGestures(card) {
  activeCardElement = card;

  const onPointerDown = (e) => {
    isDragging = true;
    startX = e.clientX || (e.touches && e.touches[0].clientX);
    startY = e.clientY || (e.touches && e.touches[0].clientY);
    card.style.transition = "none";
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    currentX = clientX - startX;
    currentY = clientY - startY;

    const rotate = currentX * 0.08;
    card.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(${rotate}deg)`;

    const stampLike = card.querySelector(".stamp-like");
    const stampNope = card.querySelector(".stamp-nope");
    const stampSuper = card.querySelector(".stamp-super");

    if (currentX > 50 && stampLike) {
      stampLike.style.opacity = Math.min(currentX / 150, 1);
      if (stampNope) stampNope.style.opacity = 0;
    } else if (currentX < -50 && stampNope) {
      stampNope.style.opacity = Math.min(Math.abs(currentX) / 150, 1);
      if (stampLike) stampLike.style.opacity = 0;
    } else if (currentY < -50 && stampSuper) {
      stampSuper.style.opacity = Math.min(Math.abs(currentY) / 150, 1);
    }
  };

  const onPointerUp = () => {
    if (!isDragging) return;
    isDragging = false;
    card.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    const threshold = window.innerWidth * 0.25;
    if (currentX > threshold) swipeAction("right");
    else if (currentX < -threshold) swipeAction("left");
    else if (currentY < -threshold) swipeAction("up");
    else {
      card.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
      card.querySelectorAll(".stamp").forEach(s => s.style.opacity = 0);
    }
  };

  card.addEventListener("mousedown", onPointerDown);
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);

  card.addEventListener("touchstart", onPointerDown, { passive: true });
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("touchend", onPointerUp, { passive: true });
}

// EXECUTE SWIPE ACTION
async function swipeAction(direction) {
  const card = activeCardElement;
  if (!card) return;

  const uid = card._uid;
  const uData = card._data;

  let targetTransform = "";
  if (direction === "right") targetTransform = `translate3d(${window.innerWidth + 200}px, ${currentY}px, 0) rotate(45deg)`;
  else if (direction === "left") targetTransform = `translate3d(${-window.innerWidth - 200}px, ${currentY}px, 0) rotate(-45deg)`;
  else if (direction === "up") targetTransform = `translate3d(${currentX}px, ${-window.innerHeight - 200}px, 0) rotate(0deg)`;

  card.style.transform = targetTransform;
  card.style.opacity = 0;

  candidates.shift();

  setTimeout(async () => {
    card.remove();
    if (direction === "right") await registerLike(uid, uData, false);
    else if (direction === "left") registerPass(uid, uData);
    else if (direction === "up") await registerLike(uid, uData, true);

    renderSwiperDeck();
  }, 250);
}

// SUPABASE FIRESTORE EQUIVALENTS FOR LIKES & PASSES
async function registerLike(targetUid, targetData, isSuperLike = false) {
  likedUids.add(targetUid);
  try {
    const { error } = await supabase.from("likes").insert({
      from_user_id: currentUser.id,
      to_user_id: targetUid,
      is_super_like: isSuperLike
    });

    if (error) console.error("Register like error:", error);

    // Check if match was created by PostgreSQL trigger
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
      .or(`user1_id.eq.${targetUid},user2_id.eq.${targetUid}`)
      .single();

    if (match && matchCelebrationOverlay) {
      if (celebrationMatchName) celebrationMatchName.textContent = targetData.name;
      if (celebrationViewerPhoto) celebrationViewerPhoto.src = currentUserData.photo_url || DEFAULT_AVATAR;
      if (celebrationTargetPhoto) celebrationTargetPhoto.src = targetData.photo_url || DEFAULT_AVATAR;

      matchCelebrationOverlay.classList.add("active");
      if (celebrationChatBtn) celebrationChatBtn.onclick = () => location.href = `matches.html?matchId=${match.id}`;
      if (celebrationCloseBtn) celebrationCloseBtn.onclick = () => matchCelebrationOverlay.classList.remove("active");
    }
  } catch (err) {
    console.error("Like action error:", err);
  }
}

async function registerPass(targetUid, targetData) {
  passedUids.add(targetUid);
  try {
    await supabase.from("passes").insert({
      from_user_id: currentUser.id,
      to_user_id: targetUid
    });
  } catch (err) {
    console.error("Pass action error:", err);
  }
}

// BUTTON CONTROLS
const btnPassEl  = document.getElementById("btnPass")  || indicatorPass;
const btnLikeEl  = document.getElementById("btnLike")  || indicatorLike;
const btnSuperEl = document.getElementById("btnSuper") || indicatorSuperLike;

if (btnPassEl)  btnPassEl.onclick  = () => buttonSwipe("left");
if (btnLikeEl)  btnLikeEl.onclick  = () => buttonSwipe("right");
if (btnSuperEl) btnSuperEl.onclick = () => buttonSwipe("up");

function buttonSwipe(direction) {
  const card = container.querySelector(".active-card");
  if (!card) return;
  activeCardElement = card;
  swipeAction(direction);
}

function setupKeyboardControls() {
  document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT") return;
    if (e.key === "ArrowRight") buttonSwipe("right");
    else if (e.key === "ArrowLeft") buttonSwipe("left");
    else if (e.key === "ArrowUp") buttonSwipe("up");
  });
}

function setupFilters() {
  if (applyFiltersBtn) applyFiltersBtn.onclick = () => applyClientFiltering();
  if (resetFiltersBtn) resetFiltersBtn.onclick = () => resetAllFilters();
}

function resetAllFilters() {
  if (filterCampus) filterCampus.value = "";
  if (filterCourse) filterCourse.value = "";
  if (filterYear) filterYear.value = "";
  if (filterPreference) filterPreference.value = "all";
  applyClientFiltering(true);
}

function showEmpty(title, msg, btnText, btnAction) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${msg}</p>
      <button id="emptyBtn">${btnText}</button>
    </div>`;
  const btn = document.getElementById("emptyBtn");
  if (btn) btn.onclick = btnAction;
}