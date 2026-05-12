import { auth, db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, query, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { requireAuth } from "./auth-guard.js";

// ═══════════════════════════════════════════════════════════
// COURSE CATALOGUE  — all 12 categories, 157 courses
// Inlined here so groups.js has zero external dependencies
// ═══════════════════════════════════════════════════════════
const COURSE_CATALOGUE = [
  {
    category: "🧠 Arts, Humanities & Social Sciences",
    courses: [
      "Philosophy","History","Archaeology","Anthropology","Sociology","Psychology",
      "Political Science","International Relations","Economics","Development Studies",
      "Geography","Linguistics","English Literature","Comparative Literature",
      "Creative Writing","Journalism","Mass Communication","Media Studies",
      "Film Studies","Theatre Arts","Music","Fine Arts","Performing Arts",
      "Religious Studies","Cultural Studies"
    ]
  },
  {
    category: "📊 Business, Management & Economics",
    courses: [
      "Business Administration","Commerce","Accounting","Finance","Economics",
      "Banking & Finance","Marketing","Human Resource Management","Entrepreneurship",
      "International Business","Supply Chain Management","Procurement & Logistics",
      "Project Management","Actuarial Science","Insurance","Business Analytics",
      "Public Administration"
    ]
  },
  {
    category: "💻 Computing, IT & Data",
    courses: [
      "Computer Science","Information Technology (IT)","Software Engineering",
      "Computer Engineering","Data Science","Artificial Intelligence","Machine Learning",
      "Cybersecurity","Information Systems","Computer Networks","Web Development",
      "Game Development","Cloud Computing","Robotics","Bioinformatics"
    ]
  },
  {
    category: "🧮 Natural & Physical Sciences",
    courses: [
      "Mathematics","Applied Mathematics","Statistics","Physics","Applied Physics",
      "Chemistry","Biochemistry","Environmental Science","Environmental Studies",
      "Geology","Earth Science","Astronomy","Astrophysics","Meteorology","Oceanography"
    ]
  },
  {
    category: "🧬 Biological & Life Sciences",
    courses: [
      "Biology","Microbiology","Biotechnology","Genetics","Molecular Biology",
      "Zoology","Botany","Ecology","Marine Biology","Biochemistry",
      "Biomedical Science","Food Science & Technology"
    ]
  },
  {
    category: "🏥 Medicine, Health & Life Care",
    courses: [
      "Medicine (MBChB / MD)","Nursing","Pharmacy","Dentistry","Clinical Medicine",
      "Public Health","Environmental Health","Nutrition & Dietetics",
      "Medical Laboratory Science","Physiotherapy","Radiography",
      "Occupational Therapy","Health Records & Information Management",
      "Biomedical Engineering"
    ]
  },
  {
    category: "⚙️ Engineering & Technology",
    courses: [
      "Civil Engineering","Mechanical Engineering","Electrical Engineering",
      "Electronic Engineering","Mechatronics Engineering","Chemical Engineering",
      "Petroleum Engineering","Mining Engineering","Industrial Engineering",
      "Agricultural Engineering","Automotive Engineering","Aerospace Engineering",
      "Structural Engineering","Renewable Energy Engineering"
    ]
  },
  {
    category: "🌱 Agriculture, Environment & Natural Resources",
    courses: [
      "Agriculture","Agribusiness","Agricultural Economics","Crop Science",
      "Animal Science","Horticulture","Soil Science","Forestry",
      "Wildlife Management","Fisheries & Aquaculture",
      "Environmental Management","Natural Resource Management"
    ]
  },
  {
    category: "⚖️ Law, Governance & Security",
    courses: [
      "Law (LLB)","Criminology","Criminal Justice","Forensic Science",
      "International Law","Human Rights","Diplomacy","Public Policy",
      "Governance","Security Studies","Peace & Conflict Studies"
    ]
  },
  {
    category: "🏗️ Built Environment, Design & Planning",
    courses: [
      "Architecture","Quantity Surveying","Construction Management",
      "Urban & Regional Planning","Real Estate Management","Interior Design",
      "Landscape Architecture","Geomatic Engineering (Surveying)"
    ]
  },
  {
    category: "🎓 Education & Teaching",
    courses: [
      "Education (Arts / Science)","Curriculum Studies","Educational Psychology",
      "Early Childhood Education","Special Needs Education","Educational Technology",
      "Guidance & Counselling","Physical Education"
    ]
  },
  {
    category: "🏨 Hospitality, Tourism & Leisure",
    courses: [
      "Hospitality Management","Tourism Management","Hotel Management",
      "Travel & Tour Operations","Event Management","Culinary Arts"
    ]
  }
];

// ═══════════════════════════════════════════════════════════

const GROUP_EMOJIS = ["📚","🎓","🔬","⚖️","💻","🧬","📐","🏛️","🧪","📊","🌍","✏️"];
const BAND_COUNT   = 6;

let currentUser    = null;
let userData       = null;
let allGroups      = [];
let myGroupIds     = new Set();
let searchTerm     = "";
let courseFilter   = "all";
let selectedCourse = "";

// ══════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════
(async () => {
  try {
    currentUser = await requireAuth();
    const snap  = await getDoc(doc(db, "users", currentUser.uid));
    userData    = snap.exists() ? snap.data() : {};
    buildAccordion();
    buildFilterDropdown();
    setupUI();
    listenGroups();
  } catch (err) {
    console.error("Groups boot:", err);
  }
})();

// ══════════════════════════════════════════════════
// BUILD ACCORDION PICKER (inside modal)
// ══════════════════════════════════════════════════
function buildAccordion() {
  const wrap = document.getElementById("accordionWrap");
  if (!wrap) return;

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
      chip.onclick = () => pickCourse(course);
      body.appendChild(chip);
    });

    header.onclick = () => {
      const isOpen = block.classList.contains("open");
      document.querySelectorAll(".accordion-block.open")
        .forEach(b => b.classList.remove("open"));
      if (!isOpen) block.classList.add("open");
    };

    block.appendChild(header);
    block.appendChild(body);
    wrap.appendChild(block);
  });
}

