import { auth, db, storage } from "./firebase.js";
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, getDoc, getDocs, query, where,
  orderBy, limit, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { requireAuth } from "./auth-guard.js";

// ─── COURSE CATALOGUE ───
const COURSE_CATALOGUE = [
  { category: "🧠 Arts, Humanities & Social Sciences", courses: ["Philosophy","History","Archaeology","Anthropology","Sociology","Psychology","Political Science","International Relations","Economics","Development Studies","Geography","Linguistics","English Literature","Comparative Literature","Creative Writing","Journalism","Mass Communication","Media Studies","Film Studies","Theatre Arts","Music","Fine Arts","Performing Arts","Religious Studies","Cultural Studies"] },
  { category: "📊 Business, Management & Economics", courses: ["Business Administration","Commerce","Accounting","Finance","Economics","Banking & Finance","Marketing","Human Resource Management","Entrepreneurship","International Business","Supply Chain Management","Procurement & Logistics","Project Management","Actuarial Science","Insurance","Business Analytics","Public Administration"] },
  { category: "💻 Computing, IT & Data", courses: ["Computer Science","Information Technology (IT)","Software Engineering","Computer Engineering","Data Science","Artificial Intelligence","Machine Learning","Cybersecurity","Information Systems","Computer Networks","Web Development","Game Development","Cloud Computing","Robotics","Bioinformatics"] },
  { category: "🧮 Natural & Physical Sciences", courses: ["Mathematics","Applied Mathematics","Statistics","Physics","Applied Physics","Chemistry","Biochemistry","Environmental Science","Environmental Studies","Geology","Earth Science","Astronomy","Astrophysics","Meteorology","Oceanography"] },
  { category: "🧬 Biological & Life Sciences", courses: ["Biology","Microbiology","Biotechnology","Genetics","Molecular Biology","Zoology","Botany","Ecology","Marine Biology","Biochemistry","Biomedical Science","Food Science & Technology"] },
  { category: "🏥 Medicine, Health & Life Care", courses: ["Medicine (MBChB / MD)","Nursing","Pharmacy","Dentistry","Clinical Medicine","Public Health","Environmental Health","Nutrition & Dietetics","Medical Laboratory Science","Physiotherapy","Radiography","Occupational Therapy","Health Records & Information Management","Biomedical Engineering"] },
  { category: "⚙️ Engineering & Technology", courses: ["Civil Engineering","Mechanical Engineering","Electrical Engineering","Electronic Engineering","Mechatronics Engineering","Chemical Engineering","Petroleum Engineering","Mining Engineering","Industrial Engineering","Agricultural Engineering","Automotive Engineering","Aerospace Engineering","Structural Engineering","Renewable Energy Engineering"] },
  { category: "🌱 Agriculture, Environment & Natural Resources", courses: ["Agriculture","Agribusiness","Agricultural Economics","Crop Science","Animal Science","Horticulture","Soil Science","Forestry","Wildlife Management","Fisheries & Aquaculture","Environmental Management","Natural Resource Management"] },
  { category: "⚖️ Law, Governance & Security", courses: ["Law (LLB)","Criminology","Criminal Justice","Forensic Science","International Law","Human Rights","Diplomacy","Public Policy","Governance","Security Studies","Peace & Conflict Studies"] },
  { category: "🏗️ Built Environment, Design & Planning", courses: ["Architecture","Quantity Surveying","Construction Management","Urban & Regional Planning","Real Estate Management","Interior Design","Landscape Architecture","Geomatic Engineering (Surveying)"] },
  { category: "🎓 Education & Teaching", courses: ["Education (Arts / Science)","Curriculum Studies","Educational Psychology","Early Childhood Education","Special Needs Education","Educational Technology","Guidance & Counselling","Physical Education"] },
  { category: "🏨 Hospitality, Tourism & Leisure", courses: ["Hospitality Management","Tourism Management","Hotel Management","Travel & Tour Operations","Event Management","Culinary Arts"] },
  { category: "🌍 Interdisciplinary & Modern Programs", courses: ["Gender Studies","Development Studies","Climate Change Studies","Sustainability Studies","Digital Media","Innovation & Technology Management","Entrepreneurship Studies","Global Studies"] }
];


const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2240%22 height%3D%2240%22 viewBox%3D%220 0 40 40%22%3E%3Ccircle cx%3D%2220%22 cy%3D%2220%22 r%3D%2220%22 fill%3D%22%23e8e6f0%22/%3E%3Ccircle cx%3D%2220%22 cy%3D%2215%22 r%3D%226%22 fill%3D%22%23b0aac4%22/%3E%3Cellipse cx%3D%2220%22 cy%3D%2232%22 rx%3D%2210%22 ry%3D%228%22 fill%3D%22%23b0aac4%22/%3E%3C/svg%3E";
const TYPE_LABELS = {
  text: "Post", question: "Question", note: "Note",
  image: "Image", video: "Video", resource: "Resource"
};

