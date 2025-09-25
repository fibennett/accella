//src/services/DocumentProcessor.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlatformUtils from '../utils/PlatformUtils';
import PDFProcessor from './PDFProcessor';

// Safe module variables - initialized to null
let DocumentPicker = null;
let RNFS = null;
let mammoth = null;
let XLSX = null;
//let PDFProcessor = null;
let modulesInitialized = false;

// Initialize PDF processor safely
const initializePDFProcessor = () => {
  try {
    if (!PDFProcessor) {
      // Use require instead of dynamic import to avoid Metro issues
      PDFProcessor = require('./PDFProcessor').default;
    }
    return PDFProcessor;
  } catch (error) {
    console.warn('PDFProcessor not available:', error.message);
    return null;
  }
};

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
// In DocumentProcessor.js, find the selectDocument method and replace it:
async selectDocument() {
  try {
    await this.ensureInitialized();
    
    PlatformUtils.logDebugInfo('Starting document selection');
    
    // Use the new user interaction method instead
    const result = await PlatformUtils.executeUserInteraction(
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
// In DocumentProcessor.js, replace the _selectDocumentWeb method:
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

      const resolveOnce = (value) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(value);
      };

      input.onchange = async (event) => {
        try {
          const file = event.target.files?.[0];
          if (!file) {
            resolveOnce(null);
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
          
          resolveOnce(result);
        } catch (error) {
          resolved = true;
          cleanup();
          reject(PlatformUtils.handlePlatformError(error, 'Web File Selection'));
        }
      };
      
      input.oncancel = () => {
        resolveOnce(null);
      };
      
      document.body.appendChild(input);
      
      // Trigger the file dialog immediately
      setTimeout(() => {
        if (!resolved) {
          input.click();
        }
      }, 10);
      
    } catch (error) {
      reject(PlatformUtils.handlePlatformError(error, 'Web File Input Creation'));
    }
  });
}

// Add this method to the DocumentProcessor class in DocumentProcessor.js
async scheduleIntegrityMaintenance() {
  try {
    // This method runs automatic maintenance checks on stored documents
    const documents = await this.getStoredDocuments();
    
    if (documents.length === 0) {
      PlatformUtils.logDebugInfo('No documents found for integrity maintenance');
      return;
    }
    
    let maintenanceResults = {
      totalDocuments: documents.length,
      checkedDocuments: 0,
      issuesFound: 0,
      repairsAttempted: 0,
      timestamp: new Date().toISOString()
    };
    
    // Check documents that haven't been checked recently
    for (const document of documents) {
      try {
        // Skip recently checked documents (within last 24 hours)
        if (document.integrityCheck && document.integrityCheck.timestamp) {
          const lastCheck = new Date(document.integrityCheck.timestamp);
          const hoursSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceCheck < 24) {
            continue; // Skip this document
          }
        }
        
        // Run integrity check
        const integrityResult = await this.verifyFileIntegrity(document);
        maintenanceResults.checkedDocuments++;
        
        if (integrityResult.overallStatus === 'failed' || integrityResult.overallStatus === 'error') {
          maintenanceResults.issuesFound++;
          
          // Try to repair if possible
          if (this.canRepairDocument(document)) {
            try {
              await this.repairDocumentIntegrity(document.id);
              maintenanceResults.repairsAttempted++;
            } catch (repairError) {
              console.warn('Could not repair document:', document.id, repairError.message);
            }
          }
        }
        
        // Update document with integrity check results
        document.integrityCheck = {
          timestamp: integrityResult.timestamp,
          status: integrityResult.overallStatus,
          lastChecked: new Date().toISOString()
        };
        
        await this.updateDocumentMetadata(document);
        
      } catch (error) {
        console.warn('Integrity maintenance failed for document:', document.id, error.message);
      }
    }
    
    PlatformUtils.logDebugInfo('Integrity maintenance completed', maintenanceResults);
    return maintenanceResults;
    
  } catch (error) {
    console.error('Integrity maintenance scheduling failed:', error);
    // Don't throw - this is a background operation
    return null;
  }
}

// Add these methods to the DocumentProcessor class

