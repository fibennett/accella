//src/services/DocumentProcessor.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlatformUtils from '../utils/PlatformUtils';

// Safe imports that won't break Metro bundler
let DocumentPicker = null;
let RNFS = null;
let mammoth = null;
let XLSX = null;

// Initialize platform-specific modules
const initializePlatformModules = async () => {
  try {
    if (PlatformUtils.isWeb()) {
      // Web-specific modules
      if (typeof window !== 'undefined') {
        try {
          mammoth = await PlatformUtils.loadMammoth();
          XLSX = await PlatformUtils.loadXLSX();
        } catch (error) {
          console.warn('Failed to load web modules:', error);
        }
      }
    } else {
      // Mobile-specific modules
      try {
        DocumentPicker = await PlatformUtils.loadDocumentPicker();
        RNFS = await PlatformUtils.loadFileSystem();
        mammoth = await PlatformUtils.loadMammoth();
        XLSX = await PlatformUtils.loadXLSX();
      } catch (error) {
        console.warn('Failed to load mobile modules:', error);
      }
    }
  } catch (error) {
    console.error('Module initialization failed:', error);
  }
};

class DocumentProcessor {
  constructor() {
    this.initialized = false;
    this.supportedFormats = PlatformUtils.getSupportedFormats();
    this.fileSizeLimit = PlatformUtils.getFileSizeLimit();
    
    // Initialize modules
    this.init();
  }

  async init() {
    if (!this.initialized) {
      await initializePlatformModules();
      this.initialized = true;
      PlatformUtils.logDebugInfo('DocumentProcessor initialized', {
        platform: Platform.OS,
        supportedFormats: this.supportedFormats.length,
        fileSizeLimit: this.fileSizeLimit
      });
    }
  }

  // Ensure initialization before any operation
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // Platform-agnostic document selection
  async selectDocument() {
    try {
      await this.ensureInitialized();
      
      PlatformUtils.logDebugInfo('Starting document selection');
      
      if (PlatformUtils.isWeb()) {
        return await this._selectDocumentWeb();
      } else {
        return await this._selectDocumentMobile();
      }
    } catch (error) {
      const platformError = PlatformUtils.createError(
        `Failed to select document: ${error.message}`,
        [
          'Check file format is supported',
          'Ensure file size is within limits',
          'Try selecting a different file'
        ]
      );
      
      console.error('Document selection error:', platformError);
      throw platformError;
    }
  }

