// Phiên bản: AutoUpdateTOC_v1
// Tính năng: Tự động cập nhật mục lục khi người dùng gửi tin nhắn và AI trả lời
(function () {
  "use strict";

  const panelId = "chatgpt-toc-panel";
  const toggleId = "chatgpt-toc-toggle";
  const resizeHandleId = "chatgpt-toc-resize";
  const dragHandleId = "chatgpt-toc-drag";
  const dragHandleBottomId = "chatgpt-toc-drag-bottom";
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

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const colors = {
    bg: isDark ? "#1e1e1e" : "#ffffff",
    text: isDark ? "#eee" : "#111",
    border: isDark ? "#555" : "#ccc",
    active: isDark ? "#444" : "#ddd",
    highlight: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
  };

  let panelWidth, panelTop, panelHeight, panelBottom;

  chrome.storage.sync.get(["chatgpt-toc-panel-width", "chatgpt-toc-panel-top", "chatgpt-toc-panel-height"], (result) => {
    panelWidth = parseInt(result["chatgpt-toc-panel-width"]) || 400;
    panelTop = parseInt(result["chatgpt-toc-panel-top"]) || 57;
    panelHeight = parseInt(result["chatgpt-toc-panel-height"]) || null;
    panelBottom = panelHeight ? (panelTop + panelHeight) : window.innerHeight;
    createTOC();
  });

  function createTOC() {
    removeOld();

    const panel = document.createElement("div");
    panel.id = panelId;
	panel.style.fontSize = "12px"; // Font nhỏ gọn cho toàn bộ nội dung panel TOC

    panel.style.top = `${panelTop}px`;
    panel.style.right = `-${panelWidth}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;

    const resizeHandle = document.createElement("div");
    resizeHandle.id = resizeHandleId;
    resizeHandle.style.top = `${panelTop}px`;
    resizeHandle.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;
    resizeHandle.style.right = `-3px`;

    const dragHandle = document.createElement("div");
    dragHandle.id = dragHandleId;

    const dragHandleBottom = document.createElement("div");
    dragHandleBottom.id = dragHandleBottomId;

    const toggle = document.createElement("button");
    toggle.id = toggleId;
    toggle.textContent = "TOC";
    toggle.style.top = `${panelTop + (panelHeight ? panelHeight : window.innerHeight - panelTop) / 2}px`;
    toggle.style.right = "0px";

    panel.appendChild(resizeHandle);
    panel.appendChild(dragHandle);
    panel.appendChild(dragHandleBottom);
    document.body.appendChild(toggle);

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
    btnUser.style.fontSize = "15px";   // Nút nổi bật, dễ nhìn
    btnAI.style.fontSize = "15px";
    btnRefresh.style.fontSize = "16px";

    tdUser.appendChild(btnUser);
    tdRefresh.appendChild(btnRefresh);
    tdAI.appendChild(btnAI);
    tabRow.appendChild(tdUser);
    tabRow.appendChild(tdRefresh);
    tabRow.appendChild(tdAI);
    tabTable.appendChild(tabRow);
    panel.appendChild(tabTable);

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

    function buildTOC() {
      containerUser.innerHTML = "";
      containerAI.innerHTML = "";
      linksMap.clear();
      let turn = 0;
      const blocks = document.querySelectorAll('[data-message-author-role]');
      lastMessageCount = blocks.length;

      let assistantContent = "";
      blocks.forEach((block) => {
        const role = block.getAttribute("data-message-author-role");
        const content = block.querySelector(".markdown");
        turn++;
        if (role === "user") {
          const id = `toc-user-${turn}`;
          block.id = id; // Gán id trực tiếp vào block
          const text = block.innerText.trim().split("\n")[0].slice(0, 100) || "(...)";
          const link = document.createElement("a");
          link.href = "#" + id;
          link.textContent = `💬 ${text}`;
		  link.style.fontSize = "14px"; // Chữ nhỏ cho mục lục người dùng
          containerUser.appendChild(link);
          linksMap.set(block, { link, position: block.offsetTop });

          link.addEventListener('click', (e) => {
            e.preventDefault();
            linksMap.forEach(item => item.link.style.background = "none");
            link.style.background = colors.highlight;
            document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
          });
        }
        if (role === "assistant" && content) {
          assistantContent += content.innerText;
          const headers = content.querySelectorAll("h1,h2,h3");
          headers.forEach((header, i) => {
            const id = `toc-ai-${turn}-${i}`;
            header.id = id; // Gán id trực tiếp vào header
            const link = document.createElement("a");
            link.href = "#" + id;
            link.textContent = `📌 ${header.textContent}`;
			link.style.fontSize = "14px"; // Chữ nhỏ cho mục lục AI trả lời
            containerAI.appendChild(link);
            linksMap.set(header, { link, position: header.offsetTop });

            link.addEventListener('click', (e) => {
              e.preventDefault();
              linksMap.forEach(item => item.link.style.background = "none");
              link.style.background = colors.highlight;
              document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
            });
          });
        }
      });
      lastAssistantContent = assistantContent;
      setupScrollSync();
    }

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
    btnRefresh.onclick = () => {
      buildTOC();
      setupScrollSync();
    };

    // Hàm xử lý ẩn/hiện TOC
    function toggleTOC() {
      const open = panel.style.right === "0px";
      if (open) {
        panel.style.right = `-${panelWidth}px`;
        resizeHandle.style.right = `-${3 + panelWidth}px`;
        toggle.style.right = "0px";
      } else {
        panel.style.right = "0px";
        resizeHandle.style.right = `${panelWidth}px`;
        toggle.style.right = `${panelWidth + 3}px`;
      }
    }

    toggle.onmouseover = () => {
      toggle.style.opacity = "1";
      toggle.style.boxShadow = "0 0 10px rgba(255,255,255,0.5)";
    };
    toggle.onmouseout = () => {
      toggle.style.opacity = "0.5";
      toggle.style.boxShadow = "none";
    };
    toggle.onclick = toggleTOC;

    // Thêm phím tắt ALT + S
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        toggleTOC();
      }
    });

    let isResizing = false;
    resizeHandle.onmousedown = () => {
      isResizing = true;
      document.body.style.userSelect = "none";
    };

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
        toggle.style.top = `${newTop + newHeight / 2}px`;
      } else if (isDraggingBottom) {
        const maxHeight = window.innerHeight * 0.95;
        const newHeight = Math.max(200, Math.min(maxHeight - panelTop, e.clientY - panelTop));
        panelHeight = newHeight;
        panelBottom = panelTop + newHeight;
        panel.style.height = `${newHeight}px`;
        resizeHandle.style.height = `${newHeight}px`;
        toggle.style.top = `${panelTop + newHeight / 2}px`;
      } else if (isResizing) {
        const newWidth = Math.max(200, Math.min(800, window.innerWidth - e.clientX));
        panelWidth = newWidth;
        panel.style.width = `${newWidth}px`;
        const isOpen = panel.style.right === "0px";
        resizeHandle.style.right = isOpen ? `${newWidth}px` : `-${newWidth + 3}px`;
        toggle.style.right = isOpen ? `${newWidth + 3}px` : `0px`;
      }
    };

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

    document.body.appendChild(panel);

    const observer = new MutationObserver((mutations, obs) => {
      const chatContainer = document.querySelector('[data-message-author-role]');
      if (chatContainer) {
        panel.style.right = "0px";
        resizeHandle.style.right = `${panelWidth}px`;
        toggle.style.right = `${panelWidth + 3}px`;
        buildTOC();

        // Tự động cập nhật TOC khi có tin nhắn mới
        setInterval(() => {
          const currentMessageCount = document.querySelectorAll('[data-message-author-role]').length;
          let currentAssistantContent = "";
          document.querySelectorAll('[data-message-author-role="assistant"] .markdown').forEach((content) => {
            currentAssistantContent += content.innerText;
          });

          if (currentMessageCount !== lastMessageCount || currentAssistantContent !== lastAssistantContent) {
            buildTOC();
          }
        }, 500);

        btnAI.click();
        setupScrollSync();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        removeOld();
        setTimeout(createTOC, 100);
      }
    }).observe(document, { subtree: true, childList: true });

    function setupScrollSync() {
      const chatElements = document.querySelectorAll('[data-message-author-role]');
      if (!chatElements.length || linksMap.size === 0) return;

      let chatArea = chatElements[0].parentElement;
      while (chatArea && chatArea !== document.body && getComputedStyle(chatArea).overflowY !== "auto" && getComputedStyle(chatArea).overflowY !== "scroll") {
        chatArea = chatArea.parentElement;
      }
      if (!chatArea || chatArea === document.body) {
        chatArea = document.querySelector('div[class*="react-scroll-to-bottom"]') || document.querySelector('main') || document.body;
      }

      const activeContainer = () => containerUser.style.display === "block" ? containerUser : containerAI;

      chatArea.addEventListener('scroll', () => {
        const container = activeContainer();
        if (!container || panel.style.right !== "0px" || linksMap.size === 0) return;

        const chatScrollHeight = chatArea.scrollHeight - chatArea.clientHeight;
        const chatScrollTop = chatArea.scrollTop;
        if (chatScrollHeight <= 0) return;

        const chatScrollRatio = chatScrollTop / chatScrollHeight;

        const tocScrollHeight = container.scrollHeight - container.clientHeight;
        if (tocScrollHeight <= 0) return;

        const tocScrollTarget = tocScrollHeight * chatScrollRatio;
        container.scrollTop = tocScrollTarget;
      });

      const highlightObserver = new IntersectionObserver((entries) => {
        const container = activeContainer();
        if (!container || panel.style.right !== "0px") return;

        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const chatElement = entry.target;
            const { link } = linksMap.get(chatElement) || {};
            if (link) {
              linksMap.forEach(item => item.link.style.background = "none");
              link.style.background = colors.highlight;
            }
          }
        });
      }, {
        root: chatArea,
        threshold: 0.5
      });

      linksMap.forEach((item, chatElement) => {
        highlightObserver.observe(chatElement);
      });

      btnRefresh.onclick = () => {
        highlightObserver.disconnect();
        buildTOC();
        setupScrollSync();
      };
    }
  }
})();