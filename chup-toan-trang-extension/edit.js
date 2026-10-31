'use strict';

// ---------- IndexedDB (dùng chung kho 'ctp-db' với offscreen + result) ----------
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ctp-db', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('captures')) {
        req.result.createObjectStore('captures', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction('captures', 'readonly').objectStore('captures').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(record) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction('captures', 'readwrite').objectStore('captures').put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------- Trạng thái ----------
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const measureCtx = document.createElement('canvas').getContext('2d');

let captureId = null;
let record = null;
let baseBitmap = null;
let originalBitmap = null;
let annotations = [];
let undoStack = [];
let redoStack = [];
let tool = 'select';
let color = '#dc2626';
let sizeIdx = 1;
let draft = null;
let selectedIdx = -1;
let dragState = null;
let cropRect = null;

function lineWidths() {
  const unit = Math.max(2, Math.round((baseBitmap ? baseBitmap.width : 1000) / 380));
  return [unit, Math.round(unit * 1.9), Math.round(unit * 3.2)];
}
function fontSizes() {
  const unit = Math.max(2, Math.round((baseBitmap ? baseBitmap.width : 1000) / 380));
  return [unit * 5, Math.round(unit * 7.5), unit * 11];
}
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2600);
}
function showError(text) {
  const e = $('err');
  e.textContent = text;
  e.hidden = false;
}

// ---------- Hình học đường cong (Bézier bậc 2: đầu – điểm uốn – cuối) ----------
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
// Vẽ thân (đường thẳng/mũi tên) — nếu trimTo có giá trị, thân dừng ở điểm gần
// trimTo nhất trên đường cong (để thân KHÔNG thò qua đầu mũi tên).
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
    cEnd = {
      cx: a.x0 + (cx - a.x0) * bestT,
      cy: a.y0 + (cy - a.y0) * bestT,
    };
  }
  c.beginPath();
  c.moveTo(a.x0, a.y0);
  c.quadraticCurveTo(cEnd.cx, cEnd.cy, end.x, end.y);
  c.stroke();
}
// 3 chấm kéo cong cho đường thẳng/mũi tên đang chọn.
function drawHandles(c, a) {
  const { cx, cy } = ctrlOf(a);
  const r = Math.max(7, a.lw * 1.6);
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

// ---------- Vẽ ----------
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
    const ang = Math.atan2(a.y - cy, a.x - cx); // tiếp tuyến tại cuối đường cong
    const head = Math.max(30, a.lw * 5.4);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    // Chân đầu tên: thân chỉ vẽ tới đây, đầu tam giác là phần nhô xa nhất.
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
    // Bóng đổ mềm để chữ nổi rõ trên mọi nền ảnh.
    c.shadowColor = 'rgba(0, 0, 0, 0.5)';
    c.shadowBlur = Math.max(2, a.fontSize * 0.16);
    c.shadowOffsetX = 0;
    c.shadowOffsetY = Math.max(1, a.fontSize * 0.055);
    a.lines.forEach((line, i) => c.fillText(line, a.x, a.y + i * a.fontSize * 1.2));
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  } else if (a.type === 'blur') {
    const x = Math.min(a.x0, a.x), y = Math.min(a.y0, a.y);
    const w = Math.abs(a.x - a.x0), h = Math.abs(a.y - a.y0);
    if (w > 2 && h > 2 && baseBitmap) {
      const tw = Math.max(1, Math.round(w * 0.07));
      const th = Math.max(1, Math.round(h * 0.07));
      const tmp = document.createElement('canvas');
      tmp.width = tw; tmp.height = th;
      tmp.getContext('2d').drawImage(baseBitmap, x, y, w, h, 0, 0, tw, th);
      c.imageSmoothingEnabled = false;
      c.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
      c.imageSmoothingEnabled = true;
    }
  }
  c.restore();
}

