// === CẬP NHẬT VIEW VIDEO CHÍNH (GÓC PHẢI, KHÔNG CHỒNG TIÊU ĐỀ) ===
async function updateMainVideoView() {
  try {
    const videoId = new URL(location.href).searchParams.get('v');
    if (!videoId || !chrome.storage?.local) {
      console.warn("Không có videoId hoặc chrome.storage.local không khả dụng");
      return;
    }

    const { ytViews } = await chrome.storage.local.get('ytViews');
    const viewsData = ytViews || {};
    const data = viewsData[videoId];
    if (!data) {
      console.warn("Không có dữ liệu lượt xem cho videoId:", videoId);
      return;
    }

    const titleBar = document.querySelector('#above-the-fold #title h1');
    if (!titleBar) {
      console.warn("Không tìm thấy titleBar với bộ chọn '#above-the-fold #title h1'");
      return;
    }

    const old = document.querySelector('#main-video-view-counter');
    if (old) old.remove();

    const viewDisplay = document.createElement('div');
    viewDisplay.id = 'main-video-view-counter';
    viewDisplay.style = `
      position: absolute;
      top: 0;
      right: 0;
      background: rgba(0, 0, 0, 0);
      color: #fff;
      padding: 4px 8px;
      font-size: 13px;
      border-radius: 3px;
      z-index: 1000;
      transform: translateX(100%);
    `;
    const firstDate = new Date(data.first).toLocaleDateString();
    viewDisplay.textContent = `👁️  ${data.count}    🕘 ${firstDate}`;

    titleBar.style.position = 'relative';
    titleBar.style.overflow = 'visible';
    titleBar.appendChild(viewDisplay);
  } catch (err) {
    console.warn("Không thể hiển thị view video chính:", err);
  }
}

// === CẬP NHẬT VIEW CÁC VIDEO LIÊN QUAN / THUMBNAIL ===
async function updateAllThumbnails() {
  const { ytViews } = await chrome.storage.local.get('ytViews');
  const viewsData = ytViews || {};
  document.querySelectorAll('a#thumbnail').forEach((el) => {
    try {
      if (!el.href || !el.href.includes('watch?v=')) return;
      const url = new URL(el.href);
      const videoId = url.searchParams.get('v');
      if (!videoId || !viewsData[videoId]) return;

      let badge = el.querySelector('.view-count-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'view-count-badge';
        badge.style = `
          position: absolute;
          bottom: 4px;
          left: 4px;
          background: rgba(0,0,0,0); color: white;
          padding: 2px 4px; font-size: 10px;
          border-radius: 3px; z-index: 1000;
        `;
        el.appendChild(badge);
      }
      badge.textContent = `👁️ ${viewsData[videoId].count}`;
    } catch (e) {
      console.warn("Lỗi cập nhật thumbnail:", e);
    }
  });
}

// === THEO DÕI KHI CHUYỂN VIDEO (KHÔNG CẦN MESSAGE) ===
const observeUrlChange = () => {
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        updateAllThumbnails();
        updateMainVideoView();
      }, 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// === TỰ CẬP NHẬT KHI VIDEO MỚI XUẤT HIỆN (CUỘN XUỐNG) ===
const observeNewThumbnails = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if ([...mutation.addedNodes].some(node =>
        node.nodeType === 1 && node.querySelector && node.querySelector('a#thumbnail'))) {
        updateAllThumbnails();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

// === TỰ CẬP NHẬT LƯỢT XEM MỚI KHI XEM VIDEO ===
const updateVideoViewCount = async () => {
  const videoId = new URL(location.href).searchParams.get('v');
  if (!videoId || !chrome.storage?.local) return;
  const { ytViews } = await chrome.storage.local.get('ytViews');
  const viewsData = ytViews || {};
  if (!viewsData[videoId]) {
    viewsData[videoId] = { count: 1, first: new Date().toISOString() };
  } else {
    viewsData[videoId].count += 1;
  }
  await chrome.storage.local.set({ ytViews: viewsData });
};

// === KHỞI ĐỘNG ===
setTimeout(() => {
  updateAllThumbnails();
  updateMainVideoView();
}, 2000);

observeUrlChange();
observeNewThumbnails();
updateVideoViewCount();