const PAGE_SIZE = 10; // ← declared at top so it's available everywhere

// ─── STATE ───
let currentUser   = null;
let userData      = null;
let activeFilter  = "all";
let activeType    = "all";
let postingType   = "text";
let imageFile     = null;
let videoFile     = null;
let attachFile    = null;
let activePostId  = null;
let replyingTo    = null;
let commentsUnsub = null;
let feedUnsub     = null; // real-time feed listener

// ─── DOM ───
const postsList      = document.getElementById("postsList");
const feedLoading    = document.getElementById("feedLoading");
const feedEmpty      = document.getElementById("feedEmpty");
const loadMoreWrap   = document.getElementById("loadMoreWrap");
const postModal      = document.getElementById("postModal");
const commentsDrawer = document.getElementById("commentsDrawer");

// ─── BOOT ───
(async () => {
  try {
    currentUser = await requireAuth();
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    userData = snap.exists() ? snap.data() : {};

    const avatarSrc = userData.photoURL || FALLBACK_AVATAR;
    document.getElementById("composeAvatar").src = avatarSrc;
    document.getElementById("modalAvatar").src   = avatarSrc;
    document.getElementById("commentAvatar").src = avatarSrc;
    if (document.getElementById("modalAuthorName"))
      document.getElementById("modalAuthorName").textContent = userData.name || "You";

    populateCourses();
    setupUI();
    startFeedListener(); // real-time — no manual refresh needed
    loadTrending();
    loadMyStats();

  } catch (err) {
    console.error("Feed boot error:", err);
    window.location.replace("login.html");
  }
})();

