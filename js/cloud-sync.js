// cloud-sync.js - Updated to use separate collections and include professional profiling

// Wait for Firestore functions to be available
function getFirestoreFunctions() {
    if (window.firestoreExports) {
        return window.firestoreExports;
    }
    // Return empty object with console warnings if not available
    console.warn('Firestore functions not yet available');
    return {
        doc: () => console.error('Firestore not initialized'),
        setDoc: () => console.error('Firestore not initialized'),
        getDoc: () => console.error('Firestore not initialized'),
        serverTimestamp: () => console.error('Firestore not initialized')
    };
}

// Sync data to Firebase Firestore - Use separate collection for application data
window.syncDataToCloud = async function(userData) {
    if (!window.currentUser || !window.db) {
        console.log('Cannot sync: user not signed in or database not ready');
        return false;
    }
    
    try {
        updateSyncStatus('syncing');
        
        // Get Firestore functions when needed
        const { doc, setDoc, serverTimestamp } = getFirestoreFunctions();
        
        // Check if functions are actually available
        if (!doc || !setDoc || !serverTimestamp) {
            throw new Error('Firestore functions not available');
        }
        
        // Use separate collection for application data (not user profile data)
        const appDataDocRef = doc(window.db, 'user_app_data', window.currentUser.uid);
        
        // Prepare sync data including professional profile
        const syncData = {
            savedJobs: userData.savedJobs || [],
            profileData: userData.profileData || {},
            careerGoal: userData.careerGoal || null,
            lastSync: serverTimestamp(),
            version: '1.0.0',
            email: window.currentUser.email
        };

        // Add professional profile if it exists
        if (userData.professionalProfile) {
            syncData.professionalProfile = userData.professionalProfile;
        }
        
        await setDoc(appDataDocRef, syncData, { merge: true });
        
        console.log('Application data synced to cloud successfully');
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Sync failed:', error);
        updateSyncStatus('error');
        return false;
    }
};

// Load data from Firebase Firestore - Use separate collection for application data
window.loadDataFromCloud = async function() {
    if (!window.currentUser || !window.db) {
        console.log('Cannot load: user not signed in or database not ready');
        return null;
    }
    
    try {
        // Get Firestore functions when needed
        const { doc, getDoc } = getFirestoreFunctions();
        
        // Check if functions are actually available
        if (!doc || !getDoc) {
            throw new Error('Firestore functions not available');
        }
        
        // Use separate collection for application data (not user profile data)
        const appDataDocRef = doc(window.db, 'user_app_data', window.currentUser.uid);
        const docSnap = await getDoc(appDataDocRef);
        
        if (docSnap.exists()) {
            console.log('Application data loaded from cloud');
            return docSnap.data();
        } else {
            console.log('No cloud application data found for user');
            return null;
        }
    } catch (error) {
        console.error('Failed to load cloud application data:', error);
        return null;
    }
};

// Sync professional profile to backend API and local storage
window.syncProfessionalProfileToCloud = async function(profileData) {
    if (!window.currentUser) {
        console.log('Cannot sync professional profile: user not signed in');
        return false;
    }

    try {
        updateSyncStatus('syncing');
        
        // Save to backend API (which stores in Firestore professionally)
        if (typeof window.saveProfileToCloud === 'function') {
            await window.saveProfileToCloud(profileData);
            console.log('Professional profile synced to backend API successfully');
        } else {
            console.warn('saveProfileToCloud function not available - using Firestore directly');
            
            // Fallback to direct Firestore sync
            const userData = {
                savedJobs: getSavedJobs(),
                profileData: getProfileData(),
                careerGoal: getCareerGoalData(),
                professionalProfile: profileData
            };
            
            await window.syncDataToCloud(userData);
        }
        
        updateSyncStatus('synced');
        return true;
    } catch (error) {
        console.error('Professional profile sync failed:', error);
        updateSyncStatus('error');
        return false;
    }
};

// Load professional profile from backend API
window.loadProfessionalProfileFromCloud = async function() {
    if (!window.currentUser) {
        console.log('Cannot load professional profile: user not signed in');
        return null;
    }

    try {
        // Try backend API first
        if (typeof window.loadProfileFromCloud === 'function') {
            const backendProfile = await window.loadProfileFromCloud();
            if (backendProfile && backendProfile.profile) {
                console.log('Professional profile loaded from backend API');
                // THE FIX: Return only the nested 'profile' object.
                return backendProfile.profile; 
            }
        } else {
            console.warn('loadProfileFromCloud function not available - using Firestore directly');
        }
        
        // Fallback to Firestore app data
        const appData = await window.loadDataFromCloud();
        if (appData && appData.professionalProfile) {
            console.log('Professional profile loaded from Firestore app data');
            return appData.professionalProfile;
        }
        
        console.log('No professional profile found in cloud');
        return null;
    } catch (error) {
        console.error('Failed to load professional profile from cloud:', error);
        return null;
    }
};

// Update sync status in UI
function updateSyncStatus(status) {
    const syncStatusText = document.getElementById('sync-status-text');
    const lastSyncTime = document.getElementById('last-sync-time');
    
    if (syncStatusText) {
        switch(status) {
            case 'synced':
                syncStatusText.textContent = '✅ Synced';
                syncStatusText.style.color = '#27ae60';
                break;
            case 'syncing':
                syncStatusText.textContent = '🔄 Syncing...';
                syncStatusText.style.color = '#f39c12';
                break;
            case 'error':
                syncStatusText.textContent = '❌ Sync Error';
                syncStatusText.style.color = '#e74c3c';
                break;
            case 'offline':
                syncStatusText.textContent = 'Offline';
                syncStatusText.style.color = '#95a5a6';
                break;
        }
    }
    
    if (lastSyncTime && status === 'synced') {
        lastSyncTime.textContent = new Date().toLocaleTimeString();
    }
}

