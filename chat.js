import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

const matchId = new URLSearchParams(window.location.search).get("matchId");

const messagesDiv         = document.getElementById("messages");
const form                = document.getElementById("chatForm");
const input               = document.getElementById("messageInput");
const chatName            = document.getElementById("chatName");
const chatProfilePhoto    = document.getElementById("chatProfilePhoto");
const chatProfileInitials = document.getElementById("chatProfileInitials");
const onlineStatus        = document.getElementById("onlineStatus");
const typingStatus        = document.getElementById("typingStatus");
const sendBtn             = document.getElementById("sendBtn");
const imageInput          = document.getElementById("imageInput");
const fileInput           = document.getElementById("fileInput");
const backBtn             = document.getElementById("backBtn");

let currentUser  = null;
let matchData    = null;
let otherUser    = null;
let typingTimeout = null;

// Helpers
function isVid(url) { return /\.(mp4|mov|webm|ogg|avi|mkv)(\?|$)/i.test(url); }
function isImg(url) { return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url); }
function ext(name)  { return (name || '').split('.').pop().toLowerCase(); }

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function setAvatar(name, photoURL) {
  if (photoURL && chatProfilePhoto) {
    chatProfilePhoto.src = photoURL;
    chatProfilePhoto.style.display = 'block';
    if (chatProfileInitials) chatProfileInitials.style.display = 'none';
  } else if (chatProfileInitials) {
    if (chatProfilePhoto) chatProfilePhoto.style.display = 'none';
    chatProfileInitials.textContent = getInitials(name);
    chatProfileInitials.style.display = 'flex';
  }
}

// Boot Chat
(async () => {
  try {
    currentUser = await requireAuth();

    if (!matchId) {
      if (messagesDiv) messagesDiv.innerHTML = `<div class="empty-state">No conversation selected</div>`;
      return;
    }

    // Fetch Match & Other user
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("*, p1:profiles!matches_user1_id_fkey(*), p2:profiles!matches_user2_id_fkey(*)")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      console.error("Match error:", matchErr);
      if (messagesDiv) messagesDiv.innerHTML = `<div class="empty-state">Conversation not found</div>`;
      return;
    }

    matchData = match;
    otherUser = match.user1_id === currentUser.id ? match.p2 : match.p1;

    if (chatName) chatName.textContent = otherUser?.name || "Match";
    setAvatar(otherUser?.name, otherUser?.photo_url);

    if (onlineStatus) {
      onlineStatus.textContent = otherUser?.online ? "Online" : "Offline";
      onlineStatus.style.color = otherUser?.online ? "#10b981" : "#8b7fa8";
    }

    // Reset unread counts
    resetUnreadCount();

    // Load Messages
    loadMessages();

    // Subscribe to Realtime Messages & Typing Indicators
    setupRealtime();

  } catch (err) {
    console.error("Chat boot error:", err);
  }
})();

async function resetUnreadCount() {
  if (!matchData) return;
  const isUser1 = matchData.user1_id === currentUser.id;
  await supabase
    .from("matches")
    .update(isUser1 ? { user1_unread: 0 } : { user2_unread: 0 })
    .eq("id", matchId);
}

async function loadMessages() {
  const { data: msgs, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading messages:", error);
    return;
  }

  renderMessages(msgs || []);
}

function renderMessages(msgs) {
  if (!messagesDiv) return;
  messagesDiv.innerHTML = "";

  if (msgs.length === 0) {
    messagesDiv.innerHTML = `<div class="empty-state">Say 👋 to break the ice!</div>`;
    return;
  }

  msgs.forEach(m => messagesDiv.appendChild(buildMessageBubble(m)));
  scrollToBottom();
}

function buildMessageBubble(m) {
  const div = document.createElement("div");
  const isMine = m.sender_id === currentUser.id;
  div.className = `message ${isMine ? "sent" : "received"}`;

  let content = "";
  if (m.text) {
    content += `<div class="msg-text">${esc(m.text)}</div>`;
  }
  if (m.image_url) {
    content += `<img class="msg-image" src="${m.image_url}" alt="Attachment" onclick="window.open('${m.image_url}', '_blank')">`;
  }
  if (m.file_url) {
    content += `<a class="msg-file" href="${m.file_url}" target="_blank">📎 ${esc(m.file_name || "Attachment")}</a>`;
  }

  const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  div.innerHTML = `
    <div class="msg-content">
      ${content}
      <span class="msg-time">${timeStr}</span>
    </div>
  `;

  return div;
}

function scrollToBottom() {
  if (messagesDiv) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// REALTIME SUBSCRIPTIONS
function setupRealtime() {
  const channel = supabase.channel(`chat_${matchId}`);

  channel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (payload) => {
      messagesDiv.appendChild(buildMessageBubble(payload.new));
      scrollToBottom();
      resetUnreadCount();
    })
    .on("broadcast", { event: "typing" }, (payload) => {
      if (payload.user_id !== currentUser.id && typingStatus) {
        typingStatus.style.display = "block";
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { typingStatus.style.display = "none"; }, 2500);
      }
    })
    .subscribe();

  // Broadcast typing indicator on input
  if (input) {
    input.addEventListener("input", () => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUser.id }
      });
    });
  }
}

// SEND MESSAGE FORM
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input ? input.value.trim() : "";
    if (!text) return;

    if (input) input.value = "";

    try {
      const { error } = await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: currentUser.id,
        text: text
      });

      if (error) throw error;
    } catch (err) {
      console.error("Send message error:", err);
    }
  });
}

// PHOTO / FILE UPLOADS
if (imageInput) {
  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const filePath = `chat_${matchId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: currentUser.id,
        image_url: urlData.publicUrl
      });
    } catch (err) {
      console.error("Image upload error:", err);
    }
  });
}

if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const filePath = `chat_${matchId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(filePath);

      await supabase.from("messages").insert({
        match_id: matchId,
        sender_id: currentUser.id,
        file_url: urlData.publicUrl,
        file_name: file.name
      });
    } catch (err) {
      console.error("File upload error:", err);
    }
  });
}

// Back button for mobile
if (backBtn) {
  backBtn.onclick = () => {
    if (window.parent) window.parent.postMessage("chat:back", "*");
  };
}

// Header More Options Menu (Three-dot)
const moreBtn = document.getElementById("moreBtn");
const chatMenu = document.getElementById("chatMenu");

if (moreBtn && chatMenu) {
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = chatMenu.style.display === "block";
    chatMenu.style.display = isOpen ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (chatMenu.style.display === "block") {
      const isClickInsideBtn = moreBtn.contains(e.target);
      const isClickInsideMenu = chatMenu.contains(e.target);
      if (!isClickInsideBtn && !isClickInsideMenu) {
        chatMenu.style.display = "none";
      }
    }
  });

  // Close the menu when any menu item inside is clicked
  chatMenu.addEventListener("click", () => {
    chatMenu.style.display = "none";
  });
}


function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}