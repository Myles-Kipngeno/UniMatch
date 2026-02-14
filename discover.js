import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById("discoverContainer");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    container.innerHTML = "";

    // Current user
    const meSnap = await getDoc(doc(db, "users", user.uid));
    if (!meSnap.exists() || !meSnap.data().profileComplete) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Complete Your Profile</h3>
          <p>Finish setting up your profile to start discovering connections</p>
          <button onclick="location.href='profile.html'">Complete Profile</button>
        </div>
      `;
      return;
    }
    const me = meSnap.data();

    // All completed profiles
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("profileComplete", "==", true))
    );

    // Likes sent by me
    const likesSnap = await getDocs(
      query(collection(db, "likes"), where("from", "==", user.uid))
    );
    const likedUids = new Set(likesSnap.docs.map(d => d.data().to));

    let hasCards = false;
    let passedCards = []; // Store passed cards for undo

    for (const snap of usersSnap.docs) {
      const targetUid = snap.id;
      const data = snap.data();

      if (
        targetUid === user.uid ||
        (me.preference !== "all" && data.gender !== me.preference) ||
        data.campus !== me.campus
      ) continue;

      hasCards = true;

      const card = document.createElement("div");
      card.className = "user-card";

      const isLiked = likedUids.has(targetUid);

      card.innerHTML = `
        <img src="${data.photoURL || "./assets/images/default-avatar.png"}" alt="${data.name}">
        
        <button class="info-btn" data-action="info">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="M10 14v-4M10 6h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        
        <div class="card-info">
          <h3>${data.name}, ${data.age}</h3>
          <p>📍 ${data.campus}</p>
          <p>📚 ${data.course}</p>
        </div>
        <div class="card-actions">
          <button class="action-btn pass-btn" data-action="pass">✕</button>
          <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-action="like">
            ${isLiked ? '💔' : '❤️'}
          </button>
        </div>
      `;

      const likeBtn = card.querySelector('[data-action="like"]');
      const passBtn = card.querySelector('[data-action="pass"]');
      const infoBtn = card.querySelector('[data-action="info"]');

      // Info button handler - show profile details modal
      infoBtn.onclick = async (e) => {
        e.stopPropagation();
        
        // Increment profile view count
        try {
          const userRef = doc(db, "users", targetUid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const currentViews = userSnap.data().profileViews || 0;
            await updateDoc(userRef, {
              profileViews: currentViews + 1
            });
            console.log("Profile view counted for:", targetUid);
          }
        } catch (err) {
          console.error("Could not update view count:", err);
        }
        
        showProfileModal(data, targetUid);
      };

      // Like button handler
      likeBtn.onclick = async (e) => {
        e.stopPropagation();
        likeBtn.disabled = true;

        const from = user.uid;
        const to = targetUid;
        const likeId = `${from}_${to}`;
        const reverseLikeId = `${to}_${from}`;
        const matchId = [from, to].sort().join("_");

        try {
          if (likedUids.has(to)) {
            // Unlike
            console.log("Unliking user:", to);
            await deleteDoc(doc(db, "likes", likeId));
            likedUids.delete(to);
            likeBtn.classList.remove('liked');
            likeBtn.textContent = '❤️';
            
            // Delete match if it exists
            try {
              await deleteDoc(doc(db, "matches", matchId));
            } catch (e) {
              // Match might not exist
            }
          } else {
            // Like with animation
            card.classList.add('swiping-right');
            
            console.log("Creating like from", from, "to", to);
            console.log("Like data:", {
              from,
              to,
              createdAt: "serverTimestamp()"
            });
            
            await setDoc(doc(db, "likes", likeId), {
              from,
              to,
              createdAt: serverTimestamp()
            });
            
            console.log("Like created successfully");
            likedUids.add(to);

            // Check if they liked us back
            console.log("Checking for reverse like:", reverseLikeId);
            const reverseLikeSnap = await getDoc(doc(db, "likes", reverseLikeId));
            
            if (reverseLikeSnap.exists()) {
              // It's a match!
              console.log("Creating match:", matchId);
              await setDoc(doc(db, "matches", matchId), {
                users: [from, to],
                createdAt: serverTimestamp()
              });
              
              console.log("Match created successfully!");
              
              // Show match celebration
              setTimeout(() => {
                alert("🎉 It's a Match! Check your matches page!");
              }, 300);
            }
            
            // Remove card after animation
            setTimeout(() => {
              card.classList.add('swipe-right');
              setTimeout(() => card.remove(), 500);
            }, 100);
          }
        } catch (err) {
          console.error("Like error details:", err);
          console.error("Error code:", err.code);
          console.error("Error message:", err.message);
          
          if (err.code === "permission-denied") {
            alert("Permission denied. Check Firestore rules for 'likes' collection.");
          } else {
            alert(`Action failed: ${err.message}`);
          }
          card.classList.remove('swiping-right');
        }

        likeBtn.disabled = false;
      };

      // Pass button handler with undo
      passBtn.onclick = (e) => {
        e.stopPropagation();
        card.classList.add('swiping-left');
        
        // Show undo notification
        showUndoNotification(() => {
          // Undo callback - bring card back
          card.classList.remove('swiping-left', 'swipe-left');
          card.style.display = 'block';
        });
        
        setTimeout(() => {
          card.classList.add('swipe-left');
          setTimeout(() => {
            card.style.display = 'none'; // Hide instead of remove
            passedCards.push(card);
          }, 500);
        }, 100);
      };

      container.appendChild(card);
    }

    if (!hasCards) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No More Profiles</h3>
          <p>You've seen everyone in your area. Check back later!</p>
          <button onclick="location.href='dashboard.html'">Back to Dashboard</button>
        </div>
      `;
    }

  } catch (err) {
    console.error("Discover error:", err);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Something Went Wrong</h3>
        <p>We couldn't load profiles. Please try again.</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `;
  }
});