function pickCourse(course) {
  selectedCourse = course;
  document.getElementById("courseSelectedBar").style.display  = "flex";
  document.getElementById("courseSelectedName").textContent   = course;
  document.getElementById("accordionContainer").style.display = "none";
  document.getElementById("groupCourseCustom").value = "";
}

// ══════════════════════════════════════════════════
// BUILD FILTER DROPDOWN (grouped by category)
// ══════════════════════════════════════════════════
function buildFilterDropdown() {
  const sel = document.getElementById("courseFilter");
  if (!sel) return;

  COURSE_CATALOGUE.forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = cat.category;
    cat.courses.forEach(course => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });
}

// ══════════════════════════════════════════════════
// REAL-TIME GROUPS LISTENER
// ══════════════════════════════════════════════════
function listenGroups() {
  const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    allGroups  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myGroupIds = new Set(
      allGroups
        .filter(g => (g.members || []).includes(currentUser.uid))
        .map(g => g.id)
    );
    renderMyGroups();
    renderAllGroups();
  });
}

// ══════════════════════════════════════════════════
// RENDER — MY GROUPS
// ══════════════════════════════════════════════════
function renderMyGroups() {
  const block = document.getElementById("myGroupsBlock");
  const list  = document.getElementById("myGroupsList");
  const mine  = allGroups.filter(g => myGroupIds.has(g.id));

  if (mine.length === 0) { block.style.display = "none"; return; }
  block.style.display = "block";
  list.innerHTML = "";

  mine.forEach((g, i) => {
    const chip  = document.createElement("div");
    chip.className = "my-group-chip";
    chip.style.animationDelay = `${i * 0.05}s`;
    const emoji = GROUP_EMOJIS[hashCode(g.id) % GROUP_EMOJIS.length];
    const count = g.memberCount || (g.members || []).length;
    chip.innerHTML = `
      <div class="chip-avatar">${emoji}</div>
      <div>
        <div class="chip-name">${escHtml(g.name)}</div>
        <div class="chip-meta">${count} member${count !== 1 ? "s" : ""}</div>
      </div>`;
    chip.onclick = () => location.href = `group.html?id=${g.id}`;
    list.appendChild(chip);
  });
}

