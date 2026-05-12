import { auth, db, storage } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, getDocs,
  query, where, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { requireAuth } from "./auth-guard.js";

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES
// ─────────────────────────────────────────────────────────────
// group.js powers the individual Study Group page (group.html).
//
// Tabs handled here:
//   Feed     — group-scoped posts (text / question / note / link)
//   Chat     — navigates to group-chat.html (standalone page)
//   Files    — shared file library (upload / download / delete)
//   Members  — member list; admin can remove anyone
//
// Requires ?id=<groupId> in the URL.
// ─────────────────────────────────────────────────────────────

const GROUP_EMOJIS = ["📚","🎓","🔬","⚖️","💻","🧬","📐","🏛️","🧪","📊","🌍","✏️"];
const TYPE_LABELS  = { text:"Post", question:"Question", note:"Note", resource:"Resource" };

let currentUser = null;
let userData    = null;
let groupId     = null;
let groupData   = null;
let isMember    = false;
let isAdmin     = false;
let postingType = "text";
let noteFile    = null;
let postsUnsub  = null;
let editSelectedCourse = "";

// ══════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════
(async () => {
  try {
    const params = new URLSearchParams(location.search);
    groupId = params.get("id");

    if (!groupId) {
      location.href = "groups.html";
      return;
    }

    currentUser = await requireAuth();

    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
    userData = uSnap.exists() ? uSnap.data() : {};

    await loadGroup();
    setupUI();
    startFeedListener();

  } catch (err) {
    console.error("Group page error:", err);
  }
})();

// ══════════════════════════════════════════════════
// LOAD GROUP
// ══════════════════════════════════════════════════
async function loadGroup() {
  const snap = await getDoc(doc(db, "groups", groupId));

  if (!snap.exists()) {
    alert("This group doesn't exist or was deleted.");
    location.href = "groups.html";
    return;
  }

  groupData = { id: snap.id, ...snap.data() };
  isMember  = (groupData.members || []).includes(currentUser.uid);
  isAdmin   = groupData.createdBy === currentUser.uid;

  const emoji = GROUP_EMOJIS[hashCode(groupId) % GROUP_EMOJIS.length];
  const count = groupData.memberCount || (groupData.members || []).length;

  document.getElementById("heroEmoji").textContent       = emoji;
  document.getElementById("heroCourse").textContent      = groupData.course || "General";
  document.getElementById("heroName").textContent        = groupData.name;
  document.getElementById("heroDesc").textContent        = groupData.description || "";
  document.getElementById("heroMemberCount").textContent = `${count} members`;
  document.getElementById("heroCreator").textContent     = `Created by ${groupData.creatorName || "Unknown"}`;
  document.getElementById("breadcrumbName").textContent  = groupData.name;
  document.title = `${groupData.name} | UniMatch`;

  document.getElementById("memberTabCount").textContent = count;

  const avatarSrc = userData.photoURL || "./assets/images/default-avatar.png";
  document.getElementById("feedAvatar").src = avatarSrc;

  if (!isMember) {
    const heroActions = document.getElementById("heroActions");
    const joinBtn     = document.createElement("button");
    joinBtn.className   = "btn-join-hero";
    joinBtn.textContent = "Join Group";
    joinBtn.onclick     = handleJoinGroup;
    heroActions.appendChild(joinBtn);
  }

  if (isMember && !isAdmin) {
    document.getElementById("leaveGroupBtn").style.display = "inline-flex";
  }

  if (isAdmin) {
    document.getElementById("deleteGroupBtn").style.display = "inline-flex";
    document.getElementById("editGroupBtn").style.display   = "inline-flex";
  }

  document.getElementById("openPostBtn").style.display = isMember ? "block" : "none";
}

// ══════════════════════════════════════════════════
// JOIN GROUP
// ══════════════════════════════════════════════════
async function handleJoinGroup() {
  try {
    await updateDoc(doc(db, "groups", groupId), {
      members:     arrayUnion(currentUser.uid),
      memberCount: increment(1)
    });
    location.reload();
  } catch (err) {
    console.error("Join error:", err);
    alert("Failed to join group.");
  }
}

