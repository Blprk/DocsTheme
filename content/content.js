// Content script - main entry point (Enhanced canvas filtering)
// Using ThemeEngine from themeEngine.js

class Debug {
  static DEBUG = true;
  static PREFIX = '[DocsThemeInjector]';
  
  static log(...args) {
    if (Debug.DEBUG) {
      console.log(Debug.PREFIX, ...args);
    }
  }
  
  static error(...args) {
    console.error(Debug.PREFIX, ...args);
  }
  
  static warn(...args) {
    console.warn(Debug.PREFIX, ...args);
  }
}

class DocsThemeInjector {
    constructor() {
      Debug.log('Initializing DocsThemeInjector');
      
      this.currentTheme = 'light';
      this.retryCount = 0;
      this.maxRetries = 10;
      this.appliedStyleId = 'docs-theme-style';
      this.initialized = false;
      this.canvasObserver = null;
      
      try {
        this.themeEngine = new ThemeEngine();
        this.init();
      } catch (error) {
        Debug.error('Failed to initialize ThemeEngine:', error);
        throw error;
      }
    }
  
    async init() {
      try {
        // Set default theme
        this.currentTheme = 'light';
        
        // Load saved theme
        try {
          const result = await chrome.storage.sync.get(['theme']);
          if (result.theme) {
            this.currentTheme = result.theme;
          }
        } catch (error) {
          console.warn('Failed to load saved theme, using default:', error);
        }
        
        // Mark as initialized
        this.initialized = true;
        
        // Wait for DOM and apply theme
        this.waitForDocsLoad();
        
        // Listen for theme changes
        this.setupMessageListener();
        
        // Listen for page visibility changes to reapply theme if needed
        const handleVisibilityChange = () => {
          if (!document.hidden && this.initialized) {
            this.reapplyCurrentTheme();
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Reapply theme when window regains focus
        const handleFocus = () => this.reapplyCurrentTheme();
        window.addEventListener('focus', handleFocus);
        
        // Store references for cleanup
        this.cleanup = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleFocus);
        };
        
      } catch (error) {
        console.error('Failed to initialize theme:', error);
      }
    }
  
    isGoogleDocs() {
      const url = window.location.href;
      Debug.log('Checking if URL is Google Docs:', url);
      
      // First check if we're on docs.google.com domain
      const isDocsDomain = /^(https?:\/\/)?docs\.google\.com\//i.test(url);
      if (isDocsDomain) {
        Debug.log('Detected docs.google.com domain');
        return true;
      }
      
      // Check for google.com/docs/* paths
      const isGoogleDocsPath = /^(https?:\/\/)?(www\.)?google\.(com|\w{2,3})\/docs\//i.test(url);
      if (isGoogleDocsPath) {
        Debug.log('Detected google.com/docs/ path');
        return true;
      }
      
      Debug.log('URL does not appear to be Google Docs');
      return false;

      // Check for Google Docs specific elements
      // Start with less specific selectors that appear early in the page load
      const docElements = [
        // Basic Google Docs elements
        '[role="document"]',
        '[role="textbox"]',
        '[role="toolbar"]',
        // Document container
        '.docs-texteventtarget-iframe',
        // Editor container
        '.kix-appview-editor',
        // Loading indicators
        '.loading-spinner-container',
        // Common UI elements
        '.docs-titlebar',
        '.docs-toolbar',
        // Canvas elements
        '.kix-canvas-tile-content'
      ];

      // Check if any of the elements exist
      const hasDocElements = docElements.some(selector => {
        const elements = document.querySelectorAll(selector);
        return elements.length > 0;
      });

      // If we found elements, return true
      if (hasDocElements) return true;

      // If no elements found yet, check for iframes that might contain the document
      const iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0) {
        // If there are iframes, this is likely a Google Docs page
        // that hasn't fully loaded yet
        return true;
      }

