// File: insights.js
// Description: This module handles the Career Insights tab functionality, including displaying job insights, generating CVs, and managing user interactions.

// Career Insights Module
const CareerInsights = (function() {
    // Private variables
    let currentJobData = null;
    let currentCVAnalysis = null;
    
    // Initialize the module
    function init() {
        bindEvents();
        checkForCVData();
    }
    
    // Bind event listeners
    function bindEvents() {
        // Tab selection event
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', function() {
                if (this.getAttribute('data-tab') === 'insights') {
                    refreshInsights();
                }
            });
        });
        
        // Generate CV from insights tab
        const insightsGenerateBtn = document.getElementById('insights-generate-cv');
        if (insightsGenerateBtn) {
            insightsGenerateBtn.addEventListener('click', function() {
                // Go to apply tab
                document.querySelector('[data-tab="apply"]').click();
                
                // Delay slightly to allow tab to switch
                setTimeout(() => {
                    // Check if a job is selected
                    const selectedJob = document.querySelector('.job-item.selected');
                    if (!selectedJob) {
                        showModal('No Job Selected', 'Please select a job first to generate insights.');
                        return;
                    }
                    
                    // Generate CV for the selected job
                    generateCVWithGemini();
                }, 100);
            });
        }
    }
    
    // Check if CV data is available for any jobs
    function checkForCVData() {
        const savedJobs = getSavedJobs();
        let hasData = false;
        
        // Look for any job with CV analysis data
        savedJobs.forEach(job => {
            if (job.cvAnalysis) {
                hasData = true;
            }
        });
        
        // If no data found, user needs to generate insights first
        if (!hasData) {
            showWelcomeMessage();
        } else {
            // If user has generated CV before, look for a selected job
            const selectedJob = document.querySelector('.job-item.selected');
            if (selectedJob) {
                const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
                loadJobInsights(jobIndex);
            } else {
                showWelcomeMessage();
            }
        }
    }
    
    // Show welcome message when no insights are available
    function showWelcomeMessage() {
        const welcomeSection = document.getElementById('insights-welcome');
        const contentSection = document.getElementById('insights-content');
        
        if (welcomeSection && contentSection) {
            welcomeSection.style.display = 'block';
            contentSection.style.display = 'none';
        }
    }
    
    // Load insights for a specific job
    function loadJobInsights(jobIndex) {
        const savedJobs = getSavedJobs();
        const job = savedJobs[jobIndex];
        
        if (!job) {
            showWelcomeMessage();
            return;
        }
        
        currentJobData = job;
        
        // Check if this job has CV analysis data
        if (job.cvAnalysis) {
            currentCVAnalysis = job.cvAnalysis;
            displayInsights(job, job.cvAnalysis);
        } else {
            // No analysis yet, but show job header
            updateJobHeader(job);
            showEmptyInsights();
        }
    }
    
    // Update the job header in the insights tab
    function updateJobHeader(job) {
        const jobTitle = document.getElementById('insights-job-title');
        const jobCompanyLocation = document.getElementById('insights-job-company-location');
        
        if (jobTitle && jobCompanyLocation) {
            jobTitle.textContent = job.title || 'Position';
            
            const companyText = job.company || 'Company';
            const locationText = job.location ? ` • ${job.location}` : '';
            jobCompanyLocation.textContent = `${companyText}${locationText}`;
        }
        
        // Show the content section, hide welcome
        const welcomeSection = document.getElementById('insights-welcome');
        const contentSection = document.getElementById('insights-content');
        
        if (welcomeSection && contentSection) {
            welcomeSection.style.display = 'none';
            contentSection.style.display = 'block';
        }
    }
    
    // Show empty state when no analysis is available
    function showEmptyInsights() {
        // Reset skills match
        const skillsMatchValue = document.getElementById('skills-match-value');
        if (skillsMatchValue) {
            skillsMatchValue.textContent = '--';
            skillsMatchValue.parentElement.className = 'skills-match-meter';
        }
        
        // Reset skills lists
        const matchingSkillsList = document.getElementById('matching-skills-list');
        const missingSkillsList = document.getElementById('missing-skills-list');
        
        if (matchingSkillsList) {
            matchingSkillsList.innerHTML = '<li class="empty-list-message">Generate a CV for this job first</li>';
        }
        
        if (missingSkillsList) {
            missingSkillsList.innerHTML = '<li class="empty-list-message">Generate a CV for this job first</li>';
        }
        
        // Reset learning recommendations
        const learningRecommendations = document.getElementById('learning-recommendations');
        if (learningRecommendations) {
            learningRecommendations.innerHTML = '<p class="empty-recommendations">Generate a CV for this job to get personalized learning recommendations.</p>';
        }
        
        // Reset experience highlights
        const experienceHighlights = document.getElementById('experience-highlights');
        if (experienceHighlights) {
            experienceHighlights.innerHTML = '<p class="empty-highlights">Generate a CV for this job to see which of your experiences are most relevant.</p>';
        }
    }
    
    // Display insights for a job with CV analysis
    function displayInsights(job, cvAnalysis) {
        // Update job header
        updateJobHeader(job);
        
        // Update skills match meter
        updateSkillsMatch(cvAnalysis);
        
        // Update skills lists
        updateSkillsLists(cvAnalysis);
        
        // Generate and display learning recommendations
        generateLearningRecommendations(cvAnalysis);
        
        // Display experience highlights
        displayExperienceHighlights(cvAnalysis);
    }
    
    // Update the skills match meter
    function updateSkillsMatch(cvAnalysis) {
        const skillsMatchValue = document.getElementById('skills-match-value');
        if (!skillsMatchValue) return;
        
        let matchPercentage = 0;
        
        // Get match percentage from skillGapAnalysis
        if (cvAnalysis.skillGapAnalysis && typeof cvAnalysis.skillGapAnalysis.overallMatch === 'number') {
            matchPercentage = cvAnalysis.skillGapAnalysis.overallMatch;
        } else {
            // Fall back to calculating based on matching vs missing skills ratio
            const matchingSkills = cvAnalysis.skillGapAnalysis?.matchingSkills || [];
            const missingSkills = cvAnalysis.skillGapAnalysis?.missingSkills || [];
            
            if (matchingSkills.length + missingSkills.length > 0) {
                matchPercentage = Math.round(
                    (matchingSkills.length / (matchingSkills.length + missingSkills.length)) * 100
                );
            }
        }
        
        // Update the meter value
        skillsMatchValue.textContent = matchPercentage + '%';
        
        // Apply appropriate color class
        const meterElement = skillsMatchValue.parentElement;
        meterElement.className = 'skills-match-meter';
        
        if (matchPercentage < 50) {
            meterElement.classList.add('match-poor');
        } else if (matchPercentage < 70) {
            meterElement.classList.add('match-fair');
        } else if (matchPercentage < 85) {
            meterElement.classList.add('match-good');
        } else {
            meterElement.classList.add('match-excellent');
        }
    }
    
    // Update the matching and missing skills lists
    function updateSkillsLists(cvAnalysis) {
        const matchingSkillsList = document.getElementById('matching-skills-list');
        const missingSkillsList = document.getElementById('missing-skills-list');
        
        if (!matchingSkillsList || !missingSkillsList) return;
        
        // Get the skills from the CV analysis
        const matchingSkills = cvAnalysis.skillGapAnalysis?.matchingSkills || [];
        const missingSkills = cvAnalysis.skillGapAnalysis?.missingSkills || [];
        
        // Update matching skills list
        if (matchingSkills.length === 0) {
            matchingSkillsList.innerHTML = '<li class="empty-list-message">No matching skills identified</li>';
        } else {
            matchingSkillsList.innerHTML = matchingSkills
                .map(skill => `<li>${skill}</li>`)
                .join('');
        }
        
        // Update missing skills list
        if (missingSkills.length === 0) {
            missingSkillsList.innerHTML = '<li class="empty-list-message">No skill gaps identified</li>';
        } else {
            missingSkillsList.innerHTML = missingSkills
                .map(skill => `<li>${skill}</li>`)
                .join('');
        }
    }
    
    // Generate learning recommendations based on missing skills
    function generateLearningRecommendations(cvAnalysis) {
        const learningRecommendations = document.getElementById('learning-recommendations');
        if (!learningRecommendations) return;
        
        const missingSkills = cvAnalysis.skillGapAnalysis?.missingSkills || [];
        
        if (missingSkills.length === 0) {
            learningRecommendations.innerHTML = '<p class="empty-recommendations">No learning recommendations - your skills match well with this position!</p>';
            return;
        }
        
        // Generate recommendations for up to 3 missing skills
        const recommendationsToShow = missingSkills.slice(0, 3);
        let recommendationsHTML = '';
        
        recommendationsToShow.forEach(skill => {
            recommendationsHTML += `
                <div class="learning-recommendation">
                    <div class="recommendation-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            <line x1="12" y1="11" x2="12" y2="17"></line>
                            <line x1="9" y1="14" x2="15" y2="14"></line>
                        </svg>
                    </div>
                    <div class="recommendation-content">
                        <h5>Learn ${skill}</h5>
                        <p>Consider courses, tutorials, or projects to develop this skill which will improve your match for this role.</p>
                    </div>
                </div>
            `;
        });
        
        learningRecommendations.innerHTML = recommendationsHTML;
    }
    
    // Display experience highlights based on relevance scores
    function displayExperienceHighlights(cvAnalysis) {
        const experienceHighlights = document.getElementById('experience-highlights');
        if (!experienceHighlights) return;
        
        const experiences = cvAnalysis.experience || [];
        
        if (experiences.length === 0) {
            experienceHighlights.innerHTML = '<p class="empty-highlights">No experience information available.</p>';
            return;
        }
        
        // Sort experiences by relevance score (descending)
        const sortedExperiences = [...experiences].sort((a, b) => {
            return (b.relevanceScore || 0) - (a.relevanceScore || 0);
        });
        
        // Take the top 3 most relevant experiences
        const highlightsToShow = sortedExperiences.slice(0, 3);
        let highlightsHTML = '';
        
        highlightsToShow.forEach(exp => {
            // Determine relevance class
            let relevanceClass = '';
            const relevanceScore = exp.relevanceScore || 0;
            
            if (relevanceScore < 50) {
                relevanceClass = 'match-poor';
            } else if (relevanceScore < 70) {
                relevanceClass = 'match-fair';
            } else if (relevanceScore < 85) {
                relevanceClass = 'match-good';
            } else {
                relevanceClass = 'match-excellent';
            }
            
            // Create HTML for the experience highlight
            highlightsHTML += `
                <div class="experience-highlight">
                    <div class="experience-highlight-header">
                        <h5 class="experience-highlight-title">${exp.jobTitle || 'Position'}</h5>
                        <span class="experience-highlight-relevance ${relevanceClass}">${exp.relevanceScore || 0}% Relevant</span>
                    </div>
                    <div class="experience-highlight-company">${exp.company || ''} ${exp.dates ? `• ${exp.dates}` : ''}</div>
                    ${exp.achievements && exp.achievements.length > 0 ? `
                        <ul class="experience-highlight-points">
                            ${exp.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        });
        
        experienceHighlights.innerHTML = highlightsHTML;
    }
    
    // Refresh insights when tab is selected or job changes
    function refreshInsights() {
        const selectedJob = document.querySelector('.job-item.selected');
        
        if (selectedJob) {
            const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
            loadJobInsights(jobIndex);
        } else {
            showWelcomeMessage();
        }
    }
    
    // Save CV analysis data for a job
    function saveCVAnalysis(jobIndex, cvData) {
        const savedJobs = getSavedJobs();
        
        if (savedJobs[jobIndex]) {
            // Add CV analysis data to the job
            savedJobs[jobIndex].cvAnalysis = cvData;
            
            // Save updated jobs
            setStorageData(STORAGE_KEYS.SAVED_JOBS, savedJobs);
            
            // Refresh insights if insights tab is active
            const insightsTab = document.querySelector('.tab-button[data-tab="insights"]');
            if (insightsTab && insightsTab.classList.contains('active')) {
                refreshInsights();
            }
        }
    }
    
    // Public methods
    return {
        init: init,
        refreshInsights: refreshInsights,
        saveCVAnalysis: saveCVAnalysis
    };
})();

// Initialize the Career Insights module
document.addEventListener('DOMContentLoaded', function() {
    CareerInsights.init();
});

// Job selection event listener
document.addEventListener('jobSelected', function(e) {
    const jobIndex = e.detail.jobIndex;
    
    // If insights tab is active, refresh immediately
    const insightsTab = document.querySelector('.tab-button[data-tab="insights"]');
    if (insightsTab && insightsTab.classList.contains('active')) {
        CareerInsights.refreshInsights();
    }
});