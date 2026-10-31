// Lớp vẽ chú thích (chế độ "Vẽ chú thích trước khi chụp") — theo đúng cách của
// trình sửa bản đầu: extension chụp khung đang xem TRƯỚC, lấy ảnh đó làm nền
// đóng băng phủ toàn khung, người dùng vẽ trực tiếp lên ảnh (WYSIWYG — làm mờ
// pixelate thật hiện ngay). Bấm Lưu (chọn nơi lưu) hoặc Sao chép (clipboard)
// thì ảnh nền được thay bằng bản đã vẽ hoàn chỉnh.
(() => {
  if (window.__ctpAnnotateLoaded) return;
  window.__ctpAnnotateLoaded = true;

  const HOST_ID = 'ctp-annotate-host';

  const CSS = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; z-index: 2147483000; font-family: "Segoe UI", system-ui, sans-serif; }
    canvas.stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
    canvas.stage.draw { cursor: crosshair; }
    canvas.stage.text { cursor: text; }
    .toolbar {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
      box-shadow: 0 12px 32px rgba(15,23,42,.25);
      display: flex; align-items: center; gap: 5px; padding: 7px 10px; max-width: 96vw; flex-wrap: wrap; justify-content: center;
    }
    .tool { width: 38px; height: 38px; border-radius: 10px; border: 1.5px solid transparent; background: transparent;
      color: #1e293b; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
    .tool svg { width: 20px; height: 20px; }
    .tool:hover { background: #f1f5f9; }
    .tool.active { background: #2563eb; color: #fff; }
    .sep { width: 1.5px; height: 26px; background: #e2e8f0; margin: 0 4px; }
    .swatch { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #cbd5e1; cursor: pointer; padding: 0; }
    .swatch.active { outline: 2.5px solid #2563eb; outline-offset: 2px; }
    .size { width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid transparent; background: transparent;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .size.active { border-color: #2563eb; background: #eff6ff; }
    .dot { border-radius: 50%; background: #0f172a; display: block; }
    .actions {
      position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.97); border: 1px solid #e2e8f0; border-radius: 999px;
      box-shadow: 0 12px 32px rgba(15,23,42,.28); padding: 8px 10px;
    }
    .hint { font-size: 12.5px; color: #64748b; padding: 0 6px 0 10px; white-space: nowrap; }
    .loading { position: absolute; top: 78px; left: 50%; transform: translateX(-50%); z-index: 5;
      background: rgba(15,23,42,.9); color: #fff; font-size: 14px; font-weight: 600;
      padding: 10px 18px; border-radius: 999px; box-shadow: 0 8px 24px rgba(15,23,42,.35); }
    .act { font: inherit; font-size: 14px; font-weight: 700; border-radius: 999px; padding: 10px 14px; cursor: pointer; border: 1.5px solid transparent; display: inline-flex; align-items: center; justify-content: center; }
    .act svg { width: 21px; height: 21px; display: block; }
    .act-save { background: #16a34a; color: #fff; }
    .act-save:hover { background: #15803d; }
    .act-copy { background: #2563eb; color: #fff; }
    .act-copy:hover { background: #1d4ed8; }
    .act-cancel { background: #fff; color: #dc2626; border-color: #fecaca; }
    .act-cancel:hover { background: #fef2f2; }
    .act:disabled { opacity: .55; cursor: wait; }
    #text-editor {
      position: absolute; z-index: 5; min-width: 60px;
      background: rgba(255,255,255,.94); border: 1.5px dashed #2563eb; border-radius: 4px;
      font-weight: 700; line-height: 1.2; padding: 2px 4px; resize: none; overflow: hidden;
      outline: none; font-family: inherit;
    }
  `;

  const ICONS = {
    select: '<svg viewBox="0 0 24 24"><path d="M6 3l13 9-7 1.5L9 20z" fill="currentColor"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/></svg>',
    marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19l1.5-4.5L15 6l3 3-8.5 8.5z"/><path d="M3 21h18"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19L19 5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L20 4"/><path d="M11 4h9v9"/></svg>',
    rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
    ellipse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>',
    text: '<svg viewBox="0 0 24 24"><text x="12" y="18" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">A</text></svg>',
    blur: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="5" height="5"/><rect x="14" y="4" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/><rect x="4" y="14" width="5" height="5"/><rect x="14" y="14" width="5" height="5"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v4h7V3"/><rect x="8" y="13" width="8" height="8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>',
  };
  const TOOLS = [
    ['pen', 'Bút vẽ'], ['marker', 'Đánh dấu (tô nhấn)'], ['line', 'Đường thẳng'],
    ['arrow', 'Mũi tên'], ['rect', 'Khung chữ nhật'], ['ellipse', 'Khung tròn'],
    ['text', 'Gõ chữ'], ['blur', 'Làm mờ / che kín'],
  ];
  const COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#0f172a', '#ffffff'];

  let host = null;
  let shadow = null;
  let canvas = null;
  let ctx = null;
  let annotations = [];
  let undoStack = [];
  let draft = null;
  let tool = 'arrow';
  let color = '#dc2626';
  let sizeIdx = 1;
  let pendingTextPos = null;
  let textEditor = null;
  let finished = false;
  let activeIdx = -1;     // đường thẳng/mũi tên đang hiện 3 chấm kéo cong
  let handleDrag = null;
  let baseImg = null;     // ảnh chụp khung đang xem — làm nền đóng băng để vẽ WYSIWYG
  let baseCaptureId = null;
  let baseReady = false;
  let loadingChip = null; // nhãn "Đang nạp ảnh chụp…" — chặn vẽ cho tới khi nền sẵn sàng

  // ----- Hình học đường cong (Bézier bậc 2) -----
  function ctrlOf(a) {
    return a.cx !== undefined
      ? { cx: a.cx, cy: a.cy }
      : { cx: (a.x0 + a.x) / 2, cy: (a.y0 + a.y) / 2 };
  }
  function quadPoint(a, t) {
    const { cx, cy } = ctrlOf(a);
    const mt = 1 - t;
    return {
      x: mt * mt * a.x0 + 2 * mt * t * cx + t * t * a.x,
      y: mt * mt * a.y0 + 2 * mt * t * cy + t * t * a.y,
    };
  }
  function strokeCurve(c, a, trimTo) {
    const { cx, cy } = ctrlOf(a);
    let end = { x: a.x, y: a.y };
    let cEnd = { cx, cy };
    if (trimTo) {
      let bestT = 1;
      let bestD = Infinity;
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const p = quadPoint(a, t);
        const d = (p.x - trimTo.x) ** 2 + (p.y - trimTo.y) ** 2;
        if (d < bestD) { bestD = d; bestT = t; }
      }
      end = quadPoint(a, bestT);
      cEnd = { cx: a.x0 + (cx - a.x0) * bestT, cy: a.y0 + (cy - a.y0) * bestT };
    }
    c.beginPath();
    c.moveTo(a.x0, a.y0);
    c.quadraticCurveTo(cEnd.cx, cEnd.cy, end.x, end.y);
    c.stroke();
  }
  function drawHandles(c, a) {
    const { cx, cy } = ctrlOf(a);
    const r = Math.max(7 * (window.devicePixelRatio || 1), a.lw * 1.6);
    c.save();
    c.strokeStyle = 'rgba(37, 99, 235, 0.55)';
    c.lineWidth = Math.max(1.5, a.lw * 0.3);
    c.setLineDash([6, 5]);
    c.beginPath();
    c.moveTo(a.x0, a.y0);
    c.lineTo(cx, cy);
    c.lineTo(a.x, a.y);
    c.stroke();
    c.setLineDash([]);
    const dot = (x, y, fill, stroke) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      c.lineWidth = Math.max(2, a.lw * 0.4);
      c.strokeStyle = stroke;
      c.stroke();
    };
    dot(a.x0, a.y0, '#ffffff', '#2563eb');
    dot(a.x, a.y, '#ffffff', '#2563eb');
    dot(cx, cy, '#f59e0b', '#ffffff');
    c.restore();
  }
  function handlePositions(a) {
    const { cx, cy } = ctrlOf(a);
    return [
      { k: 'p0', x: a.x0, y: a.y0 },
      { k: 'pc', x: cx, y: cy },
      { k: 'p1', x: a.x, y: a.y },
    ];
  }
  function distToCurve(a, p) {
    let best = Infinity;
    for (let i = 0; i <= 20; i++) {
      const q = quadPoint(a, i / 20);
      best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    }
    return best;
  }

  function lineWidths() {
    const unit = Math.max(2, Math.round(canvas.width / 380));
    return [unit, Math.round(unit * 1.9), Math.round(unit * 3.2)];
  }
  function fontSizes() {
    const unit = Math.max(2, Math.round(canvas.width / 380));
    return [unit * 5, Math.round(unit * 7.5), unit * 11];
  }

  function drawAnnotation(c, a) {
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (a.type === 'pen' || a.type === 'marker') {
      c.globalAlpha = a.type === 'marker' ? 0.35 : 1;
      c.strokeStyle = a.color;
      c.lineWidth = a.type === 'marker' ? a.lw * 2.6 : a.lw;
      c.beginPath();
      a.points.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
      if (a.points.length === 1) c.lineTo(a.points[0].x + 0.1, a.points[0].y + 0.1);
      c.stroke();
    } else if (a.type === 'line') {
      c.strokeStyle = a.color;
      c.lineWidth = a.lw;
      strokeCurve(c, a, null);
    } else if (a.type === 'arrow') {
      const { cx, cy } = ctrlOf(a);
      const ang = Math.atan2(a.y - cy, a.x - cx);
      const head = Math.max(30 * (window.devicePixelRatio || 1), a.lw * 5.4);
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const baseC = { x: a.x - head * Math.cos(0.5) * ux, y: a.y - head * Math.cos(0.5) * uy };
      c.strokeStyle = a.color;
      c.lineWidth = a.lw * 1.2;
      strokeCurve(c, a, baseC);
      c.fillStyle = a.color;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(a.x - head * Math.cos(ang - 0.5), a.y - head * Math.sin(ang - 0.5));
      c.lineTo(a.x - head * Math.cos(ang + 0.5), a.y - head * Math.sin(ang + 0.5));
      c.closePath();
      c.fill();
    } else if (a.type === 'rect') {
      c.strokeStyle = a.color;
      c.lineWidth = a.lw;
      c.strokeRect(Math.min(a.x0, a.x), Math.min(a.y0, a.y), Math.abs(a.x - a.x0), Math.abs(a.y - a.y0));
    } else if (a.type === 'ellipse') {
      c.strokeStyle = a.color;
      c.lineWidth = a.lw;
      c.beginPath();
      c.ellipse((a.x0 + a.x) / 2, (a.y0 + a.y) / 2, Math.abs(a.x - a.x0) / 2, Math.abs(a.y - a.y0) / 2, 0, 0, Math.PI * 2);
      c.stroke();
    } else if (a.type === 'text') {
      c.fillStyle = a.color;
      c.font = `700 ${a.fontSize}px "Segoe UI", system-ui, sans-serif`;
      c.textBaseline = 'top';
      c.shadowColor = 'rgba(0, 0, 0, 0.5)';
      c.shadowBlur = Math.max(2, a.fontSize * 0.16);
      c.shadowOffsetX = 0;
      c.shadowOffsetY = Math.max(1, a.fontSize * 0.055);
      a.lines.forEach((line, i) => c.fillText(line, a.x, a.y + i * a.fontSize * 1.2));
      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;
    } else if (a.type === 'blur') {
      // Pixelate THẬT từ ảnh nền, hiện ngay khi vẽ — đúng như trình sửa bản đầu.
      if (!baseImg) return;
      const x = Math.min(a.x0, a.x), y = Math.min(a.y0, a.y);
      const w = Math.abs(a.x - a.x0), h = Math.abs(a.y - a.y0);
      if (w < 2 || h < 2) return;
      const sx = (baseImg.naturalWidth || baseImg.width) / canvas.width;
      const sy = (baseImg.naturalHeight || baseImg.height) / canvas.height;
      const tw = Math.max(1, Math.round(w * 0.07));
      const th = Math.max(1, Math.round(h * 0.07));
      const tmp = document.createElement('canvas');
      tmp.width = tw;
      tmp.height = th;
      tmp.getContext('2d').drawImage(baseImg, x * sx, y * sy, w * sx, h * sy, 0, 0, tw, th);
      c.imageSmoothingEnabled = false;
      c.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
      c.imageSmoothingEnabled = true;
    }
    c.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (baseImg) ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
    annotations.forEach((a) => drawAnnotation(ctx, a));
    if (draft) drawAnnotation(ctx, draft);
    if (!draft && activeIdx >= 0 && annotations[activeIdx]
      && (annotations[activeIdx].type === 'line' || annotations[activeIdx].type === 'arrow')) {
      drawHandles(ctx, annotations[activeIdx]);
    }
    const undoBtn = shadow.querySelector('#btn-undo');
    if (undoBtn) undoBtn.style.opacity = undoStack.length ? '1' : '.35';
  }

  function commitHistory() {
    undoStack.push(JSON.parse(JSON.stringify(annotations)));
    if (undoStack.length > 60) undoStack.shift();
  }

  function toImg(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (!baseReady) return; // nền chưa nạp xong — không cho vẽ "mù" (mờ sẽ không hiện)
    commitTextEditor();
    const p = toImg(e);
    canvas.setPointerCapture(e.pointerId);
    // 1) Kéo 3 chấm của đường/mũi tên đang chọn.
    if (activeIdx >= 0 && annotations[activeIdx]
      && (annotations[activeIdx].type === 'line' || annotations[activeIdx].type === 'arrow')) {
      const sel = annotations[activeIdx];
      const hitR = Math.max(16 * (window.devicePixelRatio || 1), sel.lw * 2.6);
      for (const h of handlePositions(sel)) {
        if (Math.hypot(p.x - h.x, p.y - h.y) <= hitR) {
          handleDrag = {
            k: h.k, start: p,
            orig: JSON.parse(JSON.stringify(sel)),
            before: JSON.parse(JSON.stringify(annotations)),
            moved: false,
          };
          return;
        }
      }
    }
    // 2) Đang dùng công cụ đường/mũi tên mà bấm trúng đường/mũi tên đã vẽ -> chọn nó.
    if (tool === 'line' || tool === 'arrow') {
      for (let i = annotations.length - 1; i >= 0; i--) {
        const a = annotations[i];
        if ((a.type === 'line' || a.type === 'arrow') && distToCurve(a, p) <= Math.max(14 * (window.devicePixelRatio || 1), a.lw * 2.2)) {
          activeIdx = i;
          render();
          return;
        }
      }
    }
    activeIdx = -1;
    if (tool === 'text') {
      openTextEditor(p, e);
      return;
    }
    const lw = lineWidths()[sizeIdx];
    if (tool === 'pen' || tool === 'marker') {
      draft = { type: tool, color, lw, points: [p] };
    } else {
      draft = { type: tool, color, lw, x0: p.x, y0: p.y, x: p.x, y: p.y };
    }
    render();
  }
  function onPointerMove(e) {
    const p = toImg(e);
    if (handleDrag && activeIdx >= 0) {
      const dx = p.x - handleDrag.start.x;
      const dy = p.y - handleDrag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) handleDrag.moved = true;
      const a = JSON.parse(JSON.stringify(handleDrag.orig));
      const { cx, cy } = ctrlOf(a);
      if (a.cx === undefined) { a.cx = cx; a.cy = cy; }
      if (handleDrag.k === 'p0') { a.x0 += dx; a.y0 += dy; }
      else if (handleDrag.k === 'p1') { a.x += dx; a.y += dy; }
      else if (handleDrag.k === 'pc') { a.cx += dx; a.cy += dy; }
      annotations[activeIdx] = a;
      render();
      return;
    }
    if (!draft) return;
    if (draft.points) draft.points.push(p);
    else { draft.x = p.x; draft.y = p.y; }
    render();
  }
  function onPointerUp() {
    if (handleDrag) {
      if (handleDrag.moved) {
        undoStack.push(handleDrag.before);
        if (undoStack.length > 60) undoStack.shift();
      }
      handleDrag = null;
      render();
      return;
    }
    if (!draft) return;
    const d = draft;
    draft = null;
    const tooSmall = !d.points && Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4;
    if (!tooSmall) {
      commitHistory();
      annotations.push(d);
      if (d.type === 'line' || d.type === 'arrow') activeIdx = annotations.length - 1;
    }
    render();
  }

  function openTextEditor(p, e) {
    pendingTextPos = p;
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    textEditor.style.left = e.clientX + 'px';
    textEditor.style.top = e.clientY + 'px';
    textEditor.style.fontSize = Math.max(12, fontSizes()[sizeIdx] * scale) + 'px';
    textEditor.style.color = color;
    textEditor.value = '';
    textEditor.hidden = false;
    textEditor.focus();
  }
  function commitTextEditor() {
    if (!textEditor || textEditor.hidden || !pendingTextPos) return;
    const value = textEditor.value.replace(/\s+$/, '');
    textEditor.hidden = true;
    if (value.trim()) {
      commitHistory();
      annotations.push({
        type: 'text', color, fontSize: fontSizes()[sizeIdx],
        x: pendingTextPos.x, y: pendingTextPos.y, lines: value.split('\n'),
      });
    }
    pendingTextPos = null;
    render();
  }

  function setTool(t) {
    tool = t;
    activeIdx = -1;
    commitTextEditor();
    shadow.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    canvas.className = 'stage ' + (t === 'text' ? 'text' : 'draw');
    render();
  }

  function teardown() {
    window.removeEventListener('keydown', onKeyDown, true);
    if (host) host.remove();
    host = null;
    shadow = null;
  }

  function finish(action) {
    if (finished || !baseReady) return;
    finished = true;
    commitTextEditor();
    draft = null;
    // Ảnh xuất = ảnh nền + mọi nét vẽ (đúng những gì đang thấy trên màn hình).
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(baseImg, 0, 0, out.width, out.height);
    annotations.forEach((a) => drawAnnotation(octx, a));
    const finalDataUrl = out.toDataURL('image/png');
    const captureId = baseCaptureId;
    teardown();
    chrome.runtime.sendMessage({ type: 'ANNOTATE_CAPTURE', action, captureId, finalDataUrl }, () => {
      void chrome.runtime.lastError;
    });
  }

  function cancelSession() {
    if (finished) { teardown(); return; }
    finished = true;
    const captureId = baseCaptureId;
    teardown();
    if (captureId) {
      chrome.runtime.sendMessage({ type: 'ANNOTATE_CANCEL', captureId }, () => {
        void chrome.runtime.lastError;
      });
    }
  }

  function loadBase(captureId, imageDataUrl) {
    baseCaptureId = captureId || null;
    // Đường nhanh: background gửi kèm ảnh nền ngay trong tin mở lớp vẽ.
    if (imageDataUrl) { decodeBase(imageDataUrl); return; }
    if (!captureId) { failStart(); return; }
    chrome.runtime.sendMessage({ type: 'GET_DATAURL', captureId }, (res) => {
      if (finished) return; // người dùng đã huỷ trong lúc đang nạp nền
      if (chrome.runtime.lastError || !res || !res.dataUrl) { failStart(); return; }
      decodeBase(res.dataUrl);
    });
  }

  async function decodeBase(dataUrl) {
    try {
      // Dùng ImageBitmap làm nguồn — cùng loại nguồn với trình sửa, để cách
      // trình duyệt lấy mẫu khi pixelate vùng mờ giống hệt trình sửa.
      const blob = await (await fetch(dataUrl)).blob();
      const bmp = await createImageBitmap(blob);
      if (finished) return;
      baseImg = bmp;
      baseReady = true;
      if (loadingChip) { loadingChip.remove(); loadingChip = null; }
      shadow.querySelectorAll('.act-save, .act-copy').forEach((b) => { b.disabled = false; });
      render();
    } catch (_) {
      failStart();
    }
  }

  function failStart() {
    if (finished) return; // phiên đã kết thúc (huỷ/hoàn tất) — không chụp bù nữa
    finished = true;
    const captureId = baseCaptureId;
    teardown();
    chrome.runtime.sendMessage({ type: 'ANNOTATE_FAILED', captureId }, () => {
      void chrome.runtime.lastError;
    });
  }

  function onKeyDown(e) {
    if (!host) return;
    if (e.key === 'Escape' && textEditor && textEditor.hidden) {
      e.preventDefault();
      cancelSession();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && textEditor && textEditor.hidden) {
      e.preventDefault();
      if (undoStack.length) {
        annotations = undoStack.pop();
        render();
      }
    }
  }

  function start(msg) {
    if (host) return;
    finished = false;
    annotations = [];
    undoStack = [];
    draft = null;
    baseImg = null;
    baseReady = false;
    baseCaptureId = null;

    host = document.createElement('div');
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const layer = document.createElement('div');
    layer.className = 'layer';
    layer.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.className = 'stage draw';
    ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    layer.appendChild(canvas);

    // Thanh công cụ
    const bar = document.createElement('div');
    bar.className = 'toolbar';
    for (const [name, label] of TOOLS) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.tool = name;
      b.title = label;
      b.innerHTML = ICONS[name];
      b.addEventListener('click', () => setTool(name));
      bar.appendChild(b);
    }
    const sep1 = document.createElement('span');
    sep1.className = 'sep';
    bar.appendChild(sep1);
    COLORS.forEach((c, i) => {
      const s = document.createElement('button');
      s.className = 'swatch' + (i === 0 ? ' active' : '');
      s.style.background = c;
      s.title = 'Màu';
      s.addEventListener('click', () => {
        color = c;
        bar.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === s));
      });
      bar.appendChild(s);
    });
    const sep2 = document.createElement('span');
    sep2.className = 'sep';
    bar.appendChild(sep2);
    [4, 7, 11].forEach((sz, i) => {
      const s = document.createElement('button');
      s.className = 'size' + (i === 1 ? ' active' : '');
      s.title = 'Cỡ nét';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.width = sz + 'px';
      dot.style.height = sz + 'px';
      s.appendChild(dot);
      s.addEventListener('click', () => {
        sizeIdx = i;
        bar.querySelectorAll('.size').forEach((x) => x.classList.toggle('active', x === s));
      });
      bar.appendChild(s);
    });
    const sep3 = document.createElement('span');
    sep3.className = 'sep';
    bar.appendChild(sep3);
    const undoBtn = document.createElement('button');
    undoBtn.className = 'tool';
    undoBtn.id = 'btn-undo';
    undoBtn.title = 'Hoàn tác (Ctrl+Z)';
    undoBtn.innerHTML = ICONS.undo;
    undoBtn.style.opacity = '.35';
    undoBtn.addEventListener('click', () => {
      if (undoStack.length) {
        annotations = undoStack.pop();
        render();
      }
    });
    bar.appendChild(undoBtn);
    const clearBtn = document.createElement('button');
    clearBtn.className = 'tool';
    clearBtn.title = 'Xoá hết nét vẽ';
    clearBtn.innerHTML = ICONS.clear;
    clearBtn.addEventListener('click', () => {
      if (annotations.length) {
        commitHistory();
        annotations = [];
        render();
      }
    });
    bar.appendChild(clearBtn);
    layer.appendChild(bar);

    // Ô gõ chữ
    textEditor = document.createElement('textarea');
    textEditor.id = 'text-editor';
    textEditor.rows = 1;
    textEditor.hidden = true;
    textEditor.spellcheck = false;
    textEditor.placeholder = 'Gõ chữ rồi Enter';
    textEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEditor(); }
      if (e.key === 'Escape') { textEditor.value = ''; commitTextEditor(); }
      e.stopPropagation();
    });
    textEditor.addEventListener('blur', () => commitTextEditor());
    layer.appendChild(textEditor);

    // Thanh hành động
    const actions = document.createElement('div');
    actions.className = 'actions';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = 'Vẽ lên ảnh vừa chụp (thấy sao ra vậy):';
    actions.appendChild(hint);
    const btnSave = document.createElement('button');
    btnSave.className = 'act act-save';
    btnSave.disabled = true; // chờ nền nạp xong mới cho lưu/chép
    btnSave.innerHTML = ICONS.save;
    btnSave.title = 'Lưu — được chọn nơi lưu file';
    btnSave.addEventListener('click', () => finish('save'));
    actions.appendChild(btnSave);
    const btnCopy = document.createElement('button');
    btnCopy.className = 'act act-copy';
    btnCopy.disabled = true;
    btnCopy.innerHTML = ICONS.copy;
    btnCopy.title = 'Sao chép vào clipboard';
    btnCopy.addEventListener('click', () => finish('copy'));
    actions.appendChild(btnCopy);
    const btnCancel = document.createElement('button');
    btnCancel.className = 'act act-cancel';
    btnCancel.innerHTML = ICONS.close;
    btnCancel.title = 'Huỷ';
    btnCancel.addEventListener('click', () => cancelSession());
    actions.appendChild(btnCancel);
    layer.appendChild(actions);

    loadingChip = document.createElement('div');
    loadingChip.className = 'loading';
    loadingChip.textContent = 'Đang nạp ảnh chụp…';
    layer.appendChild(loadingChip);

    shadow.appendChild(layer);
    document.documentElement.appendChild(host);
    window.addEventListener('keydown', onKeyDown, true);
    setTool('arrow');
    render();
    loadBase(msg && msg.captureId, msg && msg.imageDataUrl);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'CTP_ANNOTATE_START') start(msg);
  });
})();