// ══════════════════════════════════════════════════
// RENDER — ALL GROUPS GRID
// ══════════════════════════════════════════════════
function renderAllGroups() {
  const grid    = document.getElementById("allGroupsList");
  const empty   = document.getElementById("groupsEmpty");
  const loading = document.getElementById("groupsLoading");
  if (loading) loading.style.display = "none";

  let filtered = allGroups;
  if (courseFilter !== "all")
    filtered = filtered.filter(g => g.course === courseFilter);
  if (searchTerm) {
    const t = searchTerm.toLowerCase();
    filtered = filtered.filter(g =>
      g.name.toLowerCase().includes(t) ||
      (g.course       || "").toLowerCase().includes(t) ||
      (g.description  || "").toLowerCase().includes(t)
    );
  }

  grid.querySelectorAll(".group-card").forEach(c => c.remove());

  if (filtered.length === 0) { empty.style.display = "block"; return; }
  empty.style.display = "none";
  filtered.forEach((g, i) => grid.appendChild(buildGroupCard(g, i)));
}

// ══════════════════════════════════════════════════
// BUILD GROUP CARD
// ══════════════════════════════════════════════════
function buildGroupCard(g, index) {
  const card     = document.createElement("div");
  const bandIdx  = hashCode(g.id) % BAND_COUNT;
  const emoji    = GROUP_EMOJIS[hashCode(g.id) % GROUP_EMOJIS.length];
  const isMember = myGroupIds.has(g.id);
  const isAdmin  = g.createdBy === currentUser.uid;
  const count    = g.memberCount || (g.members || []).length;
  const isFull   = g.maxMembers && count >= g.maxMembers;

  card.className = "group-card";
  card.style.animationDelay = `${index * 0.06}s`;

  const pips = Array.from({ length: Math.min(count, 3) }, () =>
    `<div class="member-pip"></div>`).join("");

  card.innerHTML = `
    <div class="group-card-top band-${bandIdx}">
      <span style="font-size:36px">${emoji}</span>
      <div class="member-count-badge">👥 ${count}</div>
      ${isAdmin              ? '<div class="admin-crown">👑 Admin</div>'  : ""}
      ${isMember && !isAdmin ? '<div class="member-badge">✓ Joined</div>': ""}
    </div>
    <div class="group-card-body">
      <div class="group-course-tag">${escHtml(g.course || "General")}</div>
      <div class="group-name">${escHtml(g.name)}</div>
      <div class="group-desc">${escHtml(g.description || "No description yet.")}</div>
    </div>
    <div class="group-card-footer">
      <div class="member-pips">${pips}</div>
      <div class="card-footer-actions">
        ${isAdmin ? `<button class="btn-delete-group" title="Delete group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          Delete
        </button>` : ""}
        <button class="btn-join${isMember ? " member" : ""}">
          ${isMember ? "Open" : isFull ? "Full" : "Join"}
        </button>
      </div>
    </div>`;

  card.onclick = () => location.href = `group.html?id=${g.id}`;

  const joinBtn = card.querySelector(".btn-join");
  joinBtn.onclick = async e => {
    e.stopPropagation();
    if (isMember) { location.href = `group.html?id=${g.id}`; return; }
    if (isFull)   return;
    await handleJoin(g.id, joinBtn);
  };

  // Delete button — admin only
  if (isAdmin) {
    card.querySelector(".btn-delete-group").onclick = async e => {
      e.stopPropagation();
      await handleDeleteGroup(g.id, g.name, card);
    };
  }

  return card;
}

// ══════════════════════════════════════════════════
// JOIN GROUP
// ══════════════════════════════════════════════════
async function handleJoin(groupId, btn) {
  btn.disabled = true;
  btn.textContent = "Joining...";
  try {
    await updateDoc(doc(db, "groups", groupId), {
      members:     arrayUnion(currentUser.uid),
      memberCount: increment(1)
    });
  } catch (err) {
    console.error("Join:", err);
    btn.disabled = false;
    btn.textContent = "Join";
  }
}

