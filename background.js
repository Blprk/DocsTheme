// Background service worker for theme persistence and OS detection
class ThemeManager {
    constructor() {
      this.init();
    }
  
    async init() {
      // Set up storage defaults
      const { theme, autoDetect } = await chrome.storage.sync.get(['theme', 'autoDetect']);
      
      if (!theme) {
        await chrome.storage.sync.set({ theme: 'light' });
      }
      
      if (autoDetect === undefined) {
        await chrome.storage.sync.set({ autoDetect: true });
      }
  
      // Listen for OS theme changes
      if (chrome.runtime.onStartup) {
        chrome.runtime.onStartup.addListener(() => this.handleOSThemeChange());
      }
    }
  
    async handleOSThemeChange() {
      const { autoDetect } = await chrome.storage.sync.get(['autoDetect']);
      
      if (autoDetect) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const newTheme = prefersDark ? 'dark' : 'light';
        await chrome.storage.sync.set({ theme: newTheme });
        
        // Notify content scripts
        this.notifyContentScripts(newTheme);
      }
    }
  
    async notifyContentScripts(theme) {
      const tabs = await chrome.tabs.query({ url: 'https://docs.google.com/*' });
      
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'THEME_CHANGED',
          theme: theme
        }).catch(() => {
          // Tab might not be ready, ignore errors
        });
      });
    }
  }
  
  // Initialize theme manager
  new ThemeManager();
  
  // Handle installation
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('Google Docs Theme Switcher installed successfully');
    }
  });