// Storage utility functions for the Job Hunter Web App

// Storage keys
const STORAGE_KEYS = {
    SAVED_JOBS: 'savedJobs',
    PROFILE_DATA: 'profileData',
    HIRING_PHRASES: 'hiringPhrases',
    USER_ID: 'userId',
    LAST_SEARCH: 'lastSearch',
    CAREER_GOAL: 'careerGoal',
    PROFESSIONAL_PROFILE: 'professionalProfile',
    ADMIN_CACHE: 'adminProfilesCache',
    ADMIN_SETTINGS: 'adminDashboardSettings'
};

// Get data from localStorage with error handling
function getStorageData(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

// Save data to localStorage with error handling
function setStorageData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
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

    if (typeof CareerInsights !== 'undefined' && CareerInsights.refreshInsights) {
        CareerInsights.refreshInsights();
    }

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

// Career Goals Structure Definition
const CAREER_GOALS = {
    finding_new_job: {
        title: "Find a new job",
        description: "Looking for new opportunities and roles",
        features: [
            { name: "Job Search Strategy", tab: "find", action: "search_jobs" },
            { name: "Create and Track Applications", tab: "apply", action: "manage_applications" },
            { name: "Skill Analysis", tab: "insights", action: "analyze_skills" }
        ]
    },
    growing_current_role: {
        title: "Grow in my current role",
        description: "Advancing skills and responsibilities where I am",
        features: [
            { name: "Analyse Current Skills", tab: "insights", action: "skill_assessment" },
            { name: "Create Growth Plan", tab: "learning", action: "growth_planning" },
            { name: "Performance Review Prep", tab: "apply", action: "performance_prep" }
        ]
    },
    switching_careers: {
        title: "Switch careers/fields",
        description: "Transitioning to a different industry or role type",
        features: [
            { name: "Explore Opportunities", tab: "find", action: "explore_fields" },
            { name: "Skill Gap Analysis", tab: "insights", action: "gap_analysis" },
            { name: "Build Transition Skills", tab: "learning", action: "transition_planning" }
        ]
    }
};

// Get current career goal data
function getCareerGoalData() {
    return getStorageData(STORAGE_KEYS.CAREER_GOAL, null);
}

// Save career goal selection
function saveCareerGoal(goalType) {
    if (!CAREER_GOALS[goalType]) {
        console.error('Invalid career goal type:', goalType);
        return false;
    }

    const goalData = {
        type: goalType,
        selectedAt: new Date().toISOString(),
        progress: {
            completedActions: [],
            lastActivityAt: new Date().toISOString()
        }
    };

    const success = setStorageData(STORAGE_KEYS.CAREER_GOAL, goalData);

    // Track goal selection
    if (success && typeof trackAppEvent === 'function') {
        trackAppEvent('career_goal_selected', {
            goal_type: goalType,
            goal_title: CAREER_GOALS[goalType].title
        });
    }

    return success;
}

// Get current career goal type (shorthand helper)
function getCurrentCareerGoal() {
    const goalData = getCareerGoalData();
    return goalData ? goalData.type : null;
}

// Clear career goal selection
function clearCareerGoal() {
    const currentGoal = getCareerGoalData();
    const success = setStorageData(STORAGE_KEYS.CAREER_GOAL, null);

    // Track goal clearing
    if (success && currentGoal && typeof trackAppEvent === 'function') {
        trackAppEvent('career_goal_cleared', {
            previous_goal_type: currentGoal.type,
            goal_duration_days: Math.floor((Date.now() - new Date(currentGoal.selectedAt)) / (1000 * 60 * 60 * 24))
        });
    }

    return success;
}

// Update career goal progress
function updateCareerGoalProgress(actionCompleted) {
    const goalData = getCareerGoalData();
    if (!goalData) return false;

    // Add action to completed list if not already there
    if (!goalData.progress.completedActions.includes(actionCompleted)) {
        goalData.progress.completedActions.push(actionCompleted);
    }

    goalData.progress.lastActivityAt = new Date().toISOString();

    const success = setStorageData(STORAGE_KEYS.CAREER_GOAL, goalData);

    // Track progress update
    if (success && typeof trackAppEvent === 'function') {
        trackAppEvent('career_goal_progress', {
            goal_type: goalData.type,
            action_completed: actionCompleted,
            total_completed_actions: goalData.progress.completedActions.length
        });
    }

    return success;
}

// Export career goals structure for use by other modules
window.CAREER_GOALS = CAREER_GOALS;

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
        return {
            success: false,
            error: error.message
        };
    }
}