// Undo notification function
function showUndoNotification(undoCallback) {
  // Remove existing undo notification if any
  const existing = document.querySelector('.undo-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'undo-notification';
  notification.innerHTML = `
    <span>Profile passed</span>
    <button class="undo-btn">Undo</button>
  `;

  document.body.appendChild(notification);

  // Show with animation
  setTimeout(() => notification.classList.add('show'), 10);

  const undoBtn = notification.querySelector('.undo-btn');
  let undoClicked = false;

  undoBtn.onclick = () => {
    undoClicked = true;
    undoCallback();
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  };

  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (!undoClicked) {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Profile details modal function
async function showProfileModal(userData, userId) {
  // Remove existing modal if any
  const existing = document.querySelector('.profile-modal');
  if (existing) existing.remove();

  // Fetch user's photo posts
  let photoPosts = [];
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists() && userDoc.data().photoPosts) {
      photoPosts = userDoc.data().photoPosts || [];
    }
  } catch (err) {
    console.error("Error fetching photo posts:", err);
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'profile-modal';
  
  // Build photo gallery HTML
  let photosHTML = '';
  
  if (photoPosts.length === 0) {
    // No posts - show placeholder
    photosHTML = `
      <div class="no-photos">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="10" y="15" width="60" height="50" rx="4" stroke="currentColor" stroke-width="2"/>
          <circle cx="40" cy="35" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M10 55l15-15 10 10 20-20 15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>No photos yet</p>
      </div>
    `;
  } else {
    // Has posts - show gallery
    photoPosts.forEach((photoUrl, index) => {
      photosHTML += `
        <div class="photo-item ${index === 0 ? 'active' : ''}">
          <img src="${photoUrl}" alt="${userData.name}'s photo">
        </div>
      `;
    });
  }

  const totalPhotos = photoPosts.length;

  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <button class="modal-close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      
      <div class="photo-gallery">
        ${totalPhotos > 1 ? `
          <button class="gallery-nav prev">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        ` : ''}
        
        <div class="photo-container">
          ${photosHTML}
        </div>
        
        ${totalPhotos > 1 ? `
          <button class="gallery-nav next">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          
          <div class="photo-dots">
            ${photoPosts.map((_, i) => 
              `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
            ).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="profile-details">
        <h2>${userData.name}, ${userData.age}</h2>
        
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 18c-4.478 0-8-2.015-8-4.5S5.522 9 10 9s8 2.015 8 4.5S14.478 18 10 18z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>${userData.gender || 'Not specified'}</span>
        </div>
        
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C6.134 2 3 5.134 3 9c0 5.25 7 11 7 11s7-5.75 7-11c0-3.866-3.134-7-7-7z" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="10" cy="9" r="2" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>${userData.campus}</span>
        </div>
        
        <div class="detail-item">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>${userData.course}</span>
        </div>
        
        ${userData.bio ? `
          <div class="bio-section">
            <h3>About</h3>
            <p>${userData.bio}</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Show modal with animation
  setTimeout(() => modal.classList.add('show'), 10);

  // Gallery navigation (only if there are photos)
  if (totalPhotos > 1) {
    let currentPhotoIndex = 0;
    const photoItems = modal.querySelectorAll('.photo-item');
    const dots = modal.querySelectorAll('.dot');
    const prevBtn = modal.querySelector('.gallery-nav.prev');
    const nextBtn = modal.querySelector('.gallery-nav.next');

    function showPhoto(index) {
      photoItems.forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
      currentPhotoIndex = index;
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        const newIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photoItems.length - 1;
        showPhoto(newIndex);
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        const newIndex = currentPhotoIndex < photoItems.length - 1 ? currentPhotoIndex + 1 : 0;
        showPhoto(newIndex);
      };
    }

    dots.forEach((dot, index) => {
      dot.onclick = () => showPhoto(index);
    });
  }

  // Close modal
  const closeBtn = modal.querySelector('.modal-close');
  const overlay = modal.querySelector('.modal-overlay');

  function closeModal() {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }

  closeBtn.onclick = closeModal;
  overlay.onclick = closeModal;
}