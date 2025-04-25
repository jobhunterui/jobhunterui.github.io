// Analytics and data collection for the Job Hunter Web App

// Configuration parameters
const DATA_COLLECTION = {
    // Google Apps Script endpoint - replace with your actual endpoint
    endpointUrl: 'https://script.google.com/macros/s/AKfycbyJSZQKHvaubK4UaXgQuMEBbH1eXFYedlKz6kwsKaLUuEY3xmx2xcJ82MmWXTU26VAD/exec',
    // Queue processing settings
    queue: {
        processingInterval: 1000,      // Process queue items every 1 second
        maxRetries: 5,                 // Maximum number of retries per item
        maxConcurrentRequests: 3,      // Max concurrent requests to avoid overwhelming the API
        retryDelayBase: 2000,          // Base delay before retry (will be multiplied by 2^retryCount)
        maxRetryDelay: 60000,          // Maximum retry delay (1 minute)
        persistenceInterval: 30000,    // Save queue to storage every 30 seconds
        maxQueueSize: 1000             // Maximum number of items in the queue
    },
    // Storage keys
    storage: {
        queueKey: 'dataCollectionQueue',
        activeRequestsKey: 'dataCollectionActiveRequests',
        userIdKey: 'userId'
    }
};

// Queue state
let dataQueue = [];                // Main queue of items to be sent
let activeRequests = 0;            // Number of active requests
let queueProcessor = null;         // Interval ID for queue processor
let queueInitialized = false;      // Flag to prevent multiple initializations
let lastQueuePersistence = 0;      // Last time queue was persisted to storage

// Initialize the data collection system
function initializeDataCollection() {
    if (queueInitialized) return;
    
    console.log("Initializing data collection system...");
    
    // Load queue from storage
    dataQueue = getStorageData(DATA_COLLECTION.storage.queueKey, []);
    activeRequests = getStorageData(DATA_COLLECTION.storage.activeRequestsKey, 0);
    
    // Reset active requests if it's an unreasonable value
    if (activeRequests > DATA_COLLECTION.queue.maxConcurrentRequests) {
        console.warn(`Resetting unreasonable active requests count: ${activeRequests}`);
        activeRequests = 0;
    }
    
    // Start queue processor
    startQueueProcessor();
    
    // Mark as initialized
    queueInitialized = true;
    lastQueuePersistence = Date.now();
    
    console.log("Data collection system initialized");
    
    // Set up unload handler to persist queue
    window.addEventListener('beforeunload', persistQueue);
}

// Start the queue processor
function startQueueProcessor() {
    if (queueProcessor) {
        clearInterval(queueProcessor);
    }
    
    queueProcessor = setInterval(() => {
        processQueue();
        
        // Periodically persist queue to storage
        if (Date.now() - lastQueuePersistence > DATA_COLLECTION.queue.persistenceInterval) {
            persistQueue();
        }
    }, DATA_COLLECTION.queue.processingInterval);
}

// Persist queue to storage
function persistQueue() {
    if (dataQueue.length > 0) {
        setStorageData(DATA_COLLECTION.storage.queueKey, dataQueue);
        setStorageData(DATA_COLLECTION.storage.activeRequestsKey, activeRequests);
        
        lastQueuePersistence = Date.now();
    }
}

// Add an item to the queue
function queueDataItem(dataItem) {
    // Initialize if needed
    if (!queueInitialized) {
        initializeDataCollection();
    }
    
    // Check queue size
    if (dataQueue.length >= DATA_COLLECTION.queue.maxQueueSize) {
        console.warn(`Queue size limit reached (${DATA_COLLECTION.queue.maxQueueSize}). Dropping oldest item.`);
        dataQueue.shift(); // Remove oldest item
    }
    
    // Add item to queue with metadata
    dataQueue.push({
        data: dataItem,
        status: 'pending',
        retryCount: 0,
        timestamp: Date.now(),
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
    });
    
    // If queue is getting large, persist it immediately
    if (dataQueue.length > 10) {
        persistQueue();
    }
}

// Process the queue
function processQueue() {
    // Skip if there's nothing to process
    if (dataQueue.length === 0) return;
    
    // Process as many items as we can based on concurrency limit
    while (dataQueue.length > 0 && activeRequests < DATA_COLLECTION.queue.maxConcurrentRequests) {
        // Find the next pending item
        const itemIndex = dataQueue.findIndex(item => item.status === 'pending');
        if (itemIndex === -1) break; // No pending items
        
        const queueItem = dataQueue[itemIndex];
        
        // Mark as processing and increment active requests
        queueItem.status = 'processing';
        activeRequests++;
        
        // Send the request
        sendDataRequest(queueItem, itemIndex);
    }
}

// Calculate retry delay with exponential backoff
function calculateRetryDelay(retryCount) {
    const delay = Math.min(
        DATA_COLLECTION.queue.retryDelayBase * Math.pow(2, retryCount),
        DATA_COLLECTION.queue.maxRetryDelay
    );
    
    // Add jitter to prevent all retries happening at once
    return delay + (Math.random() * 1000);
}

// Send a data request to the Google Apps Script
function sendDataRequest(queueItem, queueIndex) {
    fetch(DATA_COLLECTION.endpointUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(queueItem.data),
    })
    .then(() => {
        // Request completed successfully
        console.log(`Request completed successfully: ${queueItem.id}`);
        
        // Remove from queue
        dataQueue.splice(queueIndex, 1);
        activeRequests--;
    })
    .catch(error => {
        // Request failed
        console.error(`Request failed: ${queueItem.id}`, error);
        
        // Decrement active requests
        activeRequests--;
        
        // Handle retry logic
        if (queueItem.retryCount < DATA_COLLECTION.queue.maxRetries) {
            // Schedule retry with exponential backoff
            queueItem.retryCount++;
            queueItem.status = 'waiting';
            queueItem.nextRetry = Date.now() + calculateRetryDelay(queueItem.retryCount);
            
            // Set a timeout to mark the item as pending again after the delay
            setTimeout(() => {
                if (dataQueue.includes(queueItem)) {
                    queueItem.status = 'pending';
                }
            }, queueItem.nextRetry - Date.now());
        } else {
            // Max retries reached, mark as failed
            queueItem.status = 'failed';
        }
    });
}

// Main function to track events - use this for all data tracking
function trackEvent(eventType, eventData = {}) {
    const userId = getOrCreateUserId();
    
    // Create data object with common fields
    const data = {
        type: eventType,
        timestamp: new Date().toISOString(),
        user_id: userId,
        ...eventData
    };
    
    // Add to queue
    queueDataItem(data);
    
    return true;
}

// Create or get anonymous user ID
function getOrCreateUserId() {
    let userId = getStorageData(DATA_COLLECTION.storage.userIdKey);
    
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 15);
        setStorageData(DATA_COLLECTION.storage.userIdKey, userId);
    }
    
    return userId;
}

// Initialize tracking on page load
document.addEventListener('DOMContentLoaded', initializeDataCollection);