// Professional Profiling Storage Functions

// Add to STORAGE_KEYS object
STORAGE_KEYS.PROFESSIONAL_PROFILE = 'professionalProfile';

/**
 * Get professional profiling data from local storage
 * @returns {Object|null} - The stored professional profile or null if none exists
 */
function getProfessionalProfile() {
    return getStorageData(STORAGE_KEYS.PROFESSIONAL_PROFILE, null);
}

/**
 * Save professional profiling data to local storage
 * @param {Object} profileData - The professional profile data to save
 * @returns {boolean} - Success status
 */
function saveProfessionalProfile(profileData) {
    if (!profileData || typeof profileData !== 'object') {
        console.error('Invalid profile data provided to saveProfessionalProfile');
        return false;
    }

    // Add timestamp when saving
    const profileWithTimestamp = {
        ...profileData,
        savedAt: new Date().toISOString(),
        locallyStored: true
    };

    const success = setStorageData(STORAGE_KEYS.PROFESSIONAL_PROFILE, profileWithTimestamp);

    if (success && typeof trackEvent === 'function') {
        trackEvent('professional_profile_saved_locally', {
            has_personality: !!(profileData.personality_analysis),
            has_skills: !!(profileData.skills_assessment),
            has_recommendations: !!(profileData.role_recommendations)
        });
    }

    return success;
}

/**
 * Clear professional profiling data from local storage
 * @returns {boolean} - Success status
 */
function clearProfessionalProfile() {
    const existingProfile = getProfessionalProfile();
    const success = setStorageData(STORAGE_KEYS.PROFESSIONAL_PROFILE, null);

    if (success && existingProfile && typeof trackEvent === 'function') {
        trackEvent('professional_profile_cleared', {
            profile_age_days: existingProfile.savedAt ?
                Math.floor((Date.now() - new Date(existingProfile.savedAt)) / (1000 * 60 * 60 * 24)) : 0
        });
    }

    return success;
}

/**
 * Get profiling form data (for form persistence)
 * @returns {Object} - The stored form data or empty object
 */
function getProfilingFormData() {
    return getStorageData('profilingFormData', {
        nonProfessionalExperience: '',
        workApproach: '',
        problemSolvingExample: '',
        workValues: ''
    });
}

/**
 * Save profiling form data (for form persistence)
 * @param {Object} formData - The form data to save
 * @returns {boolean} - Success status
 */
function saveProfilingFormData(formData) {
    return setStorageData('profilingFormData', {
        ...formData,
        lastSaved: new Date().toISOString()
    });
}

/**
 * Clear profiling form data
 * @returns {boolean} - Success status
 */
function clearProfilingFormData() {
    return setStorageData('profilingFormData', null);
}

/**
 * Export professional profile data
 * @returns {Object|null} - The profile data for export or null if none exists
 */
function exportProfessionalProfile() {
    const profile = getProfessionalProfile();
    if (!profile) return null;

    return {
        exportType: 'professionalProfile',
        exportDate: new Date().toISOString(),
        profileData: profile,
        version: '1.0.0'
    };
}

/**
 * Import professional profile data
 * @param {Object} importData - The imported profile data
 * @returns {boolean} - Success status
 */
function importProfessionalProfile(importData) {
    try {
        if (!importData || !importData.profileData) {
            throw new Error('Invalid import data: missing profileData');
        }

        const success = saveProfessionalProfile(importData.profileData);

        if (success && typeof trackEvent === 'function') {
            trackEvent('professional_profile_imported', {
                import_date: importData.exportDate || 'unknown',
                import_version: importData.version || 'unknown'
            });
        }

        return success;
    } catch (error) {
        console.error('Error importing professional profile:', error);
        return false;
    }
}

