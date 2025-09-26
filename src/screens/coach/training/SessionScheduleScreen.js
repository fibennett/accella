//src/screens/coach/training/SessionScheduleScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  Share,
} from 'react-native';
import {
  Card,
  Button,
  Chip,
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
  ProgressBar,
} from 'react-native-paper';
import { LinearGradient } from '../../components/shared/LinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Design system imports
import { COLORS } from '../../styles/colors';
import { SPACING } from '../../styles/spacing';
import { TEXT_STYLES } from '../../styles/textStyles';

const { width: screenWidth } = Dimensions.get('window');

const SessionScheduleScreen = ({ navigation, route }) => {
  // Add parameter validation and defaults
  const params = route?.params || {};
  const sessionData = params.sessionData || null;
  const planTitle = params.planTitle || 'Training Session';
  const academyName = params.academyName || 'Training Academy';

  // Early return if no session data
  if (!sessionData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color={COLORS.error} />
        <Text style={[TEXT_STYLES.h3, { marginTop: SPACING.md }]}>
          Session Not Found
        </Text>
        <Text style={[TEXT_STYLES.body1, { textAlign: 'center', marginTop: SPACING.sm }]}>
          Could not load session details. Please try again.
        </Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.goBack()}
          style={{ marginTop: SPACING.md }}
        >
          Go Back
        </Button>
      </View>
    );
  }
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // State management
  const [session, setSession] = useState(sessionData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [completedDrills, setCompletedDrills] = useState(new Set());
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionProgress, setSessionProgress] = useState(0);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'info' },
    { key: 'plan', label: 'Training Plan', icon: 'fitness-center' },
    { key: 'progress', label: 'Progress', icon: 'trending-up' },
    { key: 'notes', label: 'Notes', icon: 'note' }
  ];

  // Animation setup
  useEffect(() => {
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
    ]).start();
  }, []);

  // Calculate progress based on completed drills
  useEffect(() => {
    if (session.drills && session.drills.length > 0) {
      const progress = (completedDrills.size / session.drills.length) * 100;
      setSessionProgress(progress);
    }
  }, [completedDrills, session.drills]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleStartSession = () => {
    if (sessionStarted) {
      Alert.alert(
        'End Session',
        'Are you sure you want to end this training session?',
        [
          { text: 'Continue Training', style: 'cancel' },
          { 
            text: 'End Session', 
            onPress: () => {
              setSessionStarted(false);
              setSnackbarMessage('Training session ended');
              setSnackbarVisible(true);
            }
          }
        ]
      );
    } else {
      setSessionStarted(true);
      setSnackbarMessage('Training session started! 🎯');
      setSnackbarVisible(true);
    }
  };

  const handleDrillComplete = (drillId) => {
    const newCompleted = new Set(completedDrills);
    if (newCompleted.has(drillId)) {
      newCompleted.delete(drillId);
    } else {
      newCompleted.add(drillId);
    }
    setCompletedDrills(newCompleted);
  };

  const handleShareSession = async () => {
    try {
      await Share.share({
        message: `Training Session: ${session.title}\n\nAcademy: ${academyName}\nPlan: ${planTitle}\n\nDuration: ${session.duration} minutes\nFocus: ${session.focus?.join(', ')}\n\nScheduled for: ${new Date(session.date).toLocaleDateString()} at ${session.time}`,
        title: session.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'Beginner': COLORS.success,
      'Intermediate': '#FF9800',
      'Advanced': COLORS.error,
      'beginner': COLORS.success,
      'intermediate': '#FF9800',
      'advanced': COLORS.error,
    };
    return colors[difficulty] || COLORS.textSecondary;
  };

  const renderHeader = () => (
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
          <Text style={[TEXT_STYLES.h3, { color: 'white' }]}>
            {session.title}
          </Text>
          <Text style={[TEXT_STYLES.caption, { color: 'rgba(255,255,255,0.8)' }]}>
            {academyName} • {planTitle}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="share"
            iconColor="white"
            size={24}
            onPress={handleShareSession}
          />
        </View>
      </View>

      {/* Session Progress */}
      {sessionStarted && (
        <View style={styles.progressContainer}>
          <Text style={[TEXT_STYLES.caption, { color: 'white', marginBottom: SPACING.xs }]}>
            Session Progress: {Math.round(sessionProgress)}%
          </Text>
          <ProgressBar
            progress={sessionProgress / 100}
            color="white"
            style={styles.progressBar}
          />
        </View>
      )}
    </LinearGradient>
  );

  const renderSessionInfo = () => (
    <Surface style={styles.sessionInfoCard}>
      <View style={styles.sessionInfoHeader}>
        <Avatar.Text
          size={48}
          label={academyName.charAt(0)}
          style={{ backgroundColor: COLORS.primary }}
        />
        <View style={styles.sessionInfoDetails}>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.xs }]}>
            {session.title}
          </Text>
          <View style={styles.sessionMetrics}>
            <View style={styles.metricItem}>
              <Icon name="schedule" size={16} color={COLORS.textSecondary} />
              <Text style={[TEXT_STYLES.caption, { marginLeft: 4 }]}>
                {session.time} • {session.duration}min
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Icon name="location-on" size={16} color={COLORS.textSecondary} />
              <Text style={[TEXT_STYLES.caption, { marginLeft: 4 }]}>
                {session.location || 'Training Field'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sessionChips}>
        {session.difficulty && (
          <Chip
            style={[styles.chip, { backgroundColor: getDifficultyColor(session.difficulty) + '20' }]}
            textStyle={{ color: getDifficultyColor(session.difficulty) }}
          >
            {session.difficulty}
          </Chip>
        )}
        {session.participants && (
          <Chip style={styles.chip}>
            {session.participants} players
          </Chip>
        )}
        {session.focus && session.focus.map((focus, index) => (
          <Chip key={index} style={styles.chip} mode="outlined">
            {focus}
          </Chip>
        ))}
      </View>
    </Surface>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'plan':
        return renderTrainingPlan();
      case 'progress':
        return renderProgress();
      case 'notes':
        return renderNotes();
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Week Information */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Week {session.week} Overview
          </Text>
          <Text style={[TEXT_STYLES.body1, { lineHeight: 24, marginBottom: SPACING.md }]}>
            {session.weekDescription || session.description}
          </Text>
          
          <View style={styles.overviewStats}>
            <View style={styles.statItem}>
              <Icon name="fitness-center" size={24} color={COLORS.primary} />
              <Text style={styles.statNumber}>{session.drills?.length || 0}</Text>
              <Text style={styles.statLabel}>Drills</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="schedule" size={24} color={COLORS.primary} />
              <Text style={styles.statNumber}>{session.duration}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="group" size={24} color={COLORS.primary} />
              <Text style={styles.statNumber}>{session.participants || 'N/A'}</Text>
              <Text style={styles.statLabel}>Players</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Objectives */}
      {session.objectives && session.objectives.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Session Objectives
            </Text>
            {session.objectives.map((objective, index) => (
              <View key={index} style={styles.objectiveItem}>
                <Icon name="flag" size={16} color={COLORS.primary} />
                <Text style={[TEXT_STYLES.body2, { flex: 1, marginLeft: SPACING.sm }]}>
                  {objective}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Schedule for the Week */}
      {session.weekSchedule && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Training Schedule
            </Text>
            {session.weekSchedule.map((day, index) => (
              <View key={index} style={styles.scheduleDay}>
                <View style={styles.dayHeader}>
                  <Text style={[TEXT_STYLES.subtitle1, { fontWeight: 'bold' }]}>
                    {day.day}
                  </Text>
                  <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                    {day.time} • {day.duration}
                  </Text>
                </View>
                <Text style={[TEXT_STYLES.body2, { color: COLORS.textSecondary }]}>
                  {day.focus || 'Training Session'}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderTrainingPlan = () => (
    <View style={styles.tabContent}>
      {/* Document Content */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Training Plan Details
          </Text>
          <Text style={[TEXT_STYLES.body1, { lineHeight: 22 }]}>
            {session.documentContent || session.rawContent || 'No detailed training plan content available.'}
          </Text>
        </Card.Content>
      </Card>

      {/* Drills List */}
      {session.drills && session.drills.length > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Training Drills ({session.drills.length})
            </Text>
            {session.drills.map((drill, index) => (
              <View key={index} style={styles.drillItem}>
                <TouchableOpacity
                  style={styles.drillHeader}
                  onPress={() => handleDrillComplete(drill.id || index)}
                >
                  <View style={styles.drillInfo}>
                    <Icon
                      name={completedDrills.has(drill.id || index) ? "check-circle" : "radio-button-unchecked"}
                      size={24}
                      color={completedDrills.has(drill.id || index) ? COLORS.success : COLORS.textSecondary}
                    />
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={[TEXT_STYLES.subtitle1, { fontWeight: 'bold' }]}>
                        {drill.name || drill.title || `Drill ${index + 1}`}
                      </Text>
                      {drill.duration && (
                        <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                          Duration: {drill.duration} minutes
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                
                {drill.description && (
                  <Text style={[TEXT_STYLES.body2, { 
                    marginTop: SPACING.sm, 
                    marginLeft: 36,
                    color: COLORS.textSecondary 
                  }]}>
                    {drill.description}
                  </Text>
                )}

                {drill.instructions && (
                  <Text style={[TEXT_STYLES.body2, { 
                    marginTop: SPACING.xs, 
                    marginLeft: 36,
                    fontStyle: 'italic' 
                  }]}>
                    {drill.instructions}
                  </Text>
                )}
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderProgress = () => (
    <View style={styles.tabContent}>
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Session Progress
          </Text>
          
          <View style={styles.progressCircle}>
            <Text style={[TEXT_STYLES.h1, { color: COLORS.primary }]}>
              {Math.round(sessionProgress)}%
            </Text>
            <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
              Complete
            </Text>
          </View>
          
          <ProgressBar
            progress={sessionProgress / 100}
            color={COLORS.primary}
            style={styles.progressBarLarge}
          />
          
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatNumber}>
                {completedDrills.size}
              </Text>
              <Text style={styles.progressStatLabel}>Drills Completed</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatNumber}>
                {(session.drills?.length || 0) - completedDrills.size}
              </Text>
              <Text style={styles.progressStatLabel}>Drills Remaining</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Completed Drills List */}
      {completedDrills.size > 0 && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Completed Drills
            </Text>
            {Array.from(completedDrills).map((drillId, index) => {
              const drill = session.drills?.find((d, i) => d.id === drillId || i === drillId);
              return (
                <View key={index} style={styles.completedDrill}>
                  <Icon name="check-circle" size={20} color={COLORS.success} />
                  <Text style={[TEXT_STYLES.body1, { marginLeft: SPACING.sm }]}>
                    {drill?.name || drill?.title || `Drill ${drillId + 1}`}
                  </Text>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderNotes = () => (
    <View style={styles.tabContent}>
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
            Session Notes
          </Text>
          <Text style={[TEXT_STYLES.body2, { color: COLORS.textSecondary, marginBottom: SPACING.md }]}>
            Add your observations, player performance notes, and improvements for future sessions.
          </Text>
          
          <Surface style={styles.notesInput}>
            <Text style={[TEXT_STYLES.body1, { minHeight: 100 }]}>
              {sessionNotes || 'Tap to add notes...'}
            </Text>
          </Surface>
          
          <Button
            mode="outlined"
            onPress={() => {
              setSnackbarMessage('Notes feature will be available in the next update');
              setSnackbarVisible(true);
            }}
            style={{ marginTop: SPACING.md }}
          >
            Edit Notes
          </Button>
        </Card.Content>
      </Card>

      {/* Coach Recommendations */}
      {session.coachNotes && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
              Coach Recommendations
            </Text>
            <Text style={[TEXT_STYLES.body1, { lineHeight: 22 }]}>
              {session.coachNotes}
            </Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderTabNavigation = () => (
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
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent />
      
      {renderHeader()}
      {renderTabNavigation()}

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
          showsVerticalScrollIndicator={false}
        >
          {renderSessionInfo()}
          {renderTabContent()}
        </ScrollView>
      </Animated.View>

      {/* Start/End Session FAB */}
      <FAB
        icon={sessionStarted ? "stop" : "play-arrow"}
        style={[
          styles.fab,
          { backgroundColor: sessionStarted ? COLORS.error : COLORS.success }
        ]}
        onPress={handleStartSession}
        label={sessionStarted ? "End Session" : "Start Session"}
      />

      {/* Success Snackbar */}
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
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: StatusBar.currentHeight + SPACING.md,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
  },
  progressContainer: {
    paddingHorizontal: SPACING.lg,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
  sessionInfoCard: {
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: 12,
    elevation: 2,
  },
  sessionInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sessionInfoDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  sessionMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginTop: SPACING.xs,
  },
  sessionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tabContent: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  sectionCard: {
    marginBottom: SPACING.md,
    borderRadius: 12,
    elevation: 2,
  },
  overviewStats: {
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
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  scheduleDay: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  drillItem: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  drillHeader: {
    paddingVertical: SPACING.xs,
  },
  drillInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  progressBarLarge: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginVertical: SPACING.md,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  completedDrill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  notesInput: {
    padding: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fab: {
    position: 'absolute',
    margin: SPACING.md,
    right: 0,
    bottom: 0,
  },
  errorContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: SPACING.xl,
  backgroundColor: COLORS.background,
},
};

export default SessionScheduleScreen;