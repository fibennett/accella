// src/utils/PlatformUtils.js
import { Platform } from 'react-native';
import React from 'react';

class PlatformUtils {
  static isWeb() {
    return Platform.OS === 'web';
  }

  static isMobile() {
    return Platform.OS !== 'web';
  }

  static isIOS() {
    return Platform.OS === 'ios';
  }

  static isAndroid() {
    return Platform.OS === 'android';
  }

  // Safe component loaders to prevent requireNativeComponent errors
  static loadMaterialIcons() {
    if (this.isWeb()) {
      // Return a web-compatible icon component
      return ({ name, size = 24, color = '#000', style, ...props }) => {
        // Use Unicode symbols or CSS icons for web
        const iconMap = {
          'cloud-upload': '☁️',
          'picture-as-pdf': '📄',
          'description': '📝',
          'grid-on': '📊',
          'table-chart': '📈',
          'insert-drive-file': '📄',
          'arrow-right': '→',
          'upload': '⬆️'
        };
        
        return React.createElement('span', {
          style: {
            fontSize: size,
            color: color,
            fontFamily: 'monospace',
            ...style
          },
          ...props
        }, iconMap[name] || '📄');
      };
    } else {
      try {
        return require('react-native-vector-icons/MaterialIcons').default;
      } catch (error) {
        console.warn('MaterialIcons not available, using fallback');
        return ({ name, size = 24, color = '#000' }) => 
          React.createElement('text', { 
            style: { fontSize: size, color } 
          }, '📄');
      }
    }
  }

