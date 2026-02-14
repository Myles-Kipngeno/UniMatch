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
    window.location.replace("login.html");
    return;
  }

  // ❌ Email not verified
  if (!user.emailVerified) {
    alert("Please verify your email before accessing UniMatch.");
    await signOut(auth);
    window.location.replace("login.html");
    return;
  }

  // 🔍 Check Firestore user profile
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await signOut(auth);
    window.location.replace("login.html");
    return;
  }

  const data = userSnap.data();

  // ❌ Profile not complete
  if (!data.profileComplete) {
    window.location.replace("profile.html");
    return;
  }

  // ✅ Auth OK — DO NOT redirect if already on dashboard
  if (!window.location.pathname.endsWith("dashboard.html")) {
    console.log("Access granted to dashboard");
    window.location.replace("dashboard.html");
  }
});