/**
 * Cache admin profiles data locally to reduce API calls
 * @param {Object} profilesData - The profiles data from API
 * @returns {boolean} - Success status
 */
function cacheAdminProfiles(profilesData) {
    if (!profilesData || typeof profilesData !== 'object') {
        console.error('Invalid profiles data provided to cacheAdminProfiles');
        return false;
    }

    const cacheData = {
        ...profilesData,
        cachedAt: new Date().toISOString(),
        cacheVersion: '1.0.0'
    };

    const success = setStorageData(STORAGE_KEYS.ADMIN_CACHE, cacheData);

    if (success && typeof trackEvent === 'function') {
        trackEvent('admin_profiles_cached', {
            total_profiles: profilesData.profiles?.length || 0,
            cache_size_kb: Math.round(JSON.stringify(cacheData).length / 1024)
        });
    }

    return success;
}

/**
 * Get cached admin profiles data
 * @param {number} maxAgeMinutes - Maximum age of cache in minutes (default: 30)
 * @returns {Object|null} - Cached profiles data or null if expired/missing
 */
function getCachedAdminProfiles(maxAgeMinutes = 30) {
    const cacheData = getStorageData(STORAGE_KEYS.ADMIN_CACHE, null);

    if (!cacheData || !cacheData.cachedAt) {
        return null;
    }

    // Check if cache is expired
    const cacheAge = Date.now() - new Date(cacheData.cachedAt).getTime();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    if (cacheAge > maxAgeMs) {
        // Cache expired, clear it
        clearAdminProfilesCache();
        return null;
    }

    return cacheData;
}

/**
 * Clear cached admin profiles data
 * @returns {boolean} - Success status
 */
function clearAdminProfilesCache() {
    return setStorageData(STORAGE_KEYS.ADMIN_CACHE, null);
}

/**
 * Save admin dashboard settings (filters, view preferences, etc.)
 * @param {Object} settings - Dashboard settings to save
 * @returns {boolean} - Success status
 */
function saveAdminDashboardSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        console.error('Invalid settings provided to saveAdminDashboardSettings');
        return false;
    }

    const settingsData = {
        ...settings,
        savedAt: new Date().toISOString(),
        version: '1.0.0'
    };

    return setStorageData(STORAGE_KEYS.ADMIN_SETTINGS, settingsData);
}

/**
 * Get saved admin dashboard settings
 * @returns {Object} - Dashboard settings or default settings
 */
function getAdminDashboardSettings() {
    const defaultSettings = {
        viewType: 'grid',
        profilesPerPage: 12,
        defaultFilters: {
            search: '',
            personality: '',
            skillCategory: '',
            roleType: ''
        },
        autoRefreshMinutes: 30,
        exportFormat: 'json'
    };

    const savedSettings = getStorageData(STORAGE_KEYS.ADMIN_SETTINGS, defaultSettings);

    // Merge with defaults to ensure all properties exist
    return {
        ...defaultSettings,
        ...savedSettings
    };
}

/**
 * Export admin dashboard data including settings and cache
 * @returns {Object|null} - Export data or null if no admin data
 */
function exportAdminDashboardData() {
    const profilesCache = getCachedAdminProfiles(60 * 24); // 24 hours for export
    const settings = getAdminDashboardSettings();

    if (!profilesCache && !settings) {
        return null;
    }

    return {
        exportType: 'admin_dashboard_data',
        exportDate: new Date().toISOString(),
        profilesCache: profilesCache,
        settings: settings,
        version: '1.0.0'
    };
}

/**
 * Import admin dashboard data
 * @param {Object} importData - The imported admin data
 * @returns {boolean} - Success status
 */
function importAdminDashboardData(importData) {
    try {
        if (!importData || importData.exportType !== 'admin_dashboard_data') {
            throw new Error('Invalid import data: not admin dashboard data');
        }

        let success = true;

        // Import profiles cache if present
        if (importData.profilesCache) {
            success = cacheAdminProfiles(importData.profilesCache) && success;
        }

        // Import settings if present
        if (importData.settings) {
            success = saveAdminDashboardSettings(importData.settings) && success;
        }

        if (success && typeof trackEvent === 'function') {
            trackEvent('admin_dashboard_data_imported', {
                import_date: importData.exportDate || 'unknown',
                import_version: importData.version || 'unknown',
                has_cache: !!importData.profilesCache,
                has_settings: !!importData.settings
            });
        }

        return success;
    } catch (error) {
        console.error('Error importing admin dashboard data:', error);
        return false;
    }
}

