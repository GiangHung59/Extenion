function getTitle(videoId) {
  return fetch("https://www.youtube.com/watch?v=" + videoId)
    .then(res => res.text())
    .then(html => {
      const match = html.match(/<title>(.*?)<\/title>/);
      return match ? match[1].replace(" - YouTube", "") : videoId;
    });
}

(async () => {
  const params = new URLSearchParams(location.search);
  const count = parseInt(params.get("count") || "10");
  chrome.storage.local.get("historyData", async (res) => {
    const data = res.historyData || [];
    const counter = {};
    for (const item of data) {
      const id = new URL(item.titleUrl).searchParams.get("v");
      if (!counter[id]) counter[id] = 0;
      counter[id]++;
    }
    const sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, count);
    const ul = document.getElementById("videoList");
    for (const [videoId, views] of sorted) {
      const title = await getTitle(videoId);
      const li = document.createElement("li");
      li.innerHTML = `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${title}</a> — 👁️ ${views} lượt xem`;
      ul.appendChild(li);
    }
  });
})();