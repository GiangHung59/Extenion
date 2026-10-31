const $ = (id) => document.getElementById(id);
const statusEl = $('status');

// Hiện số phiên bản ở chân popup để dễ đối chiếu bản đang chạy.
(() => {
  const foot = document.querySelector('footer');
  if (foot) foot.textContent += ` · v${chrome.runtime.getManifest().version}`;
})();

const state = {
  format: 'png',
  delay: 0,
  quality: 92,
  smart: true,
  preScroll: true,
  afterCapture: 'ask',
  nameParts: { prefix: true, title: false, mode: false, datetime: true },
  prefix: 'screenshot',
  tab: null,
};

function showStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (isError ? ' error' : '');
  statusEl.hidden = false;
}

function getSettings() {
  return {
    format: state.format,
    quality: state.quality,
    delay: state.delay,
    smart: $('opt-smart').checked,
    preScroll: $('opt-prescroll').checked,
    annotateFirst: $('opt-annotate').checked,
    afterCapture: state.afterCapture,
    nameParts: {
      prefix: $('np-prefix').checked,
      title: $('np-title').checked,
      mode: $('np-mode').checked,
      datetime: $('np-datetime').checked,
    },
    prefix: ($('opt-prefix').value || 'screenshot').trim() || 'screenshot',
  };
}

async function saveSettings() {
  await chrome.storage.local.set({ settings: getSettings() });
}

function bindSegmented(id, key, parse) {
  const el = $(id);
  el.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state[key] = parse(btn.dataset.value);
      saveSettings();
    });
  });
}

function setSegmented(id, value) {
  $(id).querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === String(value));
  });
}

async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings) {
    if (settings.format) { state.format = settings.format; setSegmented('seg-format', settings.format); }
    if (settings.delay !== undefined) { state.delay = settings.delay; setSegmented('seg-delay', settings.delay); }
    if (settings.smart !== undefined) $('opt-smart').checked = !!settings.smart;
    if (settings.preScroll !== undefined) $('opt-prescroll').checked = !!settings.preScroll;
    if (settings.annotateFirst !== undefined) $('opt-annotate').checked = !!settings.annotateFirst;
    if (settings.afterCapture) { state.afterCapture = settings.afterCapture; setSegmented('seg-after', settings.afterCapture); }
    if (settings.nameParts) {
      state.nameParts = { ...state.nameParts, ...settings.nameParts };
      $('np-prefix').checked = state.nameParts.prefix !== false;
      $('np-title').checked = !!state.nameParts.title;
      $('np-mode').checked = !!state.nameParts.mode;
      $('np-datetime').checked = state.nameParts.datetime !== false;
    }
    if (settings.prefix) $('opt-prefix').value = settings.prefix;
  }
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  if (!tab) return;
  let label = tab.url || '';
  try {
    const u = new URL(tab.url);
    label = u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch (_) {}
  $('tab-url').textContent = label || tab.title || 'Tab hiện tại';
  if (!/^https?:|^file:/.test(tab.url || '')) {
    $('tab-dot').classList.add('warn');
    const st = $('tab-status');
    st.textContent = 'Trang hệ thống';
    st.classList.add('warn');
  }
}

function setModesDisabled(disabled) {
  document.querySelectorAll('.mode').forEach((b) => (b.disabled = disabled));
}

async function startCapture(mode) {
  const tab = state.tab;
  if (!tab || !tab.id) { showStatus('Không tìm thấy tab đang mở.', true); return; }
  if (!/^https?:|^file:/.test(tab.url || '')) {
    showStatus('Trang này là trang hệ thống của trình duyệt nên không chụp được. Hãy mở một trang web bình thường rồi chụp.', true);
    return;
  }
  await saveSettings();
  const settings = getSettings();
  setModesDisabled(true);

  if (mode === 'region') {
    showStatus('Hãy kéo chuột trên trang để khoanh vùng cần chụp. Bấm Esc để huỷ.');
    chrome.runtime.sendMessage(
      { type: 'CAPTURE', mode, settings, tabId: tab.id, windowId: tab.windowId },
      () => setTimeout(() => window.close(), 350)
    );
    return;
  }

  chrome.runtime.sendMessage(
    { type: 'CAPTURE', mode, settings, tabId: tab.id, windowId: tab.windowId },
    (res) => {
      setModesDisabled(false);
      if (chrome.runtime.lastError) {
        showStatus('Có lỗi: ' + chrome.runtime.lastError.message, true);
      } else if (res && res.annotate) {
        showStatus('Hãy vẽ chú thích ngay trên trang, xong bấm Lưu hoặc Sao chép ở thanh dưới.');
        setTimeout(() => window.close(), 500);
      } else if (res && res.region) {
        showStatus('Kéo chuột để khoanh vùng ngay trên trang, sửa tại chỗ rồi bấm nút lưu (hình đĩa mềm) hoặc sao chép ở góc vùng chọn.');
        setTimeout(() => window.close(), 500);
      } else if (res && res.ok) {
        if (res.cancelled) showStatus('Đã huỷ chụp.');
        else if (state.afterCapture === 'always') showStatus('✅ Đã chụp xong và lưu luôn vào Downloads.');
        else if (state.afterCapture === 'clipboard') {
          showStatus('✅ Đã chụp xong — đang chép vào clipboard, xem panel ở góc phải dưới trang web.');
          setTimeout(() => window.close(), 900); // đóng popup sớm để trang web nhận lại focus mà chép
        }
        else showStatus('✅ Đã chụp xong — nhìn góc phải dưới trang web, bấm Lưu, Sửa hoặc Xoá.');
      } else {
        showStatus('Chụp chưa được: ' + ((res && res.error) || 'lỗi không rõ'), true);
      }
    }
  );
}

