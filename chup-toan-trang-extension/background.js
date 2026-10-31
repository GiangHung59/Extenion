// Chụp Toàn Trang v2 — background service worker
// Chụp toàn trang kiểu CUỘN TỪNG ĐOẠN RỒI GHÉP (không dùng captureBeyondViewport nữa
// vì cách đó lặp khung hình trên các trang cuộn trong khung như YouTube).
const DEFAULT_SETTINGS = {
  format: 'png',
  quality: 92,
  delay: 0,
  smart: true,      // tự nhận diện khung cuộn thật + ẩn thanh dính khi ghép
  preScroll: true,  // cuộn tải ảnh lười trước khi chụp
  afterCapture: 'ask', // 'ask' = hiện panel góc phải dưới hỏi Lưu/Xoá; 'always' = lưu luôn vào máy
  nameParts: { prefix: true, title: false, mode: false, datetime: true }, // thành phần của tên file
  prefix: 'screenshot',
  annotateFirst: false, // true = hiện lớp vẽ chú thích ngay trên trang trước, rồi mới chụp khung đang xem
};

const MODE_SLUG = { full: 'toan-trang', visible: 'dang-hien-thi', region: 'vung-chon' };
const MODE_LABEL = { full: 'Toàn bộ trang', visible: 'Phần đang hiển thị', region: 'Vùng chọn' };

const offscreenResolvers = new Map();
let offscreenCreating = null;
let lastCaptureAt = 0;
let captureRunning = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getSettings(overrides) {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}), ...(overrides || {}) };
}

// ---------- Tên file ----------
function slugify(text, fallback, maxLen) {
  let s = String(text || '')
    .replace(/Đ/g, 'D').replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen || 50);
  return s || fallback;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function makeFilename(tab, mode, settings) {
  const ext = settings.format === 'jpeg' ? 'jpg' : 'png';
  const parts = settings.nameParts || {};
  const segs = [];
  if (parts.prefix !== false) segs.push(slugify(settings.prefix, 'screenshot', 40));
  if (parts.title) segs.push(slugify(tab && tab.title, 'trang-web', 50));
  if (parts.mode) segs.push(MODE_SLUG[mode]);
  if (parts.datetime !== false) segs.push(timestamp());
  if (!segs.length) segs.push('screenshot', timestamp());
  return segs.join('-') + '.' + ext;
}

function makeRecord(tab, mode, settings) {
  return {
    id: 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    filename: makeFilename(tab, mode, settings),
    mode,
    modeLabel: MODE_LABEL[mode],
    sourceTitle: (tab && tab.title) || '',
    sourceUrl: (tab && tab.url) || '',
    sourceTabId: tab && tab.id,
    createdAt: Date.now(),
  };
}

// ---------- Tiến trình (popup đọc từ storage) ----------
async function setProgress(p) {
  await chrome.storage.local.set({ captureProgress: { ts: Date.now(), ...p } });
}
async function isCancelled() {
  const { captureCancel } = await chrome.storage.local.get('captureCancel');
  return !!captureCancel;
}

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
    if (text) setTimeout(() => chrome.action.setBadgeText({ text: '' }).catch(() => {}), 5000);
  } catch (_) {}
}

// ---------- Offscreen ----------
async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (exists) return;
  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS', 'CLIPBOARD'],
      justification: 'Ghép các đoạn ảnh chụp thành ảnh toàn trang, cắt vùng chọn, lưu ảnh để xem trước và chép ảnh vào clipboard.',
    }).finally(() => { offscreenCreating = null; });
  }
  await offscreenCreating;
}

function offscreenJob(payload) {
  return new Promise(async (resolve, reject) => {
    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    offscreenResolvers.set(id, { resolve, reject });
    try {
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ target: 'offscreen', id, ...payload });
    } catch (e) {
      offscreenResolvers.delete(id);
      reject(e);
    }
    setTimeout(() => {
      if (offscreenResolvers.has(id)) {
        offscreenResolvers.delete(id);
        reject(new Error('Xử lý ảnh quá lâu (timeout).'));
      }
    }, 60000);
  });
}