function bboxOf(a) {
  if (a.type === 'pen' || a.type === 'marker') {
    const xs = a.points.map((p) => p.x), ys = a.points.map((p) => p.y);
    const pad = a.lw * (a.type === 'marker' ? 1.6 : 1);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  if (a.type === 'text') {
    measureCtx.font = `700 ${a.fontSize}px "Segoe UI", system-ui, sans-serif`;
    const w = Math.max(...a.lines.map((l) => measureCtx.measureText(l).width), 1);
    return { x: a.x, y: a.y, w, h: a.lines.length * a.fontSize * 1.2 };
  }
  let xs = [a.x0, a.x];
  let ys = [a.y0, a.y];
  if ((a.type === 'line' || a.type === 'arrow') && a.cx !== undefined) {
    xs.push(a.cx);
    ys.push(a.cy);
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: x - a.lw, y: y - a.lw, w: Math.max(...xs) - x + a.lw * 2, h: Math.max(...ys) - y + a.lw * 2 };
}

function render() {
  if (!baseBitmap) return;
  canvas.width = baseBitmap.width;
  canvas.height = baseBitmap.height;
  ctx.drawImage(baseBitmap, 0, 0);
  annotations.forEach((a) => drawAnnotation(ctx, a));
  if (draft) {
    if (draft.type === 'cropdraft') {
      drawDraftRect(draft);
    } else {
      drawAnnotation(ctx, draft);
    }
  }
  if (cropRect) drawOverlayRect(cropRect, '#2563eb');
  if (tool === 'select' && selectedIdx >= 0 && annotations[selectedIdx]) {
    const sel = annotations[selectedIdx];
    if (sel.type === 'line' || sel.type === 'arrow') {
      drawHandles(ctx, sel);
    } else {
      const b = bboxOf(sel);
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(2, baseBitmap.width / 500);
      ctx.setLineDash([10, 7]);
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      ctx.restore();
    }
  }
  $('btn-undo').disabled = undoStack.length === 0;
  $('btn-redo').disabled = redoStack.length === 0;
  $('dims').textContent = `${baseBitmap.width.toLocaleString('vi-VN')} × ${baseBitmap.height.toLocaleString('vi-VN')} px`;
}

function drawDraftRect(r) {
  const x = Math.min(r.x0, r.x), y = Math.min(r.y0, r.y);
  drawOverlayRect({ x, y, w: Math.abs(r.x - r.x0), h: Math.abs(r.y - r.y0) }, '#0f172a');
}
function drawOverlayRect(r, strokeColor) {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.fill('evenodd');
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, baseBitmap.width / 500);
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

// ---------- Lịch sử ----------
function snapshot() {
  return { bitmap: baseBitmap, annotations: JSON.parse(JSON.stringify(annotations)) };
}
function commitHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
function restore(snap) {
  baseBitmap = snap.bitmap;
  annotations = snap.annotations;
  selectedIdx = -1;
  cropRect = null;
  $('crop-bar').hidden = true;
  render();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

// ---------- Tương tác chuột ----------
function toImg(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!baseBitmap) return;
  e.preventDefault(); // giữ focus cho ô gõ chữ (không bị hành vi focus mặc định của mousedown cướp mất)
  commitTextEditor();
  const p = toImg(e);
  canvas.setPointerCapture(e.pointerId);

  if (tool === 'text') {
    openTextEditor(p);
    return;
  }
  if (tool === 'crop') {
    cropRect = null;
    $('crop-bar').hidden = true;
    draft = { type: 'cropdraft', x0: p.x, y0: p.y, x: p.x, y: p.y };
    render();
    return;
  }
  if (tool === 'select') {
    // Ưu tiên: kéo 3 chấm của đường/mũi tên đang chọn để uốn cong / dời đầu.
    if (selectedIdx >= 0 && annotations[selectedIdx]
      && (annotations[selectedIdx].type === 'line' || annotations[selectedIdx].type === 'arrow')) {
      const sel = annotations[selectedIdx];
      const hitR = Math.max(16, sel.lw * 2.6);
      for (const h of handlePositions(sel)) {
        if (Math.hypot(p.x - h.x, p.y - h.y) <= hitR) {
          dragState = { handle: h.k, start: p, orig: JSON.parse(JSON.stringify(sel)), before: snapshot(), moved: false };
          render();
          return;
        }
      }
    }
    for (let i = annotations.length - 1; i >= 0; i--) {
      const b = bboxOf(annotations[i]);
      if (p.x >= b.x - 4 && p.x <= b.x + b.w + 4 && p.y >= b.y - 4 && p.y <= b.y + b.h + 4) {
        selectedIdx = i;
        dragState = { start: p, orig: JSON.parse(JSON.stringify(annotations[i])), before: snapshot(), moved: false };
        render();
        return;
      }
    }
    selectedIdx = -1;
    render();
    return;
  }
  // Công cụ vẽ
  const lw = lineWidths()[sizeIdx];
  if (tool === 'pen' || tool === 'marker') {
    draft = { type: tool, color, lw, points: [p] };
  } else {
    draft = { type: tool, color, lw, x0: p.x, y0: p.y, x: p.x, y: p.y };
  }
  render();
});

