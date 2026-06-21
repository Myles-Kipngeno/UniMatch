import { auth, db, storage } from "./firebase.js";
import { requireAuth } from "./auth-guard.js";
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ── DOM refs ──────────────────────────────────────────────────
const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
const fileInput = document.getElementById("fileInput");

const photosGrid = document.getElementById("photosGrid");
const videosGrid = document.getElementById("videosGrid");

const uploadProgress = document.getElementById("uploadProgress");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const userProfilePhoto = document.getElementById("userProfilePhoto");
const userName = document.getElementById("userName");
const photoCount = document.getElementById("photoCount");
const videoCount = document.getElementById("videoCount");

let currentUser = null;

// ── Auth ──────────────────────────────────────────────────────
requireAuth().then(async (user) => {
  currentUser = user;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const d = snap.data();
      if (userName) userName.textContent = d.name || "User";
      if (userProfilePhoto && d.photoURL) userProfilePhoto.src = d.photoURL;
    }
  } catch (err) { console.error("Profile load error:", err); }

  loadMedia();
});

// ── Button wiring ─────────────────────────────────────────────
uploadPhotoBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const photos = files.filter(f => f.type.startsWith("image/"));
  const videos = files.filter(f => f.type.startsWith("video/"));

  if (photos.length) uploadFiles(photos, "photo");
  if (videos.length) uploadFiles(videos, "video");
};

// ── Load all media ────────────────────────────────────────────
async function loadMedia() {
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const d = snap.data() || {};
    const photos = d.photoPosts || [];
    const videos = d.videoPosts || [];

    if (photoCount) photoCount.textContent = photos.length;
    if (videoCount) videoCount.textContent = videos.length;

    renderPhotos(photos);
    renderVideos(videos);
  } catch (err) {
    console.error("Load media error:", err);
    photosGrid.innerHTML = videosGrid.innerHTML =
      `<div class="empty-state"><h3>Error loading media</h3><p>Please refresh the page</p></div>`;
  }
}

// ── Render photos ─────────────────────────────────────────────
function renderPhotos(photos) {
  photosGrid.innerHTML = "";
  if (!photos.length) {
    photosGrid.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
          <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
          <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <h3>No photos yet</h3>
        <p>Upload photos to share with others</p>
      </div>`;
    return;
  }
  photos.forEach(url => photosGrid.appendChild(buildPhotoCard(url)));
}

// ── Render videos ─────────────────────────────────────────────
function renderVideos(videos) {
  videosGrid.innerHTML = "";
  if (!videos.length) {
    videosGrid.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 9l6-4v14l-6-4V9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <h3>No videos yet</h3>
        <p>Upload videos to share with others</p>
      </div>`;
    return;
  }
  videos.forEach(url => videosGrid.appendChild(buildVideoCard(url)));
}

// ── Build photo card ──────────────────────────────────────────
function buildPhotoCard(url) {
  const card = document.createElement("div");
  card.className = "media-card";
  card.innerHTML = `
    <img src="${url}" alt="Photo" loading="lazy">
    <button class="delete-btn" title="Delete photo">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>`;
  card.querySelector("img").addEventListener("click", () => openViewer(url, "photo"));
  card.querySelector(".delete-btn").onclick = (e) => { e.stopPropagation(); deleteMedia(url, "photo"); };
  return card;
}

// ── Build video card ──────────────────────────────────────────
function buildVideoCard(url) {
  const card = document.createElement("div");
  card.className = "media-card";
  card.innerHTML = `
    <video src="${url}" preload="metadata" muted playsinline></video>
    <div class="video-play-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
        <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.5)"/>
        <path d="M10 8l6 4-6 4V8z" fill="white"/>
      </svg>
    </div>
    <div class="video-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M10 8l6 4-6 4V8z"/>
      </svg>
      VIDEO
    </div>
    <button class="delete-btn" title="Delete video">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>`;

  const video = card.querySelector("video");
  card.addEventListener("click", (e) => {
    if (e.target.closest(".delete-btn")) return;
    openViewer(url, "video");
  });

  card.querySelector(".delete-btn").onclick = (e) => {
    e.stopPropagation();
    deleteMedia(url, "video");
  };
  return card;
}