// ─── POPULATE COURSES ───
function populateCourses() {
  const sidebar = document.getElementById("courseTags");
  const select  = document.getElementById("postCourse");

  COURSE_CATALOGUE.forEach(cat => {
    const catBtn = document.createElement("button");
    catBtn.className = "course-cat-header";
    catBtn.innerHTML = `
      <span>${cat.category}</span>
      <svg class="cat-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    const catList = document.createElement("div");
    catList.className = "course-cat-list";

    cat.courses.forEach(course => {
      const btn = document.createElement("button");
      btn.className = "course-tag";
      btn.dataset.course = course;
      btn.textContent = course;
      btn.onclick = () => {
        document.querySelectorAll(".course-tag").forEach(b => b.classList.remove("active"));
        document.querySelectorAll('.course-tag[data-course="all"]').forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = course;
        startFeedListener();
      };
      catList.appendChild(btn);
    });

    catBtn.onclick = () => {
      const isOpen = catBtn.classList.contains("open");
      document.querySelectorAll(".course-cat-header.open").forEach(h => {
        h.classList.remove("open");
        h.nextElementSibling.style.display = "none";
      });
      if (!isOpen) {
        catBtn.classList.add("open");
        catList.style.display = "flex";
      }
    };

    sidebar.appendChild(catBtn);
    sidebar.appendChild(catList);
  });

  // Modal select: grouped options
  COURSE_CATALOGUE.forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = cat.category;
    cat.courses.forEach(course => {
      const opt = document.createElement("option");
      opt.value = course;
      opt.textContent = course;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
}

// ─── REAL-TIME FEED LISTENER ───
// Replaces getDocs-based loadPosts — posts appear instantly without refresh
function startFeedListener() {
  // Tear down any existing listener
  if (feedUnsub) { feedUnsub(); feedUnsub = null; }

  postsList.innerHTML = "";
  if (feedLoading) feedLoading.style.display = "flex";
  if (feedEmpty)   feedEmpty.style.display   = "none";
  if (loadMoreWrap) loadMoreWrap.style.display = "none";

  // Build query — combine course + type filters when both active
  let constraints = [
    where("groupId", "==", null),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE)
  ];

  if (activeFilter !== "all") {
    constraints = [
      where("groupId", "==", null),
      where("courseTag", "==", activeFilter),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    ];
  }

  if (activeType !== "all") {
    constraints = [
      where("groupId", "==", null),
      where("type", "==", activeType),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    ];
  }

  const q = query(collection(db, "posts"), ...constraints);

  feedUnsub = onSnapshot(q, snap => {
    if (feedLoading) feedLoading.style.display = "none";

    if (snap.empty) {
      postsList.innerHTML = "";
      if (feedEmpty) feedEmpty.style.display = "block";
      return;
    }

    if (feedEmpty) feedEmpty.style.display = "none";

    // Surgical DOM updates using docChanges()
    snap.docChanges().forEach(change => {
      const post = { id: change.doc.id, ...change.doc.data() };

      if (change.type === "added") {
        // Prepend new posts at the top
        const card = buildPostCard(post, 0);
        if (postsList.firstChild) {
          postsList.insertBefore(card, postsList.firstChild);
        } else {
          postsList.appendChild(card);
        }
      }

      if (change.type === "modified") {
        const existing = postsList.querySelector(`[data-post-id="${post.id}"]`);
        if (existing) {
          const updated = buildPostCard(post, 0);
          updated.style.animation = "none"; // no re-enter animation on update
          postsList.replaceChild(updated, existing);
        }
      }

      if (change.type === "removed") {
        const existing = postsList.querySelector(`[data-post-id="${post.id}"]`);
        if (existing) existing.remove();
      }
    });

    // If the list is now empty after removals
    if (postsList.children.length === 0) {
      if (feedEmpty) feedEmpty.style.display = "block";
    }

    loadMyStats();
  }, err => {
    console.error("Feed listener error:", err);
    if (feedLoading) feedLoading.style.display = "none";
  });
}

// ─── BUILD POST CARD ───
function buildPostCard(post, index = 0) {
  const card = document.createElement("div");
  card.className = `post-card type-${post.type || "text"}`;
  card.dataset.postId = post.id;
  card.style.animationDelay = `${index * 0.06}s`;

  const isLiked      = currentUser && (post.likes || []).includes(currentUser.uid);
  const likeCount    = (post.likes || []).length;
  const commentCount = post.commentCount || 0;
  const isOwner      = currentUser && post.authorId === currentUser.uid;
  const timeStr      = formatRelativeTime(post.createdAt);

  const isLong = (post.content || "").length > 400;
  const contentHtml = `
    <div class="post-content${isLong ? " collapsed" : ""}" id="content-${post.id}">
      ${escHtml(post.content || "")}
    </div>
    ${isLong ? `<button class="read-more-btn" id="readmore-${post.id}">Read more</button>` : ""}
  `;

  // Media — image, video, file, or link
  let mediaHtml = "";
  if (post.videoUrl) {
    mediaHtml = `
      <video class="post-video" controls preload="metadata">
        <source src="${post.videoUrl}" type="video/mp4">
        <source src="${post.videoUrl}">
        Your browser does not support video.
      </video>`;
  } else if (post.imageUrl) {
    mediaHtml = `<img class="post-image" src="${post.imageUrl}" alt="Post image" loading="lazy" onclick="window.open('${post.imageUrl}','_blank')">`;
  }
  if (post.fileUrl) {
    mediaHtml += `
      <a class="post-file" href="${post.fileUrl}" target="_blank" rel="noopener">
        <div class="file-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>
        <div>
          <div class="file-name">${escHtml(post.fileName || "Attachment")}</div>
          <div class="file-size">Click to download</div>
        </div>
      </a>`;
  }
  if (post.linkUrl) {
    let domain = "";
    try { domain = new URL(post.linkUrl).hostname.replace("www.", ""); } catch (_) {}
    mediaHtml += `
      <a class="post-link" href="${post.linkUrl}" target="_blank" rel="noopener">
        <div class="link-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="link-domain">${domain}</div>
          <div class="link-url-text">${escHtml(post.linkUrl)}</div>
        </div>
      </a>`;
  }

  card.innerHTML = `
    <div class="post-type-bar"></div>
    <div class="post-body">
      <div class="post-header">
        <div class="post-author">
          <img class="author-avatar"
            src="${(post.authorId === currentUser?.uid && userData?.photoURL) ? userData.photoURL : (post.authorPhoto || FALLBACK_AVATAR)}"
            alt="${escHtml(post.authorName || '')}"
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2240%22 height%3D%2240%22 viewBox%3D%220 0 40 40%22%3E%3Ccircle cx%3D%2220%22 cy%3D%2220%22 r%3D%2220%22 fill%3D%22%23e8e6f0%22/%3E%3Ccircle cx%3D%2220%22 cy%3D%2215%22 r%3D%226%22 fill%3D%22%23b0aac4%22/%3E%3Cellipse cx%3D%2220%22 cy%3D%2232%22 rx%3D%2210%22 ry%3D%228%22 fill%3D%22%23b0aac4%22/%3E%3C/svg%3E'">
          <div>
            <div class="author-name">${escHtml(post.authorName || "Student")}</div>
            <div class="author-meta">${timeStr}</div>
          </div>
        </div>
        <div class="post-badges">
          <span class="post-type-badge">${TYPE_LABELS[post.type] || post.type}</span>
        </div>
      </div>
      ${post.courseTag ? `<div class="post-course-tag">${escHtml(post.courseTag)}</div>` : ""}
      ${contentHtml}
      ${mediaHtml}
      <div class="post-footer">
        <button class="post-action-btn like-btn${isLiked ? " liked" : ""}" data-post-id="${post.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? "currentColor" : "none"}">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="count">${likeCount > 0 ? likeCount : ""}</span>
        </button>
        <button class="post-action-btn comment-btn" data-post-id="${post.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span class="count">${commentCount > 0 ? commentCount : ""}</span>
        </button>
        ${isOwner ? `<button class="post-delete-btn" data-post-id="${post.id}">Delete</button>` : ""}
      </div>
    </div>`;

  const readMoreBtn = card.querySelector(`#readmore-${post.id}`);
  if (readMoreBtn) {
    readMoreBtn.onclick = () => {
      const contentEl = card.querySelector(`#content-${post.id}`);
      const collapsed = contentEl.classList.toggle("collapsed");
      readMoreBtn.textContent = collapsed ? "Read more" : "Show less";
    };
  }

  card.querySelector(".like-btn").onclick    = () => handleLike(post.id, card);
  card.querySelector(".comment-btn").onclick = () => openCommentsDrawer(post);
  const delBtn = card.querySelector(".post-delete-btn");
  if (delBtn) delBtn.onclick = () => handleDeletePost(post.id, card);

  return card;
}

// ─── LIKE A POST ───
async function handleLike(postId, card) {
  if (!currentUser) return;
  const btn     = card.querySelector(".like-btn");
  const countEl = btn.querySelector(".count");
  const isLiked = btn.classList.contains("liked");
  const postRef = doc(db, "posts", postId);

  btn.disabled = true;
  try {
    if (isLiked) {
      await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
      btn.classList.remove("liked");
      btn.querySelector("path").setAttribute("fill", "none");
      const cur = parseInt(countEl.textContent || "0");
      countEl.textContent = cur > 1 ? cur - 1 : "";
    } else {
      await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
      btn.classList.add("liked");
      btn.querySelector("path").setAttribute("fill", "currentColor");
      const cur = parseInt(countEl.textContent || "0");
      countEl.textContent = cur + 1;
    }
  } catch (err) { console.error("Like error:", err); }
  btn.disabled = false;
}

// ─── DELETE POST ───
async function handleDeletePost(postId, card) {
  if (!confirm("Delete this post?")) return;
  try {
    await deleteDoc(doc(db, "posts", postId));
    // onSnapshot will remove it; also animate immediately
    card.style.animation  = "none";
    card.style.opacity    = "0";
    card.style.transform  = "scale(0.95)";
    card.style.transition = "all 0.3s ease";
    setTimeout(() => card.remove(), 300);
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete post.");
  }
}

// ─── COMMENTS DRAWER ───
async function openCommentsDrawer(post) {
  activePostId = post.id;
  replyingTo   = null;

  const summary = post.content
    ? post.content.slice(0, 120) + (post.content.length > 120 ? "…" : "")
    : (post.videoUrl ? "🎥 Video post" : post.imageUrl ? "📷 Image post" : post.fileUrl ? `📄 ${post.fileName || "File post"}` : "🔗 Link post");

  document.getElementById("drawerPostSummary").textContent = summary;
  document.getElementById("commentsList").innerHTML =
    '<div class="feed-loading"><div class="spinner"></div><span>Loading comments...</span></div>';
  document.getElementById("replyContext").style.display = "none";
  document.getElementById("commentInput").value = "";
  commentsDrawer.style.display = "flex";

  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }

  // Fetch ALL comments for this post — filter top-level in JS
  // This catches: parentId == null, parentId == undefined, and field missing
  const q = query(
    collection(db, "posts", post.id, "comments"),
    orderBy("createdAt", "asc")
  );

  commentsUnsub = onSnapshot(q, async snap => {
    const list = document.getElementById("commentsList");
    list.innerHTML = "";

    // Separate top-level and replies
    const topLevel = [];
    const repliesMap = {};
    snap.forEach(docSnap => {
      const c = { id: docSnap.id, ...docSnap.data() };
      if (!c.parentId) {
        topLevel.push(c);
      } else {
        if (!repliesMap[c.parentId]) repliesMap[c.parentId] = [];
        repliesMap[c.parentId].push(c);
      }
    });

    // Live total = all comments in snapshot
    const liveTotal = snap.size;

    // Update drawer header with live count
    const drawerHeader = document.querySelector(".drawer-header h3");
    if (drawerHeader) drawerHeader.textContent = `Comments${liveTotal > 0 ? ` (${liveTotal})` : ""}`;

    // Sync the count on the post card in real time
    const postCard = document.querySelector(`[data-post-id="${activePostId}"]`);
    if (postCard) {
      const countEl = postCard.querySelector(".comment-btn .count");
      if (countEl) countEl.textContent = liveTotal > 0 ? liveTotal : "";
    }

    // Also patch the stored commentCount if it's out of sync (silently)
    try {
      const postRef = doc(db, "posts", activePostId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists() && (postSnap.data().commentCount || 0) !== liveTotal) {
        await updateDoc(postRef, { commentCount: liveTotal });
      }
    } catch (_) {}

    if (topLevel.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--ink-muted);padding:32px;font-size:14px;">No comments yet. Be the first!</p>';
      return;
    }

    for (const comment of topLevel) {
      list.appendChild(buildCommentItem(comment, false));

      const replies = repliesMap[comment.id] || [];
      if (replies.length > 0) {
        const toggleBtn = document.createElement("button");
        toggleBtn.className = "reply-thread-toggle";
        toggleBtn.textContent = `↳ ${replies.length} repl${replies.length === 1 ? "y" : "ies"}`;
        let expanded = false;

        const repliesContainer = document.createElement("div");
        repliesContainer.style.display = "none";
        replies.forEach(r => repliesContainer.appendChild(buildCommentItem(r, true)));

        toggleBtn.onclick = () => {
          expanded = !expanded;
          repliesContainer.style.display = expanded ? "block" : "none";
          toggleBtn.textContent = expanded
            ? "↳ Hide replies"
            : `↳ ${replies.length} repl${replies.length === 1 ? "y" : "ies"}`;
        };

        list.appendChild(toggleBtn);
        list.appendChild(repliesContainer);
      }
    }

    list.scrollTop = list.scrollHeight;
  });
}

