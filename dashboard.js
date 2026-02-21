import { auth, db } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, getDoc,
  collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAuth } from "./auth-guard.js";

// DOM Elements
const welcomeName     = document.getElementById("welcomeName");
const profileSummary  = document.getElementById("profileSummary");
const profilePhoto    = document.getElementById("profilePhoto");
const chatCard        = document.getElementById("chatCard");
const matchesCard     = document.getElementById("matchesCard");
const uploadPhotoCard = document.getElementById("uploadPhotoCard");
const matchCountBadge = document.getElementById("matchCount");
const editProfileBtn  = document.getElementById("editProfileBtn");
const matchesList     = document.getElementById("matchesList");
const likesSentList   = document.getElementById("likesSentList");
const likesReceivedList = document.getElementById("likesReceivedList");
const profileViewsEl  = document.getElementById("profileViews");
const likesReceivedEl = document.getElementById("likesReceived");
const totalMatchesEl  = document.getElementById("totalMatches");

// ─────────────────────────────────────────
// BOOT — resolves ONCE, never re-fires
// ─────────────────────────────────────────
(async () => {
  try {
    // Waits for Firebase Auth to fully initialize.
    // Unsubscribes immediately after first resolution — no repeat firing.
    const user = await requireAuth();
    const uid  = user.uid;

    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists() || !snap.data().profileComplete) {
      window.location.replace("profile.html");
      return;
    }

    const data = snap.data();

    // Greeting
    const hour     = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    if (welcomeName)    welcomeName.textContent    = `${greeting}, ${data.name} 👋`;
    if (profileSummary) profileSummary.textContent = `${data.gender}, ${data.age} • ${data.campus} — ${data.course}`;
    if (profilePhoto && data.photoURL) profilePhoto.src = data.photoURL;

    // Start real-time listeners (these are fine — they're Firestore listeners, not auth)
    listenForMatches(uid);
    listenForLikesSent(uid);
    listenForLikesReceived(uid);
    updateStats(uid);

  } catch (err) {
    console.error("Dashboard boot error:", err);
    window.location.replace("login.html");
  }
})();

// ─────────────────────────────────────────
// REAL-TIME MATCHES
// ─────────────────────────────────────────
function listenForMatches(uid) {
  if (!matchesList) return;
  const q = query(collection(db, "matches"), where("users", "array-contains", uid));

  onSnapshot(q, async snap => {
    matchesList.innerHTML = "";
    if (matchCountBadge) matchCountBadge.textContent = snap.size > 0 ? `(${snap.size})` : "";

    if (snap.empty) {
      matchesList.innerHTML = "<p>No matches yet 💔</p>";
      return;
    }

    for (const matchDoc of snap.docs) {
      const users    = matchDoc.data().users;
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
      div.querySelector("button").onclick = () =>
        window.location.href = `chat.html?matchId=${matchDoc.id}`;
      matchesList.appendChild(div);
    }
  });
}

// ─────────────────────────────────────────
// REAL-TIME LIKES SENT
// ─────────────────────────────────────────
function listenForLikesSent(uid) {
  if (!likesSentList) return;
  const q = query(collection(db, "likes"), where("from", "==", uid));

  onSnapshot(q, snap => {
    likesSentList.innerHTML = "";
    snap.forEach(docSnap => {
      const div = document.createElement("div");
      div.className   = "like-card";
      div.textContent = `You liked ${docSnap.data().to}`;
      likesSentList.appendChild(div);
    });
  });
}

// ─────────────────────────────────────────
// REAL-TIME LIKES RECEIVED
// ─────────────────────────────────────────
function listenForLikesReceived(uid) {
  if (!likesReceivedList) return;
  const q = query(collection(db, "likes"), where("to", "==", uid));

  onSnapshot(q, snap => {
    likesReceivedList.innerHTML = "";
    snap.forEach(docSnap => {
      const div = document.createElement("div");
      div.className   = "like-card";
      div.textContent = `${docSnap.data().from} liked you`;
      likesReceivedList.appendChild(div);
    });
  });
}

// ─────────────────────────────────────────
// STATS (real-time counters)
// ─────────────────────────────────────────
function updateStats(uid) {
  const animatePop = (el) => {
    if (!el) return;
    el.style.animation = "none";
    setTimeout(() => { el.style.animation = "popIn 0.3s ease"; }, 10);
  };

  // Likes received
  onSnapshot(
    query(collection(db, "likes"), where("to", "==", uid)),
    snap => {
      if (likesReceivedEl) { likesReceivedEl.textContent = snap.size; animatePop(likesReceivedEl); }
    }
  );

  // Total matches
  onSnapshot(
    query(collection(db, "matches"), where("users", "array-contains", uid)),
    snap => {
      if (totalMatchesEl) { totalMatchesEl.textContent = snap.size; animatePop(totalMatchesEl); }
    }
  );

  // Profile views
  onSnapshot(doc(db, "users", uid), snap => {
    if (!profileViewsEl) return;
    profileViewsEl.textContent = snap.exists() ? (snap.data().profileViews || 0) : "0";
    animatePop(profileViewsEl);
  });
}

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
if (chatCard)        chatCard.onclick        = () => window.location.href = "matches.html";
if (matchesCard)     matchesCard.onclick     = () => window.location.href = "matches.html";
if (uploadPhotoCard) uploadPhotoCard.onclick = () => window.location.href = "upload-photos.html";
if (editProfileBtn)  editProfileBtn.onclick  = () => window.location.href = "profile.html?edit=true";

// Sign out
const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("login.html");
  });
}

// ─────────────────────────────────────────
// SWIPE DETECTION (mobile)
// ─────────────────────────────────────────
let startX = 0, endX = 0;
document.addEventListener("touchstart", e => { startX = e.touches[0].clientX; });
document.addEventListener("touchend",   e => {
  endX = e.changedTouches[0].clientX;
  const diff = startX - endX;
  if (diff >  80) { document.body.classList.add("slide-left");  setTimeout(() => window.location.href = "discover.html", 300); }
  if (diff < -80) { document.body.classList.add("slide-right"); setTimeout(() => window.location.href = "matches.html",  300); }
});