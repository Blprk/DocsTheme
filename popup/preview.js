// Theme preview generator
export class ThemePreview {
    constructor() {
      this.themes = {
        light: {
          name: 'Light',
          colors: {
            toolbar: '#ffffff',
            page: '#ffffff',
            border: '#e8eaed',
            text: '#202124'
          }
        },
        dark: {
          name: 'Dark',
          colors: {
            toolbar: '#1f1f1f',
            page: '#1f1f1f',
            border: '#5f6368',
            text: '#e8eaed'
          }
        },
        sepia: {
          name: 'Sepia',
          colors: {
            toolbar: '#f4f1e8',
            page: '#f4f1e8',
            border: '#d4c4a8',
            text: '#3c3530'
          }
        },
        solarized: {
          name: 'Solarized',
          colors: {
            toolbar: '#fdf6e3',
            page: '#fdf6e3',
            border: '#93a1a1',
            text: '#657b83'
          }
        },
        'high-contrast': {
          name: 'High Contrast',
          colors: {
            toolbar: '#000000',
            page: '#000000',
            border: '#ffffff',
            text: '#ffffff'
          }
        }
      };
    }
  
    generatePreviewHTML(themeName) {
      const theme = this.themes[themeName];
      if (!theme) return '';
  
      return `
        <div class="theme-card" data-theme="${themeName}">
          <div class="theme-preview">
            <div class="preview-toolbar"></div>
            <div class="preview-page"></div>
          </div>
          <div class="theme-name">${theme.name}</div>
        </div>
      `;
    }
  
    generateAllPreviews() {
      return Object.keys(this.themes)
        .map(themeName => this.generatePreviewHTML(themeName))
        .join('');
    }
  
    getThemeData(themeName) {
      return this.themes[themeName];
    }
  
    getAllThemes() {
      return this.themes;
    }
  }
  
  // Export for use in popup.js
  window.ThemePreview = ThemePreview;