function buildCommentItem(comment, isReply) {
  const el = document.createElement("div");
  el.className = `comment-item${isReply ? " reply" : ""}`;

  const isLiked = currentUser && (comment.likes || []).includes(currentUser.uid);
  const timeStr = formatRelativeTime(comment.createdAt);
  const isOwner = currentUser && comment.authorId === currentUser.uid;

  el.innerHTML = `
    <img class="comment-avatar"
      src="${(comment.authorId === currentUser?.uid && userData?.photoURL) ? userData.photoURL : (comment.authorPhoto || FALLBACK_AVATAR)}"
      alt=""
      onerror="this.src='data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%2240%22 height%3D%2240%22 viewBox%3D%220 0 40 40%22%3E%3Ccircle cx%3D%2220%22 cy%3D%2220%22 r%3D%2220%22 fill%3D%22%23e8e6f0%22/%3E%3Ccircle cx%3D%2220%22 cy%3D%2215%22 r%3D%226%22 fill%3D%22%23b0aac4%22/%3E%3Cellipse cx%3D%2220%22 cy%3D%2232%22 rx%3D%2210%22 ry%3D%228%22 fill%3D%22%23b0aac4%22/%3E%3C/svg%3E'">
    <div class="comment-bubble">
      <div class="comment-author">${escHtml(comment.authorName || "Student")}</div>
      <div class="comment-text">${escHtml(comment.content)}</div>
      <div class="comment-footer">
        <span class="comment-time">${timeStr}</span>
        <button class="comment-action like-comment${isLiked ? " liked" : ""}" data-id="${comment.id}">
          ${isLiked ? "❤️" : "🤍"} ${(comment.likes || []).length > 0 ? (comment.likes || []).length : ""}
        </button>
        ${!isReply ? `<button class="comment-action reply-btn" data-id="${comment.id}" data-name="${escHtml(comment.authorName || "them")}">Reply</button>` : ""}
        ${isOwner ? `<button class="comment-action delete-comment" data-id="${comment.id}">Delete</button>` : ""}
      </div>
    </div>`;

  el.querySelector(".like-comment").onclick = async () => {
    const btn = el.querySelector(".like-comment");
    const isNowLiked = btn.classList.contains("liked");
    try {
      await updateDoc(doc(db, "posts", activePostId, "comments", comment.id), {
        likes: isNowLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });
    } catch (err) { console.error("Comment like error:", err); }
  };

  const replyBtn = el.querySelector(".reply-btn");
  if (replyBtn) {
    replyBtn.onclick = () => {
      replyingTo = { commentId: comment.id, authorName: comment.authorName };
      document.getElementById("replyingToName").textContent = comment.authorName;
      document.getElementById("replyContext").style.display = "flex";
      document.getElementById("commentInput").focus();
    };
  }

  const delBtn = el.querySelector(".delete-comment");
  if (delBtn) {
    delBtn.onclick = async () => {
      if (!confirm("Delete this comment?")) return;
      try {
        await deleteDoc(doc(db, "posts", activePostId, "comments", comment.id));
        el.remove();
      } catch (err) { alert("Failed to delete comment."); }
    };
  }

  return el;
}

