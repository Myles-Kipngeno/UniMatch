// ═══════════════════════════════════════════════════════════════
// group-chat.js
// ═══════════════════════════════════════════════════════════════

import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs,
  query, orderBy, onSnapshot,
  serverTimestamp,
  arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ── Inline auth guard ──
function requireAuth() {
  return new Promise((resolve, reject) => {
    const current = auth.currentUser;
    if (current) { resolve(current); return; }
    const timeout = setTimeout(() => { unsub(); window.location.href = "login.html"; }, 8000);
    const unsub = auth.onAuthStateChanged(user => {
      clearTimeout(timeout);
      unsub();
      if (user) resolve(user);
      else window.location.href = "login.html";
    });
  });
}

// ── State ──
let currentUser = null;
let userData    = null;
let groupId     = null;
let groupData   = null;
let isMember    = false;
let isAdmin     = false;
let chatUnsub   = null;

// Reply state
let gcReplyMsg = null;

// Select-mode state
let gcSelectMode   = false;
let gcSelectedMsgs = new Set();

// Context-menu state
let gcCurrentMsgId   = null;
let gcCurrentMsgData = null;
let gcLastOpenMsgId  = null;
let gcIsMenuOpen     = false;

// ── Emoji catalogue ──
const GC_EMOJI_CATEGORIES = [
  { label: '😀', name: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'] },
  { label: '👋', name: 'People', emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅','👄','🫦','💋','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵'] },
  { label: '🐶', name: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈','🐊','🐅','🐆','🦓','🐘','🦛','🦏','🐪','🦒','🐃','🐄','🐎','🐖','🐏','🐑','🐕','🐩','🐈','🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🍃','🍂','🍁','🍄','🌾','💐','🌷','🌹','🌺','🌸','🌼','🌻'] },
  { label: '🍎', name: 'Food', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🥘','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧊','🥄','🍴','🍽️','🥢','🧂'] },
  { label: '⚽', name: 'Activity', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥍','🏑','🏏','🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🎮','🕹️','🎲','♟️','🎭','🎨','🖼️','🎰','🧩','🪆','🎪','🤹','🎠','🎡','🎢','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎫','🎟️','✨','🎉','🎊','🎁','🎀'] },
  { label: '🚗', name: 'Travel', emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🚲','🛴','🛹','🛼','⛽','🚨','🚥','🚦','🛑','🚧','⚓','⛵','🚤','🛥️','🛳️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🚀','🛸','🪐','🌍','🌎','🌏','🗺️','🧭','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🛖','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','🎑','🗾'] },
  { label: '💡', name: 'Objects', emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💰','🪙','💴','💵','💶','💷','💸','💳','🧾','💹','📈','📉','📊','📋','🗒️','🗓️','📆','📅','📁','📂','🗂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️','🗡️','⚔️','🛡️','🪚','🔧','🪛','🔩','⚙️','🗜️','⚖️','🦯','🔗','⛓️','🪝','🧲','🪜','🧰','🪣','🔬','🔭','📡','💊','🩺','🩻','🩹','🩼','🩸','🧬','🦠','🧪','🧫','🧯','🛁','🚿','🪠','🧴','🧷','🪡','🧹','🧺','🧻','🪣','🧼','🪥','🪒','🧽','🪤','🪑','🚪','🛏️','🛋️','🪞','🪟','🗑️','🛒','🎁','🎀','🎊','🎉','🎈','🎏','🎐','📦','📫','📪','📬','📭','📮','🗳️','✏️','✒️','🖋️','🖊️','📝','📓','📔','📒','📃','📜','📄','📰','🗞️','📑','🔖','🏷️','💰','🪙','📌','📍','✂️','🗃️','📐','📏','🖇️','📎','🔍','🔎','🔏','🔓','🔒','🔐'] },
  { label: '💬', name: 'Symbols', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','📶','🛜','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📵','🔕','🔇','🔔','🔊','🔉','🔈','📢','📣','🎵','🎶','🎙️','🎚️','🎛️','📻','🎤','🎧','📯','🃏','🀄','🎴','🎭','🎨','🖼️','🎠','🎡','🎢','💫','✨','🌟','⭐','🌠','🌌','🎇','🎆','🌈','🌤️','🌥️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','💧','💦','🌊','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔳','🔲','🏁','🚩','🎌','🏴','🏳️'] },
];
const GC_ALL_EMOJIS = GC_EMOJI_CATEGORIES.flatMap(c => c.emojis);

// ═══════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════
(async () => {
  try {
    const params = new URLSearchParams(location.search);
    groupId = params.get("id");
    if (!groupId) { location.href = "groups.html"; return; }

    currentUser = await requireAuth();
    try { await currentUser.reload(); currentUser = auth.currentUser; } catch (_) {}

    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
    userData = uSnap.exists() ? uSnap.data() : {};

    const resolvedPhoto = [
      currentUser.photoURL, userData.photoURL, userData.profilePhoto,
      userData.avatar, userData.photo, userData.profilePicture,
    ].find(p => p && typeof p === "string" && p.startsWith("http")) || null;

    userData.photoURL = resolvedPhoto;
    userData.name     = userData.name || currentUser.displayName || "";

    console.log("[UniMatch] Resolved photo:", resolvedPhoto);
    console.log("[UniMatch] User name:", userData.name);

    await loadGroup();
    setupUI();
    startChatListener();
  } catch (err) {
    console.error("group-chat.js boot error:", err);
  }
})();

// ═══════════════════════════════════════════════════
// LOAD GROUP
// ═══════════════════════════════════════════════════
async function loadGroup() {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) { alert("This group doesn't exist or was deleted."); location.href = "groups.html"; return; }

  groupData = { id: snap.id, ...snap.data() };
  isMember  = (groupData.members || []).includes(currentUser.uid);
  isAdmin   = groupData.createdBy === currentUser.uid;

  const count = groupData.memberCount || (groupData.members || []).length;
  document.getElementById("chatNavName").textContent    = groupData.name;
  document.getElementById("chatNavMembers").textContent = `${count} members`;
  document.title = `Chat · ${groupData.name} | UniMatch`;

  setAvatar(document.getElementById("chatAvatar"), document.getElementById("chatAvatarInitials"), userData.photoURL, userData.name);

  const clearBtn = document.getElementById("gcClearChat");
  if (clearBtn && isAdmin) clearBtn.style.display = "flex";
  const leaveBtn = document.getElementById("gcLeaveChat");
  if (leaveBtn) leaveBtn.style.display = isAdmin ? "none" : "flex";
}

// ═══════════════════════════════════════════════════
// SETUP UI
// ═══════════════════════════════════════════════════
function setupUI() {
  document.getElementById("chatBackBtn").onclick = () => {
    if (window.parent !== window) { window.parent.postMessage("chat:back", "*"); }
    else { location.href = `group.html?id=${groupId}`; }
  };

  document.getElementById("chatSendBtn").onclick = sendChatMessage;
  document.getElementById("chatInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  document.getElementById("chatFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) sendChatFile(file);
    e.target.value = "";
  });

  const moreBtn  = document.getElementById("chatMoreBtn");
  const dropMenu = document.getElementById("chatDropdownMenu");
  moreBtn.onclick = e => {
    e.stopPropagation();
    const isOpen = dropMenu.style.display === "block";
    gcCloseAllMenus();
    if (!isOpen) gcOpenMenu(dropMenu, false);
  };
  document.addEventListener("click", e => {
    if (dropMenu.style.display === "block" && !dropMenu.contains(e.target) && e.target !== moreBtn) {
      dropMenu.style.display = "none";
    }
  });

  document.getElementById("gcClearChat").onclick = async e => {
    e.stopPropagation(); gcCloseAllMenus();
    if (!confirm("Clear all messages? This cannot be undone.")) return;
    try {
      const snap = await getDocs(collection(db, "groups", groupId, "messages"));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      document.getElementById("chatMessages").innerHTML = '<p class="chat-empty-hint">Chat cleared.</p>';
    } catch (err) { console.error("Clear chat:", err); alert("Failed to clear chat."); }
  };

  const muteBtn   = document.getElementById("gcMuteBtn");
  const muteLabel = document.getElementById("gcMuteLabel");
  const mutedGroups = userData.mutedGroups || [];
  if (mutedGroups.includes(groupId)) muteLabel.textContent = "Unmute Notifications";
  muteBtn.onclick = async e => {
    e.stopPropagation(); gcCloseAllMenus();
    try {
      const userRef  = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const muted    = userSnap.data()?.mutedGroups || [];
      const isMuted  = muted.includes(groupId);
      await updateDoc(userRef, { mutedGroups: isMuted ? muted.filter(id => id !== groupId) : [...muted, groupId] });
      muteLabel.textContent = isMuted ? "Mute Notifications" : "Unmute Notifications";
      showToast(isMuted ? "Notifications unmuted" : "Notifications muted");
    } catch (err) { console.error("Mute:", err); }
  };

  document.getElementById("gcMediaBtn").onclick = e => { e.stopPropagation(); gcCloseAllMenus(); openGcMediaModal(); };
  document.getElementById("gcMediaClose").onclick = () => { document.getElementById("gcMediaModal").style.display = "none"; };
  document.querySelectorAll(".gc-media-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".gc-media-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".gc-media-section").forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      const t = tab.dataset.tab;
      if (t === "images") document.getElementById("gcMediaImages").classList.add("active");
      if (t === "files")  document.getElementById("gcMediaFiles").classList.add("active");
      if (t === "links")  document.getElementById("gcMediaLinks").classList.add("active");
    };
  });

  document.getElementById("gcLeaveChat").onclick = async e => {
    e.stopPropagation(); gcCloseAllMenus();
    if (!confirm("Leave this group?")) return;
    try {
      await updateDoc(doc(db, "groups", groupId), { members: arrayRemove(currentUser.uid), memberCount: increment(-1) });
      location.href = "groups.html";
    } catch (err) { console.error("Leave:", err); alert("Failed to leave."); }
  };

  document.getElementById("gcMenuOverlay").onclick = gcCloseAllMenus;

  document.getElementById("chatCancelSelect").onclick  = gcDeactivateSelect;
  document.getElementById("chatDeleteSelected").onclick = async () => {
    if (gcSelectedMsgs.size === 0) return;
    if (!confirm(`Delete ${gcSelectedMsgs.size} message(s)?`)) return;
    try {
      await Promise.all([...gcSelectedMsgs].map(id => deleteDoc(doc(db, "groups", groupId, "messages", id))));
      gcDeactivateSelect();
    } catch (err) { console.error("Delete selected:", err); alert("Failed to delete."); }
  };

  const ctxMenu = document.getElementById("gcContextMenu");
  ctxMenu.querySelectorAll(".gc-reaction-btn").forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      if (!emoji) {
        const savedRect = btn.getBoundingClientRect();
        gcCloseAllMenus();
        openGcEmojiPicker(null, savedRect);
        return;
      }
      await gcSaveReaction(gcCurrentMsgId, emoji);
      gcCloseAllMenus();
    };
  });
  ctxMenu.querySelectorAll(".gc-menu-item").forEach(item => {
    item.onclick = async e => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === "reply") {
        gcCloseAllMenus();
        gcActivateReply(gcCurrentMsgData);
      } else if (action === "select") {
        gcCloseAllMenus();
        gcActivateSelect(gcCurrentMsgId);
      } else if (action === "delete") {
        gcCloseAllMenus();
        if (!confirm("Delete this message?")) return;
        try {
          await deleteDoc(doc(db, "groups", groupId, "messages", gcCurrentMsgId));
        } catch (err) { console.error("Delete:", err); alert("Failed to delete."); }
      }
    };
  });

  document.getElementById("gcEmojiClose").onclick = gcCloseAllMenus;
  document.getElementById("gcEmojiSearch").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (q) {
      renderEmojiButtons("gcEmojiGrid", GC_ALL_EMOJIS.filter(em => em.includes(q)), "reaction");
      const tabBar = document.getElementById("gcEmojiTabs");
      if (tabBar) tabBar.style.display = "none";
    } else {
      buildGcEmojiGrid("gcEmojiGrid", GC_ALL_EMOJIS, "reaction");
    }
  });

  const chatEmojiBtn     = document.getElementById("chatEmojiBtn");
  const inputEmojiPicker = document.getElementById("gcInputEmojiPicker");
  const inputEmojiClose  = document.getElementById("gcInputEmojiClose");
  const inputEmojiSearch = document.getElementById("gcInputEmojiSearch");

  chatEmojiBtn.onclick = e => {
    e.stopPropagation();
    if (inputEmojiPicker.style.display === "flex") { inputEmojiPicker.style.display = "none"; return; }
    const r = chatEmojiBtn.getBoundingClientRect();
    const pickerW = 340, pickerH = 420;
    let left = r.left;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
    if (left < 8) left = 8;
    inputEmojiPicker.style.top  = `${Math.max(8, r.top - pickerH - 8)}px`;
    inputEmojiPicker.style.left = `${left}px`;
    buildGcEmojiGrid("gcInputEmojiGrid", GC_ALL_EMOJIS, "input");
    inputEmojiPicker.style.display = "flex";
    setTimeout(() => inputEmojiSearch?.focus(), 50);
  };
  inputEmojiClose.onclick = () => { inputEmojiPicker.style.display = "none"; };
  inputEmojiSearch.addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (q) {
      renderEmojiButtons("gcInputEmojiGrid", GC_ALL_EMOJIS.filter(em => em.includes(q)), "input");
      const tabBar = document.getElementById("gcInputEmojiTabs");
      if (tabBar) tabBar.style.display = "none";
    } else {
      buildGcEmojiGrid("gcInputEmojiGrid", GC_ALL_EMOJIS, "input");
    }
  });
  document.addEventListener("click", e => {
    if (inputEmojiPicker.style.display === "flex" && !inputEmojiPicker.contains(e.target) && e.target !== chatEmojiBtn) {
      inputEmojiPicker.style.display = "none";
    }
  }, { capture: true });
}

