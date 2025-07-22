// Popup controller - handles UI interactions and theme switching
class ThemePopup {
    constructor() {
      this.currentTheme = 'light';
      this.isApplying = false;
      this.themes = {
        light: { name: 'Light', bg: '#ffffff', fg: '#202124' },
        dark: { name: 'Dark', bg: '#202124', fg: '#e8eaed' },
        sepia: { name: 'Sepia', bg: '#f4ecd8', fg: '#5b4636' },
        solarized: { name: 'Solarized', bg: '#fdf6e3', fg: '#657b83' },
        'high-contrast': { name: 'High Contrast', bg: '#000000', fg: '#ffffff' },
        'midnight-blue': { name: 'Midnight Blue', bg: '#0f1626', fg: '#e6f2ff' },
        'forest-green': { name: 'Forest Green', bg: '#0d1b1e', fg: '#e0f2e9' },
        'warm-amber': { name: 'Warm Amber', bg: '#2c1810', fg: '#f5e6d8' }
      };
      this.init();
    }
  
    async init() {
      // Load saved preferences
      await this.loadPreferences();
      
      // Setup UI
      this.setupThemeGrid();
      this.setupEventListeners();
      
      // Update UI state
      this.updateThemeSelection();
      this.updateAutoDetectToggle();
    }
  
    async loadPreferences() {
      try {
        const result = await chrome.storage.sync.get(['theme', 'autoDetect']);
        this.currentTheme = result.theme || 'light';
        this.autoDetect = result.autoDetect !== false;
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    }
  
    setupThemeGrid() {
      const themeGrid = document.getElementById('theme-grid');
      let html = '';
      
      Object.entries(this.themes).forEach(([key, theme]) => {
        html += `
          <div class="theme-card" data-theme="${key}">
            <div class="theme-preview" style="background: ${theme.bg}; border-color: ${theme.fg}">
              <span class="theme-preview-text" style="color: ${theme.fg}">Aa</span>
            </div>
            <div class="theme-name">${theme.name}</div>
          </div>
        `;
      });
      
      themeGrid.innerHTML = html;
    }
  
    setupEventListeners() {
      // Theme card clicks
      document.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', (e) => {
          const themeName = card.dataset.theme;
          this.applyTheme(themeName);
        });
      });
  
      // Auto-detect toggle
      const autoDetectCheckbox = document.getElementById('auto-detect');
      if (autoDetectCheckbox) {
        autoDetectCheckbox.addEventListener('change', (e) => {
          this.toggleAutoDetect(e.target.checked);
        });
      }
    }
  
    async applyTheme(themeName) {
      if (this.isApplying || themeName === this.currentTheme) return;
  
      this.isApplying = true;
      const themeCard = document.querySelector(`[data-theme="${themeName}"]`);
      
      try {
        // Add loading state
        themeCard.classList.add('loading');
        
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('docs.google.com')) {
          throw new Error('Please open Google Docs to apply themes');
        }
  
        // Send theme change message
        await chrome.tabs.sendMessage(tab.id, {
          type: 'APPLY_THEME',
          theme: themeName
        });
  
        // Update current theme
        this.currentTheme = themeName;
        
        // Update UI
        this.updateThemeSelection();
        
        console.log('Theme applied:', themeName);
        
      } catch (error) {
        console.error('Failed to apply theme:', error);
        this.showError('Failed to apply theme. Make sure you\'re on Google Docs.');
      } finally {
        themeCard.classList.remove('loading');
        this.isApplying = false;
      }
    }
  
    updateThemeSelection() {
      document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.remove('active');
      });
  
      const activeCard = document.querySelector(`[data-theme="${this.currentTheme}"]`);
      if (activeCard) {
        activeCard.classList.add('active');
      }
    }
  
    updateAutoDetectToggle() {
      const checkbox = document.getElementById('auto-detect');
      if (checkbox) {
        checkbox.checked = this.autoDetect;
      }
    }
  
    async toggleAutoDetect(enabled) {
      this.autoDetect = enabled;
      await chrome.storage.sync.set({ autoDetect: enabled });
      
      if (enabled) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const osTheme = prefersDark ? 'dark' : 'light';
        this.applyTheme(osTheme);
      }
    }
  
    showError(message) {
      console.error(message);
      // Simple alert for now
      alert(message);
    }
  }
  
  // Initialize popup when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    new ThemePopup();
  });