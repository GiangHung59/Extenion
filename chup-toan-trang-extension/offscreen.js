// Offscreen document v2: ghép ảnh từng đoạn, cắt vùng chọn, lưu ảnh vào IndexedDB
// để trang xem trước (result.html) đọc lại. Không tải về ngay tại đây.

function idbPut(record) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ctp-db', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('captures')) {
        req.result.createObjectStore('captures', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('captures', 'readwrite');
      tx.objectStore('captures').put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbGet(id) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ctp-db', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('captures')) {
        req.result.createObjectStore('captures', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('captures', 'readonly');
      const get = tx.objectStore('captures').get(id);
      get.onsuccess = () => { db.close(); resolve(get.result || null); };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(id) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ctp-db', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('captures', 'readwrite');
      tx.objectStore('captures').delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh chụp.'));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được file ảnh.'))),
      mime, format === 'jpeg' ? (quality || 92) / 100 : undefined);
  });
}

function makeThumb(canvas) {
  const maxW = 264;
  if (canvas.width <= maxW) {
    const t = document.createElement('canvas');
    t.width = canvas.width;
    t.height = canvas.height;
    const ctx = t.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, t.width, t.height);
    ctx.drawImage(canvas, 0, 0);
    return t.toDataURL('image/jpeg', 0.72);
  }
  const scale = maxW / canvas.width;
  const t = document.createElement('canvas');
  t.width = maxW;
  t.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = t.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, t.width, t.height);
  ctx.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.72);
}

async function saveRecord(canvas, msg) {
  const blob = await canvasToBlob(canvas, msg.format, msg.quality);
  const record = {
    ...msg.record,
    blob,
    width: canvas.width,
    height: canvas.height,
    size: blob.size,
    format: msg.format,
  };
  await idbPut(record);
  return {
    captureId: record.id, width: record.width, height: record.height,
    size: record.size, filename: record.filename, thumbDataUrl: makeThumb(canvas),
  };
}

// Tải về máy bằng thẻ <a download> ngay trong offscreen: tên file lấy từ chính
// thuộc tính download nên khớp 100% tên đã hiển thị. (Đã kiểm chứng: gọi
// chrome.downloads từ service worker với blob/data URL sẽ bị Chrome bỏ qua
// tên file và lưu thành tên lạ; offscreen lại không có downloads API.)
async function downloadRecord(msg) {
  const record = await idbGet(msg.captureId);
  if (!record || !record.blob) throw new Error('Không tìm thấy ảnh chụp.');
  const url = URL.createObjectURL(record.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = record.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { filename: record.filename };
}

// ---------- Ghép ảnh toàn trang ----------
let stitch = null;

async function stitchInit(msg) {
  stitch = {
    cfg: msg,
    canvas: null,
    ctx: null,
    crop: null,
    contentScaleY: 1,
  };
  return { ok: true };
}

async function stitchSegment(msg) {
  if (!stitch) throw new Error('Chưa khởi tạo phiên ghép ảnh.');
  const cfg = stitch.cfg;
  const img = await loadImage(msg.dataUrl);
  if (!stitch.canvas) {
    const scaleX = img.naturalWidth / cfg.innerWidth;
    const scaleY = img.naturalHeight / cfg.innerHeight;
    stitch.crop = {
      x: Math.round(cfg.rect.x * scaleX),
      y: Math.round(cfg.rect.y * scaleY),
      w: Math.round(cfg.rect.width * scaleX),
      h: Math.round(cfg.rect.height * scaleY),
    };
    stitch.contentScaleY = stitch.crop.h / cfg.viewHeight;
    const canvas = document.createElement('canvas');
    canvas.width = stitch.crop.w;
    canvas.height = Math.round(cfg.totalHeight * stitch.contentScaleY);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stitch.canvas = canvas;
    stitch.ctx = ctx;
  }
  const c = stitch.crop;
  const destY = Math.round(msg.actualY * stitch.contentScaleY);
  stitch.ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, destY, c.w, c.h);
  return { ok: true, destY };
}

