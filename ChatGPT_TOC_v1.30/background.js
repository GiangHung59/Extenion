chrome.runtime.onInstalled.addListener(function() {
  console.log('ChatGPT TOC Panel extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getSettings") {
    chrome.storage.sync.get(["chatgpt-toc-language", "chatgpt-toc-theme"], function(result) {
      sendResponse({
        language: result["chatgpt-toc-language"] || "vi",
        theme: result["chatgpt-toc-theme"] || "auto"
      });
    });
    return true; // Keep the message channel open for async response
  }
  
  // Listen for settings update and refresh TOC
  if (request.action === "settingsUpdated") {
    // Broadcast to all tabs that settings have been updated
    chrome.tabs.query({url: "https://chatgpt.com/*"}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: "refreshTOC",
          settings: request.settings
        });
      });
    });
  }
});
