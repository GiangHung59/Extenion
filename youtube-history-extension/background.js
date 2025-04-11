chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getStorage") {
    chrome.storage.local.get(null, (data) => sendResponse(data));
    return true;
  }
  if (message.type === "setStorage") {
    chrome.storage.local.set(message.data, () => sendResponse({ success: true }));
    return true;
  }
});
