document.getElementById('jsonUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const history = await chrome.storage.local.get('ytViews') || {};
    const views = history.ytViews || {};
    let countAdded = 0;
    let totalAddedViews = 0;

    if (Array.isArray(data)) {
      // Định dạng của Google Takeout
      for (const item of data) {
        const url = item.titleUrl;
        if (!url || !url.includes('watch?v=')) continue;
        const id = new URL(url).searchParams.get('v');
        if (!views[id]) {
          views[id] = { count: 0, first: item.time };
          countAdded++;
        }
        views[id].count += 1;
        totalAddedViews += 1;
        if (new Date(item.time) < new Date(views[id].first)) {
          views[id].first = item.time;
        }
      }
    } else {
      // Dữ liệu do tiện ích xuất ra
      for (const [id, info] of Object.entries(data)) {
        if (!views[id]) {
          views[id] = info;
          countAdded++;
          totalAddedViews += info.count || 1;
        }
      }
    }

    await chrome.storage.local.set({ ytViews: views });
    alert(`✅ Đã cập nhật xong!\n- Tổng video mới thêm: ${countAdded}\n- Tổng lượt xem thêm: ${totalAddedViews}`);
  } catch (err) {
    alert("❌ JSON không hợp lệ. Vui lòng kiểm tra lại file!");
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
  win.document.write(`<h2 style="font-family:sans-serif">🔥 Top ${topN} video đã xem nhiều nhất</h2><hr>`);
  for (const [id, info] of sorted) {
    win.document.write(`
      <p style="font-family:sans-serif">
        <a href="https://www.youtube.com/watch?v=${id}" target="_blank">🎬 https://youtu.be/${id}</a><br>
        👁️ <b>${info.count}</b> lượt xem — 🕓 Lần đầu: ${new Date(info.first).toLocaleDateString()}
      </p><hr>
    `);
  }
  win.document.close();
});

document.getElementById('statsBtn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get('ytViews');
  const views = result.ytViews || {};
  const totalVideos = Object.keys(views).length;
  const totalViews = Object.values(views).reduce((acc, cur) => acc + cur.count, 0);
  alert(`📊 Thống kê chi tiết:\n- Tổng video đã xem: ${totalVideos}\n- Tổng lượt xem: ${totalViews}`);
});