// ── Full-screen viewer ────────────────────────────────────────
function openViewer(url, type) {
  const existing = document.getElementById("up-viewer");
  if (existing) existing.remove();

  const viewer = document.createElement("div");
  viewer.id = "up-viewer";
  viewer.className = "up-viewer";

  if (type === "photo") {
    viewer.innerHTML = `
      <div class="up-viewer-bg"></div>
      <div class="up-viewer-content">
        <img src="${url}" alt="Full photo" class="up-viewer-img">
      </div>
      <button class="up-viewer-close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>`;
  } else {
    viewer.innerHTML = `
      <div class="up-viewer-bg"></div>
      <div class="up-viewer-content">
        <video src="${url}" class="up-viewer-video" controls autoplay playsinline></video>
      </div>
      <button class="up-viewer-close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>`;
  }

  document.body.appendChild(viewer);
  setTimeout(() => viewer.classList.add("open"), 10);

  const close = () => {
    viewer.classList.remove("open");
    const vid = viewer.querySelector("video");
    if (vid) vid.pause();
    setTimeout(() => viewer.remove(), 280);
  };

  viewer.querySelector(".up-viewer-close").addEventListener("click", close);
  viewer.querySelector(".up-viewer-bg").addEventListener("click", close);
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
}

// ── Upload files ──────────────────────────────────────────────
async function uploadFiles(files, type) {
  const isPhoto = type === "photo";
  const maxSize = isPhoto ? 5 * 1024 * 1024 : 100 * 1024 * 1024; // 5MB photos, 100MB videos
  const label = isPhoto ? "photo" : "video";
  const folder = isPhoto ? "photo-posts" : "profile-videos";
  const field = isPhoto ? "photoPosts" : "videoPosts";

  const valid = files.filter(f => {
    if (f.size > maxSize) {
      alert(`${f.name} is too large. Max size is ${isPhoto ? "5MB" : "100MB"}.`);
      return false;
    }
    return true;
  });
  if (!valid.length) return;

  uploadProgress.style.display = "block";
  progressFill.style.width = "0%";

  const uploaded = [];
  let done = 0;

  for (const file of valid) {
    try {
      const url = await uploadSingle(file, folder, (p) => {
        const total = ((done + p) / valid.length) * 100;
        progressFill.style.width = `${total}%`;
        progressText.textContent = `Uploading ${label} ${done + 1}/${valid.length}…`;
      });
      uploaded.push(url);
      done++;
      progressFill.style.width = `${(done / valid.length) * 100}%`;
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Failed to upload ${file.name}`);
    }
  }

  if (uploaded.length) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        [field]: arrayUnion(...uploaded)
      });
      progressText.textContent = `${isPhoto ? "Photos" : "Videos"} uploaded ✓`;
      setTimeout(() => {
        uploadProgress.style.display = "none";
        progressFill.style.width = "0%";
        fileInput.value = "";
        loadMedia();
      }, 1500);
    } catch (err) {
      console.error("Firestore save error:", err);
      alert("Failed to save. Please try again.");
    }
  }
}

// ── Upload single file with progress ─────────────────────────
function uploadSingle(file, folder, onProgress) {
  return new Promise((resolve, reject) => {
    const path = `${folder}/${currentUser.uid}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      snap => onProgress(snap.bytesTransferred / snap.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

// ── Delete media ──────────────────────────────────────────────
async function deleteMedia(url, type) {
  const label = type === "photo" ? "photo" : "video";
  if (!confirm(`Delete this ${label}?`)) return;

  const field = type === "photo" ? "photoPosts" : "videoPosts";

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      [field]: arrayRemove(url)
    });
    // Also remove from Storage (best-effort)
    try { await deleteObject(ref(storage, url)); } catch (_) { }
    loadMedia();
  } catch (err) {
    console.error("Delete error:", err);
    alert(`Failed to delete ${label}. Please try again.`);
  }
}