// ═══════════════════════════════════════════════════
// CLOSE / OPEN MENUS
// ═══════════════════════════════════════════════════
function gcCloseAllMenus() {
  const ctx = document.getElementById("gcContextMenu");
  const ep  = document.getElementById("gcEmojiPicker");
  const dd  = document.getElementById("chatDropdownMenu");
  const ov  = document.getElementById("gcMenuOverlay");
  if (ctx) ctx.style.display = "none";
  if (ep)  ep.style.display  = "none";
  if (dd)  dd.style.display  = "none";
  if (ov)  ov.style.display  = "none";
  gcLastOpenMsgId = null;
  gcIsMenuOpen    = false;
}
function gcOpenMenu(el, useOverlay = true) {
  const ov = document.getElementById("gcMenuOverlay");
  if (ov && useOverlay) ov.style.display = "block";
  el.style.display = "block";
}

// ═══════════════════════════════════════════════════
// REAL-TIME CHAT LISTENER
// ═══════════════════════════════════════════════════
function startChatListener() {
  const q = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"));

  chatUnsub = onSnapshot(q, snap => {
    if (gcSelectMode) {
      snap.docChanges().forEach(change => {
        if (change.type === "modified") {
          const msg = { id: change.doc.id, ...change.doc.data() };
          const existing = document.querySelector(`[data-msg-id="${msg.id}"]`);
          if (existing) {
            const updated = buildChatBubble(msg);
            updated.classList.add("gc-select-mode");
            if (gcSelectedMsgs.has(msg.id)) updated.classList.add("gc-selected");
            existing.replaceWith(updated);
          }
        }
        if (change.type === "removed") {
          gcSelectedMsgs.delete(change.doc.id);
          const existing = document.querySelector(`[data-msg-id="${change.doc.id}"]`);
          if (existing) existing.remove();
          const countEl = document.getElementById("chatSelectedCount");
          if (countEl) countEl.textContent = `${gcSelectedMsgs.size} selected`;
        }
      });
      return;
    }

    const msgs = document.getElementById("chatMessages");
    msgs.innerHTML = "";
    if (snap.empty) { msgs.innerHTML = '<p class="chat-empty-hint">No messages yet. Say hello! 👋</p>'; return; }

    let lastDate = null;
    snap.docs.forEach(d => {
      const msg = { id: d.id, ...d.data() };
      if (msg.createdAt) {
        const dateStr = msg.createdAt.toDate().toDateString();
        if (dateStr !== lastDate) {
          const sep = document.createElement("div");
          sep.className = "gc-date-sep";
          const today = new Date().toDateString();
          const yest  = new Date(Date.now() - 86400000).toDateString();
          sep.textContent = dateStr === today ? "Today" : dateStr === yest ? "Yesterday"
            : new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          msgs.appendChild(sep);
          lastDate = dateStr;
        }
      }
      msgs.appendChild(buildChatBubble(msg));
    });
    msgs.scrollTop = msgs.scrollHeight;
  }, err => {
    console.error("Chat listener error:", err);
    document.getElementById("chatMessages").innerHTML =
      `<p class="chat-empty-hint" style="color:#dc2626">Failed to load messages: ${err.message}</p>`;
  });
}

