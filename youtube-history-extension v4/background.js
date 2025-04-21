
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getStorage") {
    chrome.storage.local.get(null, (data) => sendResponse(data));
    return true;
  }
  if (message.type === "setStorage") {
    chrome.storage.local.set(message.data, () => sendResponse({ success: true }));
    return true;
  }
  if (message.type === 'urlChanged') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'updateViewCounts' });
    });
  }
  if (message.type === "getBrowserTheme") {
    sendResponse({ darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches });
  }
});
