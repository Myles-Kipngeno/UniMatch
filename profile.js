/* ═══════════════════════════════════════════════════════════
   profile.js - Onboarding Wizard & Profile Card System
   ═══════════════════════════════════════════════════════════ */

import { auth, db, storage } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ===============================
// Curated Hobbies & Interests List
// ===============================
const CURATED_INTERESTS = [
  { name: "Music", emoji: "🎵" },
  { name: "Sports", emoji: "⚽" },
  { name: "Gaming", emoji: "🎮" },
  { name: "Coding", emoji: "💻" },
  { name: "Traveling", emoji: "✈️" },
  { name: "Movies", emoji: "🍿" },
  { name: "Books", emoji: "📚" },
  { name: "Cooking", emoji: "🍳" },
  { name: "Hiking", emoji: "🥾" },
  { name: "Art", emoji: "🎨" },
  { name: "Photography", emoji: "📷" },
  { name: "Dancing", emoji: "💃" },
  { name: "Gym", emoji: "🏋️" },
  { name: "Coffee", emoji: "☕" },
  { name: "Writing", emoji: "✍️" },
  { name: "Music Instruments", emoji: "🎹" },
  { name: "Netflix & Chill", emoji: "🎬" },
  { name: "Partying/Clubbing", emoji: "🍻" },
  { name: "TikTok & Reels", emoji: "📱" },
  { name: "Anime & Manga", emoji: "🌸" },
  { name: "Memes & Humor", emoji: "😂" },
  { name: "Sleeping/Naps", emoji: "😴" },
  { name: "Fast Food/Foodie", emoji: "🍔" },
  { name: "Studying/Library", emoji: "📖" },
  { name: "Board Games", emoji: "🎲" },
  { name: "e-sports", emoji: "🏆" },
  { name: "Podcasts", emoji: "🎙️" },
  { name: "Volunteering", emoji: "🤝" }
];

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
const preferenceSelect = document.getElementById("preference");

const pageSubtitle = document.getElementById("pageSubtitle");
const profileTabs = document.getElementById("profileTabs");
const onboardingProgress = document.getElementById("onboardingProgress");
const viewProfileTab = document.getElementById("viewProfileTab");
const wizardButtons = document.getElementById("wizardButtons");
const btnSaveEdit = document.getElementById("btnSaveEdit");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnSubmit = document.getElementById("btnSubmit");

const interestsGrid = document.getElementById("interestsGrid");
const progressBarFill = document.getElementById("progressBarFill");

// Tab links
const tabViewBtn = document.getElementById("tabViewBtn");
const tabEditBtn = document.getElementById("tabEditBtn");

// Preview Elements
const viewPhoto = document.getElementById("viewPhoto");
const viewNameAge = document.getElementById("viewNameAge");
const viewLocation = document.getElementById("viewLocation");
const viewCourseDetail = document.getElementById("viewCourseDetail");
const viewBio = document.getElementById("viewBio");
const viewInterests = document.getElementById("viewInterests");

let currentUser = null;
let selectedInterests = new Set();
let currentStep = 1;

// ===============================
// Populate Interests Grid
// ===============================
function renderInterestsGrid() {
  interestsGrid.innerHTML = "";
  CURATED_INTERESTS.forEach(interest => {
    const pill = document.createElement("div");
    pill.className = "interest-pill" + (selectedInterests.has(interest.name) ? " active" : "");
    pill.innerHTML = `<span class="emoji">${interest.emoji}</span><span>${interest.name}</span>`;

    pill.addEventListener("click", () => {
      if (selectedInterests.has(interest.name)) {
        selectedInterests.delete(interest.name);
        pill.classList.remove("active");
      } else {
        selectedInterests.add(interest.name);
        pill.classList.add("active");
      }
      error.textContent = "";
    });
    interestsGrid.appendChild(pill);
  });
}

// ===============================
// Wizard Step Management
// ===============================
function showStep(step) {
  currentStep = step;

  // Hide all steps
  document.querySelectorAll(".wizard-step").forEach(el => el.style.display = "none");

  // Show active step
  const activeStepEl = document.querySelector(`.wizard-step[data-step="${step}"]`);
  if (activeStepEl) activeStepEl.style.display = "block";

  // Update step dots
  document.querySelectorAll(".step-dot").forEach((dot, idx) => {
    dot.classList.toggle("active", idx + 1 === step);
    dot.classList.toggle("completed", idx + 1 < step);
  });

  // Update progress bar fill width
  const percent = (step / 4) * 100;
  progressBarFill.style.width = `${percent}%`;

  // Update navigation buttons
  btnPrev.style.display = step > 1 ? "block" : "none";
  if (step === 4) {
    btnNext.style.display = "none";
    btnSubmit.style.display = "block";
  } else {
    btnNext.style.display = "block";
    btnSubmit.style.display = "none";
  }

  error.textContent = "";
}

function validateStep(step) {
  if (step === 1) {
    if (!nameInput.value.trim() || !genderSelect.value || !ageInput.value || !campusInput.value.trim() || !courseInput.value.trim()) {
      error.textContent = "Please fill in all details before continuing.";
      return false;
    }
    const age = Number(ageInput.value);
    if (age < 18 || age > 99) {
      error.textContent = "Age must be between 18 and 99.";
      return false;
    }
  } else if (step === 2) {
    if (selectedInterests.size < 3) {
      error.textContent = "Please select at least 3 interests.";
      return false;
    }
  } else if (step === 3) {
    if (!preferenceSelect.value) {
      error.textContent = "Please select matching preference.";
      return false;
    }
  }
  return true;
}

// Wizard Next / Prev click handlers
btnNext.addEventListener("click", () => {
  if (validateStep(currentStep)) {
    showStep(currentStep + 1);
  }
});

