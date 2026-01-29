import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

  // ❌ Not logged in
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // ❌ Email not verified
  if (!user.emailVerified) {
    alert("Please verify your email before accessing UniMatch.");
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  // 🔍 Check Firestore user profile
  const userSnap = await getDoc(doc(db, "users", user.uid));

  if (!userSnap.exists()) {
    // Safety fallback
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  const data = userSnap.data();

  // ❌ Profile not complete
  if (!data.profileComplete) {
    window.location.href = "profile.html";
    return;
  }

  // ✅ Fully authenticated & onboarded
  console.log("Access granted to dashboard");
});
