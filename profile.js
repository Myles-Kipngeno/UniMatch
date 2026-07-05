import { supabase } from "./js/supabase.js";
import { requireAuth } from "./auth-guard.js";

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

const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get("edit") === "true";

// DOM elements
const form = document.getElementById("profileForm");
const error = document.getElementById("error");
const photoInput = document.getElementById("photoInput");
const profilePreview = document.getElementById("profilePreview");

const nameInput = document.getElementById("name");
const genderSelect = document.getElementById("gender");
const ageInput = document.getElementById("age");
const campusInput = document.getElementById("campus");
const courseInput = document.getElementById("course");
const yearOfStudySelect = document.getElementById("yearOfStudy");
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

const tabViewBtn = document.getElementById("tabViewBtn");
const tabEditBtn = document.getElementById("tabEditBtn");

const viewPhoto = document.getElementById("viewPhoto");
const viewNameAge = document.getElementById("viewNameAge");
const viewLocation = document.getElementById("viewLocation");
const viewCourseDetail = document.getElementById("viewCourseDetail");
const viewBio = document.getElementById("viewBio");
const viewInterests = document.getElementById("viewInterests");

let currentUser = null;
let selectedInterests = new Set();
let currentStep = 1;
let currentPhotoUrl = "";

function renderInterestsGrid() {
  if (!interestsGrid) return;
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
      if (error) error.textContent = "";
    });
    interestsGrid.appendChild(pill);
  });
}

function updateWizardStep(step) {
  currentStep = step;
  document.querySelectorAll(".form-step").forEach((el, index) => {
    el.classList.toggle("active", index + 1 === step);
  });

  if (progressBarFill) {
    progressBarFill.style.width = `${(step / 3) * 100}%`;
  }

  if (btnPrev) btnPrev.style.display = step === 1 ? "none" : "inline-flex";
  if (btnNext) btnNext.style.display = step === 3 ? "none" : "inline-flex";
  if (btnSubmit) btnSubmit.style.display = step === 3 ? "inline-flex" : "none";
}

function switchTab(mode) {
  if (mode === "view") {
    if (tabViewBtn) tabViewBtn.classList.add("active");
    if (tabEditBtn) tabEditBtn.classList.remove("active");
    if (viewProfileTab) viewProfileTab.style.display = "block";
    if (form) form.style.display = "none";
    if (wizardButtons) wizardButtons.style.display = "none";
  } else {
    if (tabEditBtn) tabEditBtn.classList.add("active");
    if (tabViewBtn) tabViewBtn.classList.remove("active");
    if (viewProfileTab) viewProfileTab.style.display = "none";
    if (form) form.style.display = "block";
    if (isEditMode) {
      if (wizardButtons) wizardButtons.style.display = "none";
      if (btnSaveEdit) btnSaveEdit.style.display = "block";
      document.querySelectorAll(".form-step").forEach(el => el.classList.add("active"));
    } else {
      if (wizardButtons) wizardButtons.style.display = "flex";
      if (btnSaveEdit) btnSaveEdit.style.display = "none";
      updateWizardStep(currentStep);
    }
  }
}

// Photo Preview Listener
if (photoInput) {
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && profilePreview) {
      const reader = new FileReader();
      reader.onload = (event) => {
        profilePreview.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// Boot
requireAuth().then(async (user) => {
  currentUser = user;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      if (nameInput) nameInput.value = profile.name || "";
      if (genderSelect && profile.gender) genderSelect.value = profile.gender;
      if (ageInput && profile.age) ageInput.value = profile.age;
      if (campusInput) campusInput.value = profile.campus || "";
      if (courseInput) courseInput.value = profile.course || "";
      if (yearOfStudySelect && profile.year_of_study) yearOfStudySelect.value = profile.year_of_study;
      if (bioInput) bioInput.value = profile.bio || "";
      if (preferenceSelect && profile.preference) preferenceSelect.value = profile.preference;

      if (profile.interests && Array.isArray(profile.interests)) {
        selectedInterests = new Set(profile.interests);
      }

      if (profile.photo_url) {
        currentPhotoUrl = profile.photo_url;
        if (profilePreview) profilePreview.src = profile.photo_url;
        if (viewPhoto) viewPhoto.src = profile.photo_url;
      }

      // Populate View Tab
      if (viewNameAge) viewNameAge.textContent = `${profile.name || "Student"}${profile.age ? `, ${profile.age}` : ""}`;
      if (viewLocation) viewLocation.textContent = `📍 ${profile.campus || "Campus"}`;
      if (viewCourseDetail) viewCourseDetail.textContent = `📚 ${profile.course || "Major"} (${profile.year_of_study ? profile.year_of_study + " Year" : "Student"})`;
      if (viewBio) viewBio.textContent = profile.bio || "No bio updated yet.";
      
      if (viewInterests) {
        viewInterests.innerHTML = (profile.interests || []).map(i => {
          const item = CURATED_INTERESTS.find(ci => ci.name === i);
          return `<span class="preview-interest-tag"><span>${item ? item.emoji : "✨"}</span><span>${i}</span></span>`;
        }).join("");
      }

      // If user came from edit link or has profile complete
      if (isEditMode || profile.profile_complete) {
        if (profileTabs) profileTabs.style.display = "flex";
        if (pageSubtitle) pageSubtitle.textContent = "Manage your dating profile & photos";
        if (onboardingProgress) onboardingProgress.style.display = "none";
        switchTab("view");
      } else {
        switchTab("edit");
      }
    } else {
      switchTab("edit");
    }

    renderInterestsGrid();
  } catch (err) {
    console.error("Profile load error:", err);
  }
});

