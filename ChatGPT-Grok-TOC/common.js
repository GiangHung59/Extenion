// common.js - Chứa các hàm tiện ích dùng chung cho cả ChatGPT và Grok TOC

/**
 * Tạo debounce function để tối ưu hiệu suất
 * @param {Function} func - Hàm cần debounce
 * @param {number} wait - Thời gian chờ (ms)
 * @returns {Function} Hàm đã được debounce
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Kiểm tra xem một phần tử có nằm trong viewport của container hay không
 * @param {Element} el - Phần tử cần kiểm tra
 * @param {Element} container - Container chứa phần tử
 * @returns {boolean} True nếu phần tử nằm trong viewport
 */
function isElementInViewport(el, container) {
  const rect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
}

/**
 * Xác định chế độ màu tối/sáng dựa trên cài đặt hệ thống
 * @returns {boolean} True nếu đang ở chế độ tối
 */
function isDarkMode() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Tạo màu sắc dựa trên chế độ tối/sáng
 * @param {boolean} isDark - Trạng thái chế độ tối
 * @returns {Object} Đối tượng chứa các màu sắc
 */
function getColors(isDark) {
  return {
    bg: isDark ? "#1e1e1e" : "#ffffff",
    panelBg: isDark ? "#1a1a1a" : "#f5f5f5",
    text: isDark ? "#eee" : "#111",
    border: isDark ? "#555" : "#ccc",
    active: isDark ? "#444" : "#ddd",
    highlight: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    tocItem: isDark ? "#60a5fa" : "#2563eb",
    tocItemSelected: isDark ? "#ffffff" : "#000000",
    toggleBg: isDark ? "#444" : "#ddd",
    toggleText: isDark ? "#fff" : "#000",
    toggleBorder: isDark ? "#666" : "#bbb",
    activeBorder: isDark ? "#60a5fa" : "#2563eb"
  };
}

/**
 * Xóa các phần tử TOC cũ khỏi DOM
 * @param {Array} elementIds - Mảng các ID phần tử cần xóa
 */
function removeOldElements(elementIds) {
  elementIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.remove();
  });
}

/**
 * Thiết lập sự kiện phím tắt ALT+S
 * @param {Function} toggleFunction - Hàm xử lý khi nhấn phím tắt
 */
function setupHotkey(toggleFunction) {
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      e.preventDefault();
      toggleFunction();
    }
  });
}

/**
 * Theo dõi thay đổi URL để tải lại TOC khi cần
 * @param {Function} reloadFunction - Hàm tải lại TOC
 */
function watchUrlChanges(reloadFunction) {
  let lastUrl = location.pathname + location.search;
  new MutationObserver(debounce(() => {
    const currentUrl = location.pathname + location.search;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      reloadFunction(true);
    }
  }, 300)).observe(document, { subtree: true, childList: true });
}