// ═══════════════════════════════════════════════════
// BUILD CHAT BUBBLE
// ═══════════════════════════════════════════════════
function buildChatBubble(msg) {
  const div  = document.createElement("div");
  const isMe = msg.authorId === currentUser.uid;
  div.className = `chat-msg${isMe ? " own" : ""}`;
  div.dataset.msgId = msg.id;
  div.setAttribute("data-msg-id", msg.id);

  // Avatar
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "chat-msg-avatar-wrap";
  const avatarImg = document.createElement("img");
  avatarImg.className = "chat-msg-avatar";
  const avatarInitials = document.createElement("div");
  avatarInitials.className = "chat-msg-avatar-initials";
  avatarWrap.appendChild(avatarImg);
  avatarWrap.appendChild(avatarInitials);
  setAvatar(avatarImg, avatarInitials, msg.authorPhoto, msg.authorName);

  // Bubble
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  if (!isMe) {
    const sender = document.createElement("div");
    sender.className   = "chat-sender";
    sender.textContent = msg.authorName || "Student";
    bubble.appendChild(sender);
  }

  // ── Reply quote ──
  if (msg.replyTo) {
    const rExt   = (msg.replyTo.fileName || "").split(".").pop().toLowerCase();
    const rIsImg = ["jpg","jpeg","png","gif","webp"].includes(rExt);
    const rIsVid = ["mp4","webm","ogg","mov","mkv"].includes(rExt);

    const quote = document.createElement("div");
    quote.style.cssText = "display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.25); border-left:3px solid #00c9a7; border-radius:6px; padding:6px 10px; margin-bottom:6px; overflow:hidden;";

    const qText = document.createElement("div");
    qText.style.cssText = "flex:1; min-width:0;";

    const qName = document.createElement("div");
    qName.style.cssText = "font-size:11px; font-weight:700; color:#00c9a7; margin-bottom:2px;";
    qName.textContent = msg.replyTo.authorName || "Student";

    const qPreview = document.createElement("div");
    qPreview.style.cssText = "font-size:12px; color:rgba(255,255,255,0.55); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    qPreview.textContent = msg.replyTo.text || "";

    qText.appendChild(qName);
    qText.appendChild(qPreview);
    quote.appendChild(qText);

    // Show thumbnail if the replied-to message was an image or video
    if (msg.replyTo.fileUrl && (rIsImg || rIsVid)) {
      const thumb = document.createElement(rIsImg ? "img" : "video");
      thumb.src = msg.replyTo.fileUrl;
      if (rIsVid) { thumb.muted = true; thumb.preload = "metadata"; }
      thumb.style.cssText = "width:40px; height:40px; object-fit:cover; border-radius:4px; flex-shrink:0; background:#000;";
      quote.appendChild(thumb);
    }

    bubble.appendChild(quote);
  }

  // ── File / text content ──
  if (msg.fileUrl) {
    const ext     = (msg.fileName || "").split(".").pop().toLowerCase();
    const isImage = ["jpg","jpeg","png","gif","webp"].includes(ext);
    const isVideo = ["mp4","webm","ogg","mov","mkv"].includes(ext);

    if (isImage) {
      bubble.classList.add("image-bubble");
      const img = document.createElement("img");
      img.src       = msg.fileUrl;
      img.className = "chat-msg-image";
      img.alt       = msg.fileName || "Image";
      img.onclick   = () => openImageLightbox(msg.fileUrl, msg.fileName);
      bubble.appendChild(img);
    } else if (isVideo) {
      bubble.classList.add("image-bubble");
      const videoWrap = document.createElement("div");
      videoWrap.style.cssText = "position:relative; display:inline-block; cursor:pointer; border-radius:12px; overflow:hidden; max-width:220px; width:100%;";
      const thumb = document.createElement("video");
      thumb.src      = msg.fileUrl;
      thumb.muted    = true;
      thumb.preload  = "metadata";
      thumb.style.cssText = "display:block; width:100%; max-height:220px; object-fit:cover; border-radius:12px; background:#000;";
      const playBtn = document.createElement("div");
      playBtn.style.cssText = "position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.35);";
      playBtn.innerHTML = `<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.3);"><svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21"/></svg></div>`;
      videoWrap.appendChild(thumb);
      videoWrap.appendChild(playBtn);
      videoWrap.onclick = () => openVideoLightbox(msg.fileUrl, msg.fileName);
      bubble.appendChild(videoWrap);
    } else {
      const link = document.createElement("a");
      link.className = "chat-file-bubble";
      link.href      = msg.fileUrl;
      link.target    = "_blank";
      link.rel       = "noopener";
      link.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5"/></svg>`;
      link.appendChild(document.createTextNode(msg.fileName || "File"));
      bubble.appendChild(link);
    }
  } else {
    const text = document.createElement("div");
    text.className   = "chat-text";
    text.textContent = msg.text || "";
    bubble.appendChild(text);
  }

  const time = document.createElement("div");
  time.className   = "chat-time";
  time.textContent = formatTime(msg.createdAt);
  bubble.appendChild(time);

  // Reactions
  if (msg.reactions && Object.keys(msg.reactions).length > 0) {
    const counts = {};
    Object.values(msg.reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    const reactRow = document.createElement("div");
    reactRow.className = "gc-reactions-row";
    Object.entries(counts).forEach(([emoji, count]) => {
      const pill = document.createElement("button");
      pill.className = "gc-reaction-pill";
      if (msg.reactions[currentUser.uid] === emoji) pill.classList.add("mine");
      pill.appendChild(document.createTextNode(emoji));
      if (count > 1) {
        const cSpan = document.createElement("span");
        cSpan.textContent = count;
        pill.appendChild(cSpan);
      }
      pill.onclick = async e => { e.stopPropagation(); await gcSaveReaction(msg.id, emoji); };
      reactRow.appendChild(pill);
    });
    bubble.appendChild(reactRow);
  }

  // Menu button
  const menuBtn = document.createElement("button");
  menuBtn.className = "gc-msg-menu-btn";
  menuBtn.title     = "Message options";
  menuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  menuBtn.onclick = e => {
    e.stopPropagation();
    gcCurrentMsgId   = msg.id;
    gcCurrentMsgData = msg;
    const ctxMenu = document.getElementById("gcContextMenu");
    if (!ctxMenu) return;
    if (gcIsMenuOpen && gcLastOpenMsgId === msg.id) { gcCloseAllMenus(); return; }
    gcCloseAllMenus();
    const delBtn = ctxMenu.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.style.display = (isMe || isAdmin) ? "flex" : "none";
    const r = menuBtn.getBoundingClientRect();
    const menuW = 248, menuH = 220;
    let left = isMe ? r.left - menuW - 6 : r.right + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    let top = r.bottom + 6;
    if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 6;
    ctxMenu.style.top    = `${Math.max(8, top)}px`;
    ctxMenu.style.left   = `${left}px`;
    ctxMenu.style.right  = "auto";
    ctxMenu.style.bottom = "auto";
    gcIsMenuOpen    = true;
    gcLastOpenMsgId = msg.id;
    gcOpenMenu(ctxMenu);
  };

  // Button lives inside the bubble so it only appears on bubble hover
  bubble.appendChild(menuBtn);

  if (!isMe) div.appendChild(avatarWrap);
  div.appendChild(bubble);
  if (isMe) div.appendChild(avatarWrap);

  div.addEventListener("click", e => {
    if (!gcSelectMode) return;
    e.stopPropagation();
    if (gcSelectedMsgs.has(msg.id)) { gcSelectedMsgs.delete(msg.id); div.classList.remove("gc-selected"); }
    else { gcSelectedMsgs.add(msg.id); div.classList.add("gc-selected"); }
    const countEl = document.getElementById("chatSelectedCount");
    if (countEl) countEl.textContent = `${gcSelectedMsgs.size} selected`;
  });

  return div;
}

// ═══════════════════════════════════════════════════
// SELECT MODE
// ═══════════════════════════════════════════════════
function gcActivateSelect(firstMsgId) {
  gcSelectMode = true;
  gcSelectedMsgs.clear();
  document.getElementById("chatSelectToolbar").style.display = "flex";
  document.getElementById("chatComposeBar").style.display    = "none";
  document.querySelectorAll(".chat-msg").forEach(el => {
    el.classList.add("gc-select-mode");
    el.classList.remove("gc-selected");
    if (firstMsgId && el.getAttribute("data-msg-id") === firstMsgId) {
      el.classList.add("gc-selected");
      gcSelectedMsgs.add(firstMsgId);
    }
  });
  const countEl = document.getElementById("chatSelectedCount");
  if (countEl) countEl.textContent = `${gcSelectedMsgs.size} selected`;
}

function gcDeactivateSelect() {
  gcSelectMode = false;
  gcSelectedMsgs.clear();
  document.getElementById("chatSelectToolbar").style.display = "none";
  document.getElementById("chatComposeBar").style.display    = "flex";
  document.querySelectorAll(".chat-msg").forEach(el => el.classList.remove("gc-select-mode", "gc-selected"));
  const countEl = document.getElementById("chatSelectedCount");
  if (countEl) countEl.textContent = "0 selected";
}

// ═══════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════
async function gcSaveReaction(msgId, emoji) {
  if (!msgId) return;
  try {
    const msgRef  = doc(db, "groups", groupId, "messages", msgId);
    const msgSnap = await getDoc(msgRef);
    const existing = msgSnap.data()?.reactions || {};
    if (existing[currentUser.uid] === emoji) delete existing[currentUser.uid];
    else existing[currentUser.uid] = emoji;
    await updateDoc(msgRef, { reactions: existing });
  } catch (err) { console.error("Reaction:", err); }
}

function openGcEmojiPicker(triggerBtn, savedRect) {
  const picker  = document.getElementById("gcEmojiPicker");
  const pickerW = 340, pickerH = 420;
  buildGcEmojiGrid("gcEmojiGrid", GC_ALL_EMOJIS, "reaction");
  const r = savedRect || (triggerBtn ? triggerBtn.getBoundingClientRect() : null);
  if (r && (r.width > 0 || r.height > 0 || r.left > 0 || r.top > 0)) {
    let left = r.left + r.width / 2 - pickerW / 2;
    let top  = r.bottom + 8;
    if (top + pickerH > window.innerHeight - 8) top = r.top - pickerH - 8;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8));
    top  = Math.max(8, top);
    picker.style.top  = `${top}px`;
    picker.style.left = `${left}px`;
  } else {
    picker.style.top  = `${(window.innerHeight - pickerH) / 2}px`;
    picker.style.left = `${(window.innerWidth  - pickerW) / 2}px`;
  }
  const ov = document.getElementById("gcMenuOverlay");
  if (ov) ov.style.display = "block";
  picker.style.display = "flex";
  setTimeout(() => document.getElementById("gcEmojiSearch")?.focus(), 60);
}

