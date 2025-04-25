// UI utility functions for the Job Hunter Web App

// Initialize the UI when the page loads
function initUI() {
    setupTabs();
    setupCurrentYear();
    setupExportImport();
}

// Set up tab switching functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Track tab view
            if (typeof trackEvent === 'function') {
                trackEvent('view_tab', { tab_name: tabId });
            }
        });
    });
}

// Set current year in footer
function setupCurrentYear() {
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
}

// Show welcome tour for first-time users
function showWelcomeTour() {
    // Check if the user has seen the tour
    if (getStorageData('welcomeTourSeen', false)) {
        return;
    }
    
    // Create tour overlay
    const tour = document.createElement('div');
    tour.className = 'welcome-tour';
    document.body.appendChild(tour);
    
    // Tour steps (add more as needed)
    const steps = [
        {
            target: '.tabs',
            title: 'Welcome to Job Hunter!',
            content: 'Use these tabs to navigate between different features of the app.',
            position: 'bottom'
        },
        {
            target: '#find',
            title: 'Find Jobs',
            content: 'Start by searching for jobs across multiple platforms.',
            position: 'bottom'
        },
        {
            target: '.job-entry-section',
            title: 'Save Jobs',
            content: 'Copy and paste job details here to save them for later.',
            position: 'top'
        },
        {
            target: '#profile .form-group',
            title: 'Set Up Your Profile',
            content: 'Add your CV to generate tailored applications for saved jobs.',
            position: 'top'
        }
    ];
    
    let currentStep = 0;
    
    // Show current tour step
    function showTourStep() {
        const step = steps[currentStep];
        const targetElement = document.querySelector(step.target);
        
        if (!targetElement) {
            nextStep();
            return;
        }
        
        // Create highlight effect
        const rect = targetElement.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.className = 'tour-highlight';
        highlight.style.top = `${rect.top + window.scrollY}px`;
        highlight.style.left = `${rect.left + window.scrollX}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = `tour-tooltip tour-tooltip-${step.position}`;
        
        // Position tooltip
        if (step.position === 'bottom') {
            tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
            tooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
            tooltip.style.transform = 'translateX(-50%)';
        } else if (step.position === 'top') {
            tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
            tooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
            tooltip.style.transform = 'translate(-50%, -100%)';
        }
        
        tooltip.innerHTML = `
            <div class="tour-tooltip-content">
                <h3>${step.title}</h3>
                <p>${step.content}</p>
                <div class="tour-tooltip-buttons">
                    ${currentStep > 0 ? '<button id="tour-prev" class="secondary-button">Previous</button>' : ''}
                    ${currentStep < steps.length - 1 ? 
                        '<button id="tour-next" class="primary-button">Next</button>' : 
                        '<button id="tour-finish" class="primary-button">Finish Tour</button>'
                    }
                    <button id="tour-skip" class="default-button">Skip Tour</button>
                </div>
            </div>
        `;
        
        // Add highlight and tooltip to DOM
        tour.innerHTML = '';
        tour.appendChild(highlight);
        tour.appendChild(tooltip);
        
        // Ensure the element is visible
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Set up button handlers
        const prevButton = document.getElementById('tour-prev');
        const nextButton = document.getElementById('tour-next');
        const finishButton = document.getElementById('tour-finish');
        const skipButton = document.getElementById('tour-skip');
        
        if (prevButton) {
            prevButton.addEventListener('click', prevStep);
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', nextStep);
        }
        
        if (finishButton) {
            finishButton.addEventListener('click', finishTour);
        }
        
        if (skipButton) {
            skipButton.addEventListener('click', skipTour);
        }
    }
    
    // Navigation functions
    function nextStep() {
        if (currentStep < steps.length - 1) {
            currentStep++;
            showTourStep();
        } else {
            finishTour();
        }
    }
    
    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
            showTourStep();
        }
    }
    
    function finishTour() {
        // Mark as seen
        setStorageData('welcomeTourSeen', true);
        
        // Remove tour
        tour.remove();
        
        // Track tour completion
        if (typeof trackEvent === 'function') {
            trackEvent('welcome_tour_completed');
        }
    }
    
    function skipTour() {
        // Mark as seen
        setStorageData('welcomeTourSeen', true);
        
        // Remove tour
        tour.remove();
        
        // Track tour skipped
        if (typeof trackEvent === 'function') {
            trackEvent('welcome_tour_skipped', {
                step_reached: currentStep + 1
            });
        }
    }
    
    // Start the tour
    showTourStep();
    
    // Track tour started
    if (typeof trackEvent === 'function') {
        trackEvent('welcome_tour_started');
    }
}

// Setup data export/import buttons
function setupExportImport() {
    // Add export button to profile tab
    const profileTab = document.getElementById('profile');
    
    if (profileTab) {
        const exportImportSection = document.createElement('div');
        exportImportSection.className = 'export-import-section';
        exportImportSection.innerHTML = `
            <h3>Export/Import Data</h3>
            <p class="info-text">Export your data to back it up or transfer it to another device.</p>
            <div class="export-import-buttons">
                <button id="export-data" class="secondary-button">Export Data</button>
                <input type="file" id="import-file" accept=".json" style="display:none;">
                <button id="import-data" class="secondary-button">Import Data</button>
            </div>
            <p class="warning-text">Note: Your data is stored in your browser. Clearing browser data will erase your Job Hunter data.</p>
        `;
        
        profileTab.appendChild(exportImportSection);
        
        // Set up export button
        document.getElementById('export-data').addEventListener('click', () => {
            exportData();
        });
        
        // Set up import button
        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const importSuccess = importData(e.target.result);
                    if (importSuccess) {
                        alert('Data imported successfully. The page will now reload.');
                        window.location.reload();
                    }
                };
                reader.readAsText(file);
            }
        });
    }
}

// Check storage usage and show warning if close to limit
function checkStorageUsage() {
    try {
        let totalSize = 0;
        
        // Estimate size of all localStorage items
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            totalSize += key.length + value.length;
        }
        
        // Convert to KB
        const totalKB = Math.round(totalSize / 1024);
        
        // localStorage limit varies by browser but is typically 5-10MB
        // We'll warn at 4MB (4096KB)
        if (totalKB > 4096) {
            showStorageWarning(totalKB);
        }
        
        return totalKB;
    } catch (e) {
        console.error('Error checking storage usage:', e);
        return 0;
    }
}

// Show storage warning banner
function showStorageWarning(usedKB) {
    // Don't show if already dismissed
    if (getStorageData('storageWarningDismissed', false)) {
        return;
    }
    
    const warningBanner = document.createElement('div');
    warningBanner.className = 'storage-warning';
    
    warningBanner.innerHTML = `
        <div class="storage-warning-content">
            <p><strong>Storage Warning:</strong> You're using ${usedKB}KB of browser storage (limit ~5000KB). 
            Consider exporting and backing up your data, then removing old jobs.</p>
            <div class="storage-warning-actions">
                <button id="export-storage-warning" class="secondary-button">Export Data</button>
                <button id="dismiss-storage-warning" class="default-button">Dismiss</button>
            </div>
        </div>
    `;
    
    document.body.insertBefore(warningBanner, document.body.firstChild);
    
    // Handle buttons
    document.getElementById('export-storage-warning').addEventListener('click', () => {
        exportData();
    });
    
    document.getElementById('dismiss-storage-warning').addEventListener('click', () => {
        warningBanner.remove();
        setStorageData('storageWarningDismissed', true);
    });
}

// Show a modal with message
function showModal(title, message, buttons = []) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let buttonHtml = '';
    buttons.forEach(button => {
        buttonHtml += `<button id="${button.id}" class="${button.class || 'primary-button'}">${button.text}</button>`;
    });
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2>${title}</h2>
            <p>${message}</p>
            <div class="modal-buttons">
                ${buttonHtml}
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Set up close button
    modal.querySelector('.close-modal').addEventListener('click', () => {
        closeModal(modal);
    });
    
    // Set up action buttons
    buttons.forEach(button => {
        const buttonElement = modal.querySelector(`#${button.id}`);
        buttonElement.addEventListener('click', () => {
            if (button.action) {
                button.action();
            }
            closeModal(modal);
        });
    });
    
    // Close when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
    
    return modal;
}