// Wizard Navigation
if (btnNext) {
  btnNext.addEventListener("click", () => {
    if (currentStep === 1) {
      if (!nameInput.value.trim() || !genderSelect.value || !ageInput.value) {
        if (error) error.textContent = "Please fill in all basic info fields.";
        return;
      }
    }
    if (currentStep === 2) {
      if (!campusInput.value.trim() || !courseInput.value.trim()) {
        if (error) error.textContent = "Please fill in your campus and course info.";
        return;
      }
    }
    if (error) error.textContent = "";
    updateWizardStep(currentStep + 1);
  });
}

if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    if (error) error.textContent = "";
    updateWizardStep(currentStep - 1);
  });
}

// Tab Listeners
if (tabViewBtn) tabViewBtn.addEventListener("click", () => switchTab("view"));
if (tabEditBtn) tabEditBtn.addEventListener("click", () => switchTab("edit"));

// Form Submit Handler (Save Profile)
async function saveProfile(e) {
  if (e) e.preventDefault();
  if (error) error.textContent = "";

  const name = nameInput.value.trim();
  const gender = genderSelect.value;
  const age = parseInt(ageInput.value);
  const campus = campusInput.value.trim();
  const course = courseInput.value.trim();
  const yearOfStudy = yearOfStudySelect ? yearOfStudySelect.value : "";
  const bio = bioInput ? bioInput.value.trim() : "";
  const preference = preferenceSelect ? preferenceSelect.value : "all";

  if (!name || !gender || !age || !campus || !course) {
    if (error) error.textContent = "Please complete all required fields.";
    return;
  }

  const submitBtn = e ? e.target.querySelector('button[type="submit"]') || btnSaveEdit : btnSaveEdit;
  if (submitBtn) submitBtn.disabled = true;

  try {
    let photoUrl = currentPhotoUrl;

    // Handle profile photo upload to Supabase Storage if file selected
    const file = photoInput ? photoInput.files[0] : null;
    if (file) {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentUser.id}/profile_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.publicUrl;
    }

    // Save to PostgreSQL profiles table
    const profilePayload = {
      id: currentUser.id,
      email: currentUser.email,
      name: name,
      gender: gender,
      age: age,
      campus: campus,
      course: course,
      year_of_study: yearOfStudy,
      bio: bio,
      preference: preference,
      interests: Array.from(selectedInterests),
      photo_url: photoUrl,
      profile_complete: true,
      updated_at: new Date().toISOString()
    };

    // 1️⃣ Try UPDATE first (updates existing profile created by auth trigger)
    const { error: updateErr, count } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", currentUser.id);

    if (updateErr) {
      console.warn("Update error, trying upsert fallback:", updateErr);
      // 2️⃣ Fallback to UPSERT with explicit onConflict
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (upsertErr) throw upsertErr;
    }

    alert("Profile saved successfully!");
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("Save profile error:", err);
    if (error) error.textContent = err.message || "Failed to save profile. Try again.";
    if (submitBtn) submitBtn.disabled = false;
  }
}

if (form) form.addEventListener("submit", saveProfile);
if (btnSaveEdit) btnSaveEdit.addEventListener("click", saveProfile);