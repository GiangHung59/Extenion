// Time Counter — Vietnamese solar/lunar conversion (v1.2.0)
//
// Method: the browser's built-in ICU Chinese calendar, explicitly run in the
// Asia/Ho_Chi_Minh timezone. In Node/Chromium tests this reproduces the
// Vietnamese anchors exactly, including:
//   Tet 2026: 2026-02-17 = 1/1 lunar, Tet 2024: 2024-02-10 = 1/1,
//   2026-10-27 = 18/9 lunar (year Binh Ngo), 2026-10-10 = 1/9 lunar,
//   Mid-Autumn 2025: 2025-10-06 = 15/8, 2024: 2024-09-17 = 15/8.
// ICU also marks leap months as "6bis", "2bis", etc., which we parse into
// isLeap. Limitation to be honest about: the Vietnamese and Chinese lunar
// calendars share the same rules but use different meridians (UTC+7 vs
// UTC+8), so on the rare date where a new moon falls very close to midnight
// the two can differ by one day. For ordinary use the values above match.
//
// All functions are pure and dependency-free, so they are unit-testable in
// Node. No network, no storage.

'use strict';

var LUNAR_CANS = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
var LUNAR_CHIS = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

var LUNAR_ANIMALS = ['Chuột', 'Trâu', 'Hổ', 'Mèo', 'Rồng', 'Rắn', 'Ngựa', 'Dê', 'Khỉ', 'Gà', 'Chó', 'Lợn'];

function lunarYearAnimal(lunarYear) {
  return LUNAR_ANIMALS[((lunarYear + 8) % 12 + 12) % 12];
}

function lunarYearCanChi(lunarYear) {
  var can = LUNAR_CANS[((lunarYear + 6) % 10 + 10) % 10];
  var chi = LUNAR_CHIS[((lunarYear + 8) % 12 + 12) % 12];
  return can + ' ' + chi;
}

// date: a Date (time ignored, local calendar day is used).
// Returns { day, month, year, isLeap, canChi } or null if Intl is unavailable.
function convertSolarToLunar(date) {
  try {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    var parts = new Intl.DateTimeFormat('en-u-ca-chinese', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh'
    }).formatToParts(d);
    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    var monthRaw = String(out.month || '');
    var isLeap = /bis$/.test(monthRaw);
    var month = parseInt(monthRaw.replace(/[^0-9]/g, ''), 10);
    var year = parseInt(out.relatedYear || out.year, 10);
    if (!month || !year) return null;
    return {
      day: parseInt(out.day, 10),
      month: month,
      year: year,
      isLeap: isLeap,
      canChi: lunarYearCanChi(year),
      animal: lunarYearAnimal(year)
    };
  } catch (e) {
    return null;
  }
}

function formatLunar(lunar) {
  if (!lunar) return '';
  return lunar.day + '/' + lunar.month + (lunar.isLeap ? ' nhuận' : '') + ' âm lịch';
}

function localDateKey(date) {
  var m = date.getMonth() + 1, d = date.getDate();
  return String(date.getFullYear()).padStart(4, '0') + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
}

// Build one month's calendar cells, week starting Monday.
// Returns [{ date, solarDay, lunar, isCurrentMonth, isToday }] in grid order.
// today: optional Date used for the isToday flag (defaults to real today).
function buildMonthCells(year, month, today) {
  var first = new Date(year, month, 1);
  var offset = (first.getDay() + 6) % 7; // Monday = 0
  var total = 42;
  var todayKey = today ? localDateKey(today) : null;
  var cells = [];
  for (var i = 0; i < total; i++) {
    var date = new Date(year, month, 1 - offset + i);
    cells.push({
      date: date,
      solarDay: date.getDate(),
      lunar: convertSolarToLunar(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: todayKey !== null && localDateKey(date) === todayKey
    });
  }
  return cells;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lunarYearCanChi: lunarYearCanChi,
    lunarYearAnimal: lunarYearAnimal,
    convertSolarToLunar: convertSolarToLunar,
    formatLunar: formatLunar,
    localDateKey: localDateKey,
    buildMonthCells: buildMonthCells
  };
}