// ─── SEND COMMENT ───
document.getElementById("sendCommentBtn").onclick = async () => {
  const input   = document.getElementById("commentInput");
  const content = input.value.trim();
  if (!content || !activePostId) return;

  const btn = document.getElementById("sendCommentBtn");
  btn.disabled = true;

  try {
    await addDoc(collection(db, "posts", activePostId, "comments"), {
      authorId:    currentUser.uid,
      authorName:  userData.name    || "Student",
      authorPhoto: userData.photoURL || null,
      content,
      parentId:    replyingTo ? replyingTo.commentId : null,
      likes:       [],
      createdAt:   serverTimestamp()
    });

    await updateDoc(doc(db, "posts", activePostId), { commentCount: increment(1) });

    const postCard = document.querySelector(`[data-post-id="${activePostId}"]`);
    if (postCard) {
      const countEl = postCard.querySelector(".comment-btn .count");
      if (countEl) countEl.textContent = parseInt(countEl.textContent || "0") + 1;
    }

    input.value = "";
    replyingTo = null;
    document.getElementById("replyContext").style.display = "none";
  } catch (err) {
    console.error("Send comment error:", err);
    alert("Failed to send comment.");
  }

  btn.disabled = false;
};

document.getElementById("cancelReplyCtx").onclick = () => {
  replyingTo = null;
  document.getElementById("replyContext").style.display = "none";
};