// ---------- Tiến trình ----------
function renderProgress(p) {
  if (!p) return;
  if (p.state === 'running') {
    $('main-view').hidden = true;
    $('progress-view').hidden = false;
    statusEl.hidden = true;
    $('prog-title').textContent = p.message || 'Đang chụp…';
    if (p.total > 0) {
      $('prog-seg').hidden = false;
      $('prog-seg').textContent = `Đoạn ${p.current} / ${p.total}`;
      $('prog-fill').style.width = Math.round((p.current / p.total) * 100) + '%';
      $('prog-meta').textContent = p.totalPx
        ? `Đã ghép ${(p.donePx || 0).toLocaleString('vi-VN')} / ${p.totalPx.toLocaleString('vi-VN')} px`
        : 'Đang chuẩn bị…';
    } else {
      $('prog-seg').hidden = true;
      $('prog-fill').style.width = '8%';
      $('prog-meta').textContent = p.message || 'Đang chuẩn bị…';
    }
  } else {
    $('progress-view').hidden = true;
    $('main-view').hidden = false;
    if (p.state === 'error' && p.message) showStatus('Chụp chưa được: ' + p.message, true);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.captureProgress) {
    renderProgress(changes.captureProgress.newValue);
  }
});

$('btn-full').addEventListener('click', () => startCapture('full'));
$('btn-visible').addEventListener('click', () => startCapture('visible'));
$('btn-region').addEventListener('click', () => startCapture('region'));
$('btn-shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }, () => window.close());
});
$('btn-close').addEventListener('click', () => window.close());
$('btn-cancel').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CANCEL_CAPTURE' });
});
['opt-smart', 'opt-prescroll', 'opt-annotate', 'opt-prefix', 'np-prefix', 'np-title', 'np-mode', 'np-datetime'].forEach((id) => {
  $(id).addEventListener('change', saveSettings);
});

bindSegmented('seg-format', 'format', (v) => v);
bindSegmented('seg-delay', 'delay', (v) => parseInt(v, 10));
bindSegmented('seg-after', 'afterCapture', (v) => v);

// Tự nhận diện Mac / Windows + hiện PHÍM THẬT đang đặt trong trình duyệt.
function formatShortcut(sc) {
  return sc.replace(/Command/g, 'Cmd').replace(/MacCtrl/g, 'Ctrl');
}

async function applyShortcuts() {
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const isMac = /mac/i.test(plat);
  $('os-label').textContent = isMac ? 'macOS' : 'Windows';
  // Giá trị dự phòng theo hệ điều hành (khi chưa đọc được phím thật).
  $('chip-full').textContent = isMac ? 'Cmd+Shift+Y' : 'Ctrl+Shift+Y';
  $('chip-visible').textContent = isMac ? 'Cmd+Shift+X' : 'Ctrl+Shift+X';
  $('chip-region').textContent = isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E';
  try {
    const commands = await chrome.commands.getAll();
    const map = {};
    for (const c of commands) map[c.name] = c.shortcut;
    const set = (id, name) => {
      const el = $(id);
      if (!el) return;
      el.textContent = map[name] ? formatShortcut(map[name]) : 'Chưa đặt';
      el.title = map[name] ? 'Phím tắt hiện tại' : 'Chưa đặt phím — bấm "Đổi phím tắt" để đặt';
    };
    set('chip-full', 'capture-full-page');
    set('chip-visible', 'capture-visible');
    set('chip-region', 'capture-region');
  } catch (_) {}
}

(async () => {
  applyShortcuts();
  await loadSettings();
  await loadTab();
  const { captureProgress } = await chrome.storage.local.get('captureProgress');
  if (captureProgress && Date.now() - (captureProgress.ts || 0) < 10 * 60 * 1000) {
    renderProgress(captureProgress);
  }
})();
