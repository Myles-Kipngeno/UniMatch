import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const matchesContainer = document.getElementById("matchesContainer");
const noMatchesText = document.getElementById("noMatchesText");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const q = query(
    collection(db, "matches"),
    where("users", "array-contains", user.uid)
  );

  const matchesContainer = document.getElementById("matchesContainer");
const noMatchesContainer = document.getElementById("noMatchesContainer");
const loadingContainer = document.getElementById("loadingContainer");
const matchCountNumber = document.getElementById("matchCountNumber");
const totalMatchCount = document.getElementById("totalMatchCount");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const q = query(
    collection(db, "matches"),
    where("users", "array-contains", user.uid)
  );

  onSnapshot(q, async (snapshot) => {
    // Hide loading
    if (loadingContainer) {
      loadingContainer.style.display = "none";
    }

    if (snapshot.empty) {
      // Show empty state
      matchesContainer.innerHTML = "";
      if (noMatchesContainer) {
        noMatchesContainer.style.display = "flex";
      }
      if (totalMatchCount) {
        totalMatchCount.style.opacity = "0";
      }
      return;
    }

    // Hide empty state
    if (noMatchesContainer) {
      noMatchesContainer.style.display = "none";
    }

    // Update match count
    const matchCount = snapshot.size;
    if (matchCountNumber) {
      matchCountNumber.textContent = matchCount;
    }
    if (totalMatchCount) {
      totalMatchCount.style.opacity = "1";
    }

    matchesContainer.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const match = docSnap.data();
      const matchId = docSnap.id;
      const otherUserId = match.users.find(id => id !== user.uid);

      try {
        // Fetch the other user's profile
        const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
        
        if (otherUserSnap.exists()) {
          const otherUser = otherUserSnap.data();

          const div = document.createElement("div");
          div.className = "match-card";
          div.innerHTML = `
            <img src="${otherUser.photoURL || './assets/images/default-avatar.png'}" alt="${otherUser.name}">
            <h3>${otherUser.name}, ${otherUser.age}</h3>
            <p>📍 ${otherUser.campus}</p>
            <p>📚 ${otherUser.course}</p>
            <button onclick="location.href='chat.html?matchId=${matchId}'">
              💬 Start Chat
            </button>
          `;

          matchesContainer.appendChild(div);
        }
      } catch (err) {
        console.error("Error loading match:", err);
      }
    }
  });
});
});