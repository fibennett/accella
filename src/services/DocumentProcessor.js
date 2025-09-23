//src/services/DocumentProcessor.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlatformUtils from '../utils/PlatformUtils';

// Safe module variables - initialized to null
let DocumentPicker = null;
let RNFS = null;
let mammoth = null;
let XLSX = null;

// Safe initialization flag
let modulesInitialized = false;

// Safe module initialization that won't crash the app
const initializePlatformModules = async () => {
  if (modulesInitialized) return;

  try {
    PlatformUtils.logDebugInfo('Starting module initialization');
    
    if (PlatformUtils.isWeb()) {
      // Web-specific modules only
      try {
        mammoth = await PlatformUtils.loadMammoth();
        XLSX = await PlatformUtils.loadXLSX();
        PlatformUtils.logDebugInfo('Web modules loaded', { 
          mammoth: !!mammoth, 
          xlsx: !!XLSX 
        });
      } catch (error) {
        console.warn('Some web modules failed to load:', error.message);
      }
    } else {
      // Mobile-specific modules
      try {
        DocumentPicker = await PlatformUtils.loadDocumentPicker();
        RNFS = await PlatformUtils.loadFileSystem();
        mammoth = await PlatformUtils.loadMammoth();
        XLSX = await PlatformUtils.loadXLSX();
        PlatformUtils.logDebugInfo('Mobile modules loaded', { 
          documentPicker: !!DocumentPicker,
          rnfs: !!RNFS,
          mammoth: !!mammoth,
          xlsx: !!XLSX
        });
      } catch (error) {
        console.warn('Some mobile modules failed to load:', error.message);
      }
    }
    
    modulesInitialized = true;
    PlatformUtils.logDebugInfo('Module initialization completed');
    
  } catch (error) {
    console.error('Module initialization failed:', error);
    // Don't throw - allow app to continue with fallbacks
    modulesInitialized = true; // Mark as initialized to avoid retry loops
  }
};

class DocumentProcessor {
  constructor() {
    this.initialized = false;
    this.supportedFormats = PlatformUtils.getSupportedFormats();
    this.fileSizeLimit = PlatformUtils.getFileSizeLimit();
    this.initializationPromise = null;
    
    // Start initialization immediately but don't block constructor
    this.init();
  }

