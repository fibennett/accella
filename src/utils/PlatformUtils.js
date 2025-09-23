// src/utils/PlatformUtils.js
import { Platform } from 'react-native';

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

  // Safe import wrapper that handles missing modules
  static async safeImport(moduleName, fallback = null) {
    try {
      if (this.isWeb() && this.isWebIncompatible(moduleName)) {
        console.warn(`Module ${moduleName} is not compatible with web platform`);
        return fallback;
      }
      
      // Use static imports mapped by module name to avoid Metro bundler issues
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

  // Alternative approach: Direct module loaders for specific modules
  static async loadDocumentPicker() {
    if (this.isWeb()) {
      return null; // Not available on web
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
      return null; // Not available on web
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
      'react-native-keychain'
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
    // This would need RNFS for mobile platforms
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
      backgroundProcessing: false
    };

    const mobileSupported = {
      fileSelection: true,
      wordProcessing: true,
      excelProcessing: true,
      csvProcessing: true,
      pdfProcessing: true, // With appropriate library
      localFileSystem: true,
      nativeFilePicker: true,
      backgroundProcessing: true
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
      // Web doesn't need explicit file permissions
      return { granted: true, message: 'Web file access available' };
    }
    
    // Mobile would check storage permissions here
    try {
      // This would use react-native-permissions on mobile
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

  // Module availability check
  static checkModuleAvailability() {
    const availability = {
      platform: Platform.OS,
      modules: {}
    };

    // Check each module
    const modulesToCheck = [
      'react-native-document-picker',
      'react-native-fs', 
      'mammoth',
      'xlsx'
    ];

    modulesToCheck.forEach(moduleName => {
      try {
        if (this.isWeb() && this.isWebIncompatible(moduleName)) {
          availability.modules[moduleName] = { available: false, reason: 'web-incompatible' };
        } else {
          require(moduleName);
          availability.modules[moduleName] = { available: true, reason: 'loaded' };
        }
      } catch (error) {
        availability.modules[moduleName] = { available: false, reason: error.message };
      }
    });

    return availability;
  }
}

export default PlatformUtils;