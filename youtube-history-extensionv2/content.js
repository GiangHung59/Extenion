
async function updateAllThumbnails() {
  const viewsData = (await chrome.storage.local.get('ytViews')).ytViews || {};
  document.querySelectorAll('a#thumbnail').forEach((el) => {
    const url = new URL(el.href);
    const videoId = url.searchParams.get('v');
    if (!videoId || !viewsData[videoId]) return;

    let badge = el.querySelector('.view-count-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'view-count-badge';
      badge.style = `
        position: absolute; top: 4px; right: 4px;
        background: rgba(0,0,0,0.7); color: white;
        padding: 2px 4px; font-size: 10px; border-radius: 3px; z-index: 1000;`;
      el.style.position = 'relative';
      el.appendChild(badge);
    }
    badge.textContent = `👁️ ${viewsData[videoId].count}`;
  });
}

const observer = new MutationObserver(() => {
  updateAllThumbnails();
});

observer.observe(document.body, { childList: true, subtree: true });

// initial load
setTimeout(updateAllThumbnails, 2000);
