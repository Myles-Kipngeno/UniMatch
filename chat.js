import { auth, db, storage } from "./firebase.js";
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
  updateDoc,
  deleteDoc,
  getDocs
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔑 matchId
const matchId = new URLSearchParams(window.location.search).get("matchId");

// DOM
const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const chatName = document.getElementById("chatName");
const chatProfilePhoto = document.getElementById("chatProfilePhoto");
const onlineStatus = document.getElementById("onlineStatus");
const typingStatus = document.getElementById("typingStatus");
const emojiBtn = document.querySelector(".emoji-btn");
const emojiPicker = document.getElementById("emojiPicker");
const attachBtn = document.querySelector(".attach-btn");
const micBtn = document.querySelector(".mic-btn");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const moreBtn = document.getElementById("moreBtn");
const chatMenu = document.getElementById("chatMenu");
const clearChatBtn = document.getElementById("clearChatBtn");
const muteBtn = document.getElementById("muteBtn");
const viewProfileBtn = document.getElementById("viewProfileBtn");
const mediaBtn = document.getElementById("mediaBtn");
const unmatchBtn = document.getElementById("unmatchBtn");
const blockUserBtn = document.getElementById("blockUserBtn");
const menuOverlay = document.getElementById("menuOverlay");

// 📋 Three-Dot Menu Toggle - Set up immediately
if (moreBtn && chatMenu) {
  console.log('✅ Setting up three-dot menu');
  
  moreBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔘 Three-dot clicked!');
    
    const isOpen = chatMenu.style.display === 'block';
    console.log('Menu currently:', isOpen ? 'open' : 'closed');
    
    if (isOpen) {
      chatMenu.style.display = 'none';
      if (menuOverlay) menuOverlay.style.display = 'none';
    } else {
      chatMenu.style.display = 'block';
      if (menuOverlay) menuOverlay.style.display = 'block';
    }
  });
  
  console.log('✓ Three-dot menu handler attached');
} else {
  console.error('❌ moreBtn or chatMenu not found!');
  console.error('moreBtn:', moreBtn);
  console.error('chatMenu:', chatMenu);
}
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
  chatName.textContent = otherUser.name || "User";
  
  // Set profile photo
  if (chatProfilePhoto && otherUser.photoURL) {
    chatProfilePhoto.src = otherUser.photoURL;
  }
  
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

  // 💬 Message Context Menu
  const messageContextMenu = document.getElementById("messageContextMenu");
  let currentMessageId = null;
  let currentMessageData = null;
  let lastOpenMessageId = null;

  function showMessageMenu(messageId, messageData, isMine, buttonElement, onClose) {
    console.log('showMessageMenu called:', { messageId, isMine, lastOpen: lastOpenMessageId });
    
    currentMessageId = messageId;
    currentMessageData = messageData;
    
    if (!messageContextMenu) {
      console.error('messageContextMenu element not found!');
      return;
    }
    
    // Toggle off if clicking the same message button again
    if (messageContextMenu.style.display === 'block' && lastOpenMessageId === messageId) {
      console.log('✓ Toggling menu off - clicked same button');
      messageContextMenu.style.display = 'none';
      lastOpenMessageId = null;
      if (onClose) onClose(); // Call callback when closing
      return;
    }
    
    try {
      // Position menu near the message
      const messageElement = buttonElement.closest('.message');
      if (!messageElement) {
        console.error('Could not find parent message element');
        return;
      }
      
      const buttonRect = messageElement.getBoundingClientRect();
      
      if (isMine) {
        // Sent message - show on left
        messageContextMenu.style.right = `${window.innerWidth - buttonRect.left + 10}px`;
        messageContextMenu.style.left = 'auto';
      } else {
        // Received message - show on right  
        messageContextMenu.style.left = `${buttonRect.right + 10}px`;
        messageContextMenu.style.right = 'auto';
      }
      
      // Calculate menu height (approximate)
      const estimatedMenuHeight = 280; // reactions + 3 menu items
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      
      // Position menu - flip upward if not enough space below
      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        // Position above the message
        messageContextMenu.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`;
        messageContextMenu.style.top = 'auto';
      } else {
        // Position below the message (default)
        messageContextMenu.style.top = `${buttonRect.top + window.scrollY}px`;
        messageContextMenu.style.bottom = 'auto';
      }
      
      openMenu(messageContextMenu);
      lastOpenMessageId = messageId;
      
      // Store the onClose callback for when menu closes
      messageContextMenu._onClose = onClose;
      
      console.log('✓ Menu displayed for message:', messageId);
      
      // Only show delete button for own messages
      const deleteBtn = messageContextMenu.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.style.display = isMine ? 'flex' : 'none';
      }
      
    } catch (err) {
      console.error('Error showing message menu:', err);
    }
  }

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
      div.className = `message ${isMine ? "sent" : "received"}${msg.deleted ? " deleted" : ""}`;
      div.dataset.messageId = docSnap.id;
      
      // Hover management - arrow appears/disappears instantly
      let hideMenuTimeout;
      let isMenuOpen = false;
      
      div.addEventListener('mouseenter', () => {
        // Don't show arrow button in select mode
        if (selectMode) return;
        
        clearTimeout(hideMenuTimeout);
        div.classList.add('show-menu');
      });
      
      div.addEventListener('mouseleave', () => {
        // Don't manage arrow button in select mode
        if (selectMode) return;
        
        // Hide immediately when leaving message (unless menu is open)
        hideMenuTimeout = setTimeout(() => {
          if (!isMenuOpen) {
            div.classList.remove('show-menu');
          }
        }, 100); // Small delay to allow moving to the button
      });
      
      // Message context menu button (for all messages)
      if (!msg.deleted) {
        const menuBtn = document.createElement("button");
        menuBtn.className = "message-menu-btn";
        menuBtn.title = "Message options";
        menuBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        
        // Keep arrow visible when hovering over button itself
        menuBtn.addEventListener('mouseenter', () => {
          clearTimeout(hideMenuTimeout);
          div.classList.add('show-menu');
        });
        
        menuBtn.addEventListener('mouseleave', () => {
          // Hide immediately when leaving button (unless menu is open)
          hideMenuTimeout = setTimeout(() => {
            if (!isMenuOpen) {
              div.classList.remove('show-menu');
            }
          }, 100);
        });
        
        menuBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log('Menu button clicked!', {
            messageId: docSnap.id,
            isMine: isMine,
            messageData: msg
          });
          
          // Keep arrow visible while menu is open
          isMenuOpen = true;
          clearTimeout(hideMenuTimeout);
          div.classList.add('show-menu');
          
          showMessageMenu(docSnap.id, msg, isMine, menuBtn, () => {
            // Callback when menu closes
            isMenuOpen = false;
            div.classList.remove('show-menu');
          });
        };
        
        div.appendChild(menuBtn);
        console.log('Menu button added to message:', docSnap.id);
      }
      
      // Reply preview inside bubble - MUST come before text
      if (msg.replyTo && !msg.deleted) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply-preview';
        const replyName = msg.replyTo.senderId === user.uid ? 'You' : otherUser?.name || 'Them';
        const replyText = msg.replyTo.text || '📷 Photo' || '🎤 Voice message';
        replyDiv.innerHTML = `
          <div class="reply-preview-name">${replyName}</div>
          <div class="reply-preview-text">${replyText}</div>
        `;
        div.appendChild(replyDiv);
      }

      // Image message
      if (msg.imageUrl && !msg.deleted) {
        const img = document.createElement("img");
        img.src = msg.imageUrl;
        img.className = "message-image";
        img.alt = "Image";
        img.onclick = (e) => {
          // In select mode, clicking image should select the message, not open it
          if (selectMode) {
            e.stopPropagation();
            const msgEl = img.closest('.message');
            if (msgEl) {
              msgEl.click(); // Trigger message selection
            }
          } else {
            // Normal mode - open image in beautiful modal viewer
            e.stopPropagation();
            openImageViewer(msg.imageUrl);
          }
        };
        div.appendChild(img);
      }
      
      // Voice message
      else if (msg.voiceUrl && !msg.deleted) {
        const audioContainer = document.createElement("div");
        audioContainer.className = "voice-message";
        
        const audio = document.createElement("audio");
        audio.src = msg.voiceUrl;
        audio.controls = true;
        audio.className = "voice-player";
        
        audioContainer.appendChild(audio);
        div.appendChild(audioContainer);
      }
      
      // Text message or deleted message
      else if (msg.text || msg.deleted) {
        const textSpan = document.createElement("span");
        textSpan.className = "message-text";
        textSpan.textContent = msg.deleted ? "🚫 This message was deleted" : msg.text;
        div.appendChild(textSpan);
      }

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

      // Render reactions below bubble
      if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        // Count each emoji
        const counts = {};
        Object.values(msg.reactions).forEach(emoji => {
          counts[emoji] = (counts[emoji] || 0) + 1;
        });

        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';

        Object.entries(counts).forEach(([emoji, count]) => {
          const pill = document.createElement('button');
          pill.className = 'reaction-pill';
          
          // Highlight if current user reacted with this emoji
          const myReaction = msg.reactions[user.uid];
          if (myReaction === emoji) pill.classList.add('mine');
          
          pill.innerHTML = `<span class="reaction-emoji">${emoji}</span>${count > 1 ? `<span class="reaction-count">${count}</span>` : ''}`;
          
          // Click to toggle reaction
          pill.onclick = async (e) => {
            e.stopPropagation();
            try {
              const msgRef = doc(db, `chats/${matchId}/messages`, docSnap.id);
              const msgSnap = await getDoc(msgRef);
              const existing = msgSnap.data()?.reactions || {};
              if (existing[user.uid] === emoji) {
                delete existing[user.uid];
              } else {
                existing[user.uid] = emoji;
              }
              await updateDoc(msgRef, { reactions: existing });
            } catch (err) {
              console.error('Error toggling reaction:', err);
            }
          };
          
          reactionsDiv.appendChild(pill);
        });

        div.appendChild(reactionsDiv);
      }

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

  // ⌨️ Typing indicator and show/hide send button
  let typingTimeout;
  const imageBtn = document.querySelector('.image-btn');
  
  input.addEventListener("input", async () => {
    const hasText = input.value.trim().length > 0;
    
    // Toggle send button vs mic+gallery buttons
    if (hasText) {
      sendBtn.style.display = "flex";
      micBtn.style.display = "none";
      if (imageBtn) imageBtn.style.display = "none";
    } else {
      sendBtn.style.display = "none";
      micBtn.style.display = "flex";
      if (imageBtn) imageBtn.style.display = "flex";
    }
    
    // Typing indicator
    if (hasText) {
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

      const messageData = {
        senderId: user.uid,
        text: text,
        createdAt: serverTimestamp(),
        read: false
      };

      // Attach reply info if replying
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text || '📷 Image',
          senderId: replyingTo.senderId
        };
        cancelReplyMode();
      }

      await addDoc(messagesRef, messageData);

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

  // 😊 Emoji button - opens compact picker like the + button
  if (emojiBtn) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Toggle off if already open
      if (reactionPicker && reactionPicker.style.display === 'flex' && reactionPicker.dataset.mode === 'input') {
        closeAllMenus();
        return;
      }
      openInputEmojiPicker();
    });
  }

  function openInputEmojiPicker() {
    if (!reactionPicker) return;
    reactionPicker.dataset.mode = 'input';
    buildInputEmojiGrid(ALL_EMOJIS);
    reactionPicker.style.position = 'fixed';
    reactionPicker.style.bottom = '70px';
    reactionPicker.style.left = '12px';
    reactionPicker.style.top = 'auto';
    reactionPicker.style.transform = 'none';
    openMenu(reactionPicker);
    if (reactionSearch) reactionSearch.value = '';
    setTimeout(() => reactionSearch && reactionSearch.focus(), 50);
  }

  function buildInputEmojiGrid(emojis) {
    if (!reactionPickerGrid) return;
    reactionPickerGrid.innerHTML = '';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'reaction-pick-btn';
      btn.textContent = emoji;
      btn.onclick = (e) => {
        e.stopPropagation();
        const inp = document.getElementById('messageInput');
        if (inp) {
          const pos = inp.selectionStart || inp.value.length;
          const before = inp.value.slice(0, pos);
          const after = inp.value.slice(pos);
          
          // Insert emoji
          inp.value = before + emoji + after;
          
          // Set cursor position after the emoji (handle multi-character emojis correctly)
          const newPos = before.length + emoji.length;
          inp.selectionStart = inp.selectionEnd = newPos;
          
          inp.focus();
          inp.dispatchEvent(new Event('input'));
        }
      };
      reactionPickerGrid.appendChild(btn);
    });
  }

  // 📎 Attach button (opens image picker)
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      if (imageInput) {
        imageInput.click();
      }
    });
  }

  // 📸 Image upload - supports multiple images
  if (imageInput) {
    imageInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      console.log(`📸 Uploading ${files.length} image(s)...`);

      // Validate all files first
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          alert(`${file.name} is too large! Maximum size is 25MB per image.`);
          imageInput.value = "";
          return;
        }

        if (!file.type.startsWith('image/')) {
          alert(`${file.name} is not an image file.`);
          imageInput.value = "";
          return;
        }
      }

      // Show upload progress indicator
      const uploadingIndicator = document.createElement('div');
      uploadingIndicator.className = 'uploading-indicator';
      uploadingIndicator.innerHTML = `
        <div class="uploading-content">
          <div class="spinner"></div>
          <span>Uploading ${files.length} image(s)...</span>
        </div>
      `;
      messagesDiv.appendChild(uploadingIndicator);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      try {
        // Upload all images in parallel
        const uploadPromises = files.map(async (file, index) => {
          console.log(`📤 Uploading ${index + 1}/${files.length}: ${file.name}`);
          
          const timestamp = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileName = `chat-images/${matchId}/${timestamp}_${index}_${sanitizedFileName}`;
          
          const storageRef = ref(storage, fileName);
          const uploadResult = await uploadBytes(storageRef, file);
          const imageUrl = await getDownloadURL(uploadResult.ref);
          
          // Send each image as a separate message
          await addDoc(messagesRef, {
            senderId: user.uid,
            imageUrl: imageUrl,
            createdAt: serverTimestamp(),
            read: false
          });
          
          console.log(`✅ Image ${index + 1}/${files.length} sent`);
        });

        await Promise.all(uploadPromises);
        
        console.log("✅ All images uploaded successfully!");
        uploadingIndicator.remove();
        
      } catch (err) {
        console.error("❌ Image upload error:", err);
        uploadingIndicator.remove();
        
        if (err.code === 'storage/unauthorized') {
          alert("Permission denied. Please check Firebase Storage rules.");
        } else {
          alert(`Failed to send image(s): ${err.message}`);
        }
      }
      
      // Reset input
      imageInput.value = "";
    });
  }

  // =============================
  // MENU SYSTEM - setup after element declarations below
  // =============================
  const menuOverlay = document.getElementById('menuOverlay');

  function closeAllMenus() {
    const cm = document.getElementById('chatMenu');
    if (cm) cm.style.display = 'none';
    
    // Call onClose callback if menu is closing
    if (messageContextMenu && messageContextMenu.style.display === 'block') {
      if (messageContextMenu._onClose) {
        messageContextMenu._onClose();
        messageContextMenu._onClose = null;
      }
    }
    
    if (messageContextMenu) messageContextMenu.style.display = 'none';
    if (menuOverlay) menuOverlay.style.display = 'none';
    const rp = document.getElementById('reactionPicker');
    if (rp) rp.style.display = 'none';
    lastOpenMessageId = null;
  }

  function openMenu(menuEl) {
    if (menuOverlay) menuOverlay.style.display = 'block';
    menuEl.style.display = 'block';
  }

  // Clicking the overlay closes everything
  if (menuOverlay) {
    menuOverlay.addEventListener('click', function() {
      closeAllMenus();
    });
  }

  // ===== REACTION EMOJI PICKER - must be before menu handler =====
  const reactionPicker = document.getElementById('reactionPicker');
  const reactionPickerGrid = document.getElementById('reactionPickerGrid');
  const reactionSearch = document.getElementById('reactionSearch');

  const ALL_EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳',
    '😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤',
    '😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫',
    '🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵',
    '🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','💀','☠️',
    '👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️',
    '👋','🤚','🖐️','✋','🖖','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '💘','💝','🌟','⭐','🌙','☀️','🌈','⚡','🔥','💧','🌊','🍀','🌸','🌺','🌻','🌹',
    '🎉','🎊','🎈','🎁','🎀','🎂','🍰','🧁','🍭','🍬','🍫','🍩','🍪','🍦',
    '🐶','🐱','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
    '👏','🙌','🤝','🙏','🤜','🤛','👊','✊',
    '💯','✨','💫','💥','🎯','🏆','🥇','🎖️',
    '😂','💀','🗿','👀','🫶','🤡','💩','👑','💎','🚀','🌍','🎸','🎵','🎶'
  ];

  function buildReactionGrid(emojis) {
    if (!reactionPickerGrid) return;
    reactionPickerGrid.innerHTML = '';
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'reaction-pick-btn';
      btn.textContent = emoji;
      btn.onclick = async (e) => {
        e.stopPropagation();
        await saveReaction(currentMessageId, emoji);
        closeAllMenus();
      };
      reactionPickerGrid.appendChild(btn);
    });
  }

  function openReactionPicker() {
    if (!reactionPicker) return;
    reactionPicker.dataset.mode = 'reaction';
    buildReactionGrid(ALL_EMOJIS);
    reactionPicker.style.position = 'fixed';
    reactionPicker.style.top = '50%';
    reactionPicker.style.left = '50%';
    reactionPicker.style.transform = 'translate(-50%, -50%)';
    reactionPicker.style.bottom = 'auto';
    reactionPicker.style.display = 'flex';
    if (reactionSearch) reactionSearch.value = '';
    setTimeout(() => reactionSearch && reactionSearch.focus(), 50);
  }

  if (reactionPicker) {
    reactionPicker.addEventListener('click', e => e.stopPropagation());
    reactionPicker.addEventListener('mousedown', e => e.stopPropagation());
  }

  if (reactionSearch) {
    reactionSearch.addEventListener('input', () => {
      const q = reactionSearch.value.trim().toLowerCase();
      const isInputMode = reactionPicker?.dataset.mode === 'input';
      const rebuild = isInputMode ? buildInputEmojiGrid : buildReactionGrid;
      if (!q) { rebuild(ALL_EMOJIS); return; }
      const KEYWORDS = {
        'heart':['❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💗','💖','🥰','😍'],
        'laugh':['😂','🤣','😆','😅'], 'cry':['😢','😭','🥺'],
        'fire':['🔥'], 'star':['⭐','🌟','✨','💫'], 'thumbs':['👍','👎'],
        'happy':['😀','😃','😄','😁','😊','😇'], 'sad':['😞','😔','😢','😭'],
        'angry':['😠','😡','🤬','😤'], 'love':['❤️','🥰','😍','😘','💕','💖'],
        'wow':['😮','😲','🤯','😱'], 'cool':['😎','🥸','🤩'],
        'party':['🎉','🎊','🎈','🥳','🎂'], 'clap':['👏'], 'pray':['🙏'],
        'muscle':['💪'], 'sleep':['😴','🥱'], 'think':['🤔','🧐'],
        'ghost':['👻'], 'skull':['💀','☠️'], 'poop':['💩'], 'crown':['👑'],
        'gem':['💎'], 'rocket':['🚀'], 'celebrate':['🎉','🎊','🥳','🏆'],
        'animal':['🐶','🐱','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷'],
        'sun':['☀️'], 'moon':['🌙'], 'music':['🎵','🎶','🎸'],
        'food':['🎂','🍰','🧁','🍭','🍩','🍪','🍕','🍔'],
      };
      let matched = new Set();
      Object.entries(KEYWORDS).forEach(([kw, emojis]) => {
        if (kw.includes(q)) emojis.forEach(e => matched.add(e));
      });
      rebuild(matched.size ? [...matched] : ALL_EMOJIS.slice(0, 48));
    });
  }

  // Handle message menu actions
  if (messageContextMenu) {
    console.log('Setting up message context menu handlers...');
    
    // Quick reactions
    const reactionBtns = messageContextMenu.querySelectorAll('.reaction-btn');
    
    reactionBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const emoji = btn.dataset.emoji;
        
        if (emoji && currentMessageId) {
          // Regular emoji reaction - save and close everything
          await saveReaction(currentMessageId, emoji);
          closeAllMenus();
        } else if (!emoji) {
          // + button - hide context menu but keep overlay, show reaction picker
          messageContextMenu.style.display = 'none';
          openReactionPicker();
        }
      });
    });

    // Menu actions
    const menuItems = messageContextMenu.querySelectorAll('.context-menu-item');
    console.log('Found menu items:', menuItems.length);
    
    menuItems.forEach(item => {
      const action = item.dataset.action;
      console.log('Setting up handler for action:', action);
      
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        console.log('Menu item clicked:', action);
        
        switch(action) {
          case 'reply':
            activateReply(currentMessageId, currentMessageData);
            break;
            
          case 'select':
            activateSelectMode(currentMessageId);
            break;
            
          case 'delete':
            if (!confirm('Delete this message for everyone?')) break;
            try {
              const messageRef = doc(db, `chats/${matchId}/messages`, currentMessageId);
              await updateDoc(messageRef, {
                deleted: true,
                deletedAt: serverTimestamp()
              });
            } catch (err) {
              console.error('Error deleting message:', err);
              alert('Failed to delete message. Please try again.');
            }
            break;
        }
        
        closeAllMenus();
        lastOpenMessageId = null;
      });
    });
  }

  // ===== REACTION HELPERS =====
  async function saveReaction(messageId, emoji) {
    try {
      const msgRef = doc(db, `chats/${matchId}/messages`, messageId);
      const msgSnap = await getDoc(msgRef);
      const existing = msgSnap.data()?.reactions || {};
      if (existing[user.uid] === emoji) {
        delete existing[user.uid];
      } else {
        existing[user.uid] = emoji;
      }
      await updateDoc(msgRef, { reactions: existing });
    } catch (err) {
      console.error('Error saving reaction:', err);
    }
  }

  if (reactionPicker) {
    reactionPicker.addEventListener('click', e => e.stopPropagation());
    reactionPicker.addEventListener('mousedown', e => e.stopPropagation());
  }

  // Category tabs for reaction picker
  const reactionCatBtns = document.querySelectorAll('.reaction-cat');
  const EMOJI_CAT_MAP = {
    recent: [],
    smileys: ALL_EMOJIS.slice(0, 100),
    gestures: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🙏','👏','🙌','🤝','🤜','🤛','👊','✊'],
    animals: ['🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦉','🐺','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐎','🐖','🐏','🦙','🐐','🦌','🐕','🐈','🐓','🦜','🕊️','🐇'],
    food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🍍','🥝','🍅','🍆','🥑','🥦','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🥞','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🍤','🍙','🍚','🍘','🍥','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🍯','🥛','☕','🍵','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🥄','🍴','🍽️','🥢'],
    activities: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🏒','🏏','⛳','🏹','🎣','🥊','🥋','🎽','🛹','⛸️','🥌','🎿','🏂','🏋️','🤸','🏌️','🏇','🧘','🏄','🏊','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎲','🎯','🎳','🎮','🎰','🧩'],
    travel: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚚','🚛','🚜','🚲','🛵','🏍️','🛺','🚠','🚃','🚋','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','✈️','🛫','🛬','🛩️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','🚢','⚓','🚧','🚦','🚏','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','🏖️','🏝️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','⛩️'],
    symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','☮️','✝️','☪️','🕉️','☸️','✡️','🕎','☯️','🛐','⛎','⚛️','☢️','☣️','🆚','💮','🉐','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','💹','❇️','✳️','❎','🌐','💠','💤','🏧','🚾','♿','🅿️','🚹','🚺','🚼','🚻','🚮','🎦','📶','🔣','ℹ️','🔤','🔡','🔠','🆗','🆙','🆒','🆕','🆓','▶️','⏸️','⏺️','⏭️','⏮️','⏩','⏪','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','🔀','🔁','🔄','🎵','🎶','➕','➖','➗','✖️','💲','💱','™️','©️','®️','✔️','☑️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','▪️','▫️','⬛','⬜','🔈','🔉','🔊','🔔','📣','💬','💭','♠️','♣️','♥️','♦️','🃏','🎴'],
    flags: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇧🇷','🇲🇽','🇦🇷','🇨🇳','🇯🇵','🇰🇷','🇮🇳','🇮🇩','🇹🇭','🇻🇳','🇵🇭','🇲🇾','🇸🇬','🇵🇰','🇦🇪','🇸🇦','🇹🇷','🇮🇱','🇪🇬','🇿🇦','🇰🇪','🇳🇬','🇷🇺','🇺🇦','🇵🇱','🇨🇿','🇬🇷','🇸🇪','🇳🇴','🇩🇰','🇮🇪','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇳🇿']
  };

  reactionCatBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = btn.dataset.category;
      reactionCatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const emojis = category === 'recent' ? 
        (EMOJI_CAT_MAP.recent.length ? EMOJI_CAT_MAP.recent : ALL_EMOJIS.slice(0, 48)) :
        EMOJI_CAT_MAP[category] || ALL_EMOJIS;
      
      const isInputMode = reactionPicker?.dataset.mode === 'input';
      if (isInputMode) {
        buildInputEmojiGrid(emojis);
      } else {
        buildReactionGrid(emojis);
      }
    });
  });

  const replyBar = document.getElementById('replyBar');
  const replyPreviewText = document.getElementById('replyPreviewText');
  const cancelReply = document.getElementById('cancelReply');
  const messageInput = document.getElementById('messageInput');
  let replyingTo = null; // Stores message being replied to

  function activateReply(messageId, messageData) {
    replyingTo = { id: messageId, ...messageData };
    const preview = messageData.text || '📷 Image' || '🎤 Voice message';
    replyPreviewText.textContent = preview;
    replyBar.style.display = 'flex';
    messageInput.focus();
  }

  function cancelReplyMode() {
    replyingTo = null;
    replyBar.style.display = 'none';
    replyPreviewText.textContent = '';
  }

  if (cancelReply) {
    cancelReply.addEventListener('click', cancelReplyMode);
  }

  // ===== SELECT FEATURE =====
  const selectToolbar = document.getElementById('selectToolbar');
  const cancelSelect = document.getElementById('cancelSelect');
  const deleteSelected = document.getElementById('deleteSelected');
  const selectedCountEl = document.getElementById('selectedCount');
  let selectMode = false;
  let selectedMessages = new Set();

  function activateSelectMode(firstMessageId) {
    selectMode = true;
    selectedMessages.clear();
    selectedMessages.add(firstMessageId);

    // Show toolbar, hide input
    selectToolbar.style.display = 'flex';
    document.getElementById('chatForm').style.display = 'none';

    // Add checkboxes to all messages and hide arrow buttons
    document.querySelectorAll('.message').forEach(msgEl => {
      msgEl.classList.add('select-mode');
      msgEl.classList.remove('show-menu'); // Remove any visible arrow buttons
      const msgId = msgEl.dataset.messageId;

      // Add checkbox
      let checkbox = msgEl.querySelector('.select-checkbox');
      if (!checkbox) {
        checkbox = document.createElement('div');
        checkbox.className = 'select-checkbox';
        checkbox.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        msgEl.appendChild(checkbox);
      }

      // Pre-select the first message
      if (msgId === firstMessageId) {
        msgEl.classList.add('selected');
      }

      // Click to toggle selection
      msgEl.onclick = function() {
        if (!selectMode) return;
        if (selectedMessages.has(msgId)) {
          selectedMessages.delete(msgId);
          msgEl.classList.remove('selected');
        } else {
          selectedMessages.add(msgId);
          msgEl.classList.add('selected');
        }
        selectedCountEl.textContent = `${selectedMessages.size} selected`;
      };
    });

    selectedCountEl.textContent = `${selectedMessages.size} selected`;
  }

  function deactivateSelectMode() {
    selectMode = false;
    selectedMessages.clear();

    // Hide toolbar, show input
    selectToolbar.style.display = 'none';
    document.getElementById('chatForm').style.display = 'flex';

    // Remove checkboxes and classes from all messages
    document.querySelectorAll('.message').forEach(msgEl => {
      msgEl.classList.remove('select-mode', 'selected');
      msgEl.onclick = null;
      const cb = msgEl.querySelector('.select-checkbox');
      if (cb) cb.remove();
    });

    selectedCountEl.textContent = '0 selected';
  }

  if (cancelSelect) {
    cancelSelect.addEventListener('click', deactivateSelectMode);
  }

  if (deleteSelected) {
    deleteSelected.addEventListener('click', async () => {
      if (selectedMessages.size === 0) return;
      if (!confirm(`Delete ${selectedMessages.size} message(s) for everyone?`)) return;

      try {
        const deletePromises = [...selectedMessages].map(msgId => {
          const msgRef = doc(db, `chats/${matchId}/messages`, msgId);
          return updateDoc(msgRef, { deleted: true, deletedAt: serverTimestamp() });
        });
        await Promise.all(deletePromises);
        deactivateSelectMode();
      } catch (err) {
        console.error('Error deleting selected messages:', err);
        alert('Failed to delete messages. Please try again.');
      }
    });
  }

  // 🗑️ Clear chat
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete all messages in this chat? This cannot be undone.")) return;
      
      try {
        const snapshot = await getDocs(messagesRef);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        messagesDiv.innerHTML = '<div style="text-align: center; color: #999; padding: 20px; font-style: italic;">Chat cleared</div>';
        closeAllMenus();
        
        console.log("Chat cleared successfully");
      } catch (err) {
        console.error("Error clearing chat:", err);
        alert("Failed to clear chat. Please try again.");
      }
    });
  }

  // 🔇 Mute notifications
  if (muteBtn) {
    muteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        // Check if already muted
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        const mutedChats = userDoc.data()?.mutedChats || [];
        const isMuted = mutedChats.includes(matchId);
        
        if (isMuted) {
          // Unmute
          const updatedMuted = mutedChats.filter(id => id !== matchId);
          await updateDoc(userDocRef, { mutedChats: updatedMuted });
          muteBtn.querySelector('span').textContent = 'Mute Notifications';
          console.log("Chat unmuted");
        } else {
          // Mute
          await updateDoc(userDocRef, { 
            mutedChats: [...mutedChats, matchId] 
          });
          muteBtn.querySelector('span').textContent = 'Unmute Notifications';
          console.log("Chat muted");
        }
        
        closeAllMenus();
      } catch (err) {
        console.error("Error toggling mute:", err);
        alert("Failed to update notification settings.");
      }
    });
  }

  // 👤 View profile - Show modal like discover section
  if (viewProfileBtn) {
    viewProfileBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      
      if (otherUser) {
        // Increment profile view count
        try {
          const userRef = doc(db, "users", otherUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const currentViews = userSnap.data().profileViews || 0;
            await updateDoc(userRef, {
              profileViews: currentViews + 1
            });
            console.log("✅ Profile view counted for:", otherUser.uid, `(${currentViews} → ${currentViews + 1})`);
          }
        } catch (err) {
          console.error("❌ Could not update view count:", err);
        }
        
        // Show profile modal (like discover section)
        showProfileModal(otherUser, otherUser.uid);
      } else {
        alert('Unable to load profile. Please try again.');
      }
    });
  }

  // Profile Modal Function (from discover.js)
  async function showProfileModal(userData, userId) {
    // Remove existing modal if any
    const existing = document.querySelector('.profile-modal');
    if (existing) existing.remove();

    // Fetch user's photo posts
    let photoPosts = [];
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists() && userDoc.data().photoPosts) {
        photoPosts = userDoc.data().photoPosts || [];
      }
    } catch (err) {
      console.error("Error fetching photo posts:", err);
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    
    // Build photo gallery HTML
    let photosHTML = '';
    
    if (photoPosts.length === 0) {
      photosHTML = `
        <div class="no-photos">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
            <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No photos yet</p>
        </div>
      `;
    } else {
      photoPosts.forEach((photoUrl, index) => {
        photosHTML += `
          <div class="photo-item ${index === 0 ? 'active' : ''}">
            <img src="${photoUrl}" alt="${userData.name}'s photo">
          </div>
        `;
      });
    }

    const totalPhotos = photoPosts.length;

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        
        <div class="photo-gallery">
          ${totalPhotos > 1 ? `
            <button class="gallery-nav prev">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          ` : ''}
          
          <div class="photo-container">
            ${photosHTML}
          </div>
          
          ${totalPhotos > 1 ? `
            <button class="gallery-nav next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            
            <div class="photo-dots">
              ${photoPosts.map((_, i) => 
                `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
              ).join('')}
            </div>
          ` : ''}
        </div>
        
        <div class="profile-details">
          <h2>${userData.name}, ${userData.age || 'N/A'}</h2>
          
          <div class="detail-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 18c-4.478 0-8-2.015-8-4.5S5.522 9 10 9s8 2.015 8 4.5S14.478 18 10 18z" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>${userData.gender || 'Not specified'}</span>
          </div>
          
          <div class="detail-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C6.134 2 3 5.134 3 9c0 5.25 7 11 7 11s7-5.75 7-11c0-3.866-3.134-7-7-7z" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="10" cy="9" r="2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>${userData.campus || 'Campus not specified'}</span>
          </div>
          
          <div class="detail-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>${userData.course || 'Course not specified'}</span>
          </div>
          
          ${userData.bio ? `
            <div class="bio-section">
              <h3>About</h3>
              <p>${userData.bio}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);

    // Gallery navigation
    if (totalPhotos > 1) {
      let currentPhotoIndex = 0;
      const photoItems = modal.querySelectorAll('.photo-item');
      const dots = modal.querySelectorAll('.dot');
      const prevBtn = modal.querySelector('.gallery-nav.prev');
      const nextBtn = modal.querySelector('.gallery-nav.next');

      function showPhoto(index) {
        photoItems.forEach((item, i) => {
          item.classList.toggle('active', i === index);
        });
        dots.forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
        });
        currentPhotoIndex = index;
      }

      if (prevBtn) {
        prevBtn.onclick = () => {
          const newIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photoItems.length - 1;
          showPhoto(newIndex);
        };
      }

      if (nextBtn) {
        nextBtn.onclick = () => {
          const newIndex = currentPhotoIndex < photoItems.length - 1 ? currentPhotoIndex + 1 : 0;
          showPhoto(newIndex);
        };
      }

      dots.forEach((dot, index) => {
        dot.onclick = () => showPhoto(index);
      });
    }

    // Close modal handlers
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');

    function closeModal() {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }

    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;
  }

  // 🖼️ Media & Links
  if (mediaBtn) {
    mediaBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      await openMediaModal();
    });
  }

  // Media Modal Functions
  const mediaModal = document.getElementById('mediaModal');
  const closeMediaModal = document.getElementById('closeMediaModal');
  const mediaTabs = document.querySelectorAll('.media-tab');
  const mediaGrid = document.getElementById('mediaGrid');
  const linksList = document.getElementById('linksList');
  const docsList = document.getElementById('docsList');

  async function openMediaModal() {
    if (!mediaModal) return;
    
    // Load media content
    await loadMediaContent();
    
    mediaModal.style.display = 'flex';
  }

  async function loadMediaContent() {
    try {
      // Get all messages from this chat
      const messagesSnapshot = await getDocs(query(messagesRef, orderBy('createdAt', 'desc')));
      
      // Filter images
      const images = [];
      const links = [];
      
      messagesSnapshot.forEach(doc => {
        const msg = doc.data();
        
        // Collect images
        if (msg.imageUrl && !msg.deleted) {
          images.push({
            url: msg.imageUrl,
            date: msg.createdAt,
            sender: msg.senderId
          });
        }
        
        // Collect links from text messages
        if (msg.text && !msg.deleted) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const foundLinks = msg.text.match(urlRegex);
          if (foundLinks) {
            foundLinks.forEach(link => {
              links.push({
                url: link,
                text: msg.text,
                date: msg.createdAt,
                sender: msg.senderId
              });
            });
          }
        }
      });
      
      // Render media grid
      if (images.length > 0) {
        mediaGrid.innerHTML = images.map(img => `
          <div class="media-item" onclick="window.open('${img.url}', '_blank')">
            <img src="${img.url}" alt="Media">
            <div class="media-item-date">${formatTime(img.date)}</div>
          </div>
        `).join('');
      } else {
        mediaGrid.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <p>No media shared yet</p>
          </div>
        `;
      }
      
      // Render links list
      if (links.length > 0) {
        linksList.innerHTML = links.map(link => `
          <div class="link-item" onclick="window.open('${link.url}', '_blank')">
            <div class="link-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div class="link-info">
              <div class="link-title">${link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}</div>
              <div class="link-url">${formatTime(link.date)}</div>
            </div>
          </div>
        `).join('');
      } else {
        linksList.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            <p>No links shared yet</p>
          </div>
        `;
      }
      
      // Documents placeholder
      docsList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
            <path d="M13 2v7h7"/>
          </svg>
          <p>No documents shared yet</p>
        </div>
      `;
      
    } catch (err) {
      console.error('Error loading media:', err);
      mediaGrid.innerHTML = '<div class="empty-state"><p>Failed to load media</p></div>';
    }
  }

  // Close modal
  if (closeMediaModal) {
    closeMediaModal.addEventListener('click', () => {
      mediaModal.style.display = 'none';
    });
  }

  // Click outside to close
  if (mediaModal) {
    mediaModal.addEventListener('click', (e) => {
      if (e.target === mediaModal) {
        mediaModal.style.display = 'none';
      }
    });
  }

  // Tab switching
  mediaTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update active tab
      mediaTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      document.querySelectorAll('.media-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      if (tabName === 'media') {
        document.getElementById('mediaTabContent').classList.add('active');
      } else if (tabName === 'links') {
        document.getElementById('linksTabContent').classList.add('active');
      } else if (tabName === 'docs') {
        document.getElementById('docsTabContent').classList.add('active');
      }
    });
  });

  // ===== IMAGE VIEWER MODAL =====
  const imageViewerModal = document.getElementById('imageViewerModal');
  const viewerImage = document.getElementById('viewerImage');
  const imageViewerClose = document.querySelector('.image-viewer-close');
  const imageViewerDownload = document.querySelector('.image-viewer-download');
  const imageViewerOverlay = document.querySelector('.image-viewer-overlay');

  function openImageViewer(imageUrl) {
    if (!imageViewerModal || !viewerImage) return;
    
    viewerImage.src = imageUrl;
    imageViewerModal.style.display = 'flex';
    
    // Animate in
    setTimeout(() => {
      imageViewerModal.classList.add('show');
    }, 10);
    
    console.log('📸 Image viewer opened:', imageUrl);
  }

  function closeImageViewer() {
    if (!imageViewerModal) return;
    
    imageViewerModal.classList.remove('show');
    setTimeout(() => {
      imageViewerModal.style.display = 'none';
      viewerImage.src = '';
    }, 300);
  }

  // Close button
  if (imageViewerClose) {
    imageViewerClose.addEventListener('click', closeImageViewer);
  }

  // Click overlay to close
  if (imageViewerOverlay) {
    imageViewerOverlay.addEventListener('click', closeImageViewer);
  }

  // Download button
  if (imageViewerDownload) {
    imageViewerDownload.addEventListener('click', async () => {
      const imageUrl = viewerImage.src;
      if (!imageUrl) return;
      
      try {
        // Fetch the image
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('✅ Image downloaded');
      } catch (err) {
        console.error('❌ Download failed:', err);
        // Fallback - open in new tab
        window.open(imageUrl, '_blank');
      }
    });
  }

  // Keyboard shortcut - ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageViewerModal?.style.display === 'flex') {
      closeImageViewer();
    }
  });

  // 💔 Unmatch
  const unmatchBtn = document.getElementById("unmatchBtn");
  if (unmatchBtn) {
    unmatchBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Unmatch with ${otherUser?.name || 'this person'}? You won't be able to message each other anymore.`)) return;
      
      try {
        const matchRef = doc(db, "matches", matchId);
        await deleteDoc(matchRef);
        
        alert("You have been unmatched.");
        window.location.href = "/matches.html";
      } catch (err) {
        console.error("Error unmatching:", err);
        alert("Failed to unmatch. Please try again.");
      }
    });
  }

  // 🚫 Block user
  if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Block ${otherUser?.name || 'this user'}? They won't be able to contact you.`)) return;
      
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        const blockedUsers = userDoc.data()?.blockedUsers || [];
        
        if (!blockedUsers.includes(otherUser.uid)) {
          await updateDoc(userDocRef, {
            blockedUsers: [...blockedUsers, otherUser.uid]
          });
        }
        
        // Also delete the match
        const matchRef = doc(db, "matches", matchId);
        await deleteDoc(matchRef);
        
        alert("User has been blocked.");
        window.location.href = "/matches.html";
      } catch (err) {
        console.error("Error blocking user:", err);
        alert("Failed to block user. Please try again.");
      }
    });
  }

  // 🎤 Voice recording
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  if (micBtn) {
    micBtn.addEventListener("click", async () => {
      if (!isRecording) {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          
          mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
          };
          
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            
            // Upload audio to Firebase Storage
            try {
              const timestamp = Date.now();
              const fileName = `voice-messages/${matchId}/${timestamp}.webm`;
              const storageRef = ref(storage, fileName);
              
              await uploadBytes(storageRef, audioBlob);
              const audioUrl = await getDownloadURL(storageRef);
              
              // Send voice message
              await addDoc(messagesRef, {
                senderId: user.uid,
                voiceUrl: audioUrl,
                createdAt: serverTimestamp(),
                read: false
              });
              
              console.log("Voice message sent!");
            } catch (err) {
              console.error("Voice upload error:", err);
              alert("Failed to send voice message.");
            }
          };
          
          mediaRecorder.start();
          isRecording = true;
          micBtn.style.color = "#ff4d6d";
          micBtn.style.background = "rgba(255, 77, 109, 0.2)";
        } catch (err) {
          console.error("Microphone error:", err);
          alert("Please allow microphone access to send voice messages.");
        }
      } else {
        // Stop recording
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        micBtn.style.color = "";
        micBtn.style.background = "";
      }
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