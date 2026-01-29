import { auth, db } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById("matchesContainer");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  container.innerHTML = "";

  try {
    const q = query(
      collection(db, "matches"),
      where("users", "array-contains", user.uid)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = "<p>No matches yet 💔</p>";
      return;
    }

    for (const matchDoc of snap.docs) {
      const matchId = matchDoc.id;
      const users = matchDoc.data().users;

      const otherUserId = users.find(uid => uid !== user.uid);
      if (!otherUserId) continue;

      const userSnap = await getDoc(doc(db, "users", otherUserId));
      if (!userSnap.exists()) continue;

      const data = userSnap.data();

      const card = document.createElement("div");
      card.className = "match-card";

      card.innerHTML = `
        <img src="${data.photoURL || 'default-avatar.png'}">
        <h3>${data.name}</h3>
        <p>${data.campus}</p>
        <button>💬 Chat</button>
      `;

      card.querySelector("button").onclick = () => {
        window.location.href = `chat.html?matchId=${matchId}`;
      };

      container.appendChild(card);
    }

  } catch (err) {
    console.error("Error loading matches:", err);
    container.innerHTML = "<p>Error loading matches.</p>";
  }
});


let startX = 0;

document.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
});

document.addEventListener("touchend", e => {
  const endX = e.changedTouches[0].clientX;
  if (endX - startX > 90) {
    history.back(); // swipe right = go back
  }
});