// ---------- Capture agent trong trang ----------
async function agentCall(tabId, action, arg) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (act, a) => window.__ctp[act](a),
    args: [action, arg === undefined ? null : arg],
  });
  return results && results[0] ? results[0].result : undefined;
}

async function captureVisiblePaced(windowId, settings) {
  const gap = 620 - (Date.now() - lastCaptureAt);
  if (gap > 0) await sleep(gap);
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: settings.format === 'jpeg' ? 'jpeg' : 'png',
    quality: settings.format === 'jpeg' ? settings.quality : undefined,
  });
  lastCaptureAt = Date.now();
  return dataUrl;
}

// ---------- Chụp toàn trang: cuộn từng đoạn + ghép ----------
async function captureFull(tab, settings) {
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['capture-agent.js'] });

  if (settings.preScroll) {
    try { await agentCall(tab.id, 'preScroll'); } catch (_) {}
  }
  const m = await agentCall(tab.id, 'getMetrics');
  if (!m || !m.totalHeight) throw new Error('Không đọc được kích thước trang.');

  const estPx = m.totalHeight * (m.dpr || 1);
  if (estPx > 16000) {
    throw new Error(`Trang quá dài (ước tính ${Math.round(estPx)} px, giới hạn 16.000 px). Sếp thu nhỏ trang bằng Ctrl/Cmd + "-" rồi chụp lại.`);
  }

  const totalSeg = Math.max(1, Math.ceil(m.totalHeight / m.viewHeight));
  if (totalSeg > 60) throw new Error('Trang quá dài (hơn 60 đoạn chụp).');

  const record = makeRecord(tab, 'full', settings);
  await offscreenJob({
    type: 'STITCH_INIT',
    totalHeight: m.totalHeight,
    viewHeight: m.viewHeight,
    rect: m.rect,
    innerWidth: m.innerWidth,
    innerHeight: m.innerHeight,
  });

  await agentCall(tab.id, 'prepare');
  try {
    for (let i = 0; i < totalSeg; i++) {
      if (await isCancelled()) throw new Error('__CANCELLED__');
      const y = Math.min(i * m.viewHeight, Math.max(0, m.totalHeight - m.viewHeight));
      const actualY = await agentCall(tab.id, 'scrollToPos', y);
      await sleep(320);
      const dataUrl = await captureVisiblePaced(tab.windowId, { ...settings, format: 'png' });
      await offscreenJob({ type: 'STITCH_SEGMENT', dataUrl, actualY: actualY != null ? actualY : y });
      if (i === 0 && settings.smart) {
        try { await agentCall(tab.id, 'hideFixed'); } catch (_) {}
      }
      await setProgress({
        state: 'running', mode: 'full',
        current: i + 1, total: totalSeg,
        donePx: Math.min(m.totalHeight, y + m.viewHeight), totalPx: m.totalHeight,
        message: 'Đang chụp toàn trang…',
      });
    }
  } finally {
    try { await agentCall(tab.id, 'restore'); } catch (_) {}
  }

  const meta = await offscreenJob({
    type: 'STITCH_FINISH', format: settings.format, quality: settings.quality, record,
  });
  return meta;
}

async function captureVisible(tab, settings) {
  const dataUrl = await captureVisiblePaced(tab.windowId, settings);
  const record = makeRecord(tab, 'visible', settings);
  return offscreenJob({ type: 'STORE_IMAGE', dataUrl, format: settings.format, quality: settings.quality, record });
}

function baseName(p) {
  return String(p || '').split(/[\\/]/).pop();
}

// Tải ảnh về máy: offscreen bấm thẻ <a download> (tên file khớp 100%), SW theo dõi
// danh sách downloads để biết tên file THẬT trên đĩa (kể cả khi Chrome thêm " (1)").
async function downloadCapture(captureId, expectedName) {
  const before = new Set((await chrome.downloads.search({})).map((i) => i.id));
  const prep = await offscreenJob({ type: 'DOWNLOAD', captureId });
  const filename = prep.filename || expectedName;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const items = await chrome.downloads.search({});
    for (const it of items) {
      if (before.has(it.id) || !it.filename) continue;
      const bn = baseName(it.filename);
      const isMine = bn === filename || (bn.startsWith(stem + ' (') && bn.endsWith(')' + ext));
      if (!isMine) continue;
      if (it.state === 'complete') return { finalName: bn, renamed: bn !== filename };
      if (it.state === 'interrupted') throw new Error('Tải xuống bị gián đoạn.');
    }
    await sleep(300);
  }
  throw new Error('Không thấy file tải về — có thể trình duyệt đã chặn tải tự động.');
}

