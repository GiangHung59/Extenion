(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const getVideoId = () => {
    const url = new URL(location.href);
    return url.pathname === "/watch" ? url.searchParams.get("v") : null;
  };

  async function updateDisplay() {
    const id = getVideoId();
    if (!id) return;

    const { ytViews } = await chrome.storage.local.get("ytViews");
    const views = ytViews || {};
    const data = views[id];

    let el = document.querySelector("#personal-view-count");
    if (!el) {
      el = document.createElement("div");
      el.id = "personal-view-count";
      el.style.cssText = "margin-left:auto;padding:6px;font-size:14px;";
      const titleRow = document.querySelector("#title h1")?.parentElement;
      if (titleRow) titleRow.appendChild(el);
    }

    if (data) {
      const firstDate = new Date(data.first).toLocaleDateString();
      el.textContent = `👁️ ${data.count} lượt xem từ bạn, lần đầu: ${firstDate}`;
    } else {
      el.textContent = "👁️ Chưa xem video này trước đây";
    }
  }

  let lastId = null;
  setInterval(() => {
    const id = getVideoId();
    if (id && id !== lastId) {
      lastId = id;
      updateDisplay();
    }
  }, 1000);
})();
