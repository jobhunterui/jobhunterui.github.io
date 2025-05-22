// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCyCYzbja2jnuxIdI_qSok1G9o_AnT9UGY",
    authDomain: "jobhunterui.firebaseapp.com",
    projectId: "jobhunterui",
    storageBucket: "jobhunterui.firebasestorage.app",
    messagingSenderId: "1090397321610",
    appId: "1:1090397321610:web:b250a0363544a04fe1f073",
    measurementId: "G-HM10WMT8X9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Make these available globally
window.auth = auth;
window.db = db;
window.currentUser = null;

console.log("Firebase initialized successfully");