async function showPanel(tabId, payload) {
  if (!tabId) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['panel.js'] });
    await chrome.tabs.sendMessage(tabId, { type: 'CTP_SHOW_PANEL', payload });
    return true;
  } catch (_) {
    return false;
  }
}

function panelPayload(meta, state, extra) {
  return {
    state,
    captureId: meta.captureId || meta.id,
    filename: meta.filename,
    thumbDataUrl: meta.thumbDataUrl || '',
    width: meta.width,
    height: meta.height,
    size: meta.size,
    ...(extra || {}),
  };
}

async function deliver(meta, settings, tab) {
  const tabId = tab && tab.id;
  if (settings.afterCapture === 'clipboard') {
    // Chép clipboard do panel trong trang web tự làm (trang đang focus mới chép được —
    // offscreen document không có focus nên Chrome chặn). Panel chép xong tự báo trạng thái.
    const shown = await showPanel(tabId, panelPayload(meta, 'copy-pending'));
    if (shown) return;
    const url = chrome.runtime.getURL(`result.html?id=${meta.captureId || meta.id}`);
    await chrome.tabs.create({ url });
    return;
  }
  if (settings.afterCapture === 'always') {
    try {
      const { finalName, renamed } = await downloadCapture(meta.captureId || meta.id, meta.filename);
      await showPanel(tabId, panelPayload(meta, 'saved', { finalName, renamed }));
      return;
    } catch (e) {
      // Tải thẳng không được thì mở trang xem trước ở chế độ tự tải, để không mất ảnh.
      const url = chrome.runtime.getURL(`result.html?id=${meta.captureId || meta.id}&autodownload=1`);
      await chrome.tabs.create({ url });
      return;
    }
  }
  const shown = await showPanel(tabId, panelPayload(meta, 'ask'));
  if (!shown) {
    const url = chrome.runtime.getURL(`result.html?id=${meta.captureId || meta.id}`);
    await chrome.tabs.create({ url });
  }
}

