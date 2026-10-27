// Segmented editing for the two explicit dd/mm/yyyy fields.
// Calendar validity and committing remain the responsibility of popup.js.
(() => {
  'use strict';
  const START = [0, 3, 6];
  const WIDTH = [2, 2, 4];
  const EMPTY = ['dd', 'mm', 'yyyy'];

  function attach(input) {
    let parts = ['', '', ''];
    let active = 0;
    let editing = false;
    let rendered = null;
    let pointerFocus = false;

    function sync() {
      if (input.value === rendered) return;
      const value = input.value.trim();
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
      const local = /^([\d d]{1,2})\/([\d m]{1,2})\/([\d y]{1,4})$/i.exec(value);
      if (iso) parts = [iso[3].padStart(2, '0'), iso[2].padStart(2, '0'), iso[1]];
      else if (local) parts = local.slice(1).map(part => part.replace(/\D/g, ''));
      else parts = ['', '', ''];
      editing = false;
    }
    function draw(showEmptyMask = false) {
      rendered = !showEmptyMask && parts.every(part => !part) ? ''
        : parts.map((part, index) => part + EMPTY[index].slice(part.length)).join('/');
      input.value = rendered;
    }
    function select(index) {
      active = Math.max(0, Math.min(2, index));
      editing = false;
      input.setSelectionRange(START[active], START[active] + WIDTH[active]);
    }
    function changed() {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function segmentAt(position) {
      return position < 3 ? 0 : position < 6 ? 1 : 2;
    }
    function insert(digits) {
      sync();
      // A selection made outside this editor (for example Select All) replaces it.
      if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        parts = ['', '', ''];
        active = 0;
        editing = false;
      }
      for (const digit of digits) {
        if (!editing) parts[active] = '';
        parts[active] = (parts[active] + digit).slice(0, WIDTH[active]);
        editing = true;
        if (parts[active].length === WIDTH[active]) {
          if (active < 2) active += 1;
          editing = false;
        }
      }
      draw();
      if (editing) {
        const caret = START[active] + parts[active].length;
        input.setSelectionRange(caret, caret);
      } else input.setSelectionRange(START[active], START[active] + WIDTH[active]);
      changed();
    }
    function erase(backward) {
      sync();
      if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        parts = ['', '', ''];
        active = 0;
      } else if (editing && backward && parts[active]) {
        parts[active] = parts[active].slice(0, -1);
      } else parts[active] = '';
      draw();
      if (editing && parts[active]) {
        const caret = START[active] + parts[active].length;
        input.setSelectionRange(caret, caret);
      } else select(active);
      changed();
    }
    function paste(text) {
      const value = text.trim();
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
      const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
      if (iso || local) {
        parts = iso ? [iso[3], iso[2], iso[1]] : local.slice(1);
        parts = parts.map((part, index) => part.padStart(WIDTH[index], '0'));
        draw();
        select(2);
        changed();
      } else if (/^\d+$/.test(value)) insert(value);
      // Reject arbitrary text instead of allowing it to damage the separators.
    }

    // Pointer focus must leave the native caret alone until click has hit-tested
    // the text. Selecting day during focus overrides first-click placement.
    input.addEventListener('pointerdown', () => {
      pointerFocus = true;
      sync();
      // An empty native input has no character positions. Materialize the
      // visible placeholder before the browser performs pointer hit-testing.
      if (parts.every(part => !part)) draw(true);
    });
    input.addEventListener('pointercancel', () => { pointerFocus = false; });
    input.addEventListener('focus', () => {
      sync();
      if (!pointerFocus) { draw(true); select(0); }
    });
    input.addEventListener('click', () => {
      const position = input.selectionStart;
      pointerFocus = false;
      sync(); draw(true); select(segmentAt(position));
    });
    input.addEventListener('blur', () => {
      pointerFocus = false;
      sync();
      if (parts.every(part => !part)) input.value = rendered = '';
      editing = false;
    });
    input.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); insert(event.key); return; }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault(); erase(event.key === 'Backspace'); return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Tab') {
        const direction = event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
        if (event.key !== 'Tab' || (active + direction >= 0 && active + direction <= 2)) {
          event.preventDefault(); sync(); draw(); select(active + direction);
        }
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); sync(); draw(); select(event.key === 'Home' ? 0 : 2); return;
      }
      if (event.key === '/' || event.key === '-') {
        event.preventDefault(); sync();
        if (parts[active]) parts[active] = parts[active].padStart(WIDTH[active], '0');
        draw(); select(active + 1); changed(); return;
      }
      // Keep shortcuts, Enter, Escape, and other control keys available to the form.
      if (event.key.length === 1) event.preventDefault();
    });
    input.addEventListener('paste', event => {
      event.preventDefault(); paste(event.clipboardData.getData('text'));
    });
    input.addEventListener('cut', event => {
      event.preventDefault();
      event.clipboardData.setData('text/plain', input.value.slice(input.selectionStart, input.selectionEnd));
      erase(false);
    });
    // Virtual keyboards can emit beforeinput without a corresponding keydown.
    input.addEventListener('beforeinput', event => {
      if (event.inputType === 'insertText' || event.inputType === 'insertCompositionText') {
        event.preventDefault();
        if (/^\d+$/.test(event.data || '')) insert(event.data);
      } else if (event.inputType.startsWith('delete')) {
        event.preventDefault(); erase(event.inputType.includes('Backward'));
      } else if (event.inputType.startsWith('insert')) event.preventDefault();
    });
  }
  function initialize() {
    for (const id of ['calDateInput', 'eventDate']) {
      const input = document.getElementById(id);
      if (input) attach(input);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
