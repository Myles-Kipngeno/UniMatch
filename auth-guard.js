import { auth } from "./firebase.js";
import { onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyDrau2Su12koSelSlEqceXbPsGJwj_wr7M",
  authDomain: "unimatch-296fa.firebaseapp.com",
  projectId: "unimatch-296fa",
  storageBucket: "unimatch-296fa.firebasestorage.app",
  messagingSenderId: "904727075849",
  appId: "1:904727075849:web:f657e89c98f1937f6eacd8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});