// Check if a document can be repaired
canRepairDocument(document) {
  try {
    // Basic checks for repairability
    if (!document || !document.id) return false;
    
    // Web documents with missing webFileData usually can't be repaired
    if (PlatformUtils.isWeb() && !document.webFileData) {
      return false;
    }
    
    // Mobile documents with missing local paths usually can't be repaired
    if (PlatformUtils.isMobile() && !document.localPath) {
      return false;
    }
    
    // Check if the document type is supported for repair
    const supportedTypes = [
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    return supportedTypes.includes(document.type);
  } catch (error) {
    return false;
  }
}

// Repair document integrity issues
async repairDocumentIntegrity(documentId) {
  try {
    const documents = await this.getStoredDocuments();
    const document = documents.find(doc => doc.id === documentId);
    
    if (!document) {
      throw PlatformUtils.createError('Document not found for repair');
    }
    
    const repairActions = [];
    let repaired = false;
    
    // Basic metadata repairs
    if (!document.uploadedAt) {
      document.uploadedAt = new Date().toISOString();
      repairActions.push('Added missing upload timestamp');
      repaired = true;
    }
    
    if (!document.platform) {
      document.platform = PlatformUtils.isWeb() ? 'web' : 'mobile';
      repairActions.push('Added missing platform identifier');
      repaired = true;
    }
    
    if (typeof document.processed !== 'boolean') {
      document.processed = false;
      repairActions.push('Fixed missing processed flag');
      repaired = true;
    }
    
    // Platform-specific repairs
    if (PlatformUtils.isWeb()) {
      // Web-specific repairs
      if (!document.webFileData && document.file) {
        try {
          // Try to restore file data if original file object still exists
          const buffer = await document.file.arrayBuffer();
          document.webFileData = Array.from(new Uint8Array(buffer));
          repairActions.push('Restored missing web file data');
          repaired = true;
        } catch (error) {
          repairActions.push('Could not restore web file data - file may need re-upload');
        }
      }
    } else {
      // Mobile-specific repairs
      if (document.localPath && RNFS) {
        try {
          const exists = await RNFS.exists(document.localPath);
          if (!exists) {
            repairActions.push('Local file missing - document may need re-upload');
          }
        } catch (error) {
          repairActions.push('Could not verify local file existence');
        }
      }
    }
    
    // Update the document if repairs were made
    if (repaired) {
      document.repairedAt = new Date().toISOString();
      await this.updateDocumentMetadata(document);
    }
    
    // Run post-repair integrity check
    const postRepairCheck = await this.verifyFileIntegrity(document);
    
    return {
      repaired,
      actions: repairActions,
      postRepairStatus: postRepairCheck.overallStatus,
      message: repaired 
        ? `Document repaired successfully: ${repairActions.join(', ')}`
        : 'No repairs needed or possible'
    };
    
  } catch (error) {
    throw PlatformUtils.handlePlatformError(error, 'Document Repair');
  }
}

  // Mobile document selection using expo-document-picker
  async _selectDocumentMobile() {
    try {
      if (!DocumentPicker) {
        throw PlatformUtils.createError(
          'Document picker not available',
          [
            'Install expo-document-picker',
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
// Web document storage with file data preservation
// Fixed _storeDocumentWeb method
async _storeDocumentWeb(file) {
  try {
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the file data for later processing - ensure it's properly stored
    let webFileData = null;
    try {
      if (file.file && typeof file.file.arrayBuffer === 'function') {
        webFileData = await file.file.arrayBuffer();
        console.log('File data stored successfully, size:', webFileData.byteLength);
      } else {
        console.warn('File object does not have arrayBuffer method');
      }
    } catch (error) {
      console.error('Could not store file data:', error.message);
      throw PlatformUtils.createError(
        'Could not read file data',
        ['Try selecting the file again', 'Ensure the file is not corrupted']
      );
    }
    
    if (!webFileData) {
      throw PlatformUtils.createError(
        'No file data available for storage',
        ['Try selecting the file again', 'Check if the file is accessible']
      );
    }
    
    const metadata = {
      id: documentId,
      originalName: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      processed: false,
      platform: 'web',
      uri: file.uri,
      // Store as Uint8Array for better serialization
      webFileData: Array.from(new Uint8Array(webFileData)),
      // Keep reference to original file object (won't be serialized to AsyncStorage)
      file: file.file
    };
    
    const existingDocs = await this.getStoredDocuments();
    existingDocs.push(metadata);
    
    await AsyncStorage.setItem('coaching_documents', JSON.stringify(existingDocs));
    
    PlatformUtils.logDebugInfo('Web document stored', { 
      documentId, 
      size: file.size,
      hasFileData: !!webFileData,
      dataSize: webFileData.byteLength
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
          ['Install expo-file-system', 'Check app permissions']
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
    
    // Check if a training plan already exists for this document
    const existingPlans = await this.getTrainingPlans();
    const existingPlan = existingPlans.find(plan => plan.sourceDocument === documentId);
    
    if (existingPlan) {
      console.log('Training plan already exists for document:', documentId);
      return existingPlan; // Return existing plan instead of creating new one
    }
    
    const documents = await this.getStoredDocuments();
    const document = documents.find(doc => doc.id === documentId);
    
    if (!document) {
      throw PlatformUtils.createError('Document not found in storage');
    }

    // Validate that we have file data before proceeding
    if (PlatformUtils.isWeb()) {
      if (!document.webFileData || !Array.isArray(document.webFileData) || document.webFileData.length === 0) {
        throw PlatformUtils.createError(
          'File data is missing or corrupted',
          [
            'Try uploading the file again',
            'Process the file immediately after upload',
            'Check if the browser cleared the data'
          ]
        );
      }
      console.log('Document has web file data, size:', document.webFileData.length);
    } else {
      if (!document.localPath) {
        throw PlatformUtils.createError(
          'Local file path is missing',
          ['Try uploading the file again', 'Check app permissions']
        );
      }
      
      // Verify file still exists on mobile
      if (RNFS) {
        const exists = await RNFS.exists(document.localPath);
        if (!exists) {
          throw PlatformUtils.createError(
            'File no longer exists on device',
            ['Try uploading the file again', 'Check device storage']
          );
        }
      }
    }

    PlatformUtils.logDebugInfo('Processing training plan', { 
      documentId, 
      type: document.type,
      platform: document.platform,
      hasWebData: !!document.webFileData,
      hasLocalPath: !!document.localPath
    });

    // Extract text content based on file type
      let extractedText = '';
      const fileType = document.type.toLowerCase();
      const fileName = document.originalName.toLowerCase();

      try {
        // Improve file type detection
        if (fileType.includes('word') || fileType.includes('document') || 
            (fileType.includes('officedocument.wordprocessingml') && !fileType.includes('spreadsheet'))) {
          extractedText = await this.extractWordText(document);
        } else if (fileType.includes('excel') || fileType.includes('sheet') || 
                  fileType.includes('spreadsheetml') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          extractedText = await this.extractExcelText(document);
        } else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
          extractedText = await this.extractCSVText(document);
        } else if (fileType.includes('text') || fileType.includes('plain') || fileName.endsWith('.txt')) {
          extractedText = await this.extractTextFile(document);
        } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
            const pdfProcessor = initializePDFProcessor();
            
            if (!pdfProcessor) {
              // Provide helpful fallback message
              extractedText = `
          PDF Processing Not Available
          ===========================

          Your PDF document "${document.originalName}" cannot be processed directly.

          Please convert your PDF to one of these supported formats:
          • Word Document (.docx) - Recommended
          • Text File (.txt)
          • CSV File (.csv)

          How to convert:
          1. Open your PDF in Microsoft Word or Google Docs
          2. Use File > Save As and select .docx format
          3. Upload the converted file

          This ensures your training plan can be properly processed and analyzed.
              `.trim();
            } else {
              try {
                // Validate PDF before processing
                const validation = await pdfProcessor.validatePDFDocument(document);
                if (!validation.isValid) {
                  throw PlatformUtils.createError(
                    `PDF validation failed: ${validation.errors.join(', ')}`,
                    validation.suggestions
                  );
                }
                
                extractedText = await pdfProcessor.extractTextFromPDF(document);
              } catch (pdfError) {
                console.warn('PDF processing failed, using fallback:', pdfError.message);
                extractedText = `
          PDF Processing Error
          ===================

          Unable to process "${document.originalName}" automatically.

          Error: ${pdfError.message}

          Please try:
          1. Converting to Word (.docx) format
          2. Copying text to a .txt file
          3. Using the web version for better PDF support

          Your training plan data is important - please convert to a supported format for best results.
                `.trim();
              }
            }
          } else {
          throw PlatformUtils.createError(
            `Unsupported file type: ${document.type}`,
            [
              'Use supported formats: .docx, .xlsx, .csv, .txt',
              'Convert your file to a supported format'
            ]
          );
        }
      } catch (extractionError) {
        console.error('Text extraction failed:', extractionError);
        throw extractionError;
      }

    if (!extractedText || extractedText.trim().length === 0) {
      throw PlatformUtils.createError(
        'No readable text found in the document',
        [
          'Check if the document contains text content',
          'Try opening the file in its native application first',
          'Ensure the file is not password protected'
        ]
      );
    }

    console.log('Text extracted successfully, length:', extractedText.length);

    // Process extracted text into training plan structure
    const trainingPlan = await this.parseTrainingPlanContent(extractedText, document);
    
    // Save processed training plan
    await this.saveTrainingPlan(trainingPlan);
    
    // Mark document as processed
  document.processed = true;
  document.processedAt = new Date().toISOString();
  document.linkedTrainingPlanId = trainingPlan.id; // Add reference to created plan
  await this.updateDocumentMetadata(document);

  PlatformUtils.logDebugInfo('Training plan processed successfully', { 
    planId: trainingPlan.id,
    sessionsCount: trainingPlan.sessionsCount,
    textLength: extractedText.length,
    documentAlreadyProcessed: false
  });

  {doc.linkedTrainingPlanId && (
  <View style={styles.processedIndicator}>
    <Icon name="check-circle" size={16} color="#4CAF50" />
    <Text style={styles.processedText}>Processed</Text>
  </View>
)}

  return trainingPlan;
  } catch (error) {
    console.error('Error processing training plan:', error);
    throw PlatformUtils.handlePlatformError(error, 'Training Plan Processing');
  }
}

// File Integrity Check System - Add these methods to DocumentProcessor.js

// 1. Main integrity check method - call this after storeDocument
async verifyFileIntegrity(document) {
  try {
    console.log('Starting file integrity check for:', document.id);
    
    const checks = {
      basic: await this.performBasicIntegrityCheck(document),
      storage: await this.performStorageIntegrityCheck(document),
      readability: await this.performReadabilityCheck(document),
      processing: await this.performProcessingReadinessCheck(document)
    };
    
    const overallStatus = this.evaluateIntegrityResults(checks);
    
    const result = {
      documentId: document.id,
      timestamp: new Date().toISOString(),
      platform: document.platform,
      overallStatus,
      checks,
      recommendations: this.generateIntegrityRecommendations(checks)
    };
    
    // Log the results
    PlatformUtils.logDebugInfo('File integrity check completed', {
      documentId: document.id,
      status: overallStatus,
      passed: overallStatus === 'passed',
      failedChecks: Object.keys(checks).filter(key => checks[key].status === 'failed')
    });
    
    return result;
  } catch (error) {
    console.error('File integrity check failed:', error);
    return {
      documentId: document.id,
      timestamp: new Date().toISOString(),
      overallStatus: 'error',
      error: error.message,
      checks: {},
      recommendations: ['Retry file upload', 'Check file format compatibility']
    };
  }
}

// 2. Basic file metadata integrity
async performBasicIntegrityCheck(document) {
  const issues = [];
  const warnings = [];
  
  try {
    // Check required fields
    if (!document.id) issues.push('Missing document ID');
    if (!document.originalName) issues.push('Missing original filename');
    if (!document.type) issues.push('Missing file type');
    if (!document.size || document.size <= 0) issues.push('Invalid file size');
    if (!document.uploadedAt) issues.push('Missing upload timestamp');
    
    // Check file type validity
    if (document.type && !this.supportedFormats.includes(document.type)) {
      issues.push(`Unsupported file type: ${document.type}`);
    }
    
    // Check file size limits
    if (document.size > this.fileSizeLimit) {
      issues.push(`File too large: ${document.size} bytes (limit: ${this.fileSizeLimit})`);
    }
    
    // Check filename extension matches type
    if (document.originalName && document.type) {
      const extensionMatch = this.validateFileExtension(document.originalName, document.type);
      if (!extensionMatch.valid) {
        warnings.push(extensionMatch.message);
      }
    }
    
    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      issues,
      warnings,
      metadata: {
        filename: document.originalName,
        type: document.type,
        size: document.size,
        sizeFormatted: this.formatFileSize(document.size)
      }
    };
  } catch (error) {
    return {
      status: 'error',
      issues: [`Basic check failed: ${error.message}`],
      warnings: [],
      metadata: {}
    };
  }
}

// 3. Storage integrity check
async performStorageIntegrityCheck(document) {
  const issues = [];
  const warnings = [];
  
  try {
    if (PlatformUtils.isWeb()) {
      // Web storage checks
      if (!document.webFileData) {
        issues.push('Web file data missing');
      } else {
        if (!Array.isArray(document.webFileData)) {
          issues.push('Web file data in wrong format (should be array)');
        } else {
          if (document.webFileData.length === 0) {
            issues.push('Web file data is empty');
          } else {
            // Verify data integrity by checking size consistency
            const expectedSize = document.size;
            const actualSize = document.webFileData.length;
            
            if (Math.abs(expectedSize - actualSize) > expectedSize * 0.1) {
              warnings.push(`Size mismatch: expected ${expectedSize}, got ${actualSize}`);
            }
          }
        }
      }
      
      // Check if document can be retrieved from storage
      const storedDocs = await this.getStoredDocuments();
      const retrievedDoc = storedDocs.find(doc => doc.id === document.id);
      if (!retrievedDoc) {
        issues.push('Document not found in storage after save');
      } else {
        if (!retrievedDoc.webFileData) {
          issues.push('File data lost during storage');
        }
      }
      
    } else {
      // Mobile storage checks
      if (!document.localPath) {
        issues.push('Local file path missing');
      } else {
        if (RNFS) {
          const exists = await RNFS.exists(document.localPath);
          if (!exists) {
            issues.push('File does not exist at local path');
          } else {
            // Check file size consistency
            const stat = await RNFS.stat(document.localPath);
            if (Math.abs(stat.size - document.size) > document.size * 0.1) {
              warnings.push(`File size mismatch: expected ${document.size}, got ${stat.size}`);
            }
          }
        } else {
          warnings.push('File system not available for verification');
        }
      }
    }
    
    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      issues,
      warnings,
      platform: document.platform,
      storageType: PlatformUtils.isWeb() ? 'webFileData' : 'localPath'
    };
  } catch (error) {
    return {
      status: 'error',
      issues: [`Storage check failed: ${error.message}`],
      warnings: [],
      platform: document.platform
    };
  }
}

// 4. File readability check
async performReadabilityCheck(document) {
  const issues = [];
  const warnings = [];
  
  try {
    let canRead = false;
    let sampleContent = '';
    let contentLength = 0;
    
    // Try to read a small portion of the file to verify it's accessible
    if (PlatformUtils.isWeb() && document.webFileData) {
      try {
        const buffer = new Uint8Array(document.webFileData).buffer;
        canRead = buffer.byteLength > 0;
        contentLength = buffer.byteLength;
        
        // For text files, try to read first few characters
        if (document.type.includes('text')) {
          const decoder = new TextDecoder('utf-8');
          const sample = new Uint8Array(buffer.slice(0, Math.min(100, buffer.byteLength)));
          sampleContent = decoder.decode(sample);
        }
      } catch (error) {
        issues.push(`Cannot create buffer from web file data: ${error.message}`);
      }
    } else if (!PlatformUtils.isWeb() && document.localPath && RNFS) {
      try {
        const stat = await RNFS.stat(document.localPath);
        canRead = stat.size > 0;
        contentLength = stat.size;
        
        // Try to read first few bytes
        if (document.type.includes('text')) {
          sampleContent = await RNFS.read(document.localPath, 100, 0, 'utf8');
        }
      } catch (error) {
        issues.push(`Cannot read mobile file: ${error.message}`);
      }
    }
    
    if (!canRead) {
      issues.push('File is not readable');
    }
    
    if (contentLength === 0) {
      issues.push('File appears to be empty');
    }
    
    // Check for common file corruption signs
    if (sampleContent) {
      if (sampleContent.includes('\uFFFD')) {
        warnings.push('File may contain corrupted characters');
      }
      if (sampleContent.trim().length === 0 && contentLength > 100) {
        warnings.push('File appears to contain only whitespace or binary data');
      }
    }
    
    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      issues,
      warnings,
      readableSize: contentLength,
      sampleLength: sampleContent.length,
      hasSample: sampleContent.length > 0
    };
  } catch (error) {
    return {
      status: 'error',
      issues: [`Readability check failed: ${error.message}`],
      warnings: [],
      readableSize: 0
    };
  }
}

// 5. Processing readiness check
async performProcessingReadinessCheck(document) {
  const issues = [];
  const warnings = [];
  
  try {
    const fileType = document.type.toLowerCase();
    
    // Check if we have the required libraries for this file type
    if (fileType.includes('word') || fileType.includes('document')) {
      if (!mammoth) {
        issues.push('Mammoth library not available for Word processing');
      }
    } else if (fileType.includes('excel') || fileType.includes('sheet')) {
      if (!XLSX) {
        issues.push('XLSX library not available for Excel processing');
      }
    } else if (fileType.includes('pdf')) {
      issues.push('PDF processing not supported');
    }
    
    // Check platform-specific requirements
    if (PlatformUtils.isWeb()) {
      if (fileType.includes('pdf')) {
        issues.push('PDF processing not supported on web platform');
      }
      if (document.size > 5 * 1024 * 1024) {
        warnings.push('Large files may cause browser performance issues');
      }
    }
    
    // Try a quick processing test if possible
    let processingTest = false;
    try {
      if (fileType.includes('text') || fileType.includes('csv')) {
        // Simple text processing test
        if (PlatformUtils.isWeb() && document.webFileData) {
          const buffer = new Uint8Array(document.webFileData).buffer;
          const decoder = new TextDecoder('utf-8');
          const sample = decoder.decode(buffer.slice(0, 100));
          processingTest = sample.length > 0;
        } else if (!PlatformUtils.isWeb() && RNFS && document.localPath) {
          const sample = await RNFS.read(document.localPath, 100, 0, 'utf8');
          processingTest = sample.length > 0;
        }
      }
    } catch (error) {
      warnings.push(`Processing test failed: ${error.message}`);
    }
    
    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      issues,
      warnings,
      fileType,
      librariesAvailable: {
        mammoth: !!mammoth,
        xlsx: !!XLSX
      },
      processingTestPassed: processingTest
    };
  } catch (error) {
    return {
      status: 'error',
      issues: [`Processing readiness check failed: ${error.message}`],
      warnings: [],
      fileType: document.type
    };
  }
}

// 6. Helper methods
validateFileExtension(filename, mimeType) {
  const extensionMap = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv'],
    'text/plain': ['.txt'],
    'application/pdf': ['.pdf']
  };
  
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const expectedExtensions = extensionMap[mimeType] || [];
  
  if (expectedExtensions.length === 0) {
    return { valid: true, message: 'Unknown file type for extension validation' };
  }
  
  const isValid = expectedExtensions.includes(extension);
  return {
    valid: isValid,
    message: isValid ? 'Extension matches file type' : `Extension ${extension} doesn't match type ${mimeType}`
  };
}

formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

evaluateIntegrityResults(checks) {
  const statuses = Object.values(checks).map(check => check.status);
  
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('failed')) return 'failed';
  if (statuses.every(status => status === 'passed')) return 'passed';
  return 'warning';
}

