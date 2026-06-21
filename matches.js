import { auth, db } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";
import {
  collection, query, where,
  onSnapshot, getDoc, getDocs, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const matchesContainer   = document.getElementById("matchesContainer");
const noMatchesContainer = document.getElementById("noMatchesContainer");
const loadingContainer   = document.getElementById("loadingContainer");

requireAuth().then((user) => {

  const q = query(
    collection(db, "matches"),
    where("users", "array-contains", user.uid)
  );

  onSnapshot(q, async (snapshot) => {
    if (loadingContainer) loadingContainer.style.display = "none";

    if (snapshot.empty) {
      matchesContainer.innerHTML = "";
      if (noMatchesContainer) noMatchesContainer.style.display = "flex";
      return;
    }

    if (noMatchesContainer) noMatchesContainer.style.display = "none";
    matchesContainer.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const match   = docSnap.data();
      const matchId = docSnap.id;
      const otherUid = match.users.find(id => id !== user.uid);

      try {
        const otherSnap = await getDoc(doc(db, "users", otherUid));
        if (!otherSnap.exists()) continue;
        const other = otherSnap.data();

        // ── DUAL STRATEGY for unread count ──
        // 1. Try unreadCounts field on match doc (set by chat.js patch)
        // 2. Fallback: count unread messages directly from chats subcollection
        let unreadCount = 0;

        const storedCount = match.unreadCounts?.[user.uid];

        if (typeof storedCount === "number") {
          // Strategy 1: use stored count
          unreadCount = storedCount;
        } else {
          // Strategy 2: count messages sent by other user that aren't read
          try {
            const msgsSnap = await getDocs(
              query(
                collection(db, "chats", matchId, "messages"),
                where("senderId", "==", otherUid),
                where("read", "==", false)
              )
            );
            unreadCount = msgsSnap.size;
          } catch (_) {}
        }

        // Build card
        const card = document.createElement("div");
        card.className = "match-card";

        // Badge HTML — injected as a real element so we can force styles
        const badgeHTML = unreadCount > 0
          ? `<div class="card-badge" style="
               position:absolute;
               top:-10px;
               right:-10px;
               min-width:26px;
               height:26px;
               padding:0 7px;
               border-radius:50px;
               background:linear-gradient(135deg,#f093fb,#f5576c);
               color:#fff;
               font-size:13px;
               font-weight:700;
               display:flex;
               align-items:center;
               justify-content:center;
               box-shadow:0 2px 10px rgba(245,87,108,0.6);
               border:2px solid white;
               z-index:999;
             ">${unreadCount}</div>`
          : "";

        card.innerHTML = `
          ${badgeHTML}
          <img src="${other.photoURL || './assets/images/default-avatar.png'}" alt="${other.name}">
          <h3>${other.name}, ${other.age}</h3>
          <p>📍 ${other.campus}</p>
          <p>📚 ${other.course}</p>
          <button onclick="location.href='chat.html?matchId=${matchId}'">
            💬 Start Chat
          </button>`;

        matchesContainer.appendChild(card);

      } catch (err) {
        console.error("Error loading match:", err);
      }
    }
  });
});