// ══════════════════════════════════════════════════
// DELETE GROUP  — admin only
// ══════════════════════════════════════════════════
async function handleDeleteGroup(groupId, groupName, card) {
  const confirmed = confirm(
    `Delete "${groupName}"?\n\nThis permanently removes the group for all members and cannot be undone.`
  );
  if (!confirmed) return;

  // Animate out immediately for snappy feedback
  card.style.transition = "opacity 0.25s, transform 0.25s";
  card.style.opacity    = "0";
  card.style.transform  = "scale(0.95)";

  try {
    await deleteDoc(doc(db, "groups", groupId));
    // onSnapshot will re-render the grid — just remove the card from DOM
    setTimeout(() => card.remove(), 280);
  } catch (err) {
    console.error("Delete group:", err);
    // Restore card visually if it failed
    card.style.opacity   = "1";
    card.style.transform = "scale(1)";
    alert(`Could not delete group: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════
// SETUP UI
// ══════════════════════════════════════════════════
function setupUI() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchTerm = e.target.value.trim();
    renderAllGroups();
  });

  document.getElementById("courseFilter").addEventListener("change", e => {
    courseFilter = e.target.value;
    renderAllGroups();
  });

  document.getElementById("groupDesc").addEventListener("input", e => {
    document.getElementById("descCount").textContent = e.target.value.length;
  });

  // "Change" button — reshow accordion
  document.getElementById("courseClearBtn").onclick = () => {
    selectedCourse = "";
    document.getElementById("courseSelectedBar").style.display  = "none";
    document.getElementById("accordionContainer").style.display = "flex";
    document.querySelectorAll(".course-chip.selected")
      .forEach(c => c.classList.remove("selected"));
    document.querySelectorAll(".accordion-block.open")
      .forEach(b => b.classList.remove("open"));
  };

  // Custom input clears accordion pick
  document.getElementById("groupCourseCustom").addEventListener("input", () => {
    if (document.getElementById("groupCourseCustom").value.trim()) {
      selectedCourse = "";
      document.querySelectorAll(".course-chip.selected")
        .forEach(c => c.classList.remove("selected"));
    }
  });

  // Modal open / close
  document.getElementById("openCreateBtn").onclick   = openCreate;
  document.getElementById("emptyCreateBtn").onclick  = openCreate;
  document.getElementById("closeCreateBtn").onclick  = closeCreate;
  document.getElementById("cancelCreateBtn").onclick = closeCreate;
  document.getElementById("createModal").onclick = e => {
    if (e.target === document.getElementById("createModal")) closeCreate();
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeCreate();
  });

  document.getElementById("createGroupForm")
    .addEventListener("submit", handleCreateGroup);
}

function openCreate() {
  document.getElementById("createModal").style.display = "flex";
}

function closeCreate() {
  document.getElementById("createModal").style.display = "none";
  document.getElementById("createGroupForm").reset();
  document.getElementById("descCount").textContent = "0";
  selectedCourse = "";
  document.getElementById("courseSelectedBar").style.display  = "none";
  document.getElementById("accordionContainer").style.display = "flex";
  document.querySelectorAll(".course-chip.selected")
    .forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".accordion-block.open")
    .forEach(b => b.classList.remove("open"));
}

// ══════════════════════════════════════════════════
// CREATE GROUP
// ══════════════════════════════════════════════════
async function handleCreateGroup(e) {
  e.preventDefault();
  const btn = document.getElementById("submitGroupBtn");
  btn.disabled = true;
  btn.textContent = "Creating...";

  const name   = document.getElementById("groupName").value.trim();
  const custom = document.getElementById("groupCourseCustom").value.trim();
  const course = custom || selectedCourse;
  const desc   = document.getElementById("groupDesc").value.trim();
  const maxRaw = document.getElementById("groupMax").value;
  const maxMembers = maxRaw ? parseInt(maxRaw) : null;

  if (!name || !course) {
    alert("Please enter a group name and select (or type) a course.");
    btn.disabled = false;
    btn.textContent = "Create Group";
    return;
  }

  try {
    await addDoc(collection(db, "groups"), {
      name,
      course,
      description:  desc || null,
      maxMembers,
      createdBy:    currentUser.uid,
      creatorName:  userData.name     || "Unknown",
      creatorPhoto: userData.photoURL || null,
      campus:       userData.campus   || null,
      members:      [currentUser.uid],
      memberCount:  1,
      createdAt:    serverTimestamp()
    });
    closeCreate();
  } catch (err) {
    console.error("Create group:", err);
    alert(`Failed: ${err.message}`);
  }

  btn.disabled = false;
  btn.textContent = "Create Group";
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
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}