generateIntegrityRecommendations(checks) {
  const recommendations = [];
  
  Object.entries(checks).forEach(([checkName, result]) => {
    if (result.status === 'failed') {
      switch (checkName) {
        case 'basic':
          recommendations.push('Fix file metadata issues before processing');
          break;
        case 'storage':
          recommendations.push('Re-upload the file to fix storage issues');
          break;
        case 'readability':
          recommendations.push('Check if file is corrupted or in wrong format');
          break;
        case 'processing':
          recommendations.push('Use a different file format for better compatibility');
          break;
      }
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push('File integrity verified - ready for processing');
  }
  
  return recommendations;
}

// 7. Enhanced storeDocument with integrity check
// In DocumentProcessor.js, modify storeDocumentWithIntegrityCheck:
async storeDocumentWithIntegrityCheck(file) {
  try {
    console.log('Starting document storage with integrity check...');
    
    // Store the document first
    const document = await this.storeDocument(file);
    console.log('Document stored successfully:', {
      id: document.id,
      name: document.originalName,
      hasWebData: !!document.webFileData
    });
    
    // Perform integrity check
    const integrityResult = await this.verifyFileIntegrity(document);
    console.log('Integrity check completed:', integrityResult.overallStatus);
    
    // Add integrity info to document metadata
    document.integrityCheck = {
      timestamp: integrityResult.timestamp,
      status: integrityResult.overallStatus,
      lastChecked: new Date().toISOString()
    };
    
    // Update document with integrity results
    await this.updateDocumentMetadata(document);
    console.log('Document metadata updated with integrity results');
    
    // Verify the document was stored correctly
    const storedDocs = await this.getStoredDocuments();
    const foundDoc = storedDocs.find(doc => doc.id === document.id);
    console.log('Verification - document found in storage:', !!foundDoc);
    
    // Return both document and integrity results
    return {
      document,
      integrityResult
    };
  } catch (error) {
    console.error('Error in storeDocumentWithIntegrityCheck:', error);
    throw PlatformUtils.handlePlatformError(error, 'Document Storage with Integrity Check');
  }
}



  // Enhanced text extraction with better error handling
// Enhanced text extraction with better error handling and web file support
// Fixed extractWordText method
async extractWordText(document) {
  try {
    if (!mammoth) {
      throw PlatformUtils.createError(
        'Word processing library not available',
        ['Install mammoth library', 'Try using a text file instead']
      );
    }

    let buffer;
    console.log('Starting Word text extraction for document:', document.id);
    
    if (PlatformUtils.isWeb()) {
      // For web, get the stored file data
      const documents = await this.getStoredDocuments();
      const storedDoc = documents.find(doc => doc.id === document.id);
      
      if (storedDoc && storedDoc.webFileData) {
        console.log('Found stored web file data, length:', storedDoc.webFileData.length);
        // Convert back from stored array to ArrayBuffer
        buffer = new Uint8Array(storedDoc.webFileData).buffer;
        console.log('Converted to ArrayBuffer, byteLength:', buffer.byteLength);
      } else if (document.webFileData) {
        console.log('Using document webFileData directly');
        buffer = new Uint8Array(document.webFileData).buffer;
      } else {
        console.error('No web file data found for document:', document.id);
        throw PlatformUtils.createError(
          'File data not found - file may have been cleared from memory',
          [
            'Try uploading the file again',
            'Process the file immediately after upload',
            'Use a smaller file size'
          ]
        );
      }
    } else {
      // Mobile file processing
      if (!RNFS || !document.localPath) {
        throw PlatformUtils.createError('Mobile file not accessible');
      }
      console.log('Reading mobile file from:', document.localPath);
      const base64Data = await RNFS.readFile(document.localPath, 'base64');
      buffer = Buffer.from(base64Data, 'base64');
    }
    
    if (!buffer || buffer.byteLength === 0) {
      throw PlatformUtils.createError(
        'File buffer is empty or invalid',
        ['Check if the file is corrupted', 'Try re-uploading the file']
      );
    }
    
    console.log('Processing with mammoth, buffer size:', buffer.byteLength);
    
    // Use the correct mammoth API call
    const result = await mammoth.extractRawText({ 
      arrayBuffer: buffer 
    });
    
    if (!result || !result.value) {
      throw PlatformUtils.createError(
        'No text could be extracted from the Word document',
        ['Check if the document contains readable text', 'Try saving as .docx format']
      );
    }
    
    PlatformUtils.logDebugInfo('Word text extracted successfully', { 
      textLength: result.value.length,
      hasWarnings: result.messages && result.messages.length > 0
    });
    
    return result.value;
  } catch (error) {
    console.error('Word text extraction failed:', error);
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
      const documents = await this.getStoredDocuments();
      const storedDoc = documents.find(doc => doc.id === document.id);
      
      if (storedDoc && storedDoc.webFileData) {
        // Fix: Convert array back to Uint8Array
        buffer = new Uint8Array(storedDoc.webFileData);
      } else if (document.file) {
        buffer = await document.file.arrayBuffer();
        buffer = new Uint8Array(buffer);
      } else {
        throw PlatformUtils.createError('Web file not accessible - file data may have been cleared');
      }
    } else {
      if (!RNFS || !document.localPath) {
        throw PlatformUtils.createError('Mobile file not accessible');
      }
      const base64Data = await RNFS.readFile(document.localPath, 'base64');
      buffer = Buffer.from(base64Data, 'base64');
    }
    
    // Use 'array' type for web Uint8Array, 'buffer' for mobile Buffer
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
      const documents = await this.getStoredDocuments();
      const storedDoc = documents.find(doc => doc.id === document.id);
      
      if (storedDoc && storedDoc.webFileData) {
        // Fix: Convert array back to Uint8Array then to ArrayBuffer
        const uint8Array = new Uint8Array(storedDoc.webFileData);
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(uint8Array);
      } else if (document.file) {
        text = await document.file.text();
      } else {
        throw PlatformUtils.createError('Web file not accessible - file data may have been cleared');
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
    throw PlatformUtils.handlePlatformError(error, 'CSV Text Extraction');
  }
}

async extractTextFile(document) {
  try {
    let text;
    
    if (PlatformUtils.isWeb()) {
      const documents = await this.getStoredDocuments();
      const storedDoc = documents.find(doc => doc.id === document.id);
      
      if (storedDoc && storedDoc.webFileData) {
        // Fix: Convert array back to Uint8Array then decode
        const uint8Array = new Uint8Array(storedDoc.webFileData);
        const decoder = new TextDecoder('utf-8');
        text = decoder.decode(uint8Array);
      } else if (document.file) {
        text = await document.file.text();
      } else {
        throw PlatformUtils.createError('Web file not accessible - file data may have been cleared');
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
    throw PlatformUtils.handlePlatformError(error, 'Text File Extraction');
  }
}

  // Keep all your existing parsing methods unchanged but add error handling
// In DocumentProcessor.js, ensure the parseTrainingPlanContent method properly stores document names:
async parseTrainingPlanContent(text, document, options = {}) {
  try {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw PlatformUtils.createError('Document appears to be empty');
    }
    
    // Get enhanced user info
    const userInfo = await this.getUserInfo();
    const timestamp = Date.now();
    
    // Extract title that will serve as academy name
    const extractedTitle = this.extractTitle(lines, document.originalName);
    
    const trainingPlan = {
      id: `plan_${timestamp}`,
      title: extractedTitle, // This becomes the academy name
      academyName: extractedTitle, // Make this explicit
      
      // FIXED: Ensure all possible document name fields are populated
      originalName: document.originalName, // This is the actual uploaded file name
      sourceDocumentName: document.originalName, // Backup field
      documentFileName: document.originalName, // Additional backup
      
      category: this.extractCategory(lines),
      duration: this.extractDuration(lines),
      difficulty: this.extractDifficulty(lines),
      sessionsCount: this.extractSessionsCount(lines),
      description: this.extractDescription(lines),
      creator: userInfo.name || 'Coach', // Display name
      creatorUsername: userInfo.username, // Actual username
      creatorFirstName: userInfo.firstName,
      creatorLastName: userInfo.lastName,
      creatorProfileImage: userInfo.profileImage,
      rating: 0,
      downloads: 0,
      tags: this.extractTags(lines),
      image: null,
      isPublic: false,
      isOwned: true,
      progress: 0,
      price: null,
      
      // Additional metadata
      version: options.force ? 2 : 1,
      isReprocessed: !!options.force,
      originalDocumentProcessedAt: document.processedAt || null,
      createdAt: new Date().toISOString(),
      sourceDocument: document.id, // This links back to the document
      rawContent: text.substring(0, 10000),
      sessions: this.extractDetailedSessions(lines),
      schedule: this.extractSchedule(lines),
      platform: document.platform || (PlatformUtils.isWeb() ? 'web' : 'mobile'),
      
      // Debug information to help troubleshoot
      debugInfo: {
        documentId: document.id,
        documentOriginalName: document.originalName,
        documentType: document.type,
        extractedTitle: extractedTitle,
        createdAt: new Date().toISOString()
      }
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
  
  // Platform-specific validations - REMOVE PDF blocking for web
  if (PlatformUtils.isWeb()) {
    if (file.size > 5 * 1024 * 1024) {
      errors.push('File too large for web platform (5MB limit)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    suggestions: errors.length > 0 ? [
      'Use supported file formats (.docx, .xlsx, .csv, .txt, .pdf)',
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
// In DocumentProcessor.js, update the getUserInfo method:
// In DocumentProcessor.js, update the getUserInfo method:
async getUserInfo() {
  try {
    // Try multiple storage keys to find user data
    const storageKeys = [
      'authenticatedUser',
      'user_data', 
      'user_profile'
    ];
    
    for (const key of storageKeys) {
      try {
        const userInfo = await AsyncStorage.getItem(key);
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          
          return {
            username: parsed.username || null,
            firstName: parsed.firstName || null,
            lastName: parsed.lastName || null,
            fullName: `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || null,
            name: parsed.username || `${parsed.firstName || 'Coach'} ${parsed.lastName || ''}`.trim(),
            profileImage: parsed.profileImage || null
          };
        }
      } catch (error) {
        continue; // Try next key
      }
    }
  } catch (error) {
    console.log('Could not load user info:', error.message);
  }
  
  return { 
    username: null,
    firstName: 'Coach',
    lastName: '',
    fullName: 'Coach',
    name: 'Coach',
    profileImage: null
  };
}

// Fixed getStoredDocuments method
async getStoredDocuments() {
  try {
    const documents = await AsyncStorage.getItem('coaching_documents');
    const parsed = documents ? JSON.parse(documents) : [];
    
    // Validate document structure and restore web file data
    return parsed.map(doc => {
      const processedDoc = {
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
      };
      
      // Restore web file data if available
      if (PlatformUtils.isWeb() && doc.webFileData) {
        try {
          // Ensure webFileData is properly restored
          if (Array.isArray(doc.webFileData)) {
            processedDoc.webFileData = doc.webFileData;
            console.log('Restored web file data for document:', doc.id, 'size:', doc.webFileData.length);
          } else {
            console.warn('webFileData is not in expected array format for document:', doc.id);
          }
        } catch (error) {
          console.warn('Could not restore web file data for document:', doc.id, error.message);
        }
      }
      
      return processedDoc;
    });
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
      } else if (PlatformUtils.isWeb()) {
        // Clean up web resources
        if (document.uri && document.uri.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(document.uri);
          } catch (error) {
            console.warn('Could not revoke blob URL:', error.message);
          }
        }
        // No need to explicitly clean up webFileData - it will be garbage collected
      }
      
      const filteredDocs = documents.filter(doc => doc.id !== documentId);
      
      // Convert web file data for storage
      const docsToStore = filteredDocs.map(doc => {
        if (PlatformUtils.isWeb() && doc.webFileData) {
          return {
            ...doc,
            webFileData: Array.from(new Uint8Array(doc.webFileData))
          };
        }
        return doc;
      });
      
      await AsyncStorage.setItem('coaching_documents', JSON.stringify(docsToStore));
      
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