// ══════════════════════════════════════════════════
// SETUP UI
// ══════════════════════════════════════════════════
function setupUI() {

  // Edit Group button
  const editBtn = document.getElementById("editGroupBtn");
  if (editBtn) editBtn.onclick = openEditModal;

  document.getElementById("closeEditModal").onclick  = closeEditModal;
  document.getElementById("cancelEditBtn").onclick   = closeEditModal;
  document.getElementById("editGroupModal").onclick  = e => {
    if (e.target === document.getElementById("editGroupModal")) closeEditModal();
  };
  document.getElementById("editGroupForm").addEventListener("submit", handleSaveEdit);

  document.getElementById("editCourseChangeBtn").onclick = () => {
    document.getElementById("editCourseBar").style.display           = "none";
    document.getElementById("editAccordionContainer").style.display  = "flex";
    editSelectedCourse = "";
  };

  document.getElementById("editGroupDesc").addEventListener("input", e => {
    document.getElementById("editDescCount").textContent = e.target.value.length;
  });

  document.getElementById("editIsPublic").addEventListener("change", e => {
    document.getElementById("editVisibilityLabel").textContent =
      e.target.checked ? "Public" : "Private";
  });

  document.getElementById("editCourseCustom").addEventListener("input", () => {
    if (document.getElementById("editCourseCustom").value.trim()) {
      editSelectedCourse = "";
      document.querySelectorAll("#editAccordionWrap .course-chip.selected")
        .forEach(c => c.classList.remove("selected"));
    }
  });

  buildEditAccordion();

  // Leave group
  const leaveBtn = document.getElementById("leaveGroupBtn");
  if (leaveBtn) {
    leaveBtn.onclick = async () => {
      if (!confirm("Leave this group?")) return;
      try {
        await updateDoc(doc(db, "groups", groupId), {
          members:     arrayRemove(currentUser.uid),
          memberCount: increment(-1)
        });
        location.href = "groups.html";
      } catch (err) {
        console.error("Leave error:", err);
        alert("Failed to leave group.");
      }
    };
  }

  // Delete group — admin only
  const deleteBtn = document.getElementById("deleteGroupBtn");
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const confirmed = confirm(
        `Delete "${groupData.name}"?\n\nThis permanently removes the group for all ${(groupData.members||[]).length} members and cannot be undone.`
      );
      if (!confirmed) return;
      deleteBtn.disabled    = true;
      deleteBtn.textContent = "Deleting...";
      try {
        await deleteDoc(doc(db, "groups", groupId));
        location.href = "groups.html";
      } catch (err) {
        console.error("Delete group:", err);
        deleteBtn.disabled  = false;
        deleteBtn.innerHTML = "Delete Group";
        alert(`Could not delete group: ${err.message}`);
      }
    };
  }

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Chat tab → navigate to standalone chat page
      if (btn.dataset.tab === "chat") {
        location.href = `group-chat.html?id=${groupId}`;
        return;
      }

      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");

      if (btn.dataset.tab === "members") loadMembers();
      if (btn.dataset.tab === "files")   loadFiles();
    });
  });

  // Post modal
  document.getElementById("openPostBtn").onclick    = openPostModal;
  document.getElementById("closePostModal").onclick = closePostModal;
  document.getElementById("cancelPostBtn").onclick  = closePostModal;
  document.getElementById("postModal").onclick = e => {
    if (e.target === document.getElementById("postModal")) closePostModal();
  };

  document.querySelectorAll(".type-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".type-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      setPostType(tab.dataset.type);
    };
  });

  document.getElementById("noteFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    noteFile = file;
    document.getElementById("noteFileName").textContent = file.name;
    document.getElementById("noteFileSelected").style.display = "flex";
    const drop = document.querySelector("#notePanel .file-drop");
    if (drop) drop.style.display = "none";
  });

  document.getElementById("removeNoteFile").onclick = () => {
    noteFile = null;
    document.getElementById("noteFileInput").value = "";
    document.getElementById("noteFileSelected").style.display = "none";
    const drop = document.querySelector("#notePanel .file-drop");
    if (drop) drop.style.display = "flex";
  };

  document.getElementById("submitPostBtn").onclick = handleSubmitPost;

  // Files tab upload
  document.getElementById("fileUploadInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = "";
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closePostModal();
  });
}

