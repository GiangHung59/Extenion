document.addEventListener('DOMContentLoaded', function() {
  // Translations
  const translations = {
    en: {
      settings: "ChatGPT TOC Settings",
      language: "Language:",
      english: "English",
      vietnamese: "Vietnamese",
      theme: "Theme:",
      light: "Light",
      dark: "Dark",
      auto: "Auto (follow browser)",
      fontSize: "Font Size:",
      verySmall: "10px (Very Small)",
      small: "12px (Small)",
      medium: "14px (Medium)",
      large: "16px (Large)",
      veryLarge: "18px (Very Large)",
      save: "Save",
      cancel: "Cancel"
    },
    vi: {
      settings: "Cài đặt ChatGPT TOC",
      language: "Ngôn ngữ:",
      english: "Tiếng Anh",
      vietnamese: "Tiếng Việt",
      theme: "Chế độ:",
      light: "Sáng",
      dark: "Tối",
      auto: "Tự động (theo trình duyệt)",
      fontSize: "Cỡ chữ:",
      verySmall: "10px (Rất nhỏ)",
      small: "12px (Nhỏ)",
      medium: "14px (Vừa)",
      large: "16px (Lớn)",
      veryLarge: "18px (Rất lớn)",
      save: "Lưu",
      cancel: "Hủy"
    }
  };

  // Function to translate UI
  function translateUI(language) {
    const t = translations[language];
    
    // Update page title
    document.title = t.settings;
    
    // Update heading
    document.querySelector('h2').textContent = t.settings;
    
    // Update labels
    document.querySelector('label[for="language"]').textContent = t.language;
    document.querySelector('label[for="theme"]').textContent = t.theme;
    document.querySelector('label[for="fontSize"]').textContent = t.fontSize;
    
    // Update select options
    const languageSelect = document.getElementById('language');
    languageSelect.options[0].textContent = t.english;
    languageSelect.options[1].textContent = t.vietnamese;
    
    const themeSelect = document.getElementById('theme');
    themeSelect.options[0].textContent = t.light;
    themeSelect.options[1].textContent = t.dark;
    themeSelect.options[2].textContent = t.auto;
    
    const fontSizeSelect = document.getElementById('fontSize');
    fontSizeSelect.options[0].textContent = t.verySmall;
    fontSizeSelect.options[1].textContent = t.small;
    fontSizeSelect.options[2].textContent = t.medium;
    fontSizeSelect.options[3].textContent = t.large;
    fontSizeSelect.options[4].textContent = t.veryLarge;
    
    // Update buttons
    document.getElementById('saveBtn').textContent = t.save;
    document.getElementById('cancelBtn').textContent = t.cancel;
  }

  // Load current settings
  chrome.storage.sync.get(["chatgpt-toc-language", "chatgpt-toc-theme", "chatgpt-toc-font-size"], function(result) {
    const language = result["chatgpt-toc-language"] || "vi";
    const theme = result["chatgpt-toc-theme"] || "auto";
    const fontSize = result["chatgpt-toc-font-size"] || "medium";
    
    document.getElementById('language').value = language;
    document.getElementById('theme').value = theme;
    document.getElementById('fontSize').value = fontSize;
    
    // Apply translations based on current language
    translateUI(language);
    
    // Update UI when language is changed
    document.getElementById('language').addEventListener('change', function() {
      translateUI(this.value);
    });
  });
  
  // Save button click handler
  document.getElementById('saveBtn').addEventListener('click', function() {
    const language = document.getElementById('language').value;
    const theme = document.getElementById('theme').value;
    const fontSize = document.getElementById('fontSize').value;
    
    chrome.storage.sync.set({
      "chatgpt-toc-language": language,
      "chatgpt-toc-theme": theme,
      "chatgpt-toc-font-size": fontSize
    }, function() {
      // Notify content script about settings change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: {
            language: language,
            theme: theme,
            fontSize: fontSize
          }
        });
      });
      
      window.close();
    });
  });
  
  // Cancel button click handler
  document.getElementById('cancelBtn').addEventListener('click', function() {
    window.close();
  });
});