canvas.addEventListener('pointermove', (e) => {
  const p = toImg(e);
  if (dragState && selectedIdx >= 0) {
    const dx = p.x - dragState.start.x;
    const dy = p.y - dragState.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) dragState.moved = true;
    const a = JSON.parse(JSON.stringify(dragState.orig));
    if (dragState.handle) {
      const { cx, cy } = ctrlOf(a);
      if (a.cx === undefined) { a.cx = cx; a.cy = cy; }
      if (dragState.handle === 'p0') { a.x0 += dx; a.y0 += dy; }
      else if (dragState.handle === 'p1') { a.x += dx; a.y += dy; }
      else if (dragState.handle === 'pc') { a.cx += dx; a.cy += dy; }
    } else if (a.points) a.points = a.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    else if (a.type === 'text') { a.x += dx; a.y += dy; }
    else {
      a.x0 += dx; a.y0 += dy; a.x += dx; a.y += dy;
      if (a.cx !== undefined) { a.cx += dx; a.cy += dy; }
    }
    annotations[selectedIdx] = a;
    render();
    return;
  }
  if (!draft) return;
  if (draft.points) {
    draft.points.push(p);
  } else {
    draft.x = p.x;
    draft.y = p.y;
  }
  render();
});

canvas.addEventListener('pointerup', () => {
  if (dragState) {
    if (dragState.moved) {
      undoStack.push(dragState.before);
      redoStack = [];
    }
    dragState = null;
    render();
    return;
  }
  if (!draft) return;
  const d = draft;
  draft = null;
  if (d.type === 'cropdraft') {
    const r = { x: Math.min(d.x0, d.x), y: Math.min(d.y0, d.y), w: Math.abs(d.x - d.x0), h: Math.abs(d.y - d.y0) };
    if (r.w > 12 && r.h > 12) {
      cropRect = r;
      $('crop-bar').hidden = false;
    }
    render();
    return;
  }
  const tooSmall = !d.points && Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4;
  if (tooSmall) { render(); return; }
  commitHistory();
  annotations.push(d);
  if (d.type === 'line' || d.type === 'arrow') {
    // Vừa vẽ xong đường/mũi tên: chọn luôn và hiện 3 chấm để kéo uốn cong.
    selectedIdx = annotations.length - 1;
    setTool('select');
  } else {
    selectedIdx = -1;
  }
  render();
});

// ---------- Gõ chữ ----------
let pendingTextPos = null;
const textEditor = $('text-editor');
function openTextEditor(p) {
  pendingTextPos = p;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / canvas.width;
  const fontSize = fontSizes()[sizeIdx];
  textEditor.style.left = canvas.offsetLeft + p.x * scale + 'px';
  textEditor.style.top = canvas.offsetTop + p.y * scale + 'px';
  textEditor.style.fontSize = Math.max(12, fontSize * scale) + 'px';
  textEditor.style.color = color;
  textEditor.value = '';
  textEditor.hidden = false;
  textEditor.focus();
}
function commitTextEditor() {
  if (textEditor.hidden || !pendingTextPos) return;
  const value = textEditor.value.replace(/\s+$/, '');
  textEditor.hidden = true;
  if (value.trim()) {
    commitHistory();
    annotations.push({
      type: 'text',
      color,
      fontSize: fontSizes()[sizeIdx],
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      lines: value.split('\n'),
    });
  }
  pendingTextPos = null;
  render();
}
textEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEditor(); }
  if (e.key === 'Escape') { textEditor.value = ''; commitTextEditor(); }
  e.stopPropagation();
});
textEditor.addEventListener('blur', () => commitTextEditor());

