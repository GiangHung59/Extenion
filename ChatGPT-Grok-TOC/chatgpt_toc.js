// chatgpt_toc.js - Mã nguồn cho tiện ích TOC trên ChatGPT
(function () {
  "use strict";

  // Các ID cho các phần tử DOM
  const panelId = "chatgpt-toc-panel";
  const toggleId = "chatgpt-toc-toggle";
  const resizeHandleId = "chatgpt-toc-resize";
  const dragHandleId = "chatgpt-toc-drag";
  const dragHandleBottomId = "chatgpt-toc-drag-bottom";
  
  // Xóa các phần tử cũ nếu có
  const removeOld = () => {
    const oldPanel = document.getElementById(panelId);
    const oldToggle = document.getElementById(toggleId);
    const oldResize = document.getElementById(resizeHandleId);
    const oldDrag = document.getElementById(dragHandleId);
    const oldDragBottom = document.getElementById(dragHandleBottomId);
    if (oldPanel) oldPanel.remove();
    if (oldToggle) oldToggle.remove();
    if (oldResize) oldResize.remove();
    if (oldDrag) oldDrag.remove();
    if (oldDragBottom) oldDragBottom.remove();
  };

  // Lấy chế độ màu và thiết lập màu sắc
  const isDark = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;

  const colors = {
    bg: isDark ? "#1e1e1e" : "#ffffff",
    text: isDark ? "#eee" : "#111",
    border: isDark ? "#555" : "#ccc",
    active: isDark ? "#444" : "#ddd",
    highlight: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
  };

  // Các biến lưu trạng thái và kích thước panel
  let panelWidth, panelTop, panelHeight, panelBottom;
  let isPanelOpen = false;
  let isRefreshing = false;

  // Lấy cài đặt từ storage
  chrome.storage.sync.get([
    "chatgpt-toc-panel-width",
    "chatgpt-toc-panel-top",
    "chatgpt-toc-panel-height",
    "chatgpt-toc-panel-open"
  ], (result) => {
    panelWidth = parseInt(result["chatgpt-toc-panel-width"]) || 400;
    panelTop = parseInt(result["chatgpt-toc-panel-top"]) || 57;
    panelHeight = parseInt(result["chatgpt-toc-panel-height"]) || null;
    panelBottom = panelHeight ? (panelTop + panelHeight) : window.innerHeight;
    isPanelOpen = result["chatgpt-toc-panel-open"] || false;
    createTOC();
  });

  function createTOC() {
    removeOld();

    // Tạo panel chính
    const panel = document.createElement("div");
    panel.id = panelId;
    panel.style.fontSize = "12px";
    panel.style.top = `${panelTop}px`;
    panel.style.right = isPanelOpen ? "0px" : `-${panelWidth}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;

    // Tạo thanh resize
    const resizeHandle = document.createElement("div");
    resizeHandle.id = resizeHandleId;
    resizeHandle.style.top = `${panelTop}px`;
    resizeHandle.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;
    resizeHandle.style.right = isPanelOpen ? `${panelWidth}px` : `-${3 + panelWidth}px`;

    // Tạo thanh kéo thả
    const dragHandle = document.createElement("div");
    dragHandle.id = dragHandleId;

    const dragHandleBottom = document.createElement("div");
    dragHandleBottom.id = dragHandleBottomId;

    // Tạo nút TOC
    const toggle = document.createElement("button");
    toggle.id = toggleId;
    toggle.textContent = "TOC";
    
    // Cập nhật vị trí toggle
    const updateTogglePos = () => {
      const ph = panelHeight ? panelHeight : (window.innerHeight - panelTop);
      toggle.style.top = `${panelTop + ph / 2}px`;
      toggle.style.transform = "translateY(-50%)";
    };
    updateTogglePos();
    toggle.style.right = isPanelOpen ? `${panelWidth + 3}px` : "0px";
    toggle.style.position = "fixed";

    panel.appendChild(resizeHandle);
    panel.appendChild(dragHandle);
    panel.appendChild(dragHandleBottom);
    document.body.appendChild(toggle);

    // Tạo bảng tab
    const tabTable = document.createElement("table");
    const tabRow = document.createElement("tr");
    const tdUser = document.createElement("td");
    const tdRefresh = document.createElement("td");
    const tdAI = document.createElement("td");

    const btnUser = document.createElement("button");
    const btnRefresh = document.createElement("button");
    const btnAI = document.createElement("button");

    btnUser.textContent = "🧑‍💻 Tôi hỏi";
    btnAI.textContent = "🤖 AI trả lời";
    btnRefresh.textContent = "🔄";
    btnUser.style.fontSize = "15px";
    btnAI.style.fontSize = "15px";
    btnRefresh.style.fontSize = "16px";

    tdUser.appendChild(btnUser);
    tdRefresh.appendChild(btnRefresh);
    tdAI.appendChild(btnAI);
    tdRefresh.style.display = "none"; // Ẩn nút Refresh
    tabRow.appendChild(tdUser);
    tabRow.appendChild(tdRefresh);
    tabRow.appendChild(tdAI);
    tabTable.appendChild(tabRow);
    panel.appendChild(tabTable);

    // Tạo container cho nội dung
    const containerUser = document.createElement("div");
    const containerAI = document.createElement("div");
    containerUser.style.display = "none";
    containerAI.style.display = "none";
    containerUser.style.paddingLeft = "6px";
    containerUser.style.paddingTop = "10px";
    containerUser.style.paddingBottom = "20px";
    containerUser.style.flexGrow = "1";
    containerUser.style.overflowY = "auto";
    containerAI.style.paddingLeft = "6px";
    containerAI.style.paddingTop = "10px";
    containerAI.style.paddingBottom = "20px";
    containerAI.style.flexGrow = "1";
    containerAI.style.overflowY = "auto";
    panel.appendChild(containerUser);
    panel.appendChild(containerAI);

    let linksMap = new Map();
    let lastMessageCount = 0;
    let lastAssistantContent = "";
    let lastScrollTop = 0;

    // Xây dựng mục lục
    function buildTOC() {
      const activeContainer = containerUser.style.display === "block" ? containerUser : containerAI;
      lastScrollTop = activeContainer.scrollTop;

      containerUser.innerHTML = "";
      containerAI.innerHTML = "";
      linksMap.clear();
      let turn = 0;
      const blocks = document.querySelectorAll('[data-message-author-role]');
      lastMessageCount = blocks.length;

      isRefreshing = true;

      let assistantContent = "";
      blocks.forEach((block) => {
        const role = block.getAttribute("data-message-author-role");
        const content = block.querySelector(".markdown");
        turn++;
        if (role === "user") {
          const id = `toc-user-${turn}`;
          block.id = id;
          const text = block.innerText.trim().split("\n")[0].slice(0, 100) || "(...)";
          const link = document.createElement("a");
          link.href = "#" + id;
          link.textContent = `💬 ${text}`;
          link.style.fontSize = "14px";
          containerUser.appendChild(link);
          linksMap.set(block, { link, position: block.offsetTop });

          link.addEventListener('click', (e) => {
            e.preventDefault();
            resetLinkStyles();
            highlightLink(link);
            document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
            if (!isElementInViewport(link, activeContainer)) {
              scrollPanelToLink(link, activeContainer);
            }
          });
        }
        if (role === "assistant" && content) {
          assistantContent += content.innerText;
          const headers = content.querySelectorAll("h1,h2,h3");
          const hasH1 = content.querySelector("h1") !== null;
          const hasH2 = content.querySelector("h2") !== null;
          headers.forEach((header, i) => {
            const id = `toc-ai-${turn}-${i}`;
            header.id = id;
            const link = document.createElement("a");
            link.href = "#" + id;
            if (header.tagName === "H1") {
              link.textContent = `📌 ${header.textContent}`; // Icon ghim cho h1
              link.style.marginLeft = "0px";
            } else if (header.tagName === "H2") {
              link.textContent = `➤ ${header.textContent}`; // Icon mũi tên cho h2
              link.style.marginLeft = hasH1 ? "10px" : "0px";
            } else if (header.tagName === "H3") {
              if (!hasH1 && !hasH2) {
                link.textContent = `📌 ${header.textContent}`; // Icon ghim như h1
                link.style.marginLeft = "0px";
              } else if (!hasH1 && hasH2) {
                link.textContent = `➤ ${header.textContent}`; // Icon mũi tên như h2
                link.style.marginLeft = "10px";
              } else {
                link.textContent = `◦ ${header.textContent}`; // Icon vòng tròn cho h3
                link.style.marginLeft = "20px";
              }
            }
            link.style.fontSize = "14px";
            containerAI.appendChild(link);
            linksMap.set(header, { link, position: header.offsetTop });

            link.addEventListener('click', (e) => {
              e.preventDefault();
              resetLinkStyles();
              highlightLink(link);
              document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
              if (!isElementInViewport(link, activeContainer)) {
                scrollPanelToLink(link, activeContainer);
              }
            });
          });
        }
      });
      lastAssistantContent = assistantContent;

      activeContainer.scrollTop = lastScrollTop;

      setTimeout(() => {
        isRefreshing = false;
      }, 500);

      setupScrollSync();
    }

    // Reset style của tất cả các link
    function resetLinkStyles() {
      linksMap.forEach(item => {
        item.link.style.background = "none";
        item.link.style.border = "none";
        item.link.style.color = colors.text;
      });
    }

    // Highlight link đang active
    function highlightLink(link) {
      link.style.background = colors.highlight;
      link.style.border = `1px solid ${isDark ? "#60a5fa" : "#2563eb"}`;
      link.style.color = isDark ? "#ffffff" : "#000000";
    }

    // Cuộn panel để hiển thị link
    function scrollPanelToLink(link, container) {
      const linkRect = link.getBoundingClientRect();
      const panelRect = container.getBoundingClientRect();
      const scrollTarget = (linkRect.top - panelRect.top + container.scrollTop) - (panelRect.height / 2) + (linkRect.height / 2);
      container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }

    // Kiểm tra xem một phần tử có nằm trong viewport của container hay không
    function isElementInViewport(el, container) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
    }

    // Xử lý sự kiện click tab
    btnUser.onclick = () => {
      containerUser.style.display = "block";
      containerAI.style.display = "none";
      btnUser.style.background = colors.highlight;
      btnAI.style.background = colors.active;
    };
    btnAI.onclick = () => {
      containerUser.style.display = "none";
      containerAI.style.display = "block";
      btnUser.style.background = colors.active;
      btnAI.style.background = colors.highlight;
    };

    // Xử lý sự kiện click nút refresh
    btnRefresh.onclick = () => {
      buildTOC();
    };

    // Hàm ẩn/hiện TOC
    function toggleTOC() {
      isPanelOpen = !isPanelOpen;
      if (isPanelOpen) {
        panel.style.right = "0px";
        resizeHandle.style.right = `${panelWidth}px`;
        toggle.style.right = `${panelWidth + 3}px`;
      } else {
        panel.style.right = `-${panelWidth}px`;
        resizeHandle.style.right = `-${3 + panelWidth}px`;
        toggle.style.right = "0px";
      }
      chrome.storage.sync.set({ "chatgpt-toc-panel-open": isPanelOpen });
    }

    // Hiệu ứng hover cho nút TOC
    toggle.onmouseover = () => {
      toggle.style.opacity = "1";
      toggle.style.boxShadow = "0 0 10px rgba(255,255,255,0.5)";
    };
    toggle.onmouseout = () => {
      toggle.style.opacity = "0.5";
      toggle.style.boxShadow = "none";
    };
    toggle.onclick = toggleTOC;

    // Thiết lập phím tắt ALT+S
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleTOC();
      }
    });

    // Xử lý sự kiện resize panel
    let isResizing = false;
    resizeHandle.onmousedown = () => {
      isResizing = true;
      document.body.style.userSelect = "none";
    };

    // Xử lý sự kiện kéo thả panel
    let isDragging = false;
    dragHandle.onmousedown = () => {
      isDragging = true;
      document.body.style.userSelect = "none";
    };

    let isDraggingBottom = false;
    dragHandleBottom.onmousedown = () => {
      isDraggingBottom = true;
      document.body.style.userSelect = "none";
    };

    // Xử lý sự kiện di chuyển chuột
    document.onmousemove = (e) => {
      if (isDragging) {
        const newTop = Math.max(0, Math.min(panelBottom - 200, e.clientY));
        const newHeight = panelBottom - newTop;
        panelTop = newTop;
        panelHeight = newHeight;
        panel.style.top = `${newTop}px`;
        panel.style.height = `${newHeight}px`;
        resizeHandle.style.top = `${newTop}px`;
        resizeHandle.style.height = `${newHeight}px`;
        updateTogglePos();
      } else if (isDraggingBottom) {
        const maxHeight = window.innerHeight * 0.95;
        const newHeight = Math.max(200, Math.min(maxHeight - panelTop, e.clientY - panelTop));
        panelHeight = newHeight;
        panelBottom = panelTop + newHeight;
        panel.style.height = `${newHeight}px`;
        resizeHandle.style.height = `${newHeight}px`;
        updateTogglePos();
      } else if (isResizing) {
        const newWidth = Math.max(200, Math.min(800, window.innerWidth - e.clientX));
        panelWidth = newWidth;
        panel.style.width = `${newWidth}px`;
        const isOpen = panel.style.right === "0px";
        resizeHandle.style.right = isOpen ? `${newWidth}px` : `-${newWidth + 3}px`;
        toggle.style.right = isOpen ? `${newWidth + 3}px` : "0px";
        updateTogglePos();
      }
    };

    // Xử lý sự kiện thả chuột
    document.onmouseup = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = "";
        chrome.storage.sync.set({ "chatgpt-toc-panel-top": panelTop, "chatgpt-toc-panel-height": panelHeight });
      } else if (isDraggingBottom) {
        isDraggingBottom = false;
        document.body.style.userSelect = "";
        chrome.storage.sync.set({ "chatgpt-toc-panel-height": panelHeight });
      } else if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = "";
        chrome.storage.sync.set({ "chatgpt-toc-panel-width": panelWidth });
      }
    };

    // Cập nhật vị trí TOC khi resize window
    window.addEventListener('resize', updateTogglePos);

    document.body.appendChild(panel);

    // Thiết lập observer để theo dõi thay đổi DOM
    const observer = new MutationObserver((mutations, obs) => {
      const chatContainer = document.querySelector('[data-message-author-role]');
      if (chatContainer) {
        panel.style.right = isPanelOpen ? "0px" : `-${panelWidth}px`;
        resizeHandle.style.right = isPanelOpen ? `${panelWidth}px` : `-${3 + panelWidth}px`;
        toggle.style.right = isPanelOpen ? `${panelWidth + 3}px` : "0px";
        updateTogglePos();
        buildTOC();

        // Kiểm tra và cập nhật TOC định kỳ
        setInterval(() => {
          const currentMessageCount = document.querySelectorAll('[data-message-author-role]').length;
          let currentAssistantContent = "";
          document.querySelectorAll('[data-message-author-role="assistant"] .markdown').forEach((content) => {
            currentAssistantContent += content.innerText;
          });

          if (currentMessageCount !== lastMessageCount || currentAssistantContent !== lastAssistantContent) {
            buildTOC();
          }
        }, 2000);

        btnAI.click();
        setupScrollSync();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Theo dõi thay đổi URL
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        removeOld();
        setTimeout(createTOC, 100);
      }
    }).observe(document, { subtree: true, childList: true });

    // Thiết lập đồng bộ cuộn
    function setupScrollSync() {
      const highlightObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const target = entry.target;
            if (linksMap.has(target)) {
              resetLinkStyles();
              highlightLink(linksMap.get(target).link);
            }
          }
        });
      }, { threshold: 0.5 });

      linksMap.forEach((_, element) => {
        highlightObserver.observe(element);
      });

      return highlightObserver;
    }
  }
})();
