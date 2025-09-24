//src/screens/shared/DocumentViewer.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
  Linking,
  Share,
  Animated,
  Text as RNText,
  TouchableOpacity,
  PanResponder,
  BackHandler,
  AppState,
  TextInput,
} from 'react-native';
import {
  Surface,
  IconButton,
  Button,
  Text,
  Card,
  Chip,
  Portal,
  Modal,
  ProgressBar,
  Snackbar,
  Menu,
  Divider,
  Switch,
  Slider,
  FAB,
  Badge,
} from 'react-native-paper';
import { LinearGradient } from '../../components/shared/LinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Design system imports
import { COLORS } from '../../styles/colors';
import { SPACING } from '../../styles/spacing';
import { TEXT_STYLES } from '../../styles/textStyles';
import DocumentProcessor from '../../services/DocumentProcessor';
import PlatformUtils from '../../utils/PlatformUtils';
import AnalyticsService from '../../services/AnalyticsService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const DocumentViewer = ({ navigation, route }) => {
  const { document, planTitle } = route.params;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  // State management
  const [loading, setLoading] = useState(true);
  const [documentContent, setDocumentContent] = useState(null);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [viewMode, setViewMode] = useState('auto');
  const [error, setError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Enhanced states
  const [fontSize, setFontSize] = useState(16);
  const [darkMode, setDarkMode] = useState(false);
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [textWrap, setTextWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  const [viewingHistory, setViewingHistory] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [documentStats, setDocumentStats] = useState(null);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [readingProgress, setReadingProgress] = useState(0);
  const [estimatedReadTime, setEstimatedReadTime] = useState(0);
  
  // Refs
  const scrollViewRef = useRef(null);
  const webViewRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // File type detection with enhanced categorization
  const getFileType = (document) => {
    const type = document.type ? document.type.toLowerCase() : '';
    const name = document.originalName ? document.originalName.toLowerCase() : '';
    
    const typeMap = {
      pdf: ['pdf'],
      word: ['doc', 'docx', 'odt', 'rtf'],
      excel: ['xls', 'xlsx', 'ods', 'csv'],
      powerpoint: ['ppt', 'pptx', 'odp'],
      text: ['txt', 'md', 'markdown', 'log', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz'],
      video: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'],
      audio: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
    };

    for (const [category, extensions] of Object.entries(typeMap)) {
      if (extensions.some(ext => type.includes(ext) || name.endsWith(`.${ext}`))) {
        return category;
      }
    }
    return 'unknown';
  };

  const fileType = getFileType(document);
  
  // Enhanced file type information
  const getFileTypeInfo = (type) => {
    const fileTypes = {
      pdf: { 
        icon: 'picture-as-pdf', 
        color: '#FF5722', 
        label: 'PDF Document',
        capabilities: ['view', 'search', 'bookmark', 'share']
      },
      word: { 
        icon: 'description', 
        color: '#2196F3', 
        label: 'Word Document',
        capabilities: ['view', 'search', 'share']
      },
      excel: { 
        icon: 'grid-on', 
        color: '#4CAF50', 
        label: 'Spreadsheet',
        capabilities: ['view', 'download']
      },
      powerpoint: { 
        icon: 'slideshow', 
        color: '#FF9800', 
        label: 'Presentation',
        capabilities: ['view', 'download']
      },
      text: { 
        icon: 'text-snippet', 
        color: '#9C27B0', 
        label: 'Text Document',
        capabilities: ['view', 'search', 'edit', 'bookmark', 'share']
      },
      image: { 
        icon: 'image', 
        color: '#E91E63', 
        label: 'Image File',
        capabilities: ['view', 'zoom', 'share']
      },
      archive: { 
        icon: 'archive', 
        color: '#795548', 
        label: 'Archive File',
        capabilities: ['download']
      },
      video: { 
        icon: 'video-library', 
        color: '#F44336', 
        label: 'Video File',
        capabilities: ['play', 'share']
      },
      audio: { 
        icon: 'audiotrack', 
        color: '#3F51B5', 
        label: 'Audio File',
        capabilities: ['play', 'share']
      },
      unknown: { 
        icon: 'insert-drive-file', 
        color: '#757575', 
        label: 'Document',
        capabilities: ['download']
      }
    };
    return fileTypes[type] || fileTypes.unknown;
  };

  const fileInfo = getFileTypeInfo(fileType);

  // Enhanced document statistics calculation
  const calculateDocumentStats = useCallback((content) => {
    if (!content) return null;
    
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;
    const lines = content.split('\n').length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    // Average reading speed: 200-250 words per minute
    const avgReadingSpeed = 225;
    const estimatedReadTime = Math.ceil(words.length / avgReadingSpeed);
    
    return {
      words: words.length,
      characters,
      charactersNoSpaces,
      lines,
      paragraphs,
      estimatedReadTime,
    };
  }, []);

  // Load user preferences
  const loadUserPreferences = async () => {
    try {
      const preferences = await AsyncStorage.getItem('documentViewerPrefs');
      if (preferences) {
        const prefs = JSON.parse(preferences);
        setFontSize(prefs.fontSize || 16);
        setDarkMode(prefs.darkMode || false);
        setLineSpacing(prefs.lineSpacing || 1.5);
        setTextWrap(prefs.textWrap !== undefined ? prefs.textWrap : true);
        setShowLineNumbers(prefs.showLineNumbers || false);
      }
      
      // Load bookmarks for this document
      const documentBookmarks = await AsyncStorage.getItem(`bookmarks_${document.id}`);
      if (documentBookmarks) {
        setBookmarks(JSON.parse(documentBookmarks));
      }
      
      // Load viewing history
      const history = await AsyncStorage.getItem('documentViewingHistory');
      if (history) {
        setViewingHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Save user preferences
  const saveUserPreferences = async () => {
    try {
      const preferences = {
        fontSize,
        darkMode,
        lineSpacing,
        textWrap,
        showLineNumbers,
      };
      await AsyncStorage.setItem('documentViewerPrefs', JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Save viewing history
  const updateViewingHistory = async () => {
    try {
      const historyEntry = {
        documentId: document.id,
        documentName: document.originalName,
        viewedAt: new Date().toISOString(),
        readingProgress,
        scrollPosition: lastScrollPosition,
      };
      
      const history = [...viewingHistory.filter(h => h.documentId !== document.id), historyEntry]
        .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
        .slice(0, 50); // Keep only last 50 entries
      
      setViewingHistory(history);
      await AsyncStorage.setItem('documentViewingHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Error updating viewing history:', error);
    }
  };

  // Enhanced search functionality
  const performSearch = useCallback((query) => {
    if (!query || !documentContent) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(documentContent)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(documentContent.length, match.index + match[0].length + 50);
      const context = documentContent.substring(start, end);
      
      matches.push({
        index: match.index,
        text: match[0],
        context: context,
        line: documentContent.substring(0, match.index).split('\n').length,
      });
    }

    setSearchResults(matches);
    setCurrentSearchIndex(0);
  }, [documentContent]);

  // Debounced search
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, [performSearch]);

  // Bookmark management
  const toggleBookmark = async (position) => {
    try {
      const existingIndex = bookmarks.findIndex(b => Math.abs(b.position - position) < 100);
      
      let newBookmarks;
      if (existingIndex >= 0) {
        // Remove existing bookmark
        newBookmarks = bookmarks.filter((_, index) => index !== existingIndex);
        setSnackbarMessage('Bookmark removed');
      } else {
        // Add new bookmark
        const bookmark = {
          id: Date.now(),
          position,
          timestamp: new Date().toISOString(),
          preview: documentContent ? documentContent.substring(position, position + 100) : '',
        };
        newBookmarks = [...bookmarks, bookmark].sort((a, b) => a.position - b.position);
        setSnackbarMessage('Bookmark added');
      }
      
      setBookmarks(newBookmarks);
      await AsyncStorage.setItem(`bookmarks_${document.id}`, JSON.stringify(newBookmarks));
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error managing bookmark:', error);
    }
  };

  // Gesture handlers
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (fileType === 'image' && viewMode === 'text') {
        const scale = Math.max(0.5, Math.min(3, zoomLevel + gestureState.dy * 0.01));
        setZoomLevel(scale);
      }
    },
    onPanResponderRelease: () => {
      // Reset any temporary states
    },
  });

  // Load document content
  useEffect(() => {
    loadDocumentContent();
    loadUserPreferences();
    
    // Track document view
    AnalyticsService.trackEvent('document_viewed', {
      documentType: fileType,
      documentSize: document.size,
      platform: PlatformUtils.isWeb() ? 'web' : 'mobile',
    });
  }, [document]);

  // Auto-save preferences
  useEffect(() => {
    saveUserPreferences();
  }, [fontSize, darkMode, lineSpacing, textWrap, showLineNumbers]);

  // Update document stats when content changes
  useEffect(() => {
    if (documentContent) {
      const stats = calculateDocumentStats(documentContent);
      setDocumentStats(stats);
      setEstimatedReadTime(stats?.estimatedReadTime || 0);
    }
  }, [documentContent, calculateDocumentStats]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        updateViewingHistory();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [readingProgress, lastScrollPosition]);

  // Handle back button
  useEffect(() => {
    const backAction = () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isFullscreen]);

  // Animation setup
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadDocumentContent = async () => {
    try {
      setLoading(true);
      setProcessingProgress(0.1);
      setError(null);

      setProcessingProgress(0.3);
      
      if (PlatformUtils.isWeb()) {
        await loadWebDocument();
      } else {
        await loadMobileDocument();
      }

      setProcessingProgress(1.0);
    } catch (error) {
      console.error('Error loading document:', error);
      setError(error.message || 'Failed to load document');
      
      AnalyticsService.trackEvent('document_load_error', {
        documentType: fileType,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWebDocument = async () => {
    try {
      const documents = await DocumentProcessor.getStoredDocuments();
      const storedDoc = documents.find(doc => doc.id === document.id);
      
      if (!storedDoc || !storedDoc.webFileData) {
        throw new Error('Document data not found in web storage');
      }

      setProcessingProgress(0.6);

      const uint8Array = new Uint8Array(storedDoc.webFileData);
      
      if (['text', 'csv'].includes(fileType)) {
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(uint8Array);
        setDocumentContent(content);
        setViewMode('text');
      } else {
        const blob = new Blob([uint8Array], { type: document.type });
        const url = URL.createObjectURL(blob);
        setDocumentUrl(url);
        setViewMode('web');
      }

      setProcessingProgress(0.9);
    } catch (error) {
      console.error('Web document loading error:', error);
      throw error;
    }
  };

  const loadMobileDocument = async () => {
    try {
      const RNFS = await PlatformUtils.loadFileSystem();
      
      if (!RNFS) {
        throw new Error('File system not available on mobile');
      }

      setProcessingProgress(0.6);

      if (!document.localPath) {
        throw new Error('Document file path not found');
      }

      const exists = await RNFS.exists(document.localPath);
      if (!exists) {
        throw new Error('Document file no longer exists on device');
      }

      setProcessingProgress(0.8);

      if (['text', 'csv'].includes(fileType)) {
        const content = await RNFS.readFile(document.localPath, 'utf8');
        setDocumentContent(content);
        setViewMode('text');
      } else {
        setDocumentUrl(`file://${document.localPath}`);
        setViewMode('download');
      }

      setProcessingProgress(0.9);
    } catch (error) {
      console.error('Mobile document loading error:', error);
      throw error;
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Training Plan Document: ${planTitle || 'Training Plan'}\nOriginal file: ${document.originalName}`,
        title: document.originalName,
        url: documentUrl || undefined,
      });
      
      if (result.action === Share.sharedAction) {
        setSnackbarMessage('Document shared successfully');
        setSnackbarVisible(true);
        
        AnalyticsService.trackEvent('document_shared', {
          documentType: fileType,
          shareMethod: result.activityType || 'unknown',
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Could not share document');
    }
  };

  const handleDownload = async () => {
    if (PlatformUtils.isWeb() && documentUrl) {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = document.originalName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSnackbarMessage('Download started');
      setSnackbarVisible(true);
      
      AnalyticsService.trackEvent('document_downloaded', {
        documentType: fileType,
        platform: 'web',
      });
    } else {
      Alert.alert(
        'Open Document',
        'Would you like to open this document in an external app?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open',
            onPress: () => {
              if (documentUrl) {
                Linking.openURL(documentUrl).catch(() => {
                  Alert.alert('Error', 'Could not open document');
                });
              }
            }
          }
        ]
      );
    }
  };

  const handleScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPosition = contentOffset.y;
    const progress = scrollPosition / (contentSize.height - layoutMeasurement.height);
    
    setLastScrollPosition(scrollPosition);
    setReadingProgress(Math.max(0, Math.min(1, progress)));
    
    // Auto-hide header on scroll
    if (scrollPosition > 100) {
      Animated.timing(headerOpacity, {
        toValue: 0.7,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const navigateToSearchResult = (direction) => {
    if (searchResults.length === 0) return;
    
    const newIndex = direction === 'next' 
      ? (currentSearchIndex + 1) % searchResults.length
      : currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    
    setCurrentSearchIndex(newIndex);
    
    // Scroll to result (implement based on your scroll view)
    const result = searchResults[newIndex];
    if (scrollViewRef.current && result) {
      // Calculate approximate scroll position based on character index
      const approximatePosition = (result.index / documentContent.length) * 1000; // Rough estimation
      scrollViewRef.current.scrollTo({ y: approximatePosition, animated: true });
    }
  };

  const formatFileSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatReadingTime = (minutes) => {
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Enhanced content renderers
  const renderDocumentContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingAnimation, { transform: [{ rotate: rotateAnim }] }]}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </Animated.View>
          <Text style={[styles.loadingText, { marginTop: SPACING.md }]}>
            Loading document...
          </Text>
          <ProgressBar
            progress={processingProgress}
            color={COLORS.primary}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {Math.round(processingProgress * 100)}%
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Icon name="error" size={64} color={COLORS.error} />
          </Animated.View>
          <Text style={[TEXT_STYLES.h3, styles.errorTitle]}>
            Unable to Load Document
          </Text>
          <Text style={[TEXT_STYLES.body1, styles.errorMessage]}>
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={loadDocumentContent}
            style={styles.retryButton}
            icon="refresh"
          >
            Try Again
          </Button>
        </View>
      );
    }

    switch (viewMode) {
      case 'text':
        return renderTextContent();
      case 'web':
        return renderWebContent();
      case 'download':
        return renderDownloadOption();
      default:
        return renderUnsupportedContent();
    }
  };

  const renderTextContent = () => {
    const dynamicStyles = {
      fontSize: fontSize,
      lineHeight: fontSize * lineSpacing,
      color: darkMode ? COLORS.textLight : COLORS.textDark,
      backgroundColor: darkMode ? COLORS.backgroundDark : COLORS.backgroundLight,
    };

    const lines = showLineNumbers ? documentContent.split('\n') : null;

    return (
      <ScrollView 
        style={[styles.textContainer, { backgroundColor: dynamicStyles.backgroundColor }]}
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...panResponder.panHandlers}
      >
        <Surface style={[styles.textContent, { backgroundColor: dynamicStyles.backgroundColor }]}>
          <View style={styles.textHeader}>
            <Text style={[styles.documentTitle, { color: dynamicStyles.color }]}>
              Document Content
            </Text>
            {documentStats && (
              <View style={styles.statsRow}>
                <Chip compact mode="flat" style={styles.statChip}>
                  {documentStats.words} words
                </Chip>
                <Chip compact mode="flat" style={styles.statChip}>
                  {documentStats.lines} lines
                </Chip>
                <Chip compact mode="flat" style={styles.statChip}>
                  {formatReadingTime(documentStats.estimatedReadTime)}
                </Chip>
              </View>
            )}
          </View>
          
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <Text style={[styles.searchInfo, { color: dynamicStyles.color }]}>
                {searchResults.length} results for "{searchQuery}"
              </Text>
              <View style={styles.searchNavigation}>
                <IconButton
                  icon="keyboard-arrow-up"
                  onPress={() => navigateToSearchResult('prev')}
                  disabled={searchResults.length === 0}
                />
                <Text style={{ color: dynamicStyles.color }}>
                  {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
                </Text>
                <IconButton
                  icon="keyboard-arrow-down"
                  onPress={() => navigateToSearchResult('next')}
                  disabled={searchResults.length === 0}
                />
              </View>
            </View>
          )}

          <View style={[styles.documentTextContainer, { transform: [{ scale: zoomLevel }] }]}>
            {showLineNumbers && lines ? (
              <View style={styles.lineNumberedText}>
                {lines.map((line, index) => (
                  <View key={index} style={styles.lineContainer}>
                    <Text style={[styles.lineNumber, { color: dynamicStyles.color + '60' }]}>
                      {(index + 1).toString().padStart(3, ' ')}
                    </Text>
                    <RNText style={[styles.documentText, dynamicStyles, { flex: 1 }]}>
                      {line}
                    </RNText>
                  </View>
                ))}
              </View>
            ) : (
              <RNText 
                style={[
                  styles.documentText, 
                  dynamicStyles,
                  { flexWrap: textWrap ? 'wrap' : 'nowrap' }
                ]}
              >
                {documentContent}
              </RNText>
            )}
          </View>

          {bookmarks.length > 0 && (
            <View style={styles.bookmarksSection}>
              <Text style={[styles.sectionTitle, { color: dynamicStyles.color }]}>
                Bookmarks
              </Text>
              {bookmarks.map((bookmark, index) => (
                <TouchableOpacity
                  key={bookmark.id}
                  style={styles.bookmarkItem}
                  onPress={() => {
                    if (scrollViewRef.current) {
                      scrollViewRef.current.scrollTo({ 
                        y: (bookmark.position / documentContent.length) * 1000, 
                        animated: true 
                      });
                    }
                  }}
                >
                  <Icon name="bookmark" size={16} color={COLORS.primary} />
                  <Text style={[styles.bookmarkText, { color: dynamicStyles.color }]}>
                    {bookmark.preview.substring(0, 50)}...
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Surface>
      </ScrollView>
    );
  };

  const renderWebContent = () => (
    <View style={styles.webContainer}>
      {documentUrl ? (
        <WebView
          ref={webViewRef}
          source={{ uri: documentUrl }}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text>Loading document...</Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
            setError('Failed to load document in viewer');
          }}
          onLoadProgress={({ nativeEvent }) => {
            setProcessingProgress(nativeEvent.progress);
          }}
          onMessage={(event) => {
            // Handle messages from WebView if needed
            console.log('WebView message:', event.nativeEvent.data);
          }}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={COLORS.error} />
          <Text style={[TEXT_STYLES.subtitle1, { marginTop: SPACING.md }]}>
            Document URL not available
          </Text>
        </View>
      )}
    </View>
  );

  const renderDownloadOption = () => (
    <View style={styles.downloadContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon name={fileInfo.icon} size={80} color={fileInfo.color} />
      </Animated.View>
      <Text style={[TEXT_STYLES.h2, styles.downloadTitle]}>
        {fileInfo.label}
      </Text>
      <Text style={[TEXT_STYLES.body1, styles.downloadDescription]}>
        This document needs to be opened in an external application for the best viewing experience.
      </Text>
      
      <Card style={styles.fileDetailsCard}>
        <Card.Content>
          <View style={styles.fileDetailRow}>
            <Icon name="insert-drive-file" size={20} color={COLORS.textSecondary} />
            <Text style={[TEXT_STYLES.body2, styles.fileDetailText]}>
              <Text style={styles.fileDetailLabel}>File: </Text>
              {document.originalName}
            </Text>
          </View>
          <View style={styles.fileDetailRow}>
            <Icon name="storage" size={20} color={COLORS.textSecondary} />
            <Text style={[TEXT_STYLES.body2, styles.fileDetailText]}>
              <Text style={styles.fileDetailLabel}>Size: </Text>
              {formatFileSize(document.size)}
            </Text>
          </View>
          <View style={styles.fileDetailRow}>
            <Icon name="category" size={20} color={COLORS.textSecondary} />
            <Text style={[TEXT_STYLES.body2, styles.fileDetailText]}>
              <Text style={styles.fileDetailLabel}>Type: </Text>
              {document.type}
            </Text>
          </View>
          <View style={styles.fileDetailRow}>
            <Icon name="access-time" size={20} color={COLORS.textSecondary} />
            <Text style={[TEXT_STYLES.body2, styles.fileDetailText]}>
              <Text style={styles.fileDetailLabel}>Uploaded: </Text>
              {new Date(document.uploadedAt).toLocaleDateString()}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.capabilitiesContainer}>
        <Text style={[TEXT_STYLES.subtitle2, styles.capabilitiesTitle]}>
          Available Actions:
        </Text>
        <View style={styles.capabilitiesGrid}>
          {fileInfo.capabilities.map((capability) => (
            <Chip
              key={capability}
              mode="outlined"
              compact
              style={styles.capabilityChip}
              icon={getCapabilityIcon(capability)}
            >
              {capability.charAt(0).toUpperCase() + capability.slice(1)}
            </Chip>
          ))}
        </View>
      </View>

      <View style={styles.actionButtons}>
        <Button
          mode="contained"
          onPress={handleDownload}
          style={[styles.actionButton, styles.primaryButton]}
          icon="open-in-new"
          contentStyle={styles.buttonContent}
        >
          Open in External App
        </Button>
        
        <Button
          mode="outlined"
          onPress={handleShare}
          style={[styles.actionButton, styles.secondaryButton]}
          icon="share"
          contentStyle={styles.buttonContent}
        >
          Share Document
        </Button>
      </View>
    </View>
  );

  const renderUnsupportedContent = () => (
    <View style={styles.errorContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon name="help" size={64} color={COLORS.textSecondary} />
      </Animated.View>
      <Text style={[TEXT_STYLES.h3, styles.unsupportedTitle]}>
        Unsupported Format
      </Text>
      <Text style={[TEXT_STYLES.body1, styles.unsupportedDescription]}>
        This document format is not supported for inline viewing.
      </Text>
      <View style={styles.unsupportedSuggestions}>
        <Text style={[TEXT_STYLES.subtitle2, { marginBottom: SPACING.sm }]}>
          Suggestions:
        </Text>
        <Text style={[TEXT_STYLES.body2, styles.suggestionText]}>
          • Try downloading and opening with a compatible app
        </Text>
        <Text style={[TEXT_STYLES.body2, styles.suggestionText]}>
          • Convert to a supported format (PDF, TXT, etc.)
        </Text>
        <Text style={[TEXT_STYLES.body2, styles.suggestionText]}>
          • Check if the file is corrupted
        </Text>
      </View>
      <Button
        mode="outlined"
        onPress={handleDownload}
        style={styles.downloadFallbackButton}
        icon="download"
      >
        Download to View
      </Button>
    </View>
  );

  const getCapabilityIcon = (capability) => {
    const icons = {
      view: 'visibility',
      search: 'search',
      edit: 'edit',
      bookmark: 'bookmark',
      share: 'share',
      download: 'download',
      zoom: 'zoom-in',
      play: 'play-arrow',
    };
    return icons[capability] || 'star';
  };

  const renderSearchBar = () => (
    <Surface style={styles.searchBar}>
      <Icon name="search" size={20} color={COLORS.textSecondary} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search in document..."
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          debouncedSearch(text);
        }}
        returnKeyType="search"
      />
      {searchQuery.length > 0 && (
        <IconButton
          icon="close"
          size={16}
          onPress={() => {
            setSearchQuery('');
            setSearchResults([]);
          }}
        />
      )}
    </Surface>
  );

  const renderFloatingActions = () => (
    <>
      {viewMode === 'text' && (
        <FAB.Group
          open={showMenu}
          icon={showMenu ? 'close' : 'menu'}
          actions={[
            {
              icon: 'search',
              label: 'Search',
              onPress: () => {
                // Toggle search bar visibility
                setShowMenu(false);
              },
              small: false,
            },
            {
              icon: 'bookmark-add',
              label: 'Add Bookmark',
              onPress: () => {
                toggleBookmark(lastScrollPosition);
                setShowMenu(false);
              },
              small: false,
            },
            {
              icon: 'settings',
              label: 'Settings',
              onPress: () => {
                setShowSettingsModal(true);
                setShowMenu(false);
              },
              small: false,
            },
            {
              icon: isFullscreen ? 'fullscreen-exit' : 'fullscreen',
              label: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen',
              onPress: () => {
                setIsFullscreen(!isFullscreen);
                setShowMenu(false);
              },
              small: false,
            },
          ]}
          onStateChange={({ open }) => setShowMenu(open)}
          style={styles.fabGroup}
        />
      )}
      
      {/* Reading Progress Indicator */}
      {viewMode === 'text' && readingProgress > 0 && (
        <View style={styles.progressIndicator}>
          <ProgressBar
            progress={readingProgress}
            color={COLORS.primary}
            style={styles.readingProgressBar}
          />
          <Text style={styles.progressPercentage}>
            {Math.round(readingProgress * 100)}%
          </Text>
        </View>
      )}
    </>
  );

  const renderSettingsModal = () => (
    <Portal>
      <Modal
        visible={showSettingsModal}
        onDismiss={() => setShowSettingsModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <ScrollView>
          <Text style={[TEXT_STYLES.h3, styles.modalTitle]}>
            Document Settings
          </Text>
          
          {/* Font Size */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Font Size: {fontSize}px</Text>
            <Slider
              style={styles.slider}
              minimumValue={12}
              maximumValue={24}
              value={fontSize}
              onValueChange={setFontSize}
              step={1}
              thumbStyle={{ backgroundColor: COLORS.primary }}
              trackStyle={{ backgroundColor: COLORS.primary + '30' }}
            />
          </View>

          {/* Line Spacing */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Line Spacing: {lineSpacing}x</Text>
            <Slider
              style={styles.slider}
              minimumValue={1.0}
              maximumValue={3.0}
              value={lineSpacing}
              onValueChange={setLineSpacing}
              step={0.1}
              thumbStyle={{ backgroundColor: COLORS.primary }}
              trackStyle={{ backgroundColor: COLORS.primary + '30' }}
            />
          </View>

          {/* Toggle Settings */}
          <View style={styles.toggleGroup}>
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>Dark Mode</Text>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                color={COLORS.primary}
              />
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>Text Wrap</Text>
              <Switch
                value={textWrap}
                onValueChange={setTextWrap}
                color={COLORS.primary}
              />
            </View>
            
            <View style={styles.toggleItem}>
              <Text style={styles.toggleLabel}>Line Numbers</Text>
              <Switch
                value={showLineNumbers}
                onValueChange={setShowLineNumbers}
                color={COLORS.primary}
              />
            </View>
          </View>

          {/* Document Statistics */}
          {documentStats && (
            <View style={styles.statsSection}>
              <Text style={[TEXT_STYLES.subtitle1, styles.statsSectionTitle]}>
                Document Statistics
              </Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{documentStats.words.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Words</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{documentStats.characters.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Characters</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{documentStats.lines.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Lines</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{documentStats.paragraphs.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Paragraphs</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatReadingTime(documentStats.estimatedReadTime)}</Text>
                  <Text style={styles.statLabel}>Read Time</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{Math.round(readingProgress * 100)}%</Text>
                  <Text style={styles.statLabel}>Progress</Text>
                </View>
              </View>
            </View>
          )}
          
          <Button
            mode="contained"
            onPress={() => setShowSettingsModal(false)}
            style={styles.closeButton}
          >
            Close Settings
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={COLORS.primary} 
        translucent 
        hidden={isFullscreen}
      />
      
      {/* Header */}
      {!isFullscreen && (
        <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <IconButton
                icon="arrow-back"
                iconColor="white"
                size={24}
                onPress={() => navigation.goBack()}
              />
              <View style={styles.headerInfo}>
                <Text style={[TEXT_STYLES.h3, styles.headerTitle]}>
                  Original Document
                </Text>
                <Text style={[TEXT_STYLES.caption, styles.headerSubtitle]}>
                  {document.originalName}
                </Text>
                {estimatedReadTime > 0 && (
                  <Text style={[TEXT_STYLES.caption, styles.readTimeIndicator]}>
                    📖 {formatReadingTime(estimatedReadTime)} read
                  </Text>
                )}
              </View>
              <View style={styles.headerActions}>
                <IconButton
                  icon="info"
                  iconColor="white"
                  size={24}
                  onPress={() => setShowInfoModal(true)}
                />
                <IconButton
                  icon="share"
                  iconColor="white"
                  size={24}
                  onPress={handleShare}
                />
              </View>
            </View>
            
            {/* Reading Progress Bar */}
            {readingProgress > 0 && (
              <ProgressBar
                progress={readingProgress}
                color="rgba(255,255,255,0.8)"
                style={styles.headerProgressBar}
              />
            )}
          </LinearGradient>
        </Animated.View>
      )}

      {/* File Type Indicator */}
      {!isFullscreen && (
        <Surface style={styles.fileTypeIndicator}>
          <Icon name={fileInfo.icon} size={24} color={fileInfo.color} />
          <Text style={[TEXT_STYLES.body2, styles.fileTypeText]}>
            {fileInfo.label} • {formatFileSize(document.size)}
          </Text>
          <View style={styles.fileTypeBadges}>
            <Chip
              mode="flat"
              compact
              style={[styles.fileTypeChip, { backgroundColor: fileInfo.color + '20' }]}
              textStyle={[styles.fileTypeChipText, { color: fileInfo.color }]}
            >
              {fileType.toUpperCase()}
            </Chip>
            {bookmarks.length > 0 && (
              <Badge style={[styles.bookmarkBadge, { backgroundColor: COLORS.primary }]}>
                {bookmarks.length}
              </Badge>
            )}
          </View>
        </Surface>
      )}

      {/* Search Bar */}
      {viewMode === 'text' && !isFullscreen && renderSearchBar()}

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {renderDocumentContent()}
      </Animated.View>

      {/* Floating Actions */}
      {renderFloatingActions()}

      {/* Info Modal */}
      <Portal>
        <Modal
          visible={showInfoModal}
          onDismiss={() => setShowInfoModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <ScrollView>
            <View style={styles.modalHeader}>
              <Icon name={fileInfo.icon} size={48} color={fileInfo.color} />
              <Text style={[TEXT_STYLES.h3, styles.modalTitle]}>
                Document Information
              </Text>
            </View>
            
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Icon name="insert-drive-file" size={20} color={COLORS.textSecondary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>File Name</Text>
                  <Text style={styles.infoValue}>{document.originalName}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="storage" size={20} color={COLORS.textSecondary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>File Size</Text>
                  <Text style={styles.infoValue}>{formatFileSize(document.size)}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="category" size={20} color={COLORS.textSecondary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>File Type</Text>
                  <Text style={styles.infoValue}>{document.type}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="access-time" size={20} color={COLORS.textSecondary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Uploaded</Text>
                  <Text style={styles.infoValue}>
                    {new Date(document.uploadedAt).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="devices" size={20} color={COLORS.textSecondary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Platform</Text>
                  <Text style={styles.infoValue}>
                    {document.platform === 'web' ? '🌐 Web Upload' : '📱 Mobile Upload'}
                  </Text>
                </View>
              </View>

              {documentStats && (
                <>
                  <Divider style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <Icon name="assessment" size={20} color={COLORS.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Word Count</Text>
                      <Text style={styles.infoValue}>{documentStats.words.toLocaleString()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.infoRow}>
                    <Icon name="schedule" size={20} color={COLORS.textSecondary} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Estimated Read Time</Text>
                      <Text style={styles.infoValue}>{formatReadingTime(documentStats.estimatedReadTime)}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            <Button
              mode="contained"
              onPress={() => setShowInfoModal(false)}
              style={styles.closeButton}
              icon="close"
            >
              Close
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Settings Modal */}
      {renderSettingsModal()}

      {/* Snackbar */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
          action={{
            label: 'Dismiss',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </Snackbar>
      </Portal>
    </View>
  );
};

// StyleSheet with comprehensive styles
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  headerContainer: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  readTimeIndicator: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerProgressBar: {
    height: 3,
    backgroundColor: 'transparent',
    marginTop: 8,
    marginHorizontal: 16,
  },
  fileTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  fileTypeText: {
    flex: 1,
    marginLeft: 8,
  },
  fileTypeBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileTypeChip: {
    marginLeft: 8,
  },
  fileTypeChipText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookmarkBadge: {
    marginLeft: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingAnimation: {
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  retryButton: {
    marginTop: 24,
  },
  textContainer: {
    flex: 1,
  },
  textContent: {
    padding: 16,
  },
  textHeader: {
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  searchResults: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  searchInfo: {
    flex: 1,
  },
  searchNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentTextContainer: {
    marginBottom: 16,
  },
  lineNumberedText: {
    flexDirection: 'column',
  },
  lineContainer: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  lineNumber: {
    width: 40,
    textAlign: 'right',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  documentText: {
    fontFamily: 'monospace',
  },
  bookmarksSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  bookmarkText: {
    marginLeft: 8,
    flex: 1,
  },
  webContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  downloadContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  downloadTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  downloadDescription: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  fileDetailsCard: {
    width: '100%',
    marginTop: 24,
  },
  fileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileDetailText: {
    marginLeft: 12,
    flex: 1,
  },
  fileDetailLabel: {
    fontWeight: 'bold',
  },
  capabilitiesContainer: {
    width: '100%',
    marginTop: 24,
  },
  capabilitiesTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  capabilityChip: {
    margin: 4,
  },
  actionButtons: {
    width: '100%',
    marginTop: 24,
  },
  actionButton: {
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
  secondaryButton: {
    borderColor: '#667eea',
  },
  buttonContent: {
    height: 48,
  },
  unsupportedTitle: {
    marginTop: 16,
    textAlign: 'center',
  },
  unsupportedDescription: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  unsupportedSuggestions: {
    marginTop: 24,
    width: '100%',
  },
  suggestionText: {
    marginBottom: 4,
    color: '#666',
  },
  downloadFallbackButton: {
    marginTop: 24,
  },
  fabGroup: {
    marginBottom: 16,
  },
  progressIndicator: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 8,
  },
  readingProgressBar: {
    flex: 1,
    marginRight: 8,
  },
  progressPercentage: {
    color: 'white',
    fontSize: 12,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  toggleGroup: {
    marginBottom: 20,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 16,
  },
  statsSection: {
    marginBottom: 20,
  },
  statsSectionTitle: {
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  closeButton: {
    marginTop: 20,
  },
  infoGrid: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  infoDivider: {
    marginVertical: 12,
  },
  snackbar: {
    marginBottom: 80,
  },
  snackbarText: {
    color: 'white',
  },
};

// CRITICAL FIX: Add the default export
export default DocumentViewer;