async function stitchFinish(msg) {
  if (!stitch || !stitch.canvas) throw new Error('Chưa có đoạn ảnh nào để ghép.');
  const meta = await saveRecord(stitch.canvas, msg);
  stitch = null;
  return meta;
}

// ---------- Ảnh đơn (đang hiển thị / vùng chọn) ----------
async function storeImage(msg) {
  const img = await loadImage(msg.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return saveRecord(canvas, msg);
}

// Thay ảnh của một bản chụp đã lưu bằng ảnh mới (lớp vẽ trên trang gửi bản vẽ
// hoàn chỉnh lên thay cho ảnh nền đã chụp trước), giữ nguyên tên file/thông tin.
async function replaceImage(msg) {
  const old = await idbGet(msg.captureId);
  if (!old) throw new Error('Không tìm thấy bản chụp nền.');
  const img = await loadImage(msg.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (msg.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  const blob = await canvasToBlob(canvas, msg.format, msg.quality);
  const record = {
    ...old,
    blob,
    width: canvas.width,
    height: canvas.height,
    size: blob.size,
    format: msg.format,
  };
  await idbPut(record);
  return {
    captureId: record.id, width: record.width, height: record.height,
    size: record.size, filename: record.filename, thumbDataUrl: makeThumb(canvas),
  };
}

async function storeCrop(msg) {
  const img = await loadImage(msg.dataUrl);
  const scaleX = img.naturalWidth / msg.viewport.width;
  const scaleY = img.naturalHeight / msg.viewport.height;
  const sx = Math.round(msg.crop.x * scaleX);
  const sy = Math.round(msg.crop.y * scaleY);
  const sw = Math.max(1, Math.round(msg.crop.width * scaleX));
  const sh = Math.max(1, Math.round(msg.crop.height * scaleY));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return saveRecord(canvas, msg);
}

// Chép ảnh vào clipboard (định dạng PNG — định dạng dán chuẩn nhất).
async function copyClipboard(msg) {
  const record = await idbGet(msg.captureId);
  if (!record || !record.blob) throw new Error('Không tìm thấy ảnh chụp.');
  let blob = record.blob;
  if (blob.type !== 'image/png') {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0);
    blob = await canvasToBlob(c, 'png');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return { copied: true };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== 'offscreen') return;
  (async () => {
    try {
      let meta = { ok: true };
      if (msg.type === 'STITCH_INIT') meta = await stitchInit(msg);
      else if (msg.type === 'STITCH_SEGMENT') meta = await stitchSegment(msg);
      else if (msg.type === 'STITCH_FINISH') meta = await stitchFinish(msg);
      else if (msg.type === 'STITCH_ABORT') { stitch = null; }
      else if (msg.type === 'STORE_IMAGE') meta = await storeImage(msg);
      else if (msg.type === 'REPLACE_IMAGE') meta = await replaceImage(msg);
      else if (msg.type === 'STORE_CROP') meta = await storeCrop(msg);
      else if (msg.type === 'DOWNLOAD') meta = await downloadRecord(msg);
      else if (msg.type === 'DELETE_CAPTURE') { await idbDelete(msg.captureId); }
      else if (msg.type === 'COPY_CLIPBOARD') meta = await copyClipboard(msg);
      else if (msg.type === 'GET_DATAURL') {
        const record = await idbGet(msg.captureId);
        if (!record || !record.blob) throw new Error('Không tìm thấy ảnh chụp.');
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(record.blob);
        });
        meta = { dataUrl };
      }
      else return;
      chrome.runtime.sendMessage({ target: 'offscreen-result', ...meta, id: msg.id, ok: true });
    } catch (e) {
      chrome.runtime.sendMessage({
        target: 'offscreen-result', id: msg.id, ok: false,
        error: String((e && e.message) || e),
      });
    }
  })();
});
