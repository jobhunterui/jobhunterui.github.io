// cloud-sync.js - Updated to use separate collections

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
        
        await setDoc(appDataDocRef, {
            savedJobs: userData.savedJobs || [],
            profileData: userData.profileData || {},
            lastSync: serverTimestamp(),
            version: '1.0.0',
            email: window.currentUser.email
        }, { merge: true });
        
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

// Migrate local data to cloud on first sign-in
window.migrateLocalToCloud = async function() {
    if (!window.currentUser) return;
    
    console.log('Starting local to cloud migration...');
    updateSyncStatus('syncing');
    
    try {
        // Get local data
        const localData = {
            savedJobs: getSavedJobs(),
            profileData: getProfileData()
        };
        
        // Get cloud data from the correct collection
        const cloudData = await window.loadDataFromCloud();
        
        let mergedData;
        if (!cloudData || !cloudData.savedJobs || cloudData.savedJobs.length === 0) {
            // No cloud data, use local data
            mergedData = localData;
            console.log('Using local data for initial sync');
        } else {
            // Merge data - preferring cloud data but adding any local jobs not in cloud
            mergedData = {
                savedJobs: mergeJobs(cloudData.savedJobs, localData.savedJobs),
                profileData: cloudData.profileData.cv ? cloudData.profileData : localData.profileData
            };
            console.log('Merged local and cloud data');
        }
        
        // Sync merged data to cloud
        const success = await window.syncDataToCloud(mergedData);
        
        if (success) {
            // Update local storage with merged data
            setStorageData(STORAGE_KEYS.SAVED_JOBS, mergedData.savedJobs);
            setStorageData(STORAGE_KEYS.PROFILE_DATA, mergedData.profileData);
            
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

// Auto-sync on data changes
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
                    profileData: getProfileData()
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
                    profileData: getProfileData()
                });
            }, 2000);
        }
        return result;
    };
    
    console.log('Auto-sync enabled');
};