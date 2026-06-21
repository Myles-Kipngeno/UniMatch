import { auth, db, storage } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";

import {
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  arrayUnion
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const matchId = new URLSearchParams(window.location.search).get("matchId");

const messagesDiv       = document.getElementById("messages");
const form              = document.getElementById("chatForm");
const input             = document.getElementById("messageInput");
const chatName          = document.getElementById("chatName");
const chatProfilePhoto  = document.getElementById("chatProfilePhoto");
const chatProfileInitials = document.getElementById("chatProfileInitials");
const onlineStatus      = document.getElementById("onlineStatus");
const typingStatus      = document.getElementById("typingStatus");
const emojiBtn          = document.querySelector(".emoji-btn");
const emojiPicker       = document.getElementById("emojiPicker");
const attachBtn         = document.querySelector(".attach-btn");
const micBtn            = document.querySelector(".mic-btn");
const sendBtn           = document.getElementById("sendBtn");
const imageInput        = document.getElementById("imageInput");
const fileInput         = document.getElementById("fileInput");
const moreBtn           = document.getElementById("moreBtn");
const chatMenu          = document.getElementById("chatMenu");
const clearChatBtn      = document.getElementById("clearChatBtn");
const muteBtn           = document.getElementById("muteBtn");
const viewProfileBtn    = document.getElementById("viewProfileBtn");
const mediaBtn          = document.getElementById("mediaBtn");
const unmatchBtn        = document.getElementById("unmatchBtn");
const blockUserBtn      = document.getElementById("blockUserBtn");
const menuOverlay       = document.getElementById("menuOverlay");

// ── Helpers ──
function isVid(url)  { return /\.(mp4|mov|webm|ogg|avi|mkv)(\?|$)/i.test(url); }
function isImg(url)  { return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url) || url.includes('chat-images'); }
function ext(name)   { return (name || '').split('.').pop().toLowerCase(); }

function fileIcon(filename) {
  const e = ext(filename);
  if (['pdf'].includes(e)) return '📄';
  if (['doc','docx'].includes(e)) return '📝';
  if (['xls','xlsx'].includes(e)) return '📊';
  if (['ppt','pptx'].includes(e)) return '📑';
  if (['zip','rar','7z'].includes(e)) return '🗜️';
  return '📎';
}

// ── Toast ──
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('chatToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Initials avatar ──
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function setAvatar(name, photoURL) {
  if (photoURL) {
    const img = document.getElementById('chatProfilePhoto');
    const ini = document.getElementById('chatProfileInitials');
    if (img) { img.src = photoURL; img.style.display = 'block'; }
    if (ini) ini.style.display = 'none';
  } else {
    const img = document.getElementById('chatProfilePhoto');
    const ini = document.getElementById('chatProfileInitials');
    if (img) img.style.display = 'none';
    if (ini) { ini.textContent = getInitials(name); ini.style.display = 'flex'; }
  }
}

// Three-Dot Menu
if (moreBtn && chatMenu) {
  moreBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    const isOpen = chatMenu.style.display === 'block';
    if (isOpen) {
      chatMenu.style.display = 'none';
      if (menuOverlay) menuOverlay.style.display = 'none';
    } else {
      chatMenu.style.display = 'block';
      if (menuOverlay) menuOverlay.style.display = 'block';
    }
  });
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