// Close a modal
function closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.remove();
    }, 300);
}

// Show extension promotion banner at strategic locations
function showExtensionPromo(location) {
    // Don't show if the user has dismissed all promos
    if (getStorageData('allPromoDismissed', false)) {
        return;
    }
    
    // Check if this specific promo has been dismissed
    const dismissedPromos = getStorageData('dismissedPromos', []);
    if (dismissedPromos.includes(location)) {
        return;
    }
    
    let message = '';
    let id = `extension-promo-${location}`;
    
    // Different messages for different locations
    switch(location) {
        case 'job-save':
            message = 'Want to save jobs with one click? Get our browser extension!';
            break;
        case 'job-view':
            message = 'The browser extension can automatically extract job details!';
            break;
        case 'profile':
            message = 'The browser extension keeps your data synced across sessions!';
            break;
        case 'after-search':
            message = 'The browser extension makes job searching even faster!';
            break;
        default:
            message = 'Get more features with our free browser extension!';
    }
    
    const promoDiv = document.createElement('div');
    promoDiv.className = 'extension-promo';
    promoDiv.id = id;
    
    promoDiv.innerHTML = `
        <p>${message}</p>
        <div class="promo-actions">
            <a href="https://addons.mozilla.org/en-US/firefox/addon/job-hunter-assistant/" target="_blank" class="install-button">Install Extension</a>
            <button class="dismiss-promo" data-location="${location}">&times;</button>
        </div>
    `;
    
    // Add the promo to a suitable location based on its type
    let targetElement = null;
    
    switch(location) {
        case 'job-save':
            targetElement = document.querySelector('.job-entry-section');
            break;
        case 'job-view':
            targetElement = document.querySelector('.saved-jobs-section');
            break;
        case 'profile':
            targetElement = document.querySelector('#profile .form-group');
            break;
        case 'after-search':
            targetElement = document.querySelector('#find .search-buttons');
            break;
        default:
            targetElement = document.querySelector('main');
    }
    
    if (targetElement) {
        targetElement.insertAdjacentElement('afterbegin', promoDiv);
        
        // Add dismiss handler
        promoDiv.querySelector('.dismiss-promo').addEventListener('click', (e) => {
            const location = e.target.getAttribute('data-location');
            dismissPromo(location);
            promoDiv.remove();
            
            // Track dismiss action
            if (typeof trackEvent === 'function') {
                trackEvent('dismiss_promo', { location: location });
            }
        });
        
        // Track promo shown
        if (typeof trackEvent === 'function') {
            trackEvent('show_extension_promo', { location: location });
        }
    }
    
    return promoDiv;
}

// Dismiss a specific promo
function dismissPromo(location) {
    const dismissedPromos = getStorageData('dismissedPromos', []);
    if (!dismissedPromos.includes(location)) {
        dismissedPromos.push(location);
        setStorageData('dismissedPromos', dismissedPromos);
    }
}

// Dismiss all promos
function dismissAllPromos() {
    setStorageData('allPromoDismissed', true);
    
    // Remove any existing promos
    document.querySelectorAll('.extension-promo').forEach(promo => {
        promo.remove();
    });
}

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', initUI);