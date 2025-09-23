import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  StatusBar,
  Animated,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { 
  Card,
  Button,
  Chip,
  ProgressBar,
  Avatar,
  IconButton,
  FAB,
  Surface,
  Searchbar,
  Text,
  Portal,
  Modal,
  Divider,
} from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { BlurView } from '../../../components/shared/BlurView';
import { LinearGradient } from '../../../components/shared/LinearGradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Design system imports
import { COLORS } from '../../../styles/colors';
import { SPACING } from '../../../styles/spacing';
import { TEXT_STYLES } from '../../../styles/textStyles';
import { TYPOGRAPHY } from '../../../styles/typography';
import { LAYOUT } from '../../../styles/layout';
import { DocumentProcessor } from '../../../services/DocumentProcessor';
//import PlaceholderScreen from '../../../components/PlaceholderScreen';

const { width: screenWidth } = Dimensions.get('window');

const TrainingPlanLibrary = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, isOnline } = useSelector(state => state.auth);
  const { trainingPlans, error } = useSelector(state => state.training);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'


  // Replace the useState with real data loading
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { key: 'all', label: 'All Sports', icon: 'stadium' },
    { key: 'football', label: 'Football', icon: 'football' },
    { key: 'basketball', label: 'Basketball', icon: 'basketball' },
    { key: 'soccer', label: 'Soccer', icon: 'soccer' },
    { key: 'tennis', label: 'Tennis', icon: 'tennis' },
    { key: 'fitness', label: 'Fitness', icon: 'radiobox-marked' },
  ];

  const difficultyColors = {
    beginner: COLORS.success,
    intermediate: '#FF9800',
    advanced: COLORS.error,
  };

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

  // Add this useEffect to load real data
  useEffect(() => {
    loadTrainingPlans();
  }, []);

  // Refresh handler
    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        await loadTrainingPlans();
      } catch (error) {
        Alert.alert('Error', 'Failed to refresh training plans');
      } finally {
        setRefreshing(false);
      }
    }, []);

    // Add loading state to the render
    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: SPACING.md }}>Loading training plans...</Text>
        </View>
      );
    }

  // Filter plans based on search and category
  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plan.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || plan.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle plan selection
  const handlePlanPress = useCallback((plan) => {
    setSelectedPlan(plan);
    if (plan.isOwned) {
      navigation.navigate('TrainingPlanDetails', { planId: plan.id });
    } else {
      // Show purchase/preview modal
      Alert.alert(
        'Training Plan',
        `Would you like to preview or purchase "${plan.title}"?`,
        [
          { text: 'Preview', onPress: () => handlePreviewPlan(plan) },
          { text: 'Purchase', onPress: () => handlePurchasePlan(plan) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [navigation]);

  const loadTrainingPlans = async () => {
  try {
    setLoading(true);
    const realPlans = await DocumentProcessor.getTrainingPlans();
    setPlans(realPlans);
  } catch (error) {
    console.error('Error loading training plans:', error);
    Alert.alert('Error', 'Failed to load training plans');
  } finally {
    setLoading(false);
  }
};

  const handlePreviewPlan = (plan) => {
    Alert.alert('Feature Coming Soon', 'Plan preview functionality will be available in the next update! 🏃‍♂️');
  };

  const handlePurchasePlan = (plan) => {
    Alert.alert('Feature Coming Soon', 'Marketplace payment system will be available in the next update! 💳');
  };

  const handleCreatePlan = () => {
    navigation.navigate('CreateTrainingPlan');
  };

  const renderPlanCard = ({ item: plan, index }) => {
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          marginBottom: SPACING.md,
        }}
      >
        <TouchableOpacity
          onPress={() => handlePlanPress(plan)}
          activeOpacity={0.7}
        >
          <Card style={{
            marginHorizontal: SPACING.sm,
            elevation: 4,
            borderRadius: 12,
          }}>
            <LinearGradient
              colors={plan.isOwned ? ['#667eea', '#764ba2'] : ['#e0e0e0', '#bdbdbd']}
              style={{
                height: 120,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                padding: SPACING.md,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[TEXT_STYLES.h3, { color: 'white', marginBottom: SPACING.xs }]}>
                    {plan.title}
                  </Text>
                  <Text style={[TEXT_STYLES.caption, { color: 'rgba(255,255,255,0.8)' }]}>
                    {plan.creator} • {plan.duration}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {plan.isOwned ? (
                    <Icon name="check-circle" size={24} color="white" />
                  ) : (
                    <Text style={[TEXT_STYLES.body2, { color: 'white', fontWeight: 'bold' }]}>
                      ${plan.price}
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor: difficultyColors[plan.difficulty],
                    height: 28,
                  }}
                  textStyle={{ color: 'white', fontSize: 12 }}
                >
                  {plan.difficulty.charAt(0).toUpperCase() + plan.difficulty.slice(1)}
                </Chip>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="star" size={16} color="#FFD700" />
                  <Text style={[TEXT_STYLES.caption, { color: 'white', marginLeft: 4 }]}>
                    {plan.rating}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <Card.Content style={{ padding: SPACING.md }}>
              <Text style={[TEXT_STYLES.body2, { marginBottom: SPACING.sm, color: COLORS.textSecondary }]}>
                {plan.description}
              </Text>
              
              {plan.isOwned && plan.progress > 0 && (
                <View style={{ marginBottom: SPACING.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[TEXT_STYLES.caption, { color: COLORS.textSecondary }]}>
                      Progress
                    </Text>
                    <Text style={[TEXT_STYLES.caption, { color: COLORS.primary }]}>
                      {plan.progress}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={plan.progress / 100}
                    color={COLORS.primary}
                    style={{ height: 6, borderRadius: 3 }}
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="fitness-center" size={16} color={COLORS.textSecondary} />
                  <Text style={[TEXT_STYLES.caption, { marginLeft: 4, color: COLORS.textSecondary }]}>
                    {plan.sessionsCount} sessions
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="download" size={16} color={COLORS.textSecondary} />
                  <Text style={[TEXT_STYLES.caption, { marginLeft: 4, color: COLORS.textSecondary }]}>
                    {plan.downloads}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.sm }}>
                {plan.tags.slice(0, 3).map((tag, tagIndex) => (
                  <Chip
                    key={tagIndex}
                    mode="outlined"
                    compact
                    style={{
                      marginRight: SPACING.xs,
                      marginBottom: SPACING.xs,
                      height: 24,
                    }}
                    textStyle={{ fontSize: 10 }}
                  >
                    {tag}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderCategoryChip = ({ item: category }) => (
    <Chip
      mode={selectedCategory === category.key ? 'flat' : 'outlined'}
      selected={selectedCategory === category.key}
      onPress={() => setSelectedCategory(category.key)}
      icon={category.icon}
      style={{
        marginRight: SPACING.sm,
        backgroundColor: selectedCategory === category.key ? COLORS.primary : 'transparent',
      }}
      textStyle={{
        color: selectedCategory === category.key ? 'white' : COLORS.textPrimary,
      }}
    >
      {category.label}
    </Chip>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent />
      
      {/* Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={{
          paddingTop: StatusBar.currentHeight + SPACING.md,
          paddingBottom: SPACING.lg,
          paddingHorizontal: SPACING.md,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
          <Text style={[TEXT_STYLES.h2, { color: 'white' }]}>
            Training Library 📚
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon={viewMode === 'grid' ? 'view-list' : 'view-module'}
              iconColor="white"
              size={24}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            />
            <IconButton
              icon="tune"
              iconColor="white"
              size={24}
              onPress={() => setFilterModalVisible(true)}
            />
          </View>
        </View>

        {/* Search Bar */}
        <Searchbar
          placeholder="Search training plans..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            elevation: 0,
          }}
          iconColor={COLORS.primary}
          inputStyle={{ color: COLORS.textPrimary }}
        />
      </LinearGradient>

      {/* Category Filter */}
      <View style={{ paddingVertical: SPACING.md }}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.md }}
          renderItem={renderCategoryChip}
          keyExtractor={item => item.key}
        />
      </View>

      {/* Plans List */}
      <FlatList
        data={filteredPlans}
        renderItem={renderPlanCard}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
            <Icon name="search-off" size={64} color={COLORS.textSecondary} />
            <Text style={[TEXT_STYLES.h3, { marginTop: SPACING.md, color: COLORS.textSecondary }]}>
              No plans found
            </Text>
            <Text style={[TEXT_STYLES.body2, { marginTop: SPACING.sm, color: COLORS.textSecondary, textAlign: 'center' }]}>
              Try adjusting your search or category filter
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          margin: SPACING.md,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.primary,
        }}
        onPress={handleCreatePlan}
        label="Create Plan"
      />

      {/* Filter Modal */}
      <Portal>
        <Modal
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: SPACING.lg,
            borderRadius: 12,
            padding: SPACING.lg,
          }}
        >
          <Text style={[TEXT_STYLES.h3, { marginBottom: SPACING.lg }]}>
            Filter Options
          </Text>
          
          <Text style={[TEXT_STYLES.subtitle1, { marginBottom: SPACING.md }]}>
            Difficulty Level
          </Text>
          {['all', 'beginner', 'intermediate', 'advanced'].map(level => (
            <TouchableOpacity
              key={level}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: SPACING.sm,
              }}
            >
              <Icon
                name={level === 'all' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={COLORS.primary}
              />
              <Text style={[TEXT_STYLES.body1, { marginLeft: SPACING.sm }]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          <Divider style={{ marginVertical: SPACING.lg }} />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button
              mode="text"
              onPress={() => setFilterModalVisible(false)}
              style={{ marginRight: SPACING.sm }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setFilterModalVisible(false);
                Alert.alert('Feature Coming Soon', 'Advanced filtering options will be available in the next update! 🔍');
              }}
            >
              Apply
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

export default TrainingPlanLibrary;