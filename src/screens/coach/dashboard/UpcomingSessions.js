import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Vibration,
} from 'react-native';
import { 
  Card,
  Button,
  Chip,
  Avatar,
  IconButton,
  FAB,
  Surface,
  Searchbar,
  ProgressBar,
  Portal,
  //Modal,
  ActivityIndicator,
  Snackbar,
  Menu,
  Divider,
} from 'react-native-paper';
//import { ProgressBar,
import { BlurView } from '../../../components/shared/BlurView';
import { LinearGradient } from '../../../components/shared/LinearGradient';
import Icon from '../../../components/shared/Icon';
import { useSelector, useDispatch } from 'react-redux';

// Import your design constants
const COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  background: '#f5f7fa',
  white: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  border: '#E0E0E0',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const TEXT_STYLES = {
  h1: { fontSize: 28, fontWeight: 'bold' },
  h2: { fontSize: 22, fontWeight: '600' },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 14, fontWeight: '400' },
  small: { fontSize: 12, fontWeight: '400' },
};

const { width, height } = Dimensions.get('window');

const UpcomingSessions = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, sessions, players, isLoading } = useSelector(state => ({
    user: state.auth.user,
    sessions: state.sessions.upcomingSessions || [],
    players: state.players.list || [],
    isLoading: state.sessions.isLoading,
  }));

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Dispatch action to fetch upcoming sessions
      // dispatch(fetchUpcomingSessions());
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh sessions');
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const toggleSessionExpansion = (sessionId) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
    // Add platform check for Vibration
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(50);
    }
  };

  const handleStartSession = (session) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate([50, 50, 50]);
    }
    Alert.alert(
      'Start Session',
      `Ready to start "${session.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start', 
          onPress: () => {
            // Navigate to active session screen
            navigation.navigate('ActiveSession', { sessionId: session.id });
          }
        }
      ]
    );
  };

  const handleEditSession = (session) => {
    navigation.navigate('EditSession', { sessionId: session.id });
  };

  const handleViewPlayer = (playerId) => {
    navigation.navigate('PlayerProfile', { playerId });
  };

  // Mock data for demonstration
  const mockSessions = [
    {
      id: 1,
      title: 'Morning Football Training',
      time: '08:00',
      duration: 90,
      date: new Date().toISOString().split('T')[0],
      location: 'Field A',
      type: 'Team Training',
      participants: 15,
      status: 'scheduled',
      players: [
        { id: 1, name: 'John Doe', avatar: null, attendance: 'confirmed' },
        { id: 2, name: 'Jane Smith', avatar: null, attendance: 'pending' },
        { id: 3, name: 'Mike Johnson', avatar: null, attendance: 'confirmed' },
      ],
      completionRate: 85,
      difficulty: 'Intermediate',
      notes: 'Focus on passing drills and tactical positioning',
    },
    {
      id: 2,
      title: '1-on-1 Technical Session',
      time: '14:30',
      duration: 60,
      date: new Date().toISOString().split('T')[0],
      location: 'Training Room B',
      type: 'Individual',
      participants: 1,
      status: 'scheduled',
      players: [
        { id: 4, name: 'Alex Wilson', avatar: null, attendance: 'confirmed' },
      ],
      completionRate: 95,
      difficulty: 'Advanced',
      notes: 'Work on ball control and finishing techniques',
    },
    {
      id: 3,
      title: 'Youth Academy Training',
      time: '16:00',
      duration: 75,
      date: new Date().toISOString().split('T')[0],
      location: 'Academy Pitch',
      type: 'Youth Training',
      participants: 12,
      status: 'upcoming',
      players: [
        { id: 5, name: 'Tommy Brown', avatar: null, attendance: 'pending' },
        { id: 6, name: 'Sarah Davis', avatar: null, attendance: 'confirmed' },
      ],
      completionRate: 78,
      difficulty: 'Beginner',
      notes: 'Basic skills development and fun games',
    },
  ];

  const filteredSessions = mockSessions.filter(session => {
    const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         session.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || session.type.toLowerCase().includes(selectedFilter);
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return COLORS.success;
      case 'upcoming': return COLORS.warning;
      case 'in_progress': return COLORS.primary;
      default: return COLORS.textSecondary;
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return COLORS.success;
      case 'intermediate': return COLORS.warning;
      case 'advanced': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const renderSessionCard = ({ item: session, index }) => {
    const isExpanded = expandedSessions.has(session.id);
    const cardScale = scaleAnim;

    return (
      <Animated.View
        style={[
          { transform: [{ scale: cardScale }, { translateY: slideAnim }] },
          { marginBottom: SPACING.md }
        ]}
      >
        <Card style={styles.sessionCard}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary]}
            style={styles.cardHeader}
          >
            <View style={styles.sessionHeader}>
              <View style={styles.sessionInfo}>
                <Text style={[TEXT_STYLES.h3, { color: COLORS.white }]}>
                  {session.title}
                </Text>
                <View style={styles.timeLocation}>
                  <Icon name="access-time" size={16} color={COLORS.white} />
                  <Text style={[TEXT_STYLES.caption, { color: COLORS.white, marginLeft: 4 }]}>
                    {session.time} • {session.duration}min
                  </Text>
                </View>
                <View style={styles.timeLocation}>
                  <Icon name="location-on" size={16} color={COLORS.white} />
                  <Text style={[TEXT_STYLES.caption, { color: COLORS.white, marginLeft: 4 }]}>
                    {session.location}
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <Chip
                  style={[styles.statusChip, { backgroundColor: getStatusColor(session.status) }]}
                  textStyle={{ color: COLORS.white, fontSize: 12 }}
                >
                  {session.status.replace('_', ' ').toUpperCase()}
                </Chip>
              </View>
            </View>
          </LinearGradient>

          <Card.Content style={styles.cardContent}>
            <View style={styles.sessionMetrics}>
              <View style={styles.metricItem}>
                <Icon name="group" size={20} color={COLORS.primary} />
                <Text style={[TEXT_STYLES.caption, { marginLeft: 4 }]}>
                  {session.participants} participants
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Icon name="star" size={20} color={getDifficultyColor(session.difficulty)} />
                <Text style={[TEXT_STYLES.caption, { marginLeft: 4 }]}>
                  {session.difficulty}
                </Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                Completion Rate
              </Text>
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={session.completionRate / 100}
                  color={COLORS.success}
                  style={styles.progressBar}
                />
                <Text style={[TEXT_STYLES.small, { marginLeft: 8 }]}>
                  {session.completionRate}%
                </Text>
              </View>
            </View>

            {session.notes && (
              <View style={styles.notesSection}>
                <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary, marginBottom: 4 }]}>
                  Notes:
                </Text>
                <Text style={TEXT_STYLES.small}>{session.notes}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => toggleSessionExpansion(session.id)}
              style={styles.expandButton}
            >
              <Text style={[TEXT_STYLES.caption, { color: COLORS.primary }]}>
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </Text>
              <Icon
                name={isExpanded ? 'expand-less' : 'expand-more'}
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.expandedContent}>
                <Text style={[TEXT_STYLES.caption, { marginBottom: 8, fontWeight: '600' }]}>
                  Participants ({session.players.length})
                </Text>
                {session.players.map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => handleViewPlayer(player.id)}
                    style={styles.playerItem}
                  >
                    <Avatar.Text
                      size={32}
                      label={player.name.split(' ').map(n => n[0]).join('')}
                      style={{ backgroundColor: COLORS.primary }}
                    />
                    <View style={styles.playerInfo}>
                      <Text style={TEXT_STYLES.body}>{player.name}</Text>
                      <Chip
                        style={[
                          styles.attendanceChip,
                          {
                            backgroundColor: player.attendance === 'confirmed'
                              ? COLORS.success : COLORS.warning
                          }
                        ]}
                        textStyle={{ color: COLORS.white, fontSize: 10 }}
                      >
                        {player.attendance}
                      </Chip>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card.Content>

          <Card.Actions style={styles.cardActions}>
            <Button
              mode="outlined"
              onPress={() => handleEditSession(session)}
              style={styles.actionButton}
              contentStyle={styles.buttonContent}
            >
              <Icon name="edit" size={16} />
              Edit
            </Button>
            <Button
              mode="contained"
              onPress={() => handleStartSession(session)}
              style={[styles.actionButton, { backgroundColor: COLORS.success }]}
              contentStyle={styles.buttonContent}
            >
              <Icon name="play-arrow" size={16} color={COLORS.white} />
              Start
            </Button>
          </Card.Actions>
        </Card>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="event-available" size={80} color={COLORS.textSecondary} />
      <Text style={[TEXT_STYLES.h3, { color: COLORS.textSecondary, marginTop: 16 }]}>
        No sessions scheduled
      </Text>
      <Text style={[TEXT_STYLES.body, { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 }]}>
        Create your first training session to get started! 🚀
      </Text>
    </View>
  );

  const renderFilterModal = () => (
    <Portal>
      <Modal
        visible={filterModalVisible}
        onDismiss={() => setFilterModalVisible(false)}
        contentContainerStyle={styles.modalContent}
        transparent
      >
        <View style={styles.modalOverlay}>
          <BlurView 
            intensity={20} 
            tint="light" 
            style={styles.blurContainer}
          >
            <Surface style={styles.modalSurface}>
              <Text style={[TEXT_STYLES.h3, { marginBottom: 20 }]}>Filter Sessions</Text>
              
              {['all', 'team', 'individual', 'youth'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => {
                    setSelectedFilter(filter);
                    setFilterModalVisible(false);
                    if (Platform.OS === 'ios' || Platform.OS === 'android') {
                      Vibration.vibrate(50);
                    }
                  }}
                  style={[
                    styles.filterOption,
                    selectedFilter === filter && styles.selectedFilter
                  ]}
                >
                  <Text style={[
                    TEXT_STYLES.body,
                    selectedFilter === filter && { color: COLORS.white }
                  ]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)} Sessions
                  </Text>
                  {selectedFilter === filter && (
                    <Icon name="check" size={20} color={COLORS.white} />
                  )}
                </TouchableOpacity>
              ))}
            </Surface>
          </BlurView>
        </View>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent />
      
      <LinearGradient
        colors={[COLORS.primary, COLORS.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={[TEXT_STYLES.h1, { color: COLORS.white }]}>
              Upcoming Sessions
            </Text>
            <Text style={[TEXT_STYLES.body, { color: COLORS.white, opacity: 0.9 }]}>
              {filteredSessions.length} sessions today 📅
            </Text>
          </View>
          <IconButton
            icon="tune"
            size={24}
            iconColor={COLORS.white}
            onPress={() => setFilterModalVisible(true)}
            style={styles.filterButton}
          />
        </View>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search sessions..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor={COLORS.primary}
          inputStyle={{ color: COLORS.text }}
        />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <FlatList
          data={filteredSessions}
          renderItem={renderSessionCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      </Animated.View>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: COLORS.primary }]}
        onPress={() => navigation.navigate('CreateSession')}
        label="New Session"
      />

      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  filterButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchBar: {
    backgroundColor: COLORS.background,
    elevation: 0,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  sessionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: SPACING.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
  },
  timeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerActions: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  cardContent: {
    paddingTop: SPACING.md,
  },
  sessionMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  notesSection: {
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  expandedContent: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceChip: {
    height: 24,
  },
  cardActions: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: SPACING.xs,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  blurContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalSurface: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: SPACING.lg,
    borderRadius: 12,
    width: width * 0.8,
    maxHeight: height * 0.6,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  selectedFilter: {
    backgroundColor: COLORS.primary,
  },
});

export default UpcomingSessions;