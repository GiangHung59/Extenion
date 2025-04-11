function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("vi-VN");
}

function injectViewInfo(info) {
  const titleEl = document.querySelector("#title") || document.querySelector("h1.title");
  if (!titleEl || titleEl.querySelector(".yt-view-history-note")) return;

  const div = document.createElement("div");
  div.className = "yt-view-history-note";
  div.style.fontSize = "14px";
  div.style.marginTop = "6px";
  div.style.textAlign = "right";
  div.style.color = "#065fd4";

  if (info.count > 0) {
    div.textContent = `👁️ ${info.count} lượt xem từ bạn, lần đầu: ${formatDate(info.firstDate)}`;
  } else {
    div.textContent = "👁️ Chưa xem video này trước đây";
  }

  titleEl.appendChild(div);
}

function checkAndDisplayViewCount() {
  const videoId = getVideoId();
  if (!videoId) return;

  chrome.storage.local.get(["viewHistory"], (result) => {
    const history = result.viewHistory || {};
    const views = history[videoId] || [];
    injectViewInfo({
      count: views.length,
      firstDate: views[0] || null
    });
  });
}

let lastVideoId = null;
setInterval(() => {
  const currentVideoId = getVideoId();
  if (currentVideoId && currentVideoId !== lastVideoId) {
    lastVideoId = currentVideoId;
    setTimeout(checkAndDisplayViewCount, 2000);
  }
}, 3000);
