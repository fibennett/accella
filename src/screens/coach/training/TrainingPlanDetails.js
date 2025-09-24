import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  Alert,
  Dimensions,
  RefreshControl,
  Animated,
  TouchableOpacity,
  FlatList,
  Share,
} from 'react-native';
import {
  Card,
  Button,
  Chip,
  ProgressBar,
  IconButton,
  FAB,
  Surface,
  Text,
  Portal,
  Modal,
  Divider,
  Avatar,
  List,
  Snackbar,
} from 'react-native-paper';
import { LinearGradient } from '../../../components/shared/LinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Design system imports
import { COLORS } from '../../../styles/colors';
import { SPACING } from '../../../styles/spacing';
import { TEXT_STYLES } from '../../../styles/textStyles';
import DocumentProcessor from '../../../services/DocumentProcessor';
import DocumentViewer from '../../shared/DocumentViewer';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const TrainingPlanDetails = ({ navigation, route }) => {
  const { planId } = route.params;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  
  // State management
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSessions, setExpandedSessions] = useState({});
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [documentModalVisible, setDocumentModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  // Difficulty colors mapping
  const difficultyColors = {
    beginner: COLORS.success,
    intermediate: '#FF9800',
    advanced: COLORS.error,
  };

  // Tab options
const tabs = [
  { key: 'overview', label: 'Overview', icon: 'info' },
  { key: 'documents', label: 'Documents', icon: 'description' }, // NEW TAB
  { key: 'sessions', label: 'Sessions', icon: 'fitness-center' },
  { key: 'progress', label: 'Progress', icon: 'trending-up' },
  { key: 'nutrition', label: 'Nutrition', icon: 'restaurant' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics' },
];

  // Load plan data
  useEffect(() => {
    loadPlanDetails();
  }, [planId]);

  // Animation setup
  useEffect(() => {
    if (plan) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [plan]);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      const plans = await DocumentProcessor.getTrainingPlans();
      const foundPlan = plans.find(p => p.id === planId);
      
      if (foundPlan) {
        setPlan(foundPlan);
      } else {
        Alert.alert('Error', 'Training plan not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading plan details:', error);
      Alert.alert('Error', 'Failed to load training plan details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlanDetails();
    setRefreshing(false);
  };

  const handleStartPlan = () => {
    Alert.alert(
      'Start Training Plan',
      `Are you ready to begin "${plan.title}"? This will track your progress and schedule sessions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Plan',
          onPress: () => {
            setSnackbarMessage('Training plan started! Check your dashboard for upcoming sessions.');
            setSnackbarVisible(true);
            // Here you would update the plan status and create sessions
          }
        }
      ]
    );
  };

  const handleEditPlan = () => {
    setEditModalVisible(true);
  };

  const handleSharePlan = async () => {
    try {
      await Share.share({
        message: `Check out this training plan: "${plan.title}" - ${plan.description}`,
        title: plan.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setSessionModalVisible(true);
  };

  const toggleSessionExpanded = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

const renderTabContent = () => {
  switch (activeTab) {
    case 'overview':
      return renderOverview();
    case 'documents':
      return renderDocuments();
    case 'sessions':
      return renderSessions();
    case 'progress':
      return renderProgress();
    case 'nutrition':
      return renderNutrition();
    case 'analytics':
      return renderAnalytics();
    default:
      return renderOverview();
  }
};

const getDocumentIcon = (document) => {
  const type = document.type ? document.type.toLowerCase() : '';
  const name = document.originalName ? document.originalName.toLowerCase() : '';
  
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'picture-as-pdf';
  if (type.includes('doc') || name.includes('.doc')) return 'description';
  if (type.includes('xls') || name.includes('.xls')) return 'grid-on';
  if (type.includes('ppt') || name.includes('.ppt')) return 'slideshow';
  if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif'].some(ext => name.endsWith(ext))) return 'image';
  if (type.includes('video') || ['mp4', 'avi', 'mov'].some(ext => name.endsWith(ext))) return 'video-library';
  if (type.includes('audio') || ['mp3', 'wav', 'ogg'].some(ext => name.endsWith(ext))) return 'audiotrack';
  if (type.includes('text') || name.endsWith('.txt')) return 'text-snippet';
  return 'insert-drive-file';
};

const getDocumentColor = (document) => {
  const type = document.type ? document.type.toLowerCase() : '';
  const name = document.originalName ? document.originalName.toLowerCase() : '';
  
  if (type.includes('pdf') || name.endsWith('.pdf')) return '#FF5722';
  if (type.includes('doc') || name.includes('.doc')) return '#2196F3';
  if (type.includes('xls') || name.includes('.xls')) return '#4CAF50';
  if (type.includes('ppt') || name.includes('.ppt')) return '#FF9800';
  if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif'].some(ext => name.endsWith(ext))) return '#E91E63';
  if (type.includes('video') || ['mp4', 'avi', 'mov'].some(ext => name.endsWith(ext))) return '#F44336';
  if (type.includes('audio') || ['mp3', 'wav', 'ogg'].some(ext => name.endsWith(ext))) return '#3F51B5';
  if (type.includes('text') || name.endsWith('.txt')) return '#9C27B0';
  return '#757575';
};

const getDocumentTypeLabel = (document) => {
  const type = document.type ? document.type.toLowerCase() : '';
  const name = document.originalName ? document.originalName.toLowerCase() : '';
  
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'PDF Document';
  if (type.includes('doc') || name.includes('.doc')) return 'Word Document';
  if (type.includes('xls') || name.includes('.xls')) return 'Spreadsheet';
  if (type.includes('ppt') || name.includes('.ppt')) return 'Presentation';
  if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif'].some(ext => name.endsWith(ext))) return 'Image File';
  if (type.includes('video') || ['mp4', 'avi', 'mov'].some(ext => name.endsWith(ext))) return 'Video File';
  if (type.includes('audio') || ['mp3', 'wav', 'ogg'].some(ext => name.endsWith(ext))) return 'Audio File';
  if (type.includes('text') || name.endsWith('.txt')) return 'Text Document';
  return 'Document';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 7. NEW: Add document handler functions
const handleDocumentPress = (document) => {
  navigation.navigate('DocumentViewer', {
    document: document,
    planTitle: plan.title
  });
};

const handleDocumentDownload = (document) => {
  Alert.alert(
    'Download Document',
    `Download "${document.originalName}"?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Download',
        onPress: () => {
          // Implement download logic here
          setSnackbarMessage(`Downloading ${document.originalName}...`);
          setSnackbarVisible(true);
        }
      }
    ]
  );
};

  const renderOverview = () => (
    <View style={{ padding: SPACING.md }}>
      {/* Plan Stats */}
      <Surface style={styles.statsCard}>
        <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md, textAlign: 'center' }]}>
          Plan Overview
        </Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Icon name="fitness-center" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{plan.sessionsCount}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="schedule" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{plan.duration}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="trending-up" size={24} color={difficultyColors[plan.difficulty]} />
            <Text style={styles.statNumber}>{plan.difficulty}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="star" size={24} color="#FFD700" />
            <Text style={styles.statNumber}>{plan.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </Surface>

      {/* Description */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Description
          </Text>
          <Text style={[TEXT_STYLES.body1, { lineHeight: 24 }]}>
            {plan.description}
          </Text>
        </Card.Content>
      </Card>

      {/* Tags */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Focus Areas
          </Text>
          <View style={styles.tagsContainer}>
            {plan.tags.map((tag, index) => (
              <Chip
                key={index}
                mode="outlined"
                style={styles.tagChip}
                textStyle={{ fontSize: 12 }}
              >
                {tag}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Schedule */}
      {plan.schedule && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Schedule
            </Text>
            <View style={styles.scheduleInfo}>
              <Icon name="calendar-today" size={20} color={COLORS.primary} />
              <Text style={[TEXT_STYLES.body1, { marginLeft: SPACING.sm }]}>
                {plan.schedule.pattern}
              </Text>
            </View>
            {plan.schedule.days && plan.schedule.days.length > 0 && (
              <View style={styles.daysContainer}>
                {plan.schedule.days.map((day, index) => (
                  <Chip
                    key={index}
                    mode="flat"
                    compact
                    style={[styles.dayChip, { backgroundColor: COLORS.primary + '20' }]}
                    textStyle={{ color: COLORS.primary, fontSize: 10 }}
                  >
                    {day.substring(0, 3).toUpperCase()}
                  </Chip>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Creator Info */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Created By
          </Text>
          <View style={styles.creatorInfo}>
            <Avatar.Text
              size={40}
              label={plan.creator.charAt(0).toUpperCase()}
              style={{ backgroundColor: COLORS.primary }}
            />
            <View style={styles.creatorDetails}>
              <Text style={[TEXT_STYLES.subtitle1, { fontWeight: 'bold' }]}>
                {plan.creator}
              </Text>
              <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                Created: {new Date(plan.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  const renderDocuments = () => (
  <View style={{ padding: SPACING.md }}>
    {plan.documents && plan.documents.length > 0 ? (
      <FlatList
        data={plan.documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item: document }) => (
          <Card style={styles.documentCard}>
            <TouchableOpacity
              onPress={() => handleDocumentPress(document)}
              activeOpacity={0.7}
            >
              <Card.Content>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIconContainer}>
                    <Icon 
                      name={getDocumentIcon(document)} 
                      size={32} 
                      color={getDocumentColor(document)} 
                    />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={[TEXT_STYLES.subtitle1, { fontWeight: 'bold' }]}>
                      {document.originalName}
                    </Text>
                    <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                      {getDocumentTypeLabel(document)} • {formatFileSize(document.size)}
                    </Text>
                    <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                      Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.documentActions}>
                    <IconButton
                      icon="visibility"
                      size={20}
                      onPress={() => handleDocumentPress(document)}
                    />
                    <IconButton
                      icon="download"
                      size={20}
                      onPress={() => handleDocumentDownload(document)}
                    />
                  </View>
                </View>
                
                {document.description && (
                  <Text style={[TEXT_STYLES.body2, { marginTop: SPACING.sm, color: COLORS.textSecondary }]}>
                    {document.description}
                  </Text>
                )}
              </Card.Content>
            </TouchableOpacity>
          </Card>
        )}
        scrollEnabled={false}
      />
    ) : (
      <View style={styles.emptyState}>
        <Icon name="description" size={64} color={COLORS.textSecondary} />
        <Text style={[TEXT_STYLES.h3, { marginTop: SPACING.md, color: COLORS.textSecondary }]}>
          No Documents Available
        </Text>
        <Text style={[TEXT_STYLES.body2, { marginTop: SPACING.sm, textAlign: 'center', color: COLORS.textSecondary }]}>
          This training plan doesn't have any documents attached yet.
        </Text>
        <Button
          mode="contained"
          style={{ marginTop: SPACING.md }}
          onPress={() => navigation.navigate('CoachingPlanUploadScreen', { planId: plan.id })}
        >
          Add Documents
        </Button>
      </View>
    )}
  </View>
);

  const renderSessions = () => (
    <View style={{ padding: SPACING.md }}>
      {plan.sessions && plan.sessions.length > 0 ? (
        <FlatList
          data={plan.sessions}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={({ item: session, index }) => (
            <Card style={styles.sessionCard}>
              <TouchableOpacity
                onPress={() => toggleSessionExpanded(session.id || index)}
                activeOpacity={0.7}
              >
                <Card.Content>
                  <View style={styles.sessionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[TEXT_STYLES.subtitle1, { fontWeight: 'bold' }]}>
                        Session {session.id || (index + 1)}: {session.title}
                      </Text>
                      {session.duration && (
                        <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                          Duration: {session.duration}
                        </Text>
                      )}
                    </View>
                    <IconButton
                      icon={expandedSessions[session.id || index] ? 'expand-less' : 'expand-more'}
                      size={20}
                    />
                  </View>
                  
                  {expandedSessions[session.id || index] && (
                    <View style={{ marginTop: SPACING.md }}>
                      {session.exercises && session.exercises.length > 0 && (
                        <View style={{ marginBottom: SPACING.sm }}>
                          <Text style={[TEXT_STYLES.body2, { fontWeight: 'bold', marginBottom: SPACING.xs }]}>
                            Exercises:
                          </Text>
                          {session.exercises.map((exercise, exIndex) => (
                            <Text key={exIndex} style={[TEXT_STYLES.body2, styles.exerciseItem]}>
                              • {exercise}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {session.notes && session.notes.length > 0 && (
                        <View>
                          <Text style={[TEXT_STYLES.body2, { fontWeight: 'bold', marginBottom: SPACING.xs }]}>
                            Notes:
                          </Text>
                          {session.notes.map((note, noteIndex) => (
                            <Text key={noteIndex} style={[TEXT_STYLES.body2, styles.noteItem]}>
                              {note}
                            </Text>
                          ))}
                        </View>
                      )}

                      <View style={styles.sessionActions}>
                        <Button
                          mode="outlined"
                          compact
                          onPress={() => handleSessionPress(session)}
                          style={{ marginRight: SPACING.sm }}
                        >
                          View Details
                        </Button>
                        <Button
                          mode="contained"
                          compact
                          onPress={() => {
                            setSnackbarMessage(`Started session: ${session.title}`);
                            setSnackbarVisible(true);
                          }}
                        >
                          Start Session
                        </Button>
                      </View>
                    </View>
                  )}
                </Card.Content>
              </TouchableOpacity>
            </Card>
          )}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Icon name="fitness-center" size={64} color={COLORS.textSecondary} />
          <Text style={[TEXT_STYLES.h3, { marginTop: SPACING.md, color: COLORS.textSecondary }]}>
            No Sessions Available
          </Text>
          <Text style={[TEXT_STYLES.body2, { marginTop: SPACING.sm, textAlign: 'center', color: COLORS.textSecondary }]}>
            This training plan doesn't have detailed sessions yet.
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: SPACING.md }}
            onPress={() => navigation.navigate('SessionBuilder', { planId: plan.id })}
          >
            Add Sessions
          </Button>
        </View>
      )}
    </View>
  );

  const renderProgress = () => (
    <View style={{ padding: SPACING.md }}>
      {/* Progress Overview */}
      <Surface style={styles.progressCard}>
        <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md, textAlign: 'center' }]}>
          Your Progress
        </Text>
        
        <View style={styles.progressCircle}>
          <Text style={[TEXT_STYLES.h1, { color: COLORS.primary }]}>
            {plan.progress}%
          </Text>
          <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
            Complete
          </Text>
        </View>
        
        <ProgressBar
          progress={plan.progress / 100}
          color={COLORS.primary}
          style={styles.progressBar}
        />
        
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={styles.progressNumber}>
              {Math.floor((plan.sessionsCount * plan.progress) / 100)}
            </Text>
            <Text style={styles.progressLabel}>Sessions Completed</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.progressNumber}>
              {plan.sessionsCount - Math.floor((plan.sessionsCount * plan.progress) / 100)}
            </Text>
            <Text style={styles.progressLabel}>Sessions Remaining</Text>
          </View>
        </View>
      </Surface>

      {/* Recent Activity */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Recent Activity
          </Text>
          <List.Item
            title="Completed Session 3: Upper Body Strength"
            description="2 days ago"
            left={props => <List.Icon {...props} icon="check-circle" color={COLORS.success} />}
          />
          <List.Item
            title="Started Session 4: Cardio Endurance"
            description="Today"
            left={props => <List.Icon {...props} icon="play-circle" color={COLORS.primary} />}
          />
          <List.Item
            title="Updated nutrition plan"
            description="1 week ago"
            left={props => <List.Icon {...props} icon="restaurant" color={COLORS.secondary} />}
          />
        </Card.Content>
      </Card>
    </View>
  );

  const renderNutrition = () => (
    <View style={{ padding: SPACING.md }}>
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Nutrition Guidelines
          </Text>
          <Text style={[TEXT_STYLES.body1, { marginBottom: SPACING.md }]}>
            Follow these nutrition recommendations to maximize your training results:
          </Text>
          
          <View style={styles.nutritionItem}>
            <Icon name="local-drink" size={24} color="#2196F3" />
            <View style={{ marginLeft: SPACING.md, flex: 1 }}>
              <Text style={[TEXT_STYLES.subtitle2, { fontWeight: 'bold' }]}>
                Hydration
              </Text>
              <Text style={TEXT_STYLES.body2}>
                Drink at least 2-3 liters of water daily, more on training days
              </Text>
            </View>
          </View>

          <View style={styles.nutritionItem}>
            <Icon name="restaurant" size={24} color="#FF9800" />
            <View style={{ marginLeft: SPACING.md, flex: 1 }}>
              <Text style={[TEXT_STYLES.subtitle2, { fontWeight: 'bold' }]}>
                Pre-Workout
              </Text>
              <Text style={TEXT_STYLES.body2}>
                Consume carbs 1-2 hours before training for energy
              </Text>
            </View>
          </View>

          <View style={styles.nutritionItem}>
            <Icon name="fitness-center" size={24} color="#4CAF50" />
            <View style={{ marginLeft: SPACING.md, flex: 1 }}>
              <Text style={[TEXT_STYLES.subtitle2, { fontWeight: 'bold' }]}>
                Post-Workout
              </Text>
              <Text style={TEXT_STYLES.body2}>
                Protein and carbs within 30 minutes for recovery
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        style={{ margin: SPACING.md }}
        onPress={() => {
          Alert.alert('Feature Coming Soon', 'Detailed nutrition plans will be available in the next update!');
        }}
      >
        Create Custom Meal Plan
      </Button>
    </View>
  );

  const renderAnalytics = () => (
    <View style={{ padding: SPACING.md }}>
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Performance Analytics
          </Text>
          
          <View style={styles.analyticsGrid}>
            <Surface style={styles.analyticsCard}>
              <Icon name="trending-up" size={32} color={COLORS.success} />
              <Text style={styles.analyticsNumber}>+15%</Text>
              <Text style={styles.analyticsLabel}>Strength Gain</Text>
            </Surface>
            
            <Surface style={styles.analyticsCard}>
              <Icon name="favorite" size={32} color={COLORS.error} />
              <Text style={styles.analyticsNumber}>-8 BPM</Text>
              <Text style={styles.analyticsLabel}>Resting HR</Text>
            </Surface>
            
            <Surface style={styles.analyticsCard}>
              <Icon name="speed" size={32} color={COLORS.primary} />
              <Text style={styles.analyticsNumber}>+12%</Text>
              <Text style={styles.analyticsLabel}>Endurance</Text>
            </Surface>
            
            <Surface style={styles.analyticsCard}>
              <Icon name="scale" size={32} color={COLORS.secondary} />
              <Text style={styles.analyticsNumber}>-3 kg</Text>
              <Text style={styles.analyticsLabel}>Body Fat</Text>
            </Surface>
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        style={{ margin: SPACING.md }}
        onPress={() => {
          Alert.alert('Feature Coming Soon', 'Detailed analytics dashboard will be available in the next update!');
        }}
      >
        View Detailed Analytics
      </Button>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading training plan...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color={COLORS.error} />
        <Text style={[TEXT_STYLES.h3, { marginTop: SPACING.md }]}>
          Plan Not Found
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent />
      
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <IconButton
              icon="arrow-back"
              iconColor="white"
              size={24}
              onPress={() => navigation.goBack()}
            />
            <View style={styles.headerInfo}>
              <Text style={[TEXT_STYLES.h2, { color: 'white' }]}>
                {plan.title}
              </Text>
              <Text style={[TEXT_STYLES.caption, { color: 'rgba(255,255,255,0.8)' }]}>
                {plan.category} • {plan.difficulty}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <IconButton
                icon="share"
                iconColor="white"
                size={24}
                onPress={handleSharePlan}
              />
              <IconButton
                icon="edit"
                iconColor="white"
                size={24}
                onPress={handleEditPlan}
              />
            </View>
          </View>

          {/* Progress Bar */}
          {plan.isOwned && (
            <View style={styles.headerProgress}>
              <ProgressBar
                progress={plan.progress / 100}
                color="white"
                style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.3)' }}
              />
              <Text style={[TEXT_STYLES.caption, { color: 'white', marginTop: 4 }]}>
                {plan.progress}% Complete
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Tab Navigation */}
      <Surface style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? COLORS.primary : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab.key ? COLORS.primary : COLORS.textSecondary }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Surface>

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
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {renderTabContent()}
        </ScrollView>
      </Animated.View>

      {/* Floating Action Button */}
      {plan.isOwned && (
        <FAB
          icon="play-arrow"
          style={styles.fab}
          onPress={handleStartPlan}
          label="Start Training"
        />
      )}

      {/* Snackbar */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={{ backgroundColor: COLORS.success }}
        >
          <Text style={{ color: 'white' }}>{snackbarMessage}</Text>
        </Snackbar>
      </Portal>

      {/* Session Modal */}
      <Portal>
        <Modal
          visible={sessionModalVisible}
          onDismiss={() => setSessionModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          {selectedSession && (
            <View>
              <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
                {selectedSession.title}
              </Text>
              <Text style={[TEXT_STYLES.body1, { marginBottom: SPACING.lg }]}>
                Detailed session information would go here...
              </Text>
              <Button
                mode="contained"
                onPress={() => setSessionModalVisible(false)}
              >
                Close
              </Button>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  header: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerGradient: {
    paddingTop: StatusBar.currentHeight + SPACING.md,
    paddingBottom: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerProgress: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  tabContainer: {
    elevation: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.xs,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    marginLeft: SPACING.xs,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  statsCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs / 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayChip: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
    height: 24,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorDetails: {
    marginLeft: SPACING.md,
  },
  sessionCard: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  exerciseItem: {
    marginLeft: SPACING.md,
    marginBottom: SPACING.xs,
    color: COLORS.textSecondary,
  },
  noteItem: {
    marginLeft: SPACING.md,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
  sessionActions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    justifyContent: 'flex-end',
  },
  progressCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  progressCircle: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginVertical: SPACING.md,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: SPACING.md,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsCard: {
    width: '48%',
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    elevation: 1,
    borderRadius: 8,
  },
  analyticsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  analyticsLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  fab: {
    position: 'absolute',
    margin: SPACING.md,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: SPACING.lg,
    margin: SPACING.lg,
    borderRadius: 12,
  },
    documentCard: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIconContainer: {
    marginRight: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentActions: {
    flexDirection: 'row',
  },
};

export default TrainingPlanDetails;