  async init() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInit();
    return this.initializationPromise;
  }

  async _performInit() {
    if (this.initialized) return;

    try {
      await initializePlatformModules();
      this.initialized = true;
      
      PlatformUtils.logDebugInfo('DocumentProcessor initialized', {
        platform: Platform.OS,
        supportedFormats: this.supportedFormats.length,
        fileSizeLimit: this.fileSizeLimit,
        modulesAvailable: {
          documentPicker: !!DocumentPicker,
          fileSystem: !!RNFS,
          mammoth: !!mammoth,
          xlsx: !!XLSX
        }
      });
    } catch (error) {
      console.error('DocumentProcessor initialization failed:', error);
      this.initialized = true; // Mark as initialized to avoid retry loops
    }
  }

  // Ensure initialization with timeout to prevent hanging
  async ensureInitialized(timeout = 5000) {
    if (this.initialized) return;

    try {
      await Promise.race([
        this.init(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), timeout)
        )
      ]);
    } catch (error) {
      console.warn('Initialization timeout or failed:', error.message);
      // Continue anyway - fallbacks should handle missing modules
      this.initialized = true;
    }
  }

  // Platform-agnostic document selection
  async selectDocument() {
    try {
      await this.ensureInitialized();
      
      PlatformUtils.logDebugInfo('Starting document selection');
      
      const result = await PlatformUtils.executePlatformSpecific(
        () => this._selectDocumentWeb(),
        () => this._selectDocumentMobile()
      );
      
      if (!result) {
        return null; // User cancelled
      }

      // Validate the selected file
      const validation = this.validateFileForPlatform(result);
      if (!validation.isValid) {
        throw PlatformUtils.createError(
          validation.errors.join(', '),
          validation.suggestions
        );
      }

      return result;
    } catch (error) {
      const platformError = PlatformUtils.handlePlatformError(error, 'Document Selection');
      console.error('Document selection error:', platformError);
      throw platformError;
    }
  }

  // Web document selection using HTML input
  async _selectDocumentWeb() {
    return new Promise((resolve, reject) => {
      try {
        if (typeof document === 'undefined') {
          reject(PlatformUtils.createError('Document API not available'));
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = PlatformUtils.getFileInputAccept();
        input.style.display = 'none';
        
        let resolved = false;

        const cleanup = () => {
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        input.onchange = async (event) => {
          if (resolved) return;
          resolved = true;

          try {
            const file = event.target.files?.[0];
            if (!file) {
              cleanup();
              resolve(null);
              return;
            }

            const result = {
              uri: URL.createObjectURL(file),
              type: file.type,
              name: file.name,
              size: file.size,
              file: file
            };
            
            PlatformUtils.logDebugInfo('Web file selected', {
              name: file.name,
              type: file.type,
              size: file.size
            });
            
            cleanup();
            resolve(result);
          } catch (error) {
            cleanup();
            reject(PlatformUtils.handlePlatformError(error, 'Web File Selection'));
          }
        };
        
        input.oncancel = input.onerror = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(null);
        };

        // Timeout fallback
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(null);
          }
        }, 30000); // 30 second timeout
        
        document.body.appendChild(input);
        input.click();
      } catch (error) {
        reject(PlatformUtils.handlePlatformError(error, 'Web File Input Creation'));
      }
    });
  }

  // Mobile document selection using react-native-document-picker
  async _selectDocumentMobile() {
    try {
      if (!DocumentPicker) {
        throw PlatformUtils.createError(
          'Document picker not available',
          [
            'Install react-native-document-picker',
            'Restart the app',
            'Update to latest version'
          ]
        );
      }

      const result = await DocumentPicker.pick({
        type: this.supportedFormats,
        allowMultiSelection: false,
      });
      
      const file = result[0];
      
      PlatformUtils.logDebugInfo('Mobile file selected', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      return file;
    } catch (error) {
      if (DocumentPicker?.isCancel && DocumentPicker.isCancel(error)) {
        return null; // User cancelled
      }
      throw PlatformUtils.handlePlatformError(error, 'Mobile File Selection');
    }
  }

  // Platform-agnostic document storage
  async storeDocument(file) {
    try {
      await this.ensureInitialized();
      
      return await PlatformUtils.executePlatformSpecific(
        () => this._storeDocumentWeb(file),
        () => this._storeDocumentMobile(file)
      );
    } catch (error) {
      const platformError = PlatformUtils.handlePlatformError(error, 'Document Storage');
      console.error('Document storage error:', platformError);
      throw platformError;
    }
  }

  // Web document storage
  async _storeDocumentWeb(file) {
    try {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const metadata = {
        id: documentId,
        originalName: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        processed: false,
        platform: 'web',
        uri: file.uri
      };
      
      const existingDocs = await this.getStoredDocuments();
      existingDocs.push(metadata);
      await AsyncStorage.setItem('coaching_documents', JSON.stringify(existingDocs));
      
      PlatformUtils.logDebugInfo('Web document stored', { 
        documentId, 
        size: file.size 
      });
      
      return metadata;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Web Document Storage');
    }
  }

  // Mobile document storage
  async _storeDocumentMobile(file) {
    try {
      if (!RNFS) {
        throw PlatformUtils.createError(
          'File system not available',
          ['Install react-native-fs', 'Check app permissions']
        );
      }

      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${documentId}_${file.name}`;
      const localPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      // Copy file to app's document directory
      await RNFS.copyFile(file.uri, localPath);
      
      const metadata = {
        id: documentId,
        originalName: file.name,
        localPath: localPath,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        processed: false,
        platform: 'mobile'
      };
      
      const existingDocs = await this.getStoredDocuments();
      existingDocs.push(metadata);
      await AsyncStorage.setItem('coaching_documents', JSON.stringify(existingDocs));
      
      PlatformUtils.logDebugInfo('Mobile document stored', { 
        documentId, 
        localPath 
      });
      
      return metadata;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Mobile Document Storage');
    }
  }

  // Process training plan with enhanced error handling
  async processTrainingPlan(documentId) {
    try {
      await this.ensureInitialized();
      
      const documents = await this.getStoredDocuments();
      const document = documents.find(doc => doc.id === documentId);
      
      if (!document) {
        throw PlatformUtils.createError('Document not found');
      }

      PlatformUtils.logDebugInfo('Processing training plan', { 
        documentId, 
        type: document.type,
        platform: document.platform 
      });

      // Extract text content based on file type
      let extractedText = '';
      const fileType = document.type.toLowerCase();
      
      if (fileType.includes('word') || fileType.includes('document')) {
        extractedText = await this.extractWordText(document);
      } else if (fileType.includes('excel') || fileType.includes('sheet')) {
        extractedText = await this.extractExcelText(document);
      } else if (fileType.includes('csv')) {
        extractedText = await this.extractCSVText(document);
      } else if (fileType.includes('text') || fileType.includes('plain')) {
        extractedText = await this.extractTextFile(document);
      } else if (fileType.includes('pdf')) {
        if (!PlatformUtils.isFeatureSupported('pdfProcessing')) {
          throw PlatformUtils.createError(
            'PDF processing not supported on this platform',
            ['Use Word (.docx) or text (.txt) files instead']
          );
        }
        extractedText = await this.extractPDFText(document);
      } else {
        throw PlatformUtils.createError('Unsupported file type for processing');
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw PlatformUtils.createError(
          'No text content could be extracted from the document',
          ['Check if the document contains readable text', 'Try a different file format']
        );
      }

      // Process extracted text into training plan structure
      const trainingPlan = await this.parseTrainingPlanContent(extractedText, document);
      
      // Save processed training plan
      await this.saveTrainingPlan(trainingPlan);
      
      // Mark document as processed
      document.processed = true;
      document.processedAt = new Date().toISOString();
      await this.updateDocumentMetadata(document);

      PlatformUtils.logDebugInfo('Training plan processed successfully', { 
        planId: trainingPlan.id,
        sessionsCount: trainingPlan.sessionsCount,
        textLength: extractedText.length
      });

      return trainingPlan;
    } catch (error) {
      console.error('Error processing training plan:', error);
      throw PlatformUtils.handlePlatformError(error, 'Training Plan Processing');
    }
  }

  // Enhanced text extraction with better error handling
  async extractWordText(document) {
    try {
      if (!mammoth) {
        throw PlatformUtils.createError(
          'Word processing library not available',
          ['Install mammoth library', 'Try using a text file instead']
        );
      }

      let buffer;
      
      if (PlatformUtils.isWeb()) {
        if (!document.uri) {
          throw PlatformUtils.createError('Web file not accessible');
        }
        const response = await fetch(document.uri);
        if (!response.ok) {
          throw PlatformUtils.createError('Failed to fetch file content');
        }
        buffer = await response.arrayBuffer();
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        const base64Data = await RNFS.readFile(document.localPath, 'base64');
        buffer = Buffer.from(base64Data, 'base64');
      }
      
      const result = await mammoth.extractRawText({ buffer });
      
      PlatformUtils.logDebugInfo('Word text extracted', { 
        textLength: result.value.length,
        hasWarnings: result.messages.length > 0
      });
      
      return result.value;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Word Text Extraction');
    }
  }

  async extractExcelText(document) {
    try {
      if (!XLSX) {
        throw PlatformUtils.createError(
          'Excel processing library not available',
          ['Install xlsx library', 'Try using a CSV file instead']
        );
      }

      let buffer;
      
      if (PlatformUtils.isWeb()) {
        if (!document.uri) {
          throw PlatformUtils.createError('Web file not accessible');
        }
        const response = await fetch(document.uri);
        if (!response.ok) {
          throw PlatformUtils.createError('Failed to fetch file content');
        }
        buffer = await response.arrayBuffer();
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        const base64Data = await RNFS.readFile(document.localPath, 'base64');
        buffer = Buffer.from(base64Data, 'base64');
      }
      
      const workbook = XLSX.read(buffer, { 
        type: PlatformUtils.isWeb() ? 'array' : 'buffer' 
      });
      
      let extractedText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        extractedText += `Sheet: ${sheetName}\n`;
        data.forEach(row => {
          const rowText = row.filter(cell => cell !== null && cell !== undefined).join(' | ');
          if (rowText.trim()) {
            extractedText += rowText + '\n';
          }
        });
        extractedText += '\n';
      });
      
      PlatformUtils.logDebugInfo('Excel text extracted', { 
        textLength: extractedText.length,
        sheetsCount: workbook.SheetNames.length 
      });
      
      return extractedText;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Excel Text Extraction');
    }
  }

  async extractCSVText(document) {
    try {
      let text;
      
      if (PlatformUtils.isWeb()) {
        if (!document.uri) {
          throw PlatformUtils.createError('Web file not accessible');
        }
        const response = await fetch(document.uri);
        if (!response.ok) {
          throw PlatformUtils.createError('Failed to fetch file content');
        }
        text = await response.text();
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        text = await RNFS.readFile(document.localPath, 'utf8');
      }
      
      PlatformUtils.logDebugInfo('CSV text extracted', { 
        textLength: text.length 
      });
      
      return text;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'CSV Text Extraction');
    }
  }

  async extractTextFile(document) {
    try {
      let text;
      
      if (PlatformUtils.isWeb()) {
        if (!document.uri) {
          throw PlatformUtils.createError('Web file not accessible');
        }
        const response = await fetch(document.uri);
        if (!response.ok) {
          throw PlatformUtils.createError('Failed to fetch file content');
        }
        text = await response.text();
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        text = await RNFS.readFile(document.localPath, 'utf8');
      }
      
      PlatformUtils.logDebugInfo('Text file extracted', { 
        textLength: text.length 
      });
      
      return text;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Text File Extraction');
    }
  }

  // PDF extraction placeholder
  async extractPDFText(document) {
    throw PlatformUtils.createError(
      'PDF text extraction not yet implemented',
      [
        'Use Word (.docx) files instead',
        'Convert PDF to Word format first',
        'Save as text (.txt) file'
      ]
    );
  }

  // Keep all your existing parsing methods unchanged but add error handling
  async parseTrainingPlanContent(text, document) {
    try {
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw PlatformUtils.createError('Document appears to be empty');
      }
      
      // Get user info from storage or default
      const userInfo = await this.getUserInfo();
      
      const trainingPlan = {
        id: `plan_${Date.now()}`,
        title: this.extractTitle(lines, document.originalName),
        category: this.extractCategory(lines),
        duration: this.extractDuration(lines),
        difficulty: this.extractDifficulty(lines),
        sessionsCount: this.extractSessionsCount(lines),
        description: this.extractDescription(lines),
        creator: userInfo.name || 'You',
        rating: 0,
        downloads: 0,
        tags: this.extractTags(lines),
        image: null,
        isPublic: false,
        isOwned: true,
        progress: 0,
        price: null,
        
        // Additional metadata
        createdAt: new Date().toISOString(),
        sourceDocument: document.id,
        rawContent: text.substring(0, 10000), // Limit stored content
        sessions: this.extractDetailedSessions(lines),
        schedule: this.extractSchedule(lines),
        platform: document.platform || (PlatformUtils.isWeb() ? 'web' : 'mobile')
      };

      return trainingPlan;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Training Plan Content Parsing');
    }
  }

  // Document validation specific to platform
  validateFileForPlatform(file) {
    const errors = [];
    
    // Basic validation
    if (!file || !file.size || !file.type || !file.name) {
      errors.push('Invalid file data');
      return { isValid: false, errors, suggestions: ['Select a valid file'] };
    }
    
    // Size validation
    if (file.size > this.fileSizeLimit) {
      errors.push(`File size exceeds ${Math.round(this.fileSizeLimit / 1024 / 1024)}MB limit`);
    }
    
    // Type validation
    if (!this.supportedFormats.includes(file.type)) {
      errors.push(`Unsupported file type: ${file.type}`);
    }
    
    // Platform-specific validations
    if (PlatformUtils.isWeb()) {
      if (file.type === 'application/pdf') {
        errors.push('PDF processing not supported on web platform');
      }
      if (file.size > 5 * 1024 * 1024) {
        errors.push('File too large for web platform (5MB limit)');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      suggestions: errors.length > 0 ? [
        'Use supported file formats (.docx, .xlsx, .csv, .txt)',
        `Keep file size under ${Math.round(this.fileSizeLimit / 1024 / 1024)}MB`,
        'Try compressing the file if it\'s too large'
      ] : []
    };
  }

  // All your existing extraction methods remain the same
  extractTitle(lines, filename) {
    const titlePatterns = [
      /^title:\s*(.+)/i,
      /^program:\s*(.+)/i,
      /^plan:\s*(.+)/i,
      /^(.+)\s*(training|program|plan|workout|routine)/i,
      /^week\s*1.*?[-:]?\s*(.+)/i,
      /^session\s*1.*?[-:]?\s*(.+)/i
    ];

    for (const line of lines.slice(0, 15)) {
      const trimmed = line.trim();
      if (trimmed.length < 5 || trimmed.length > 100) continue;
      
      for (const pattern of titlePatterns) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
          let title = match[1].trim();
          title = title.replace(/[:\-–—]/g, '').trim();
          if (title.length > 5) {
            return title;
          }
        }
      }
      
      if (/^[A-Z][a-zA-Z\s]+/.test(trimmed) && trimmed.length > 10 && trimmed.length < 80) {
        return trimmed;
      }
    }

    return filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  extractCategory(lines) {
    const text = lines.join(' ').toLowerCase();
    
    const categories = {
      football: ['football', 'american football', 'nfl', 'gridiron', 'tackle'],
      soccer: ['soccer', 'football', 'fifa', 'futbol', 'pitch'],
      basketball: ['basketball', 'nba', 'court', 'hoop', 'dribble'],
      tennis: ['tennis', 'racket', 'court', 'serve', 'volley'],
      fitness: ['fitness', 'gym', 'workout', 'exercise', 'strength', 'cardio', 'conditioning']
    };

    let bestCategory = 'fitness';
    let bestScore = 0;
    
    for (const [category, keywords] of Object.entries(categories)) {
      const score = keywords.reduce((sum, keyword) => {
        const matches = (text.match(new RegExp(keyword, 'gi')) || []).length;
        return sum + matches;
      }, 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  extractDuration(lines) {
    const text = lines.join(' ');
    
    const patterns = [
      /(\d+)\s*weeks?/i,
      /(\d+)\s*months?/i,
      /(\d+)\s*days?/i,
      /week\s*(\d+)/i,
      /month\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (pattern.toString().includes('month')) {
          return `${num} month${num > 1 ? 's' : ''}`;
        } else if (pattern.toString().includes('week') || pattern.toString().includes('Week')) {
          return `${num} week${num > 1 ? 's' : ''}`;
        } else {
          const weeks = Math.ceil(num / 7);
          return `${weeks} week${weeks > 1 ? 's' : ''}`;
        }
      }
    }
    
    return '8 weeks';
  }

  extractDifficulty(lines) {
    const text = lines.join(' ').toLowerCase();
    
    const difficultyKeywords = {
      beginner: ['beginner', 'basic', 'starter', 'introductory', 'novice', 'easy', 'foundation'],
      intermediate: ['intermediate', 'moderate', 'standard', 'regular', 'medium'],
      advanced: ['advanced', 'expert', 'professional', 'elite', 'pro', 'competitive', 'hard', 'intense']
    };
    
    let bestDifficulty = 'intermediate';
    let bestScore = 0;
    
    for (const [difficulty, keywords] of Object.entries(difficultyKeywords)) {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (text.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestDifficulty = difficulty;
      }
    }
    
    return bestDifficulty;
  }

  extractSessionsCount(lines) {
    const text = lines.join(' ');
    
    const sessionPatterns = [
      /(\d+)\s*sessions?/i,
      /session\s*(\d+)/i,
      /day\s*(\d+)/i,
      /workout\s*(\d+)/i
    ];
    
    let maxSessions = 0;
    
    for (const pattern of sessionPatterns) {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        const num = parseInt(match[1]);
        maxSessions = Math.max(maxSessions, num);
      }
    }
    
    if (maxSessions === 0) {
      const durationMatch = text.match(/(\d+)\s*weeks?/i);
      if (durationMatch) {
        const weeks = parseInt(durationMatch[1]);
        maxSessions = weeks * 3;
      }
    }
    
    return Math.max(maxSessions, 12);
  }

  extractDescription(lines) {
    const descriptionLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length < 30 || /^(week|day|session)\s*\d+/i.test(trimmed)) {
        continue;
      }
      
      if (/[.!?]$/.test(trimmed) && trimmed.length > 50) {
        descriptionLines.push(trimmed);
        if (descriptionLines.length >= 2) break;
      }
    }
    
    let description = descriptionLines.join(' ');
    
    if (description.length < 50) {
      const category = this.extractCategory(lines);
      const difficulty = this.extractDifficulty(lines);
      description = `A comprehensive ${difficulty} level ${category} training program designed to improve performance and achieve fitness goals.`;
    }
    
    return description.length > 200 ? description.substring(0, 197) + '...' : description;
  }

  extractTags(lines) {
    const text = lines.join(' ').toLowerCase();
    
    const possibleTags = [
      'strength', 'cardio', 'endurance', 'flexibility', 'power',
      'speed', 'agility', 'conditioning', 'core', 'upper body',
      'lower body', 'full body', 'recovery', 'warm up', 'cool down',
      'plyometric', 'resistance', 'bodyweight', 'weights', 'running',
      'jumping', 'balance', 'coordination', 'explosive', 'stamina',
      'youth', 'adult', 'professional', 'team', 'individual',
      'indoor', 'outdoor', 'gym', 'field', 'court'
    ];
    
    const foundTags = possibleTags.filter(tag => text.includes(tag));
    
    const category = this.extractCategory(lines);
    if (!foundTags.includes(category)) {
      foundTags.unshift(category);
    }
    
    return foundTags.slice(0, 5);
  }

  extractDetailedSessions(lines) {
    const sessions = [];
    let currentSession = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      const sessionMatch = trimmed.match(/^(week\s*\d+,?\s*)?(day\s*\d+|session\s*\d+|workout\s*\d+)/i);
      if (sessionMatch) {
        if (currentSession) {
          sessions.push(currentSession);
        }
        currentSession = {
          id: sessions.length + 1,
          title: trimmed,
          exercises: [],
          duration: null,
          notes: []
        };
      } else if (currentSession && trimmed.length > 10) {
        if (/\d+\s*(reps?|sets?|minutes?|seconds?)/.test(trimmed)) {
          currentSession.exercises.push(trimmed);
        } else {
          currentSession.notes.push(trimmed);
        }
      }
    }
    
    if (currentSession) {
      sessions.push(currentSession);
    }
    
    return sessions;
  }

  extractSchedule(lines) {
    const text = lines.join(' ').toLowerCase();
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const foundDays = days.filter(day => text.includes(day));
    
    if (foundDays.length > 0) {
      return {
        type: 'weekly',
        days: foundDays,
        pattern: `${foundDays.length} days per week`
      };
    }
    
    return {
      type: 'flexible',
      days: [],
      pattern: 'User-defined schedule'
    };
  }

  // Utility methods with enhanced error handling
  async getUserInfo() {
    try {
      const userInfo = await AsyncStorage.getItem('user_profile');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        return {
          name: `${parsed.firstName || 'Coach'} ${parsed.lastName || ''}`.trim()
        };
      }
    } catch (error) {
      console.log('Could not load user info:', error.message);
    }
    
    return { name: 'Coach' };
  }

  async getStoredDocuments() {
    try {
      const documents = await AsyncStorage.getItem('coaching_documents');
      const parsed = documents ? JSON.parse(documents) : [];
      
      // Validate document structure
      return parsed.map(doc => ({
        id: doc.id || `doc_${Date.now()}`,
        originalName: doc.originalName || 'Unknown Document',
        type: doc.type || 'text/plain',
        size: doc.size || 0,
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
        processed: doc.processed || false,
        platform: doc.platform || 'unknown',
        localPath: doc.localPath,
        uri: doc.uri,
        processedAt: doc.processedAt
      }));
    } catch (error) {
      console.error('Error loading stored documents:', error);
      return [];
    }
  }

  async getTrainingPlans() {
    try {
      const plans = await AsyncStorage.getItem('training_plans');
      const parsedPlans = plans ? JSON.parse(plans) : [];
      
      return parsedPlans.map(plan => ({
        id: plan.id || `plan_${Date.now()}`,
        title: plan.title || 'Untitled Plan',
        category: plan.category || 'fitness',
        duration: plan.duration || '8 weeks',
        difficulty: plan.difficulty || 'intermediate',
        sessionsCount: plan.sessionsCount || 12,
        description: plan.description || 'Training program description',
        creator: plan.creator || 'Coach',
        rating: plan.rating || 0,
        downloads: plan.downloads || 0,
        tags: plan.tags || [],
        image: plan.image || null,
        isPublic: plan.isPublic !== undefined ? plan.isPublic : false,
        isOwned: plan.isOwned !== undefined ? plan.isOwned : true,
        progress: plan.progress || 0,
        price: plan.price || null,
        createdAt: plan.createdAt || new Date().toISOString(),
        sourceDocument: plan.sourceDocument || null,
        sessions: plan.sessions || [],
        schedule: plan.schedule || { type: 'flexible', days: [], pattern: 'User-defined' },
        platform: plan.platform || 'unknown'
      }));
    } catch (error) {
      console.error('Error loading training plans:', error);
      return [];
    }
  }

  async saveTrainingPlan(trainingPlan) {
    try {
      const existingPlans = await this.getTrainingPlans();
      existingPlans.push(trainingPlan);
      await AsyncStorage.setItem('training_plans', JSON.stringify(existingPlans));
      
      PlatformUtils.logDebugInfo('Training plan saved', { 
        planId: trainingPlan.id,
        platform: trainingPlan.platform 
      });
      
      return trainingPlan;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Training Plan Save');
    }
  }

  async updateDocumentMetadata(updatedDoc) {
    try {
      const documents = await this.getStoredDocuments();
      const index = documents.findIndex(doc => doc.id === updatedDoc.id);
      if (index !== -1) {
        documents[index] = updatedDoc;
        await AsyncStorage.setItem('coaching_documents', JSON.stringify(documents));
        
        PlatformUtils.logDebugInfo('Document metadata updated', { 
          documentId: updatedDoc.id 
        });
      }
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Document Metadata Update');
    }
  }

  async deleteDocument(documentId) {
    try {
      const documents = await this.getStoredDocuments();
      const document = documents.find(doc => doc.id === documentId);
      
      if (document) {
        // Clean up platform-specific resources
        if (PlatformUtils.isMobile() && document.localPath && RNFS) {
          try {
            await RNFS.unlink(document.localPath);
          } catch (error) {
            console.warn('Could not delete local file:', error.message);
          }
        } else if (PlatformUtils.isWeb() && document.uri) {
          try {
            URL.revokeObjectURL(document.uri);
          } catch (error) {
            console.warn('Could not revoke blob URL:', error.message);
          }
        }
        
        const filteredDocs = documents.filter(doc => doc.id !== documentId);
        await AsyncStorage.setItem('coaching_documents', JSON.stringify(filteredDocs));
        
        PlatformUtils.logDebugInfo('Document deleted', { documentId });
      }
      
      return true;
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Document Deletion');
    }
  }

  // Health check with comprehensive status
  async healthCheck() {
    try {
      const capabilities = this.getCapabilities();
      const storageInfo = await this.getStorageInfo();
      const permissions = await PlatformUtils.checkPermissions();
      const moduleAvailability = PlatformUtils.checkModuleAvailability();
      
      return {
        status: 'healthy',
        initialized: this.initialized,
        capabilities,
        storage: storageInfo,
        permissions,
        moduleAvailability,
        platform: PlatformUtils.isWeb() ? 'web' : 'mobile',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        platform: PlatformUtils.isWeb() ? 'web' : 'mobile',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getStorageInfo() {
    try {
      const documents = await this.getStoredDocuments();
      const plans = await this.getTrainingPlans();
      
      let totalSize = 0;
      documents.forEach(doc => {
        totalSize += doc.size || 0;
      });
      
      return {
        documentsCount: documents.length,
        plansCount: plans.length,
        totalStorageUsed: totalSize,
        platform: PlatformUtils.isWeb() ? 'web' : 'mobile',
        storageLimit: this.fileSizeLimit,
        supportedFormats: this.supportedFormats
      };
    } catch (error) {
      throw PlatformUtils.handlePlatformError(error, 'Storage Info Retrieval');
    }
  }

  getCapabilities() {
    return {
      fileSelection: PlatformUtils.isFeatureSupported('fileSelection'),
      wordProcessing: PlatformUtils.isFeatureSupported('wordProcessing') && !!mammoth,
      excelProcessing: PlatformUtils.isFeatureSupported('excelProcessing') && !!XLSX,
      csvProcessing: PlatformUtils.isFeatureSupported('csvProcessing'),
      pdfProcessing: PlatformUtils.isFeatureSupported('pdfProcessing'),
      localFileSystem: PlatformUtils.isFeatureSupported('localFileSystem') && !!RNFS,
      maxFileSize: this.fileSizeLimit,
      supportedFormats: this.supportedFormats,
      platform: PlatformUtils.isWeb() ? 'web' : 'mobile',
      modulesLoaded: {
        documentPicker: !!DocumentPicker,
        fileSystem: !!RNFS,
        mammoth: !!mammoth,
        xlsx: !!XLSX
      }
    };
  }

  // Clean shutdown method
  async shutdown() {
    try {
      PlatformUtils.logDebugInfo('DocumentProcessor shutting down');
      
      // Clean up any resources if needed
      if (PlatformUtils.isWeb()) {
        // Revoke any blob URLs that might still be active
        const documents = await this.getStoredDocuments();
        documents.forEach(doc => {
          if (doc.uri && doc.uri.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(doc.uri);
            } catch (error) {
              console.warn('Error revoking blob URL:', error.message);
            }
          }
        });
      }
      
      this.initialized = false;
      modulesInitialized = false;
      
      return true;
    } catch (error) {
      console.warn('Error during shutdown:', error.message);
      return false;
    }
  }
}

// Create and export singleton instance
const documentProcessorInstance = new DocumentProcessor();

export default documentProcessorInstance;
