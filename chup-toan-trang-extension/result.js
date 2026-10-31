// Trang xem trước sau khi chụp: đọc ảnh từ IndexedDB, cho sửa tên file rồi mới tải.
const $ = (id) => document.getElementById(id);

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

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function cleanFilename(name, fallback) {
  let s = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '-');
  if (!s) s = fallback;
  return s;
}

let record = null;
let objectUrl = null;
let downloaded = false;
let autosaveMode = false;

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 2600);
}

async function scanFinalName(beforeIds, filename) {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const items = await chrome.downloads.search({});
      for (const it of items) {
        if (beforeIds.has(it.id) || !it.filename) continue;
        const bn = it.filename.split(/[\\/]/).pop();
        const isMine = bn === filename || (bn.startsWith(stem + ' (') && bn.endsWith(')' + ext));
        if (!isMine) continue;
        if (it.state === 'complete') return bn;
        if (it.state === 'interrupted') return filename;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return filename;
}

async function doDownload() {
  if (!record || !objectUrl) return;
  const filename = cleanFilename($('filename').value, record.filename);
  let before = new Set();
  try { before = new Set((await chrome.downloads.search({})).map((d) => d.id)); } catch (_) {}
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  const finalName = await scanFinalName(before, filename);
  downloaded = true;
  const note = $('saved-note');
  note.textContent = `✅ Đã tải: ${finalName} — file nằm trong thư mục Downloads của máy.`
    + (finalName !== filename ? ' (Chrome tự đổi tên vì trùng file cũ trong Downloads.)' : '');
  note.hidden = false;
  if (!autosaveMode) $('btn-download').textContent = 'Tải lại';
}

async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { showError('Thiếu mã ảnh chụp.'); return; }
  try {
    record = await idbGet(id);
  } catch (e) {
    showError('Không đọc được dữ liệu ảnh: ' + e.message);
    return;
  }
  if (!record || !record.blob) { showError('Không tìm thấy ảnh chụp (có thể đã bị dọn). Hãy chụp lại.'); return; }

  objectUrl = URL.createObjectURL(record.blob);
  $('mode-chip').textContent = record.modeLabel || 'Ảnh chụp';
  $('filename').value = record.filename || 'screenshot.png';
  const meta = $('meta');
  meta.textContent = '';
  const line1 = document.createElement('span');
  line1.innerHTML = `Kích thước thật: <strong>${record.width} × ${record.height} px</strong> • Dung lượng <strong>${fmtSize(record.size)}</strong>`;
  meta.appendChild(line1);
  if (record.sourceTitle) {
    meta.appendChild(document.createElement('br'));
    const line2 = document.createElement('span');
    line2.textContent = 'Trang: ';
    const b = document.createElement('strong');
    b.textContent = record.sourceTitle;
    line2.appendChild(b);
    meta.appendChild(line2);
  }
  $('preview').src = objectUrl;
  $('content').hidden = false;

  if (params.get('autodownload') === '1') {
    setTimeout(() => doDownload(), 600);
  }
  if (params.get('autosave') === '1') {
    // Từ chế độ vẽ-trước-khi-chụp, nút Lưu...: đổi nút chính thành "Chọn nơi lưu
    // & Lưu file" — bấm vào sẽ mở hộp chọn thư mục/ổ đĩa bằng File System Access
    // (chrome.downloads saveAs với blob URL bị Chrome lưu thành tên GUID — đã
    // kiểm chứng — nên không dùng đường đó).
    autosaveMode = true;
    $('btn-download').textContent = 'Chọn nơi lưu & Lưu file';
    const hint = document.querySelector('.hint');
    if (hint) hint.textContent = 'Ảnh này chụp từ chế độ vẽ chú thích. Bấm "Chọn nơi lưu & Lưu file" để tự chọn thư mục/ổ đĩa lưu, hoặc dùng các nút khác như thường.';
  }
  if (params.get('autocopy') === '1') {
    setTimeout(autoCopy, 700);
  }
}

// Lưu bằng hộp chọn nơi lưu của hệ thống (File System Access API).
async function saveWithPicker() {
  if (!record || !record.blob) return;
  const filename = cleanFilename($('filename').value, record.filename);
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Ảnh chụp màn hình',
          accept: { [record.blob.type || 'image/png']: ['.' + (record.format === 'jpeg' ? 'jpg' : 'png')] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(record.blob);
      await writable.close();
      downloaded = true;
      const note = $('saved-note');
      note.textContent = `✅ Đã lưu: ${handle.name} — đúng nơi sếp vừa chọn.`;
      note.hidden = false;
      $('btn-download').textContent = 'Lưu lại (chọn nơi khác)';
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') { toast('Đã huỷ chọn nơi lưu.'); return; }
      // Lỗi khác (trình duyệt chặn...) -> rơi xuống tải thường về Downloads.
    }
  }
  await doDownload();
}

// Chép hộ khi trang web chặn chép trực tiếp (mở từ panel qua COPY_VIA_RESULT).
// Trang này là trang của extension — đang được focus nên chép được.
async function autoCopy() {
  let ok = false;
  try {
    let blob = record.blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(bmp, 0, 0);
      blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    ok = true;
  } catch (_) {}
  const note = $('saved-note');
  note.textContent = ok
    ? '✅ Đã chép ảnh vào clipboard — quay lại trang web, dán (Ctrl/Cmd+V) ở đâu cũng được.'
    : 'Chép tự động chưa được — sếp bấm nút "Sao chép ảnh" ở trên giúp em.';
  note.hidden = false;
  try {
    await chrome.runtime.sendMessage({
      type: 'COPY_RESULT', captureId: record.id, ok, sourceTabId: record.sourceTabId,
    });
  } catch (_) {}
}

function showError(text) {
  const e = $('error');
  e.textContent = text;
  e.hidden = false;
}

$('btn-download').addEventListener('click', () => (autosaveMode ? saveWithPicker() : doDownload()));
$('btn-open').addEventListener('click', () => { if (objectUrl) window.open(objectUrl, '_blank'); });
$('btn-copy').addEventListener('click', async () => {
  if (!record) return;
  try {
    let blob = record.blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(bmp, 0, 0);
      blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Đã sao chép ảnh — dán vào đâu cũng được (Ctrl/Cmd+V).');
  } catch (e) {
    toast('Sao chép chưa được. Sếp dùng Tải xuống nhé.');
  }
});
$('btn-back').addEventListener('click', async () => {
  if (record && record.sourceTabId) {
    try {
      const tab = await chrome.tabs.get(record.sourceTabId);
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return;
    } catch (_) {}
  }
  toast('Không tìm thấy tab gốc nữa.');
});
$('btn-close').addEventListener('click', () => window.close());

init();
