import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, setDoc, getDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { ref, uploadBytes, getDownloadURL } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ===============================
// Detect EDIT mode
// ===============================
const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get("edit") === "true";

// ===============================
// DOM elements
// ===============================
const form = document.getElementById("profileForm");
const error = document.getElementById("error");
const photoInput = document.getElementById("photoInput");
const profilePreview = document.getElementById("profilePreview");

const nameInput = document.getElementById("name");
const genderSelect = document.getElementById("gender");
const ageInput = document.getElementById("age");
const campusInput = document.getElementById("campus");
const courseInput = document.getElementById("course");
const bioInput = document.getElementById("bio");

let currentUser = null;

// ===============================
// Auth guard + load profile
// ===============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));

  // 🚫 Block ONLY if not editing
  if (snap.exists() && snap.data().profileComplete && !isEditMode) {
    window.location.href = "dashboard.html";
    return;
  }

  // ✏️ Pre-fill form in edit mode
  if (isEditMode && snap.exists()) {
    const data = snap.data();

    nameInput.value = data.name || "";
    genderSelect.value = data.gender || "";
    ageInput.value = data.age || "";
    campusInput.value = data.campus || "";
    courseInput.value = data.course || "";
    bioInput.value = data.bio || "";

    if (data.photoURL && profilePreview) {
      profilePreview.src = data.photoURL;
    }
  }
});

// ===============================
// Photo preview
// ===============================
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  profilePreview.src = URL.createObjectURL(file);
});

// ===============================
// Save profile
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  if (!currentUser) return;

  const name = nameInput.value.trim();
  const gender = genderSelect.value;
  const age = Number(ageInput.value);
  const campus = campusInput.value.trim();
  const course = courseInput.value.trim();
  const bio = bioInput.value.trim();

  if (!name || !gender || !age || !campus || !course) {
    error.textContent = "Please complete all required fields.";
    return;
  }

  try {
    let photoURL = null;

    if (photoInput.files.length > 0) {
      const file = photoInput.files[0];
      const photoRef = ref(
        storage,
        `profilePhotos/${currentUser.uid}/profile.jpg`
      );

      await uploadBytes(photoRef, file);
      photoURL = await getDownloadURL(photoRef);
    }

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        name,
        gender,
        age,
        campus,
        course,
        bio,
        photoURL,
        profileComplete: true,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("🔥 Save profile failed:", err);
    error.textContent = err.message;
  }
});
