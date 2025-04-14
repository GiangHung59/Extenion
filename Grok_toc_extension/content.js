(function () {
  'use strict';

  function addTOC(isInitialLoad = true) {
      const panelId = "grok-toc-panel";
      const toggleId = "grok-toc-toggle";
      const refreshId = "grok-toc-refresh";
      const headerId = "grok-toc-header";

      [panelId, toggleId, refreshId, headerId].forEach(id => {
          const element = document.getElementById(id);
          if (element) element.remove();
      });

      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const colors = {
          panelBg: isDark ? "#1a1a1a" : "#f5f5f5",
          text: isDark ? "#d1d5db" : "#4b5563",
          title: isDark ? "#d1d5db" : "#4b5563",
          tocItem: isDark ? "#60a5fa" : "#2563eb",
          tocItemSelected: isDark ? "#ffffff" : "#000000",
          border: isDark ? "#444" : "#ccc",
          toggleBg: isDark ? "#444" : "#ddd",
          toggleText: isDark ? "#fff" : "#000",
          toggleBorder: isDark ? "#666" : "#bbb",
          activeBorder: isDark ? "#60a5fa" : "#2563eb",
      };

      const toggle = document.createElement("button");
      toggle.id = toggleId;
      toggle.textContent = "TOC";
      toggle.style.cssText = `
          position: fixed; top: 50%; left: -21px; transform: translateY(-50%);
          width: 30px; height: 90px; z-index: 10001; background: ${colors.toggleBg};
          color: ${colors.toggleText}; border: 1px solid ${colors.toggleBorder};
          border-radius: 0 4px 4px 0; cursor: pointer; font-size: 14px; font-weight: bold;
          writing-mode: vertical-rl; text-orientation: mixed; opacity: 0.4;
          transition: opacity 0.3s ease, box-shadow 0.3s ease, left 0.3s ease;
      `;

      const panel = document.createElement("div");
      panel.id = panelId;
      panel.style.cssText = `
          position: fixed; top: 55px; left: -300px; width: 300px; height: calc(97vh - 55px);
          overflow-y: auto; z-index: 10000; background: ${colors.panelBg};
          color: ${colors.text}; border-right: 1px solid ${colors.border};
          padding: 10px; font-size: 14px; font-family: sans-serif;
          box-shadow: 2px 0 10px rgba(0,0,0,0.2); transition: left 0.5s ease-out;
          border-radius: 8px; scroll-behavior: smooth;
      `;

      const header = document.createElement("div");
      header.id = headerId;
      header.style.cssText = `
          position: sticky; top: 0; z-index: 10002; background: ${colors.panelBg};
          padding: 5px 0; display: flex; align-items: center; justify-content: center; gap: 8px;
      `;

      const title = document.createElement("b");
      title.textContent = "📑 Mục lục Grok 3";
      title.style.cssText = `font-size: 18px; color: ${colors.title}; text-align: center; white-space: nowrap;`;
      header.appendChild(title);

      const refresh = document.createElement("button");
      refresh.id = refreshId;
      refresh.textContent = "🔄";
      refresh.style.cssText = `
          width: 24px; height: 24px; background: transparent; color: ${colors.text};
          border: none; cursor: pointer; font-size: 14px; font-weight: bold;
          opacity: 0.5; transition: opacity 0.3s ease, box-shadow 0.3s ease;
      `;
      header.appendChild(refresh);

      const hr = document.createElement("hr");
      hr.style.cssText = `width: 100%; border: none; border-top: 1px solid ${colors.border}; margin: 5px 0 0 0;`;
      header.appendChild(hr);
      panel.appendChild(header);

      let links = [];
      let lastMessageCount = 0;
      let lastMessageContent = "";
      let linksMap = new Map();

      function buildTOC() {
          panel.innerHTML = "";
          panel.appendChild(header);
          links = [];
          linksMap.clear();

          const messages = document.querySelectorAll("div.text-base, div.markdown, div.prose, div[data-user='Grok']");
          lastMessageCount = messages.length;
          let currentMessageContent = "";
          messages.forEach(msg => currentMessageContent += msg.innerText);
          lastMessageContent = currentMessageContent;

          const fragment = document.createDocumentFragment();
          let found = 0;

          Array.from(messages).forEach((msg, i) => {
              const titles = msg.querySelectorAll("h1, h2, h3");
              Array.from(titles).forEach((title, j) => {
                  const id = `toc-${i}-${j}`;
                  title.id = id;
                  const link = document.createElement("a");
                  link.href = "#" + id;
                  const isSubtask = title.tagName === "H3";
                  const titleText = title.textContent;
                  link.innerHTML = `<div style="margin: ${isSubtask ? "4px 0 4px 20px" : "8px 0"}; font-size: 14px; color: ${colors.tocItem};">${isSubtask ? "✦ " : ""}${titleText}</div>`;
                  link.style.cssText = "display: block; text-decoration: none; padding: 2px 5px; border-radius: 4px; transition: background 0.2s ease, border 0.2s ease;";
                  link.addEventListener("click", (e) => {
                      e.preventDefault();
                      resetLinkStyles();
                      highlightLink(link);
                      requestAnimationFrame(() => {
                          document.querySelector(`#${id}`).scrollIntoView({ behavior: 'smooth' });
                          scrollPanelToLink(link);
                      });
                  });
                  fragment.appendChild(link);
                  links.push(link);
                  linksMap.set(id, { link, position: title.getBoundingClientRect().top + window.scrollY });
                  found++;
              });
          });

          if (found === 0) {
              const noTitles = document.createElement("i");
              noTitles.textContent = "Không tìm thấy tiêu đề.";
              noTitles.style.color = colors.text;
              fragment.appendChild(noTitles);
          }
          panel.appendChild(fragment);

          if (isInitialLoad && found > 0) {
              requestAnimationFrame(() => {
                  setTimeout(() => {
                      panel.style.left = "0px";
                  }, 100);
              });
          } else if (!isInitialLoad) {
              panel.style.left = "0px";
          }

          updateActiveLink();
      }

      function resetLinkStyles() {
          links.forEach(l => {
              l.style.background = "none";
              l.style.border = "none";
              l.querySelector("div").style.color = colors.tocItem;
          });
      }

      function highlightLink(link) {
          link.style.background = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
          link.style.border = `1px solid ${colors.activeBorder}`;
          link.querySelector("div").style.color = colors.tocItemSelected;
      }

      function scrollPanelToLink(link) {
          const linkRect = link.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          const scrollTarget = (linkRect.top - panelRect.top + panel.scrollTop) - (panelRect.height / 2) + (linkRect.height / 2);
          panel.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }

      function updateActiveLink() {
          const scrollTop = window.scrollY;
          const viewportHeight = window.innerHeight;
          let activeLink = null;

          for (const [id, { link, position }] of linksMap) {
              if (scrollTop + viewportHeight / 2 >= position) {
                  activeLink = link;
              } else {
                  break;
              }
          }

          if (activeLink) {
              resetLinkStyles();
              highlightLink(activeLink);
              if (!isElementInViewport(activeLink, panel)) {
                  scrollPanelToLink(activeLink);
              }
          }
      }

      function isElementInViewport(el, container) {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
      }

      toggle.addEventListener("click", () => {
          const isOpen = panel.style.left === "0px";
          panel.style.left = isOpen ? "-300px" : "0px";
          toggle.style.opacity = "0.4";
      });

      toggle.addEventListener("mouseover", () => {
          toggle.style.left = "0px";
          toggle.style.opacity = "1";
          toggle.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.5)";
      });

      toggle.addEventListener("mouseout", () => {
          toggle.style.left = "-21px";
          toggle.style.opacity = "0.4";
          toggle.style.boxShadow = "none";
      });

      refresh.addEventListener("click", () => {
          requestAnimationFrame(() => {
              addTOC(false);
          });
      });

      refresh.addEventListener("mouseover", () => {
          refresh.style.opacity = "1";
          refresh.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.5)";
      });

      refresh.addEventListener("mouseout", () => {
          refresh.style.opacity = "0.5";
          refresh.style.boxShadow = "none";
      });

      document.addEventListener('keydown', (e) => {
          if (e.altKey && e.code === 'KeyS') {
              e.preventDefault();
              toggle.click();
          }
      });

      window.addEventListener('scroll', debounce(() => {
          if (panel.style.left === "0px") {
              updateActiveLink();
              const scrollTop = window.scrollY;
              const docHeight = document.documentElement.scrollHeight - window.innerHeight;
              const panelScrollHeight = panel.scrollHeight - panel.clientHeight;
              if (docHeight > 0 && panelScrollHeight > 0) {
                  const scrollRatio = scrollTop / docHeight;
                  const panelScrollTarget = scrollRatio * panelScrollHeight;
                  panel.scrollTo({ top: panelScrollTarget, behavior: 'smooth' });
              }
          }
      }, 50));

      document.body.appendChild(toggle);
      document.body.appendChild(panel);

      const observer = new MutationObserver(debounce(() => {
          const chatElements = document.querySelectorAll("div.text-base, div.markdown, div.prose, div[data-user='Grok']");
          const currentMessageCount = chatElements.length;
          let currentMessageContent = "";
          chatElements.forEach(msg => currentMessageContent += msg.innerText);

          if (currentMessageCount !== lastMessageCount || currentMessageContent !== lastMessageContent) {
              buildTOC();
          }
      }, 300));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });

      if (document.querySelector("div.text-base, div.markdown, div.prose, div[data-user='Grok']")) {
          buildTOC();
      }

      let lastHash = location.hash;
      window.addEventListener('hashchange', () => {
          if (location.hash !== lastHash) {
              lastHash = location.hash;
              requestAnimationFrame(() => addTOC(false));
          }
      });

      let lastUrl = location.pathname + location.search;
      new MutationObserver(debounce(() => {
          const currentUrl = location.pathname + location.search;
          if (currentUrl !== lastUrl) {
              lastUrl = currentUrl;
              requestAnimationFrame(() => addTOC(true));
          }
      }, 300)).observe(document, { subtree: true, childList: true });
  }

  function debounce(func, wait) {
      let timeout;
      return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
      };
  }

  addTOC(true);
})();