// ---------- Cắt ----------
$('btn-crop-ok').addEventListener('click', async () => {
  if (!cropRect) return;
  commitHistory();
  const flat = document.createElement('canvas');
  flat.width = baseBitmap.width;
  flat.height = baseBitmap.height;
  const fctx = flat.getContext('2d');
  fctx.drawImage(baseBitmap, 0, 0);
  annotations.forEach((a) => drawAnnotation(fctx, a));
  const cut = document.createElement('canvas');
  cut.width = Math.round(cropRect.w);
  cut.height = Math.round(cropRect.h);
  cut.getContext('2d').drawImage(flat, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cut.width, cut.height);
  baseBitmap = await createImageBitmap(cut);
  annotations = [];
  selectedIdx = -1;
  cropRect = null;
  $('crop-bar').hidden = true;
  render();
  toast('Đã cắt ảnh ✓');
});
$('btn-crop-cancel').addEventListener('click', () => {
  cropRect = null;
  $('crop-bar').hidden = true;
  render();
});

// ---------- Thanh công cụ ----------
const TOOL_NOTES = {
  select: 'Bấm vào một nét vẽ để chọn — kéo để dời, phím Delete để xoá.',
  pen: 'Kéo chuột để vẽ tự do.',
  marker: 'Kéo để tô nhấn mạnh (nét trong mờ).',
  line: 'Kéo để kẻ đường thẳng.',
  arrow: 'Kéo để vẽ mũi tên chỉ vào chỗ cần chỉ.',
  rect: 'Kéo để khoanh khung chữ nhật.',
  ellipse: 'Kéo để khoanh khung tròn/oval.',
  text: 'Bấm vào ảnh rồi gõ chữ — Enter để chốt, Shift+Enter xuống dòng.',
  blur: 'Kéo khoanh vùng cần che (tên, email, số điện thoại…).',
  crop: 'Kéo khoanh vùng cần giữ, rồi bấm “Cắt vùng này”.',
};
document.querySelectorAll('.tool[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});
function setTool(t) {
  tool = t;
  commitTextEditor();
  if (t !== 'crop') { cropRect = null; $('crop-bar').hidden = true; }
  if (t !== 'select') selectedIdx = -1;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  canvas.className = t === 'text' ? 'tool-text' : t === 'select' ? 'tool-select' : 'tool-draw';
  $('toolbar-note').textContent = TOOL_NOTES[t] || '';
  render();
}
document.querySelectorAll('.swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    color = btn.dataset.color;
    document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b === btn));
  });
});
document.querySelectorAll('.size').forEach((btn) => {
  btn.addEventListener('click', () => {
    sizeIdx = parseInt(btn.dataset.size, 10);
    document.querySelectorAll('.size').forEach((b) => b.classList.toggle('active', b === btn));
  });
});
$('btn-undo').addEventListener('click', undo);
$('btn-redo').addEventListener('click', redo);

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx >= 0 && textEditor.hidden) {
    e.preventDefault();
    commitHistory();
    annotations.splice(selectedIdx, 1);
    selectedIdx = -1;
    render();
  } else if (e.key === 'Escape') {
    selectedIdx = -1;
    cropRect = null;
    $('crop-bar').hidden = true;
    render();
  }
});

// ---------- Xuất ảnh & thanh dọc ----------
async function exportBlob() {
  const out = document.createElement('canvas');
  out.width = baseBitmap.width;
  out.height = baseBitmap.height;
  const c = out.getContext('2d');
  const isJpeg = record && record.format === 'jpeg';
  if (isJpeg) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, out.width, out.height); }
  c.drawImage(baseBitmap, 0, 0);
  annotations.forEach((a) => drawAnnotation(c, a));
  return new Promise((resolve) => out.toBlob(resolve, isJpeg ? 'image/jpeg' : 'image/png', 0.92));
}

