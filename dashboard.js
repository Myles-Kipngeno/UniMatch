import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const welcomeName = document.getElementById("welcomeName");
const profileSummary = document.getElementById("profileSummary");
const profilePhoto = document.getElementById("profilePhoto");
const chatCard = document.getElementById("chatCard");
const matchesCard = document.getElementById("matchesCard");
const uploadPhotoCard = document.getElementById("uploadPhotoCard");
const matchCountBadge = document.getElementById("matchCount");
const editProfileBtn = document.getElementById("editProfileBtn");
const matchesList = document.getElementById("matchesList");
const likesSentList = document.getElementById("likesSentList");
const likesReceivedList = document.getElementById("likesReceivedList");

// Stat elements
const profileViewsEl = document.getElementById("profileViews");
const likesReceivedEl = document.getElementById("likesReceived");
const totalMatchesEl = document.getElementById("totalMatches");

// ===========================
// Auth + Load Dashboard
// ===========================
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const uid = user.uid;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists() || !snap.data().profileComplete) { window.location.href = "profile.html"; return; }
    const data = snap.data();

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    if (welcomeName) welcomeName.textContent = `${greeting}, ${data.name} 👋`;
    if (profileSummary) profileSummary.textContent = `${data.gender}, ${data.age} • ${data.campus} — ${data.course}`;
    if (profilePhoto && data.photoURL) profilePhoto.src = data.photoURL;

    // Start real-time listeners
    listenForMatches(uid);
    listenForLikesSent(uid);
    listenForLikesReceived(uid);
    updateStats(uid);

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
});

// ===========================
// Real-time Matches
// ===========================
function listenForMatches(uid) {
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(q, async snap => {
    matchesList.innerHTML = "";
    matchCountBadge.textContent = snap.size > 0 ? `(${snap.size})` : "";

    if (snap.empty) {
      matchesList.innerHTML = "<p>No matches yet 💔</p>";
      return;
    }

    for (const matchDoc of snap.docs) {
      const users = matchDoc.data().users;
      const otherUid = users.find(u => u !== uid);
      if (!otherUid) continue;

      const userSnap = await getDoc(doc(db, "users", otherUid));
      if (!userSnap.exists()) continue;
      const data = userSnap.data();

      const div = document.createElement("div");
      div.className = "match-card";
      div.innerHTML = `
        <img src="${data.photoURL || './assets/images/default-avatar.png'}">
        <h3>${data.name}</h3>
        <p>${data.campus}</p>
        <button>💬 Chat</button>
      `;
      div.querySelector("button").onclick = () => window.location.href = `chat.html?matchId=${matchDoc.id}`;
      matchesList.appendChild(div);
    }
  });
}


// ===========================
// Real-time Likes Sent
// ===========================
function listenForLikesSent(uid) {
  if (!likesSentList) return;
  const q = query(collection(db, "likes"), where("from", "==", uid));
  onSnapshot(q, snap => {
    likesSentList.innerHTML = "";
    snap.forEach(docSnap => {
      const div = document.createElement("div");
      div.className = "like-card";
      div.textContent = `You liked ${docSnap.data().to}`;
      likesSentList.appendChild(div);
    });
  });
}

// ===========================
// Real-time Likes Received
// ===========================
function listenForLikesReceived(uid) {
  if (!likesReceivedList) return;
  const q = query(collection(db, "likes"), where("to", "==", uid));
  onSnapshot(q, snap => {
    likesReceivedList.innerHTML = "";
    snap.forEach(docSnap => {
      const div = document.createElement("div");
      div.className = "like-card";
      div.textContent = `${docSnap.data().from} liked you`;
      likesReceivedList.appendChild(div);
    });
  });
}

// ===========================
// Update Stats Dashboard
// ===========================
function updateStats(uid) {
  // Listen for likes received (real-time)
  const likesQuery = query(collection(db, "likes"), where("to", "==", uid));
  onSnapshot(likesQuery, (snap) => {
    const likesCount = snap.size;
    if (likesReceivedEl) {
      likesReceivedEl.textContent = likesCount;
      // Animate number change
      likesReceivedEl.style.animation = 'none';
      setTimeout(() => {
        likesReceivedEl.style.animation = 'popIn 0.3s ease';
      }, 10);
    }
  });

  // Listen for total matches (real-time)
  const matchesQuery = query(collection(db, "matches"), where("users", "array-contains", uid));
  onSnapshot(matchesQuery, (snap) => {
    const matchesCount = snap.size;
    if (totalMatchesEl) {
      totalMatchesEl.textContent = matchesCount;
      // Animate number change
      totalMatchesEl.style.animation = 'none';
      setTimeout(() => {
        totalMatchesEl.style.animation = 'popIn 0.3s ease';
      }, 10);
    }
  });

  // Profile views - stored in user document
  const userDocRef = doc(db, "users", uid);
  onSnapshot(userDocRef, (snap) => {
    if (snap.exists() && profileViewsEl) {
      const views = snap.data().profileViews || 0;
      profileViewsEl.textContent = views;
      // Animate number change
      profileViewsEl.style.animation = 'none';
      setTimeout(() => {
        profileViewsEl.style.animation = 'popIn 0.3s ease';
      }, 10);
    }
  });
}

// ===========================
// Navigation
// ===========================
if (chatCard) chatCard.onclick = () => window.location.href = "matches.html";
if (matchesCard) matchesCard.onclick = () => window.location.href = "matches.html";
if (uploadPhotoCard) uploadPhotoCard.onclick = () => window.location.href = "upload-photos.html";
if (editProfileBtn) editProfileBtn.onclick = () => window.location.href = "profile.html?edit=true";

// ===========================
// Swipe Detection (Mobile)
// ===========================
let startX = 0, endX = 0;
document.addEventListener("touchstart", e => startX = e.touches[0].clientX);
document.addEventListener("touchend", e => { endX = e.changedTouches[0].clientX; handleSwipe(); });

function handleSwipe() {
  const diff = startX - endX;
  if (diff > 80) { document.body.classList.add("slide-left"); setTimeout(() => window.location.href = "discover.html", 300); }
  if (diff < -80) { document.body.classList.add("slide-right"); setTimeout(() => window.location.href = "matches.html", 300); }
}