      // If we're on the domain but no elements found, it might be:
      // 1. A Google Docs page that hasn't loaded yet
      // 2. A Google Docs page that's in a different state
      // 3. A Google Docs page that has a different structure
      // In all cases, we should still try to apply the theme
      return true;
    }
    
    waitForDocsLoad() {
      Debug.log('Waiting for Google Docs to load...');
      
      const MAX_RETRIES = 10;
      const INITIAL_DELAY = 100; // ms
      const MAX_DELAY = 5000; // 5 seconds max delay
      let retryCount = 0;
      
      const checkDocsReady = () => {
        try {
          Debug.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} to detect Google Docs`);
          
          // Check if this is a Google Docs page
          const isDocs = this.isGoogleDocs();
          
          if (isDocs) {
            Debug.log('Google Docs detected, applying theme:', this.currentTheme);
            this.applyTheme(this.currentTheme)
              .then(() => {
                Debug.log('Theme applied successfully');
                
                // Notify background script that theme was applied
                chrome.runtime.sendMessage({
                  type: 'THEME_APPLIED',
                  theme: this.currentTheme,
                  url: window.location.href
                }).then(() => {
                  Debug.log('Notified background script of theme application');
                }).catch(error => {
                  // Ignore errors from background script not being ready
                  if (!error.message.includes('Could not establish connection')) {
                    Debug.warn('Failed to notify background script:', error);
                  }
                });
              })
              .catch(error => {
                Debug.error('Failed to apply theme:', error);
              });
            return true;
          }
          
          // If we have body content but no specific elements, still try to apply theme
          if (document.body && document.body.children.length > 0) {
            console.log('Document body found, checking if this is a Google Docs page');
            
            // Additional checks for iframes
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
              console.log('Found iframes, might be Google Docs loading');
              // Continue with retry logic below
            }
          }
          
          // If we've reached max retries, give up
          if (retryCount >= MAX_RETRIES) {
            console.error('Failed to detect Google Docs after maximum retries');
            return;
          }
          
          // Exponential backoff for retries
          const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY);
          console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
          
          // Schedule next check
          setTimeout(() => checkDocsReady(retryCount + 1), delay);
          
        } catch (error) {
          console.error('Error in checkDocsReady:', error);
          
          // If we get an error, try again with backoff
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY);
            setTimeout(() => checkDocsReady(retryCount + 1), delay);
          }
        }
      };
  
      // Initial check with a small delay to allow DOM to settle
      setTimeout(() => checkDocsReady(0), 100);
    }
  
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'APPLY_THEME') {
          this.applyTheme(message.theme);
          sendResponse({ success: true });
        }
        return true;
      });
    }
  
    async applyTheme(themeName) {
      Debug.log(`[applyTheme] Starting theme application for: ${themeName}`);
      
      if (!themeName) {
        Debug.warn('No theme name provided, using light theme');
        themeName = 'light';
      }
      
      // Don't reapply the same theme unless forced
      if (themeName === this.currentTheme && !this.forceApply) {
        Debug.log(`[applyTheme] Theme ${themeName} is already applied`);
        return true;
      }
      
      try {
        Debug.log(`[applyTheme] Loading CSS for theme: ${themeName}`);
        const css = await this.loadThemeCSS(themeName).catch(error => {
          throw new Error(`Failed to load theme CSS: ${error.message}`);
        });
        
        Debug.log(`[applyTheme] Removing current theme`);
        this.removeCurrentTheme();
        
        Debug.log(`[applyTheme] Injecting CSS for theme: ${themeName}`);
        this.injectThemeCSS(css, themeName);
        
        // Setup canvas monitoring before applying filters
        this.setupCanvasMonitoring(themeName);
        
        Debug.log(`[applyTheme] Applying canvas filters for theme: ${themeName}`);
        this.applyCanvasFilters(themeName);
        
        Debug.log(`[applyTheme] Saving theme preference: ${themeName}`);
        try {
          await chrome.storage.sync.set({ theme: themeName });
        } catch (storageError) {
          Debug.warn('Failed to save theme to storage:', storageError);
          // Continue even if storage fails
        }
        
        this.currentTheme = themeName;
        this.forceApply = false;
        
        Debug.log(`[applyTheme] Successfully applied theme: ${themeName}`);
        return true;
        
      } catch (error) {
        const errorMsg = `Failed to apply theme '${themeName}': ${error.message}`;
        Debug.error(errorMsg, error);
        
        // Fallback to light theme on error, but only if we're not already trying to apply light theme
        if (themeName !== 'light') {
          Debug.log(`[applyTheme] Falling back to light theme due to error`);
          this.forceApply = true; // Force apply to override any issues
          return await this.applyTheme('light');
        }
        
        // If we're already on the fallback theme, log the error and continue
        Debug.error('[applyTheme] Critical: Failed to apply default light theme');
        return false;
      }
    }
  
    async reapplyCurrentTheme() {
      try {
        console.log('Reapplying current theme:', this.currentTheme);
        await this.applyTheme(this.currentTheme);
      } catch (error) {
        console.error('Failed to reapply theme:', error);
      }
    }
  
    async loadThemeCSS(themeName) {
      Debug.log(`Loading theme: ${themeName}`);
      
      // List of all available themes with their file names
      const themeFiles = {
        'light': 'light.css',
        'dark': 'dark.css',
        'sepia': 'sepia.css',
        'solarized': 'solarized.css',
        'high-contrast': 'high-contrast.css',
        'midnight-blue': 'midnight-blue.css',
        'forest-green': 'forest-green.css',
        'warm-amber': 'warm-amber.css'
      };
      
      const themeFile = themeFiles[themeName];
      if (!themeFile) {
        const error = new Error(`Theme '${themeName}' is not supported`);
        Debug.error(error.message);
        throw error;
      }
      
      Debug.log(`Loading theme file: ${themeFile}`);
  
      try {
        const themePath = `content/themes/${themeFile}`;
        Debug.log(`Fetching theme from: ${themePath}`);
        
        const response = await fetch(chrome.runtime.getURL(themePath));
        if (!response.ok) {
          throw new Error(`Failed to load theme: ${response.status} ${response.statusText}`);
        }
        
        const css = await response.text();
        Debug.log(`Successfully loaded theme: ${themeName}`);
        return css;
      } catch (error) {
        Debug.error(`Error loading theme '${themeName}':`, error);
        throw new Error(`Failed to load theme '${themeName}': ${error.message}`);
      }
    }
  
    injectThemeCSS(css, themeName) {
      Debug.log(`Injecting CSS for theme: ${themeName}`);
      try {
        // Remove any existing theme styles first
        this.removeCurrentTheme();
        
        // Create and append the style element
        const styleElement = document.createElement('style');
        styleElement.id = `${this.appliedStyleId}-${themeName}`;
        styleElement.type = 'text/css';
        
        // Handle different browsers
        if (styleElement.styleSheet) {
          // For IE
          styleElement.styleSheet.cssText = css;
        } else {
          // For modern browsers
          styleElement.appendChild(document.createTextNode(css));
        }
        
        // Add to document
        (document.head || document.documentElement).appendChild(styleElement);
        Debug.log(`Successfully injected CSS for theme: ${themeName}`);
      } catch (error) {
        Debug.error(`Failed to inject CSS for theme ${themeName}:`, error);
        throw error;
      }
    }
  
    applyCanvasFilters(themeName) {
      Debug.log(`[applyCanvasFilters] Applying filters for theme: ${themeName}`);
      
      const filters = this.getCanvasFilters(themeName);
      if (!filters) {
        Debug.log(`[applyCanvasFilters] No filters defined for theme: ${themeName}`);
        return;
      }
  
      // Apply filters to all existing canvas elements
      Debug.log(`[applyCanvasFilters] Applying filters: ${filters}`);
      this.filterCanvasElements(filters);
      
      // Also apply to any iframes that might contain canvas elements
      this.applyFiltersToIframes(filters);
    }
  
    filterCanvasElements(filters) {
      // Target canvas elements
      const canvasElements = document.querySelectorAll('canvas');
      canvasElements.forEach(canvas => {
        canvas.style.filter = filters;
        canvas.style.transition = 'filter 0.3s ease';
      });
  
      // Target page containers that might contain rendered content
      const pageContainers = document.querySelectorAll('.kix-page, .kix-page-paginated, .kix-page-content-wrap');
      pageContainers.forEach(container => {
        // Only apply filter if it doesn't already have background styling
        if (!container.style.backgroundColor) {
          container.style.filter = filters;
          container.style.transition = 'filter 0.3s ease';
        }
      });
    }
  
    /**
     * Sets up a mutation observer to watch for new canvas elements and apply filters
     * @param {string} themeName - The name of the current theme
     */
    setupCanvasMonitoring(themeName) {
      Debug.log(`[setupCanvasMonitoring] Setting up canvas monitoring for theme: ${themeName}`);
      
      // Clean up existing observer
      if (this.canvasObserver) {
        Debug.log('[setupCanvasMonitoring] Disconnecting existing canvas observer');
        try {
          this.canvasObserver.disconnect();
        } catch (error) {
          Debug.error('[setupCanvasMonitoring] Error disconnecting existing observer:', error);
        }
        this.canvasObserver = null;
      }
  
      const filters = this.getCanvasFilters(themeName);
      if (!filters) {
        Debug.log('[setupCanvasMonitoring] No filters to apply, skipping observer setup');
        return;
      }
      
      Debug.log(`[setupCanvasMonitoring] Filters to apply to new canvases: ${filters}`);
  
      // Function to apply filters to a node
      const applyFiltersToNode = (node) => {
        try {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is a canvas
            if (node.tagName === 'CANVAS') {
              node.style.filter = filters;
              node.style.transition = 'filter 0.3s ease';
              Debug.log('[setupCanvasMonitoring] Applied filters to new canvas element');
            }
            
            // Check for canvas children
            if (node.querySelectorAll) {
              const canvasChildren = node.querySelectorAll('canvas');
              if (canvasChildren.length > 0) {
                Debug.log(`[setupCanvasMonitoring] Found ${canvasChildren.length} canvas children`);
                canvasChildren.forEach(canvas => {
                  canvas.style.filter = filters;
                  canvas.style.transition = 'filter 0.3s ease';
                });
              }
            }
          }
        } catch (error) {
          Debug.error('[setupCanvasMonitoring] Error applying filters to node:', error);
        }
      };
  
      // Create the observer
      this.canvasObserver = new MutationObserver((mutations) => {
        Debug.log(`[setupCanvasMonitoring] Processing ${mutations.length} mutations`);
        
        mutations.forEach((mutation) => {
          try {
            // Handle added nodes
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach(applyFiltersToNode);
            }
            
            // Handle attribute changes (in case canvas is recreated with same reference)
            if (mutation.type === 'attributes' && 
                mutation.target && 
                mutation.target.tagName === 'CANVAS') {
              applyFiltersToNode(mutation.target);
            }
          } catch (error) {
            Debug.error('[setupCanvasMonitoring] Error processing mutation:', error);
          }
        });
        
        // Also check for any iframes that might have been added
        this.applyFiltersToIframes(filters);
      });
  
      // Start observing the document with the configured parameters
      const observerConfig = {
        childList: true,    // Observe direct children
        subtree: true,      // Observe all descendants
        attributes: true,   // Watch for attribute changes
        attributeFilter: ['class', 'style'] // Only watch specific attributes
      };
      
      try {
        this.canvasObserver.observe(document.documentElement, observerConfig);
        Debug.log('[setupCanvasMonitoring] Canvas observer is now active');
      } catch (error) {
        Debug.error('[setupCanvasMonitoring] Failed to start observer:', error);
      }
    }
  
    getCanvasFilters(themeName) {
      const filterMap = {
        'dark': 'invert(1) hue-rotate(180deg) contrast(0.9) brightness(0.9)',
        'sepia': 'sepia(0.7) contrast(1.1) brightness(0.95) saturate(0.9)',
        'solarized': 'sepia(0.4) hue-rotate(180deg) contrast(0.95) brightness(0.9) saturate(0.8)',
        'high-contrast': 'invert(1) contrast(1.8) brightness(1.1)',
        'midnight-blue': 'hue-rotate(200deg) saturate(0.8) brightness(0.9) contrast(0.9)',
        'forest-green': 'hue-rotate(90deg) saturate(0.7) brightness(0.95) contrast(0.9)',
        'warm-amber': 'sepia(0.4) hue-rotate(340deg) saturate(1.2) brightness(0.95) contrast(0.9)'
      };
  
      const filters = filterMap[themeName];
      Debug.log(`[getCanvasFilters] Filters for ${themeName}: ${filters || 'none'}`);
      return filters;
    }
  
    /**
     * Applies canvas filters to all iframes in the document
     * @param {string} filters - The CSS filters to apply
     */
    applyFiltersToIframes(filters) {
      Debug.log(`[applyFiltersToIframes] Applying filters to iframes: ${filters}`);
      
      try {
        // Get all iframes in the document
        const iframes = document.querySelectorAll('iframe');
        Debug.log(`[applyFiltersToIframes] Found ${iframes.length} iframes`);
        
        iframes.forEach((iframe, index) => {
          try {
            // Skip cross-origin iframes that we can't access
            if (!iframe.contentDocument) {
              Debug.log(`[applyFiltersToIframes] Skipping iframe ${index} (no access to contentDocument)`);
              return;
            }
            
            // Apply filters to canvas elements inside the iframe
            const iframeCanvases = iframe.contentDocument.querySelectorAll('canvas');
            Debug.log(`[applyFiltersToIframes] Found ${iframeCanvases.length} canvases in iframe ${index}`);
            
            iframeCanvases.forEach(canvas => {
              try {
                canvas.style.filter = filters;
                canvas.style.transition = 'filter 0.3s ease';
              } catch (error) {
                Debug.error(`[applyFiltersToIframes] Error applying filters to canvas in iframe ${index}:`, error);
              }
            });
            
            // Also apply to any containers that might need it
            const containers = iframe.contentDocument.querySelectorAll('.kix-page, .kix-page-paginated, .kix-page-content-wrap');
            containers.forEach(container => {
              if (!container.style.backgroundColor) {
                container.style.filter = filters;
                container.style.transition = 'filter 0.3s ease';
              }
            });
            
          } catch (error) {
            Debug.error(`[applyFiltersToIframes] Error processing iframe ${index}:`, error);
          }
        });
        
      } catch (error) {
        Debug.error('[applyFiltersToIframes] Error finding iframes:', error);
      }
    }
    
    removeCurrentTheme() {
      Debug.log('Removing current theme styles');
      try {
        // Remove all theme styles
        const existingStyles = [
          ...document.querySelectorAll(`[id^="${this.appliedStyleId}"]`),
          ...document.querySelectorAll('style[id^="docs-theme-"]')
        ];
        
        existingStyles.forEach(style => {
          try {
            if (style && style.parentNode) {
              style.parentNode.removeChild(style);
            }
          } catch (error) {
            Debug.error('Error removing style element:', error);
          }
        });
    
        // Reset canvas filters
        const canvasElements = document.querySelectorAll('canvas');
        canvasElements.forEach(canvas => {
          try {
            canvas.style.filter = '';
            canvas.style.transition = '';
          } catch (error) {
            Debug.error('Error resetting canvas styles:', error);
          }
        });
    
        // Reset page container filters
        const pageContainers = document.querySelectorAll('.kix-page, .kix-page-paginated, .kix-page-content-wrap, .docs-homescreen-container');
        pageContainers.forEach(container => {
          try {
            container.style.filter = '';
            container.style.transition = '';
            container.style.backgroundColor = '';
          } catch (error) {
            Debug.error('Error resetting container styles:', error);
          }
        });
        
        // Reset canvas observer
        if (this.canvasObserver) {
          try {
            this.canvasObserver.disconnect();
          } catch (error) {
            Debug.error('Error disconnecting canvas observer:', error);
          }
          this.canvasObserver = null;
        }
        
        Debug.log('Successfully removed current theme');
      } catch (error) {
        Debug.error('Error in removeCurrentTheme:', error);
        throw error;
      }
    }
  }
  
  // Initialize when script loads
  new DocsThemeInjector();