// Time Counter — shared date-counting logic (v1.1.1)
// Used by popup.js (classic script) and background.js (via importScripts).
// Kept dependency-free and pure so it can also be unit-tested in Node.
//
// Counting contract (fixed in v1.1.1 — the old code counted BOTH endpoints):
//  - "Calendar days" between two midnight dates = plain date subtraction.
//    Same day = 0, today -> tomorrow = 1, yesterday -> today = 1.
//  - "Counted days" with excludedDays = number of days AFTER the start date
//    up to and including the end date whose weekday is NOT excluded.
//    Example: Fri 2026-10-30 -> Mon 2026-11-02, excluding Sat+Sun = 1 counted
//    day (Monday only), while calendar days = 3. The popup shows both so an
//    excluded deadline day can never silently display as "today".
//  - Year/month breakdown is calendar-accurate, NOT total/365 and total/30.
//    It anchors on the start date's day-of-month (clamped to the target
//    month's length), so 2024-02-29 -> 2025-02-28 = 1 year, and
//    2026-01-31 -> 2026-03-31 = 2 months.

'use strict';

function toMidnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Calendar-day difference, DST-safe (uses UTC calendar fields, not ms).
function diffCalendarDays(startDate, endDate) {
  const a = toMidnight(startDate);
  const b = toMidnight(endDate);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

// Requires startDate <= endDate. Returns 0 when both are the same day.
function countedDaysBetween(startDate, endDate, excludedDays) {
  const excluded = Array.isArray(excludedDays) ? excludedDays.map(Number) : [];
  const start = toMidnight(startDate);
  const end = toMidnight(endDate);
  if (end <= start) return 0;
  if (excluded.length === 0) return diffCalendarDays(start, end);
  let total = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1); // start day itself is never counted
  while (cur <= end) {
    if (excluded.indexOf(cur.getDay()) === -1) total++;
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// start + years/months, anchored on start's day-of-month (clamped).
function addYearsMonths(from, years, months) {
  const totalMonths = from.getMonth() + months;
  const year = from.getFullYear() + years + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(from.getDate(), daysInMonth(year, month));
  return new Date(year, month, day);
}

// Requires from <= to (both treated as midnight). Returns { years, months, days }.
function calendarBreakdown(fromDate, toDate) {
  const from = toMidnight(fromDate);
  const to = toMidnight(toDate);
  if (to <= from) return { years: 0, months: 0, days: 0 };
  let years = 0;
  while (addYearsMonths(from, years + 1, 0) <= to) years++;
  let months = 0;
  while (addYearsMonths(from, years, months + 1) <= to) months++;
  const cursor = addYearsMonths(from, years, months);
  const days = diffCalendarDays(cursor, to);
  return { years: years, months: months, days: days };
}

function formatCalendarBreakdown(b) {
  if (!b || (b.years === 0 && b.months === 0 && b.days === 0)) return '0 ngày';
  const parts = [];
  if (b.years > 0) parts.push(b.years + ' năm');
  if (b.months > 0) parts.push(b.months + ' tháng');
  if (b.days > 0) parts.push(b.days + ' ngày');
  return parts.join(' ');
}

// ── Live timer + progress (v1.2.0, pinned hero) ─────────────────────────

// "2026-12-25" + "18:00" (or "") -> local Date. Empty time = midnight.
function parseDateTime(dateStr, timeStr) {
  const parts = String(dateStr).split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  if (timeStr) {
    const t = String(timeStr).split(':').map(Number);
    d.setHours(t[0] || 0, t[1] || 0, 0, 0);
  }
  return d;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// Live countdown to target: { expired, days, hours, minutes, seconds }.
function liveCountdown(target, now) {
  const ms = target - now;
  if (ms <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(ms / 86400000);
  const rem = ms % 86400000;
  return {
    expired: false, days: days,
    hours: Math.floor(rem / 3600000),
    minutes: Math.floor(rem % 3600000 / 60000),
    seconds: Math.floor(rem % 60000 / 1000)
  };
}

// Live count-up from start: same shape, never expired.
function liveCountup(start, now) {
  const ms = Math.max(0, now - start);
  const days = Math.floor(ms / 86400000);
  const rem = ms % 86400000;
  return {
    expired: false, days: days,
    hours: Math.floor(rem / 3600000),
    minutes: Math.floor(rem % 3600000 / 60000),
    seconds: Math.floor(rem % 60000 / 1000)
  };
}

function formatLive(live, verb) {
  return verb + ' ' + live.days + ' ngày ' + pad2(live.hours) + ':' + pad2(live.minutes) + ':' + pad2(live.seconds);
}

// Progress 0..100 for a countdown, from start (e.g. createdAt) to target.
function countdownProgress(start, target, now) {
  if (target <= start) return now >= target ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((now - start) / (target - start) * 100)));
}

// Same month/day anniversary of `start` in a given year (Feb 29 -> Feb 28).
function anniversaryInYear(start, year) {
  return new Date(year, start.getMonth(), Math.min(start.getDate(), daysInMonth(year, start.getMonth())));
}

// Progress 0..100 through the current anniversary year, plus next anniversary.
function countupProgress(start, now) {
  let last = anniversaryInYear(start, now.getFullYear());
  if (last > now) last = anniversaryInYear(start, now.getFullYear() - 1);
  const next = anniversaryInYear(start, last.getFullYear() + 1);
  const pct = next > last ? Math.max(0, Math.min(100, Math.round((now - last) / (next - last) * 100))) : 100;
  return { pct: pct, last: last, next: next };
}

// Node export for unit tests; harmless in the extension (module is undefined).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toMidnight: toMidnight,
    diffCalendarDays: diffCalendarDays,
    countedDaysBetween: countedDaysBetween,
    daysInMonth: daysInMonth,
    addYearsMonths: addYearsMonths,
    calendarBreakdown: calendarBreakdown,
    formatCalendarBreakdown: formatCalendarBreakdown,
    parseDateTime: parseDateTime,
    pad2: pad2,
    liveCountdown: liveCountdown,
    liveCountup: liveCountup,
    formatLive: formatLive,
    countdownProgress: countdownProgress,
    anniversaryInYear: anniversaryInYear,
    countupProgress: countupProgress
  };
}