btnPrev.addEventListener("click", () => {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
});

// ===============================
// Edit Mode Tab Management
// ===============================
function showTab(tab) {
  if (tab === "view") {
    tabViewBtn.classList.add("active");
    tabEditBtn.classList.remove("active");
    viewProfileTab.style.display = "block";
    form.style.display = "none";
  } else {
    tabViewBtn.classList.remove("active");
    tabEditBtn.classList.add("active");
    viewProfileTab.style.display = "none";
    form.style.display = "block";

    // In edit mode, show all form steps together inline
    document.querySelectorAll(".wizard-step").forEach(el => el.style.display = "block");
    wizardButtons.style.display = "none";
    btnSaveEdit.style.display = "block";
  }
  error.textContent = "";
}

tabViewBtn.addEventListener("click", () => showTab("view"));
tabEditBtn.addEventListener("click", () => showTab("edit"));

// Populate Tinder Profile Card Preview
function populateProfileCardPreview(data) {
  viewPhoto.src = data.photoURL || "default-avatar.png";
  viewNameAge.textContent = `${data.name || "UniMatch User"}${data.age ? `, ${data.age}` : ""}`;
  viewLocation.textContent = `📍 ${data.campus || "Campus"}`;
  viewCourseDetail.textContent = `📚 ${data.course || "Course"}`;
  viewBio.textContent = data.bio || "No bio written yet.";

  viewInterests.innerHTML = "";
  if (data.interests && data.interests.length > 0) {
    data.interests.forEach(interestName => {
      const matchItem = CURATED_INTERESTS.find(i => i.name === interestName);
      const emoji = matchItem ? matchItem.emoji : "✨";
      const tag = document.createElement("span");
      tag.className = "preview-interest-tag";
      tag.innerHTML = `<span>${emoji}</span> <span>${interestName}</span>`;
      viewInterests.appendChild(tag);
    });
  } else {
    viewInterests.innerHTML = `<span style="font-size: 13px; color: #6b6882; font-style: italic;">No interests selected.</span>`;
  }
}

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

  // Render grid
  renderInterestsGrid();

  if (isEditMode) {
    // Enable Edit Mode View
    pageSubtitle.textContent = "Manage Profile";
    profileTabs.style.display = "flex";
    onboardingProgress.style.display = "none";

    if (snap.exists()) {
      const data = snap.data();

      // Load pre-filled inputs
      nameInput.value = data.name || "";
      genderSelect.value = data.gender || "";
      ageInput.value = data.age || "";
      campusInput.value = data.campus || "";
      courseInput.value = data.course || "";
      bioInput.value = data.bio || "";
      preferenceSelect.value = data.preference || "";

      if (data.photoURL) {
        profilePreview.src = data.photoURL;
      }

      // Pre-fill interests Set
      if (data.interests) {
        data.interests.forEach(i => selectedInterests.add(i));
        renderInterestsGrid(); // re-render to activate selected pills
      }

      // Populate card view
      populateProfileCardPreview(data);
      showTab("view");
    } else {
      showTab("edit");
    }
  } else {
    // Onboarding Mode
    // 🚫 Redirect to dashboard if profile already complete
    if (snap.exists() && snap.data().profileComplete) {
      window.location.href = "dashboard.html";
      return;
    }

    // Render first step of onboarding wizard
    pageSubtitle.textContent = "Complete your profile";
    profileTabs.style.display = "none";
    onboardingProgress.style.display = "block";
    showStep(1);
  }
});

// ===============================
// Photo preview on upload
// ===============================
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  profilePreview.src = URL.createObjectURL(file);
});

// ===============================
// Save Profile
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  if (!currentUser) return;

  // Make sure at least 3 interests are selected in either mode
  if (selectedInterests.size < 3) {
    error.textContent = "Please select at least 3 interests.";
    // If onboarding, force-redirect back to step 2
    if (!isEditMode) showStep(2);
    return;
  }

  const name = nameInput.value.trim();
  const gender = genderSelect.value;
  const age = Number(ageInput.value);
  const campus = campusInput.value.trim();
  const course = courseInput.value.trim();
  const bio = bioInput.value.trim();
  const preference = preferenceSelect.value;

  if (!name || !gender || !age || !campus || !course || !preference) {
    error.textContent = "Please complete all required fields.";
    return;
  }

  // Show loading
  const activeSubmitBtn = isEditMode ? btnSaveEdit : btnSubmit;
  const originalBtnHTML = activeSubmitBtn.innerHTML;
  activeSubmitBtn.innerHTML = "<span>Saving...</span>";
  activeSubmitBtn.disabled = true;

  try {
    let photoURL = null;

    // Upload photo to storage if user changed/selected a file
    if (photoInput.files.length > 0) {
      const file = photoInput.files[0];
      const photoRef = ref(
        storage,
        `profilePhotos/${currentUser.uid}/profile.jpg`
      );

      await uploadBytes(photoRef, file);
      photoURL = await getDownloadURL(photoRef);
    } else if (!isEditMode) {
      // In Onboarding mode, photo is REQUIRED
      throw new Error("Please upload a profile picture to complete your setup.");
    }

    // Build user profile payload
    const profileData = {
      name,
      gender,
      age,
      campus,
      course,
      bio,
      preference,
      interests: Array.from(selectedInterests),
      profileComplete: true,
      updatedAt: serverTimestamp()
    };

    if (photoURL) profileData.photoURL = photoURL;

    await setDoc(
      doc(db, "users", currentUser.uid),
      profileData,
      { merge: true }
    );

    // Navigate to dashboard
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("🔥 Save profile failed:", err);
    error.textContent = err.message;
    activeSubmitBtn.innerHTML = originalBtnHTML;
    activeSubmitBtn.disabled = false;
  }
});