// ─── SETUP UI ───
function setupUI() {
  // Compose box triggers
  document.getElementById("composeTrigger").onclick = () => openPostModal("text");
  document.querySelectorAll(".compose-btn").forEach(btn => {
    btn.onclick = () => openPostModal(btn.dataset.type);
  });

  // Post type tabs inside modal
  document.querySelectorAll(".type-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".type-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      setPostingType(tab.dataset.type);
    };
  });

  // "All Courses" sidebar button — now static outside #courseTags
  document.querySelectorAll('.course-tag[data-course="all"]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".course-tag").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = "all";
      startFeedListener();
    };
  });

  // Type filter sidebar
  document.querySelectorAll(".type-filter").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".type-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeType = btn.dataset.type;
      startFeedListener();
    };
  });

  // Modal close
  document.getElementById("closePostModal").onclick = closePostModal;
  document.getElementById("cancelPostBtn").onclick  = closePostModal;
  document.getElementById("closeDrawer").onclick    = closeDrawer;

  postModal.onclick      = e => { if (e.target === postModal)       closePostModal(); };
  commentsDrawer.onclick = e => { if (e.target === commentsDrawer)  closeDrawer(); };

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (postModal.style.display !== "none")      closePostModal();
      if (commentsDrawer.style.display !== "none") closeDrawer();
    }
  });

  // Char counter
  document.getElementById("postContent").addEventListener("input", () => {
    document.getElementById("contentCount").textContent =
      document.getElementById("postContent").value.length;
  });

  // ── Image upload ──
  document.getElementById("imageFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    imageFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById("imagePreview").src = ev.target.result;
      document.getElementById("imagePreviewWrap").style.display = "block";
      document.getElementById("imageDrop").style.display = "none";
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("removeImage").onclick = () => {
    imageFile = null;
    document.getElementById("imageFileInput").value = "";
    document.getElementById("imagePreviewWrap").style.display = "none";
    document.getElementById("imageDrop").style.display = "flex";
  };

  // ── Video upload ──
  document.getElementById("videoFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    videoFile = file;
    const url = URL.createObjectURL(file);
    const prevVid = document.getElementById("videoPreviewEl");
    prevVid.src = url;
    document.getElementById("videoPreviewWrap").style.display = "block";
    document.getElementById("videoDrop").style.display = "none";
    document.getElementById("videoFileName").textContent = file.name;
  });

  document.getElementById("removeVideo").onclick = () => {
    videoFile = null;
    document.getElementById("videoFileInput").value = "";
    document.getElementById("videoPreviewWrap").style.display = "none";
    document.getElementById("videoDrop").style.display = "flex";
    const prevVid = document.getElementById("videoPreviewEl");
    prevVid.src = "";
    URL.revokeObjectURL(prevVid.src);
  };

  // ── File/notes upload ──
  document.getElementById("fileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    attachFile = file;
    document.getElementById("fileSelectedName").textContent = file.name;
    document.getElementById("fileSelected").style.display = "flex";
    document.getElementById("fileDrop").style.display = "none";
  });

  document.getElementById("removeFile").onclick = () => {
    attachFile = null;
    document.getElementById("fileInput").value = "";
    document.getElementById("fileSelected").style.display = "none";
    document.getElementById("fileDrop").style.display = "flex";
  };

  // ── Link preview ──
  let linkTimeout;
  document.getElementById("linkInput").addEventListener("input", e => {
    clearTimeout(linkTimeout);
    linkTimeout = setTimeout(() => {
      const url = e.target.value.trim();
      const previewBox = document.getElementById("linkPreviewBox");
      if (url.startsWith("http")) {
        try {
          const urlObj = new URL(url);
          document.getElementById("linkDomain").textContent =
            urlObj.hostname.replace("www.", "").toUpperCase();
          document.getElementById("linkUrlPreview").textContent = url;
          previewBox.style.display = "block";
        } catch (_) { previewBox.style.display = "none"; }
      } else {
        previewBox.style.display = "none";
      }
    }, 500);
  });

  document.getElementById("submitPostBtn").onclick = handleSubmitPost;

  // Comment textarea auto-resize + enter-to-send
  const commentInput = document.getElementById("commentInput");
  commentInput.addEventListener("input", () => {
    commentInput.style.height = "auto";
    commentInput.style.height = Math.min(commentInput.scrollHeight, 120) + "px";
  });
  commentInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("sendCommentBtn").click();
    }
  });
}

