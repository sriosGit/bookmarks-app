// Background service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('Bookmarks App extension installed');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTabInfo') {
        // Handle tab info requests
        sendResponse({ success: true });
    }
}); 