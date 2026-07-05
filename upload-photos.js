import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

// DOM references
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

// Auth Guard
requireAuth().then(async (user) => {
  currentUser = user;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, photo_url")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (userName) userName.textContent = profile.name || "User";
      if (userProfilePhoto && profile.photo_url) userProfilePhoto.src = profile.photo_url;
    }
  } catch (err) {
    console.error("Profile load error:", err);
  }

  loadMedia();
});

// Button wiring
if (uploadPhotoBtn && fileInput) {
  uploadPhotoBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const photos = files.filter(f => f.type.startsWith("image/"));
    const videos = files.filter(f => f.type.startsWith("video/"));

    if (photos.length) uploadFiles(photos, "image");
    if (videos.length) uploadFiles(videos, "video");
  };
}

// Load media from Supabase profile_photos table
async function loadMedia() {
  try {
    const { data: media, error } = await supabase
      .from("profile_photos")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const photos = (media || []).filter(m => m.type === "image");
    const videos = (media || []).filter(m => m.type === "video");

    if (photoCount) photoCount.textContent = photos.length;
    if (videoCount) videoCount.textContent = videos.length;

    renderPhotos(photos);
    renderVideos(videos);
  } catch (err) {
    console.error("Load media error:", err);
    if (photosGrid && videosGrid) {
      photosGrid.innerHTML = videosGrid.innerHTML =
        `<div class="empty-state"><h3>Error loading media</h3><p>Please refresh the page</p></div>`;
    }
  }
}

// Upload Files to Supabase Storage and Insert to profile_photos
async function uploadFiles(files, type) {
  if (uploadProgress) uploadProgress.style.display = "block";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(((i + 1) / files.length) * 100);

    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) progressText.textContent = `Uploading ${i + 1} of ${files.length} (${pct}%)`;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser.id}/${type}_${Date.now()}_${i}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Insert into profile_photos
      await supabase.from("profile_photos").insert({
        user_id: currentUser.id,
        url: publicUrl,
        type: type
      });

      // If user doesn't have a photo_url yet, set primary photo
      const { data: p } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("id", currentUser.id)
        .single();

      if (!p || !p.photo_url) {
        await supabase
          .from("profiles")
          .update({ photo_url: publicUrl })
          .eq("id", currentUser.id);
      }

    } catch (err) {
      console.error("Upload error:", err);
      alert(`Upload failed for ${file.name}: ${err.message}`);
    }
  }

  if (uploadProgress) uploadProgress.style.display = "none";
  loadMedia();
}

function renderPhotos(photos) {
  if (!photosGrid) return;
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
  photos.forEach(item => photosGrid.appendChild(buildMediaCard(item)));
}

function renderVideos(videos) {
  if (!videosGrid) return;
  videosGrid.innerHTML = "";
  if (!videos.length) {
    videosGrid.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 80 80" fill="none">
          <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
          <polygon points="35 30 52 40 35 50" fill="currentColor"/>
        </svg>
        <h3>No videos yet</h3>
        <p>Upload short clips to show your campus lifestyle</p>
      </div>`;
    return;
  }
  videos.forEach(item => videosGrid.appendChild(buildMediaCard(item)));
}

function buildMediaCard(item) {
  const card = document.createElement("div");
  card.className = "media-card";

  const isVid = item.type === "video";
  const mediaElement = isVid
    ? `<video src="${item.url}" controls></video>`
    : `<img src="${item.url}" alt="User Media">`;

  card.innerHTML = `
    ${mediaElement}
    <button class="delete-media-btn" title="Delete Media">✕</button>
  `;

  card.querySelector(".delete-media-btn").onclick = async () => {
    if (!confirm("Delete this item?")) return;
    try {
      await supabase.from("profile_photos").delete().eq("id", item.id);
      loadMedia();
    } catch (err) {
      console.error("Delete media error:", err);
    }
  };

  return card;
}