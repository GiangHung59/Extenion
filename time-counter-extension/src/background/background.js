// Time Counter Chrome Extension - Background Script

// Shared counting logic (v1.1.1): same contract as popup.js — calendar days
// are date subtraction, counted days skip excluded weekdays after the start
// date. Fallback below only runs if importScripts fails, so a missing shared
// file can never silently break milestone notifications.
try {
  importScripts('../shared/counting.js');
} catch (e) {
  console.warn('Shared counting.js unavailable, using fallback:', e);
}
if (typeof countedDaysBetween === 'undefined') {
  var countedDaysBetween = function (startDate, endDate, excludedDays) {
    const excluded = Array.isArray(excludedDays) ? excludedDays.map(Number) : [];
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    if (end <= start) return 0;
    if (excluded.length === 0) {
      const utcA = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      const utcB = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
      return Math.round((utcB - utcA) / 86400000);
    }
    let total = 0;
    const cur = new Date(start); cur.setDate(cur.getDate() + 1);
    while (cur <= end) {
      if (excluded.indexOf(cur.getDay()) === -1) total++;
      cur.setDate(cur.getDate() + 1);
    }
    return total;
  };
}

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupInstallListener();
    this.setupStorageListener();
    this.setupAlarms();
  }

  // Installation and update handling
  setupInstallListener() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });
  }

  async handleFirstInstall() {
    console.log('Time Counter extension installed');
    
    // Initialize default settings
    const defaultSettings = {
      theme: 'auto',
      notifications: true,
      syncEnabled: true
    };

    try {
      await chrome.storage.sync.set({
        events: [],
        settings: defaultSettings
      });
    } catch (error) {
      console.warn('Sync storage failed, using local storage:', error);
      await chrome.storage.local.set({
        events: [],
        settings: defaultSettings
      });
    }

    // Show welcome notification
    this.showNotification('welcome', {
      type: 'basic',
      iconUrl: 'assets/icon48.png',
      title: 'Time Counter đã được cài đặt!',
      message: 'Bắt đầu tạo sự kiện đầu tiên để đếm thời gian.'
    });
  }

  async handleUpdate(previousVersion) {
    console.log(`Time Counter updated from ${previousVersion}`);
    
    // Handle data migration if needed
    await this.migrateData(previousVersion);
  }

  async migrateData(fromVersion) {
    // Handle data structure changes between versions
    try {
      const result = await chrome.storage.sync.get(['events', 'settings']);
      let needsUpdate = false;

      // Example migration logic
      if (result.events) {
        result.events.forEach(event => {
          if (!event.createdAt) {
            event.createdAt = new Date().toISOString();
            event.updatedAt = new Date().toISOString();
            needsUpdate = true;
          }
        });
      }

      if (needsUpdate) {
        await chrome.storage.sync.set(result);
      }
    } catch (error) {
      console.warn('Migration failed:', error);
    }
  }

  // Storage change monitoring
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' || namespace === 'local') {
        this.handleStorageChange(changes);
      }
    });
  }

  handleStorageChange(changes) {
    if (changes.events) {
      console.log('Events updated:', changes.events.newValue?.length || 0, 'events');
    }

    if (changes.settings) {
      console.log('Settings updated:', changes.settings.newValue);
    }
  }

  // Alarm and notification system
  setupAlarms() {
    // Clear existing alarms
    chrome.alarms.clearAll();

    // Set up daily check alarm
    chrome.alarms.create('dailyCheck', {
      when: Date.now() + 60000, // Start in 1 minute
      periodInMinutes: 60 // Check every hour
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyCheck') {
        this.checkEventNotifications();
      }
    });
  }

  async checkEventNotifications() {
    try {
      const result = await chrome.storage.sync.get(['events', 'settings']);
      const events = result.events || [];
      const settings = result.settings || {};

      if (!settings.notifications) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      events.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        if (event.type === 'countdown') {
          // v1.1.1: exclusive counting — tomorrow = 1, so the "1 day left"
          // milestone now fires the day before, not on the event day itself.
          const daysLeft = countedDaysBetween(today, eventDate, event.excludedDays);
          
          // Notify for milestones
          if ([1, 7, 30].includes(daysLeft)) {
            this.showNotification(`countdown-${event.id}`, {
              type: 'basic',
              iconUrl: 'assets/icon48.png',
              title: `🎯 ${event.name}`,
              message: `Còn ${daysLeft} ngày nữa!`
            });
          }
        } else if (event.type === 'countup') {
          const daysPassed = countedDaysBetween(eventDate, today, event.excludedDays);
          
          // Notify for milestones
          if ([7, 30, 100, 365].includes(daysPassed)) {
            this.showNotification(`countup-${event.id}`, {
              type: 'basic',
              iconUrl: 'assets/icon48.png',
              title: `📅 ${event.name}`,
              message: `Đã trải qua ${daysPassed} ngày!`
            });
          }
        }
      });
    } catch (error) {
      console.error('Failed to check notifications:', error);
    }
  }

  showNotification(id, options) {
    chrome.notifications.create(id, options, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Notification error:', chrome.runtime.lastError);
      } else {
        console.log('Notification shown:', notificationId);
      }
    });
  }

  // Message handling for communication with popup
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'getEvents':
          this.getEvents().then(sendResponse);
          return true; // Indicates async response

        case 'saveEvent':
          this.saveEvent(request.event).then(sendResponse);
          return true;

        case 'deleteEvent':
          this.deleteEvent(request.eventId).then(sendResponse);
          return true;

        case 'updateSettings':
          this.updateSettings(request.settings).then(sendResponse);
          return true;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    });
  }

  async getEvents() {
    try {
      const result = await chrome.storage.sync.get(['events']);
      return { success: true, events: result.events || [] };
    } catch (error) {
      const result = await chrome.storage.local.get(['events']);
      return { success: true, events: result.events || [] };
    }
  }

  async saveEvent(event) {
    try {
      const result = await chrome.storage.sync.get(['events']);
      const events = result.events || [];
      
      const existingIndex = events.findIndex(e => e.id === event.id);
      if (existingIndex >= 0) {
        events[existingIndex] = event;
      } else {
        events.push(event);
      }

      await chrome.storage.sync.set({ events });
      return { success: true };
    } catch (error) {
      console.warn('Sync storage failed, using local storage:', error);
      const result = await chrome.storage.local.get(['events']);
      const events = result.events || [];
      
      const existingIndex = events.findIndex(e => e.id === event.id);
      if (existingIndex >= 0) {
        events[existingIndex] = event;
      } else {
        events.push(event);
      }

      await chrome.storage.local.set({ events });
      return { success: true };
    }
  }

  async deleteEvent(eventId) {
    try {
      const result = await chrome.storage.sync.get(['events']);
      const events = (result.events || []).filter(e => e.id !== eventId);
      await chrome.storage.sync.set({ events });
      return { success: true };
    } catch (error) {
      const result = await chrome.storage.local.get(['events']);
      const events = (result.events || []).filter(e => e.id !== eventId);
      await chrome.storage.local.set({ events });
      return { success: true };
    }
  }

  async updateSettings(settings) {
    try {
      await chrome.storage.sync.set({ settings });
      return { success: true };
    } catch (error) {
      await chrome.storage.local.set({ settings });
      return { success: true };
    }
  }
}

// Initialize background service
new BackgroundService();

