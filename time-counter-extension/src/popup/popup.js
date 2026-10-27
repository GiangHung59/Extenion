// Time Counter Chrome Extension - Popup Script (v1.2.0)
//
// v1.2.0 adds, on top of the v1.1.1 counting contract in counting.js:
//  - Pinned hero: click any card (or its pin button) to pin it; the hero
//    shows a live per-second timer and a progress %.
//  - Solar + lunar calendar (top right): previous/next month, click a day
//    to select it, or type/pick a date and press "Di toi" to jump there.
//  - Hide: an expired (already passed) countdown can be hidden; hidden
//    events live in their own section and can be restored.
//  - Optional event time, used by the hero live timer.
// Settings are now merged, not overwritten, so pinning or changing the
// theme no longer wipes other settings such as notifications (v1.1.x bug).

// Parse only explicit calendar dates; do not let Date normalize invalid input.
function parseCalendarDate(value) {
  const text = String(value || '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!iso && !local) return null;
  const year = Number(iso ? iso[1] : local[3]);
  const month = Number(iso ? iso[2] : local[2]);
  const day = Number(iso ? iso[3] : local[1]);
  if (year < 100 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function dateInputValue(date) {
  const pad = number => String(number).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).padStart(4, '0')}`;
}

const ACTION_ICON_PATHS = {
  pin: '<path d="m16 3 5 5-4 2-3 6-2-2-7 7-2-2 7-7-2-2 6-3z"/>',
  unpin: '<path d="m3 3 18 18M16 3l5 5-4 2-2 4M12 12l-7 9-2-2 7-7M7 7l-1 1 6 6"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  hide: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 3.8M6.2 6.2A21 21 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.8-1.8"/>'
};

function actionIcon(name) {
  return `<svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ACTION_ICON_PATHS[name]}</svg>`;
}

class TimeCounter {
  constructor() {
    this.events = [];
    this.settings = {};
    this.currentTheme = 'auto';
    this.pinnedId = null;
    this.editingEventId = null;
    this.syncStatus = 'syncing'; // 'synced' | 'syncing' | 'offline'
    this.searchQuery = '';
    this.calendarInputDirty = false;
    this.filter = 'all';
    const today = new Date();
    this.calYear = today.getFullYear();
    this.calMonth = today.getMonth();
    this.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.setupTheme();
    this.renderHero();
    this.renderEvents();
    this.renderHidden();
    this.renderCalendar();
    this.tickHero();
    setInterval(() => this.tickHero(), 1000);
    setInterval(() => { this.renderEvents(); this.renderCalendar(); }, 60000);
  }

  // ── Storage ─────────────────────────────────────────────────────────────

  async loadData() {
    try {
      const result = await chrome.storage.sync.get(['events', 'settings']);
      this.events = result.events || [];
      this.settings = result.settings || {};
      this.currentTheme = this.settings.theme || 'auto';
      this.pinnedId = this.settings.pinnedId || null;
      if (this.pinnedId && !this.events.find(e => e.id === this.pinnedId)) this.pinnedId = null;
      this.setSyncStatus('synced');
    } catch (error) {
      console.warn('chrome.storage.sync không khả dụng:', error);
      this.setSyncStatus('offline');
      this.events = [];
    }
  }

  async saveData() {
    this.settings = Object.assign({}, this.settings, {
      theme: this.currentTheme,
      pinnedId: this.pinnedId
    });
    const data = { events: this.events, settings: this.settings };
    try {
      this.setSyncStatus('syncing');
      await chrome.storage.sync.set(data);
      this.setSyncStatus('synced');
    } catch (error) {
      console.error('Lưu đám mây thất bại:', error);
      this.setSyncStatus('offline');
    }
  }

  setSyncStatus(status) {
    this.syncStatus = status;
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    const map = {
      synced:  { text: '☁️ Đã đồng bộ', cls: 'sync-ok' },
      syncing: { text: '☁️ Đang lưu…',  cls: 'sync-pending' },
      offline: { text: '⚠️ Offline',      cls: 'sync-error' }
    };
    const s = map[status] || map.synced;
    badge.textContent = s.text;
    badge.className = 'sync-badge ' + s.cls;
  }

  // ── Event CRUD ──────────────────────────────────────────────────────────

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  addEvent(eventData) {
    this.events.push({
      id: this.generateId(),
      name: eventData.name,
      type: eventData.type,
      date: eventData.date,
      time: eventData.time || '',
      excludedDays: eventData.excludedDays || [],
      hidden: false,
      createdAt: new Date().toISOString()
    });
    this.saveData();
    this.renderAll();
  }

  updateEvent(eventId, eventData) {
    const idx = this.events.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      this.events[idx] = Object.assign({}, this.events[idx], eventData);
      this.saveData();
      this.renderAll();
    }
  }

  deleteEvent(eventId) {
    this.events = this.events.filter(e => e.id !== eventId);
    if (this.pinnedId === eventId) this.pinnedId = null;
    this.saveData();
    this.renderAll();
  }

  hideEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (event) { event.hidden = true; this.saveData(); this.renderAll(); }
  }

  unhideEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (event) { event.hidden = false; this.saveData(); this.renderAll(); }
  }

  pinEvent(eventId) {
    this.pinnedId = eventId;
    this.saveData();
    this.renderHero();
    this.renderEvents();
  }

  unpinEvent() {
    this.pinnedId = null;
    this.saveData();
    this.renderHero();
    this.renderEvents();
  }

  renderAll() {
    this.renderHero();
    this.renderEvents();
    this.renderHidden();
    this.renderCalendar();
  }

  // ── Time Calculations (shared logic in counting.js) ─────────────────────

  getEventCounter(event) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = parseCalendarDate(event.date);
    eventDate.setHours(0, 0, 0, 0);
    const excluded = event.excludedDays || [];
    const hasExcluded = excluded.length > 0;

    if (event.type === 'countdown') {
      if (eventDate < today) {
        const calendarDays = diffCalendarDays(eventDate, today);
        const days = countedDaysBetween(eventDate, today, excluded);
        return {
          days, calendarDays, hasExcluded,
          display: 'Đã kết thúc',
          label: days > 0 ? `đã qua ${hasExcluded ? days + ' ngày tính' : formatCalendarBreakdown(calendarBreakdown(eventDate, today))}` : '',
          expired: true, isToday: false
        };
      }
      if (eventDate.getTime() === today.getTime()) {
        return { days: 0, calendarDays: 0, hasExcluded, display: 'Hôm nay', label: '', expired: false, isToday: true };
      }
      const calendarDays = diffCalendarDays(today, eventDate);
      const days = countedDaysBetween(today, eventDate, excluded);
      return {
        days, calendarDays, hasExcluded,
        display: hasExcluded ? `${days} ngày tính` : formatCalendarBreakdown(calendarBreakdown(today, eventDate)),
        label: 'còn lại', expired: false, isToday: false
      };
    } else {
      if (eventDate > today) {
        return { days: 0, calendarDays: 0, hasExcluded, display: 'Chưa bắt đầu', label: '', expired: false, isToday: false };
      }
      if (eventDate.getTime() === today.getTime()) {
        return { days: 0, calendarDays: 0, hasExcluded, display: 'Hôm nay', label: 'bắt đầu hôm nay', expired: false, isToday: true };
      }
      const calendarDays = diffCalendarDays(eventDate, today);
      const days = countedDaysBetween(eventDate, today, excluded);
      return {
        days, calendarDays, hasExcluded,
        display: hasExcluded ? `${days} ngày tính` : formatCalendarBreakdown(calendarBreakdown(eventDate, today)),
        label: 'đã trải qua', expired: false, isToday: false
      };
    }
  }

  getPinnedEvent() {
    const visible = this.events.filter(e => !e.hidden);
    if (this.pinnedId) {
      const pinned = visible.find(e => e.id === this.pinnedId);
      if (pinned) return pinned;
    }
    // Fallback: nearest upcoming countdown, else the first visible event.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = visible
      .filter(e => e.type === 'countdown' && parseCalendarDate(e.date) >= today)
      .sort((a, b) => parseCalendarDate(a.date) - parseCalendarDate(b.date));
    return upcoming[0] || visible[0] || null;
  }

  // ── Pinned hero + live timer ────────────────────────────────────────────

  renderHero() {
    const empty = document.getElementById('heroEmpty');
    const body = document.getElementById('heroBody');
    const event = this.getPinnedEvent();
    if (!event) {
      empty.style.display = 'block';
      body.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    body.style.display = 'block';
    document.getElementById('heroName').textContent =
      `${event.type === 'countdown' ? '🎯' : '📅'} ${event.name}`;
    document.getElementById('heroEditBtn').dataset.eventId = event.id;
    this.tickHero();
  }

  tickHero() {
    const event = this.getPinnedEvent();
    if (!event) return;
    const now = new Date();
    const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const counter = this.getEventCounter(event);
    const big = document.getElementById('heroBig');
    const live = document.getElementById('heroLive');
    const bar = document.getElementById('heroBar');
    const progLeft = document.getElementById('heroProgLeft');
    const progRight = document.getElementById('heroProgRight');
    const meta = document.getElementById('heroMeta');
    if (!big || !live) return;

    if (event.type === 'countdown') {
      delete progLeft._dateContent;
      const target = parseDateTime(event.date, event.time);
      const start = event.createdAt ? new Date(event.createdAt) : todayMid;
      start.setHours(0, 0, 0, 0);
      big.textContent = counter.display;
      if (counter.expired) {
        live.textContent = 'Đã kết thúc';
        bar.style.width = '100%';
        progLeft.textContent = counter.label || '';
        progRight.textContent = '100%';
      } else if (counter.isToday) {
        const liveVal = liveCountdown(target, now);
        live.textContent = liveVal.expired ? 'Hôm nay' : formatLive(liveVal, 'Còn');
        const pct = countdownProgress(start, target, now);
        bar.style.width = pct + '%';
        progLeft.textContent = 'Đã qua ' + formatCalendarBreakdown(calendarBreakdown(start, todayMid));
        progRight.textContent = pct + '%';
      } else {
        const liveVal = liveCountdown(target, now);
        live.textContent = liveVal.expired ? counter.display : formatLive(liveVal, 'Còn');
        const pct = countdownProgress(start, target, now);
        bar.style.width = pct + '%';
        progLeft.textContent = 'Đã qua ' + formatCalendarBreakdown(calendarBreakdown(start, todayMid));
        progRight.textContent = pct + '%';
      }
      this.setStableDateContent(meta, `Đến ngày: ${this.calendarDateLink(event.date)}${event.time ? ' lúc ' + this.escapeHtml(event.time) : ''} • Tính từ: ${this.calendarDateLink(localDateKey(start))}`);
    } else {
      const start = parseDateTime(event.date, event.time);
      const liveVal = liveCountup(start, now);
      big.textContent = counter.display;
      live.textContent = counter.isToday ? 'Hôm nay' : formatLive(liveVal, 'Đã qua');
      const prog = countupProgress(start, now);
      bar.style.width = prog.pct + '%';
      this.setStableDateContent(progLeft, 'Tiến tới kỷ niệm tiếp theo: ' + this.calendarDateLink(localDateKey(prog.next)));
      progRight.textContent = prog.pct + '%';
      this.setStableDateContent(meta, `Từ ngày: ${this.calendarDateLink(event.date)}${event.time ? ' lúc ' + this.escapeHtml(event.time) : ''} • Kỷ niệm tiếp theo: ${this.calendarDateLink(localDateKey(prog.next))}`);
    }
  }

  // ── Rendering: events ───────────────────────────────────────────────────

  visibleEvents() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.events.filter(e => {
      if (e.hidden) return false;
      if (this.filter !== 'all' && e.type !== this.filter) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  renderEvents() {
    const list = document.getElementById('eventsList');
    const empty = document.getElementById('emptyState');
    const shown = this.visibleEvents();

    if (this.events.filter(e => !e.hidden).length === 0) {
      list.style.display = 'none';
      empty.style.display = 'flex';
      const h3 = empty.querySelector('h3');
      const p = empty.querySelector('p');
      if (h3) h3.textContent = 'Chưa có sự kiện nào';
      if (p) p.textContent = 'Nhấn nút bên dưới để thêm sự kiện đầu tiên';
      return;
    }
    if (shown.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'flex';
      const h3 = empty.querySelector('h3');
      const p = empty.querySelector('p');
      if (h3) h3.textContent = 'Không tìm thấy sự kiện phù hợp';
      if (p) p.textContent = 'Thử đổi từ khóa tìm kiếm hoặc bộ lọc.';
      return;
    }
    const h3 = empty.querySelector('h3');
    const p = empty.querySelector('p');
    if (h3) h3.textContent = 'Chưa có sự kiện nào';
    if (p) p.textContent = 'Nhấn nút bên dưới để thêm sự kiện đầu tiên';
    list.style.display = 'grid';
    empty.style.display = 'none';

    list.innerHTML = shown.map(event => {
      const counter = this.getEventCounter(event);
      const isDown = event.type === 'countdown';
      const icon = isDown ? '🎯' : '📅';
      const dateLabel = isDown ? 'Đến ngày' : 'Từ ngày';
      const accent = isDown ? 'card-countdown' : 'card-countup';
      const excText = this.formatExcludedDays(event.excludedDays);
      const isPinned = this.pinnedId === event.id || this.getPinnedEvent() === event;

      return `
        <div class="event-card ${accent} ${counter.expired ? 'card-expired' : ''} ${isPinned ? 'card-pinned' : ''}" data-event-id="${event.id}">
          <div class="card-top">
            <span class="card-icon">${icon}</span>
            <span class="card-name">${this.escapeHtml(event.name)}</span>
            <div class="card-actions">
              <button class="action-btn pin-btn" data-event-id="${event.id}" title="Ghim lên trên" aria-label="Ghim lên trên">${actionIcon('pin')}</button>
              <button class="action-btn edit-btn" data-event-id="${event.id}" title="Chỉnh sửa" aria-label="Chỉnh sửa">${actionIcon('edit')}</button>
              <button class="action-btn delete-btn" data-event-id="${event.id}" title="Xóa" aria-label="Xóa">${actionIcon('delete')}</button>
              ${counter.expired ? `<button class="action-btn hide-btn" data-event-id="${event.id}" title="Ẩn sự kiện đã qua" aria-label="Ẩn sự kiện đã qua">${actionIcon('hide')}</button>` : ''}
            </div>
          </div>
          ${isPinned ? '<div class="pin-badge">📌 ĐANG GHIM — bấm thẻ khác để đổi ghim</div>' : ''}

          <div class="card-time ${counter.expired ? 'time-expired' : ''}">
            <span class="time-display">${counter.display}</span>
            ${counter.label ? `<span class="time-label">${counter.label}</span>` : ''}
          </div>

          <div class="card-meta">
            <span class="meta-date">${dateLabel}: ${this.calendarDateLink(event.date)}${event.time ? ' lúc ' + this.escapeHtml(event.time) : ''}</span>
            ${excText ? `<span class="meta-excl">${excText}</span>` : ''}
            ${counter.hasExcluded && counter.calendarDays !== counter.days ? `<span class="meta-calendar">Lịch: ${counter.calendarDays} ngày</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  renderHidden() {
    const section = document.getElementById('hiddenSection');
    const title = document.getElementById('hiddenTitle');
    const list = document.getElementById('hiddenList');
    const hidden = this.events.filter(e => e.hidden);
    if (hidden.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    title.textContent = `🙈 Sự kiện đã ẩn (${hidden.length})`;
    list.innerHTML = hidden.map(event => `
      <div class="hidden-item">
        <span class="hidden-name">${this.escapeHtml(event.name)}</span>
        <span class="hidden-date">${this.calendarDateLink(event.date)}</span>
        <button class="btn-small" data-unhide-id="${event.id}">Hiện lại</button>
      </div>
    `).join('');
  }

  // ── Rendering: calendar ─────────────────────────────────────────────────

  renderCalendar() {
    const title = document.getElementById('calTitle');
    const grid = document.getElementById('calGrid');
    const selectedBox = document.getElementById('calSelected');
    const dateInput = document.getElementById('calDateInput');
    if (!title || !grid) return;

    title.textContent = `Tháng ${this.calMonth + 1}/${this.calYear}`;
    const today = new Date();
    const cells = buildMonthCells(this.calYear, this.calMonth, today);
    const selectedKey = localDateKey(this.selectedDate);
    const eventByDate = {};
    this.events.forEach(e => {
      if (!eventByDate[e.date]) eventByDate[e.date] = [];
      eventByDate[e.date].push(e);
    });

    let html = '';
    for (let r = 0; r < cells.length / 7; r++) {
      html += '<tr>';
      for (let c = 0; c < 7; c++) {
        const cell = cells[r * 7 + c];
        const key = localDateKey(cell.date);
        const cls = [
          cell.isCurrentMonth ? '' : 'cal-muted',
          cell.isToday ? 'cal-today' : '',
          key === selectedKey ? 'cal-selected-cell' : ''
        ].join(' ');
        const lunar = cell.lunar;
        const lunarText = lunar ? (lunar.isLeap ? lunar.day + 'n' : lunar.day) : '';
        const dayEvents = eventByDate[key] || [];
        html += `<td class="${cls}" data-cal-date="${key}" tabindex="-1" aria-label="${this.formatDate(key)}" title="${this.escapeHtml(dayEvents.map(e => e.name).join(', '))}">
          <span class="cal-solar">${cell.solarDay}</span>
          <span class="cal-lunar">${lunarText}</span>
          ${dayEvents.length ? '<span class="cal-dot" title="' + dayEvents.length + ' sự kiện"></span>' : ''}
        </td>`;
      }
      html += '</tr>';
    }
    grid.innerHTML = html;

    if (dateInput && !this.calendarInputDirty && document.activeElement !== dateInput) {
      dateInput.value = dateInputValue(this.selectedDate);
    }
    const lunar = convertSolarToLunar(this.selectedDate);
    const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][this.selectedDate.getDay()];
    const dayEvents = eventByDate[selectedKey] || [];
    selectedBox.innerHTML =
      `<b>${weekday}, ${this.formatDate(selectedKey)}</b><br>` +
      (lunar ? `Âm lịch: ${formatLunar(lunar)} • Năm ${lunar.canChi} (năm con ${lunar.animal})` : 'Âm lịch: —') +
      (dayEvents.length ? `<br>📌 ${dayEvents.map(e => this.escapeHtml(e.name)).join(', ')}` : '');
  }

  resetCalendarInput() {
    this.calendarInputDirty = false;
    const input = document.getElementById('calDateInput');
    input.value = dateInputValue(this.selectedDate);
    input.setCustomValidity('');
  }

  calendarDateLink(dateStr) {
    const date = parseCalendarDate(dateStr);
    if (!date) return '';
    const label = this.formatDate(dateStr);
    return `<span class="date-milestone">${label}<button type="button" class="date-jump-btn" data-calendar-jump="${localDateKey(date)}" title="Xem ngày ${label} trên lịch" aria-label="Xem ngày ${label} trên lịch"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg></button></span>`;
  }

  setStableDateContent(element, html) {
    if (element.innerHTML !== html && element._dateContent !== html) element.innerHTML = html;
    element._dateContent = html;
  }

  jumpToCalendar(dateStr) {
    const date = parseCalendarDate(dateStr);
    if (!date) return;
    this.selectedDate = date;
    this.calYear = date.getFullYear();
    this.calMonth = date.getMonth();
    this.resetCalendarInput();
    this.renderCalendar();
    const cell = document.querySelector(`[data-cal-date="${localDateKey(date)}"]`);
    if (!cell) return;
    cell.focus({ preventScroll: true });
    const rect = cell.getBoundingClientRect();
    if (window.matchMedia('(max-width: 1099px)').matches &&
        (rect.top < 0 || rect.bottom > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth)) {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  formatDate(dateStr) {
    const date = parseCalendarDate(dateStr);
    return date ? dateInputValue(date) : '';
  }

  formatExcludedDays(excludedDays) {
    if (!excludedDays || excludedDays.length === 0) return '';
    const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return 'Bỏ: ' + excludedDays.map(d => names[d]).join(', ');
  }

  escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Theme ───────────────────────────────────────────────────────────────

  setupTheme() {
    this.applyTheme();
    document.getElementById('themeToggle').addEventListener('click', () => {
      const themes = ['auto', 'light', 'dark'];
      this.currentTheme = themes[(themes.indexOf(this.currentTheme) + 1) % themes.length];
      this.applyTheme();
      this.saveData();
    });
  }

  applyTheme() {
    const icons = { dark: '☀️', light: '🌙', auto: '🌓' };
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme',
      this.currentTheme === 'auto' ? (prefersDark ? 'dark' : 'light') : this.currentTheme
    );
    document.querySelector('.theme-icon').textContent = icons[this.currentTheme];
  }

  // ── Modal ───────────────────────────────────────────────────────────────

  showModal(title = 'Tạo sự kiện mới') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('eventModal').classList.add('show');
    document.getElementById('eventName').focus();
  }

  hideModal() {
    document.getElementById('eventModal').classList.remove('show');
    document.getElementById('eventForm').reset();
    document.querySelector('input[name="eventType"][value="countdown"]').checked = true;
    document.getElementById('eventDate').setCustomValidity('');
    this.editingEventId = null;
  }

  populateForm(event) {
    document.getElementById('eventName').value = event.name;
    document.querySelector(`input[name="eventType"][value="${event.type}"]`).checked = true;
    document.getElementById('eventDate').value = dateInputValue(parseCalendarDate(event.date));
    document.getElementById('eventTime').value = event.time || '';
    document.querySelectorAll('input[name="excludedDays"]').forEach(cb => cb.checked = false);
    (event.excludedDays || []).forEach(d => {
      const cb = document.querySelector(`input[name="excludedDays"][value="${d}"]`);
      if (cb) cb.checked = true;
    });
  }

  // ── Event Listeners ─────────────────────────────────────────────────────

  setupEventListeners() {
    document.getElementById('addEventBtn').addEventListener('click', () => this.showModal());
    document.getElementById('backBtn').addEventListener('click', () => this.hideModal());
    document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());

    document.getElementById('eventForm').addEventListener('submit', e => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    document.getElementById('searchInput').addEventListener('input', e => {
      this.searchQuery = e.target.value;
      this.renderEvents();
    });

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        this.filter = chip.dataset.filter;
        this.renderEvents();
      });
    });

    document.getElementById('heroEditBtn').innerHTML = actionIcon('edit');
    document.getElementById('heroUnpinBtn').innerHTML = actionIcon('unpin');
    // Capture date jumps before event-card pinning can receive the click.
    document.addEventListener('click', e => {
      const button = e.target.closest('[data-calendar-jump]');
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      this.jumpToCalendar(button.dataset.calendarJump);
    }, true);
    document.getElementById('heroEditBtn').addEventListener('click', e => {
      const event = this.getPinnedEvent();
      if (event) this.editEvent(event.id);
    });
    document.getElementById('heroUnpinBtn').addEventListener('click', () => this.unpinEvent());

    // Calendar navigation / jump / select
    document.getElementById('calPrevBtn').addEventListener('click', () => {
      if (this.calYear === 100 && this.calMonth === 0) return;
      this.calMonth--;
      if (this.calMonth < 0) { this.calMonth = 11; this.calYear--; }
      this.renderCalendar();
    });
    document.getElementById('calNextBtn').addEventListener('click', () => {
      if (this.calYear === 9999 && this.calMonth === 11) return;
      this.calMonth++;
      if (this.calMonth > 11) { this.calMonth = 0; this.calYear++; }
      this.renderCalendar();
    });
    document.getElementById('calTodayBtn').addEventListener('click', () => {
      const today = new Date();
      this.calYear = today.getFullYear();
      this.calMonth = today.getMonth();
      this.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      this.resetCalendarInput();
      this.renderCalendar();
    });
    const calendarInput = document.getElementById('calDateInput');
    calendarInput.addEventListener('input', () => {
      this.calendarInputDirty = true;
      calendarInput.setCustomValidity('');
    });
    const goToDateInput = () => {
      const date = parseCalendarDate(calendarInput.value);
      if (!date) {
        calendarInput.setCustomValidity('Nhập ngày hợp lệ theo dd/mm/yyyy (năm 0100–9999).');
        calendarInput.reportValidity();
        return;
      }
      this.selectedDate = date;
      this.calYear = date.getFullYear();
      this.calMonth = date.getMonth();
      this.resetCalendarInput();
      this.renderCalendar();
    };
    document.getElementById('calGoBtn').addEventListener('click', goToDateInput);
    calendarInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); goToDateInput(); }
    });
    document.getElementById('eventDate').addEventListener('input', e => e.target.setCustomValidity(''));
    document.getElementById('calGrid').addEventListener('click', e => {
      const cell = e.target.closest('[data-cal-date]');
      if (!cell) return;
      const date = parseCalendarDate(cell.dataset.calDate);
      if (!date) return;
      this.selectedDate = date;
      this.calYear = date.getFullYear();
      this.calMonth = date.getMonth();
      this.resetCalendarInput();
      this.renderCalendar();
    });

    document.getElementById('eventsList').addEventListener('click', e => {
      const pinBtn = e.target.closest('.pin-btn');
      const editBtn = e.target.closest('.edit-btn');
      const deleteBtn = e.target.closest('.delete-btn');
      const hideBtn = e.target.closest('.hide-btn');
      const card = e.target.closest('.event-card');
      if (pinBtn) { this.pinEvent(pinBtn.dataset.eventId); return; }
      if (editBtn) { this.editEvent(editBtn.dataset.eventId); return; }
      if (deleteBtn) { this.confirmDelete(deleteBtn.dataset.eventId); return; }
      if (hideBtn) { this.hideEvent(hideBtn.dataset.eventId); return; }
      if (card) this.pinEvent(card.dataset.eventId);
    });

    document.getElementById('hiddenList').addEventListener('click', e => {
      const btn = e.target.closest('[data-unhide-id]');
      if (btn) this.unhideEvent(btn.dataset.unhideId);
    });

    document.getElementById('eventModal').addEventListener('click', e => {
      if (e.target.id === 'eventModal') this.hideModal();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.hideModal();
    });
  }

  handleFormSubmit() {
    const form = document.getElementById('eventForm');
    const fd = new FormData(form);
    const name = (fd.get('eventName') || '').trim();
    const type = fd.get('eventType') || 'countdown';
    const dateValue = fd.get('eventDate') || '';
    const sel = parseCalendarDate(dateValue);
    const dateInput = document.getElementById('eventDate');
    const time = fd.get('eventTime') || '';

    if (!name) { alert('Vui lòng nhập tên sự kiện'); return; }
    if (!sel) {
      dateInput.setCustomValidity('Nhập ngày hợp lệ theo dd/mm/yyyy (năm 0100–9999).');
      dateInput.reportValidity();
      return;
    }
    dateInput.setCustomValidity('');
    const date = localDateKey(sel);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (type === 'countdown' && sel < today) {
      alert('Ngày đếm ngược phải là ngày trong tương lai'); return;
    }
    if (type === 'countup' && sel > today) {
      alert('Ngày đếm từ phải là ngày trong quá khứ hoặc hôm nay'); return;
    }

    const eventData = {
      name, type, date, time,
      excludedDays: fd.getAll('excludedDays').map(Number)
    };

    if (this.editingEventId) this.updateEvent(this.editingEventId, eventData);
    else this.addEvent(eventData);

    this.hideModal();
  }

  editEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      this.editingEventId = eventId;
      this.showModal('Chỉnh sửa sự kiện');
      this.populateForm(event);
    }
  }

  confirmDelete(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (event && confirm(`Xóa sự kiện "${event.name}"?`)) this.deleteEvent(eventId);
  }
}

document.addEventListener('DOMContentLoaded', () => new TimeCounter());