function buildGcEmojiGrid(gridId, emojis, mode = "reaction") {
  const isInput  = mode === "input";
  const pickerId = isInput ? "gcInputEmojiPicker" : "gcEmojiPicker";
  const picker   = document.getElementById(pickerId);
  if (!picker) return;
  const isSearch = emojis !== GC_ALL_EMOJIS && emojis.length !== GC_ALL_EMOJIS.length;
  const tabBarId = isInput ? "gcInputEmojiTabs" : "gcEmojiTabs";
  let tabBar = document.getElementById(tabBarId);
  if (!tabBar) {
    tabBar = document.createElement("div");
    tabBar.id = tabBarId;
    tabBar.className = "gc-emoji-tabs";
    const grid = document.getElementById(gridId);
    picker.insertBefore(tabBar, grid);
  }
  tabBar.style.display = isSearch ? "none" : "flex";
  if (!tabBar.dataset.built) {
    tabBar.dataset.built = "1";
    const allTab = document.createElement("button");
    allTab.className = "gc-emoji-tab-btn active"; allTab.textContent = "🔥"; allTab.title = "All"; allTab.dataset.cat = "all";
    tabBar.appendChild(allTab);
    GC_EMOJI_CATEGORIES.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "gc-emoji-tab-btn"; btn.textContent = cat.label; btn.title = cat.name; btn.dataset.cat = cat.name;
      tabBar.appendChild(btn);
    });
    tabBar.addEventListener("click", e => {
      const btn = e.target.closest(".gc-emoji-tab-btn");
      if (!btn) return;
      tabBar.querySelectorAll(".gc-emoji-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.cat;
      renderEmojiButtons(gridId, cat === "all" ? GC_ALL_EMOJIS : (GC_EMOJI_CATEGORIES.find(c => c.name === cat)?.emojis || []), mode);
    });
  }
  renderEmojiButtons(gridId, isSearch ? emojis : GC_ALL_EMOJIS, mode);
  if (!isSearch) {
    tabBar.querySelectorAll(".gc-emoji-tab-btn").forEach(b => b.classList.remove("active"));
    const allBtn = tabBar.querySelector('[data-cat="all"]');
    if (allBtn) allBtn.classList.add("active");
  }
}