// ══════════════════════════════════════════════════
// COURSE CATALOGUE  (for edit accordion)
// ══════════════════════════════════════════════════
const COURSE_CATALOGUE = [
  { category:"🧠 Arts, Humanities & Social Sciences", courses:["Philosophy","History","Archaeology","Anthropology","Sociology","Psychology","Political Science","International Relations","Economics","Development Studies","Geography","Linguistics","English Literature","Comparative Literature","Creative Writing","Journalism","Mass Communication","Media Studies","Film Studies","Theatre Arts","Music","Fine Arts","Performing Arts","Religious Studies","Cultural Studies"] },
  { category:"📊 Business, Management & Economics", courses:["Business Administration","Commerce","Accounting","Finance","Economics","Banking & Finance","Marketing","Human Resource Management","Entrepreneurship","International Business","Supply Chain Management","Procurement & Logistics","Project Management","Actuarial Science","Insurance","Business Analytics","Public Administration"] },
  { category:"💻 Computing, IT & Data", courses:["Computer Science","Information Technology (IT)","Software Engineering","Computer Engineering","Data Science","Artificial Intelligence","Machine Learning","Cybersecurity","Information Systems","Computer Networks","Web Development","Game Development","Cloud Computing","Robotics","Bioinformatics"] },
  { category:"🧮 Natural & Physical Sciences", courses:["Mathematics","Applied Mathematics","Statistics","Physics","Applied Physics","Chemistry","Biochemistry","Environmental Science","Environmental Studies","Geology","Earth Science","Astronomy","Astrophysics","Meteorology","Oceanography"] },
  { category:"🧬 Biological & Life Sciences", courses:["Biology","Microbiology","Biotechnology","Genetics","Molecular Biology","Zoology","Botany","Ecology","Marine Biology","Biochemistry","Biomedical Science","Food Science & Technology"] },
  { category:"🏥 Medicine, Health & Life Care", courses:["Medicine (MBChB / MD)","Nursing","Pharmacy","Dentistry","Clinical Medicine","Public Health","Environmental Health","Nutrition & Dietetics","Medical Laboratory Science","Physiotherapy","Radiography","Occupational Therapy","Health Records & Information Management","Biomedical Engineering"] },
  { category:"⚙️ Engineering & Technology", courses:["Civil Engineering","Mechanical Engineering","Electrical Engineering","Electronic Engineering","Mechatronics Engineering","Chemical Engineering","Petroleum Engineering","Mining Engineering","Industrial Engineering","Agricultural Engineering","Automotive Engineering","Aerospace Engineering","Structural Engineering","Renewable Energy Engineering"] },
  { category:"🌱 Agriculture, Environment & Natural Resources", courses:["Agriculture","Agribusiness","Agricultural Economics","Crop Science","Animal Science","Horticulture","Soil Science","Forestry","Wildlife Management","Fisheries & Aquaculture","Environmental Management","Natural Resource Management"] },
  { category:"⚖️ Law, Governance & Security", courses:["Law (LLB)","Criminology","Criminal Justice","Forensic Science","International Law","Human Rights","Diplomacy","Public Policy","Governance","Security Studies","Peace & Conflict Studies"] },
  { category:"🏗️ Built Environment, Design & Planning", courses:["Architecture","Quantity Surveying","Construction Management","Urban & Regional Planning","Real Estate Management","Interior Design","Landscape Architecture","Geomatic Engineering (Surveying)"] },
  { category:"🎓 Education & Teaching", courses:["Education (Arts / Science)","Curriculum Studies","Educational Psychology","Early Childhood Education","Special Needs Education","Educational Technology","Guidance & Counselling","Physical Education"] },
  { category:"🏨 Hospitality, Tourism & Leisure", courses:["Hospitality Management","Tourism Management","Hotel Management","Travel & Tour Operations","Event Management","Culinary Arts"] }
];

