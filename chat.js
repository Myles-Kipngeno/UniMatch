import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔑 matchId
const matchId = new URLSearchParams(window.location.search).get("matchId");

// DOM
const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const chatName = document.getElementById("chatName");
const onlineStatus = document.getElementById("onlineStatus");
const typingStatus = document.getElementById("typingStatus");

onAuthStateChanged(auth, async (user) => {
  if (!user || !matchId) {
    window.location.href = "dashboard.html";
    return;
  }

  // 🟢 Online
  await updateDoc(doc(db, "users", user.uid), { online: true });

  window.addEventListener("beforeunload", async () => {
    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp(),
      typing: false
    });
  });

  // 🔍 Get other user
  const matchSnap = await getDoc(doc(db, "matches", matchId));
  const otherUserId = matchSnap.data().users.find(id => id !== user.uid);

  // 👤 User status + typing
  onSnapshot(doc(db, "users", otherUserId), (snap) => {
    const data = snap.data();
    chatName.textContent = data.name || "Chat";
    onlineStatus.textContent = data.online ? "🟢 Online" : "⚪ Offline";
    typingStatus.textContent = data.typing ? "…typing" : "";
  });

  // 💬 Messages
  const messagesRef = collection(db, "chats", matchId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");

      const isMine = msg.senderId === user.uid;
      div.className = `message ${isMine ? "sent" : "received"}`;
      div.textContent = msg.text;

      // ✓✓ Read receipt
      if (isMine && msg.read) {
        const tick = document.createElement("span");
        tick.textContent = " ✓✓";
        tick.style.fontSize = "12px";
        tick.style.opacity = "0.8";
        div.appendChild(tick);
      }

      // Mark read
      if (!isMine && !msg.read) {
        updateDoc(docSnap.ref, { read: true });
      }

      messagesDiv.appendChild(div);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });

  // ⌨️ Typing detection
  let typingTimeout;
  input.addEventListener("input", async () => {
    await updateDoc(doc(db, "users", user.uid), { typing: true });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(async () => {
      await updateDoc(doc(db, "users", user.uid), { typing: false });
    }, 800);
  });

  // ✉️ Send
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;

    await addDoc(messagesRef, {
      senderId: user.uid,
      text: input.value.trim(),
      createdAt: serverTimestamp(),
      read: false
    });

    await updateDoc(doc(db, "users", user.uid), { typing: false });
    input.value = "";
  });
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