  // Web document selection using HTML input
  async _selectDocumentWeb() {
    return new Promise((resolve, reject) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = PlatformUtils.getFileInputAccept();
        input.style.display = 'none';
        
        input.onchange = async (event) => {
          try {
            const file = event.target.files[0];
            if (!file) {
              resolve(null);
              return;
            }

            // Check file size
            if (file.size > this.fileSizeLimit) {
              throw PlatformUtils.createError(
                `File size exceeds ${Math.round(this.fileSizeLimit / 1024 / 1024)}MB limit`
              );
            }

            // Validate file type
            if (!this.supportedFormats.includes(file.type)) {
              throw PlatformUtils.createError(
                'Unsupported file type',
                ['Use .docx, .xlsx, .csv, or .txt files']
              );
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
            
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            if (document.body.contains(input)) {
              document.body.removeChild(input);
            }
          }
        };
        
        input.oncancel = () => {
          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
          resolve(null);
        };
        
        document.body.appendChild(input);
        input.click();
      } catch (error) {
        reject(PlatformUtils.createError(
          'Failed to create file input',
          ['Try refreshing the page', 'Use a different browser']
        ));
      }
    });
  }

  // Mobile document selection using react-native-document-picker
  async _selectDocumentMobile() {
    try {
      if (!DocumentPicker) {
        throw PlatformUtils.createError(
          'Document picker not available',
          ['Restart the app', 'Update to latest version']
        );
      }

      const result = await DocumentPicker.pick({
        type: this.supportedFormats,
        allowMultiSelection: false,
      });
      
      const file = result[0];
      
      // Check file size
      if (file.size > this.fileSizeLimit) {
        throw PlatformUtils.createError(
          `File size exceeds ${Math.round(this.fileSizeLimit / 1024 / 1024)}MB limit`
        );
      }
      
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
      throw error;
    }
  }

  // Platform-agnostic document storage
  async storeDocument(file) {
    try {
      await this.ensureInitialized();
      
      if (PlatformUtils.isWeb()) {
        return await this._storeDocumentWeb(file);
      } else {
        return await this._storeDocumentMobile(file);
      }
    } catch (error) {
      const platformError = PlatformUtils.createError(
        `Failed to store document: ${error.message}`,
        ['Check available storage space', 'Try a smaller file']
      );
      
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
      
      PlatformUtils.logDebugInfo('Web document stored', { documentId, size: file.size });
      
      return metadata;
    } catch (error) {
      throw PlatformUtils.createError(`Failed to store web document: ${error.message}`);
    }
  }

  // Mobile document storage
  async _storeDocumentMobile(file) {
    try {
      if (!RNFS) {
        throw PlatformUtils.createError('File system not available');
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
      
      PlatformUtils.logDebugInfo('Mobile document stored', { documentId, localPath });
      
      return metadata;
    } catch (error) {
      throw PlatformUtils.createError(`Failed to store mobile document: ${error.message}`);
    }
  }

  // Process training plan
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
        type: document.type 
      });

      // Extract text content based on file type
      let extractedText = '';
      const fileType = document.type.toLowerCase();
      
      if (fileType.includes('word') || fileType.includes('document')) {
        if (!PlatformUtils.isFeatureSupported('wordProcessing')) {
          throw PlatformUtils.createError('Word document processing not supported on this platform');
        }
        extractedText = await this.extractWordText(document);
      } else if (fileType.includes('excel') || fileType.includes('sheet')) {
        if (!PlatformUtils.isFeatureSupported('excelProcessing')) {
          throw PlatformUtils.createError('Excel document processing not supported on this platform');
        }
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
        sessionsCount: trainingPlan.sessionsCount 
      });

      return trainingPlan;
    } catch (error) {
      console.error('Error processing training plan:', error);
      throw error instanceof Error && error.suggestions 
        ? error 
        : PlatformUtils.createError(`Processing failed: ${error.message}`);
    }
  }

  // Platform-specific text extraction methods
  async extractPDFText(document) {
    // PDF extraction would require platform-specific implementation
    throw PlatformUtils.createError(
      'PDF text extraction requires additional setup',
      ['Use Word (.docx) or text (.txt) files instead']
    );
  }

  async extractWordText(document) {
    try {
      if (!mammoth) {
        throw PlatformUtils.createError('Word processing library not available');
      }

      let buffer;
      
      if (PlatformUtils.isWeb()) {
        if (document.uri) {
          const response = await fetch(document.uri);
          buffer = await response.arrayBuffer();
        } else {
          throw PlatformUtils.createError('Web file not accessible');
        }
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        const base64Data = await RNFS.readFile(document.localPath, 'base64');
        buffer = Buffer.from(base64Data, 'base64');
      }
      
      const result = await mammoth.extractRawText({ buffer });
      
      PlatformUtils.logDebugInfo('Word text extracted', { 
        textLength: result.value.length 
      });
      
      return result.value;
    } catch (error) {
      throw PlatformUtils.createError('Failed to extract Word document text');
    }
  }

  async extractExcelText(document) {
    try {
      if (!XLSX) {
        throw PlatformUtils.createError('Excel processing library not available');
      }

      let buffer;
      
      if (PlatformUtils.isWeb()) {
        if (document.uri) {
          const response = await fetch(document.uri);
          buffer = await response.arrayBuffer();
        } else {
          throw PlatformUtils.createError('Web file not accessible');
        }
      } else {
        if (!RNFS || !document.localPath) {
          throw PlatformUtils.createError('Mobile file not accessible');
        }
        const base64Data = await RNFS.readFile(document.localPath, 'base64');
        buffer = Buffer.from(base64Data, 'base64');
      }
      
      const workbook = XLSX.read(buffer, { type: PlatformUtils.isWeb() ? 'array' : 'buffer' });
      let extractedText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        extractedText += `Sheet: ${sheetName}\n`;
        data.forEach(row => {
          extractedText += row.join(' | ') + '\n';
        });
        extractedText += '\n';
      });
      
      PlatformUtils.logDebugInfo('Excel text extracted', { 
        textLength: extractedText.length,
        sheetsCount: workbook.SheetNames.length 
      });
      
      return extractedText;
    } catch (error) {
      throw PlatformUtils.createError('Failed to extract Excel text');
    }
  }

  async extractCSVText(document) {
    try {
      let text;
      
      if (PlatformUtils.isWeb()) {
        if (document.uri) {
          const response = await fetch(document.uri);
          text = await response.text();
        } else {
          throw PlatformUtils.createError('Web file not accessible');
        }
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
      throw PlatformUtils.createError('Failed to read CSV file');
    }
  }

  async extractTextFile(document) {
    try {
      let text;
      
      if (PlatformUtils.isWeb()) {
        if (document.uri) {
          const response = await fetch(document.uri);
          text = await response.text();
        } else {
          throw PlatformUtils.createError('Web file not accessible');
        }
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
      throw PlatformUtils.createError('Failed to read text file');
    }
  }

  // Document deletion
  async deleteDocument(documentId) {
    try {
      const documents = await this.getStoredDocuments();
      const document = documents.find(doc => doc.id === documentId);
      
      if (document) {
        if (PlatformUtils.isMobile() && document.localPath && RNFS) {
          try {
            await RNFS.unlink(document.localPath);
          } catch (error) {
            console.warn('Could not delete local file:', error);
          }
        } else if (PlatformUtils.isWeb() && document.uri) {
          try {
            URL.revokeObjectURL(document.uri);
          } catch (error) {
            console.warn('Could not revoke blob URL:', error);
          }
        }
        
        const filteredDocs = documents.filter(doc => doc.id !== documentId);
        await AsyncStorage.setItem('coaching_documents', JSON.stringify(filteredDocs));
        
        PlatformUtils.logDebugInfo('Document deleted', { documentId });
      }
      
      return true;
    } catch (error) {
      throw PlatformUtils.createError(`Failed to delete document: ${error.message}`);
    }
  }

  // Parse training plan content using simple text analysis
  async parseTrainingPlanContent(text, document) {
    try {
      const lines = text.split('\n').filter(line => line.trim());
      
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
        rawContent: text,
        sessions: this.extractDetailedSessions(lines),
        schedule: this.extractSchedule(lines),
        platform: document.platform || PlatformUtils.isWeb() ? 'web' : 'mobile'
      };

      return trainingPlan;
    } catch (error) {
      throw PlatformUtils.createError('Failed to parse training plan content');
    }
  }

  // Keep all your existing extraction methods unchanged
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

  // Utility methods
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
      console.log('Could not load user info');
    }
    
    return { name: 'Coach' };
  }

  async getStoredDocuments() {
    try {
      const documents = await AsyncStorage.getItem('coaching_documents');
      return documents ? JSON.parse(documents) : [];
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
      throw PlatformUtils.createError('Failed to save training plan');
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
      throw PlatformUtils.createError('Failed to update document metadata');
    }
  }

  async deleteTrainingPlan(planId) {
    try {
      const plans = await this.getTrainingPlans();
      const filteredPlans = plans.filter(plan => plan.id !== planId);
      await AsyncStorage.setItem('training_plans', JSON.stringify(filteredPlans));
      
      PlatformUtils.logDebugInfo('Training plan deleted', { planId });
      
      return true;
    } catch (error) {
      throw PlatformUtils.createError('Failed to delete training plan');
    }
  }

  async updatePlanProgress(planId, progress) {
    try {
      const plans = await this.getTrainingPlans();
      const planIndex = plans.findIndex(plan => plan.id === planId);
      
      if (planIndex !== -1) {
        plans[planIndex].progress = Math.min(100, Math.max(0, progress));
        await AsyncStorage.setItem('training_plans', JSON.stringify(plans));
        
        PlatformUtils.logDebugInfo('Plan progress updated', { 
          planId, 
          progress: plans[planIndex].progress 
        });
        
        return plans[planIndex];
      }
      
      throw PlatformUtils.createError('Plan not found');
    } catch (error) {
      throw PlatformUtils.createError('Failed to update plan progress');
    }
  }

  async togglePlanVisibility(planId) {
    try {
      const plans = await this.getTrainingPlans();
      const planIndex = plans.findIndex(plan => plan.id === planId);
      
      if (planIndex !== -1) {
        plans[planIndex].isPublic = !plans[planIndex].isPublic;
        await AsyncStorage.setItem('training_plans', JSON.stringify(plans));
        
        PlatformUtils.logDebugInfo('Plan visibility toggled', { 
          planId, 
          isPublic: plans[planIndex].isPublic 
        });
        
        return plans[planIndex];
      }
      
      throw PlatformUtils.createError('Plan not found');
    } catch (error) {
      throw PlatformUtils.createError('Failed to toggle plan visibility');
    }
  }

  // Additional utility methods
  async clearAllDocuments() {
    try {
      const documents = await this.getStoredDocuments();
      
      // Clean up platform-specific resources
      for (const doc of documents) {
        if (PlatformUtils.isMobile() && doc.localPath && RNFS) {
          try {
            await RNFS.unlink(doc.localPath);
          } catch (error) {
            console.warn('Could not delete file:', doc.localPath);
          }
        } else if (PlatformUtils.isWeb() && doc.uri) {
          try {
            URL.revokeObjectURL(doc.uri);
          } catch (error) {
            console.warn('Could not revoke blob URL:', doc.uri);
          }
        }
      }
      
      await AsyncStorage.removeItem('coaching_documents');
      
      PlatformUtils.logDebugInfo('All documents cleared', { 
        count: documents.length 
      });
      
      return true;
    } catch (error) {
      throw PlatformUtils.createError('Failed to clear documents');
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
      throw PlatformUtils.createError('Failed to get storage info');
    }
  }

  // Platform-specific validation
  validateFileForPlatform(file) {
    const errors = [];
    
    // Size validation
    if (file.size > this.fileSizeLimit) {
      errors.push(`File size exceeds ${Math.round(this.fileSizeLimit / 1024 / 1024)}MB limit`);
    }
    
    // Type validation
    if (!this.supportedFormats.includes(file.type)) {
      errors.push('Unsupported file type');
    }
    
    // Platform-specific validations
    if (PlatformUtils.isWeb()) {
      if (file.type === 'application/pdf') {
        errors.push('PDF processing not supported on web platform');
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

  // Platform capability check
  getCapabilities() {
    return {
      fileSelection: PlatformUtils.isFeatureSupported('fileSelection'),
      wordProcessing: PlatformUtils.isFeatureSupported('wordProcessing'),
      excelProcessing: PlatformUtils.isFeatureSupported('excelProcessing'),
      csvProcessing: PlatformUtils.isFeatureSupported('csvProcessing'),
      pdfProcessing: PlatformUtils.isFeatureSupported('pdfProcessing'),
      localFileSystem: PlatformUtils.isFeatureSupported('localFileSystem'),
      maxFileSize: this.fileSizeLimit,
      supportedFormats: this.supportedFormats,
      platform: PlatformUtils.isWeb() ? 'web' : 'mobile'
    };
  }

  // Health check for the service
  async healthCheck() {
    try {
      const capabilities = this.getCapabilities();
      const storageInfo = await this.getStorageInfo();
      const permissions = await PlatformUtils.checkPermissions();
      
      return {
        status: 'healthy',
        initialized: this.initialized,
        capabilities,
        storage: storageInfo,
        permissions,
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

  // Platform check utilities
  isWebPlatform() {
    return PlatformUtils.isWeb();
  }

  isMobilePlatform() {
    return PlatformUtils.isMobile();
  }
}

export default new DocumentProcessor();