// ─── OPEN / SET / CLOSE POST MODAL ───
function openPostModal(type = "text") {
  postingType = type;
  document.querySelectorAll(".type-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.type === type);
  });
  setPostingType(type);
  postModal.style.display = "flex";
  setTimeout(() => document.getElementById("postContent").focus(), 100);
}

function setPostingType(type) {
  postingType = type;
  // Hide all panels first
  ["imagePanel","videoPanel","filePanel","linkPanel"].forEach(id => {
    document.getElementById(id).style.display = "none";
  });
  // Show the right one
  if (type === "image")    document.getElementById("imagePanel").style.display = "block";
  if (type === "video")    document.getElementById("videoPanel").style.display = "block";
  if (type === "note")     document.getElementById("filePanel").style.display  = "block";
  if (type === "resource") document.getElementById("linkPanel").style.display  = "block";

  const placeholders = {
    text:     "What's on your mind?",
    question: "What do you want to ask your peers?",
    note:     "Add a description for your notes...",
    image:    "Add a caption...",
    video:    "Add a caption for your video...",
    resource: "Describe this resource..."
  };
  document.getElementById("postContent").placeholder = placeholders[type] || "What's on your mind?";
}

function closePostModal() {
  postModal.style.display = "none";
  // Reset all state
  imageFile = null; videoFile = null; attachFile = null;
  document.getElementById("postContent").value = "";
  document.getElementById("contentCount").textContent = "0";
  // Reset image
  document.getElementById("imageFileInput").value = "";
  document.getElementById("imagePreviewWrap").style.display = "none";
  document.getElementById("imageDrop").style.display = "flex";
  // Reset video
  document.getElementById("videoFileInput").value = "";
  document.getElementById("videoPreviewWrap").style.display = "none";
  document.getElementById("videoDrop").style.display = "flex";
  const prevVid = document.getElementById("videoPreviewEl");
  if (prevVid) { URL.revokeObjectURL(prevVid.src); prevVid.src = ""; }
  // Reset file
  document.getElementById("fileInput").value = "";
  document.getElementById("fileSelected").style.display = "none";
  document.getElementById("fileDrop").style.display = "flex";
  // Reset link
  document.getElementById("linkInput").value = "";
  document.getElementById("linkPreviewBox").style.display = "none";
  // Reset upload progress
  const prog = document.getElementById("uploadProgress");
  if (prog) prog.style.display = "none";
}

function closeDrawer() {
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
  commentsDrawer.style.display = "none";
  activePostId = null; replyingTo = null;
}

