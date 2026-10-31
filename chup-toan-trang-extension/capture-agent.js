// Capture agent v2: chạy trong trang web.
// Nhiệm vụ: tìm đúng khung cuộn THẬT của trang (cửa sổ hoặc khung con như YouTube),
// cuộn từng đoạn theo yêu cầu của background, và khôi phục trang như cũ khi xong.
(() => {
  if (window.__ctp) return;

  const state = {
    scroller: null,
    isWindow: false,
    origScrollTop: 0,
    origScrollLeft: 0,
    styleEl: null,
    fixedHidden: [],
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function findScroller() {
    const se = document.scrollingElement || document.documentElement;
    const candidates = [se, document.documentElement, document.body].filter(Boolean);
    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length && candidates.length < 400; i++) {
      const el = all[i];
      if (el.scrollHeight > el.clientHeight + 20 && el.clientHeight >= 120) candidates.push(el);
    }
    let best = se;
    let bestScore = -1;
    for (const el of candidates) {
      try {
        if (el.scrollHeight <= el.clientHeight + 20) continue;
        const cs = getComputedStyle(el);
        const scrollable = el === se || cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'overlay';
        if (!scrollable) continue;
        // Ưu tiên: chiều cao nội dung lớn nhất; hoà thì ưu tiên khung cao hơn, rồi tới khung cửa sổ
        const score = el.scrollHeight * 1000 + el.clientHeight + (el === se ? 0.5 : 0);
        if (score > bestScore) { bestScore = score; best = el; }
      } catch (_) {}
    }
    return { scroller: best, isWindow: best === se };
  }

  function ensureFound() {
    if (!state.scroller) {
      const found = findScroller();
      state.scroller = found.scroller;
      state.isWindow = found.isWindow;
    }
    return state.scroller;
  }

  function currentScrollTop() {
    if (state.isWindow) return window.scrollY || state.scroller.scrollTop || 0;
    return state.scroller.scrollTop;
  }

  function doScroll(y) {
    if (state.isWindow) {
      window.scrollTo(0, y);
      if (state.scroller) state.scroller.scrollTop = y;
    } else {
      state.scroller.scrollTop = y;
    }
  }

  window.__ctp = {
    getMetrics() {
      const sc = ensureFound();
      const rect = state.isWindow
        ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
        : (() => { const r = sc.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })();
      return {
        isWindow: state.isWindow,
        totalHeight: sc.scrollHeight,
        viewHeight: state.isWindow ? window.innerHeight : sc.clientHeight,
        viewWidth: state.isWindow ? window.innerWidth : sc.clientWidth,
        rect,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        scrollTop: currentScrollTop(),
      };
    },

    async preScroll() {
      const sc = ensureFound();
      const orig = currentScrollTop();
      const step = Math.max(250, Math.floor((state.isWindow ? window.innerHeight : sc.clientHeight) * 0.9));
      let y = 0;
      for (let i = 0; i < 80; i++) {
        y += step;
        doScroll(y);
        await wait(140);
        const max = sc.scrollHeight - (state.isWindow ? window.innerHeight : sc.clientHeight);
        if (y >= max) break;
      }
      doScroll(orig);
      await wait(300);
      return true;
    },

    prepare() {
      ensureFound();
      state.origScrollTop = currentScrollTop();
      state.origScrollLeft = state.isWindow ? window.scrollX : state.scroller.scrollLeft;
      const style = document.createElement('style');
      style.id = 'ctp-hide-scrollbar';
      style.textContent =
        'html::-webkit-scrollbar, body::-webkit-scrollbar, [data-ctp-scroller]::-webkit-scrollbar { display: none !important; }' +
        'html, body, [data-ctp-scroller] { scrollbar-width: none !important; scroll-behavior: auto !important; }';
      document.documentElement.appendChild(style);
      state.styleEl = style;
      if (!state.isWindow) state.scroller.setAttribute('data-ctp-scroller', '1');
      return true;
    },

    hideFixed() {
      // Chỉ áp cho cuộn cửa sổ: ẩn các phần tử fixed/sticky (thanh menu dính) từ đoạn 2 trở đi để không lặp trong ảnh
      if (!state.isWindow) return 0;
      let count = 0;
      const els = document.querySelectorAll('body *');
      for (let i = 0; i < els.length && count < 60; i++) {
        const el = els[i];
        try {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.position === 'sticky') {
            if (el.closest('#ctp-root')) continue;
            state.fixedHidden.push([el, el.style.visibility]);
            el.style.visibility = 'hidden';
            count++;
          }
        } catch (_) {}
      }
      return count;
    },

    async scrollToPos(y) {
      ensureFound();
      doScroll(y);
      // chờ trình duyệt cuộn + vẽ xong
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await wait(90);
      return currentScrollTop();
    },

    restore() {
      try { doScroll(state.origScrollTop); } catch (_) {}
      if (state.styleEl) { state.styleEl.remove(); state.styleEl = null; }
      if (state.scroller) state.scroller.removeAttribute('data-ctp-scroller');
      for (const [el, vis] of state.fixedHidden) {
        try { el.style.visibility = vis; } catch (_) {}
      }
      state.fixedHidden = [];
      return true;
    },
  };
})();
