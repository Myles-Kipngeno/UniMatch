import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const photosGrid = document.getElementById("photosGrid");
const uploadProgress = document.getElementById("uploadProgress");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  loadUserPhotos();
});

// Load user's photo posts
async function loadUserPhotos() {
  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const photoPosts = userDoc.data()?.photoPosts || [];

    photosGrid.innerHTML = "";

    if (photoPosts.length === 0) {
      photosGrid.innerHTML = `
        <div class="empty-state">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
            <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3>No photos yet</h3>
          <p>Upload photos to share with others</p>
        </div>
      `;
      return;
    }

    photoPosts.forEach((photoUrl) => {
      const card = document.createElement("div");
      card.className = "photo-card";
      card.innerHTML = `
        <img src="${photoUrl}" alt="Photo post">
        <button class="delete-btn" data-url="${photoUrl}">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      `;

      const deleteBtn = card.querySelector(".delete-btn");
      deleteBtn.onclick = () => deletePhoto(photoUrl);

      photosGrid.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading photos:", err);
    photosGrid.innerHTML = `
      <div class="empty-state">
        <h3>Error loading photos</h3>
        <p>Please try refreshing the page</p>
      </div>
    `;
  }
}

// Upload Area Click
uploadArea.onclick = () => fileInput.click();

// File Input Change
fileInput.onchange = (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    uploadPhotos(files);
  }
};

// Drag and Drop
uploadArea.ondragover = (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
};

uploadArea.ondragleave = () => {
  uploadArea.classList.remove("drag-over");
};

uploadArea.ondrop = (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const files = Array.from(e.dataTransfer.files).filter(file => 
    file.type.startsWith("image/")
  );
  if (files.length > 0) {
    uploadPhotos(files);
  }
};

// Upload Photos
async function uploadPhotos(files) {
  // Validate file size (5MB max)
  const validFiles = files.filter(file => {
    if (file.size > 5 * 1024 * 1024) {
      alert(`${file.name} is too large. Max size is 5MB.`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  uploadProgress.style.display = "block";
  const uploadedUrls = [];
  let completed = 0;

  for (const file of validFiles) {
    try {
      const url = await uploadSinglePhoto(file, (progress) => {
        const totalProgress = ((completed + progress) / validFiles.length) * 100;
        progressFill.style.width = `${totalProgress}%`;
        progressText.textContent = `Uploading ${completed + 1}/${validFiles.length}...`;
      });

      uploadedUrls.push(url);
      completed++;
      progressFill.style.width = `${(completed / validFiles.length) * 100}%`;
    } catch (err) {
      console.error("Upload error:", err);
      alert(`Failed to upload ${file.name}`);
    }
  }

  // Save URLs to Firestore
  if (uploadedUrls.length > 0) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        photoPosts: arrayUnion(...uploadedUrls)
      });

      progressText.textContent = "Upload complete! ✓";
      setTimeout(() => {
        uploadProgress.style.display = "none";
        progressFill.style.width = "0%";
        fileInput.value = "";
        loadUserPhotos();
      }, 1500);
    } catch (err) {
      console.error("Error saving to Firestore:", err);
      alert("Failed to save photos. Please try again.");
    }
  }
}

// Upload Single Photo
function uploadSinglePhoto(file, onProgress) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const fileName = `photo-posts/${currentUser.uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
        onProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

// Delete Photo
async function deletePhoto(photoUrl) {
  if (!confirm("Delete this photo?")) return;

  try {
    // Remove from Firestore
    await updateDoc(doc(db, "users", currentUser.uid), {
      photoPosts: arrayRemove(photoUrl)
    });

    // Delete from Storage (optional - keeps storage clean)
    try {
      const photoRef = ref(storage, photoUrl);
      await deleteObject(photoRef);
    } catch (err) {
      console.log("Could not delete from storage:", err);
      // Continue anyway - Firestore update is what matters
    }

    // Reload photos
    loadUserPhotos();
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete photo. Please try again.");
  }
}