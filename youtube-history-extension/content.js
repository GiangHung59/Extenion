(async () => {
  const videoId = new URLSearchParams(window.location.search).get("v");
  if (!videoId) return;

  const fullUrl = "https://www.youtube.com/watch?v=" + videoId;
  const syncData = await chrome.storage.sync.get("history");
  const localData = await chrome.storage.local.get("history");
  const history = syncData.history || localData.history || [];

  const matches = history.filter(item => item.titleUrl === fullUrl);
  if (!matches.length) return;

  const viewCount = matches.length;
  const firstDate = new Date(matches[matches.length - 1].time);
  const formattedDate = `${firstDate.getDate()} thg ${firstDate.getMonth() + 1}, ${firstDate.getFullYear()}`;

  const info = `${viewCount} lượt xem cá nhân từ ${formattedDate}`;

  const descBox = document.querySelector("#description") || document.querySelector("ytd-watch-metadata");
  if (descBox) {
    const span = document.createElement("div");
    span.textContent = info;
    span.style.fontWeight = "bold";
    span.style.marginTop = "10px";
    span.style.color = "#228B22";
    descBox.appendChild(span);
  }
})();