function renderEmojiButtons(gridId, emojis, mode) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";
  emojis.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className   = "gc-emoji-btn";
    btn.textContent = emoji;
    btn.onclick = async e => {
      e.stopPropagation();
      if (mode === "input") {
        const inp = document.getElementById("chatInput");
        if (inp) {
          const pos    = inp.selectionStart ?? inp.value.length;
          inp.value    = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
          inp.selectionStart = inp.selectionEnd = pos + emoji.length;
          inp.focus();
        }
        document.getElementById("gcInputEmojiPicker").style.display = "none";
      } else {
        await gcSaveReaction(gcCurrentMsgId, emoji);
        gcCloseAllMenus();
      }
    };
    grid.appendChild(btn);
  });
}

// ═══════════════════════════════════════════════════
// MEDIA & FILES MODAL
// ═══════════════════════════════════════════════════
async function openGcMediaModal() {
  const modal = document.getElementById("gcMediaModal");
  if (!modal) return;
  modal.style.display = "flex";
  try {
    const snap = await getDocs(query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "desc")));
    const images = [], videos = [], files = [], links = [];
    snap.docs.forEach(d => {
      const m = d.data();
      if (m.fileUrl && m.fileName) {
        const ext = (m.fileName || "").split(".").pop().toLowerCase();
        if (["jpg","jpeg","png","gif","webp"].includes(ext))      images.push(m);
        else if (["mp4","webm","ogg","mov","mkv"].includes(ext))  videos.push(m);
        else                                                        files.push(m);
      }
      if (m.text) {
        const found = m.text.match(/(https?:\/\/[^\s]+)/g);
        if (found) found.forEach(l => links.push({ url: l, createdAt: m.createdAt }));
      }
    });

    // Images + Videos grid — both rendered as thumbnails in the same existing grid
    const imageGrid = document.getElementById("gcImageGrid");
    imageGrid.innerHTML = "";

    if (images.length === 0 && videos.length === 0) {
      imageGrid.innerHTML = '<p class="gc-empty-media">No media shared yet</p>';
    } else {
      // Render images
      images.forEach(m => {
        const wrap = document.createElement("div");
        wrap.className = "gc-media-thumb";
        wrap.style.cssText = "position:relative; cursor:pointer;";
        const img = document.createElement("img");
        img.src   = m.fileUrl;
        img.alt   = m.fileName || "Image";
        img.style.cssText = "width:100%; height:100%; object-fit:cover; border-radius:10px; display:block;";
        wrap.appendChild(img);
        wrap.onclick = () => openImageLightbox(m.fileUrl, m.fileName);
        imageGrid.appendChild(wrap);
      });

      // Render videos as thumbnail frames + play button overlay
      videos.forEach(m => {
        const wrap = document.createElement("div");
        wrap.className = "gc-media-thumb";
        wrap.style.cssText = "position:relative; cursor:pointer;";

        const vid = document.createElement("video");
        vid.src     = m.fileUrl;
        vid.muted   = true;
        vid.preload = "metadata";
        // Seek to 1s so an actual frame shows instead of a black screen
        vid.addEventListener("loadedmetadata", () => { try { vid.currentTime = 1; } catch(_) {} });
        vid.style.cssText = "width:100%; height:100%; object-fit:cover; border-radius:10px; display:block; background:#111;";

        const overlay = document.createElement("div");
        overlay.style.cssText = "position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.35); border-radius:10px; pointer-events:none;";
        overlay.innerHTML = '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><svg width="14" height="14" viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21"/></svg></div>';

        wrap.appendChild(vid);
        wrap.appendChild(overlay);
        wrap.onclick = () => openVideoLightbox(m.fileUrl, m.fileName);
        imageGrid.appendChild(wrap);
      });
    }

    // Files list (docs, pdfs, zips — no images or videos here)
    document.getElementById("gcFilesList").innerHTML = files.length
      ? files.map(m => `<a class="gc-file-row" href="${m.fileUrl}" target="_blank" rel="noopener"><span class="gc-file-icon">📄</span><span class="gc-file-name">${escHtml(m.fileName)}</span></a>`).join("")
      : '<p class="gc-empty-media">No files shared yet</p>';
    // Links list
    document.getElementById("gcLinksList").innerHTML = links.length
      ? links.map(l => `<a class="gc-link-row" href="${l.url}" target="_blank" rel="noopener">🔗 ${escHtml(l.url.length > 55 ? l.url.slice(0,55) + "…" : l.url)}</a>`).join("")
      : '<p class="gc-empty-media">No links shared yet</p>';

  } catch (err) { console.error("Media modal:", err); }
}