// ---------- Điều phối ----------
async function startCapture(tab, mode, settingsOverrides) {
  const settings = await getSettings(settingsOverrides);
  if (!tab || !tab.id) throw new Error('Không tìm thấy tab đang mở.');

  // Chụp VÙNG CHỌN kiểu Lightshot: chụp khung đang xem TRƯỚC làm nền đóng băng,
  // mở khung chọn vùng + sửa ngay trên trang (region.js). Luôn đi luồng này,
  // không phụ thuộc công tắc "vẽ trước" (trước đây region bị gate annotate nuốt
  // nên chọn vùng lại ra ảnh toàn khung — lỗi sếp báo 31/10).
  if (mode === 'region') {
    const raw = await captureVisiblePaced(tab.windowId, { ...settings, format: 'png' });
    const record = makeRecord(tab, 'region', settings);
    const baseMeta = await offscreenJob({
      type: 'STORE_IMAGE', dataUrl: raw, format: 'png', quality: settings.quality, record,
    });
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['region.js'] });
      await chrome.tabs.sendMessage(tab.id, {
        type: 'CTP_REGION_START', captureId: baseMeta.captureId || baseMeta.id, imageDataUrl: raw,
      });
    } catch (e) {
      try { await offscreenJob({ type: 'DELETE_CAPTURE', captureId: baseMeta.captureId || baseMeta.id }); } catch (_) {}
      throw new Error('Không mở được khung chọn vùng trên trang này (trang hệ thống của trình duyệt?).');
    }
    return { started: true, region: true };
  }

  // Chế độ "Vẽ chú thích trước khi chụp": chụp khung đang xem TRƯỚC, lấy ảnh đó
  // làm nền đóng băng rồi mở lớp vẽ lên trên — vẽ WYSIWYG đúng như trình sửa
  // (làm mờ pixelate thật hiện ngay). Vẽ xong, ảnh nền được thay bằng bản đã vẽ.
  // CHỈ áp dụng cho chụp "phần đang hiển thị": trước đây gate này nuốt cả lệnh
  // "chụp toàn bộ trang" (đang bật vẽ-trước thì bấm toàn trang chỉ ra khung đang
  // xem — sếp báo lỗi 31/10). Toàn trang cứ chụp đủ trang, sửa sau bằng nút Sửa.
  if (settings.annotateFirst && mode === 'visible') {
    let baseMeta = null;
    try {
      const raw = await captureVisiblePaced(tab.windowId, { ...settings, format: 'png' });
      const record = makeRecord(tab, 'visible', settings);
      record.modeLabel = 'Vẽ & chụp';
      baseMeta = await offscreenJob({
        type: 'STORE_IMAGE', dataUrl: raw, format: 'png', quality: settings.quality, record,
      });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['annotate.js'] });
      await chrome.tabs.sendMessage(tab.id, {
        type: 'CTP_ANNOTATE_START', mode, captureId: baseMeta.captureId || baseMeta.id,
        imageDataUrl: raw, // gửi kèm ảnh nền luôn cho lớp vẽ nạp ngay, khỏi vòng qua kho lưu
      });
      return { started: true, annotate: true };
    } catch (_) {
      // Không chụp/chèn được lớp vẽ (trang hệ thống...) — dọn bản nền nếu đã lưu
      // rồi chụp thường như cũ.
      if (baseMeta) {
        try { await offscreenJob({ type: 'DELETE_CAPTURE', captureId: baseMeta.captureId || baseMeta.id }); } catch (_) {}
      }
    }
  }

  if (captureRunning) throw new Error('Đang có một lượt chụp khác chạy. Sếp chờ xong hoặc bấm Huỷ.');

  captureRunning = true;
  await chrome.storage.local.set({ captureCancel: false });
  try {
    if (settings.delay > 0) {
      await setProgress({ state: 'running', mode, current: 0, total: 0, message: `Sẽ chụp sau ${settings.delay} giây…` });
      await sleep(settings.delay * 1000);
      if (await isCancelled()) throw new Error('__CANCELLED__');
    }
    await setProgress({ state: 'running', mode, current: 0, total: 0, message: 'Đang chuẩn bị…' });

    let meta;
    if (mode === 'full') meta = await captureFull(tab, settings);
    else meta = await captureVisible(tab, settings);

    await setProgress({ state: 'done', mode, message: 'Chụp xong!' });
    await setBadge('✓', '#16a34a');
    await deliver(meta, settings, tab);
    return meta;
  } catch (e) {
    if (String(e && e.message) === '__CANCELLED__') {
      try { await offscreenJob({ type: 'STITCH_ABORT' }); } catch (_) {}
      await setProgress({ state: 'idle', message: 'Đã huỷ chụp.' });
      return { cancelled: true };
    }
    await setProgress({ state: 'error', mode, message: String((e && e.message) || e) });
    await setBadge('!', '#dc2626');
    throw e;
  } finally {
    captureRunning = false;
  }
}

// ---------- Menu chuột phải + phím tắt ----------
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'ctp-root', title: '📸 Chụp Toàn Trang', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'ctp-full', parentId: 'ctp-root', title: 'Toàn bộ trang (cuộn & ghép)', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'ctp-visible', parentId: 'ctp-root', title: 'Phần đang hiển thị', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'ctp-region', parentId: 'ctp-root', title: 'Chọn vùng chụp…', contexts: ['page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = { 'ctp-full': 'full', 'ctp-visible': 'visible', 'ctp-region': 'region' }[info.menuItemId];
  if (!mode || !tab) return;
  try { await startCapture(tab, mode); } catch (_) {}
});

chrome.commands.onCommand.addListener(async (command) => {
  const mode = command === 'capture-full-page' ? 'full'
    : command === 'capture-visible' ? 'visible'
    : command === 'capture-region' ? 'region' : null;
  if (!mode) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try { await startCapture(tab, mode); } catch (_) {}
});