// Migrate local data to cloud on first sign-in - now includes professional profile
window.migrateLocalToCloud = async function() {
    if (!window.currentUser) return;
    
    console.log('Starting local to cloud migration...');
    updateSyncStatus('syncing');
    
    try {
        // Get local data including career goal and professional profile
        const localData = {
            savedJobs: getSavedJobs(),
            profileData: getProfileData(),
            careerGoal: getCareerGoalData(),
            professionalProfile: getProfessionalProfile()
        };
        
        // Get cloud data from the correct collection
        const cloudData = await window.loadDataFromCloud();
        
        // Load professional profile from backend if available
        let cloudProfessionalProfile = null;
        try {
            cloudProfessionalProfile = await window.loadProfessionalProfileFromCloud();
        } catch (error) {
            console.log('Could not load professional profile from backend:', error.message);
        }
        
        let mergedData;
        if (!cloudData || !cloudData.savedJobs || cloudData.savedJobs.length === 0) {
            // No cloud data, use local data
            mergedData = localData;
            console.log('Using local data for initial sync');
        } else {
            // Merge data - preferring cloud data but adding any local jobs not in cloud
            mergedData = {
                savedJobs: mergeJobs(cloudData.savedJobs, localData.savedJobs),
                profileData: cloudData.profileData.cv ? cloudData.profileData : localData.profileData,
                careerGoal: cloudData.careerGoal || localData.careerGoal,
                professionalProfile: cloudProfessionalProfile || cloudData.professionalProfile || localData.professionalProfile
            };
            console.log('Merged local and cloud data');
        }
        
        // Sync merged data to cloud
        const success = await window.syncDataToCloud(mergedData);
        
        // Also sync professional profile to backend if it exists
        if (mergedData.professionalProfile && typeof window.saveProfileToCloud === 'function') {
            try {
                await window.saveProfileToCloud(mergedData.professionalProfile);
                console.log('Professional profile synced to backend during migration');
            } catch (error) {
                console.log('Could not sync professional profile to backend during migration:', error.message);
            }
        }
        
        if (success) {
            // Update local storage with merged data
            setStorageData(STORAGE_KEYS.SAVED_JOBS, mergedData.savedJobs);
            setStorageData(STORAGE_KEYS.PROFILE_DATA, mergedData.profileData);
            if (mergedData.careerGoal) {
                setStorageData(STORAGE_KEYS.CAREER_GOAL, mergedData.careerGoal);
            }
            if (mergedData.professionalProfile) {
                saveProfessionalProfile(mergedData.professionalProfile);
            }
            
            // Refresh UI
            if (typeof loadSavedJobs === 'function') loadSavedJobs();
            if (typeof loadProfileData === 'function') loadProfileData();
            
            console.log('Migration completed successfully');
        }
        
        return success;
    } catch (error) {
        console.error('Migration error:', error);
        updateSyncStatus('error');
        return false;
    }
};

// Merge jobs from cloud and local, avoiding duplicates
function mergeJobs(cloudJobs, localJobs) {
    const merged = [...cloudJobs];
    const cloudJobIds = new Set(cloudJobs.map(job => `${job.company}-${job.title}-${job.dateAdded}`));
    
    for (const localJob of localJobs) {
        const jobId = `${localJob.company}-${localJob.title}-${localJob.dateAdded}`;
        if (!cloudJobIds.has(jobId)) {
            merged.push(localJob);
        }
    }
    
    return merged;
}

// Auto-sync on data changes - now includes professional profile
window.enableAutoSync = function() {
    if (!window.currentUser) return;
    
    console.log('Enabling auto-sync for user:', window.currentUser.email);
    
    // Override storage functions to include sync
    const originalSaveJob = window.saveJob;
    window.saveJob = function(jobData) {
        const result = originalSaveJob(jobData);
        if (result && window.currentUser) {
            // Sync after short delay to batch operations
            clearTimeout(window.syncTimeout);
            window.syncTimeout = setTimeout(() => {
                window.syncDataToCloud({
                    savedJobs: getSavedJobs(),
                    profileData: getProfileData(),
                    careerGoal: getCareerGoalData(),
                    professionalProfile: getProfessionalProfile()
                });
            }, 2000);
        }
        return result;
    };
    
    const originalSaveProfileData = window.saveProfileData;
    window.saveProfileData = function(profileData) {
        const result = originalSaveProfileData(profileData);
        if (result && window.currentUser) {
            clearTimeout(window.syncTimeout);
            window.syncTimeout = setTimeout(() => {
                window.syncDataToCloud({
                    savedJobs: getSavedJobs(),
                    profileData: getProfileData(),
                    careerGoal: getCareerGoalData(),
                    professionalProfile: getProfessionalProfile()
                });
            }, 2000);
        }
        return result;
    };
    
    // Override professional profile save to include sync
    const originalSaveProfessionalProfile = window.saveProfessionalProfile;
    window.saveProfessionalProfile = function(profileData) {
        const result = originalSaveProfessionalProfile(profileData);
        if (result && window.currentUser) {
            // Sync professional profile immediately to backend
            clearTimeout(window.professionalProfileSyncTimeout);
            window.professionalProfileSyncTimeout = setTimeout(() => {
                window.syncProfessionalProfileToCloud(profileData);
            }, 1000);
            
            // Also sync general app data
            clearTimeout(window.syncTimeout);
            window.syncTimeout = setTimeout(() => {
                window.syncDataToCloud({
                    savedJobs: getSavedJobs(),
                    profileData: getProfileData(),
                    careerGoal: getCareerGoalData(),
                    professionalProfile: profileData
                });
            }, 2000);
        }
        return result;
    };
    
    console.log('Auto-sync enabled');
};