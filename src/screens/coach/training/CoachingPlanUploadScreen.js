//src/screens/coach/training/CoachingPlanUploadScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl
} from 'react-native';
import { Card, Button, ProgressBar, Surface, IconButton, Chip } from 'react-native-paper';
import DocumentProcessor from '../../../services/DocumentProcessor';
import PlatformUtils from '../../../utils/PlatformUtils';
import { COLORS, SPACING, TEXT_STYLES } from '../../../styles/themes';

// Load platform-safe components
const MaterialIcons = PlatformUtils.getSafeComponent('MaterialIcons');
const LinearGradient = PlatformUtils.getSafeComponent('LinearGradient');

// Move helper functions outside the component
const getFileIcon = (type) => {
  switch(type) {
    case 'application/pdf': return 'picture-as-pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'description';
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'grid-on';
    case 'text/csv': return 'table-chart';
    default: return 'insert-drive-file';
  }
};

const formatFileSize = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

// Get integrity status display info
const getIntegrityStatus = (document) => {
  if (!document.integrityCheck) {
    return { 
      color: '#FFA500', 
      text: 'Not Verified', 
      icon: 'help-outline',
      needsCheck: true 
    };
  }
  
  switch (document.integrityCheck.status) {
    case 'passed':
      return { 
        color: '#4CAF50', 
        text: 'Verified', 
        icon: 'verified',
        needsCheck: false 
      };
    case 'warning':
      return { 
        color: '#FF9800', 
        text: 'Warning', 
        icon: 'warning',
        needsCheck: false 
      };
    case 'failed':
      return { 
        color: '#F44336', 
        text: 'Failed', 
        icon: 'error',
        needsCheck: true 
      };
    case 'error':
      return { 
        color: '#F44336', 
        text: 'Error', 
        icon: 'error',
        needsCheck: true 
      };
    default:
      return { 
        color: '#9E9E9E', 
        text: 'Unknown', 
        icon: 'help-outline',
        needsCheck: true 
      };
  }
};