// ═══════════════════════════════════════════════════
// REPLY
// ═══════════════════════════════════════════════════
function gcActivateReply(msg) {
  gcReplyMsg = msg;

  // Remove stale bar — always rebuild fresh so content is current
  document.getElementById("gcReplyBar")?.remove();

  const bar = document.createElement("div");
  bar.id = "gcReplyBar";
  bar.style.cssText = "display:flex; align-items:center; gap:0; background:#1e2330; border-top:1px solid rgba(255,255,255,0.07); overflow:hidden;";

  // Solid teal left accent bar (full height)
  const accent = document.createElement("div");
  accent.style.cssText = "width:4px; background:#00c9a7; align-self:stretch; flex-shrink:0;";

  // Inner content (name + preview + optional thumb)
  const inner = document.createElement("div");
  inner.style.cssText = "flex:1; min-width:0; display:flex; align-items:center; gap:10px; padding:10px 12px;";

  // Text column
  const textCol = document.createElement("div");
  textCol.style.cssText = "flex:1; min-width:0;";

  const senderName = msg.authorId === currentUser.uid ? "You" : (msg.authorName || "Student");

  const nameEl = document.createElement("div");
  nameEl.style.cssText = "font-size:12px; font-weight:700; color:#00c9a7; font-family:Outfit,sans-serif; margin-bottom:2px;";
  nameEl.textContent = senderName;

  const previewEl = document.createElement("div");
  previewEl.style.cssText = "font-size:12px; color:rgba(255,255,255,0.5); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:Outfit,sans-serif;";

  const ext    = (msg.fileName || "").split(".").pop().toLowerCase();
  const isImg  = ["jpg","jpeg","png","gif","webp"].includes(ext);
  const isVid  = ["mp4","webm","ogg","mov","mkv"].includes(ext);
  const hasMedia = msg.fileUrl && (isImg || isVid);

  if (hasMedia) {
    previewEl.textContent = isImg ? "📷 Photo" : "🎥 Video";
  } else {
    const txt = msg.text || (msg.fileName ? `📎 ${msg.fileName}` : "");
    previewEl.textContent = txt.length > 70 ? txt.slice(0, 70) + "…" : txt;
  }

  textCol.appendChild(nameEl);
  textCol.appendChild(previewEl);
  inner.appendChild(textCol);

  // Thumbnail for image/video replies
  if (hasMedia) {
    const thumb = document.createElement(isImg ? "img" : "video");
    thumb.src = msg.fileUrl;
    if (isVid) { thumb.muted = true; thumb.preload = "metadata"; }
    thumb.style.cssText = "width:48px; height:48px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#000;";
    inner.appendChild(thumb);
  }

  // Cancel (✕) button
  const cancelBtn = document.createElement("button");
  cancelBtn.style.cssText = "background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.4); padding:10px 12px; align-self:stretch; display:flex; align-items:center; flex-shrink:0;";
  cancelBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  cancelBtn.onclick = gcCancelReply;

  bar.appendChild(accent);
  bar.appendChild(inner);
  bar.appendChild(cancelBtn);

  // Insert directly above the compose bar
  const compose = document.getElementById("chatComposeBar");
  compose.parentNode.insertBefore(bar, compose);

  document.getElementById("chatInput").focus();
}
function gcCancelReply() {
  gcReplyMsg = null;
  document.getElementById("gcReplyBar")?.remove();
}

