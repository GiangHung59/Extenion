
document.getElementById('viewTopBtn').addEventListener('click', async () => {
  const views = (await chrome.storage.local.get('ytViews')).ytViews || {};
  const topN = parseInt(document.getElementById('topN').value) || 10;
  const sorted = Object.entries(views).sort((a, b) => b[1].count - a[1].count).slice(0, topN);

  const win = window.open('', '_blank');
  win.document.write(`<style>
    body {font-family: Arial; padding: 20px; background:#f0f0f0; color:#000; transition: background 0.3s, color 0.3s;}
    @media (prefers-color-scheme: dark) {
      body {background: #181818; color:#fff;}
      .video {background: #242424;}
    }
    .container {display: flex; flex-wrap: wrap; gap: 10px;}
    .video {flex: 1 1 calc(50% - 10px); display:flex; align-items:center; padding: 10px; background:#fff; border-radius:6px; box-shadow:0 2px 5px rgba(0,0,0,0.1);}
    .video img {width:120px; border-radius:6px; margin-right:10px;}
    .video-title {font-weight:bold; margin-bottom:5px;}
    a {text-decoration:none; color:inherit;}
  </style>`);
  win.document.write(`<h2 style="text-align:center;">Top ${topN} Video Đã Xem Nhiều Nhất</h2><div class="container"></div>`);

  sorted.forEach(async ([id, info]) => {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
    const data = await res.json();
    const title = data.title || "Video không có tiêu đề";

    win.document.querySelector('.container').innerHTML += `
      <div class="video">
        <img src="https://img.youtube.com/vi/${id}/hqdefault.jpg">
        <div>
          <a href="https://youtube.com/watch?v=${id}" target="_blank">
            <div class="video-title">${title}</div>
          </a>
          <div>👁️ ${info.count} lượt xem</div>
          <div>📅 Xem lần đầu: ${new Date(info.first).toLocaleDateString()}</div>
        </div>
      </div>
    `;
  });
});