const CoachingPlanUploadScreen = ({ navigation }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [documents, setDocuments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);

  useEffect(() => {
    initializePlatform();
  }, []);

  const initializePlatform = async () => {
    try {
      await PlatformUtils.initializePlatform();
      setPlatformReady(true);
      loadDocuments();
      
      // Run automatic maintenance check
      await DocumentProcessor.scheduleIntegrityMaintenance();
    } catch (error) {
      console.error('Platform initialization failed:', error);
      setPlatformReady(true); // Continue anyway with fallbacks
      loadDocuments();
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await DocumentProcessor.getStoredDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      const platformError = PlatformUtils.handlePlatformError(error, 'Document Loading');
      Alert.alert('Error', platformError.message);
    }
  };

  const handleDocumentUpload = async () => {
    try {
      setUploading(true);
      setUploadProgress(0.1);
      setUploadStatus('Selecting document...');
      setIntegrityResult(null);

      // Step 1: Select document
      const file = await DocumentProcessor.selectDocument();
      if (!file) {
        setUploading(false);
        return;
      }

      setUploadProgress(0.3);
      setUploadStatus('Validating file format...');

      // Step 2: Validate file before storage
      const validation = DocumentProcessor.validateFileForPlatform(file);
      if (!validation.isValid) {
        showValidationError(validation);
        setUploading(false);
        return;
      }

      setUploadProgress(0.5);
      setUploadStatus('Storing file and checking integrity...');

      // Step 3: Store with integrity check
      const result = await DocumentProcessor.storeDocumentWithIntegrityCheck(file);
      setIntegrityResult(result.integrityResult);

      setUploadProgress(0.9);
      setUploadStatus('Integrity verification complete');

      await loadDocuments();

      // Step 4: Handle integrity results
      handleIntegrityResults(result);

    } catch (error) {
      console.error('Upload failed:', error);
      const platformError = PlatformUtils.handlePlatformError(error, 'Document Upload');
      showUploadError(platformError);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const showValidationError = (validation) => {
    Alert.alert(
      'File Validation Failed',
      `${validation.errors.join('\n')}\n\nSuggestions:\n${validation.suggestions.join('\n')}`,
      [{ text: 'OK' }]
    );
  };

  const showUploadError = (error) => {
    Alert.alert(
      'Upload Failed',
      `${error.message}\n\n${error.suggestions?.join('\n') || 'Please try again.'}`,
      [
        { text: 'Retry', onPress: () => handleDocumentUpload() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleIntegrityResults = (result) => {
    const { document, integrityResult } = result;

    switch (integrityResult.overallStatus) {
      case 'passed':
        showSuccessDialog(document, integrityResult);
        break;
      case 'warning':
        showWarningDialog(document, integrityResult);
        break;
      case 'failed':
        showFailureDialog(document, integrityResult);
        break;
      case 'error':
        showErrorDialog(document, integrityResult);
        break;
    }
  };

  const showSuccessDialog = (document, integrityResult) => {
    Alert.alert(
      'File Ready for Processing',
      `"${document.originalName}" uploaded successfully!\n\nSize: ${formatFileSize(document.size)}\nType: ${document.type}\nIntegrity: Verified\n\nReady to create training plan?`,
      [
        {
          text: 'Process Now',
          onPress: () => startProcessing(document)
        },
        {
          text: 'Save for Later',
          style: 'default',
          onPress: () => saveForLater(document)
        }
      ]
    );
  };

  const showWarningDialog = (document, integrityResult) => {
    const warnings = Object.values(integrityResult.checks)
      .flatMap(check => check.warnings || [])
      .slice(0, 3)
      .join('\n');

    Alert.alert(
      'File Uploaded with Warnings',
      `"${document.originalName}" uploaded but has some issues:\n\n${warnings}\n\nYou can still process it, but results may vary.`,
      [
        {
          text: 'Continue Processing',
          onPress: () => startProcessing(document)
        },
        {
          text: 'Try Different File',
          style: 'default',
          onPress: () => handleDocumentUpload()
        },
        {
          text: 'Save Anyway',
          style: 'cancel',
          onPress: () => saveForLater(document)
        }
      ]
    );
  };

  const showFailureDialog = (document, integrityResult) => {
    const issues = Object.values(integrityResult.checks)
      .flatMap(check => check.issues || [])
      .slice(0, 3)
      .join('\n');

    Alert.alert(
      'File Integrity Issues',
      `"${document.originalName}" has integrity issues:\n\n${issues}\n\nRecommendations:\n${integrityResult.recommendations.join('\n')}`,
      [
        {
          text: 'Try to Repair',
          onPress: () => attemptRepair(document)
        },
        {
          text: 'Process Anyway',
          style: 'destructive',
          onPress: () => startProcessing(document)
        },
        {
          text: 'Try Different File',
          style: 'cancel',
          onPress: () => handleDocumentUpload()
        }
      ]
    );
  };

  const showErrorDialog = (document, integrityResult) => {
    Alert.alert(
      'Critical Error',
      `Critical error during integrity check:\n\n${integrityResult.error}\n\nThe file may be corrupted or incompatible.`,
      [
        {
          text: 'Try Different File',
          onPress: () => handleDocumentUpload()
        },
        {
          text: 'Delete and Retry',
          style: 'destructive',
          onPress: () => deleteAndRetry(document)
        }
      ]
    );
  };

const startProcessing = (document) => {
  navigation.navigate('PlanProcessing', {
    documentId: document.id,
    onComplete: (trainingPlan) => {
      // This callback will be called when processing is complete
      console.log('Processing completed for:', trainingPlan?.title);
      
      // Navigate to TrainingPlanLibrary with success message
      navigation.navigate('TrainingPlanLibrary', {
        newPlanId: trainingPlan?.id,
        showSuccess: true,
        message: `"${trainingPlan?.title || 'Training Plan'}" has been successfully created!`
      });
    }
  });
};

const saveForLater = (document) => {
  Alert.alert(
    'Success!',
    `"${document.originalName}" saved to your document library. You can process it later.`,
    [
      {
        text: 'View Library',
        onPress: () => navigation.navigate('TrainingPlanLibrary')
      },
      { text: 'OK', style: 'cancel' }
    ]
  );
};

  const attemptRepair = async (document) => {
    try {
      Alert.alert('Repairing...', 'Attempting to repair file integrity issues.');
      const repairResult = await DocumentProcessor.repairDocumentIntegrity(document.id);
      
      if (repairResult.repaired) {
        Alert.alert(
          'Repair Successful',
          `File repaired!\n\nActions taken:\n${repairResult.actions.join('\n')}\n\nPost-repair status: ${repairResult.postRepairStatus}`,
          [
            {
              text: 'Process Now',
              onPress: () => startProcessing(document)
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
        await loadDocuments();
      } else {
        Alert.alert('No Repairs Needed', repairResult.message);
      }
    } catch (error) {
      Alert.alert(
        'Repair Failed',
        `Could not repair file:\n\n${error.message}\n\nTry uploading a different file.`
      );
    }
  };

  const deleteAndRetry = async (document) => {
    try {
      await DocumentProcessor.deleteDocument(document.id);
      await loadDocuments();
      handleDocumentUpload();
    } catch (error) {
      Alert.alert('Delete Failed', `Could not delete file: ${error.message}`);
    }
  };

  const handlePinDocument = async (document) => {
    try {
      const updatedDoc = {
        ...document,
        isPinned: !document.isPinned,
        pinnedAt: !document.isPinned ? new Date().toISOString() : null
      };
      
      await DocumentProcessor.updateDocumentMetadata(updatedDoc);
      await loadDocuments();
      
      Alert.alert(
        document.isPinned ? 'Document Unpinned' : 'Document Pinned',
        document.isPinned 
          ? 'Document can now be deleted normally'
          : 'Document is now protected from deletion'
      );
    } catch (error) {
      Alert.alert('Pin Error', `Could not pin document: ${error.message}`);
    }
  };

  const handleDeleteDocument = async (document) => {
    if (document.isPinned) {
      Alert.alert(
        'Cannot Delete Pinned Document',
        'This document is pinned and protected from deletion. Unpin it first to delete.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${document.originalName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DocumentProcessor.deleteDocument(document.id);
              await loadDocuments();
              Alert.alert('Success', 'Document deleted successfully');
            } catch (error) {
              Alert.alert('Delete Failed', `Could not delete document: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const handleFavoriteDocument = async (document) => {
    try {
      const updatedDoc = {
        ...document,
        isFavorite: !document.isFavorite,
        favoritedAt: !document.isFavorite ? new Date().toISOString() : null
      };
      
      await DocumentProcessor.updateDocumentMetadata(updatedDoc);
      await loadDocuments();
    } catch (error) {
      Alert.alert('Favorite Error', `Could not update favorite status: ${error.message}`);
    }
  };

  const runIntegrityCheck = async (document) => {
    try {
      Alert.alert('Checking...', 'Running integrity check on document.');
      const result = await DocumentProcessor.verifyFileIntegrity(document);
      
      const status = getIntegrityStatus({ integrityCheck: { status: result.overallStatus } });
      
      Alert.alert(
        'Integrity Check Complete',
        `Status: ${status.text}\n\n${result.recommendations.join('\n')}`,
        [{ text: 'OK' }]
      );
      
      await loadDocuments();
    } catch (error) {
      Alert.alert('Check Failed', `Integrity check failed: ${error.message}`);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  // Safe Icon component that works on both platforms
  const SafeIcon = ({ name, size = 24, color = COLORS.primary, style }) => {
    if (MaterialIcons) {
      return <MaterialIcons name={name} size={size} color={color} style={style} />;
    }
    const iconMap = {
      'cloud-upload': '☁️',
      'picture-as-pdf': '📄',
      'description': '📝',
      'grid-on': '📊',
      'table-chart': '📈',
      'insert-drive-file': '📄',
      'arrow-right': '→',
      'upload': '⬆️',
      'verified': '✓',
      'warning': '⚠',
      'error': '✗',
      'help-outline': '?',
      'security': '🔒',
      'favorite': '❤️',
      'heart-outline': '🤍',
      'map-marker-outline': '📌',
      'outline': '⭕',
      'delete-outline': '🗑️'
    };
    return (
      <Text style={[{ fontSize: size, color }, style]}>
        {iconMap[name] || '📄'}
      </Text>
    );
  };

  // Safe Gradient component that works on both platforms
  const SafeGradient = ({ colors = ['#667eea', '#764ba2'], style, children }) => {
    if (LinearGradient) {
      return <LinearGradient colors={colors} style={style}>{children}</LinearGradient>;
    }
    return (
      <View style={[{ backgroundColor: colors[0] }, style]}>
        {children}
      </View>
    );
  };

  // Document integrity status component
  const IntegrityStatusChip = ({ document }) => {
    const status = getIntegrityStatus(document);
    
    return (
      <View style={styles.integrityContainer}>
        <Chip
          icon={() => <SafeIcon name={status.icon} size={16} color="white" />}
          style={[styles.integrityChip, { backgroundColor: status.color }]}
          textStyle={styles.integrityChipText}
          compact
        >
          {status.text}
        </Chip>
        {status.needsCheck && (
          <Button
            mode="text"
            compact
            onPress={() => runIntegrityCheck(document)}
            style={styles.checkButton}
          >
            Check
          </Button>
        )}
      </View>
    );
  };

  if (!platformReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Initializing platform...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Header */}
      <SafeGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <Text style={styles.headerText}>Upload Coaching Plans</Text>
        <Text style={styles.headerSubtext}>
          Upload and verify your training plan documents with integrity checking
        </Text>
      </SafeGradient>

      {/* Upload Section */}
      <Surface style={styles.uploadSection}>
        <SafeIcon name="cloud-upload" size={48} color={COLORS.primary} />
        <Text style={styles.uploadTitle}>Select Your Coaching Plan</Text>
        <Text style={styles.uploadSubtitle}>
          {PlatformUtils.isWeb() 
            ? 'Supported formats: Word, Excel, CSV, TXT (Max 5MB)'
            : 'Supported formats: PDF, Word, Excel, CSV (Max 10MB)'
          }
        </Text>
        
        <Button
          mode="contained"
          onPress={handleDocumentUpload}
          disabled={uploading}
          style={styles.uploadButton}
          icon="upload"
        >
          {uploading 
            ? uploadStatus || PlatformUtils.getLoadingMessage('fileSelection')
            : 'Choose File'
          }
        </Button>

        {uploading && (
          <View style={styles.progressContainer}>
            <ProgressBar
              progress={uploadProgress}
              color={COLORS.primary}
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {Math.round(uploadProgress * 100)}% Complete
            </Text>
            {uploadStatus && (
              <Text style={styles.statusText}>{uploadStatus}</Text>
            )}
          </View>
        )}

        {integrityResult && !uploading && (
          <View style={styles.integrityResultContainer}>
            <SafeIcon name="security" size={24} color={COLORS.primary} />
            <Text style={styles.integrityResultText}>
              Integrity Status: {integrityResult.overallStatus}
            </Text>
          </View>
        )}
      </Surface>

      {/* Platform Info */}
      {PlatformUtils.isWeb() && (
        <Surface style={[styles.uploadSection, { marginTop: 0, paddingTop: SPACING.md }]}>
          <Text style={styles.platformNotice}>
            Web Platform: File integrity checking available. Some features may be limited.
          </Text>
        </Surface>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <View style={styles.documentsSection}>
          <Text style={styles.sectionTitle}>Uploaded Plans</Text>
          {documents.map((doc) => (
            <Card key={doc.id} style={styles.documentCard}>
              <Card.Content>
                <View style={styles.documentContainer}>
                  {/* Favorite Icon - Top Left */}
                  <View style={styles.favoriteContainer}>
                    <IconButton
                      icon={doc.isFavorite ? "favorite" : "favorite-border"}
                      iconColor={doc.isFavorite ? "#FF6B6B" : COLORS.secondary}
                      size={20}
                      onPress={() => handleFavoriteDocument(doc)}
                      style={styles.favoriteIcon}
                    />
                  </View>

                  {/* Pin Icon - Top Right */}
                  <View style={styles.pinContainer}>
                    <IconButton
                      icon={doc.isPinned ? "push-pin" : "outline"}
                      iconColor={doc.isPinned ? "#4CAF50" : COLORS.secondary}
                      size={18}
                      onPress={() => handlePinDocument(doc)}
                      style={styles.pinIcon}
                    />
                  </View>

                  <View style={styles.documentInfo}>
                    <SafeIcon 
                      name={getFileIcon(doc.type)} 
                      size={24} 
                      color={COLORS.primary} 
                    />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName}>{doc.originalName}</Text>
                      <Text style={styles.documentMeta}>
                        {formatFileSize(doc.size)} • {formatDate(doc.uploadedAt)}
                      </Text>
                      <Text style={styles.documentStatus}>
                        {doc.processed ? 'Processed' : 'Pending Processing'}
                      </Text>
                      <View style={styles.documentMetadata}>
                        {doc.platform && (
                          <Text style={styles.platformTag}>
                            {doc.platform === 'web' ? 'Web' : 'Mobile'}
                          </Text>
                        )}
                        <IntegrityStatusChip document={doc} />
                        {doc.isPinned && (
                          <Text style={styles.pinnedTag}>Pinned</Text>
                        )}
                      </View>
                      {doc.integrityCheck && (
                        <Text style={styles.integrityDate}>
                          Last checked: {formatDate(doc.integrityCheck.timestamp)}
                        </Text>
                      )}
                    </View>
                    <IconButton
                      icon="arrow-right"
                      size={20}
                      onPress={() => navigation.navigate('PlanProcessing', { documentId: doc.id })}
                    />
                  </View>

                  {/* Delete Icon - Bottom Right */}
                  <View style={styles.deleteContainer}>
                    <IconButton
                      icon="delete-outline"
                      iconColor={doc.isPinned ? COLORS.disabled : "#F44336"}
                      size={20}
                      onPress={() => handleDeleteDocument(doc)}
                      style={[
                        styles.deleteIcon,
                        doc.isPinned && styles.disabledIcon
                      ]}
                      disabled={doc.isPinned}
                    />
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {documents.length === 0 && !uploading && (
        <View style={styles.emptyState}>
          <SafeIcon name="description" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyText}>No coaching plans uploaded yet</Text>
          <Text style={styles.emptySubtext}>
            Upload your first training plan with automatic integrity verification
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  headerText: {
    ...TEXT_STYLES.h1,
    color: 'white',
    marginBottom: SPACING.xs,
  },
  headerSubtext: {
    ...TEXT_STYLES.body,
    color: 'rgba(255,255,255,0.9)',
  },
  uploadSection: {
    margin: SPACING.md,
    padding: SPACING.lg,
    alignItems: 'center',
    elevation: 2,
    ...PlatformUtils.getPlatformStyles(),
  },
  uploadTitle: {
    ...TEXT_STYLES.h3,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  uploadSubtitle: {
    ...TEXT_STYLES.caption,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    color: COLORS.secondary,
  },
  uploadButton: {
    paddingHorizontal: SPACING.lg,
  },
  progressContainer: {
    width: '100%',
    marginTop: SPACING.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    ...TEXT_STYLES.caption,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  statusText: {
    ...TEXT_STYLES.caption,
    textAlign: 'center',
    marginTop: SPACING.xs,
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  integrityResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceVariant || '#f5f5f5',
    borderRadius: 8,
  },
  integrityResultText: {
    ...TEXT_STYLES.caption,
    marginLeft: SPACING.sm,
    fontWeight: 'bold',
  },
  platformNotice: {
    ...TEXT_STYLES.caption,
    textAlign: 'center',
    color: COLORS.secondary,
    fontStyle: 'italic',
  },
  documentsSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    ...TEXT_STYLES.h3,
    marginBottom: SPACING.md,
  },
  documentCard: {
    marginBottom: SPACING.md,
    ...PlatformUtils.getPlatformStyles(),
  },
  documentContainer: {
    position: 'relative',
  },
  favoriteContainer: {
    position: 'absolute',
    top: -8,
    left: -8,
    zIndex: 2,
  },
  favoriteIcon: {
    margin: 0,
    width: 32,
    height: 32,
  },
  pinContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 2,
  },
  pinIcon: {
    margin: 0,
    width: 30,
    height: 30,
  },
  deleteContainer: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    zIndex: 2,
  },
  deleteIcon: {
    margin: 0,
    width: 32,
    height: 32,
  },
  disabledIcon: {
    opacity: 0.3,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  documentName: {
    ...TEXT_STYLES.subtitle,
    marginBottom: SPACING.xs,
  },
  documentMeta: {
    ...TEXT_STYLES.caption,
    color: COLORS.secondary,
  },
  documentStatus: {
    ...TEXT_STYLES.caption,
    marginTop: SPACING.xs,
  },
  documentMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  platformTag: {
    ...TEXT_STYLES.caption,
    fontSize: 10,
    color: COLORS.secondary,
    backgroundColor: COLORS.surfaceVariant || '#f5f5f5',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 4,
  },
  integrityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  integrityChip: {
    height: 24,
  },
  integrityChipText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  checkButton: {
    marginLeft: SPACING.xs,
  },
  integrityDate: {
    ...TEXT_STYLES.caption,
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: SPACING.xs / 2,
  },
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...TEXT_STYLES.h3,
    marginTop: SPACING.md,
    color: COLORS.secondary,
  },
  emptySubtext: {
    ...TEXT_STYLES.body,
    color: COLORS.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export default CoachingPlanUploadScreen;