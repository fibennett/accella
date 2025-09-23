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
import { Card, Button, ProgressBar, Surface, IconButton } from 'react-native-paper';
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
  return bytes < 1024 * 1024 
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

const CoachingPlanUploadScreen = ({ navigation }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    initializePlatform();
  }, []);

  const initializePlatform = async () => {
    try {
      await PlatformUtils.initializePlatform();
      setPlatformReady(true);
      loadDocuments();
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

const handleUploadSuccess = (documentId) => {
  Alert.alert(
    'Upload Successful',
    'Your training plan has been uploaded successfully. Would you like to process it now?',
    [
      {
        text: 'Process Later',
        onPress: () => navigation.navigate('TrainingPlanLibrary')
      },
      {
        text: 'Process Now',
        onPress: () => navigation.navigate('PlanProcessing', { 
          documentId,
          onComplete: () => navigation.navigate('TrainingPlanLibrary')
        })
      }
    ]
  );
};

  const handleDocumentUpload = async () => {
    try {
      setUploading(true);
      setUploadProgress(0.1);

      const file = await DocumentProcessor.selectDocument();
      if (!file) {
        setUploading(false);
        return;
      }

      setUploadProgress(0.6);
      const metadata = await DocumentProcessor.storeDocument(file);
      setUploadProgress(1);

      await loadDocuments();
      handleUploadSuccess(metadata.id);
      
    } catch (error) {
      const platformError = PlatformUtils.handlePlatformError(error, 'Document Upload');
      Alert.alert('Upload Error', platformError.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
    // Fallback for when MaterialIcons isn't available
    const iconMap = {
      'cloud-upload': '☁️',
      'picture-as-pdf': '📄',
      'description': '📝',
      'grid-on': '📊',
      'table-chart': '📈',
      'insert-drive-file': '📄',
      'arrow-right': '→'
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
    // Fallback for when LinearGradient isn't available
    return (
      <View style={[{ backgroundColor: colors[0] }, style]}>
        {children}
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
          Upload PDF, Word, Excel, or CSV files containing your training plans
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
            ? PlatformUtils.getLoadingMessage('fileSelection')
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
          </View>
        )}
      </Surface>

      {/* Platform Info */}
      {PlatformUtils.isWeb() && (
        <Surface style={[styles.uploadSection, { marginTop: 0, paddingTop: SPACING.md }]}>
          <Text style={styles.platformNotice}>
            🌐 Web Platform: Some features may be limited. For full functionality, use the mobile app.
          </Text>
        </Surface>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <View style={styles.documentsSection}>
          <Text style={styles.sectionTitle}>📋 Uploaded Plans</Text>
          {documents.map((doc) => (
            <Card key={doc.id} style={styles.documentCard}>
              <Card.Content>
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
                      {doc.processed ? '✅ Processed' : '⏳ Pending Processing'}
                    </Text>
                    {doc.platform && (
                      <Text style={styles.platformTag}>
                        {doc.platform === 'web' ? '🌐 Web' : '📱 Mobile'}
                      </Text>
                    )}
                  </View>
                  <IconButton
                    icon="arrow-right"
                    size={20}
                    onPress={() => navigation.navigate('PlanProcessing', { documentId: doc.id })}
                  />
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
            Upload your first training plan to get started
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
  platformTag: {
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