// ══════════════════════════════════════════════════
// EDIT GROUP MODAL
// ══════════════════════════════════════════════════
function buildEditAccordion() {
  const wrap = document.getElementById("editAccordionWrap");
  if (!wrap || wrap.children.length) return;

  COURSE_CATALOGUE.forEach(cat => {
    const block = document.createElement("div");
    block.className = "accordion-block";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "accordion-header";
    header.innerHTML = `
      <span>${cat.category}</span>
      <svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    const body = document.createElement("div");
    body.className = "accordion-body";

    cat.courses.forEach(course => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "course-chip";
      chip.textContent = course;
      chip.onclick = () => {
        editSelectedCourse = course;
        document.querySelectorAll("#editAccordionWrap .course-chip")
          .forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        document.getElementById("editCourseName").textContent          = course;
        document.getElementById("editCourseBar").style.display         = "flex";
        document.getElementById("editAccordionContainer").style.display = "none";
        document.getElementById("editCourseCustom").value = "";
      };
      body.appendChild(chip);
    });

    header.onclick = () => {
      const isOpen = block.classList.contains("open");
      document.querySelectorAll("#editAccordionWrap .accordion-block.open")
        .forEach(b => b.classList.remove("open"));
      if (!isOpen) block.classList.add("open");
    };

    block.appendChild(header);
    block.appendChild(body);
    wrap.appendChild(block);
  });
}

function openEditModal() {
  if (!isAdmin) return;

  document.getElementById("editGroupName").value = groupData.name || "";
  document.getElementById("editGroupDesc").value = groupData.description || "";
  document.getElementById("editDescCount").textContent = (groupData.description || "").length;
  document.getElementById("editGroupMax").value  = groupData.maxMembers || "";
  document.getElementById("editIsPublic").checked = groupData.isPublic !== false;
  document.getElementById("editVisibilityLabel").textContent =
    groupData.isPublic !== false ? "Public" : "Private";

  const currentCount = groupData.memberCount || (groupData.members || []).length;
  document.getElementById("editMaxHint").textContent =
    `Currently ${currentCount} member${currentCount !== 1 ? "s" : ""} in this group`;

  editSelectedCourse = groupData.course || "";
  document.getElementById("editCourseName").textContent          = groupData.course || "Not set";
  document.getElementById("editCourseBar").style.display         = "flex";
  document.getElementById("editAccordionContainer").style.display = "none";
  document.getElementById("editCourseCustom").value = "";

  document.querySelectorAll("#editAccordionWrap .accordion-block.open")
    .forEach(b => b.classList.remove("open"));
  document.querySelectorAll("#editAccordionWrap .course-chip.selected")
    .forEach(c => c.classList.remove("selected"));

  document.getElementById("editGroupModal").style.display = "flex";
  setTimeout(() => document.getElementById("editGroupName").focus(), 80);
}

function closeEditModal() {
  document.getElementById("editGroupModal").style.display = "none";
  editSelectedCourse = "";
  document.getElementById("editAccordionContainer").style.display = "none";
  document.getElementById("editCourseBar").style.display          = "flex";
  document.querySelectorAll("#editAccordionWrap .accordion-block.open")
    .forEach(b => b.classList.remove("open"));
}

async function handleSaveEdit(e) {
  e.preventDefault();

  const btn  = document.getElementById("submitEditBtn");
  btn.disabled    = true;
  btn.textContent = "Saving...";

  const name   = document.getElementById("editGroupName").value.trim();
  const custom = document.getElementById("editCourseCustom").value.trim();
  const course = custom || editSelectedCourse || groupData.course;
  const desc   = document.getElementById("editGroupDesc").value.trim();
  const maxRaw = document.getElementById("editGroupMax").value;
  const maxMembers = maxRaw ? parseInt(maxRaw) : null;
  const isPublic   = document.getElementById("editIsPublic").checked;

  if (!name) {
    alert("Group name cannot be empty.");
    btn.disabled = false; btn.textContent = "Save Changes"; return;
  }
  if (!course) {
    alert("Please select or type a course.");
    btn.disabled = false; btn.textContent = "Save Changes"; return;
  }

  const currentCount = groupData.memberCount || (groupData.members || []).length;
  if (maxMembers && maxMembers < currentCount) {
    alert(`Max members (${maxMembers}) cannot be less than the current member count (${currentCount}).`);
    btn.disabled = false; btn.textContent = "Save Changes"; return;
  }

  try {
    await updateDoc(doc(db, "groups", groupId), {
      name, course, description: desc || null,
      maxMembers, isPublic, updatedAt: serverTimestamp()
    });

    groupData.name        = name;
    groupData.course      = course;
    groupData.description = desc || null;
    groupData.maxMembers  = maxMembers;
    groupData.isPublic    = isPublic;

    document.getElementById("heroName").textContent       = name;
    document.getElementById("heroCourse").textContent     = course;
    document.getElementById("heroDesc").textContent       = desc || "";
    document.getElementById("breadcrumbName").textContent = name;
    document.title = `${name} | UniMatch`;

    closeEditModal();
    showToast("Group updated successfully ✓");

  } catch (err) {
    console.error("Save edit:", err);
    alert(`Failed to save: ${err.message}`);
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"
          stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M17 21v-8H7v8M7 3v5h8"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg> Save Changes`;
}

function showToast(msg) {
  let toast = document.getElementById("groupToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "groupToast";
    toast.className = "group-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ══════════════════════════════════════════════════
// POST MODAL
// ══════════════════════════════════════════════════
function openPostModal() {
  if (!isMember) return;
  document.getElementById("postModal").style.display = "flex";
  setTimeout(() => document.getElementById("postContent").focus(), 80);
}

function closePostModal() {
  document.getElementById("postModal").style.display = "none";
  document.getElementById("postContent").value = "";
  const li = document.getElementById("linkInput");
  if (li) li.value = "";
  noteFile = null;
  document.getElementById("noteFileInput").value = "";
  document.getElementById("noteFileSelected").style.display = "none";
  const drop = document.querySelector("#notePanel .file-drop");
  if (drop) drop.style.display = "flex";
}

function setPostType(type) {
  postingType = type;
  document.getElementById("linkPanel").style.display = type === "resource" ? "block" : "none";
  document.getElementById("notePanel").style.display = type === "note"     ? "block" : "none";
  const ph = {
    text:"What's on your mind?", question:"What do you want to ask the group?",
    note:"Add a description...", resource:"Describe this resource..."
  };
  document.getElementById("postContent").placeholder = ph[type] || "What's on your mind?";
}

// ══════════════════════════════════════════════════
// FEED
// ══════════════════════════════════════════════════
function startFeedListener() {
  const q = query(
    collection(db, "posts"),
    where("groupId", "==", groupId),
    orderBy("createdAt", "desc")
  );

  postsUnsub = onSnapshot(q,
    snap => {
      document.getElementById("feedLoading").style.display = "none";
      const list  = document.getElementById("groupPostsList");
      const empty = document.getElementById("feedEmpty");
      list.querySelectorAll(".group-post-card").forEach(c => c.remove());
      if (snap.empty) { empty.style.display = "block"; return; }
      empty.style.display = "none";
      snap.docs.forEach((d, i) =>
        list.appendChild(buildPostCard({ id: d.id, ...d.data() }, i))
      );
    },
    err => {
      console.error("Feed listener error:", err);
      document.getElementById("feedLoading").style.display = "none";

      if (err.code === "failed-precondition") {
        document.getElementById("feedEmpty").style.display = "block";
        document.getElementById("feedEmpty").innerHTML = `
          <div class="empty-icon">⚠️</div>
          <p style="font-weight:600;color:#b45309">Missing Firestore index</p>
          <p style="font-size:13px;color:var(--ink-muted);max-width:320px;margin:8px auto 0">
            Open the browser console (F12), find the Firebase error, and click the link
            to create the required index. It takes about 1 minute.
          </p>`;
        return;
      }

      if (err.code === "permission-denied") {
        document.getElementById("feedEmpty").style.display = "block";
        document.getElementById("feedEmpty").innerHTML = `
          <div class="empty-icon">🔒</div>
          <p style="font-weight:600">Permission denied</p>
          <p style="font-size:13px;color:var(--ink-muted)">
            Check your Firestore rules allow members to read posts.
          </p>`;
        return;
      }

      document.getElementById("feedEmpty").style.display = "block";
      document.getElementById("feedEmpty").innerHTML = `
        <div class="empty-icon">❌</div>
        <p style="font-weight:600">Could not load posts</p>
        <p style="font-size:13px;color:var(--ink-muted)">${err.message}</p>`;
    }
  );
}

function buildPostCard(post, index) {
  const card     = document.createElement("div");
  card.className = "group-post-card";
  card.style.animationDelay = `${index * 0.05}s`;

  const isLiked = (post.likes || []).includes(currentUser.uid);
  const isOwner = post.authorId === currentUser.uid;
  const type    = post.type || "text";

  let attachHtml = "";
  if (post.fileUrl) {
    attachHtml = `<a class="post-attachment" href="${post.fileUrl}" target="_blank" rel="noopener">
      <div class="attachment-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      <div><div class="attachment-name">${escHtml(post.fileName || "File")}</div></div>
    </a>`;
  }
  if (post.linkUrl) {
    let domain = "";
    try { domain = new URL(post.linkUrl).hostname.replace("www.", ""); } catch (_) {}
    attachHtml = `<a class="post-attachment" href="${post.linkUrl}" target="_blank" rel="noopener">
      <div class="attachment-icon" style="background:var(--teal-light);color:var(--teal)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div><div class="attachment-name">${escHtml(domain || post.linkUrl)}</div></div>
    </a>`;
  }

  card.innerHTML = `
    <div class="post-type-stripe stripe-${type}"></div>
    <div class="post-inner">
      <div class="post-author-row">
        <img class="post-author-avatar" src="${post.authorPhoto || "./assets/images/default-avatar.png"}">
        <div>
          <div class="post-author-name">${escHtml(post.authorName || "Student")}</div>
          <div class="post-author-time">${formatTime(post.createdAt)}</div>
        </div>
        <span class="post-type-chip chip-${type}">${TYPE_LABELS[type] || type}</span>
      </div>
      ${post.content ? `<div class="post-text">${escHtml(post.content)}</div>` : ""}
      ${attachHtml}
      <div class="post-footer-row">
        <button class="post-action like-btn${isLiked ? " liked" : ""}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isLiked ? "currentColor" : "none"}">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="like-count">${(post.likes || []).length || ""}</span>
        </button>
        ${isOwner ? `<button class="post-delete">Delete</button>` : ""}
      </div>
    </div>`;

  card.querySelector(".like-btn").onclick = () => toggleLike(post.id, card);
  if (isOwner) {
    card.querySelector(".post-delete").onclick = async () => {
      if (!confirm("Delete this post?")) return;
      await deleteDoc(doc(db, "posts", post.id)).catch(console.error);
    };
  }
  return card;
}

async function toggleLike(postId, card) {
  const btn     = card.querySelector(".like-btn");
  const countEl = btn.querySelector(".like-count");
  const isLiked = btn.classList.contains("liked");
  btn.disabled  = true;
  try {
    await updateDoc(doc(db, "posts", postId), {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
    const cur = parseInt(countEl.textContent || "0");
    btn.classList.toggle("liked");
    btn.querySelector("path").setAttribute("fill", isLiked ? "none" : "currentColor");
    countEl.textContent = isLiked ? (cur > 1 ? cur - 1 : "") : cur + 1;
  } catch (err) { console.error("Like:", err); }
  btn.disabled = false;
}

async function handleSubmitPost() {
  const content = document.getElementById("postContent").value.trim();
  const linkUrl = document.getElementById("linkInput")?.value.trim() || null;
  const btn     = document.getElementById("submitPostBtn");

  if (!content && !noteFile && !linkUrl) {
    alert("Add some content first."); return;
  }
  if (!isMember) {
    alert("You must join this group to post."); return;
  }

  btn.disabled = true; btn.textContent = "Posting...";

  try {
    let fileUrl = null, fileName = null;
    if (noteFile) {
      const path = `group-files/${groupId}/${Date.now()}_${
        noteFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const res = await uploadBytes(ref(storage, path), noteFile);
      fileUrl   = await getDownloadURL(res.ref);
      fileName  = noteFile.name;
    }

    const postData = {
      type:        postingType,
      content:     content || null,
      fileUrl,
      fileName,
      linkUrl,
      imageUrl:    null,
      courseTag:   groupData.course || null,
      groupId:     groupId,
      authorId:    currentUser.uid,
      authorName:  userData.name     || "Student",
      authorPhoto: userData.photoURL || null,
      likes:       [],
      commentCount: 0,
      createdAt:   serverTimestamp()
    };

    await addDoc(collection(db, "posts"), postData);
    closePostModal();

  } catch (err) {
    console.error("Post error:", err);
    alert(`Failed to post: ${err.message}`);
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round"/>
    </svg> Post`;
}

// ══════════════════════════════════════════════════
// FILES TAB
// ══════════════════════════════════════════════════
async function loadFiles() {
  const list    = document.getElementById("filesList");
  const empty   = document.getElementById("filesEmpty");
  const loading = document.getElementById("filesLoading");
  loading.style.display = "flex";
  list.querySelectorAll(".file-item").forEach(i => i.remove());
  try {
    const snap = await getDocs(query(
      collection(db, "groups", groupId, "files"),
      orderBy("createdAt", "desc")
    ));
    loading.style.display = "none";
    if (snap.empty) { empty.style.display = "block"; return; }
    empty.style.display = "none";
    snap.docs.forEach((d, i) =>
      list.appendChild(buildFileItem({ id: d.id, ...d.data() }, i))
    );
  } catch (err) {
    console.error("Load files:", err); loading.style.display = "none";
  }
}

function buildFileItem(file, index) {
  const item = document.createElement("div");
  item.className = "file-item";
  item.style.animationDelay = `${index * 0.05}s`;
  const ext = (file.fileName || "").split(".").pop().toLowerCase();
  const iconClass = ext==="pdf" ? "icon-pdf" : ["doc","docx"].includes(ext) ? "icon-doc"
    : ["jpg","jpeg","png","gif","webp"].includes(ext) ? "icon-img"
    : ["ppt","pptx"].includes(ext) ? "icon-ppt" : "icon-other";
  const iconEmoji = ext==="pdf" ? "📄" : ["doc","docx"].includes(ext) ? "📝"
    : ["jpg","jpeg","png","gif","webp"].includes(ext) ? "🖼️"
    : ["ppt","pptx"].includes(ext) ? "📊" : "📁";
  const canDelete = file.uploadedBy === currentUser.uid || isAdmin;
  item.innerHTML = `
    <div class="file-type-icon ${iconClass}">${iconEmoji}</div>
    <div class="file-info">
      <div class="file-name-text">${escHtml(file.fileName || "File")}</div>
      <div class="file-meta-row">Shared by ${escHtml(file.uploaderName || "Someone")} · ${formatTime(file.createdAt)}</div>
    </div>
    <div class="file-actions">
      <a class="btn-download" href="${file.fileUrl}" target="_blank" rel="noopener">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download
      </a>
      ${canDelete ? `<button class="btn-file-delete" data-id="${file.id}">Remove</button>` : ""}
    </div>`;
  if (canDelete) {
    item.querySelector(".btn-file-delete").onclick = async () => {
      if (!confirm("Remove this file?")) return;
      await deleteDoc(doc(db, "groups", groupId, "files", file.id)).catch(console.error);
      item.remove();
      if (!document.querySelector(".file-item"))
        document.getElementById("filesEmpty").style.display = "block";
    };
  }
  return item;
}

async function handleFileUpload(file) {
  if (!isMember) return;
  try {
    const path = `group-files/${groupId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g,"_")}`;
    const res     = await uploadBytes(ref(storage, path), file);
    const fileUrl = await getDownloadURL(res.ref);
    await addDoc(collection(db, "groups", groupId, "files"), {
      fileUrl, fileName: file.name, fileSize: file.size,
      uploadedBy: currentUser.uid, uploaderName: userData.name || "Student",
      createdAt: serverTimestamp()
    });
    loadFiles();
  } catch (err) { console.error("File upload:", err); alert("Upload failed."); }
}

// ══════════════════════════════════════════════════
// MEMBERS TAB
// ══════════════════════════════════════════════════
async function loadMembers() {
  const list    = document.getElementById("membersList");
  const loading = document.getElementById("membersLoading");
  list.querySelectorAll(".member-item").forEach(i => i.remove());
  loading.style.display = "flex";
  const members = groupData.members || [];
  document.getElementById("memberCountLabel").textContent = `(${members.length})`;
  try {
    for (let i = 0; i < members.length; i++) {
      const uid   = members[i];
      const snap  = await getDoc(doc(db, "users", uid));
      const mData = snap.exists() ? snap.data() : {};
      list.appendChild(buildMemberItem(uid, mData, i));
    }
    loading.style.display = "none";
  } catch (err) {
    console.error("Load members:", err); loading.style.display = "none";
  }
}

function buildMemberItem(uid, mData, index) {
  const item = document.createElement("div");
  item.className = "member-item";
  item.style.animationDelay = `${index * 0.04}s`;
  const isThisAdmin = uid === groupData.createdBy;
  const canRemove   = isAdmin && uid !== currentUser.uid;
  item.innerHTML = `
    <img class="member-photo" src="${mData.photoURL || "./assets/images/default-avatar.png"}" alt="">
    <div class="member-info">
      <div class="member-name">${escHtml(mData.name || "Student")}${uid === currentUser.uid ? " <span style='color:var(--ink-muted);font-weight:400'>(You)</span>" : ""}</div>
      <div class="member-meta">${escHtml(mData.course || "")}${mData.campus ? ` · ${escHtml(mData.campus)}` : ""}</div>
    </div>
    <span class="member-role-badge ${isThisAdmin ? "role-admin" : "role-member"}">
      ${isThisAdmin ? "👑 Admin" : "Member"}
    </span>
    ${canRemove ? `<button class="btn-remove-member" data-uid="${uid}">Remove</button>` : ""}`;
  if (canRemove) {
    item.querySelector(".btn-remove-member").onclick = async () => {
      if (!confirm(`Remove ${mData.name || "this member"} from the group?`)) return;
      try {
        await updateDoc(doc(db, "groups", groupId), {
          members: arrayRemove(uid), memberCount: increment(-1)
        });
        item.remove();
        groupData.members = groupData.members.filter(m => m !== uid);
        const n = groupData.members.length;
        document.getElementById("memberCountLabel").textContent = `(${n})`;
        document.getElementById("memberTabCount").textContent   = n;
        document.getElementById("heroMemberCount").textContent  = `${n} members`;
      } catch (err) { console.error("Remove:", err); alert("Failed to remove member."); }
    };
  }
  return item;
}

// ══════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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