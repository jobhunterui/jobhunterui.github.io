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

// Suppress Cross-Origin-Opener-Policy warnings from Google Sign-In during development.
// Consider if this is needed or how to handle it long-term for production.
const originalError = console.error;
console.error = function(...args) {
    if (args[0]?.includes?.('Cross-Origin-Opener-Policy')) {
        return;
    }
    originalError.apply(console, args);
};

// Firebase configuration for the application
const firebaseConfig = {
    apiKey: "AIzaSyCyCYzbja2jnuxIdI_qSok1G9o_AnT9UGY",
    authDomain: "jobhunterui.firebaseapp.com",
    projectId: "jobhunterui",
    storageBucket: "jobhunterui.firebasestorage.app",
    messagingSenderId: "1090397321610",
    appId: "1:1090397321610:web:b250a0363544a04fe1f073",
    measurementId: "G-HM10WMT8X9"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Initialize Analytics
const auth = getAuth(app);        // Firebase Authentication service
const db = getFirestore(app);     // Firestore Database service

// --- Global Variables ---
// Expose auth and db instances for other scripts that might need them directly.
window.auth = auth;
window.db = db;
window.currentUser = null; // Holds the currently authenticated user object.

// Expose specific Firestore functions for use in cloud-sync.js or other modules.
// This helps ensure modularity and clear dependencies.
window.firestoreExports = {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
};

console.info("[FirebaseSetup] Firebase initialized. Firestore functions exported:", !!window.firestoreExports);

// --- Header UI Update Functions ---
// These functions are responsible ONLY for updating the header's authentication-related UI elements.

/**
 * Updates the main application header UI for a signed-in user.
 * Shows user profile, hides sign-in button, updates user name/avatar.
 * @param {object} user - The Firebase user object.
 */
window.updateAuthHeaderUIForSignedInUser = function(user) {
    const signInButton = document.getElementById('sign-in-button');
    const userProfile = document.getElementById('user-profile');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const syncStatus = document.getElementById('sync-status-text');

    if (signInButton) signInButton.classList.add('hidden');
    if (userProfile) userProfile.classList.remove('hidden');
    
    if (user) {
        if (userName) userName.textContent = user.displayName || user.email || 'User';
        if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;
    }
    
    if (syncStatus) syncStatus.textContent = 'Connected'; // Reflects connection due to sign-in

    console.info("[UIHeader] Header UI updated for signed-in state.");
};

/**
 * Updates the main application header UI for a signed-out user.
 * Hides user profile, shows sign-in button, clears user info.
 */
window.updateAuthHeaderUIForSignedOutUser = function() {
    const signInButton = document.getElementById('sign-in-button');
    const userProfile = document.getElementById('user-profile');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const syncStatus = document.getElementById('sync-status-text');

    if (signInButton) signInButton.classList.remove('hidden');
    if (userProfile) userProfile.classList.add('hidden');
    if (userAvatar) userAvatar.src = ""; // Clear avatar
    if (userName) userName.textContent = "User"; // Reset display name
    if (syncStatus) syncStatus.textContent = 'Offline';

    console.info("[UIHeader] Header UI updated for signed-out state.");
};

// --- Authentication Business Logic ---

/**
 * Initiates Google Sign-In popup flow.
 * @returns {Promise<object|null>} Firebase user object on success, or null/throws on error.
 */
window.signInWithGoogle = async function() {
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        console.info("[FirebaseAuth] Sign-in successful:", result.user.email);
        
        // Track sign-in event if trackEvent function is available
        if (typeof window.trackEvent === 'function') {
            window.trackEvent('user_signed_in', { 
                method: 'google',
                new_user: result._tokenResponse?.isNewUser || false
            });
        }
        
        return result.user;
    } catch (error) {
        console.error('[FirebaseAuth] Sign-in error:', error.code, error.message);
        
        if (error.code === 'auth/popup-blocked') {
            alert('Popup was blocked. Please allow popups for this site to sign in.');
        } else if (error.code === 'auth/popup-closed-by-user') {
            // User closed popup, usually not an error to show them.
            console.info('[FirebaseAuth] Sign-in popup closed by user.');
        } else {
            alert('Sign-in failed: ' + error.message);
        }
        
        throw error; // Re-throw for other potential error handlers
    }
};

/**
 * Signs out the current user.
 * @returns {Promise<void>}
 */
window.signOut = async function() {
    try {
        await firebaseSignOut(auth);
        console.info("[FirebaseAuth] Sign-out successful.");
        
        // Clear sync status in UI (though updateAuthHeaderUIForSignedOutUser also handles this)
        const syncStatus = document.getElementById('sync-status-text');
        if (syncStatus) syncStatus.textContent = 'Offline';
        
        // Track sign-out event if trackEvent function is available
        if (typeof window.trackEvent === 'function') {
            window.trackEvent('user_signed_out');
        }
    } catch (error) {
        console.error('[FirebaseAuth] Sign-out error:', error.code, error.message);
        throw error; // Re-throw for other potential error handlers
    }
};

// --- Auth State Observer ---
// This is the primary listener for authentication state changes.
// It updates the global currentUser, calls UI update functions, and triggers other app logic.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        console.info("[FirebaseAuth] Auth state changed: User signed in -", user.email);
        window.currentUser = user;
        updateAuthHeaderUIForSignedInUser(user); // Update header UI elements
        
        // Notify other parts of the app (e.g., app.js for profile tab UI)
        if (window.handleAuthStateChange) {
            window.handleAuthStateChange(user);
        }
        
        // Delayed actions to ensure app components are ready
        setTimeout(() => {
            if (window.enableAutoSync) {
                console.info("[FirebaseAuth] Enabling auto-sync post sign-in.");
                window.enableAutoSync();
            }
            
            if (window.migrateLocalToCloud) {
                console.info("[FirebaseAuth] Initiating local to cloud data migration post sign-in.");
                window.migrateLocalToCloud();
            }
        }, 1000); // 1-second delay allows other scripts to potentially load and register their functions
        
    } else {
        // User is signed out
        console.info("[FirebaseAuth] Auth state changed: User signed out.");
        window.currentUser = null;
        updateAuthHeaderUIForSignedOutUser(); // Update header UI elements
        
        // Notify other parts of the app
        if (window.handleAuthStateChange) {
            window.handleAuthStateChange(null);
        }
    }
});

// --- DOM Event Listeners ---
// Setup for UI elements like sign-in/sign-out buttons in the header.
document.addEventListener('DOMContentLoaded', function() {
    const signInButton = document.getElementById('sign-in-button');
    const signOutButton = document.getElementById('sign-out-button'); // In the user profile dropdown
    
    if (signInButton) {
        signInButton.addEventListener('click', () => {
            console.info("[UIAction] Header Sign-in button clicked.");
            signInWithGoogle();
        });
    }
    
    if (signOutButton) {
        signOutButton.addEventListener('click', () => {
            console.info("[UIAction] Header Sign-out button clicked.");
            signOut();
        });
    }
    
    console.info("[FirebaseSetup] Auth-related DOM event listeners configured.");
});