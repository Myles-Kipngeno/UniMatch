import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { getAuth } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { getFirestore } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getStorage } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// import {
//   initializeAppCheck,
//   ReCaptchaV3Provider
// } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrau2Su12koSelSlEqceXbPsGJwj_wr7M",
  authDomain: "unimatch-296fa.firebaseapp.com",
  projectId: "unimatch-296fa",
  storageBucket: "unimatch-296fa.firebasestorage.app",
  messagingSenderId: "904727075849",
  appId: "1:904727075849:web:f657e89c98f1937f6eacd8"
};

const app = initializeApp(firebaseConfig);

// ===============================
// App Check (KEEP ✅)
// ===============================
// initializeAppCheck(app, {
//   provider: new ReCaptchaV3Provider("6LcODU4sAAAAACMCGpRaYwUHWEpbgXVVG0DW7kXU"),
//   isTokenAutoRefreshEnabled: true
// });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
