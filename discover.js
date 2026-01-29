import { auth, db } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById("discoverContainer");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  container.innerHTML = "";

  const usersSnap = await getDocs(collection(db, "users"));

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const targetUserId = docSnap.id;

    if (targetUserId === user.uid || !data.profileComplete) continue;

    const from = user.uid;
    const to = targetUserId;

    const likeId = `${from}_${to}`;
    const reverseLikeId = `${to}_${from}`;
    const matchId = [from, to].sort().join("_");

    // 🔍 Check if already liked
    const likeSnap = await getDoc(doc(db, "likes", likeId));
    let alreadyLiked = likeSnap.exists();

    const card = document.createElement("div");
    card.className = "user-card";

    card.innerHTML = `
      <img src="${data.photoURL || 'default-avatar.png'}">
      <h3>${data.name}, ${data.age}</h3>
      <p>${data.campus}</p>
      <p>${data.course}</p>
      <button class="like-btn">
        ${alreadyLiked ? "💔 Unlike" : "❤️ Like"}
      </button>
    `;

    const likeBtn = card.querySelector(".like-btn");

    likeBtn.onclick = async () => {
      likeBtn.disabled = true;

      try {
        if (alreadyLiked) {
          // 💔 UNLIKE
          await deleteDoc(doc(db, "likes", likeId));
          alreadyLiked = false;
          likeBtn.textContent = "❤️ Like";
        } else {
          // ❤️ LIKE
          await setDoc(doc(db, "likes", likeId), {
            from,
            to,
            createdAt: serverTimestamp()
          });

          alreadyLiked = true;
          likeBtn.textContent = "💔 Unlike";

          // 🔁 Check reverse like
          const reverseSnap = await getDoc(
            doc(db, "likes", reverseLikeId)
          );

          if (reverseSnap.exists()) {
            const matchRef = doc(db, "matches", matchId);
            const matchSnap = await getDoc(matchRef);

            if (!matchSnap.exists()) {
              await setDoc(matchRef, {
                users: [from, to],
                createdAt: serverTimestamp()
              });

              alert(`🎉 It's a match with ${data.name}!`);
            }
          }
        }
      } catch (err) {
        console.error("Like error:", err);
      }

      likeBtn.disabled = false;
    };

    container.appendChild(card);
  }

  if (!container.innerHTML.trim()) {
    container.innerHTML = "<p>No students found yet 😢</p>";
  }
});
