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
        populateJobSelector();
        handleJobSelection();
        setupLearningPlanGeneration();
        setupCumulativeLearningPlan();
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
        
        // Always populate the job selector if there are saved jobs
        populateJobSelector();
        
        // If we have any saved jobs at all, show the job selector
        if (savedJobs.length > 0) {
            // Show content section with the job selector
            const welcomeSection = document.getElementById('insights-welcome');
            const contentSection = document.getElementById('insights-content');
            
            if (welcomeSection && contentSection) {
                welcomeSection.style.display = 'none';
                contentSection.style.display = 'block';
            }
            
            // Check if any job has CV analysis data
            const hasAnalysisData = savedJobs.some(job => job.cvAnalysis);
            
            // Try to select a job if one was previously selected
            const jobSelector = document.getElementById('insights-job-select');
            if (jobSelector && jobSelector.value !== '') {
                const jobIndex = parseInt(jobSelector.value);
                loadJobInsights(jobIndex);
            } 
            // Otherwise if no job is selected but there's analysis data, select the first job with data
            else if (hasAnalysisData) {
                const jobWithAnalysisIndex = savedJobs.findIndex(job => job.cvAnalysis);
                if (jobWithAnalysisIndex >= 0) {
                    loadJobInsights(jobWithAnalysisIndex);
                    
                    // Update the selector UI to reflect this selection
                    if (jobSelector) {
                        jobSelector.value = jobWithAnalysisIndex;
                    }
                } else {
                    // This shouldn't happen (we found hasAnalysisData but no job with analysis)
                    showEmptyInsights();
                }
            } 
            // If no job is selected and no analysis data, show empty insights for first job
            else {
                if (jobSelector) {
                    jobSelector.value = "0"; // Select first job by default
                }
                updateJobHeader(savedJobs[0]);
                showEmptyInsights();
            }
        } else {
            // No saved jobs at all, show welcome message
            showWelcomeMessage();
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
    
    // Display insights and learning plan for a job with CV analysis
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
        
        // Show/hide learning plan button based on missing skills
        const learningActions = document.querySelector('.learning-actions');
        const missingSkills = cvAnalysis.skillGapAnalysis?.missingSkills || [];
        
        if (learningActions) {
            if (missingSkills.length > 0) {
                learningActions.style.display = 'block';
            } else {
                learningActions.style.display = 'none';
            }
        }
        
        // Update cumulative skills analysis
        updateCumulativeSkillsAnalysis();
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
    
    // Refresh insights and cummulative analysis when tab is selected or job changes
    function refreshInsights() {
        const selectedJob = document.querySelector('.job-item.selected');
        
        // Update job selector to match the selected job (if any)
        const jobSelector = document.getElementById('insights-job-select');
        if (jobSelector && selectedJob) {
            const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
            jobSelector.value = jobIndex;
        }
        
        populateJobSelector();
        
        if (selectedJob) {
            const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
            loadJobInsights(jobIndex);
        } else {
            showWelcomeMessage();
        }
        
        // Always update cumulative analysis, even if no job is selected
        updateCumulativeSkillsAnalysis();
        
        // Update display of cumulative section based on job data
        const cumulativeSection = document.getElementById('cumulative-section');
        const savedJobs = getSavedJobs();
        const jobsWithAnalysis = savedJobs.filter(job => job.cvAnalysis);
        
        if (cumulativeSection) {
            // Always show if we have any jobs with analysis
            if (jobsWithAnalysis.length > 0) {
                cumulativeSection.style.display = 'block';
            } else {
                cumulativeSection.style.display = 'none';
            }
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

// Populate the job selection dropdown
function populateJobSelector() {
    const jobSelector = document.getElementById('insights-job-select');
    
    if (!jobSelector) return;
    
    // Clear existing options except the first one
    while (jobSelector.options.length > 1) {
        jobSelector.remove(1);
    }
    
    // Get saved jobs
    const savedJobs = getSavedJobs();
    
    if (savedJobs.length === 0) {
        return;
    }
    
    // Add jobs to selector
    savedJobs.forEach((job, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${job.title} at ${job.company}`;
        
        // Mark jobs that have CV analysis
        if (job.cvAnalysis) {
            option.textContent += ' (Analysis available)';
        }
        
        jobSelector.appendChild(option);
    });
    
    // Check if there's a selected job
    const selectedJob = document.querySelector('.job-item.selected');
    if (selectedJob) {
        const jobIndex = parseInt(selectedJob.getAttribute('data-index'));
        jobSelector.value = jobIndex;
    }
}

// Handle job selection from dropdown
function handleJobSelection() {
    const jobSelector = document.getElementById('insights-job-select');
    
    if (!jobSelector) return;
    
    jobSelector.addEventListener('change', function() {
        const selectedIndex = this.value;
        
        if (selectedIndex === '') {
            showWelcomeMessage();
            return;
        }
        
        loadJobInsights(parseInt(selectedIndex));
    });
}

// Perplexity learning plan generation
function setupLearningPlanGeneration() {
    const createLearningPlanBtn = document.getElementById('create-learning-plan');
    
    if (!createLearningPlanBtn) return;
    
    createLearningPlanBtn.addEventListener('click', function() {
        // Get the currently selected job data from the dropdown
        const jobSelector = document.getElementById('insights-job-select');
        if (!jobSelector || jobSelector.value === '') {
            showModal('No Job Selected', 'Please select a job first to generate a learning plan.');
            return;
        }
        
        const savedJobs = getSavedJobs();
        const jobIndex = parseInt(jobSelector.value);
        const jobData = savedJobs[jobIndex];
        
        if (!jobData || !jobData.cvAnalysis) {
            showModal('No CV Analysis', 'Generate a CV for this job first to create a learning plan.');
            return;
        }
        
        generateLearningPlan(jobData, jobData.cvAnalysis);
    });
}

// Generate and open Perplexity with learning plan prompt
function generateLearningPlan(jobData, cvAnalysis) {
    if (!jobData || !cvAnalysis) return;
    
    // Get missing skills
    const missingSkills = cvAnalysis.skillGapAnalysis?.missingSkills || [];
    
    if (missingSkills.length === 0) {
        showModal('No Skills to Learn', 'No skill gaps identified for this job. Your skills already match well!');
        return;
    }
    
    // Create a well-structured prompt for Perplexity
    let prompt = `Create a personalized learning plan to develop these skills for a ${jobData.title} role: ${missingSkills.join(', ')}. 

For each skill:
1. Explain why this skill is valuable in this role
2. Suggest practical ways to learn it (online courses, books, projects)
3. Recommend specific resources including free YouTube channels, blogs, and tutorials
4. Provide a suggested learning timeline

Focus on mental models and core concepts, not just tools. Include both theoretical knowledge and practical application ideas.`;

    // Track this action
    if (typeof trackEvent === 'function') {
        trackEvent('generate_learning_plan', {
            job_title: jobData.title || '',
            company: jobData.company || '',
            missing_skills: missingSkills.join(', ')
        });
    }
    
    // Open Perplexity with the prompt
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`https://www.perplexity.ai/?q=${encodedPrompt}`, '_blank');
}

// Update the cumulative skills analysis section
function updateCumulativeSkillsAnalysis() {
    const savedJobs = getSavedJobs();
    const cumulativeAnalysisSection = document.getElementById('cumulative-skills-analysis');
    const skillsTracker = document.querySelector('.skills-tracker');
    
    if (!cumulativeAnalysisSection || !skillsTracker) return;
    
    // Collect data from all jobs with analysis
    const jobsWithAnalysis = savedJobs.filter(job => job.cvAnalysis);
    
    if (jobsWithAnalysis.length === 0) {
        skillsTracker.style.display = 'none';
        return;
    }
    
    // Show the tracker
    skillsTracker.style.display = 'grid';
    
    // Collect all skills
    const allRequiredSkills = {};
    const allMissingSkills = {};
    
    jobsWithAnalysis.forEach(job => {
        // Add required skills
        const matchingSkills = job.cvAnalysis.skillGapAnalysis?.matchingSkills || [];
        const missingSkills = job.cvAnalysis.skillGapAnalysis?.missingSkills || [];
        
        // All skills (both matching and missing) are required for the job
        [...matchingSkills, ...missingSkills].forEach(skill => {
            allRequiredSkills[skill] = (allRequiredSkills[skill] || 0) + 1;
        });
        
        // Track missing skills separately
        missingSkills.forEach(skill => {
            allMissingSkills[skill] = (allMissingSkills[skill] || 0) + 1;
        });
    });
    
    // Update most requested skills list
    const mostRequestedList = document.getElementById('most-requested-skills-list');
    
    if (mostRequestedList) {
        // Sort skills by frequency
        const sortedSkills = Object.entries(allRequiredSkills)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 skills
        
        if (sortedSkills.length > 0) {
            mostRequestedList.innerHTML = sortedSkills.map(([skill, count]) => `
                <li class="skill-item">
                    <span class="skill-name">${skill}</span>
                    <span class="skill-frequency">${count} ${count === 1 ? 'job' : 'jobs'}</span>
                </li>
            `).join('');
        } else {
            mostRequestedList.innerHTML = '<li class="empty-list-message">No skills data available</li>';
        }
    }
    
    // Update skill gaps list
    const skillGapsList = document.getElementById('skill-gap-summary-list');
    
    if (skillGapsList) {
        // Sort missing skills by frequency
        const sortedMissingSkills = Object.entries(allMissingSkills)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 missing skills
        
        if (sortedMissingSkills.length > 0) {
            skillGapsList.innerHTML = sortedMissingSkills.map(([skill, count]) => `
                <li class="skill-item">
                    <span class="skill-name">${skill}</span>
                    <span class="skill-frequency">${count} ${count === 1 ? 'job' : 'jobs'}</span>
                </li>
            `).join('');
        } else {
            skillGapsList.innerHTML = '<li class="empty-list-message">No skill gaps identified</li>';
        }
    }
}

function setupCumulativeLearningPlan() {
    const createCumulativePlanBtn = document.getElementById('create-cumulative-learning-plan');
    
    if (!createCumulativePlanBtn) return;
    
    createCumulativePlanBtn.addEventListener('click', function() {
        generateCumulativeLearningPlan();
    });
}

// Function to generate a learning plan based on all skill gaps
function generateCumulativeLearningPlan() {
    const savedJobs = getSavedJobs();
    const jobsWithAnalysis = savedJobs.filter(job => job.cvAnalysis);
    
    if (jobsWithAnalysis.length === 0) {
        showModal('No CV Analysis', 'Generate CVs for jobs first to create a learning plan.');
        return;
    }
    
    // Collect all skill gaps across jobs
    const allMissingSkills = {};
    
    jobsWithAnalysis.forEach(job => {
        const missingSkills = job.cvAnalysis.skillGapAnalysis?.missingSkills || [];
        missingSkills.forEach(skill => {
            allMissingSkills[skill] = (allMissingSkills[skill] || 0) + 1;
        });
    });
    
    // Convert to array and sort by frequency
    const sortedSkills = Object.entries(allMissingSkills)
        .sort((a, b) => b[1] - a[1])
        .map(item => item[0]);
    
    if (sortedSkills.length === 0) {
        showModal('No Skill Gaps', 'No skill gaps identified across your jobs. Your skills match well!');
        return;
    }
    
    // Create a well-structured prompt for an AI learning plan
    let prompt = `Create a comprehensive career development plan focusing on these key skills: ${sortedSkills.join(', ')}. 

My analysis shows these are the most important skills for my target career path based on multiple job postings.

For each skill:
1. Explain its importance in modern professional settings
2. Suggest practical ways to develop it (courses, projects, practice methods)
3. Recommend specific resources (books, online courses, YouTube channels, communities)
4. Provide a learning timeline from beginner to advanced

Also include:
- How these skills complement each other
- Ways to demonstrate these skills to potential employers
- Suggestions for building a portfolio highlighting these abilities

Focus on both theoretical understanding and practical application, with an emphasis on demonstrable results.`;

    // Track this action
    if (typeof trackEvent === 'function') {
        trackEvent('generate_cumulative_learning_plan', {
            skill_count: sortedSkills.length,
            top_skills: sortedSkills.slice(0, 3).join(', ')
        });
    }
    
    // Open AI tool with the prompt
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`https://www.perplexity.ai/?q=${encodedPrompt}`, '_blank');
}

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