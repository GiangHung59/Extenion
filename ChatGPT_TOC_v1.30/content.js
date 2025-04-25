// Phiên bản: AutoUpdateTOC_v9 2025-04-21 05:05:00
// Tính năng: Tự động cập nhật mục lục khi người dùng gửi tin nhắn và AI trả lời, lưu vị trí cuộn, lưu trạng thái ẩn/hiện panel trên đám mây, tô sáng mục liên quan, ẩn nút Refresh, phân cấp tiêu đề h1/h2/h3 với biểu tượng, giữ cuộn theo trang, bỏ cuộn tự động khi AI trả lời, tìm kiếm với nút xóa, cải thiện bôi đen văn bản
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

  const isDark = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;

  const colors = {
    bg: isDark ? "#1e1e1e" : "#ffffff",
    text: isDark ? "#eee" : "#111",
    border: isDark ? "#555" : "#ccc",
    active: isDark ? "#333" : "#ccc",  // Darker for inactive button
    highlight: isDark ? "#666" : "#f0f0f0",  // Brighter for active button
    activeBtn: isDark ? "#666" : "#f0f0f0",  // Brighter for active button
    inactiveBtn: isDark ? "#333" : "#ccc"    // Darker for inactive button
  };

  let panelWidth, panelTop, panelHeight, panelBottom;
  let isPanelOpen = false;
  let isRefreshing = false;
  let language = "vi"; // Default language: Vietnamese
  let theme = "auto"; // Default theme: Auto (follow browser)
  let fontSize = "medium"; // Default font size: Medium

  // Debounce function to limit execution frequency
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  chrome.storage.sync.get([
    "chatgpt-toc-panel-width",
    "chatgpt-toc-panel-top",
    "chatgpt-toc-panel-height",
    "chatgpt-toc-panel-open",
    "chatgpt-toc-language",
    "chatgpt-toc-theme",
    "chatgpt-toc-font-size"
  ], (result) => {
    panelWidth = parseInt(result["chatgpt-toc-panel-width"]) || 400;
    panelTop = parseInt(result["chatgpt-toc-panel-top"]) || 57;
    panelHeight = parseInt(result["chatgpt-toc-panel-height"]) || null;
    panelBottom = panelHeight ? (panelTop + panelHeight) : window.innerHeight;
    isPanelOpen = true; // Luôn hiển thị panel khi tải trang
    language = result["chatgpt-toc-language"] || "vi";
    theme = result["chatgpt-toc-theme"] || "auto";
    fontSize = result["chatgpt-toc-font-size"] || "medium";
    createTOC();
  });

  // Translations
  const translations = {
    en: {
      myQuestions: "🧑‍💻 My Questions",
      aiResponses: "🤖 AI Responses",
      search: "Search...",
      settings: "Settings",
      language: "Language:",
      english: "English",
      vietnamese: "Vietnamese",
      theme: "Theme:",
      light: "Light",
      dark: "Dark",
      auto: "Auto (follow browser)",
      save: "Save",
      cancel: "Cancel",
      noResults: "No results found",
      customEntries: "Custom Entries",
      addToTOC: "Add to TOC",
      refresh: "🔄"
    },
    vi: {
      myQuestions: "🧑‍💻 Tôi hỏi",
      aiResponses: "🤖 AI trả lời",
      search: "Tìm kiếm...",
      settings: "Cài đặt",
      language: "Ngôn ngữ:",
      english: "Tiếng Anh",
      vietnamese: "Tiếng Việt",
      theme: "Chế độ:",
      light: "Sáng",
      dark: "Tối",
      auto: "Tự động (theo trình duyệt)",
      save: "Lưu",
      cancel: "Hủy",
      noResults: "Không tìm thấy kết quả",
      customEntries: "Mục tùy chỉnh",
      addToTOC: "Thêm vào mục lục",
      refresh: "🔄"
    }
  };

  // Get translation based on current language
  function t(key) {
    return translations[language][key] || key;
  }

  // Apply theme
  function applyTheme() {
    let isDarkTheme;
    
    if (theme === "auto") {
      isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDarkTheme = theme === "dark";
    }
    
    colors.bg = isDarkTheme ? "#1e1e1e" : "#ffffff";
    colors.text = isDarkTheme ? "#eee" : "#111";
    colors.border = isDarkTheme ? "#555" : "#ccc";
    colors.active = isDarkTheme ? "#333" : "#ccc";  // Darker for inactive button
    colors.highlight = isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)";
    colors.activeBtn = isDarkTheme ? "#666" : "#f0f0f0";  // Brighter for active button
    colors.inactiveBtn = isDarkTheme ? "#333" : "#ccc";   // Darker for inactive button
    
    return isDarkTheme;
  }

  // Apply font size to TOC elements
  function applyFontSize() {
    // Lấy tất cả các liên kết trong TOC
    const links = document.querySelectorAll(`#${panelId} a`);
    
    // Xác định kích thước font dựa trên cài đặt
    let fontSizeValue;
    
    // Nếu là giá trị số, sử dụng trực tiếp
    if (!isNaN(parseInt(fontSize))) {
      fontSizeValue = `${fontSize}px`;
    } else {
      // Hỗ trợ ngược cho các giá trị cũ
      switch(fontSize) {
        case "small":
          fontSizeValue = "12px";
          break;
        case "medium":
          fontSizeValue = "14px";
          break;
        case "large":
          fontSizeValue = "16px";
          break;
        default:
          fontSizeValue = "14px"; // Mặc định
      }
    }
    
    // Áp dụng kích thước font cho tất cả các liên kết
    links.forEach(link => {
      link.style.fontSize = fontSizeValue;
    });
  }

  function createTOC() {
    removeOld();
    
    // Apply current theme
    const isDarkTheme = applyTheme();

    const panel = document.createElement("div");
    panel.id = panelId;
    panel.style.fontSize = "12px";
    panel.style.top = `${panelTop}px`;
    panel.style.right = isPanelOpen ? "0px" : `-${panelWidth}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;
    panel.style.backgroundColor = colors.bg;
    panel.style.color = colors.text;

    const resizeHandle = document.createElement("div");
    resizeHandle.id = resizeHandleId;
    resizeHandle.style.top = `${panelTop}px`;
    resizeHandle.style.height = panelHeight ? `${panelHeight}px` : `calc(100vh - ${panelTop}px)`;
    resizeHandle.style.right = isPanelOpen ? `${panelWidth}px` : `-${3 + panelWidth}px`;

    const dragHandle = document.createElement("div");
    dragHandle.id = dragHandleId;

    const dragHandleBottom = document.createElement("div");
    dragHandleBottom.id = dragHandleBottomId;

    // Tạo nút TOC (không đổi giao diện, chỉ xử lý vị trí và phím tắt)
    const toggle = document.createElement("button");
    toggle.id = toggleId;
    toggle.textContent = "TOC";
    // Đặt vị trí top để luôn ở giữa panel (sử dụng transform để căn giữa thật sự)
    const updateTogglePos = () => {
      const ph = panelHeight ? panelHeight : (window.innerHeight - panelTop);
      toggle.style.top = `${panelTop + ph / 2}px`;
      toggle.style.transform = "translateY(-50%)";
    };
    updateTogglePos();
    toggle.style.right = isPanelOpen ? `${panelWidth + 3}px` : "0px";
    toggle.style.position = "fixed";
    // Các style khác giữ nguyên mặc định (giao diện gốc)

    panel.appendChild(resizeHandle);
    panel.appendChild(dragHandle);
    panel.appendChild(dragHandleBottom);
    document.body.appendChild(toggle);

    // Create custom context menu
    const contextMenu = document.createElement("div");
    contextMenu.className = "toc-context-menu";
    contextMenu.style.position = "absolute";
    contextMenu.style.zIndex = "10000";
    contextMenu.style.backgroundColor = colors.bg;
    contextMenu.style.border = `1px solid ${colors.border}`;
    contextMenu.style.borderRadius = "4px";
    contextMenu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    contextMenu.style.display = "none";
    document.body.appendChild(contextMenu);
    
    // Add menu item
    const addToTOCItem = document.createElement("div");
    addToTOCItem.textContent = t("addToTOC");
    addToTOCItem.style.padding = "8px 12px";
    addToTOCItem.style.cursor = "pointer";
    addToTOCItem.style.color = colors.text;
    
    addToTOCItem.addEventListener("mouseover", () => {
      addToTOCItem.style.backgroundColor = colors.highlight;
    });
    
    addToTOCItem.addEventListener("mouseout", () => {
      addToTOCItem.style.backgroundColor = "transparent";
    });
    
    contextMenu.appendChild(addToTOCItem);

    // Khôi phục giao diện tab như v1.30
    const tabTable = document.createElement("table");
    const tabRow = document.createElement("tr");
    const tdUser = document.createElement("td");
    const tdRefresh = document.createElement("td");
    const tdAI = document.createElement("td");

    const btnUser = document.createElement("button");
    const btnRefresh = document.createElement("button");
    const btnAI = document.createElement("button");

    btnUser.textContent = t("myQuestions");
    btnAI.textContent = t("aiResponses");
    btnRefresh.textContent = t("refresh");
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

    const containerUser = document.createElement("div");
    const containerAI = document.createElement("div");
    containerUser.style.display = "none";
    containerAI.style.display = "block"; // Hiển thị mặc định tab AI trả lời
    containerUser.style.paddingLeft = "6px";
    containerUser.style.paddingTop = "10px";
    containerUser.style.paddingBottom = "20px";
    containerUser.style.flexGrow = "1";
    containerUser.style.overflowY = "auto";
    containerUser.style.overflowX = "hidden";
    containerAI.style.paddingLeft = "6px";
    containerAI.style.paddingTop = "10px";
    containerAI.style.paddingBottom = "20px";
    containerAI.style.flexGrow = "1";
    containerAI.style.overflowY = "auto";
    containerAI.style.overflowX = "hidden";
    panel.appendChild(containerUser);
    panel.appendChild(containerAI);
    
    // Thiết lập màu nút tương ứng với tab được chọn
    btnUser.style.background = colors.inactiveBtn;
    btnAI.style.background = colors.activeBtn;

    // Add search box to the bottom of the TOC panel
    const searchContainer = document.createElement("div");
    searchContainer.className = "toc-search-container";
    searchContainer.style.padding = "5px";
    searchContainer.style.borderTop = `1px solid ${colors.border}`;
    searchContainer.style.position = "sticky";
    searchContainer.style.bottom = "0";
    searchContainer.style.backgroundColor = colors.bg;
    searchContainer.style.zIndex = "100";
    searchContainer.style.display = "flex";
    searchContainer.style.alignItems = "center";
    
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = t("search");
    searchInput.className = "toc-search-input";
    searchInput.style.flex = "1";
    searchInput.style.padding = "5px";
    searchInput.style.boxSizing = "border-box";
    searchInput.style.border = `1px solid ${colors.border}`;
    searchInput.style.borderRadius = "4px";
    searchInput.style.backgroundColor = colors.bg;
    searchInput.style.color = colors.text;
    
    // Add clear button
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "✕";
    clearBtn.style.marginLeft = "5px";
    clearBtn.style.padding = "5px 8px";
    clearBtn.style.backgroundColor = "transparent";
    clearBtn.style.border = "none";
    clearBtn.style.borderRadius = "4px";
    clearBtn.style.cursor = "pointer";
    clearBtn.style.color = colors.text;
    clearBtn.style.fontSize = "14px";
    clearBtn.style.display = "none"; // Initially hidden
    
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      // Trigger the input event to update the search results
      searchInput.dispatchEvent(new Event("input"));
    });
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearBtn);
    panel.appendChild(searchContainer);

    let linksMap = new Map();
    let lastMessageCount = 0;
    let lastAssistantContent = "";
    let lastScrollTop = 0;
    let customEntries = JSON.parse(localStorage.getItem("chatgpt-toc-custom-entries") || "[]");

    function buildTOC() {
      const activeContainer = containerUser.style.display === "block" ? containerUser : containerAI;
      lastScrollTop = activeContainer.scrollTop;

      containerUser.innerHTML = "";
      containerAI.innerHTML = "";
      linksMap.clear();
      let turn = 0;
      
      // Sử dụng nhiều bộ chọn để đảm bảo tương thích với các phiên bản ChatGPT khác nhau
      const blocks = document.querySelectorAll('[data-message-author-role], .message');
      
      // Kiểm tra nếu không tìm thấy blocks, thử lại sau 1 giây
      if (blocks.length === 0) {
        setTimeout(() => {
          buildTOC();
        }, 1000);
        return;
      }
      
      lastMessageCount = blocks.length;

      isRefreshing = true;

      let assistantContent = "";
      blocks.forEach((block) => {
        // Xác định role từ thuộc tính hoặc từ class
        let role = block.getAttribute("data-message-author-role");
        if (!role) {
          if (block.classList.contains("user")) {
            role = "user";
          } else if (block.classList.contains("assistant")) {
            role = "assistant";
          }
        }
        
        const content = block.querySelector(".markdown") || block.querySelector(".content");
        turn++;
        if (role === "user") {
          const id = `toc-user-${turn}`;
          block.id = id;
          const text = block.innerText.trim().split("\n")[0].slice(0, 100) || "(...)";
          const link = document.createElement("a");
          link.href = "#" + id;
          link.textContent = `💬 ${text}`;
          link.style.fontSize = "14px";
          link.style.display = "block";
          link.style.textDecoration = "none";
          link.style.color = colors.text;
          link.style.padding = "3px 0";
          link.style.borderBottom = `1px solid ${colors.border}`;
          
          containerUser.appendChild(link);
          linksMap.set(block, { link, position: block.offsetTop });

          link.addEventListener('click', (e) => {
            e.preventDefault();
            resetLinkStyles();
            highlightLink(link);
            
            // Lưu trạng thái hiện tại của link được chọn
            const selectedLink = link;
            
            // Sử dụng setTimeout để đảm bảo highlight được áp dụng trước khi cuộn
            setTimeout(() => {
              // Cuộn đến phần tử trong nội dung với hiệu ứng mượt mà
              document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
              
              // Đảm bảo link vẫn được highlight sau khi cuộn
              highlightLink(selectedLink);
              
              // Cuộn panel để hiển thị link nếu cần
              if (!isElementInViewport(selectedLink, activeContainer)) {
                scrollPanelToLink(selectedLink, activeContainer);
              }
            }, 50);
          });
        }
        if (role === "assistant" && content) {
          assistantContent += content.innerText;
          
          // Tìm tất cả các tiêu đề trong nội dung
          const headers = content.querySelectorAll("h1,h2,h3") || [];
          const hasH1 = content.querySelector("h1") !== null;
          const hasH2 = content.querySelector("h2") !== null;
          
          headers.forEach((header, i) => {
            const id = `toc-ai-${turn}-${i}`;
            header.id = id;
            const link = document.createElement("a");
            link.href = "#" + id;
            link.style.display = "block";
            link.style.textDecoration = "none";
            link.style.color = colors.text;
            link.style.padding = "3px 0";
            link.style.borderBottom = `1px solid ${colors.border}`;
            
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
              
              // Lưu trạng thái hiện tại của link được chọn
              const selectedLink = link;
              
              // Sử dụng setTimeout để đảm bảo highlight được áp dụng trước khi cuộn
              setTimeout(() => {
                // Cuộn đến phần tử trong nội dung với hiệu ứng mượt mà
                document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
                
                // Đảm bảo link vẫn được highlight sau khi cuộn
                highlightLink(selectedLink);
                
                // Cuộn panel để hiển thị link nếu cần
                if (!isElementInViewport(selectedLink, activeContainer)) {
                  scrollPanelToLink(selectedLink, activeContainer);
                }
              }, 50);
            });
          });
        }
      });
      lastAssistantContent = assistantContent;

      // Restore custom entries
      restoreCustomEntries();

      activeContainer.scrollTop = lastScrollTop;

      setTimeout(() => {
        isRefreshing = false;
      }, 500);

      setupScrollSync();
      
      // Apply font size to TOC elements
      applyFontSize();
    }
    
    // Đồng bộ cuộn giữa nội dung và mục lục
    function setupScrollSync() {
      // Lấy tất cả các khối tin nhắn và tiêu đề
      const messageBlocks = document.querySelectorAll('[data-message-author-role], .message');
      const headers = document.querySelectorAll('h1, h2, h3');
      
      // Kết hợp tất cả các phần tử cần theo dõi
      const allElements = [...messageBlocks, ...headers];
      
      // Xóa bỏ event listener cũ nếu có
      window.removeEventListener('scroll', handleContentScroll);
      
      // Thêm event listener mới
      window.addEventListener('scroll', handleContentScroll);
      
      function handleContentScroll() {
        // Nếu panel không mở, không cần đồng bộ
        if (!isPanelOpen) return;
        
        // Tìm phần tử đang hiển thị trong viewport
        let currentElement = null;
        let smallestDistance = Infinity;
        
        allElements.forEach(element => {
          const rect = element.getBoundingClientRect();
          const distance = Math.abs(rect.top);
          
          // Nếu phần tử này gần viewport hơn, cập nhật
          if (distance < smallestDistance) {
            smallestDistance = distance;
            currentElement = element;
          }
        });
        
        // Nếu tìm thấy phần tử, highlight mục tương ứng trong TOC
        if (currentElement && linksMap.has(currentElement)) {
          resetLinkStyles();
          const linkInfo = linksMap.get(currentElement);
          highlightLink(linkInfo.link);
        }
      }
    }

    // Add custom entry to TOC
    function addCustomEntryToTOC(text, selection, targetContainer = containerAI) {
      // Create a unique ID for this custom entry
      const customId = `toc-custom-${Date.now()}`;
      
      // Create a marker span at the selection
      const range = selection.getRangeAt(0);
      const marker = document.createElement("span");
      marker.id = customId;
      marker.className = "toc-custom-marker";
      marker.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
      
      try {
        // Try to insert the marker at the selection
        range.surroundContents(marker);
        
        // Add entry to the TOC
        const customEntry = document.createElement("a");
        customEntry.href = `#${customId}`;
        customEntry.textContent = `✏️ ${text.length > 50 ? text.substring(0, 47) + "..." : text}`;
        customEntry.style.display = "block";
        customEntry.style.textDecoration = "none";
        customEntry.style.color = colors.text;
        customEntry.style.padding = "3px 0";
        customEntry.style.borderBottom = `1px solid ${colors.border}`;
        
        // Create a custom entries container if it doesn't exist
        let customContainer = document.getElementById("toc-custom-entries");
        if (!customContainer) {
          customContainer = document.createElement("div");
          customContainer.id = "toc-custom-entries";
          customContainer.style.padding = "5px";
          customContainer.style.marginTop = "10px";
          customContainer.style.borderTop = `1px solid ${colors.border}`;
          
          const customHeader = document.createElement("div");
          customHeader.textContent = t("customEntries");
          customHeader.style.fontWeight = "bold";
          customHeader.style.padding = "5px 0";
          customContainer.appendChild(customHeader);
          
          // Add to the target container (always containerAI)
          targetContainer.appendChild(customContainer);
        }
        
        // Add click handler
        customEntry.addEventListener("click", (e) => {
          e.preventDefault();
          document.querySelector(`#${customId}`).scrollIntoView({ behavior: 'smooth' });
          
          // Highlight all TOC entries
          resetLinkStyles();
          
          // Highlight this entry
          customEntry.style.backgroundColor = colors.highlight;
        });
        
        // Add remove button
        const removeBtn = document.createElement("span");
        removeBtn.textContent = "✕";
        removeBtn.style.marginLeft = "5px";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.float = "right";
        
        removeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Remove the marker from the text
          const markerElement = document.getElementById(customId);
          if (markerElement) {
            // Replace the marker with its text content
            const parent = markerElement.parentNode;
            const textNode = document.createTextNode(markerElement.textContent);
            parent.replaceChild(textNode, markerElement);
          }
          
          // Remove the entry from TOC
          customEntry.remove();
          
          // Remove from custom entries
          const idx = customEntries.findIndex(entry => entry.id === customId);
          if (idx !== -1) {
            customEntries.splice(idx, 1);
            localStorage.setItem("chatgpt-toc-custom-entries", JSON.stringify(customEntries));
          }
          
          // Remove the container if empty
          if (customContainer.querySelectorAll("a").length === 0) {
            customContainer.remove();
          }
        });
        
        customEntry.appendChild(removeBtn);
        customContainer.appendChild(customEntry);
        
        // Save custom entry to localStorage
        customEntries.push({ id: customId, text });
        localStorage.setItem("chatgpt-toc-custom-entries", JSON.stringify(customEntries));
      } catch (e) {
        console.error("Could not create TOC entry from selection:", e);
        // Fallback for complex selections that can't be surrounded
        alert("Không thể thêm vào mục lục. Vui lòng chọn một đoạn văn bản đơn giản.");
      }
    }
    
    // Restore custom entries from localStorage
    function restoreCustomEntries() {
      if (customEntries.length === 0) return;
      
      // Create custom container
      let customContainer = document.getElementById("toc-custom-entries");
      if (!customContainer) {
        customContainer = document.createElement("div");
        customContainer.id = "toc-custom-entries";
        customContainer.style.padding = "5px";
        customContainer.style.marginTop = "10px";
        customContainer.style.borderTop = `1px solid ${colors.border}`;
        
        const customHeader = document.createElement("div");
        customHeader.textContent = t("customEntries");
        customHeader.style.fontWeight = "bold";
        customHeader.style.padding = "5px 0";
        customContainer.appendChild(customHeader);
        
        // Add to the active container
        containerAI.appendChild(customContainer);
      }
      
      // Add entries
      customEntries.forEach(entry => {
        // Check if the marker still exists
        const marker = document.getElementById(entry.id);
        if (!marker) return;
        
        const customEntry = document.createElement("a");
        customEntry.href = `#${entry.id}`;
        customEntry.textContent = `✏️ ${entry.text.length > 50 ? entry.text.substring(0, 47) + "..." : entry.text}`;
        customEntry.style.display = "block";
        customEntry.style.textDecoration = "none";
        customEntry.style.color = colors.text;
        customEntry.style.padding = "3px 0";
        customEntry.style.borderBottom = `1px solid ${colors.border}`;
        
        // Add click handler
        customEntry.addEventListener("click", (e) => {
          e.preventDefault();
          document.querySelector(`#${entry.id}`).scrollIntoView({ behavior: 'smooth' });
          
          // Highlight all TOC entries
          resetLinkStyles();
          
          // Highlight this entry
          customEntry.style.backgroundColor = colors.highlight;
        });
        
        // Add remove button
        const removeBtn = document.createElement("span");
        removeBtn.textContent = "✕";
        removeBtn.style.marginLeft = "5px";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.float = "right";
        
        removeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Remove the marker from the text
          const markerElement = document.getElementById(entry.id);
          if (markerElement) {
            // Replace the marker with its text content
            const parent = markerElement.parentNode;
            const textNode = document.createTextNode(markerElement.textContent);
            parent.replaceChild(textNode, markerElement);
          }
          
          // Remove the entry from TOC
          customEntry.remove();
          
          // Remove from custom entries
          const idx = customEntries.findIndex(e => e.id === entry.id);
          if (idx !== -1) {
            customEntries.splice(idx, 1);
            localStorage.setItem("chatgpt-toc-custom-entries", JSON.stringify(customEntries));
          }
          
          // Remove the container if empty
          if (customContainer.querySelectorAll("a").length === 0) {
            customContainer.remove();
          }
        });
        
        customEntry.appendChild(removeBtn);
        customContainer.appendChild(customEntry);
      });
    }

    // Fix text selection context menu to not interfere with default browser functionality
    let tocContextMenuShown = false;
    
    // Handle context menu for text selection
    document.addEventListener("mouseup", (e) => {
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0) {
        // Kiểm tra xem selection có nằm trong phần nội dung ChatGPT không
        let isInChatContent = false;
        let targetElement = e.target;
        
        // Tìm phần tử cha là message-author-role
        while (targetElement && !isInChatContent) {
          if (targetElement.hasAttribute && targetElement.hasAttribute('data-message-author-role')) {
            isInChatContent = true;
            break;
          }
          targetElement = targetElement.parentElement;
        }
        
        if (isInChatContent && e.button === 2) { // Only for right-click
          // We'll show our custom menu in the contextmenu event
          tocContextMenuShown = true;
        }
      }
    });
    
    document.addEventListener("contextmenu", (e) => {
      // First hide any existing context menu
      hideContextMenu();
      
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0) {
        // Kiểm tra xem selection có nằm trong phần nội dung ChatGPT không
        let isInChatContent = false;
        let targetElement = e.target;
        
        // Tìm phần tử cha là message-author-role
        while (targetElement && !isInChatContent) {
          if (targetElement.hasAttribute && targetElement.hasAttribute('data-message-author-role')) {
            isInChatContent = true;
            break;
          }
          targetElement = targetElement.parentElement;
        }
        
        if (isInChatContent) {
          // Don't prevent default - let the browser show its context menu
          // Just position our menu item within the browser's context menu
          setTimeout(() => {
            // Position the context menu near the mouse position
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            contextMenu.style.display = "block";
            
            // Handle click on "Add to TOC"
            addToTOCItem.onclick = () => {
              const selectedText = selection.toString().trim();
              if (selectedText) {
                // Luôn thêm vào mục lục AI trả lời
                containerAI.style.display = "block";
                containerUser.style.display = "none";
                btnUser.style.background = colors.inactiveBtn;
                btnAI.style.background = colors.activeBtn;
                
                addCustomEntryToTOC(selectedText, selection, containerAI);
              }
              hideContextMenu();
            };
          }, 50);
        }
      }
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener("click", () => {
      hideContextMenu();
    });
    
    // Hide context menu when scrolling
    document.addEventListener("scroll", () => {
      hideContextMenu();
    });
    
    function hideContextMenu() {
      contextMenu.style.display = "none";
      tocContextMenuShown = false;
    }

    function resetLinkStyles() {
      linksMap.forEach(item => {
        item.link.style.background = "none";
        item.link.style.border = "none";
        item.link.style.color = colors.text;
      });
    }

    function highlightLink(link) {
      link.style.background = colors.highlight;
      link.style.border = `1px solid ${isDarkTheme ? "#60a5fa" : "#2563eb"}`;
      link.style.color = isDarkTheme ? "#ffffff" : "#000000";
    }

    function scrollPanelToLink(link, container) {
      const linkRect = link.getBoundingClientRect();
      const panelRect = container.getBoundingClientRect();
      
      // Tính toán vị trí cuộn để đưa mục lục vào giữa panel
      const containerHeight = panelRect.height;
      const linkHeight = linkRect.height;
      
      // Tính toán vị trí cuộn để đưa mục lục vào giữa panel
      // Lấy vị trí của link so với đầu container và trừ đi nửa chiều cao container
      // để đặt link vào giữa, cộng thêm nửa chiều cao của link để căn chỉnh chính xác
      const scrollTarget = (linkRect.top - panelRect.top + container.scrollTop) - 
                          (containerHeight / 2) + (linkHeight / 2);
      
      // Đảm bảo không cuộn quá đầu hoặc cuối panel
      const maxScroll = container.scrollHeight - containerHeight;
      container.scrollTo({ 
        top: Math.max(0, Math.min(scrollTarget, maxScroll)), 
        behavior: 'smooth' 
      });
    }

    function isElementInViewport(el, container) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
    }

    // Tab switching logic - Khôi phục giao diện v1.30
    btnUser.onclick = () => {
      containerUser.style.display = "block";
      containerAI.style.display = "none";
      btnUser.style.background = colors.activeBtn;
      btnAI.style.background = colors.inactiveBtn;
    };

    btnAI.onclick = () => {
      containerUser.style.display = "none";
      containerAI.style.display = "block";
      btnUser.style.background = colors.inactiveBtn;
      btnAI.style.background = colors.activeBtn;
    };

    btnRefresh.onclick = () => {
      buildTOC();
    };

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

    toggle.onmouseover = () => {
      toggle.style.opacity = "1";
      toggle.style.boxShadow = "0 0 10px rgba(255,255,255,0.5)";
    };
    toggle.onmouseout = () => {
      toggle.style.opacity = "0.5";
      toggle.style.boxShadow = "none";
    };
    toggle.onclick = toggleTOC;

    // Hotkey ALT+S: luôn đồng bộ với chức năng toggleTOC
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
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
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 200 && newWidth <= 600) {
          panelWidth = newWidth;
          panel.style.width = `${panelWidth}px`;
          resizeHandle.style.right = `${panelWidth}px`;
          toggle.style.right = `${panelWidth + 3}px`;
          chrome.storage.sync.set({ "chatgpt-toc-panel-width": panelWidth });
        }
      }
      if (isDragging) {
        const newTop = e.clientY;
        if (newTop >= 50 && newTop <= window.innerHeight - 100) {
          panelTop = newTop;
          panel.style.top = `${panelTop}px`;
          resizeHandle.style.top = `${panelTop}px`;
          updateTogglePos();
          chrome.storage.sync.set({ "chatgpt-toc-panel-top": panelTop });
        }
      }
      if (isDraggingBottom) {
        const newHeight = e.clientY - panelTop;
        if (newHeight >= 200 && newHeight <= window.innerHeight - panelTop) {
          panelHeight = newHeight;
          panel.style.height = `${panelHeight}px`;
          resizeHandle.style.height = `${panelHeight}px`;
          updateTogglePos();
          chrome.storage.sync.set({ "chatgpt-toc-panel-height": panelHeight });
        }
      }
    };

    document.onmouseup = () => {
      isResizing = false;
      isDragging = false;
      isDraggingBottom = false;
      document.body.style.userSelect = "";
    };

    document.body.appendChild(panel);

    // Tự động xây dựng TOC khi tạo panel
    buildTOC();

    // Tự động cập nhật TOC khi có thay đổi
    const observer = new MutationObserver(debounce(() => {
      if (isRefreshing) return;
      
      const blocks = document.querySelectorAll('[data-message-author-role]');
      const assistantBlocks = document.querySelectorAll('[data-message-author-role="assistant"]');
      
      // Kiểm tra xem có tin nhắn mới không
      if (blocks.length !== lastMessageCount) {
        buildTOC();
        return;
      }
      
      // Kiểm tra xem nội dung AI có thay đổi không
      let currentAssistantContent = "";
      assistantBlocks.forEach(block => {
        const content = block.querySelector(".markdown");
        if (content) {
          currentAssistantContent += content.innerText;
        }
      });
      
      if (currentAssistantContent !== lastAssistantContent) {
        buildTOC();
      }
    }, 1000));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Xử lý tìm kiếm
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.trim().toLowerCase();
      
      // Show/hide clear button
      clearBtn.style.display = searchTerm ? "block" : "none";
      
      // Get all links in the active container
      const activeContainer = containerUser.style.display === "block" ? containerUser : containerAI;
      const links = Array.from(activeContainer.querySelectorAll("a"));
      
      // Filter links based on search term
      links.forEach(link => {
        if (searchTerm === "") {
          link.style.display = "block";
        } else if (link.textContent.toLowerCase().includes(searchTerm)) {
          link.style.display = "block";
          
          // Highlight the matching text
          const text = link.textContent;
          const iconMatch = text.match(/^[^\w]+\s/);
          
          if (iconMatch) {
            const icon = iconMatch[0];
            const textContent = text.substring(icon.length);
            const regex = new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            const highlightedText = textContent.replace(regex, '<span style="background-color: yellow; color: black;">$1</span>');
            
            link.innerHTML = `${icon}${highlightedText}`;
          } else {
            const regex = new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            const highlightedText = text.replace(regex, '<span style="background-color: yellow; color: black;">$1</span>');
            
            link.innerHTML = highlightedText;
          }
        } else {
          link.style.display = "none";
          
          // Reset the text content without highlighting
          const text = link.textContent;
          const iconMatch = text.match(/^[^\w]+\s/);
          
          if (iconMatch) {
            const icon = iconMatch[0];
            const textContent = text.substring(iconMatch[0].length);
            
            link.innerHTML = `${icon}${textContent}`;
          }
        }
      });
      
      // Show "No results" message if no matches
      const visibleLinks = links.filter(link => link.style.display !== "none");
      let noResultsMsg = document.getElementById("toc-no-results");
      
      if (visibleLinks.length === 0 && searchTerm !== "") {
        if (!noResultsMsg) {
          noResultsMsg = document.createElement("div");
          noResultsMsg.id = "toc-no-results";
          noResultsMsg.textContent = t("noResults");
          noResultsMsg.style.padding = "10px";
          noResultsMsg.style.textAlign = "center";
          noResultsMsg.style.fontStyle = "italic";
          noResultsMsg.style.color = colors.text;
          
          const activeContainer = containerUser.style.display === "block" ? containerUser : containerAI;
          activeContainer.appendChild(noResultsMsg);
        }
      } else if (noResultsMsg) {
        noResultsMsg.remove();
      }
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateSettings") {
      language = request.settings.language;
      theme = request.settings.theme;
      
      if (request.settings.fontSize) {
        fontSize = request.settings.fontSize;
      }
      
      // Apply new settings
      applyTheme();
      
      // Đảm bảo panel hiển thị
      isPanelOpen = true;
      
      // Recreate TOC with new settings
      createTOC();
      
      // Đảm bảo buildTOC được gọi để cập nhật mục lục
      buildTOC();
    }
    
    if (request.action === "refreshTOC") {
      // Recreate TOC to refresh with new settings
      createTOC();
    }
  });
})();
