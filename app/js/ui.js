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

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', initUI);