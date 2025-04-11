document.getElementById("upload").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const newDataRaw = JSON.parse(reader.result);
      if (!Array.isArray(newDataRaw)) throw new Error("JSON không phải là mảng.");

      const parsed = newDataRaw.filter(item => item.titleUrl && item.time).map(item => ({
        titleUrl: item.titleUrl,
        time: item.time
      }));

      const keepOld = document.getElementById("keepOld").checked;
      let history = [];
      if (keepOld) {
        const syncData = await chrome.storage.sync.get("history");
        const localData = await chrome.storage.local.get("history");
        history = syncData.history || localData.history || [];
      }

      const existingUrls = new Set(history.map(item => item.titleUrl));
      const merged = [...history, ...parsed.filter(item => !existingUrls.has(item.titleUrl))];
      const sizeInBytes = new Blob([JSON.stringify(merged)]).size;

      if (sizeInBytes < 100 * 1024) {
        await chrome.storage.sync.set({ history: merged });
        await chrome.storage.local.remove("history");
        document.getElementById("status").innerText = "Đã lưu vào cloud (sync)!";
      } else {
        await chrome.storage.local.set({ history: merged });
        await chrome.storage.sync.remove("history");
        document.getElementById("status").innerText = "Đã lưu vào bộ nhớ cục bộ!";
      }

      document.getElementById("jsonView").value = JSON.stringify(merged.slice(0, 10), null, 2);
    } catch (e) {
      document.getElementById("status").innerText = "Tệp JSON không hợp lệ: " + e.message;
    }
  };
  reader.readAsText(file);
});

document.getElementById("export").addEventListener("click", async () => {
  const { history: syncHistory } = await chrome.storage.sync.get("history");
  const { history: localHistory } = await chrome.storage.local.get("history");
  const data = syncHistory || localHistory || [];

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-youtube-history.json";
  a.click();
  URL.revokeObjectURL(url);

  document.getElementById("status").innerText = `Xuất ${data.length} mục dữ liệu hoàn tất.`;
  document.getElementById("jsonView").value = JSON.stringify(data.slice(0, 10), null, 2);
});