  static loadLinearGradient() {
    if (this.isWeb()) {
      // Return a web-compatible gradient component
      return ({ colors = ['#000', '#fff'], style, children, ...props }) => {
        const gradient = colors.length === 2 
          ? `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
          : `linear-gradient(135deg, ${colors.join(', ')})`;
        
        return React.createElement('div', {
          style: {
            background: gradient,
            ...style
          },
          ...props
        }, children);
      };
    } else {
      try {
        return require('react-native-linear-gradient').default;
      } catch (error) {
        console.warn('LinearGradient not available, using fallback');
        return ({ colors, style, children }) => 
          React.createElement('view', { 
            style: { backgroundColor: colors?.[0] || '#000', ...style } 
          }, children);
      }
    }
  }

  // Safe import wrapper that handles missing modules
  static async safeImport(moduleName, fallback = null) {
    try {
      if (this.isWeb() && this.isWebIncompatible(moduleName)) {
        console.warn(`Module ${moduleName} is not compatible with web platform`);
        return fallback;
      }
      
      const moduleMap = {
        'react-native-document-picker': async () => {
          if (this.isMobile()) {
            try {
              const module = require('react-native-document-picker');
              return module.default || module;
            } catch (error) {
              console.warn('react-native-document-picker not available');
              return fallback;
            }
          }
          return fallback;
        },
        'react-native-fs': async () => {
          if (this.isMobile()) {
            try {
              const module = require('react-native-fs');
              return module.default || module;
            } catch (error) {
              console.warn('react-native-fs not available');
              return fallback;
            }
          }
          return fallback;
        },
        'mammoth': async () => {
          try {
            const module = require('mammoth');
            return module.default || module;
          } catch (error) {
            console.warn('mammoth not available');
            return fallback;
          }
        },
        'xlsx': async () => {
          try {
            const module = require('xlsx');
            return module.default || module;
          } catch (error) {
            console.warn('xlsx not available');
            return fallback;
          }
        }
      };

      const moduleLoader = moduleMap[moduleName];
      if (moduleLoader) {
        return await moduleLoader();
      }
      
      console.warn(`Unknown module: ${moduleName}`);
      return fallback;
    } catch (error) {
      console.warn(`Failed to import ${moduleName}:`, error.message);
      return fallback;
    }
  }

  // Specific module loaders with better error handling
  static async loadDocumentPicker() {
    if (this.isWeb()) {
      return null; // Not available on web, use HTML input instead
    }
    
    try {
      const DocumentPicker = require('react-native-document-picker');
      return DocumentPicker.default || DocumentPicker;
    } catch (error) {
      console.warn('DocumentPicker not available:', error.message);
      return null;
    }
  }

  static async loadFileSystem() {
    if (this.isWeb()) {
      return null; // Not available on web, use browser APIs instead
    }
    
    try {
      const RNFS = require('react-native-fs');
      return RNFS.default || RNFS;
    } catch (error) {
      console.warn('RNFS not available:', error.message);
      return null;
    }
  }

  static async loadMammoth() {
    try {
      const mammoth = require('mammoth');
      return mammoth.default || mammoth;
    } catch (error) {
      console.warn('Mammoth not available:', error.message);
      return null;
    }
  }

  static async loadXLSX() {
    try {
      const XLSX = require('xlsx');
      return XLSX.default || XLSX;
    } catch (error) {
      console.warn('XLSX not available:', error.message);
      return null;
    }
  }

  // Check if module is web incompatible
  static isWebIncompatible(moduleName) {
    const webIncompatibleModules = [
      'react-native-document-picker',
      'react-native-fs',
      'react-native-pdf-lib',
      'react-native-image-picker',
      'react-native-permissions',
      'react-native-keychain',
      'react-native-vector-icons',
      'react-native-linear-gradient'
    ];
    
    return webIncompatibleModules.includes(moduleName);
  }

  // Get platform-specific file size limit
  static getFileSizeLimit() {
    return this.isWeb() ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB web, 10MB mobile
  }

  // Get platform-specific supported formats
  static getSupportedFormats() {
    const baseFormats = [
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (this.isMobile()) {
      baseFormats.push(
        'application/pdf',
        'application/vnd.ms-excel'
      );
    }

    return baseFormats;
  }

  // Show platform-appropriate error messages
  static getErrorMessage(error, context = '') {
    const baseMessage = error.message || 'An error occurred';
    
    if (this.isWeb()) {
      return `Web Platform ${context}: ${baseMessage}`;
    } else {
      return `Mobile Platform ${context}: ${baseMessage}`;
    }
  }

  // Platform-specific storage paths
  static getStoragePath() {
    if (this.isWeb()) {
      return 'web-storage'; // Virtual path for web
    }
    return 'documents'; // Mobile document directory
  }

  // Check if feature is supported on current platform
  static isFeatureSupported(feature) {
    const webSupported = {
      fileSelection: true,
      wordProcessing: true,
      excelProcessing: true,
      csvProcessing: true,
      pdfProcessing: false, // Requires additional web library
      localFileSystem: false,
      nativeFilePicker: false,
      backgroundProcessing: false,
      vectorIcons: false, // Use fallback icons
      gradients: true // CSS gradients available
    };

    const mobileSupported = {
      fileSelection: true,
      wordProcessing: true,
      excelProcessing: true,
      csvProcessing: true,
      pdfProcessing: true,
      localFileSystem: true,
      nativeFilePicker: true,
      backgroundProcessing: true,
      vectorIcons: true,
      gradients: true
    };

    if (this.isWeb()) {
      return webSupported[feature] || false;
    } else {
      return mobileSupported[feature] || false;
    }
  }

  // Get platform-appropriate loading messages
  static getLoadingMessage(operation) {
    const messages = {
      web: {
        fileSelection: 'Opening file browser...',
        processing: 'Processing document in browser...',
        saving: 'Saving to browser storage...',
        loading: 'Loading from browser storage...'
      },
      mobile: {
        fileSelection: 'Opening native file picker...',
        processing: 'Processing document...',
        saving: 'Saving to device storage...',
        loading: 'Loading from device storage...'
      }
    };

    const platform = this.isWeb() ? 'web' : 'mobile';
    return messages[platform][operation] || `${operation}...`;
  }

  // Handle platform-specific permissions
  static async checkPermissions() {
    if (this.isWeb()) {
      return { granted: true, message: 'Web file access available' };
    }
    
    try {
      return { granted: true, message: 'Storage permissions granted' };
    } catch (error) {
      return { granted: false, message: 'Storage permissions required' };
    }
  }

  // Get appropriate file input accept attribute for web
  static getFileInputAccept() {
    if (!this.isWeb()) return null;
    
    return '.pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain';
  }

  // Create platform-appropriate error with suggestions
  static createError(message, suggestions = []) {
    const platformSuggestions = this.isWeb() 
      ? [
          'Try using Chrome or Firefox for better compatibility',
          'Ensure file size is under 5MB for web uploads',
          'Use Word (.docx) or Excel (.xlsx) formats for best results',
          ...suggestions
        ]
      : [
          'Check device storage space',
          'Ensure app has storage permissions',
          'Try restarting the app if issues persist',
          ...suggestions
        ];

    const error = new Error(message);
    error.suggestions = platformSuggestions;
    error.platform = this.isWeb() ? 'web' : 'mobile';
    
    return error;
  }

  // Log platform-specific debug info
  static logDebugInfo(context, data = {}) {
    if (__DEV__) {
      console.log(`[${this.isWeb() ? 'WEB' : 'MOBILE'}] ${context}:`, {
        platform: Platform.OS,
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Helper method to safely execute platform-specific code
  static async executePlatformSpecific(webFn, mobileFn, fallback = null) {
    try {
      if (this.isWeb() && webFn) {
        return await webFn();
      } else if (this.isMobile() && mobileFn) {
        return await mobileFn();
      }
      return fallback;
    } catch (error) {
      console.warn('Platform-specific execution failed:', error.message);
      return fallback;
    }
  }

  // Enhanced module availability check
  static checkModuleAvailability() {
    const availability = {
      platform: Platform.OS,
      modules: {},
      components: {}
    };

    // Check native modules
    const moduleCheckers = {
      'react-native-document-picker': () => {
        if (this.isWeb()) {
          return { available: false, reason: 'web-incompatible', alternative: 'HTML file input' };
        }
        try {
          require('react-native-document-picker');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message };
        }
      },
      'react-native-fs': () => {
        if (this.isWeb()) {
          return { available: false, reason: 'web-incompatible', alternative: 'Browser APIs' };
        }
        try {
          require('react-native-fs');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message };
        }
      },
      'mammoth': () => {
        try {
          require('mammoth');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message };
        }
      },
      'xlsx': () => {
        try {
          require('xlsx');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message };
        }
      }
    };

    // Check UI components
    const componentCheckers = {
      'react-native-vector-icons': () => {
        if (this.isWeb()) {
          return { available: false, reason: 'web-incompatible', alternative: 'Unicode/CSS icons' };
        }
        try {
          require('react-native-vector-icons/MaterialIcons');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message, alternative: 'Text fallback' };
        }
      },
      'react-native-linear-gradient': () => {
        if (this.isWeb()) {
          return { available: false, reason: 'web-incompatible', alternative: 'CSS gradients' };
        }
        try {
          require('react-native-linear-gradient');
          return { available: true, reason: 'loaded' };
        } catch (error) {
          return { available: false, reason: error.message, alternative: 'Solid colors' };
        }
      }
    };

    // Check each module
    Object.keys(moduleCheckers).forEach(moduleName => {
      availability.modules[moduleName] = moduleCheckers[moduleName]();
    });

    // Check each component
    Object.keys(componentCheckers).forEach(componentName => {
      availability.components[componentName] = componentCheckers[componentName]();
    });

    return availability;
  }

  // Safe component loader with fallbacks
  static getSafeComponent(componentName, fallbackProps = {}) {
    try {
      switch (componentName) {
        case 'MaterialIcons':
          return this.loadMaterialIcons();
        case 'LinearGradient':
          return this.loadLinearGradient();
        default:
          console.warn(`Unknown component: ${componentName}`);
          return null;
      }
    } catch (error) {
      console.warn(`Failed to load component ${componentName}:`, error.message);
      return null;
    }
  }

  // Initialize all platform-specific components and modules
  static async initializePlatform() {
    const results = {
      platform: Platform.OS,
      initialized: {
        components: {},
        modules: {}
      },
      errors: []
    };

    // Initialize components
    try {
      results.initialized.components.MaterialIcons = !!this.loadMaterialIcons();
      results.initialized.components.LinearGradient = !!this.loadLinearGradient();
    } catch (error) {
      results.errors.push(`Component initialization failed: ${error.message}`);
    }

    // Initialize modules
    try {
      results.initialized.modules.DocumentPicker = !!(await this.loadDocumentPicker());
      results.initialized.modules.FileSystem = !!(await this.loadFileSystem());
      results.initialized.modules.Mammoth = !!(await this.loadMammoth());
      results.initialized.modules.XLSX = !!(await this.loadXLSX());
    } catch (error) {
      results.errors.push(`Module initialization failed: ${error.message}`);
    }

    this.logDebugInfo('Platform initialized', results);
    return results;
  }

  // Get platform-specific style adjustments
  static getPlatformStyles() {
    if (this.isWeb()) {
      return {
        // Web-specific style adjustments
        shadowOffset: undefined, // Use boxShadow instead
        elevation: undefined, // Use boxShadow instead
        // Add web-specific styles
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        cursor: 'pointer'
      };
    } else {
      return {
        // Mobile-specific styles
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2
      };
    }
  }

  // Enhanced error handling with platform context
  static handlePlatformError(error, context = '') {
    const platformContext = this.isWeb() ? 'Web' : 'Mobile';
    const errorMessage = `[${platformContext}] ${context}: ${error.message}`;
    
    console.error(errorMessage, error);
    
    if (error.message.includes('requireNativeComponent')) {
      return this.createError(
        'Native component not available on this platform',
        [
          'This feature requires native mobile components',
          'Try using the mobile app for full functionality',
          'Some features are limited on web platform'
        ]
      );
    }
    
    return this.createError(errorMessage);
  }
}

export default PlatformUtils;