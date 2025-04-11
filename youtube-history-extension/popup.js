document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("status");

  fileInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result);
        const viewData = {};

        for (const entry of data) {
          const url = entry.titleUrl || "";
          const time = entry.time;
          const match = url.match(/v=([a-zA-Z0-9_-]+)/);
          if (match) {
            const id = match[1];
            if (!viewData[id]) {
              viewData[id] = [];
            }
            viewData[id].push(time);
          }
        }

        chrome.storage.local.get(["viewHistory"], (result) => {
          const current = result.viewHistory || {};
          for (const id in viewData) {
            if (!current[id]) current[id] = [];
            current[id].push(...viewData[id]);
            current[id] = [...new Set(current[id])].sort();
          }
          chrome.storage.local.set({ viewHistory: current }, () => {
            status.textContent = "✅ Đã cập nhật thành công!";
          });
        });
      } catch (err) {
        status.textContent = "❌ JSON không hợp lệ!";
      }
    };
    reader.readAsText(file);
  });
});
