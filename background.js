// Background service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('Bookmarks App extension installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // This will be handled by the popup, but we can add additional functionality here
    console.log('Extension icon clicked on tab:', tab.url);
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTabInfo') {
        // Handle tab info requests
        sendResponse({ success: true });
    }
}); 