$('btn-apply').addEventListener('click', async () => {
  try {
    commitTextEditor();
    const blob = await exportBlob();
    if (!blob) throw new Error('no blob');
    const updated = { ...record, blob, width: baseBitmap.width, height: baseBitmap.height, size: blob.size };
    if (!record.originalBlob) updated.originalBlob = record.blob;
    await idbPut(updated);
    record = updated;
    baseBitmap = await createImageBitmap(blob);
    originalBitmap = updated.originalBlob ? await createImageBitmap(updated.originalBlob) : baseBitmap;
    annotations = [];
    undoStack = [];
    redoStack = [];
    selectedIdx = -1;
    render();
    toast('Đã áp dụng bản đã sửa ✓');
    if (record.sourceTabId) {
      try { await chrome.tabs.update(record.sourceTabId, { active: true }); } catch (_) {}
      setTimeout(() => window.close(), 500);
    }
  } catch (_) {
    showError('Áp dụng chưa được — thử lại giúp em.');
  }
});

$('btn-copy').addEventListener('click', async () => {
  try {
    commitTextEditor();
    let blob = await exportBlob();
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const cx = c.getContext('2d');
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(bmp, 0, 0);
      blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Đã sao chép ảnh đã sửa ✓ — dán ở đâu cũng được');
  } catch (_) {
    toast('Sao chép chưa được trên trang này.');
  }
});

$('btn-download').addEventListener('click', async () => {
  try {
    commitTextEditor();
    const blob = await exportBlob();
    const url = URL.createObjectURL(blob);
    const before = new Set((await chrome.downloads.search({})).map((d) => d.id));
    // Tải bằng thẻ <a download>: tên file khớp ở mọi môi trường (downloads.download
    // với blob URL có nơi lưu thành tên GUID — đã kiểm chứng).
    const a = document.createElement('a');
    a.href = url;
    a.download = record.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Đang tải xuống…');
    const final = await waitFinalName(null, before);
    toast(final ? `Đã tải: ${final}` : 'Đã tải xuống ✓');
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (_) {
    toast('Tải xuống chưa được.');
  }
});

function waitFinalName(id, before) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const items = id ? await chrome.downloads.search({ id }) : (await chrome.downloads.search({})).filter((d) => !before.has(d.id));
        const item = items[0];
        if (item && item.state === 'complete' && item.filename) {
          resolve(item.filename.split(/[\\/]/).pop());
          return;
        }
      } catch (_) {}
      if (tries < 40) setTimeout(tick, 120);
      else resolve(null);
    };
    tick();
  });
}

$('btn-original').addEventListener('click', () => {
  if (!originalBitmap || (originalBitmap === baseBitmap && annotations.length === 0)) {
    toast('Ảnh đang là bản gốc rồi.');
    return;
  }
  commitHistory();
  baseBitmap = originalBitmap;
  annotations = [];
  selectedIdx = -1;
  cropRect = null;
  $('crop-bar').hidden = true;
  render();
  toast('Đã quay về ảnh gốc.');
});

$('btn-close').addEventListener('click', () => window.close());

// ---------- Khởi tạo ----------
(async () => {
  const params = new URLSearchParams(location.search);
  captureId = params.get('id');
  if (!captureId) { showError('Thiếu mã ảnh chụp.'); return; }
  try {
    record = await idbGet(captureId);
    if (!record || !record.blob) { showError('Không tìm thấy ảnh chụp — có thể ảnh đã bị xoá.'); return; }
    baseBitmap = await createImageBitmap(record.blob);
    originalBitmap = record.originalBlob ? await createImageBitmap(record.originalBlob) : baseBitmap;
    $('fname').textContent = record.filename || 'anh-chup.png';
    setTool('arrow');
  } catch (_) {
    showError('Mở ảnh chưa được — thử lại giúp em.');
  }
})();
