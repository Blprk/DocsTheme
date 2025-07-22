// Theme engine - handles theme application and canvas filtering
class ThemeEngine {
  static DEBUG = true;
  
  static log(...args) {
    if (ThemeEngine.DEBUG) {
      console.log('[ThemeEngine]', ...args);
    }
  }
  
  static error(...args) {
    console.error('[ThemeEngine]', ...args);
  }
    constructor() {
      this.appliedTheme = null;
      this.styleElement = null;
      this.canvasObserver = null;
      this.isInitialized = false;
      this.themes = {
        light: 'light.css',
        dark: 'dark.css',
        sepia: 'sepia.css',
        solarized: 'solarized.css',
        'high-contrast': 'high-contrast.css',
        'midnight-blue': 'midnight-blue.css',
        'forest-green': 'forest-green.css',
        'warm-amber': 'warm-amber.css'
      };
    }
  
    async applyTheme(themeName) {
      ThemeEngine.log(`Applying theme: ${themeName}`);
      
      if (!this.themes[themeName]) {
        const error = new Error(`Theme '${themeName}' is not supported`);
        ThemeEngine.error(error.message);
        throw error;
      }
      
      try {
        // Remove existing theme
        await this.removeCurrentTheme();
        
        try {
          // Load and apply new theme
          const themeCSS = await this.loadThemeCSS(themeName);
          this.injectThemeCSS(themeCSS, themeName);
          
          // Apply canvas filters with retry logic
          await this.applyCanvasFiltersWithRetry(themeName);
          
          // Set up canvas monitoring
          this.setupCanvasMonitoring(themeName);
          
          this.appliedTheme = themeName;
          
          // Save the applied theme
          await this.saveCurrentTheme(themeName);
          
        } catch (error) {
          console.error(`Failed to apply theme '${themeName}':`, error);
          // Revert to default theme on error
          if (themeName !== 'light') {
            console.log('Reverting to default light theme');
            await this.applyTheme('light');
          }
          throw error;
        }
      } catch (error) {
        console.error('Theme application failed:', error);
        throw error;
      }
    }
  
    async loadThemeCSS(themeName) {
      const themeFile = this.themes[themeName];
      if (!themeFile) {
        throw new Error(`Theme ${themeName} not found`);
      }
  
      const response = await fetch(chrome.runtime.getURL(`content/themes/${themeFile}`));
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${response.status}`);
      }
  
      return await response.text();
    }
  
    injectThemeCSS(css, themeName) {
      // Create style element
      this.styleElement = document.createElement('style');
      this.styleElement.id = `docs-theme-${themeName}`;
      this.styleElement.textContent = css;
      
      // Inject into document head
      document.head.appendChild(this.styleElement);
    }
  
    applyCanvasFilters(themeName) {
      try {
        ThemeEngine.log(`Applying canvas filters for theme: ${themeName}`);
        const filters = this.getCanvasFilters(themeName);
        
        if (!filters) {
          ThemeEngine.log('No canvas filters defined for this theme');
          return;
        }
    
        // Apply filters to all canvas elements
        const canvasElements = document.querySelectorAll('canvas');
        ThemeEngine.log(`Found ${canvasElements.length} canvas elements`);
        
        canvasElements.forEach((canvas, index) => {
          try {
            canvas.style.filter = filters;
            canvas.style.transition = 'filter 0.3s ease';
            ThemeEngine.log(`Applied filters to canvas #${index}`);
          } catch (error) {
            ThemeEngine.error(`Error applying filters to canvas #${index}:`, error);
          }
        });
    
        // Apply filters to page containers
        const pageContainers = document.querySelectorAll('.kix-page, .kix-page-paginated, .kix-page-content');
        ThemeEngine.log(`Found ${pageContainers.length} page containers`);
        
        pageContainers.forEach((container, index) => {
          try {
            // Only apply if it doesn't have a background color
            if (!container.style.backgroundColor) {
              container.style.filter = filters;
              container.style.transition = 'filter 0.3s ease';
              ThemeEngine.log(`Applied filters to container #${index}`);
            }
          } catch (error) {
            ThemeEngine.error(`Error applying filters to container #${index}:`, error);
          }
        });
      } catch (error) {
        ThemeEngine.error('Error in applyCanvasFilters:', error);
      }
    }
  
    getCanvasFilters(themeName) {
      const filterMap = {
        dark: 'invert(1) hue-rotate(180deg) contrast(0.9)',
        sepia: 'sepia(0.8) contrast(1.1) brightness(0.9)',
        solarized: 'sepia(0.3) hue-rotate(180deg) contrast(0.95)',
        'high-contrast': 'contrast(1.5) brightness(1.2)',
        'midnight-blue': 'hue-rotate(200deg) saturate(0.8) brightness(0.98) contrast(1.05)',
        'forest-green': 'hue-rotate(60deg) saturate(1.2) brightness(1.02) contrast(1.05)',
        'warm-amber': 'sepia(0.3) hue-rotate(-10deg) saturate(1.1) brightness(1.02) contrast(1.05)'
      };
  
      return filterMap[themeName] || null;
    }
  
    async saveCurrentTheme(themeName) {
      try {
        await chrome.storage.sync.set({ theme: themeName });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
    
    async applyCanvasFiltersWithRetry(themeName, retries = 3, delay = 300) {
      for (let i = 0; i < retries; i++) {
        try {
          this.applyCanvasFilters(themeName);
          return true;
        } catch (error) {
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setupCanvasMonitoring(themeName) {
      // Clean up existing observer
      if (this.canvasObserver) {
        this.canvasObserver.disconnect();
        this.canvasObserver = null;
      }

      // Function to handle canvas updates
      const handleCanvasUpdate = () => {
        try {
          this.applyCanvasFilters(themeName);
        } catch (error) {
          console.warn('Failed to update canvas filters:', error);
        }
      };

      // Monitor for new canvas elements
      this.canvasObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const canvasElements = node.tagName === 'CANVAS' ? 
                [node] : node.querySelectorAll('canvas');
              
              canvasElements.forEach(canvas => {
                const filters = this.getCanvasFilters(themeName);
                if (filters) {
                  canvas.style.filter = filters;
                }
              });
            }
          });
        });
      });
  
      this.canvasObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  
    async removeCurrentTheme() {
      ThemeEngine.log('Removing current theme');
      
      try {
        // Remove style element
        if (this.styleElement) {
          ThemeEngine.log('Removing style element');
          this.styleElement.remove();
          this.styleElement = null;
        }

        // Remove canvas filters
        const canvasElements = document.querySelectorAll('canvas');
        ThemeEngine.log(`Resetting filters on ${canvasElements.length} canvas elements`);
        canvasElements.forEach(canvas => {
          canvas.style.filter = '';
        });

        const pageContainers = document.querySelectorAll('.kix-page, .kix-page-paginated');
        ThemeEngine.log(`Resetting filters on ${pageContainers.length} page containers`);
        pageContainers.forEach(container => {
          container.style.filter = '';
        });

        // Clean up observer
        if (this.canvasObserver) {
          ThemeEngine.log('Disconnecting canvas observer');
          this.canvasObserver.disconnect();
          this.canvasObserver = null;
        }
        
        this.appliedTheme = null;
      } catch (error) {
        ThemeEngine.error('Error removing current theme:', error);
        throw error;
      }
    }
  }
  
// The theme engine class is now available globally