requireAuth().then(async (user) => {
  if (!matchId) {
    showToast("Invalid chat link!");
    window.location.href = "matches.html";
    return;
  }

  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists() || !matchSnap.data().users.includes(user.uid)) {
    showToast("You don't have access to this chat!");
    window.location.href = "matches.html";
    return;
  }

  // Clear unread count when user opens the chat
  try {
    await updateDoc(doc(db, "matches", matchId), {
      [`unreadCounts.${user.uid}`]: 0
    });
  } catch (_) {}

  // Set user online
  await updateDoc(doc(db, "users", user.uid), {
    online: true,
    typing: false
  });

  window.addEventListener("beforeunload", async () => {
    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp(),
      typing: false
    });
  });

  const otherUserId  = matchSnap.data().users.find(id => id !== user.uid);
  const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
  const otherUser    = otherUserSnap.data();

  chatName.textContent = otherUser.name || "User";
  setAvatar(otherUser.name, otherUser.photoURL);

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

  const messageContextMenu = document.getElementById("messageContextMenu");
  let currentMessageId   = null;
  let currentMessageData = null;
  let lastOpenMessageId  = null;

  function showMessageMenu(messageId, messageData, isMine, buttonElement, onClose) {
    currentMessageId   = messageId;
    currentMessageData = messageData;
    if (!messageContextMenu) return;
    if (messageContextMenu.style.display === 'block' && lastOpenMessageId === messageId) {
      messageContextMenu.style.display = 'none';
      lastOpenMessageId = null;
      if (onClose) onClose();
      return;
    }
    try {
      // Use the arrow button's own rect — not the message element
      const btnRect      = buttonElement.getBoundingClientRect();
      const menuWidth    = 270;
      const menuHeight   = 220; // quick-reactions + 3 items

      // Horizontal: place beside the button
      if (isMine) {
        // Sent messages — button is on the left of the bubble, menu goes further left
        const left = btnRect.left - menuWidth - 8;
        messageContextMenu.style.left  = `${Math.max(8, left)}px`;
        messageContextMenu.style.right = 'auto';
      } else {
        // Received messages — button is on the right of the bubble, menu goes further right
        const left = btnRect.right + 8;
        const capped = Math.min(left, window.innerWidth - menuWidth - 8);
        messageContextMenu.style.left  = `${capped}px`;
        messageContextMenu.style.right = 'auto';
      }

      // Vertical: align top of menu with the button, flip up if it would overflow
      const spaceBelow = window.innerHeight - btnRect.top;
      if (spaceBelow < menuHeight + 16) {
        // Not enough room below — anchor bottom of menu to button bottom
        messageContextMenu.style.top    = 'auto';
        messageContextMenu.style.bottom = `${window.innerHeight - btnRect.bottom}px`;
      } else {
        messageContextMenu.style.top    = `${btnRect.top}px`;
        messageContextMenu.style.bottom = 'auto';
      }

      openMenu(messageContextMenu);
      lastOpenMessageId = messageId;
      messageContextMenu._onClose = onClose;
      const deleteBtn = messageContextMenu.querySelector('[data-action="delete"]');
      if (deleteBtn) deleteBtn.style.display = isMine ? 'flex' : 'none';
    } catch (err) {
      console.error('Error showing message menu:', err);
    }
  }

  const messagesRef = collection(db, "chats", matchId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));

  // ── Use docChanges() so select mode isn't disrupted by real-time updates ──
  const renderedIds = new Set();

  onSnapshot(q, (snapshot) => {
    // On first load do a full render; after that use incremental updates
    if (renderedIds.size === 0) {
      messagesDiv.innerHTML = "";
    }

    let lastDate = null;
    // Rebuild date separators + any new messages on first load
    if (renderedIds.size === 0) {
      snapshot.forEach((docSnap) => {
        const msg = docSnap.data();
        appendDateSeparatorIfNeeded(msg, lastDate, (d) => { lastDate = d; });
        messagesDiv.appendChild(buildBubble(docSnap, msg, user, otherUser));
        renderedIds.add(docSnap.id);
      });
      messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
      return;
    }

    // Incremental: handle added / modified / removed
    snapshot.docChanges().forEach((change) => {
      const docSnap = change.doc;
      const msg     = docSnap.data();

      if (change.type === 'added' && !renderedIds.has(docSnap.id)) {
        messagesDiv.appendChild(buildBubble(docSnap, msg, user, otherUser));
        renderedIds.add(docSnap.id);
        messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
      }

      if (change.type === 'modified') {
        const existing = messagesDiv.querySelector(`[data-message-id="${docSnap.id}"]`);
        if (existing) {
          const replacement = buildBubble(docSnap, msg, user, otherUser);
          // Preserve select-mode state
          if (existing.classList.contains('selected')) replacement.classList.add('selected');
          if (existing.classList.contains('select-mode')) replacement.classList.add('select-mode');
          existing.replaceWith(replacement);
        }
      }

      if (change.type === 'removed') {
        const existing = messagesDiv.querySelector(`[data-message-id="${docSnap.id}"]`);
        if (existing) existing.remove();
        renderedIds.delete(docSnap.id);
      }
    });
  });

  function appendDateSeparatorIfNeeded(msg, lastDate, setLastDate) {
    if (!msg.createdAt) return;
    const msgDate = msg.createdAt.toDate().toDateString();
    if (msgDate !== lastDate) {
      const dateSep = document.createElement("div");
      dateSep.className = "date-separator";
      const today     = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (msgDate === today)           dateSep.textContent = "Today";
      else if (msgDate === yesterday)  dateSep.textContent = "Yesterday";
      else dateSep.textContent = new Date(msgDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      messagesDiv.appendChild(dateSep);
      setLastDate(msgDate);
    }
  }

  function buildBubble(docSnap, msg, user, otherUser) {
    const isMine  = msg.senderId === user.uid;
    const div     = document.createElement("div");
    div.className = `message ${isMine ? "sent" : "received"}${msg.deleted ? " deleted" : ""}`;
    div.dataset.messageId = docSnap.id;

    let hideMenuTimeout;
    let isMenuOpen = false;

    div.addEventListener('mouseenter', () => {
      if (selectMode) return;
      clearTimeout(hideMenuTimeout);
      div.classList.add('show-menu');
    });

    div.addEventListener('mouseleave', () => {
      if (selectMode) return;
      hideMenuTimeout = setTimeout(() => {
        if (!isMenuOpen) div.classList.remove('show-menu');
      }, 100);
    });

    if (!msg.deleted) {
      const menuBtn = document.createElement("button");
      menuBtn.className = "message-menu-btn";
      menuBtn.title     = "Message options";
      menuBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      menuBtn.addEventListener('mouseenter', () => { clearTimeout(hideMenuTimeout); div.classList.add('show-menu'); });
      menuBtn.addEventListener('mouseleave', () => {
        hideMenuTimeout = setTimeout(() => { if (!isMenuOpen) div.classList.remove('show-menu'); }, 100);
      });
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        isMenuOpen = true;
        clearTimeout(hideMenuTimeout);
        div.classList.add('show-menu');
        showMessageMenu(docSnap.id, msg, isMine, menuBtn, () => {
          isMenuOpen = false;
          div.classList.remove('show-menu');
        });
      };
      div.appendChild(menuBtn);
    }

    // Reply preview
    if (msg.replyTo && !msg.deleted) {
      const replyDiv  = document.createElement('div');
      replyDiv.className = 'reply-preview';
      const replyName = msg.replyTo.senderId === user.uid ? 'You' : otherUser?.name || 'Them';
      const replyText = msg.replyTo.text || (msg.replyTo.fileUrl ? '📎 File' : msg.replyTo.imageUrl ? '📷 Photo' : '📷 Media');
      replyDiv.innerHTML = `<div class="reply-preview-name">${replyName}</div>`;
      // Thumbnail in reply preview
      if (msg.replyTo.imageUrl || msg.replyTo.fileUrl) {
        const thumbUrl = msg.replyTo.imageUrl || msg.replyTo.fileUrl;
        if (isImg(thumbUrl) || isVid(thumbUrl)) {
          const thumb = document.createElement('img');
          thumb.src = thumbUrl;
          thumb.className = 'reply-preview-thumb';
          thumb.alt = '';
          replyDiv.appendChild(thumb);
        }
      }
      const textDiv = document.createElement('div');
      textDiv.className = 'reply-preview-text';
      textDiv.textContent = replyText;
      replyDiv.appendChild(textDiv);
      div.appendChild(replyDiv);
    }

    // ── Message content ──
    if (msg.deleted) {
      const textSpan = document.createElement("span");
      textSpan.className   = "message-text";
      textSpan.textContent = "🚫 This message was deleted";
      div.appendChild(textSpan);
    } else if (msg.imageUrl && isVid(msg.imageUrl)) {
      // Video message
      const wrap = document.createElement('div');
      wrap.className = 'message-video-wrap';
      const vid = document.createElement('video');
      vid.src = msg.imageUrl;
      vid.className = 'message-video-thumb';
      vid.preload = 'metadata';
      vid.muted = true;
      wrap.appendChild(vid);
      const overlay = document.createElement('div');
      overlay.className = 'video-play-overlay';
      overlay.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.25)"/><path d="M16 13l14 7-14 7V13z" fill="white"/></svg>`;
      wrap.appendChild(overlay);
      wrap.onclick = (e) => {
        if (selectMode) { e.stopPropagation(); div.click(); return; }
        e.stopPropagation();
        openMediaViewer(msg.imageUrl, 'video');
      };
      div.appendChild(wrap);
    } else if (msg.imageUrl) {
      // Image message
      const img = document.createElement("img");
      img.src   = msg.imageUrl;
      img.className = "message-image";
      img.alt   = "Image";
      img.onclick = (e) => {
        if (selectMode) { e.stopPropagation(); img.closest('.message')?.click(); }
        else { e.stopPropagation(); openMediaViewer(msg.imageUrl, 'image'); }
      };
      div.appendChild(img);
    } else if (msg.fileUrl) {
      // File message
      const link = document.createElement('a');
      link.href   = msg.fileUrl;
      link.target = '_blank';
      link.className = 'chat-file-bubble';
      link.innerHTML = `
        <div class="chat-file-icon">${fileIcon(msg.fileName)}</div>
        <div class="chat-file-info">
          <div class="chat-file-name">${msg.fileName || 'File'}</div>
          <div class="chat-file-meta">${msg.fileSize ? (msg.fileSize / 1024).toFixed(0) + ' KB' : 'Download'}</div>
        </div>`;
      link.onclick = (e) => { if (selectMode) { e.preventDefault(); e.stopPropagation(); div.click(); } };
      div.appendChild(link);
    } else if (msg.voiceUrl) {
      const audioContainer = document.createElement("div");
      audioContainer.className = "voice-message";
      const audio = document.createElement("audio");
      audio.src       = msg.voiceUrl;
      audio.controls  = true;
      audio.className = "voice-player";
      audioContainer.appendChild(audio);
      div.appendChild(audioContainer);
    } else if (msg.text) {
      const textSpan = document.createElement("span");
      textSpan.className   = "message-text";
      textSpan.textContent = msg.text;
      div.appendChild(textSpan);
    }

    // Meta (time + read receipt)
    const metaSpan = document.createElement("span");
    metaSpan.className = "message-meta";
    if (msg.createdAt) metaSpan.textContent = formatTime(msg.createdAt);
    if (isMine && msg.read) { metaSpan.textContent += " ✓✓"; metaSpan.style.color = "#4caf50"; }
    else if (isMine)          metaSpan.textContent += " ✓";
    div.appendChild(metaSpan);

    // Reactions
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
      const counts = {};
      Object.values(msg.reactions).forEach(emoji => { counts[emoji] = (counts[emoji] || 0) + 1; });
      const reactionsDiv = document.createElement('div');
      reactionsDiv.className = 'message-reactions';
      Object.entries(counts).forEach(([emoji, count]) => {
        const pill = document.createElement('button');
        pill.className = 'reaction-pill';
        if (msg.reactions[user.uid] === emoji) pill.classList.add('mine');
        pill.innerHTML = `<span class="reaction-emoji">${emoji}</span>${count > 1 ? `<span class="reaction-count">${count}</span>` : ''}`;
        pill.onclick = async (e) => {
          e.stopPropagation();
          try {
            const msgRef  = doc(db, `chats/${matchId}/messages`, docSnap.id);
            const msgSnap = await getDoc(msgRef);
            const existing = msgSnap.data()?.reactions || {};
            if (existing[user.uid] === emoji) delete existing[user.uid];
            else existing[user.uid] = emoji;
            await updateDoc(msgRef, { reactions: existing });
          } catch (err) { console.error('Error toggling reaction:', err); }
        };
        reactionsDiv.appendChild(pill);
      });
      div.appendChild(reactionsDiv);
    }

    // Mark as read
    if (!isMine && !msg.read) updateDoc(docSnap.ref, { read: true });

    return div;
  }

  let typingTimeout;
  const imageBtn = document.querySelector('.image-btn');

  input.addEventListener("input", async () => {
    const hasText = input.value.trim().length > 0;
    if (hasText) {
      sendBtn.style.display  = "flex";
      micBtn.style.display   = "none";
      if (imageBtn) imageBtn.style.display = "none";
    } else {
      sendBtn.style.display  = "none";
      micBtn.style.display   = "flex";
      if (imageBtn) imageBtn.style.display = "flex";
    }
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

  // ✉️ Send text message
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      const messageData = {
        senderId: user.uid,
        text:     text,
        createdAt: serverTimestamp(),
        read:     false
      };
      if (replyingTo) {
        messageData.replyTo = {
          id:       replyingTo.id,
          text:     replyingTo.text || '',
          imageUrl: replyingTo.imageUrl || '',
          fileUrl:  replyingTo.fileUrl  || '',
          senderId: replyingTo.senderId
        };
        cancelReplyMode();
      }

      await addDoc(messagesRef, messageData);

      // Update match doc: last message + unread count
      try {
        const freshSnap = await getDoc(doc(db, "matches", matchId));
        const current   = freshSnap.data()?.unreadCounts?.[otherUserId] || 0;
        await updateDoc(doc(db, "matches", matchId), {
          lastMessage:             text,
          lastMessageAt:           serverTimestamp(),
          [`unreadCounts.${otherUserId}`]: current + 1
        });
      } catch (_) {}

      await updateDoc(doc(db, "users", user.uid), { typing: false });
      input.value = "";
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) {
      console.error("Send error:", err);
      showToast(`Failed to send message: ${err.message}`);
    }
    sendBtn.disabled = false;
    input.focus();
  });

  if (emojiBtn) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (reactionPicker && reactionPicker.style.display === 'flex' && reactionPicker.dataset.mode === 'input') {
        closeAllMenus(); return;
      }
      openInputEmojiPicker();
    });
  }

  function openInputEmojiPicker() {
    if (!reactionPicker) return;
    reactionPicker.dataset.mode = 'input';
    buildInputEmojiGrid(ALL_EMOJIS);
    reactionPicker.style.position  = 'fixed';
    reactionPicker.style.bottom    = '70px';
    reactionPicker.style.left      = '12px';
    reactionPicker.style.top       = 'auto';
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
          const pos    = inp.selectionStart || inp.value.length;
          const before = inp.value.slice(0, pos);
          const after  = inp.value.slice(pos);
          inp.value = before + emoji + after;
          const newPos = before.length + emoji.length;
          inp.selectionStart = inp.selectionEnd = newPos;
          inp.focus();
          inp.dispatchEvent(new Event('input'));
        }
      };
      reactionPickerGrid.appendChild(btn);
    });
  }

  // 📸 Image / Video upload
  if (imageInput) {
    imageInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) { showToast(`${file.name} is too large! Max 100MB.`); imageInput.value = ""; return; }
      }
      const uploadingIndicator = document.createElement('div');
      uploadingIndicator.className = 'uploading-indicator';
      uploadingIndicator.innerHTML = `<div class="uploading-content"><div class="spinner"></div><span>Uploading ${files.length} file(s)...</span></div>`;
      messagesDiv.appendChild(uploadingIndicator);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      try {
        const uploadPromises = files.map(async (file, index) => {
          const timestamp        = Date.now();
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const folder = file.type.startsWith('video/') ? 'chat-videos' : 'chat-images';
          const fileName = `${folder}/${matchId}/${timestamp}_${index}_${sanitizedFileName}`;
          const storageRef = ref(storage, fileName);
          const uploadResult = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(uploadResult.ref);
          await addDoc(messagesRef, {
            senderId:  user.uid,
            imageUrl:  url,      // reuse imageUrl field for both images and videos
            createdAt: serverTimestamp(),
            read:      false
          });

          try {
            const freshSnap = await getDoc(doc(db, "matches", matchId));
            const current   = freshSnap.data()?.unreadCounts?.[otherUserId] || 0;
            const isVideo   = url.includes("profile-videos") || file.type?.startsWith("video/");
            await updateDoc(doc(db, "matches", matchId), {
              lastMessage:   isVideo ? "📹 Video" : "📷 Photo",
              lastMessageAt: serverTimestamp(),
              [`unreadCounts.${otherUserId}`]: current + 1
            });
          } catch (_) {}
        });
        await Promise.all(uploadPromises);
        uploadingIndicator.remove();
      } catch (err) {
        console.error("Upload error:", err);
        uploadingIndicator.remove();
        if (err.code === 'storage/unauthorized') showToast("Permission denied. Check Firebase Storage rules.");
        else showToast(`Failed to upload: ${err.message}`);
      }
      imageInput.value = "";
    });
  }

  // 📎 File upload (documents, zips, etc.)
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) { showToast(`${file.name} is too large! Max 50MB.`); fileInput.value = ""; return; }
      }
      const uploadingIndicator = document.createElement('div');
      uploadingIndicator.className = 'uploading-indicator';
      uploadingIndicator.innerHTML = `<div class="uploading-content"><div class="spinner"></div><span>Uploading ${files.length} file(s)...</span></div>`;
      messagesDiv.appendChild(uploadingIndicator);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      try {
        const uploadPromises = files.map(async (file, index) => {
          const timestamp = Date.now();
          const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName  = `chat-files/${matchId}/${timestamp}_${index}_${sanitized}`;
          const storageRef = ref(storage, fileName);
          const uploadResult = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(uploadResult.ref);
          await addDoc(messagesRef, {
            senderId:  user.uid,
            fileUrl:   url,
            fileName:  file.name,
            fileSize:  file.size,
            createdAt: serverTimestamp(),
            read:      false
          });
          try {
            const freshSnap = await getDoc(doc(db, "matches", matchId));
            const current   = freshSnap.data()?.unreadCounts?.[otherUserId] || 0;
            await updateDoc(doc(db, "matches", matchId), {
              lastMessage:   "📎 " + file.name,
              lastMessageAt: serverTimestamp(),
              [`unreadCounts.${otherUserId}`]: current + 1
            });
          } catch (_) {}
        });
        await Promise.all(uploadPromises);
        uploadingIndicator.remove();
      } catch (err) {
        console.error("File upload error:", err);
        uploadingIndicator.remove();
        showToast(`Failed to upload file: ${err.message}`);
      }
      fileInput.value = "";
    });
  }

  // ── MENU SYSTEM ──
  const menuOverlayInner = document.getElementById('menuOverlay');

  function closeAllMenus() {
    const cm = document.getElementById('chatMenu');
    if (cm) cm.style.display = 'none';
    if (messageContextMenu && messageContextMenu.style.display !== 'none') {
      if (messageContextMenu._onClose) { messageContextMenu._onClose(); messageContextMenu._onClose = null; }
    }
    if (messageContextMenu) messageContextMenu.style.display = 'none';
    if (menuOverlayInner) menuOverlayInner.style.display = 'none';
    const rp = document.getElementById('reactionPicker');
    if (rp) rp.style.display = 'none';
    lastOpenMessageId = null;
    // Always scrub show-menu from every message so arrows never get stuck
    document.querySelectorAll('.message.show-menu').forEach(el => el.classList.remove('show-menu'));
    // Allow hover arrows again
    messagesDiv.classList.remove('menu-is-open');
  }

  function openMenu(menuEl) {
    if (menuOverlayInner) menuOverlayInner.style.display = 'block';
    // Suppress hover arrows on all messages while a menu is open
    messagesDiv.classList.add('menu-is-open');
    // reaction picker uses flex layout, everything else block
    menuEl.style.display = menuEl.id === 'reactionPicker' ? 'flex' : 'block';
  }

  if (menuOverlayInner) {
    menuOverlayInner.addEventListener('click', closeAllMenus);
  }

  const reactionPicker     = document.getElementById('reactionPicker');
  const reactionPickerGrid = document.getElementById('reactionPickerGrid');
  const reactionSearch     = document.getElementById('reactionSearch');

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
      btn.className   = 'reaction-pick-btn';
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
    // Only rebuild if grid is empty (first open)
    if (!reactionPickerGrid.hasChildNodes()) {
      buildReactionGrid(ALL_EMOJIS);
    }
    reactionPicker.style.position  = 'fixed';
    reactionPicker.style.top       = '50%';
    reactionPicker.style.left      = '50%';
    reactionPicker.style.transform = 'translate(-50%, -50%)';
    reactionPicker.style.bottom    = 'auto';
    if (reactionSearch) reactionSearch.value = '';
    // Use openMenu so the overlay is activated and clicks outside close it
    openMenu(reactionPicker);
  }

  if (reactionPicker) {
    reactionPicker.addEventListener('click', e => e.stopPropagation());
    reactionPicker.addEventListener('mousedown', e => e.stopPropagation());
    // Pre-build grid immediately so first open is instant
    buildReactionGrid(ALL_EMOJIS);
  }

  if (reactionSearch) {
    reactionSearch.addEventListener('input', () => {
      const q2 = reactionSearch.value.trim().toLowerCase();
      const isInputMode = reactionPicker?.dataset.mode === 'input';
      const rebuild = isInputMode ? buildInputEmojiGrid : buildReactionGrid;
      if (!q2) { rebuild(ALL_EMOJIS); return; }
      const KEYWORDS = {
        'heart':['❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💗','💖','🥰','😍','❤️‍🔥'],
        'love':['❤️','🥰','😍','😘','💕','💖','💌','💑','💏','🫶','😚','🌹'],
        'hug':['🤗','🫂','🫶','💗','🥰'],
        'laugh':['😂','🤣','😆','😅','🙃'], 'cry':['😢','😭','🥺','😿'],
        'fire':['🔥','❤️‍🔥'], 'star':['⭐','🌟','✨','💫','⭐'],
        'thumbs':['👍','👎'], 'clap':['👏','🙌'],
        'happy':['😀','😃','😄','😁','😊','😇','🥳','🤩'],
        'sad':['😞','😔','😢','😭','🥺','😿'],
        'angry':['😠','😡','🤬','😤','👿'],
        'wow':['😮','😲','🤯','😱','🫨'],
        'cool':['😎','🥸','🤩','👑'],
        'party':['🎉','🎊','🎈','🥳','🎂','🎁'],
        'pray':['🙏','🫶','💫'],
        'muscle':['💪','🦾','💪'],
        'sleep':['😴','🥱','💤'],
        'think':['🤔','🧐','🫡','💭'],
        'ghost':['👻'], 'skull':['💀','☠️'],
        'poop':['💩'], 'crown':['👑','🏆'],
        'gem':['💎','💍'], 'rocket':['🚀','✨'],
        'celebrate':['🎉','🎊','🥳','🏆','🎈'],
        'kiss':['😘','😚','💋','💌','💏'],
        'wave':['👋','🤚','🖐️'],
        'ok':['👌','✌️','🤞','✅'],
        'food':['🍕','🍔','🍟','🌮','🍣','🎂'],
        'sport':['⚽','🏀','🏈','🎾','🏆'],
      };
      let matched = new Set();
      Object.entries(KEYWORDS).forEach(([kw, emojis]) => { if (kw.includes(q2)) emojis.forEach(e => matched.add(e)); });
      rebuild(matched.size ? [...matched] : ALL_EMOJIS.slice(0, 48));
    });
  }

  if (messageContextMenu) {
    const reactionBtns = messageContextMenu.querySelectorAll('.reaction-btn');
    reactionBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const emoji = btn.dataset.emoji;
        if (emoji && currentMessageId) { await saveReaction(currentMessageId, emoji); closeAllMenus(); }
        else if (!emoji) { openReactionPicker(); messageContextMenu.style.display = 'none'; }
      });
    });

    const menuItems = messageContextMenu.querySelectorAll('.context-menu-item');
    menuItems.forEach(item => {
      const action = item.dataset.action;
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        switch (action) {
          case 'reply':
            activateReply(currentMessageId, currentMessageData);
            break;
          case 'select':
            activateSelectMode(currentMessageId);
            break;
          case 'delete':
            if (!confirm('Delete this message for everyone?')) break;
            try {
              await updateDoc(doc(db, `chats/${matchId}/messages`, currentMessageId), {
                deleted: true, deletedAt: serverTimestamp()
              });
            } catch (err) { console.error('Error deleting:', err); showToast('Failed to delete.'); }
            break;
        }
        closeAllMenus();
        lastOpenMessageId = null;
      });
    });
  }

  async function saveReaction(messageId, emoji) {
    try {
      const msgRef  = doc(db, `chats/${matchId}/messages`, messageId);
      const msgSnap = await getDoc(msgRef);
      const existing = msgSnap.data()?.reactions || {};
      if (existing[user.uid] === emoji) delete existing[user.uid];
      else existing[user.uid] = emoji;
      await updateDoc(msgRef, { reactions: existing });
    } catch (err) { console.error('Error saving reaction:', err); }
  }

  const reactionCatBtns = document.querySelectorAll('.reaction-cat');
  const EMOJI_CAT_MAP = {
    recent: [],
    smileys: [
      '😀','😃','😄','😁','😆','😅','😂','🤣','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
      '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
      '😕','🫤','😟','🙁','☹️','😮','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢',
      '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀',
      '☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'
    ],
    love: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','♥️','❤️‍🔥','❤️‍🩹','🫀','💌','😍','🥰','😘','💏','💑','👫','👬','👭',
      '🌹','🌷','💐','🌸','🫶','🤗','🥺','😚','😙','🫦'
    ],
    gestures: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🤌','🤏','✌️','🤞','🫰','🤟','🤘',
      '🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌',
      '🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🫂','🤗','👤','👥'
    ],
    animals: [
      '🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧',
      '🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🌸','🌺','🌻',
      '🌹','🌷','🌿','☘️','🍀','🌊','🌈','⭐','🌙','☀️','🌍','🔥','💧','🌸'
    ],
    food: [
      '🍕','🍔','🍟','🌮','🌯','🍣','🍜','🍝','🍲','🍛','🍱','🥗','🥘','🍳','🥞','🧇',
      '🥓','🥩','🍗','🍖','🌭','🧆','🥚','🧀','🥙','🍱','🍣','🍤','🍙','🍚','🍛','🍜',
      '🎂','🍰','🧁','🍩','🍪','🍫','🍬','🍭','🍦','🍧','🍨','🥧','🍡','🍢','🍮','🍯',
      '☕','🍵','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🥤','🧃','🧉','🥛','🍼','🫖'
    ],
    activities: [
      '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🏆','🥇','🥈','🥉',
      '🎯','🎳','🎮','🎲','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎸','🎺','🎻','🎉',
      '🎊','🎈','🎁','🎀','🎗️','🏅','🎖️','🃏','🀄','🎰','🧩','♟️','🎿','⛷️','🏂','🤸'
    ],
    travel: [
      '✈️','🚀','🚗','🚕','🚙','🏎️','🚓','🚑','🚒','🛻','🚐','🚌','🚎','🚂','🚃','🚄',
      '🚅','🚆','🚇','🚊','🚝','🚞','🚋','🚍','🚘','🛳️','⛴️','🚤','⛵','🛶','🚢','🛥️',
      '🏖️','🏔️','🌋','🏕️','🏝️','🏜️','🌃','🌆','🌇','🌉','🗺️','🗼','🗽','🏰','🏯','⛩️'
    ],
    symbols: [
      '🔥','✨','💫','⭐','🌟','💥','❗','❓','💯','✅','❌','⚠️','🔔','🔕','💬','💭',
      '🗯️','💤','🎵','🎶','🎙️','📢','📣','🔊','🔇','🔈','🔉','💡','🔦','🕯️','💎','👑',
      '🏆','🎯','🔑','🗝️','🔐','🔒','🔓','📱','💻','📷','📸','🎥','📹','📺','📻','🎙️',
      '⚡','🌈','💧','🌊','🍀','🌸','🌺','🌻','🌹','💐','🦋','🌙','☀️','⛅','🌍','🚩'
    ]
  };

  reactionCatBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = btn.dataset.category;
      reactionCatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const emojis = category === 'recent'
        ? (EMOJI_CAT_MAP.recent.length ? EMOJI_CAT_MAP.recent : ALL_EMOJIS.slice(0, 48))
        : EMOJI_CAT_MAP[category] || ALL_EMOJIS;
      const isInputMode = reactionPicker?.dataset.mode === 'input';
      if (isInputMode) buildInputEmojiGrid(emojis);
      else buildReactionGrid(emojis);
    });
  });

  const replyBar         = document.getElementById('replyBar');
  const replyPreviewText = document.getElementById('replyPreviewText');
  const replyBarThumb    = document.getElementById('replyBarThumb');
  const cancelReply      = document.getElementById('cancelReply');
  const messageInput     = document.getElementById('messageInput');
  let replyingTo         = null;

  function activateReply(messageId, messageData) {
    replyingTo = { id: messageId, ...messageData };
    // Show thumbnail if replying to image/video
    const mediaUrl = messageData.imageUrl || messageData.fileUrl;
    if (mediaUrl && (isImg(mediaUrl) || isVid(mediaUrl)) && replyBarThumb) {
      replyBarThumb.src = mediaUrl;
      replyBarThumb.style.display = 'block';
    } else if (replyBarThumb) {
      replyBarThumb.style.display = 'none';
    }
    replyPreviewText.textContent = messageData.text || (messageData.fileUrl ? '📎 File' : '📷 Media');
    replyBar.style.display = 'flex';
    messageInput.focus();
  }

  function cancelReplyMode() {
    replyingTo = null;
    replyBar.style.display = 'none';
    replyPreviewText.textContent = '';
    if (replyBarThumb) { replyBarThumb.style.display = 'none'; replyBarThumb.src = ''; }
  }

  if (cancelReply) cancelReply.addEventListener('click', cancelReplyMode);

  const selectToolbar    = document.getElementById('selectToolbar');
  const cancelSelect     = document.getElementById('cancelSelect');
  const deleteSelected   = document.getElementById('deleteSelected');
  const selectedCountEl  = document.getElementById('selectedCount');
  let selectMode         = false;
  let selectedMessages   = new Set();

  function activateSelectMode(firstMessageId) {
    selectMode = true;
    selectedMessages.clear();
    selectedMessages.add(firstMessageId);
    selectToolbar.style.display = 'flex';
    document.getElementById('chatForm').style.display = 'none';
    document.querySelectorAll('.message').forEach(msgEl => {
      msgEl.classList.add('select-mode');
      msgEl.classList.remove('show-menu');
      const msgId = msgEl.dataset.messageId;
      let checkbox = msgEl.querySelector('.select-checkbox');
      if (!checkbox) {
        checkbox = document.createElement('div');
        checkbox.className = 'select-checkbox';
        checkbox.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        msgEl.appendChild(checkbox);
      }
      if (msgId === firstMessageId) msgEl.classList.add('selected');
      msgEl.onclick = function() {
        if (!selectMode) return;
        if (selectedMessages.has(msgId)) { selectedMessages.delete(msgId); msgEl.classList.remove('selected'); }
        else { selectedMessages.add(msgId); msgEl.classList.add('selected'); }
        selectedCountEl.textContent = `${selectedMessages.size} selected`;
      };
    });
    selectedCountEl.textContent = `${selectedMessages.size} selected`;
  }

  function deactivateSelectMode() {
    selectMode = false;
    selectedMessages.clear();
    selectToolbar.style.display = 'none';
    document.getElementById('chatForm').style.display = 'flex';
    document.querySelectorAll('.message').forEach(msgEl => {
      msgEl.classList.remove('select-mode', 'selected');
      msgEl.onclick = null;
      const cb = msgEl.querySelector('.select-checkbox');
      if (cb) cb.remove();
    });
    selectedCountEl.textContent = '0 selected';
  }

  if (cancelSelect)   cancelSelect.addEventListener('click', deactivateSelectMode);
  if (deleteSelected) {
    deleteSelected.addEventListener('click', async () => {
      if (selectedMessages.size === 0) return;
      if (!confirm(`Delete ${selectedMessages.size} message(s) for everyone?`)) return;
      try {
        await Promise.all([...selectedMessages].map(msgId =>
          updateDoc(doc(db, `chats/${matchId}/messages`, msgId), { deleted: true, deletedAt: serverTimestamp() })
        ));
        deactivateSelectMode();
      } catch (err) { console.error('Error deleting:', err); showToast('Failed to delete.'); }
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete all messages? This cannot be undone.")) return;
      try {
        const snapshot = await getDocs(messagesRef);
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
        messagesDiv.innerHTML = '<div style="text-align:center;color:#999;padding:20px;font-style:italic;">Chat cleared</div>';
        closeAllMenus();
      } catch (err) { console.error("Error clearing chat:", err); showToast("Failed to clear chat."); }
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const userDocRef  = doc(db, "users", user.uid);
        const userDoc     = await getDoc(userDocRef);
        const mutedChats  = userDoc.data()?.mutedChats || [];
        const isMuted     = mutedChats.includes(matchId);
        if (isMuted) {
          await updateDoc(userDocRef, { mutedChats: mutedChats.filter(id => id !== matchId) });
          document.getElementById('muteBtnLabel').textContent = 'Mute Notifications';
          showToast('Notifications unmuted');
        } else {
          await updateDoc(userDocRef, { mutedChats: [...mutedChats, matchId] });
          document.getElementById('muteBtnLabel').textContent = 'Unmute Notifications';
          showToast('Notifications muted');
        }
        closeAllMenus();
      } catch (err) { console.error("Error toggling mute:", err); }
    });
  }

  if (viewProfileBtn) {
    viewProfileBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      if (otherUser) {
        await writeView(otherUserId, user.uid);
        showProfileModal(otherUser, otherUserId);
      }
    });
  }

  // Write a view record to the views collection
  async function writeView(targetUid, viewerUid) {
    if (!targetUid || !viewerUid || targetUid === viewerUid) return;
    try {
      const viewerSnap = await getDoc(doc(db, "users", viewerUid));
      const vd = viewerSnap.exists() ? viewerSnap.data() : {};
      await setDoc(doc(db, "views", `${viewerUid}_${targetUid}_${Date.now()}`), {
        viewerUid,
        targetUid,
        viewerName:   vd.name     || "",
        viewerPhoto:  vd.photoURL || "",
        viewerCourse: vd.course   || "",
        viewerCampus: vd.campus   || "",
        viewedAt:     serverTimestamp()
      });
    } catch (err) { console.error("writeView error:", err); }
  }

  async function showProfileModal(userData, userId) {
    const existing = document.querySelector(".chat-pm-backdrop");
    if (existing) existing.remove();

    const DA = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzgiIHI9IjE4IiBmaWxsPSIjNDQ0NDY2Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iODUiIHJ4PSIyOCIgcnk9IjIwIiBmaWxsPSIjNDQ0NDY2Ii8+PC9zdmc+";

    // Fetch fresh data
    let d = { ...userData };
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) d = { ...d, ...snap.data() };
    } catch (_) {}

    const profilePic    = d.photoURL || DA;
    const galleryPhotos = (d.photoPosts && d.photoPosts.length > 0) ? d.photoPosts : [profilePic];

    const photoItems = galleryPhotos.map((url, i) =>
      `<div class="chat-pm-photo-item ${i === 0 ? "active" : ""}">
        <img src="${url}" alt="photo" onerror="this.src='${DA}'">
      </div>`
    ).join("");

    const dots = galleryPhotos.length > 1
      ? `<div class="chat-pm-dots">${galleryPhotos.map((_, i) =>
          `<span class="chat-pm-dot ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";

    const navBtns = galleryPhotos.length > 1
      ? `<button class="chat-pm-nav chat-pm-prev">&#8249;</button>
         <button class="chat-pm-nav chat-pm-next">&#8250;</button>` : "";

    const infoSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

    const backdrop = document.createElement("div");
    backdrop.className = "chat-pm-backdrop";
    backdrop.innerHTML = `
      <div class="chat-pm-card">

        <!-- LAYER 1: profile photo -->
        <div class="chat-pm-profile-layer">
          <img src="${profilePic}" class="chat-pm-profile-img" alt="profile"
               onerror="this.src='${DA}'">
          <div class="chat-pm-overlay">
            <div class="chat-pm-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
            <div class="chat-pm-meta">
              ${d.campus ? `<span>📍 ${d.campus}</span>` : ""}
              ${d.course ? `<span>📚 ${d.course}</span>` : ""}
            </div>
          </div>
        </div>

        <!-- LAYER 2: gallery (slides in on ℹ️) -->
        <div class="chat-pm-gallery-layer">
          ${navBtns}
          <div class="chat-pm-photos">${photoItems}</div>
          ${dots}

          <!-- About panel inside gallery -->
          <div class="chat-pm-about" id="chat-pm-about">
            <div class="chat-pm-about-handle"></div>
            <div class="chat-pm-about-name">${d.name || ""}${d.age ? `, ${d.age}` : ""}</div>
            <div class="chat-pm-about-details">
              ${d.gender ? `<div class="chat-pm-about-row"><span>👤</span><span>${d.gender}</span></div>` : ""}
              ${d.campus ? `<div class="chat-pm-about-row"><span>📍</span><span>${d.campus}</span></div>` : ""}
              ${d.course ? `<div class="chat-pm-about-row"><span>📚</span><span>${d.course}</span></div>` : ""}
              ${d.bio    ? `<div class="chat-pm-about-bio"><h3>About</h3><p>${d.bio}</p></div>` : ""}
            </div>
          </div>

          <!-- ℹ️ inside gallery → about panel -->
          <button class="chat-pm-info-btn" id="chat-pm-gallery-info">${infoSVG}</button>
        </div>

        <!-- ✕ always on top -->
        <button class="chat-pm-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- ℹ️ on profile layer → opens gallery -->
        <button class="chat-pm-info-btn" id="chat-pm-profile-info">${infoSVG}</button>

      </div>`;

    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.classList.add("open"), 10);

    const galleryLayer  = backdrop.querySelector(".chat-pm-gallery-layer");
    const aboutPanel    = backdrop.querySelector("#chat-pm-about");
    const profileInfoBtn  = backdrop.querySelector("#chat-pm-profile-info");
    const galleryInfoBtn  = backdrop.querySelector("#chat-pm-gallery-info");

    // ℹ️ on profile → slide in gallery
    profileInfoBtn.addEventListener("click", () => {
      galleryLayer.classList.add("visible");
      profileInfoBtn.style.display = "none";
    });

    // ℹ️ inside gallery → toggle about panel
    galleryInfoBtn.addEventListener("click", () => {
      const open = aboutPanel.classList.toggle("open");
      galleryInfoBtn.classList.toggle("active", open);
    });

    // Gallery nav
    if (galleryPhotos.length > 1) {
      let idx = 0;
      const photoEls = galleryLayer.querySelectorAll(".chat-pm-photo-item");
      const dotEls   = galleryLayer.querySelectorAll(".chat-pm-dot");
      const goTo = (i) => {
        photoEls.forEach((el, j) => el.classList.toggle("active", j === i));
        dotEls.forEach((el, j)   => el.classList.toggle("active", j === i));
        idx = i;
      };
      galleryLayer.querySelector(".chat-pm-prev").onclick = () => goTo(idx > 0 ? idx - 1 : photoEls.length - 1);
      galleryLayer.querySelector(".chat-pm-next").onclick = () => goTo(idx < photoEls.length - 1 ? idx + 1 : 0);
      dotEls.forEach((el, i) => { el.onclick = () => goTo(i); });
    }

    // Close
    const closePM = () => {
      backdrop.classList.remove("open");
      setTimeout(() => backdrop.remove(), 300);
    };
    backdrop.querySelector(".chat-pm-close").addEventListener("click", closePM);
    backdrop.addEventListener("click", e => { if (e.target === backdrop) closePM(); });
  }

  if (mediaBtn) {
    mediaBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllMenus();
      await openMediaModal();
    });
  }

  const mediaModal      = document.getElementById('mediaModal');
  const closeMediaModal = document.getElementById('closeMediaModal');
  const mediaTabs       = document.querySelectorAll('.media-tab');
  const mediaGrid       = document.getElementById('mediaGrid');
  const videoGrid       = document.getElementById('videoGrid');
  const linksList       = document.getElementById('linksList');
  const docsList        = document.getElementById('docsList');

  async function openMediaModal() {
    if (!mediaModal) return;
    await loadMediaContent();
    mediaModal.style.display = 'flex';
  }

  async function loadMediaContent() {
    try {
      const messagesSnapshot = await getDocs(query(messagesRef, orderBy('createdAt', 'desc')));
      const images = [];
      const videos = [];
      const links  = [];
      const docs   = [];
      messagesSnapshot.forEach(d => {
        const msg = d.data();
        if (msg.imageUrl && !msg.deleted) {
          if (isVid(msg.imageUrl)) videos.push({ url: msg.imageUrl, date: msg.createdAt });
          else                     images.push({ url: msg.imageUrl, date: msg.createdAt });
        }
        if (msg.fileUrl && !msg.deleted) {
          docs.push({ url: msg.fileUrl, name: msg.fileName || 'File', size: msg.fileSize, date: msg.createdAt });
        }
        if (msg.text && !msg.deleted) {
          const found = msg.text.match(/(https?:\/\/[^\s]+)/g);
          if (found) found.forEach(link => links.push({ url: link, date: msg.createdAt }));
        }
      });

      // Images tab
      mediaGrid.innerHTML = images.length > 0
        ? images.map(img => `<div class="media-item" onclick="openMediaViewer('${img.url}','image')"><img src="${img.url}" alt="Media" loading="lazy"><div class="media-item-date">${formatTime(img.date)}</div></div>`).join('')
        : '<div class="empty-state"><p>No images shared yet</p></div>';

      // Videos tab
      if (videoGrid) {
        videoGrid.innerHTML = videos.length > 0
          ? videos.map(v => `
              <div class="media-item" onclick="openMediaViewer('${v.url}','video')" style="background:#000;">
                <video src="${v.url}" preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>
                <div class="video-badge"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="14" fill="rgba(255,255,255,0.2)"/><path d="M11 9l10 5-10 5V9z" fill="white"/></svg></div>
                <div class="media-item-date">${formatTime(v.date)}</div>
              </div>`).join('')
          : '<div class="empty-state"><p>No videos shared yet</p></div>';
      }

      // Links tab
      linksList.innerHTML = links.length > 0
        ? links.map(l => `<div class="link-item" onclick="window.open('${l.url}','_blank')"><div class="link-info"><div class="link-title">${l.url.length > 50 ? l.url.substring(0,50)+'...' : l.url}</div><div class="link-url">${formatTime(l.date)}</div></div></div>`).join('')
        : '<div class="empty-state"><p>No links shared yet</p></div>';

      // Docs tab
      docsList.innerHTML = docs.length > 0
        ? docs.map(d => {
            const safeName = d.name ? d.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : 'File';
            const safeUrl  = d.url  ? d.url.replace(/"/g,'%22') : '#';
            return `<div class="doc-item" onclick="window.open('${safeUrl}','_blank')"><div class="doc-icon">${fileIcon(d.name)}</div><div class="doc-info"><div class="doc-title">${safeName}</div><div class="doc-meta">${d.size ? (d.size/1024).toFixed(0)+' KB · ' : ''}${formatTime(d.date)}</div></div></div>`;
          }).join('')
        : '<div class="empty-state"><p>No documents shared yet</p></div>';

    } catch (err) { console.error('Error loading media:', err); mediaGrid.innerHTML = '<div class="empty-state"><p>Failed to load media</p></div>'; }
  }

  // Make openMediaViewer accessible from inline onclick in media modal HTML
  window.openMediaViewer = openMediaViewer;

  if (closeMediaModal) closeMediaModal.addEventListener('click', () => { mediaModal.style.display = 'none'; });
  if (mediaModal) mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) mediaModal.style.display = 'none'; });

  mediaTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      mediaTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.media-tab-content').forEach(c => c.classList.remove('active'));
      if (tabName === 'media')  document.getElementById('mediaTabContent').classList.add('active');
      if (tabName === 'videos') document.getElementById('videosTabContent').classList.add('active');
      if (tabName === 'links')  document.getElementById('linksTabContent').classList.add('active');
      if (tabName === 'docs')   document.getElementById('docsTabContent').classList.add('active');
    });
  });

  // ── Media viewer (images + videos) ──
  const imageViewerModal    = document.getElementById('imageViewerModal');
  const viewerImage         = document.getElementById('viewerImage');
  const viewerVideo         = document.getElementById('viewerVideo');
  const viewerLabel         = document.getElementById('viewerLabel');
  const imageViewerClose    = document.querySelector('.image-viewer-close');
  const imageViewerDownload = document.querySelector('.image-viewer-download');
  const imageViewerOverlay  = document.querySelector('.image-viewer-overlay');

  function openMediaViewer(url, type = 'image') {
    if (!imageViewerModal) return;
    if (type === 'video') {
      viewerImage.style.display = 'none';
      viewerVideo.style.display = 'block';
      viewerVideo.src = url;
      if (viewerLabel) viewerLabel.textContent = 'Video';
    } else {
      viewerVideo.style.display = 'none';
      viewerImage.style.display = 'block';
      viewerImage.onload = null;
      viewerImage.src = url;
      if (viewerLabel) viewerLabel.textContent = 'Photo';
    }
    // Reset any dynamic width from previous open
    const card = imageViewerModal.querySelector('.image-viewer-content');
    if (card) card.style.width = '';
    imageViewerModal.style.display = 'flex';
    setTimeout(() => imageViewerModal.classList.add('show'), 10);
  }

  function openImageViewer(imageUrl) { openMediaViewer(imageUrl, 'image'); }

  function closeImageViewer() {
    if (!imageViewerModal) return;
    imageViewerModal.classList.remove('show');
    setTimeout(() => {
      imageViewerModal.style.display = 'none';
      viewerImage.src = '';
      viewerImage.onload = null;
      if (viewerVideo) { viewerVideo.pause(); viewerVideo.src = ''; }
      // Reset card width for next open
      const card = imageViewerModal.querySelector('.image-viewer-content');
      if (card) card.style.width = '';
    }, 300);
  }

  if (imageViewerClose)   imageViewerClose.addEventListener('click', closeImageViewer);
  if (imageViewerOverlay) imageViewerOverlay.addEventListener('click', closeImageViewer);

  if (imageViewerDownload) {
    imageViewerDownload.addEventListener('click', async () => {
      const isVideo = viewerVideo?.style.display !== 'none';
      const url     = isVideo ? viewerVideo.src : viewerImage.src;
      if (!url) return;

      imageViewerDownload.classList.add('saving');
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch failed');
        const blob      = await response.blob();
        const ext       = isVideo ? 'mp4' : 'jpg';
        const filename  = `unimatch_${isVideo ? 'video' : 'photo'}_${Date.now()}.${ext}`;
        const blobUrl   = URL.createObjectURL(blob);
        const a         = document.createElement('a');
        a.href          = blobUrl;
        a.download      = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast(`${isVideo ? 'Video' : 'Photo'} saved ✓`);
      } catch (err) {
        // Fallback: open in new tab for manual save
        window.open(url, '_blank');
        showToast('Opening in new tab — long press to save');
      } finally {
        imageViewerDownload.classList.remove('saving');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageViewerModal?.style.display === 'flex') closeImageViewer();
  });

  const unmatchBtnInner = document.getElementById("unmatchBtn");
  if (unmatchBtnInner) {
    unmatchBtnInner.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Unmatch with ${otherUser?.name || 'this person'}?`)) return;
      try {
        await deleteDoc(doc(db, "matches", matchId));
        showToast("You have been unmatched.");
        window.location.href = "/matches.html";
      } catch (err) { console.error("Unmatch error:", err); showToast("Failed to unmatch."); }
    });
  }

  if (blockUserBtn) {
    blockUserBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Block ${otherUser?.name || 'this user'}?`)) return;
      try {
        const userDocRef  = doc(db, "users", user.uid);
        const userDoc     = await getDoc(userDocRef);
        const blockedUsers = userDoc.data()?.blockedUsers || [];
        if (!blockedUsers.includes(otherUserId)) {
          await updateDoc(userDocRef, { blockedUsers: [...blockedUsers, otherUserId] });
        }
        await deleteDoc(doc(db, "matches", matchId));
        showToast("User has been blocked.");
        window.location.href = "/matches.html";
      } catch (err) { console.error("Block error:", err); showToast("Failed to block user."); }
    });
  }

  // 🎤 Voice recording
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  if (micBtn) {
    micBtn.addEventListener("click", async () => {
      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (e) => { audioChunks.push(e.data); };
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            try {
              const fileName   = `voice-messages/${matchId}/${Date.now()}.webm`;
              const storageRef = ref(storage, fileName);
              await uploadBytes(storageRef, audioBlob);
              const audioUrl = await getDownloadURL(storageRef);
              await addDoc(messagesRef, {
                senderId:  user.uid,
                voiceUrl:  audioUrl,
                createdAt: serverTimestamp(),
                read:      false
              });

              try {
                const freshSnap = await getDoc(doc(db, "matches", matchId));
                const current   = freshSnap.data()?.unreadCounts?.[otherUserId] || 0;
                await updateDoc(doc(db, "matches", matchId), {
                  lastMessage:   "🎤 Voice message",
                  lastMessageAt: serverTimestamp(),
                  [`unreadCounts.${otherUserId}`]: current + 1
                });
              } catch (_) {}

            } catch (err) {
              console.error("Voice upload error:", err);
              showToast("Failed to send voice message.");
            }
          };
          mediaRecorder.start();
          isRecording = true;
          micBtn.style.color       = "#ff4d6d";
          micBtn.style.background  = "rgba(255,77,109,0.2)";
        } catch (err) {
          console.error("Microphone error:", err);
          showToast("Please allow microphone access.");
        }
      } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        micBtn.style.color      = "";
        micBtn.style.background = "";
      }
    });
  }
});

// 👈 Swipe back (mobile)
let startX = 0;
document.addEventListener("touchstart", e => { startX = e.touches[0].clientX; });
document.addEventListener("touchend", e => {
  const endX = e.changedTouches[0].clientX;
  if (endX - startX > 100 && startX < 50) history.back();
});