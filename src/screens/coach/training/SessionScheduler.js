import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Vibration,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from '../../../components/shared/LinearGradient';
import { BlurView } from '../../../components/shared/BlurView';
import { 
  Card,
  Button,
  Chip,
  Avatar,
  IconButton,
  FAB,
  Surface,
  Portal,
  Searchbar,
  ProgressBar,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS } from '../../../styles/colors';
import { SPACING } from '../../../styles/spacing';
import { TEXT_STYLES } from '../../../styles/textStyles';
import { TYPOGRAPHY } from '../../../styles/typography';
import { LAYOUT } from '../../../styles/layout';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SessionScheduler = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, coachData } = useSelector((state) => state.auth);
  const { sessions, players, trainingPlans } = useSelector((state) => state.coach);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // week, month, day
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    date: new Date(),
    time: '09:00',
    duration: 60,
    location: '',
    type: 'training',
    players: [],
    trainingPlan: null,
    notes: '',
  });

  const scrollY = useSharedValue(0);
  const fabScale = useSharedValue(1);

  // Sample data - replace with Redux state
  const upcomingSessions = [
    {
      id: 1,
      title: 'Morning Training Session',
      date: '2024-12-27',
      time: '09:00',
      duration: 90,
      location: 'Main Field',
      type: 'training',
      players: ['John Doe', 'Jane Smith', 'Mike Johnson'],
      status: 'scheduled',
      trainingPlan: 'Week 1 - Endurance Building',
    },
    {
      id: 2,
      title: 'Team Strategy Meeting',
      date: '2024-12-27',
      time: '14:00',
      duration: 60,
      location: 'Conference Room',
      type: 'meeting',
      players: ['John Doe', 'Jane Smith'],
      status: 'confirmed',
    },
    {
      id: 3,
      title: 'Individual Skills Training',
      date: '2024-12-28',
      time: '10:00',
      duration: 45,
      location: 'Training Ground A',
      type: 'individual',
      players: ['Mike Johnson'],
      status: 'scheduled',
    },
  ];

  const sessionTypes = [
    { id: 'training', label: 'Training', icon: 'fitness-center', color: COLORS.primary },
    { id: 'meeting', label: 'Meeting', icon: 'meeting-room', color: COLORS.secondary },
    { id: 'individual', label: 'Individual', icon: 'person', color: COLORS.success },
    { id: 'assessment', label: 'Assessment', icon: 'assessment', color: COLORS.warning },
    { id: 'recovery', label: 'Recovery', icon: 'spa', color: COLORS.info },
  ];

  const timeSlots = Array.from({ length: 15 }, (_, i) => {
    const hour = Math.floor(i / 2) + 6;
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    loadScheduleData();
  }, [selectedDate, viewMode]);

  const loadScheduleData = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // dispatch(fetchCoachSessions({ date: selectedDate, viewMode }));
    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScheduleData();
    setRefreshing(false);
  }, [selectedDate, viewMode]);

  const handleCreateSession = async () => {
    try {
      if (!newSession.title || !newSession.date) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      Vibration.vibrate(50);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert(
        'Success! 🎉',
        'Training session has been scheduled successfully',
        [{ text: 'OK', onPress: () => setShowCreateModal(false) }]
      );
      
      // Reset form
      setNewSession({
        title: '',
        description: '',
        date: new Date(),
        time: '09:00',
        duration: 60,
        location: '',
        type: 'training',
        players: [],
        trainingPlan: null,
        notes: '',
      });
      
    } catch (error) {
      Alert.alert('Error', 'Failed to create session. Please try again.');
    }
  };

  const handleEditSession = (session) => {
    navigation.navigate('SessionDetails', { sessionId: session.id, mode: 'edit' });
  };

  const handleCancelSession = (sessionId) => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this training session?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            Vibration.vibrate(100);
            // dispatch(cancelSession(sessionId));
            Alert.alert('Cancelled', 'Session has been cancelled');
          }
        }
      ]
    );
  };

  const getSessionTypeConfig = (type) => {
    return sessionTypes.find(t => t.id === type) || sessionTypes[0];
  };

  const getDayName = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  const getMonthName = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()];
  };

  const renderHeader = () => (
    <Animated.View entering={FadeInDown.delay(100)}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={{
          paddingTop: StatusBar.currentHeight + 20,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.lg,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
          <View>
            <Text style={[TEXT_STYLES.header, { color: 'white', fontSize: 28 }]}>
              Schedule 📅
            </Text>
            <Text style={[TEXT_STYLES.body, { color: 'rgba(255,255,255,0.8)', marginTop: 4 }]}>
              Manage your training sessions
            </Text>
          </View>
          <Avatar.Text
            size={50}
            label={user?.name?.charAt(0) || 'C'}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            labelStyle={{ color: 'white' }}
          />
        </View>

        {/* View Mode Selector */}
        <View style={{ flexDirection: 'row', marginBottom: SPACING.md }}>
          {['day', 'week', 'month'].map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                flex: 1,
                paddingVertical: SPACING.sm,
                paddingHorizontal: SPACING.md,
                backgroundColor: viewMode === mode ? 'rgba(255,255,255,0.3)' : 'transparent',
                borderRadius: 20,
                marginHorizontal: 4,
                alignItems: 'center',
              }}
            >
              <Text style={[TEXT_STYLES.body, {
                color: 'white',
                fontWeight: viewMode === mode ? 'bold' : 'normal',
                textTransform: 'capitalize',
              }]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            style={{ padding: SPACING.sm }}
          >
            <Icon name="chevron-left" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => {/* Open date picker */}}
            style={{ alignItems: 'center' }}
          >
            <Text style={[TEXT_STYLES.h3, { color: 'white', fontSize: 20 }]}>
              {getMonthName(selectedDate)} {selectedDate.getDate()}
            </Text>
            <Text style={[TEXT_STYLES.body, { color: 'rgba(255,255,255,0.8)' }]}>
              {getDayName(selectedDate)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            style={{ padding: SPACING.sm }}
          >
            <Icon name="chevron-right" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderQuickStats = () => (
    <Animated.View
      entering={FadeInDown.delay(200)}
      style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.lg }}
    >
      <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.md }]}>
        Today's Overview
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Surface style={{
          flex: 1,
          padding: SPACING.md,
          borderRadius: 16,
          marginRight: SPACING.sm,
          elevation: 2,
        }}>
          <View style={{ alignItems: 'center' }}>
            <Icon name="event" size={24} color={COLORS.primary} />
            <Text style={[TEXT_STYLES.h2, { marginTop: SPACING.xs, color: COLORS.primary }]}>
              3
            </Text>
            <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
              Sessions
            </Text>
          </View>
        </Surface>
        
        <Surface style={{
          flex: 1,
          padding: SPACING.md,
          borderRadius: 16,
          marginHorizontal: SPACING.xs,
          elevation: 2,
        }}>
          <View style={{ alignItems: 'center' }}>
            <Icon name="group" size={24} color={COLORS.success} />
            <Text style={[TEXT_STYLES.h2, { marginTop: SPACING.xs, color: COLORS.success }]}>
              12
            </Text>
            <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
              Players
            </Text>
          </View>
        </Surface>
        
        <Surface style={{
          flex: 1,
          padding: SPACING.md,
          borderRadius: 16,
          marginLeft: SPACING.sm,
          elevation: 2,
        }}>
          <View style={{ alignItems: 'center' }}>
            <Icon name="schedule" size={24} color={COLORS.warning} />
            <Text style={[TEXT_STYLES.h2, { marginTop: SPACING.xs, color: COLORS.warning }]}>
              4h
            </Text>
            <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
              Duration
            </Text>
          </View>
        </Surface>
      </View>
    </Animated.View>
  );

  const renderSessionCard = ({ item, index }) => {
    const typeConfig = getSessionTypeConfig(item.type);
    
    return (
      <Animated.View entering={FadeInRight.delay(index * 100)}>
        <Card style={{
          marginHorizontal: SPACING.lg,
          marginBottom: SPACING.md,
          borderRadius: 16,
          elevation: 3,
        }}>
          <LinearGradient
            colors={[typeConfig.color, `${typeConfig.color}90`]}
            style={{
              height: 4,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          />
          
          <Card.Content style={{ padding: SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
                  <Icon name={typeConfig.icon} size={20} color={typeConfig.color} />
                  <Text style={[TEXT_STYLES.h4, { marginLeft: SPACING.xs, flex: 1 }]}>
                    {item.title}
                  </Text>
                  <Chip
                    mode="outlined"
                    compact
                    style={{ backgroundColor: `${typeConfig.color}20` }}
                    textStyle={{ color: typeConfig.color, fontSize: 12 }}
                  >
                    {typeConfig.label}
                  </Chip>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
                  <Icon name="access-time" size={16} color={COLORS.textSecondary} />
                  <Text style={[TEXT_STYLES.body, { marginLeft: SPACING.xs, color: COLORS.textSecondary }]}>
                    {item.time} • {item.duration} min
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs }}>
                  <Icon name="location-on" size={16} color={COLORS.textSecondary} />
                  <Text style={[TEXT_STYLES.body, { marginLeft: SPACING.xs, color: COLORS.textSecondary }]}>
                    {item.location}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="group" size={16} color={COLORS.textSecondary} />
                  <Text style={[TEXT_STYLES.caption, { marginLeft: SPACING.xs, color: COLORS.textSecondary }]}>
                    {item.players.length} player{item.players.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              
              <View style={{ marginLeft: SPACING.md }}>
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => {
                    Alert.alert(
                      'Session Options',
                      'Choose an action',
                      [
                        { text: 'Edit', onPress: () => handleEditSession(item) },
                        { text: 'Cancel', onPress: () => handleCancelSession(item.id), style: 'destructive' },
                        { text: 'Close', style: 'cancel' }
                      ]
                    );
                  }}
                />
              </View>
            </View>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  };

  const renderCreateSessionModal = () => (
    <Portal>
      <Modal
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
        animationType="slide"
      >
        <BlurView intensity={95} style={{ flex: 1 }}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: SPACING.lg,
          }}>
            <Surface style={{
              borderRadius: 20,
              padding: SPACING.lg,
              maxHeight: '80%',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
                <Text style={[TEXT_STYLES.h3]}>Create Session 📝</Text>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={() => setShowCreateModal(false)}
                />
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: SPACING.md,
                    marginBottom: SPACING.md,
                    fontSize: 16,
                  }}
                  placeholder="Session Title"
                  value={newSession.title}
                  onChangeText={(text) => setNewSession(prev => ({ ...prev, title: text }))}
                />
                
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: SPACING.md,
                    marginBottom: SPACING.md,
                    fontSize: 16,
                    minHeight: 80,
                  }}
                  placeholder="Description (optional)"
                  multiline
                  value={newSession.description}
                  onChangeText={(text) => setNewSession(prev => ({ ...prev, description: text }))}
                />
                
                <Text style={[TEXT_STYLES.body, { marginBottom: SPACING.sm, fontWeight: '600' }]}>
                  Session Type
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.lg }}>
                  {sessionTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => setNewSession(prev => ({ ...prev, type: type.id }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: SPACING.md,
                        paddingVertical: SPACING.sm,
                        borderRadius: 20,
                        marginRight: SPACING.sm,
                        marginBottom: SPACING.sm,
                        backgroundColor: newSession.type === type.id ? type.color : `${type.color}20`,
                      }}
                    >
                      <Icon
                        name={type.icon}
                        size={16}
                        color={newSession.type === type.id ? 'white' : type.color}
                      />
                      <Text style={{
                        marginLeft: SPACING.xs,
                        color: newSession.type === type.id ? 'white' : type.color,
                        fontWeight: '500',
                      }}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 12,
                    padding: SPACING.md,
                    marginBottom: SPACING.md,
                    fontSize: 16,
                  }}
                  placeholder="Location"
                  value={newSession.location}
                  onChangeText={(text) => setNewSession(prev => ({ ...prev, location: text }))}
                />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg }}>
                  <Button
                    mode="outlined"
                    style={{ flex: 0.48 }}
                    onPress={() => Alert.alert('Feature Coming Soon', 'Date picker will be implemented')}
                  >
                    📅 Date
                  </Button>
                  <Button
                    mode="outlined"
                    style={{ flex: 0.48 }}
                    onPress={() => Alert.alert('Feature Coming Soon', 'Time picker will be implemented')}
                  >
                    🕐 Time
                  </Button>
                </View>
                
                <Button
                  mode="contained"
                  onPress={handleCreateSession}
                  style={{
                    borderRadius: 12,
                    paddingVertical: SPACING.xs,
                  }}
                  contentStyle={{ paddingVertical: SPACING.sm }}
                >
                  Create Session 🚀
                </Button>
              </ScrollView>
            </Surface>
          </View>
        </BlurView>
      </Modal>
    </Portal>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {renderHeader()}
      
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderQuickStats()}
        
        <View style={{ marginTop: SPACING.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
            <Text style={[TEXT_STYLES.h3]}>
              Upcoming Sessions
            </Text>
            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                borderRadius: 20,
                backgroundColor: `${COLORS.primary}20`,
              }}
            >
              <Icon name="filter-list" size={16} color={COLORS.primary} />
              <Text style={[TEXT_STYLES.caption, { marginLeft: SPACING.xs, color: COLORS.primary }]}>
                Filter
              </Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={upcomingSessions}
            renderItem={renderSessionCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      <FAB
        icon="add"
        onPress={() => setShowCreateModal(true)}
        style={{
          position: 'absolute',
          right: SPACING.lg,
          bottom: SPACING.xl,
          backgroundColor: COLORS.primary,
        }}
      />
      
      {renderCreateSessionModal()}
    </View>
  );
};

export default SessionScheduler;
