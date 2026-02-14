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
const emojiBtn = document.querySelector(".emoji-btn");
const emojiPicker = document.getElementById("emojiPicker");
const imageBtn = document.querySelector(".image-btn");
const imageInput = document.getElementById("imageInput");
const sendBtn = document.getElementById("sendBtn");

// Format timestamp
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const hours = date.getHours();
  const mins = date.getMinutes();
  return `${hours % 12 || 12}:${mins.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !matchId) {
    alert("Invalid chat link!");
    window.location.href = "matches.html";
    return;
  }

  // Verify match exists and user is part of it
  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists() || !matchSnap.data().users.includes(user.uid)) {
    alert("You don't have access to this chat!");
    window.location.href = "matches.html";
    return;
  }

  // 🟢 Set user online
  await updateDoc(doc(db, "users", user.uid), { 
    online: true,
    typing: false 
  });

  // 🔴 Set offline on page close
  window.addEventListener("beforeunload", async () => {
    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp(),
      typing: false
    });
  });

  // 🔍 Get other user
  const otherUserId = matchSnap.data().users.find(id => id !== user.uid);
  const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
  const otherUser = otherUserSnap.data();

  // 👤 Display other user's info and status
  chatName.textContent = `💬 ${otherUser.name}`;
  
  // Real-time status updates
  onSnapshot(doc(db, "users", otherUserId), (snap) => {
    const data = snap.data();
    
    if (data.online) {
      onlineStatus.textContent = "🟢 Online";
      onlineStatus.style.color = "#4caf50";
    } else if (data.lastSeen) {
      onlineStatus.textContent = `Last seen ${formatTime(data.lastSeen)}`;
      onlineStatus.style.color = "#999";
    } else {
      onlineStatus.textContent = "⚪ Offline";
      onlineStatus.style.color = "#999";
    }
    
    if (data.typing) {
      typingStatus.textContent = "typing...";
      typingStatus.style.display = "block";
    } else {
      typingStatus.style.display = "none";
    }
  });

  // 💬 Real-time messages
  const messagesRef = collection(db, "chats", matchId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    let lastDate = null;

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      
      // Date separator
      if (msg.createdAt) {
        const msgDate = msg.createdAt.toDate().toDateString();
        if (msgDate !== lastDate) {
          const dateSep = document.createElement("div");
          dateSep.className = "date-separator";
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          
          if (msgDate === today) {
            dateSep.textContent = "Today";
          } else if (msgDate === yesterday) {
            dateSep.textContent = "Yesterday";
          } else {
            dateSep.textContent = new Date(msgDate).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
          }
          
          messagesDiv.appendChild(dateSep);
          lastDate = msgDate;
        }
      }

      const div = document.createElement("div");
      const isMine = msg.senderId === user.uid;
      div.className = `message ${isMine ? "sent" : "received"}`;
      
      // Message text
      const textSpan = document.createElement("span");
      textSpan.className = "message-text";
      textSpan.textContent = msg.text;
      div.appendChild(textSpan);

      // Timestamp and read status
      const metaSpan = document.createElement("span");
      metaSpan.className = "message-meta";
      
      if (msg.createdAt) {
        metaSpan.textContent = formatTime(msg.createdAt);
      }
      
      if (isMine && msg.read) {
        metaSpan.textContent += " ✓✓";
        metaSpan.style.color = "#4caf50";
      } else if (isMine) {
        metaSpan.textContent += " ✓";
      }
      
      div.appendChild(metaSpan);

      // Mark message as read if it's from other user
      if (!isMine && !msg.read) {
        updateDoc(docSnap.ref, { read: true });
      }

      messagesDiv.appendChild(div);
    });

    // Smooth scroll to bottom
    messagesDiv.scrollTo({
      top: messagesDiv.scrollHeight,
      behavior: 'smooth'
    });
  });

  // ⌨️ Typing indicator
  let typingTimeout;
  input.addEventListener("input", async () => {
    if (input.value.trim()) {
      await updateDoc(doc(db, "users", user.uid), { typing: true });
      
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(async () => {
        await updateDoc(doc(db, "users", user.uid), { typing: false });
      }, 1000);
    } else {
      await updateDoc(doc(db, "users", user.uid), { typing: false });
    }
  });

  // ✉️ Send message
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Disable send button temporarily
    sendBtn.disabled = true;

    try {
      console.log("Attempting to send message to matchId:", matchId);
      console.log("Message data:", {
        senderId: user.uid,
        text: text,
        createdAt: "serverTimestamp()",
        read: false
      });

      await addDoc(messagesRef, {
        senderId: user.uid,
        text: text,
        createdAt: serverTimestamp(),
        read: false
      });

      console.log("Message sent successfully!");

      await updateDoc(doc(db, "users", user.uid), { typing: false });
      input.value = "";
      
      // Haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (err) {
      console.error("Send error details:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      
      if (err.code === "permission-denied") {
        alert("Permission denied. Please check your Firestore security rules for the 'chats' collection.");
      } else {
        alert(`Failed to send message: ${err.message}`);
      }
    }

    sendBtn.disabled = false;
    input.focus();
  });

  // 😊 Emoji picker toggle
  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === "none" ? "block" : "none";
    });

    // Insert emoji when clicked
    const emojiItems = document.querySelectorAll(".emoji-item");
    emojiItems.forEach(item => {
      item.addEventListener("click", () => {
        input.value += item.textContent;
        input.focus();
        emojiPicker.style.display = "none";
      });
    });

    // Close emoji picker when clicking outside
    document.addEventListener("click", (e) => {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = "none";
      }
    });
  }

  // 📸 Image upload
  if (imageBtn && imageInput) {
    imageBtn.addEventListener("click", () => {
      imageInput.click();
    });

    imageInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // For now, just alert - you can implement Firebase Storage upload later
      alert("Image upload feature coming soon! 📸");
      
      // TODO: Upload image to Firebase Storage
      // const imageUrl = await uploadImage(file);
      // await addDoc(messagesRef, {
      //   senderId: user.uid,
      //   imageUrl: imageUrl,
      //   createdAt: serverTimestamp(),
      //   read: false
      // });
    });
  }
});

// 👈 Swipe to go back (mobile)
let startX = 0;
document.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
});

document.addEventListener("touchend", e => {
  const endX = e.changedTouches[0].clientX;
  if (endX - startX > 100 && startX < 50) {
    history.back();
  }
});