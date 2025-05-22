// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-analytics.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut as firebaseSignOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

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

// Global variables
window.auth = auth;
window.db = db;
window.currentUser = null;

console.log("Firebase initialized successfully");

// Authentication functions
window.signInWithGoogle = async function() {
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Sign-in successful:", result.user);
        
        // Track sign-in event
        if (typeof trackEvent === 'function') {
            trackEvent('user_signed_in', { 
                method: 'google',
                new_user: result._tokenResponse?.isNewUser || false
            });
        }
        
        return result.user;
    } catch (error) {
        console.error('Sign-in error:', error);
        alert('Sign-in failed: ' + error.message);
        throw error;
    }
};

window.signOut = async function() {
    try {
        await firebaseSignOut(auth);
        console.log("Sign-out successful");
        
        // Track sign-out event
        if (typeof trackEvent === 'function') {
            trackEvent('user_signed_out');
        }
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
};

// Update UI functions
window.updateUIForSignedInUser = function(user) {
    const signInButton = document.getElementById('sign-in-button');
    const userProfile = document.getElementById('user-profile');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const syncStatus = document.getElementById('sync-status-text');
    
    if (signInButton) signInButton.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    if (userName) userName.textContent = user.displayName || user.email || 'User';
    if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;
    if (syncStatus) syncStatus.textContent = 'Synced';
    
    console.log("UI updated for signed-in user");
};

window.updateUIForSignedOutUser = function() {
    const signInButton = document.getElementById('sign-in-button');
    const userProfile = document.getElementById('user-profile');
    const syncStatus = document.getElementById('sync-status-text');
    
    if (signInButton) signInButton.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    if (syncStatus) syncStatus.textContent = 'Offline';
    
    console.log("UI updated for signed-out user");
};

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User signed in:", user.email);
        window.currentUser = user;
        updateUIForSignedInUser(user);
    } else {
        console.log("User signed out");
        window.currentUser = null;
        updateUIForSignedOutUser();
    }
});

// Set up event listeners when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button');
    
    if (signInButton) {
        signInButton.addEventListener('click', () => {
            console.log("Sign-in button clicked");
            signInWithGoogle();
        });
    }
    
    if (signOutButton) {
        signOutButton.addEventListener('click', () => {
            console.log("Sign-out button clicked");
            signOut();
        });
    }
    
    console.log("Auth event listeners set up");
});