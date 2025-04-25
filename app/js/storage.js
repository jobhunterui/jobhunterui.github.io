// Storage utility functions for the Job Hunter Web App

// Storage keys
const STORAGE_KEYS = {
    SAVED_JOBS: 'savedJobs',
    PROFILE_DATA: 'profileData',
    HIRING_PHRASES: 'hiringPhrases',
    USER_ID: 'userId',
    LAST_SEARCH: 'lastSearch'
};

// Get data from localStorage with error handling
function getStorageData(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error(`Error retrieving data for key ${key}:`, error);
        return defaultValue;
    }
}

// Save data to localStorage with error handling
function setStorageData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`Error saving data for key ${key}:`, error);
        
        // Check if it's a quota error
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('Storage limit reached. Please export your data to avoid loss.');
        }
        
        return false;
    }
}

// Get saved jobs
function getSavedJobs() {
    return getStorageData(STORAGE_KEYS.SAVED_JOBS, []);
}

// Save a job
function saveJob(jobData) {
    const savedJobs = getSavedJobs();
    savedJobs.push(jobData);
    return setStorageData(STORAGE_KEYS.SAVED_JOBS, savedJobs);
}

// Remove a job
function removeJob(jobIndex) {
    const savedJobs = getSavedJobs();
    if (jobIndex >= 0 && jobIndex < savedJobs.length) {
        savedJobs.splice(jobIndex, 1);
        return setStorageData(STORAGE_KEYS.SAVED_JOBS, savedJobs);
    }
    return false;
}

// Get profile data
function getProfileData() {
    return getStorageData(STORAGE_KEYS.PROFILE_DATA, { cv: '' });
}

// Save profile data
function saveProfileData(profileData) {
    return setStorageData(STORAGE_KEYS.PROFILE_DATA, profileData);
}

// Get hiring phrases
function getHiringPhrases() {
    return getStorageData(STORAGE_KEYS.HIRING_PHRASES, []);
}

// Save hiring phrases
function saveHiringPhrases(phrases) {
    return setStorageData(STORAGE_KEYS.HIRING_PHRASES, phrases);
}

// Get or create user ID for tracking
function getOrCreateUserId() {
    let userId = getStorageData(STORAGE_KEYS.USER_ID);
    
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        setStorageData(STORAGE_KEYS.USER_ID, userId);
    }
    
    return userId;
}

// Enhanced export function with better formatting and file naming
function exportData() {
    const exportData = {
        savedJobs: getSavedJobs(),
        profileData: getProfileData(),
        hiringPhrases: getHiringPhrases(),
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    // Create file name with date
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const exportFileDefaultName = `jobhunter-data-${dateStr}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Track export event
    if (typeof trackEvent === 'function') {
        trackEvent('export_data', {
            jobs_count: exportData.savedJobs.length,
            has_cv: exportData.profileData.cv ? 'yes' : 'no'
        });
    }
    
    return true;
}

// Enhanced import with validation and better feedback
function importData(jsonData) {
    try {
        const data = JSON.parse(jsonData);
        
        // Validate data structure
        if (!data.savedJobs || !Array.isArray(data.savedJobs)) {
            throw new Error('Invalid data format: savedJobs is missing or not an array');
        }
        
        // Summary of what will be imported
        const summary = {
            jobCount: data.savedJobs.length,
            hasCV: !!(data.profileData && data.profileData.cv),
            hasCustomPhrases: !!(data.hiringPhrases && data.hiringPhrases.length > 0)
        };
        
        // Import saved jobs
        setStorageData(STORAGE_KEYS.SAVED_JOBS, data.savedJobs);
        
        // Import profile data if exists
        if (data.profileData) {
            setStorageData(STORAGE_KEYS.PROFILE_DATA, data.profileData);
        }
        
        // Import hiring phrases if exists
        if (data.hiringPhrases && Array.isArray(data.hiringPhrases)) {
            setStorageData(STORAGE_KEYS.HIRING_PHRASES, data.hiringPhrases);
        }
        
        // Track import event
        if (typeof trackEvent === 'function') {
            trackEvent('import_data', {
                jobs_count: summary.jobCount,
                has_cv: summary.hasCV ? 'yes' : 'no'
            });
        }
        
        return {
            success: true,
            summary: summary
        };
    } catch (error) {
        console.error('Error importing data:', error);
        return {
            success: false,
            error: error.message
        };
    }
}