/**
 * Get admin dashboard statistics from cached data
 * @returns {Object} - Dashboard statistics
 */
function getAdminDashboardStats() {
    const cachedData = getCachedAdminProfiles(60); // 1 hour cache

    if (!cachedData || !cachedData.profiles) {
        return {
            totalProfiles: 0,
            activeUsers: 0,
            uniqueSkills: 0,
            personalityTypes: 0,
            recentActivity: []
        };
    }

    const profiles = cachedData.profiles;

    // Calculate active users (profiles created in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = profiles.filter(profile =>
        new Date(profile.created_at) > thirtyDaysAgo
    ).length;

    // Calculate unique skills
    const allSkills = new Set();
    profiles.forEach(profile => {
        const skills = profile.profile_data?.skills_assessment;
        if (skills?.technical_skills) {
            Object.values(skills.technical_skills).forEach(skillArray => {
                if (Array.isArray(skillArray)) {
                    skillArray.forEach(skill => allSkills.add(skill.toLowerCase()));
                }
            });
        }
        if (skills?.soft_skills && Array.isArray(skills.soft_skills)) {
            skills.soft_skills.forEach(skill => allSkills.add(skill.toLowerCase()));
        }
    });

    // Calculate personality type distribution
    const personalityTypes = new Set();
    profiles.forEach(profile => {
        const personality = profile.profile_data?.personality_analysis?.core_traits;
        if (personality) {
            const highTraits = Object.entries(personality)
                .filter(([trait, data]) => data.level === 'High')
                .map(([trait]) => trait);
            if (highTraits.length > 0) {
                personalityTypes.add(highTraits.sort().join('-'));
            }
        }
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivity = profiles
        .filter(profile => new Date(profile.created_at) > sevenDaysAgo)
        .map(profile => ({
            date: profile.created_at,
            user: profile.user_email,
            action: 'Profile Created'
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        totalProfiles: profiles.length,
        activeUsers: activeUsers,
        uniqueSkills: allSkills.size,
        personalityTypes: personalityTypes.size,
        recentActivity: recentActivity.slice(0, 10) // Last 10 activities
    };
}

/**
 * Search profiles in cached data
 * @param {string} searchTerm - The search term
 * @param {Object} filters - Additional filters
 * @returns {Array} - Filtered profiles
 */
function searchCachedProfiles(searchTerm, filters = {}) {
    const cachedData = getCachedAdminProfiles(60);

    if (!cachedData || !cachedData.profiles) {
        return [];
    }

    let filteredProfiles = cachedData.profiles;

    // Apply search term
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filteredProfiles = filteredProfiles.filter(profile => {
            const searchableText = [
                profile.user_email,
                JSON.stringify(profile.profile_data?.skills_assessment || {}),
                JSON.stringify(profile.profile_data?.role_recommendations || []),
                JSON.stringify(profile.profile_data?.personality_analysis || {})
            ].join(' ').toLowerCase();

            return searchableText.includes(term);
        });
    }

    // Apply additional filters
    Object.entries(filters).forEach(([filterType, filterValue]) => {
        if (!filterValue) return;

        switch (filterType) {
            case 'personality':
                filteredProfiles = filteredProfiles.filter(profile => {
                    const personality = profile.profile_data?.personality_analysis?.core_traits;
                    if (!personality) return false;

                    const traitName = filterValue.replace('high-', '').replace('low-', '');
                    const expectedLevel = filterValue.startsWith('high-') ? 'High' : 'Low';
                    const trait = personality[traitName];

                    return trait && trait.level === expectedLevel;
                });
                break;

            case 'skillCategory':
                filteredProfiles = filteredProfiles.filter(profile => {
                    const skills = profile.profile_data?.skills_assessment;
                    return skills && hasSkillInCategory(skills, filterValue);
                });
                break;

            case 'roleType':
                filteredProfiles = filteredProfiles.filter(profile => {
                    const roles = profile.profile_data?.role_recommendations || [];
                    return roles.some(role =>
                        role.role_title.toLowerCase().includes(filterValue.toLowerCase())
                    );
                });
                break;
        }
    });

    return filteredProfiles;
}

/**
 * Helper function to check if skills match category (reused from admin dashboard)
 * @param {Object} skills - Skills object
 * @param {string} category - Category to check
 * @returns {boolean} - Whether skills match category
 */
function hasSkillInCategory(skills, category) {
    const categoryMap = {
        'technical': ['technical_skills', 'software_and_tools'],
        'leadership': ['soft_skills'],
        'communication': ['soft_skills'],
        'analytical': ['technical_skills', 'methodologies_and_frameworks'],
        'creative': ['soft_skills', 'industry_knowledge']
    };

    const relevantCategories = categoryMap[category] || [];

    for (const skillCategory of relevantCategories) {
        const skillData = skills[skillCategory];
        if (skillData) {
            if (Array.isArray(skillData)) {
                const hasMatch = skillData.some(skill =>
                    skill.toLowerCase().includes(category.toLowerCase())
                );
                if (hasMatch) return true;
            } else if (typeof skillData === 'object') {
                const hasMatch = Object.values(skillData).some(skillArray =>
                    Array.isArray(skillArray) && skillArray.some(skill =>
                        skill.toLowerCase().includes(category.toLowerCase())
                    )
                );
                if (hasMatch) return true;
            }
        }
    }

    return false;
}

// Admin Email Management Functions

/**
 * Get list of admin email addresses
 * @returns {Array} - Array of admin email addresses
 */
function getAdminEmails() {
    // Centralized list of admin emails - UPDATE THIS TO ADD/REMOVE ADMINS
    return [
        'osiokeitseuwa@gmail.com',
        // 'another-admin@example.com',  // Add more admin emails here
        // 'third-admin@example.com'
    ];
}

/**
 * Check if an email address has admin privileges
 * @param {string} email - Email address to check
 * @returns {boolean} - Whether the email has admin access
 */
function isAdminEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const adminEmails = getAdminEmails();
    return adminEmails.includes(email.toLowerCase().trim());
}

/**
 * Check if current user has admin access
 * @returns {boolean} - Whether current user is admin
 */
function isCurrentUserAdmin() {
    return window.currentUser &&
        window.currentUser.email &&
        isAdminEmail(window.currentUser.email);
}

/**
 * Log admin access attempt for security monitoring
 * @param {string} action - The action being attempted
 * @param {boolean} granted - Whether access was granted
 */
function logAdminAccess(action, granted) {
    const logData = {
        action: action,
        access_granted: granted,
        user_email: window.currentUser?.email || 'unknown',
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
    };

    if (typeof trackEvent === 'function') {
        trackEvent('admin_access_log', logData);
    }

    // Also log to console for immediate visibility
    if (granted) {
        console.log(`[ADMIN ACCESS] ${action} - GRANTED for ${logData.user_email}`);
    } else {
        console.warn(`[ADMIN ACCESS] ${action} - DENIED for ${logData.user_email}`);
    }
}

// Expose admin functions globally
window.getAdminEmails = getAdminEmails;
window.isAdminEmail = isAdminEmail;
window.isCurrentUserAdmin = isCurrentUserAdmin;
window.logAdminAccess = logAdminAccess;

// Expose admin storage functions globally
window.cacheAdminProfiles = cacheAdminProfiles;
window.getCachedAdminProfiles = getCachedAdminProfiles;
window.clearAdminProfilesCache = clearAdminProfilesCache;
window.saveAdminDashboardSettings = saveAdminDashboardSettings;
window.getAdminDashboardSettings = getAdminDashboardSettings;
window.exportAdminDashboardData = exportAdminDashboardData;
window.importAdminDashboardData = importAdminDashboardData;
window.getAdminDashboardStats = getAdminDashboardStats;
window.searchCachedProfiles = searchCachedProfiles;