// ─── SUBMIT POST ───
async function handleSubmitPost() {
  const content   = document.getElementById("postContent").value.trim();
  const courseTag = document.getElementById("postCourse").value || null;
  const linkUrl   = document.getElementById("linkInput").value.trim() || null;
  const btn       = document.getElementById("submitPostBtn");

  if (!content && !imageFile && !videoFile && !attachFile && !linkUrl) {
    alert("Please add some content to your post.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:6px"></div> Posting...';

  const progWrap = document.getElementById("uploadProgress");
  const progBar  = document.getElementById("uploadProgressBar");
  const progText = document.getElementById("uploadProgressText");

  try {
    let imageUrl = null;
    let videoUrl = null;
    let fileUrl  = null;
    let fileName = null;

    // Upload image
    if (imageFile) {
      const path = `post-images/${currentUser.uid}/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const result = await uploadWithProgress(ref(storage, path), imageFile, progWrap, progBar, progText);
      imageUrl = await getDownloadURL(result);
    }

    // Upload video
    if (videoFile) {
      if (progWrap) { progWrap.style.display = "block"; progText.textContent = "Uploading video..."; }
      const path = `post-videos/${currentUser.uid}/${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const result = await uploadWithProgress(ref(storage, path), videoFile, progWrap, progBar, progText);
      videoUrl = await getDownloadURL(result);
    }

    // Upload file
    if (attachFile) {
      const path = `post-files/${currentUser.uid}/${Date.now()}_${attachFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const result = await uploadWithProgress(ref(storage, path), attachFile, progWrap, progBar, progText);
      fileUrl  = await getDownloadURL(result);
      fileName = attachFile.name;
    }

    await addDoc(collection(db, "posts"), {
      type:        postingType,
      content:     content || null,
      imageUrl,
      videoUrl,
      fileUrl,
      fileName,
      linkUrl,
      courseTag,
      groupId:     null,
      authorId:    currentUser.uid,
      authorName:  userData.name     || "Student",
      authorPhoto: userData.photoURL || null,
      campus:      userData.campus   || null,
      likes:       [],
      commentCount: 0,
      createdAt:   serverTimestamp()
    });

    closePostModal();
    // No need to refresh — onSnapshot will pick up the new post automatically

  } catch (err) {
    console.error("Submit post error:", err);
    alert(`Failed to post: ${err.message}`);
    if (progWrap) progWrap.style.display = "none";
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Post`;
}

// Upload with progress bar support
function uploadWithProgress(storageRef, file, progWrap, progBar, progText) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    if (progWrap) progWrap.style.display = "block";
    task.on("state_changed",
      snapshot => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (progBar)  progBar.style.width = `${pct}%`;
        if (progText) progText.textContent = `Uploading... ${pct}%`;
      },
      err => reject(err),
      () => resolve(task.snapshot.ref)
    );
  });
}

// ─── TRENDING COURSES ───
async function loadTrending() {
  try {
    const snap = await getDocs(
      query(collection(db, "posts"), where("groupId", "==", null), orderBy("createdAt", "desc"), limit(50))
    );
    const counts = {};
    snap.forEach(d => {
      const tag = d.data().courseTag;
      if (tag) counts[tag] = (counts[tag] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const list   = document.getElementById("trendingList");
    list.innerHTML = "";

    if (sorted.length === 0) {
      list.innerHTML = '<p style="font-size:13px;color:var(--ink-muted)">No posts yet</p>';
      return;
    }

    sorted.forEach(([course, count]) => {
      const item = document.createElement("div");
      item.className = "trending-item";
      item.innerHTML = `<span>${course}</span><span class="trending-count">${count}</span>`;
      item.onclick = () => {
        document.querySelectorAll(".course-tag").forEach(b => {
          b.classList.toggle("active", b.dataset.course === course);
        });
        activeFilter = course;
        startFeedListener();
      };
      list.appendChild(item);
    });
  } catch (err) {
    console.error("Trending error:", err);
  }
}

// ─── MY STATS ───
async function loadMyStats() {
  try {
    // Single-field query avoids needing a composite Firestore index
    const snap = await getDocs(
      query(collection(db, "posts"), where("authorId", "==", currentUser.uid))
    );
    let postCount  = 0;
    let totalLikes = 0;
    snap.forEach(d => {
      const data = d.data();
      // Only count global feed posts (not group posts)
      if (data.groupId === null || data.groupId === undefined) {
        postCount++;
        totalLikes += (data.likes || []).length;
      }
    });
    const postCountEl = document.getElementById("myPostCount");
    const likeCountEl = document.getElementById("myLikeCount");
    if (postCountEl) postCountEl.textContent = postCount;
    if (likeCountEl) likeCountEl.textContent = totalLikes;
  } catch (err) {
    console.error("Stats error:", err);
  }
}

// ─── HELPERS ───
function formatRelativeTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}