import { auth, db } from "./firebase.js";
import { onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===============================
// DOM elements
// ===============================
const welcomeName = document.getElementById("welcomeName");
const profileSummary = document.getElementById("profileSummary");
const profilePhoto = document.getElementById("profilePhoto");

const chatCard = document.getElementById("chatCard");
const matchesCard = document.getElementById("matchesCard");
const uploadPhotoCard = document.getElementById("uploadPhotoCard");

const matchCountBadge = document.getElementById("matchCount");
const editProfileBtn = document.getElementById("editProfileBtn");

// ===============================
// Load user data
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));

    // 🚨 Force profile completion
    if (!snap.exists() || !snap.data().profileComplete) {
      window.location.href = "profile.html";
      return;
    }

    const data = snap.data();

    // ⏰ Time-based greeting
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Good morning" :
      hour < 18 ? "Good afternoon" :
      "Good evening";

    welcomeName.textContent = `${greeting}, ${data.name} 👋`;

    // 🧾 Profile summary
    profileSummary.textContent = `
      ${data.gender}, ${data.age} • ${data.campus}
      — ${data.course}
    `;

    // 📸 Profile photo
    if (profilePhoto && data.photoURL) {
      profilePhoto.src = data.photoURL;
    }

    // ===============================
    // 🔔 REAL-TIME MATCH COUNT
    // ===============================
    const matchesQuery = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );

    onSnapshot(matchesQuery, (snap) => {
      if (!matchCountBadge) return;
      matchCountBadge.textContent = snap.size > 0 ? `(${snap.size})` : "";
    });

  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
});

// ===============================
// 💬 Chat navigation
// ===============================
if (chatCard) {
  chatCard.addEventListener("click", () => {
    window.location.href = "matches.html";
  });
}

// ===============================
// ❤️ Matches navigation
// ===============================
if (matchesCard) {
  matchesCard.addEventListener("click", () => {
    window.location.href = "matches.html";
  });
}

// ===============================
// 📸 Upload / Edit profile photo
// ===============================
if (uploadPhotoCard) {
  uploadPhotoCard.addEventListener("click", () => {
    window.location.href = "profile.html?edit=true";
  });
}

// ===============================
// ✏️ Edit profile button
// ===============================
if (editProfileBtn) {
  editProfileBtn.addEventListener("click", () => {
    window.location.href = "profile.html?edit=true";
  });
}

// ===============================
// 📱 Mobile swipe detection
// ===============================
let startX = 0;
let endX = 0;

document.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
});

document.addEventListener("touchend", () => {
  endX = event.changedTouches[0].clientX;
  handleSwipe();
});

function handleSwipe() {
  const diff = startX - endX;

  // Swipe LEFT → Discover
  if (diff > 80) {
    document.body.classList.add("slide-left");
    setTimeout(() => {
      window.location.href = "discover.html";
    }, 300);
  }

  // Swipe RIGHT → Matches
  if (diff < -80) {
    document.body.classList.add("slide-right");
    setTimeout(() => {
      window.location.href = "matches.html";
    }, 300);
  }
}