// ---------- Tin nhắn ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.target === 'offscreen-result') {
    const job = offscreenResolvers.get(msg.id);
    if (job) {
      offscreenResolvers.delete(msg.id);
      if (msg.ok) job.resolve(msg);
      else job.reject(new Error(msg.error || 'Xử lý ảnh thất bại.'));
    }
    return false;
  }
  if (msg && msg.target === 'offscreen') return false;

  if (msg && msg.type === 'CAPTURE') {
    (async () => {
      try {
        const tab = await chrome.tabs.get(msg.tabId);
        const result = await startCapture(tab, msg.mode, msg.settings);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }

  if (msg && msg.type === 'CANCEL_CAPTURE') {
    chrome.storage.local.set({ captureCancel: true });
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.type === 'PANEL_SAVE') {
    (async () => {
      try {
        const r = await downloadCapture(msg.captureId, msg.filename);
        sendResponse({ ok: true, ...r });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }

  if (msg && msg.type === 'PANEL_DELETE') {
    (async () => {
      try {
        await offscreenJob({ type: 'DELETE_CAPTURE', captureId: msg.captureId });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }

  if (msg && msg.type === 'PANEL_VIEW') {
    const url = chrome.runtime.getURL(`result.html?id=${msg.captureId}`);
    chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  if (msg && msg.type === 'ANNOTATE_CAPTURE') {
    (async () => {
      try {
        const tab = sender.tab;
        if (!tab || !tab.id) throw new Error('Không xác định được tab.');
        const settings = await getSettings();
        // Thay ảnh nền đã lưu bằng bản vẽ hoàn chỉnh từ lớp vẽ.
        const meta = await offscreenJob({
          type: 'REPLACE_IMAGE', captureId: msg.captureId, dataUrl: msg.finalDataUrl,
          format: settings.format, quality: settings.quality,
        });
        await setBadge('✓', '#16a34a');
        if (msg.action === 'save') {
          // Mở trang ảnh ở chế độ chọn nơi lưu (nút "Chọn nơi lưu & Lưu file").
          const url = chrome.runtime.getURL(`result.html?id=${meta.captureId || meta.id}&autosave=1`);
          await chrome.tabs.create({ url });
        } else {
          await deliver(meta, { ...settings, afterCapture: 'clipboard' }, tab);
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }

  if (msg && msg.type === 'ANNOTATE_CANCEL') {
    // Người dùng huỷ lớp vẽ -> xoá bản chụp nền, không để lại gì.
    offscreenJob({ type: 'DELETE_CAPTURE', captureId: msg.captureId }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  if (msg && msg.type === 'ANNOTATE_FAILED') {
    // Lớp vẽ không nạp được ảnh nền -> xoá bản nền, chụp thường thay thế.
    (async () => {
      try {
        if (msg.captureId) {
          await offscreenJob({ type: 'DELETE_CAPTURE', captureId: msg.captureId });
        }
        if (sender.tab) await startCapture(sender.tab, 'visible', { annotateFirst: false });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (msg && msg.type === 'COPY_VIA_RESULT') {
    // Trang web chặn chép clipboard trực tiếp -> mở trang ảnh (extension page,
    // không bị trang web chặn) để nó chép hộ.
    const url = chrome.runtime.getURL(`result.html?id=${msg.captureId}&autocopy=1`);
    chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  if (msg && msg.type === 'COPY_RESULT') {
    if (msg.sourceTabId) {
      chrome.tabs.sendMessage(msg.sourceTabId, {
        type: 'CTP_COPY_RESULT', captureId: msg.captureId, ok: !!msg.ok,
      }).catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.type === 'GET_DATAURL') {
    offscreenJob({ type: 'GET_DATAURL', captureId: msg.captureId }).then(
      (res) => sendResponse({ ok: true, dataUrl: res && res.dataUrl }),
      (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
    );
    return true;
  }

  if (msg && msg.type === 'PANEL_EDIT') {
    const url = chrome.runtime.getURL(`edit.html?id=${msg.captureId}`);
    chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false })
    );
    return true;
  }

  return false;
});