// ═══════════════════════════════════════════════════
// SEND MESSAGE / FILE
// ═══════════════════════════════════════════════════
async function sendChatMessage() {
  if (!isMember) return;
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";

  const payload = {
    text,
    authorId:    currentUser.uid,
    authorName:  userData.name || currentUser.displayName || "Student",
    authorPhoto: userData.photoURL || null,
    reactions:   {},
    deleted:     false,
    createdAt:   serverTimestamp()
  };

  if (gcReplyMsg) {
    const rExt   = (gcReplyMsg.fileName || "").split(".").pop().toLowerCase();
    const rIsImg = ["jpg","jpeg","png","gif","webp"].includes(rExt);
    const rIsVid = ["mp4","webm","ogg","mov","mkv"].includes(rExt);
    payload.replyTo = {
      msgId:      gcReplyMsg.id,
      authorName: gcReplyMsg.authorName || "Student",
      text:       gcReplyMsg.text || (rIsImg ? "📷 Photo" : rIsVid ? "🎥 Video" : gcReplyMsg.fileName ? `📎 ${gcReplyMsg.fileName}` : ""),
      fileUrl:    gcReplyMsg.fileUrl  || null,
      fileName:   gcReplyMsg.fileName || null,
    };
    gcCancelReply();
  }

  try {
    await addDoc(collection(db, "groups", groupId, "messages"), payload);
    await updateDoc(doc(db, "groups", groupId), {
      lastMessage:   text,
      lastMessageAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Chat send:", err);
    input.value = text;
  }
}

async function sendChatFile(file) {
  if (!isMember) return;
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path     = `group-chat/${groupId}/${Date.now()}_${safeName}`;
    const res      = await uploadBytes(ref(storage, path), file);
    const fileUrl  = await getDownloadURL(res.ref);
    await addDoc(collection(db, "groups", groupId, "messages"), {
      fileUrl,
      fileName:    file.name,
      authorId:    currentUser.uid,
      authorName:  userData.name || currentUser.displayName || "Student",
      authorPhoto: userData.photoURL || null,
      createdAt:   serverTimestamp()
    });
    await updateDoc(doc(db, "groups", groupId), {
      lastMessage:   "📎 " + file.name,
      lastMessageAt: serverTimestamp()
    });
  } catch (err) { console.error("Chat file:", err); alert("Failed to send file."); }
}

// ═══════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const toast = document.getElementById("groupToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function formatTime(ts) {
  if (!ts) return "";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ═══════════════════════════════════════════════════
// IMAGE LIGHTBOX
// ═══════════════════════════════════════════════════
function openImageLightbox(src, name) {
  document.getElementById("gcLightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "gcLightbox";
  overlay.style.cssText = "position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center;";
  const card = document.createElement("div");
  card.style.cssText = "background:#1a1a2e; border-radius:20px; overflow:hidden; width:min(680px,92vw); box-shadow:0 24px 64px rgba(0,0,0,0.5); display:flex; flex-direction:column;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:rgba(255,255,255,0.06);";
  const title = document.createElement("span");
  title.textContent = name || "Image";
  title.style.cssText = "color:white; font-size:13px; font-weight:600; font-family:Outfit,sans-serif; opacity:0.85; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  closeBtn.style.cssText = "background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;";
  closeBtn.onclick = () => overlay.remove();
  bar.appendChild(title);
  bar.appendChild(closeBtn);
  const img = document.createElement("img");
  img.src = src;
  img.alt = name || "Image";
  img.style.cssText = "width:100%; max-height:88vh; object-fit:contain; display:block; background:#111;";
  card.appendChild(bar);
  card.appendChild(img);
  overlay.appendChild(card);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener("keydown", function onKey(e) { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); } });
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════
// VIDEO LIGHTBOX
// ═══════════════════════════════════════════════════
function openVideoLightbox(src, name) {
  document.getElementById("gcVideoLightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "gcVideoLightbox";
  overlay.style.cssText = "position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center;";
  const card = document.createElement("div");
  card.style.cssText = "background:#0d0d1a; border-radius:20px; overflow:hidden; width:min(680px,92vw); box-shadow:0 24px 64px rgba(0,0,0,0.6); display:flex; flex-direction:column;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:rgba(255,255,255,0.05);";
  const title = document.createElement("span");
  title.textContent = name || "Video";
  title.style.cssText = "color:white; font-size:13px; font-weight:600; font-family:Outfit,sans-serif; opacity:0.85; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  closeBtn.style.cssText = "background:rgba(255,255,255,0.1); border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center;";
  const video = document.createElement("video");
  video.src      = src;
  video.controls = true;
  video.autoplay = true;
  video.style.cssText = "width:100%; max-height:88vh; object-fit:contain; display:block; background:#000;";
  closeBtn.onclick = () => { video.pause(); overlay.remove(); };
  bar.appendChild(title);
  bar.appendChild(closeBtn);
  card.appendChild(bar);
  card.appendChild(video);
  overlay.appendChild(card);
  overlay.addEventListener("click", e => { if (e.target === overlay) { video.pause(); overlay.remove(); } });
  document.addEventListener("keydown", function onKey(e) { if (e.key === "Escape") { video.pause(); overlay.remove(); document.removeEventListener("keydown", onKey); } });
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════════════════
// AVATAR
// ═══════════════════════════════════════════════════
function setAvatar(imgEl, initialsEl, photoURL, name) {
  if (photoURL) {
    imgEl.src = photoURL;
    imgEl.style.display      = "block";
    initialsEl.style.display = "none";
    imgEl.onerror = () => {
      imgEl.style.display      = "none";
      initialsEl.style.display = "flex";
      initialsEl.textContent   = getInitials(name);
    };
  } else {
    imgEl.style.display      = "none";
    initialsEl.style.display = "flex";
    initialsEl.textContent   = getInitials(name);
  }
}