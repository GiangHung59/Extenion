// Panel sau khi chụp (v3): hiện ảnh nhỏ ở góc phải dưới trang web,
// có nút Lưu / Xem / Xoá. Chạy trong trang được chụp (tiêm qua scripting).
(function () {
  if (window.__ctpPanelLoaded) return;
  window.__ctpPanelLoaded = true;

  const HOST_ID = 'ctp-panel-host';
  const COLLAPSE_AFTER_MS = 3000;
  const SAVED_LINGER_MS = 6000;

  const CAMERA_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  const CHECK_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    .card { width: 400px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, .28); padding: 14px; box-sizing: border-box;
      animation: ctp-in .25s ease; }
    @keyframes ctp-in { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
    .top { display: flex; gap: 12px; }
    .thumb { width: 112px; height: 112px; flex: none; border-radius: 10px; border: 1px solid #e2e8f0;
      object-fit: cover; object-position: top center; background: #f1f5f9; }
    .info { flex: 1; min-width: 0; }
    .title { font-size: 15.5px; font-weight: 700; margin: 1px 0 4px; }
    .fname { font-size: 12.5px; color: #64748b; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; margin-bottom: 3px; }
    .meta { font-size: 12.5px; color: #64748b; }
    .x { position: absolute; top: 8px; right: 12px; border: none; background: none; cursor: pointer;
      font-size: 19px; color: #94a3b8; line-height: 1; padding: 2px 4px; }
    .x:hover { color: #0f172a; }
    .card { position: relative; }
    .btns { display: flex; align-items: center; gap: 9px; margin-top: 12px; }
    .btn { font-size: 13.5px; font-weight: 700; border-radius: 999px; padding: 8px 20px; cursor: pointer; }
    .btn-save { border: none; color: #fff; background: linear-gradient(90deg, #2563eb, #4f46e5); }
    .btn-save:hover { filter: brightness(1.08); }
    .btn-view { border: 1.5px solid #2563eb; color: #2563eb; background: #fff; }
    .btn-view:hover { background: #eff6ff; }
    .btn-del { border: none; background: none; color: #dc2626; padding: 8px 8px; }
    .btn-del:hover { text-decoration: underline; }
    .btn[disabled] { opacity: .55; cursor: wait; }
    .err { font-size: 12.5px; color: #b91c1c; margin-top: 9px; }
    .bar { height: 5px; border-radius: 999px; background: #e2e8f0; margin-top: 12px; overflow: hidden; }
    .bar-fill { height: 100%; background: #f59e0b; border-radius: 999px; width: 100%; }
    .saved { display: flex; gap: 12px; align-items: flex-start; }
    .check { width: 42px; height: 42px; flex: none; border-radius: 50%; background: #16a34a;
      display: flex; align-items: center; justify-content: center; }
    .head-row { display: flex; align-items: center; gap: 8px; }
    .check-small { width: 24px; height: 24px; }
    .check-small svg { width: 14px; height: 14px; }
    .saved .fname { white-space: normal; word-break: break-all; }
    .note { font-size: 12px; color: #b45309; margin-top: 3px; }
    .bubble { width: 54px; height: 54px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, #2563eb, #7c3aed); box-shadow: 0 10px 26px rgba(37, 99, 235, .45);
      display: flex; align-items: center; justify-content: center; position: relative; animation: ctp-in .25s ease; }
    .bubble:hover { filter: brightness(1.08); }
    .bubble .dot { position: absolute; top: 2px; right: 2px; width: 13px; height: 13px; border-radius: 50%;
      background: #f59e0b; border: 2px solid #fff; }
  `;

  let host = null;
  let shadow = null;
  let current = null;   // payload hiện tại
  let timer = null;     // interval đếm ngược thu nhỏ
  let lingerTimer = null;

  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1).replace('.', ',') + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2).replace('.', ',') + ' MB';
  }

  function ensureHost() {
    let el = document.getElementById(HOST_ID);
    if (el) { el.remove(); }
    el = document.createElement('div');
    el.id = HOST_ID;
    document.documentElement.appendChild(el);
    shadow = el.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
    host = el;
    return el;
  }

  function clearTimers() {
    if (timer) { clearInterval(timer); timer = null; }
    if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  }

  function removePanel() {
    clearTimers();
    if (host) { host.remove(); host = null; shadow = null; }
    current = null;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function startCountdown(fillEl, wrapEl) {
    let remain = COLLAPSE_AFTER_MS;
    let paused = false;
    wrapEl.addEventListener('mouseenter', () => { paused = true; });
    wrapEl.addEventListener('mouseleave', () => { paused = false; });
    const step = 100;
    timer = setInterval(() => {
      if (!current || (current.state !== 'ask' && current.state !== 'copied')) { clearTimers(); return; }
      if (paused) return;
      remain -= step;
      if (fillEl) fillEl.style.width = Math.max(0, (remain / COLLAPSE_AFTER_MS) * 100) + '%';
      if (remain <= 0) { clearTimers(); renderCollapsed(); }
    }, step);
  }

  function renderCollapsed() {
    if (!shadow || !current) return;
    shadow.querySelectorAll('.wrap').forEach((n) => n.remove());
    const wrap = el('div', 'wrap');
    const b = el('button', 'bubble');
    b.title = 'Ảnh vừa chụp — bấm để mở';
    b.innerHTML = CAMERA_SVG;
    b.appendChild(el('span', 'dot'));
    b.addEventListener('click', () => renderAsk());
    wrap.appendChild(b);
    shadow.appendChild(wrap);
  }

  function renderAsk() {
    if (!current) return;
    const copied = current.state === 'copied';
    ensureHost();
    const wrap = el('div', 'wrap');
    const card = el('div', 'card');

    const top = el('div', 'top');
    if (current.thumbDataUrl) {
      const img = el('img', 'thumb');
      img.src = current.thumbDataUrl;
      img.alt = 'Ảnh vừa chụp';
      img.addEventListener('click', onEdit);
      img.style.cursor = 'pointer';
      top.appendChild(img);
    }
    const info = el('div', 'info');
    if (copied) {
      const headRow = el('div', 'head-row');
      const check = el('div', 'check check-small');
      check.innerHTML = CHECK_SVG;
      headRow.appendChild(check);
      headRow.appendChild(el('div', 'title', 'Đã chép vào clipboard'));
      info.appendChild(headRow);
      const isMac = /mac/i.test(navigator.platform || '');
      info.appendChild(el('div', 'meta', `Dán ${isMac ? 'Cmd+V' : 'Ctrl+V'} vào đâu cũng được`));
    } else if (current.state === 'copying') {
      info.appendChild(el('div', 'title', 'Đang chép vào clipboard…'));
    } else {
      info.appendChild(el('div', 'title', 'Ảnh vừa chụp xong'));
    }
    const fn = el('div', 'fname', current.filename || '');
    fn.title = current.filename || '';
    info.appendChild(fn);
    const metaText = (current.width && current.height)
      ? `${Number(current.width).toLocaleString('vi-VN')} × ${Number(current.height).toLocaleString('vi-VN')} px • ${fmtSize(current.size)}`
      : fmtSize(current.size);
    info.appendChild(el('div', 'meta', metaText));
    top.appendChild(info);
    card.appendChild(top);

    const x = el('button', 'x', '×');
    x.title = 'Thu nhỏ';
    x.addEventListener('click', () => { clearTimers(); renderCollapsed(); });
    card.appendChild(x);

    const btns = el('div', 'btns');
    const btnSave = el('button', 'btn btn-save', copied ? 'Lưu file' : 'Lưu');
    const btnEdit = el('button', 'btn btn-view', 'Sửa');
    const btnDel = el('button', 'btn btn-del', 'Xoá');
    btnSave.addEventListener('click', () => onSave(btnSave, btnEdit, btnDel, card));
    btnEdit.addEventListener('click', onEdit);
    btnDel.addEventListener('click', onDelete);
    btns.appendChild(btnSave);
    btns.appendChild(btnEdit);
    btns.appendChild(btnDel);
    card.appendChild(btns);

    if (current.errorNote) {
      card.appendChild(el('div', 'err', current.errorNote));
    }

    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    bar.appendChild(fill);
    card.appendChild(bar);

    wrap.appendChild(card);
    shadow.appendChild(wrap);
    startCountdown(fill, wrap);
  }

  function renderSaved(finalName, renamed) {
    clearTimers();
    ensureHost();
    const wrap = el('div', 'wrap');
    const card = el('div', 'card');
    const row = el('div', 'saved');
    const check = el('div', 'check');
    check.innerHTML = CHECK_SVG;
    row.appendChild(check);
    const info = el('div', 'info');
    info.appendChild(el('div', 'title', 'Đã lưu vào Downloads'));
    const fn = el('div', 'fname', finalName || current.filename || '');
    fn.title = finalName || current.filename || '';
    info.appendChild(fn);
    if (renamed) {
      info.appendChild(el('div', 'note', 'Chrome tự đổi tên vì trùng file cũ trong Downloads.'));
    }
    row.appendChild(info);
    card.appendChild(row);
    const x = el('button', 'x', '×');
    x.title = 'Đóng';
    x.addEventListener('click', removePanel);
    card.appendChild(x);
    wrap.appendChild(card);
    shadow.appendChild(wrap);
    lingerTimer = setTimeout(removePanel, SAVED_LINGER_MS);
  }

  function showError(card, text) {
    let e = card.querySelector('.err');
    if (!e) {
      e = el('div', 'err');
      card.appendChild(e);
    }
    e.textContent = text;
  }

  function onSave(btnSave, btnView, btnDel, card) {
    if (!current) return;
    clearTimers();
    [btnSave, btnView, btnDel].forEach((b) => (b.disabled = true));
    btnSave.textContent = 'Đang lưu…';
    chrome.runtime.sendMessage(
      { type: 'PANEL_SAVE', captureId: current.captureId, filename: current.filename },
      (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          [btnSave, btnView, btnDel].forEach((b) => (b.disabled = false));
          btnSave.textContent = 'Lưu';
          showError(card, 'Lưu chưa được: ' + ((res && res.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'lỗi không rõ') + ' — bấm Xem để tải từ trang xem trước.');
          return;
        }
        current.state = 'saved';
        renderSaved(res.finalName, res.renamed);
      }
    );
  }

  function onEdit() {
    if (!current) return;
    chrome.runtime.sendMessage({ type: 'PANEL_EDIT', captureId: current.captureId }, () => {
      void chrome.runtime.lastError;
    });
    clearTimers();
    renderCollapsed();
  }

  function onDelete() {
    if (!current) return;
    const id = current.captureId;
    removePanel();
    chrome.runtime.sendMessage({ type: 'PANEL_DELETE', captureId: id }, () => {
      void chrome.runtime.lastError;
    });
  }

  // Chép ảnh vào clipboard ngay trong trang web.
  // Chrome chỉ cho chép khi trang đang được focus — mà lúc chụp xong popup thường
  // còn đang mở (trang mất focus) nên phải CHỜ trang nhận lại focus rồi mới chép,
  // thay vì thất bại ngay. Trang nào chặn chép thẳng (permissions policy) thì nhờ
  // trang ảnh (extension page) chép hộ qua COPY_VIA_RESULT.
  function panelCollapsed() {
    return !!(shadow && shadow.querySelector && shadow.querySelector('.bubble'));
  }

  async function fetchPngBlob(captureId) {
    const res = await chrome.runtime.sendMessage({ type: 'GET_DATAURL', captureId });
    if (!res || !res.ok || !res.dataUrl) throw new Error('no data');
    let blob = await (await fetch(res.dataUrl)).blob();
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
    return blob;
  }

  function waitForFocus(timeoutMs) {
    if (document.hasFocus()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const t0 = Date.now();
      const cleanup = () => {
        clearInterval(timer);
        window.removeEventListener('focus', onFocus);
      };
      const onFocus = () => { cleanup(); resolve(true); };
      const timer = setInterval(() => {
        if (document.hasFocus()) { cleanup(); resolve(true); }
        else if (Date.now() - t0 > timeoutMs) { cleanup(); resolve(false); }
      }, 300);
      window.addEventListener('focus', onFocus);
    });
  }

  async function copyFlow(payload) {
    current = { ...payload, state: 'copying' };
    if (!panelCollapsed()) renderAsk();
    let copied = false;
    const focused = await waitForFocus(20000);
    if (focused && current && current.captureId === payload.captureId) {
      try {
        const blob = await fetchPngBlob(payload.captureId);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copied = true;
      } catch (_) {}
    }
    if (!current || current.captureId !== payload.captureId) return;
    if (copied) {
      current = { ...payload, state: 'copied' };
      clearTimers();
      if (!panelCollapsed()) renderAsk();
      return;
    }
    chrome.runtime.sendMessage({ type: 'COPY_VIA_RESULT', captureId: payload.captureId }, () => {
      void chrome.runtime.lastError;
    });
    current = { ...payload, state: 'ask', errorNote: 'Trang này chưa cho chép thẳng — em đã mở trang ảnh để chép giúp sếp.' };
    clearTimers();
    if (!panelCollapsed()) renderAsk();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'CTP_COPY_RESULT') {
      // Trang ảnh đã chép hộ thành công -> nâng panel lên trạng thái "Đã chép".
      if (current && msg.captureId === current.captureId && msg.ok
        && (current.state === 'ask' || current.state === 'copying')) {
        const keep = { ...current };
        delete keep.errorNote;
        current = { ...keep, state: 'copied' };
        clearTimers();
        if (!panelCollapsed()) renderAsk();
      }
      return;
    }
    if (!msg || msg.type !== 'CTP_SHOW_PANEL' || !msg.payload) return;
    if (msg.payload.state === 'copy-pending') {
      copyFlow(msg.payload);
      return;
    }
    current = msg.payload;
    clearTimers();
    if (current.state === 'saved') {
      renderSaved(current.finalName || current.filename, current.renamed);
    } else {
      renderAsk();
    }
  });
})();
