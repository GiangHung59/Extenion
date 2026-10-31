// Chụp VÙNG CHỌN kiểu Lightshot: extension chụp khung đang xem TRƯỚC và đóng
// băng làm nền (trang bị phủ tối), người dùng kéo chọn vùng ngay trên nền đó —
// vùng chọn sáng lên kèm khung + tay nắm kéo dãn/di chuyển. Quanh vùng chọn có
// thanh công cụ vẽ (bút, mũi tên, chữ, làm mờ...) và thanh hành động bằng ICON
// (lưu / sao chép / đóng). Xuất ảnh = cắt đúng vùng chọn kèm nét vẽ, thay vào
// bản chụp nền đã lưu (dùng chung ANNOTATE_CAPTURE / REPLACE_IMAGE).
(() => {
  if (window.__ctpRegionLoaded) return;
  window.__ctpRegionLoaded = true;

  const HOST_ID = 'ctp-region-host';

  const CSS = `
    :host { all: initial; }
    .layer { position: fixed; inset: 0; z-index: 2147483000; font-family: "Segoe UI", system-ui, sans-serif; }
    canvas.stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
    canvas.stage.draw { cursor: crosshair; }
    canvas.stage.text { cursor: text; }
    .vtools {
      position: absolute; display: none; flex-direction: column; align-items: center; gap: 5px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15,23,42,.28); padding: 8px 6px; z-index: 6;
    }
    .vtools.on { display: flex; }
    .tool { width: 38px; height: 38px; border-radius: 10px; border: 1.5px solid transparent; background: transparent;
      color: #1e293b; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
    .tool svg { width: 20px; height: 20px; }
    .tool:hover { background: #f1f5f9; }
    .tool.active { background: #2563eb; color: #fff; }
    .sep-h { height: 1.5px; width: 26px; background: #e2e8f0; margin: 4px 0; }
    .swatch { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #cbd5e1; cursor: pointer; padding: 0; }
    .swatch.active { outline: 2.5px solid #2563eb; outline-offset: 2px; }
    .size { width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid transparent; background: transparent;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .size.active { border-color: #2563eb; background: #eff6ff; }
    .dot { border-radius: 50%; background: #0f172a; display: block; }
    .actions { position: absolute; display: none; gap: 8px; z-index: 6; }
    .actions.on { display: flex; }
    .ibtn { width: 46px; height: 46px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;
      box-shadow: 0 8px 20px rgba(15,23,42,.25); color: #1e293b; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; padding: 0; }
    .ibtn svg { width: 22px; height: 22px; }
    .ibtn:hover { background: #f1f5f9; }
    .ibtn.save { color: #16a34a; }
    .ibtn.copy { color: #2563eb; }
    .ibtn.close { color: #dc2626; }
    .ibtn:disabled { opacity: .45; cursor: default; }
    .selinfo { position: absolute; display: none; background: rgba(15,23,42,.88); color: #fff;
      font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 8px; z-index: 6; pointer-events: none; }
    .selinfo.on { display: block; }
    .loading { position: absolute; top: 26px; left: 50%; transform: translateX(-50%); z-index: 7;
      background: rgba(15,23,42,.9); color: #fff; font-size: 14px; font-weight: 600;
      padding: 10px 18px; border-radius: 999px; box-shadow: 0 8px 24px rgba(15,23,42,.35); }
    #text-editor {
      position: absolute; z-index: 7; min-width: 60px;
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
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v4h7V3"/><rect x="8" y="13" width="8" height="8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  const TOOLS = [
    ['select', 'Chọn / di chuyển vùng'], ['pen', 'Bút vẽ'], ['marker', 'Đánh dấu (tô nhấn)'],
    ['line', 'Đường thẳng'], ['arrow', 'Mũi tên'], ['rect', 'Khung chữ nhật'],
    ['ellipse', 'Khung tròn'], ['text', 'Gõ chữ'], ['blur', 'Làm mờ / che kín'],
  ];
  const COLORS = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#0f172a', '#ffffff'];

  let host = null;
  let shadow = null;
  let canvas = null;
  let ctx = null;
  let annotations = [];
  let undoStack = [];
  let draft = null;
  let tool = 'select';
  let color = '#dc2626';
  let sizeIdx = 1;
  let pendingTextPos = null;
  let textEditor = null;
  let finished = false;
  let activeIdx = -1;
  let handleDrag = null;
  let baseImg = null;
  let baseCaptureId = null;
  let baseReady = false;
  let loadingChip = null;
  let sel = null;        // vùng chọn {x, y, w, h} theo toạ độ ảnh
  let selDraft = null;   // {x0, y0, x, y} trong lúc kéo chọn lần đầu
  let selOp = null;      // {kind: 'move'|'resize', handle, start, orig}
  let vtoolsEl = null;
  let actionsEl = null;
  let selInfoEl = null;
  let btnSaveEl = null;
  let btnCopyEl = null;

  // ----- Hình học đường cong (Bézier bậc 2) — giống annotate/editor -----
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

  // ----- Vùng chọn -----
  function normRect(d) {
    if (!d) return null;
    return {
      x: Math.min(d.x0, d.x), y: Math.min(d.y0, d.y),
      w: Math.abs(d.x - d.x0), h: Math.abs(d.y - d.y0),
    };
  }
  function selHandles(r) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    return [
      { k: 'nw', x: r.x, y: r.y }, { k: 'n', x: cx, y: r.y }, { k: 'ne', x: r.x + r.w, y: r.y },
      { k: 'e', x: r.x + r.w, y: cy }, { k: 'se', x: r.x + r.w, y: r.y + r.h },
      { k: 's', x: cx, y: r.y + r.h }, { k: 'sw', x: r.x, y: r.y + r.h }, { k: 'w', x: r.x, y: cy },
    ];
  }
  function clampSel(r) {
    r.w = Math.max(12, r.w);
    r.h = Math.max(12, r.h);
    r.x = Math.min(Math.max(0, r.x), canvas.width - r.w);
    r.y = Math.min(Math.max(0, r.y), canvas.height - r.h);
    return r;
  }
  const insideSel = (p, r, pad) => p.x >= r.x - pad && p.x <= r.x + r.w + pad
    && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (baseImg) ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
    // Phủ tối toàn khung — vùng chọn sẽ được "đục" sáng trở lại.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const r = sel || normRect(selDraft);
    if (r && baseImg) {
      ctx.drawImage(baseImg, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    }
    if (sel && baseImg) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.w, sel.h);
      ctx.clip();
      annotations.forEach((a) => drawAnnotation(ctx, a));
      if (draft) drawAnnotation(ctx, draft);
      ctx.restore();
      if (!draft && activeIdx >= 0 && annotations[activeIdx]
        && (annotations[activeIdx].type === 'line' || annotations[activeIdx].type === 'arrow')) {
        drawHandles(ctx, annotations[activeIdx]);
      }
    }
    if (r) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 3 * dpr;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6 * dpr;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      if (sel) {
        const hs = 5.5 * dpr;
        for (const h of selHandles(r)) {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 1.6 * dpr;
          ctx.fillRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
          ctx.strokeRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
        }
      }
      ctx.restore();
    }
    const undoBtn = shadow.querySelector('#btn-undo');
    if (undoBtn) undoBtn.style.opacity = undoStack.length ? '1' : '.35';
    layoutUI(r);
  }

  function layoutUI(r) {
    if (!vtoolsEl) return;
    const show = !!sel;
    vtoolsEl.classList.toggle('on', show);
    actionsEl.classList.toggle('on', show);
    selInfoEl.classList.toggle('on', !!r);
    if (btnSaveEl) btnSaveEl.disabled = !(sel && baseReady);
    if (btnCopyEl) btnCopyEl.disabled = !(sel && baseReady);
    if (!r) return;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const L = r.x / scale, T = r.y / scale, R = (r.x + r.w) / scale, B = (r.y + r.h) / scale;
    selInfoEl.textContent = `${Math.round(r.w)} × ${Math.round(r.h)} px`;
    selInfoEl.style.left = Math.max(4, L) + 'px';
    selInfoEl.style.top = (T - 32 >= 2 ? T - 32 : T + 6) + 'px';
    // Thanh công cụ dọc: bên phải vùng chọn, chật thì sang trái.
    let vl = R + 10;
    if (vl + 54 > window.innerWidth) vl = Math.max(4, L - 54 - 10);
    vtoolsEl.style.left = vl + 'px';
    vtoolsEl.style.top = Math.min(Math.max(4, T), Math.max(4, window.innerHeight - 480)) + 'px';
    // Thanh hành động: dưới góc phải vùng chọn, chật thì vào trong.
    actionsEl.style.right = Math.max(4, window.innerWidth - R) + 'px';
    let at = B + 10;
    if (at + 54 > window.innerHeight) at = Math.max(4, B - 54 - 4);
    actionsEl.style.top = at + 'px';
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
    if (!baseReady) return; // nền chưa nạp xong — không cho thao tác mù
    commitTextEditor();
    const p = toImg(e);
    canvas.setPointerCapture(e.pointerId);
    const dpr = window.devicePixelRatio || 1;
    if (sel) {
      // 1) Tay nắm kéo dãn
      const hitR = Math.max(14 * dpr, 12);
      for (const h of selHandles(sel)) {
        if (Math.hypot(p.x - h.x, p.y - h.y) <= hitR) {
          selOp = { kind: 'resize', handle: h.k, start: p, orig: { ...sel } };
          return;
        }
      }
      // 2) Kéo trên viền -> di chuyển vùng
      const band = 9 * dpr;
      if (insideSel(p, sel, band) && !insideSel(p, { x: sel.x + band, y: sel.y + band, w: sel.w - band * 2, h: sel.h - band * 2 }, 0)) {
        selOp = { kind: 'move', start: p, orig: { ...sel } };
        return;
      }
      if (insideSel(p, sel, 0)) {
        // 3) Trong vùng: kéo 3 chấm cong của đường/mũi tên đang chọn
        if (activeIdx >= 0 && annotations[activeIdx]
          && (annotations[activeIdx].type === 'line' || annotations[activeIdx].type === 'arrow')) {
          const a0 = annotations[activeIdx];
          const hitR2 = Math.max(16 * dpr, a0.lw * 2.6);
          for (const h of handlePositions(a0)) {
            if (Math.hypot(p.x - h.x, p.y - h.y) <= hitR2) {
              handleDrag = {
                k: h.k, start: p,
                orig: JSON.parse(JSON.stringify(a0)),
                before: JSON.parse(JSON.stringify(annotations)),
                moved: false,
              };
              return;
            }
          }
        }
        if (tool === 'line' || tool === 'arrow') {
          for (let i = annotations.length - 1; i >= 0; i--) {
            const a = annotations[i];
            if ((a.type === 'line' || a.type === 'arrow') && distToCurve(a, p) <= Math.max(14 * dpr, a.lw * 2.2)) {
              activeIdx = i;
              render();
              return;
            }
          }
        }
        activeIdx = -1;
        if (tool === 'select') {
          selOp = { kind: 'move', start: p, orig: { ...sel } };
          return;
        }
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
        return;
      }
      // 4) Bấm ra ngoài -> chọn vùng mới (bỏ nét vẽ của vùng cũ)
      annotations = [];
      undoStack = [];
      activeIdx = -1;
      sel = null;
      selDraft = { x0: p.x, y0: p.y, x: p.x, y: p.y };
      render();
      return;
    }
    selDraft = { x0: p.x, y0: p.y, x: p.x, y: p.y };
    render();
  }

  function onPointerMove(e) {
    const p = toImg(e);
    if (selOp && sel) {
      const dx = p.x - selOp.start.x;
      const dy = p.y - selOp.start.y;
      const o = selOp.orig;
      if (selOp.kind === 'move') {
        sel = clampSel({ x: o.x + dx, y: o.y + dy, w: o.w, h: o.h });
      } else {
        let { x, y, w, h } = o;
        const k = selOp.handle;
        if (k.includes('e')) w = o.w + dx;
        if (k.includes('s')) h = o.h + dy;
        if (k.includes('w')) { x = o.x + dx; w = o.w - dx; }
        if (k.includes('n')) { y = o.y + dy; h = o.h - dy; }
        if (w < 12) { if (k.includes('w')) x = o.x + o.w - 12; w = 12; }
        if (h < 12) { if (k.includes('n')) y = o.y + o.h - 12; h = 12; }
        sel = clampSel({ x, y, w, h });
      }
      render();
      return;
    }
    if (selDraft) {
      selDraft.x = p.x;
      selDraft.y = p.y;
      render();
      return;
    }
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
    if (selOp) {
      selOp = null;
      render();
      return;
    }
    if (selDraft) {
      const r = normRect(selDraft);
      selDraft = null;
      if (r && r.w >= 12 && r.h >= 12) sel = clampSel(r);
      render();
      return;
    }
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
    if (finished || !baseReady || !sel) return;
    finished = true;
    commitTextEditor();
    draft = null;
    const sx = Math.round(sel.x), sy = Math.round(sel.y);
    const sw = Math.max(1, Math.round(sel.w)), sh = Math.max(1, Math.round(sel.h));
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const octx = out.getContext('2d');
    octx.drawImage(baseImg, sx, sy, sw, sh, 0, 0, sw, sh);
    octx.save();
    octx.translate(-sx, -sy);
    annotations.forEach((a) => drawAnnotation(octx, a));
    octx.restore();
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
    if (imageDataUrl) { decodeBase(imageDataUrl); return; }
    if (!captureId) { failStart(); return; }
    chrome.runtime.sendMessage({ type: 'GET_DATAURL', captureId }, (res) => {
      if (finished) return;
      if (chrome.runtime.lastError || !res || !res.dataUrl) { failStart(); return; }
      decodeBase(res.dataUrl);
    });
  }

  async function decodeBase(dataUrl) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bmp = await createImageBitmap(blob);
      if (finished) return;
      baseImg = bmp;
      baseReady = true;
      if (loadingChip) { loadingChip.remove(); loadingChip = null; }
      render();
    } catch (_) {
      failStart();
    }
  }

  function failStart() {
    if (finished) return;
    finished = true;
    const captureId = baseCaptureId;
    teardown();
    if (captureId) {
      chrome.runtime.sendMessage({ type: 'ANNOTATE_CANCEL', captureId }, () => {
        void chrome.runtime.lastError;
      });
    }
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
        activeIdx = -1;
        render();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && textEditor && textEditor.hidden) {
      e.preventDefault();
      finish('save');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && textEditor && textEditor.hidden) {
      e.preventDefault();
      finish('copy');
    }
  }

  function start(msg) {
    if (host) return;
    finished = false;
    annotations = [];
    undoStack = [];
    draft = null;
    sel = null;
    selDraft = null;
    selOp = null;
    activeIdx = -1;
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

    // Thanh công cụ dọc (bên phải vùng chọn)
    vtoolsEl = document.createElement('div');
    vtoolsEl.className = 'vtools';
    for (const [name, label] of TOOLS) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.tool = name;
      b.title = label;
      b.innerHTML = ICONS[name];
      b.addEventListener('click', () => setTool(name));
      vtoolsEl.appendChild(b);
    }
    const sep1 = document.createElement('div');
    sep1.className = 'sep-h';
    vtoolsEl.appendChild(sep1);
    for (const c of COLORS) {
      const s = document.createElement('button');
      s.className = 'swatch' + (c === color ? ' active' : '');
      s.style.background = c;
      s.title = c;
      s.addEventListener('click', () => {
        color = c;
        vtoolsEl.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x.style.background === c || x.title === c));
        if (textEditor && !textEditor.hidden) textEditor.style.color = c;
      });
      vtoolsEl.appendChild(s);
    }
    const sep2 = document.createElement('div');
    sep2.className = 'sep-h';
    vtoolsEl.appendChild(sep2);
    lineWidths().forEach((w, i) => {
      const s = document.createElement('button');
      s.className = 'size' + (i === sizeIdx ? ' active' : '');
      s.title = 'Cỡ nét ' + (i + 1);
      const dot = document.createElement('span');
      dot.className = 'dot';
      const px = Math.max(3, Math.min(15, w));
      dot.style.width = px + 'px';
      dot.style.height = px + 'px';
      s.appendChild(dot);
      s.addEventListener('click', () => {
        sizeIdx = i;
        vtoolsEl.querySelectorAll('.size').forEach((x, j) => x.classList.toggle('active', j === i));
      });
      vtoolsEl.appendChild(s);
    });
    const sep3 = document.createElement('div');
    sep3.className = 'sep-h';
    vtoolsEl.appendChild(sep3);
    const undoBtn = document.createElement('button');
    undoBtn.className = 'tool';
    undoBtn.id = 'btn-undo';
    undoBtn.title = 'Hoàn tác (Ctrl+Z)';
    undoBtn.innerHTML = ICONS.undo;
    undoBtn.style.opacity = '.35';
    undoBtn.addEventListener('click', () => {
      if (undoStack.length) {
        annotations = undoStack.pop();
        activeIdx = -1;
        render();
      }
    });
    vtoolsEl.appendChild(undoBtn);
    const clearBtn = document.createElement('button');
    clearBtn.className = 'tool';
    clearBtn.title = 'Xoá hết nét vẽ';
    clearBtn.innerHTML = ICONS.clear;
    clearBtn.addEventListener('click', () => {
      if (annotations.length) {
        commitHistory();
        annotations = [];
        activeIdx = -1;
        render();
      }
    });
    vtoolsEl.appendChild(clearBtn);
    layer.appendChild(vtoolsEl);

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

    // Nhãn kích thước vùng chọn
    selInfoEl = document.createElement('div');
    selInfoEl.className = 'selinfo';
    layer.appendChild(selInfoEl);

    // Thanh hành động — ICON (giống Lightshot), không dùng chữ
    actionsEl = document.createElement('div');
    actionsEl.className = 'actions';
    btnSaveEl = document.createElement('button');
    btnSaveEl.className = 'ibtn save';
    btnSaveEl.title = 'Lưu ảnh (Ctrl+S)';
    btnSaveEl.innerHTML = ICONS.save;
    btnSaveEl.disabled = true;
    btnSaveEl.addEventListener('click', () => finish('save'));
    actionsEl.appendChild(btnSaveEl);
    btnCopyEl = document.createElement('button');
    btnCopyEl.className = 'ibtn copy';
    btnCopyEl.title = 'Sao chép vào clipboard (Ctrl+C)';
    btnCopyEl.innerHTML = ICONS.copy;
    btnCopyEl.disabled = true;
    btnCopyEl.addEventListener('click', () => finish('copy'));
    actionsEl.appendChild(btnCopyEl);
    const btnClose = document.createElement('button');
    btnClose.className = 'ibtn close';
    btnClose.title = 'Đóng (Esc)';
    btnClose.innerHTML = ICONS.close;
    btnClose.addEventListener('click', () => cancelSession());
    actionsEl.appendChild(btnClose);
    layer.appendChild(actionsEl);

    loadingChip = document.createElement('div');
    loadingChip.className = 'loading';
    loadingChip.textContent = 'Đang nạp ảnh chụp…';
    layer.appendChild(loadingChip);

    shadow.appendChild(layer);
    document.documentElement.appendChild(host);
    window.addEventListener('keydown', onKeyDown, true);
    setTool('select');
    render();
    loadBase(msg && msg.captureId, msg && msg.imageDataUrl);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'CTP_REGION_START') start(msg);
  });
})();
