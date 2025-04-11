document.getElementById('jsonUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const history = await chrome.storage.local.get('ytViews') || {};
    const views = history.ytViews || {};
    for (const item of data) {
      const url = item.titleUrl;
      if (!url || !url.includes('watch?v=')) continue;
      const id = new URL(url).searchParams.get('v');
      if (!views[id]) views[id] = { count: 0, first: item.time };
      views[id].count += 1;
      if (new Date(item.time) < new Date(views[id].first)) {
        views[id].first = item.time;
      }
    }
    await chrome.storage.local.set({ ytViews: views });
    alert("Đã cập nhật xong! Tổng video: " + Object.keys(views).length);
  } catch (err) {
    alert("JSON không hợp lệ.");
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get('ytViews');
  const blob = new Blob([JSON.stringify(result.ytViews, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: "youtube_view_data.json",
    saveAs: true
  });
});

document.getElementById('viewTopBtn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get('ytViews');
  const views = result.ytViews || {};
  const topN = parseInt(document.getElementById('topN').value) || 10;
  const sorted = Object.entries(views).sort((a, b) => b[1].count - a[1].count).slice(0, topN);
  const win = window.open('', '_blank');
  win.document.write("<h2>Top " + topN + " video đã xem</h2>");
  for (const [id, info] of sorted) {
    win.document.write(`<p><a href="https://www.youtube.com/watch?v=${id}" target="_blank">👁️ ${info.count} lượt xem</a> - Lần đầu: ${new Date(info.first).toLocaleDateString()}</p>`);
  }
});
