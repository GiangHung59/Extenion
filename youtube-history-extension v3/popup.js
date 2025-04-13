document.getElementById('viewTopBtn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get('ytViews');
  const views = result.ytViews || {};
  const topN = parseInt(document.getElementById('topN').value) || 10;  // Số lượng video hiển thị
  const sorted = Object.entries(views).sort((a, b) => b[1].count - a[1].count).slice(0, topN);  // Sắp xếp theo lượt xem giảm dần

  // Tạo nội dung để hiển thị trong popup
  let htmlContent = `<h2 style="font-family:sans-serif">🔥 Top ${topN} video đã xem nhiều nhất</h2><hr>`;
  htmlContent += `<div class="video-container">`;  // Khung chứa các video

  // Trích xuất thumbnail, tiêu đề và thông tin video
  for (const [id, info] of sorted) {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;
    const videoTitle = `🎬 Video ID: ${id}`;  // Tiêu đề video (có thể thay thế bằng thông tin khác nếu cần)
    const thumbnailUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;  // Địa chỉ thumbnail video

    htmlContent += `
      <div class="video-item">
        <a href="${videoUrl}" target="_blank">
          <img src="${thumbnailUrl}" alt="${videoTitle}">
          <p>${videoTitle}</p>  <!-- Tiêu đề video -->
        </a><br>
        👁️ <b>${info.count}</b> lượt xem — 🕓 Lần đầu: ${new Date(info.first).toLocaleDateString()}
      </div>
    `;
  }

  htmlContent += `</div>`;  // Kết thúc khung video-container

  // Cập nhật nội dung của popup với danh sách video
  document.body.innerHTML = htmlContent;
});
