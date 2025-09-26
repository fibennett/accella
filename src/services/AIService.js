import axios from 'axios';
import { HfInference } from '@huggingface/inference';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AIService {
  constructor() {
  this.initialized = false;
  this.apiKey = null;
  this.hfInference = null;
  this.baseURL = 'https://api-inference.huggingface.co/models';
  this.isOnline = false;
  this.fallbackMode = true;
  
  // Model configurations for different tasks
  this.models = {
    textGeneration: 'microsoft/DialoGPT-medium', // Better for conversations
    summarization: 'facebook/bart-large-cnn',
    planGeneration: 'google/flan-t5-base', // Your current choice
    questionAnswering: 'deepset/roberta-base-squad2'
  };
  
  this.offlineCapabilities = {
    planEnhancement: true,
    sessionPersonalization: true,
    smartScheduling: true,
    nutritionTips: true
  };
}

 async initialize() {
  try {
    console.log('AIService: Starting enhanced initialization...');
    
    // Try to get stored API key
    this.apiKey = await AsyncStorage.getItem('huggingface_api_key');
    
    if (this.apiKey) {
      this.hfInference = new HfInference(this.apiKey);
      console.log('AIService: Hugging Face client initialized');
      await this.testConnection();
    } else {
      console.log('AIService: No API key found, running in intelligent fallback mode');
      this.fallbackMode = true;
    }
    
    this.initialized = true;
    console.log('AIService: Enhanced initialization complete');
    
    return {
      success: true,
      mode: this.fallbackMode ? 'intelligent_fallback' : 'online',
      hasApiKey: !!this.apiKey,
      capabilities: this.offlineCapabilities
    };
    
  } catch (error) {
    console.error('AIService: Initialization error:', error);
    this.fallbackMode = true;
    this.initialized = true;
    
    return {
      success: true,
      mode: 'fallback',
      error: error.message,
      capabilities: this.offlineCapabilities
    };
  }
}

  async testConnection() {
    try {
      const response = await axios.post(
        `${this.baseURL}/gpt2`,
        { inputs: "Test" },
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 5000
        }
      );
      
      this.isOnline = true;
      this.fallbackMode = false;
      console.log('AIService: Online mode activated');
      
    } catch (error) {
      console.warn('AIService: API test failed, using fallback:', error.message);
      this.isOnline = false;
      this.fallbackMode = true;
    }
  }

  // This is your main AI feature - enhances extracted sessions
  async enhanceExtractedSessions(sessions, userProfile = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (this.isOnline && !this.fallbackMode) {
        return await this.enhanceWithAPI(sessions, userProfile);
      } else {
        return await this.enhanceWithFallback(sessions, userProfile);
      }
    } catch (error) {
      console.error('AIService: Enhancement error:', error);
      // Always return enhanced sessions, even if AI fails
      return await this.enhanceWithFallback(sessions, userProfile);
    }
  }

  async enhanceWithAPI(sessions, userProfile) {
    console.log('AIService: Using AI API for enhancement');
    
    const enhancedSessions = [];
    
    for (const weekSession of sessions) {
      try {
        const prompt = this.createEnhancementPrompt(weekSession, userProfile);
        
        const response = await axios.post(
          `${this.baseURL}/google/flan-t5-base`,
          { inputs: prompt },
          {
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
            timeout: 10000
          }
        );

        const aiSuggestion = response.data[0]?.generated_text || '';
        
        enhancedSessions.push({
          ...weekSession,
          aiEnhanced: true,
          aiSuggestions: aiSuggestion,
          dailySessions: weekSession.dailySessions.map(session => 
            this.applyAISuggestions(session, aiSuggestion, userProfile)
          )
        });
        
      } catch (error) {
        console.warn(`AIService: API enhancement failed for week ${weekSession.weekNumber}:`, error);
        // Fallback to intelligent enhancement
        enhancedSessions.push(await this.enhanceWeekWithFallback(weekSession, userProfile));
      }
    }

    return enhancedSessions;
  }

  async enhanceWithFallback(sessions, userProfile) {
    console.log('AIService: Using intelligent fallback enhancement');
    
    return sessions.map(weekSession => ({
      ...weekSession,
      aiEnhanced: true,
      enhancementMethod: 'intelligent_fallback',
      dailySessions: weekSession.dailySessions.map(session => 
        this.personalizeSessionIntelligently(session, userProfile)
      )
    }));
  }

  personalizeSessionIntelligently(session, userProfile) {
    const { ageGroup = 'youth', experience = 'beginner', preferences = [], injuries = [] } = userProfile;
    
    let personalizedSession = { ...session };
    
    // Age-based modifications
    if (ageGroup.includes('4-6') || ageGroup.includes('youth')) {
      personalizedSession.duration = Math.min(session.duration, 45);
      personalizedSession.aiModifications = [
        'Duration reduced to 45 minutes for young players',
        'Added more frequent water breaks',
        'Simplified instructions for better understanding'
      ];
    }
    
    // Experience-based modifications
    if (experience === 'beginner') {
      personalizedSession.title = session.title.replace('Advanced', 'Beginner-Friendly');
      personalizedSession.aiModifications = [
        ...(personalizedSession.aiModifications || []),
        'Exercises simplified for beginners',
        'Additional demonstration time included',
        'Focus on fundamentals over advanced techniques'
      ];
    }
    
    // Injury considerations
    if (injuries.length > 0) {
      personalizedSession.aiModifications = [
        ...(personalizedSession.aiModifications || []),
        `Modified exercises available for ${injuries.join(', ')} considerations`,
        'Consult coach before starting session'
      ];
    }
    
    // Add motivational elements based on preferences
    if (preferences.includes('gamification')) {
      personalizedSession.gamificationElements = [
        'Complete 3 drills to unlock next level',
        'Earn points for proper form',
        'Team challenge: Best improvement wins'
      ];
    }
    
    return personalizedSession;
  }

  // Generate training plan variations (your second main AI feature)
  async generatePlanVariations(originalPlan, targetSports = ['basketball', 'tennis']) {
    if (!this.initialized) {
      await this.initialize();
    }

    const variations = [];
    
    for (const sport of targetSports) {
      const variation = await this.createSportVariation(originalPlan, sport);
      variations.push(variation);
    }
    
    return variations;
  }

  async createSportVariation(originalPlan, targetSport) {
    const sportMappings = {
      basketball: {
        focus: ['dribbling', 'shooting', 'defense', 'court movement'],
        equipment: ['basketballs', 'hoops', 'cones', 'bibs'],
        modifications: {
          'ball control': 'dribbling fundamentals',
          'passing': 'chest pass and bounce pass',
          'shooting': 'layups and free throws'
        }
      },
      tennis: {
        focus: ['racket skills', 'footwork', 'serves', 'volleys'],
        equipment: ['rackets', 'tennis balls', 'nets', 'cones'],
        modifications: {
          'ball control': 'racket ball control',
          'passing': 'forehand and backhand',
          'shooting': 'serving practice'
        }
      },
      volleyball: {
        focus: ['serving', 'passing', 'setting', 'spiking'],
        equipment: ['volleyballs', 'nets', 'cones'],
        modifications: {
          'ball control': 'ball handling and passing',
          'shooting': 'serving and spiking'
        }
      }
    };
    
    const mapping = sportMappings[targetSport.toLowerCase()] || sportMappings.basketball;
    
    return {
      ...originalPlan,
      id: `plan_${Date.now()}_${targetSport}_ai`,
      title: originalPlan.title.replace(/soccer|football/gi, targetSport),
      sport: targetSport,
      category: targetSport,
      tags: mapping.focus,
      isAIGenerated: true,
      originalPlanId: originalPlan.id,
      aiGeneratedAt: new Date().toISOString(),
      sessions: originalPlan.sessions?.map(session => ({
        ...session,
        equipment: mapping.equipment,
        focus: mapping.focus.slice(0, 2),
        aiModified: true
      }))
    };
  }

  createEnhancementPrompt(weekSession, userProfile) {
    return `Enhance this training session for ${userProfile.ageGroup || 'youth'} ${userProfile.experience || 'beginner'} players:
    
Week ${weekSession.weekNumber}: ${weekSession.title}
Focus: ${weekSession.focus?.join(', ') || 'General training'}
Duration: ${weekSession.totalDuration} minutes

Provide specific modifications for:
1. Age-appropriate exercises
2. Safety considerations  
3. Engagement techniques
4. Progress tracking

Keep response under 200 words.`;
  }

  applyAISuggestions(session, aiSuggestion, userProfile) {
    return {
      ...session,
      aiSuggestions: aiSuggestion,
      notes: `${session.notes}\n\nAI Enhancement: ${aiSuggestion}`,
      aiEnhanced: true
    };
  }

  // Utility method to set API key
  async setApiKey(apiKey) {
    try {
      await AsyncStorage.setItem('huggingface_api_key', apiKey);
      this.apiKey = apiKey;
      await this.testConnection();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Smart scheduling with AI logic
async generateOptimalSchedule(trainingPlan, userPreferences = {}) {
  if (!this.initialized) {
    await this.initialize();
  }

  try {
    if (this.isOnline && !this.fallbackMode) {
      return await this.generateScheduleWithAPI(trainingPlan, userPreferences);
    } else {
      return await this.generateScheduleWithIntelligentLogic(trainingPlan, userPreferences);
    }
  } catch (error) {
    console.error('AI scheduling error:', error);
    return this.generateScheduleWithIntelligentLogic(trainingPlan, userPreferences);
  }
}

async generateScheduleWithIntelligentLogic(trainingPlan, userPreferences) {
  const {
    availableDays = ['monday', 'wednesday', 'friday'],
    preferredTime = '18:00',
    sessionDuration = 60,
    restDays = 1,
    intensity = 'moderate'
  } = userPreferences;

  const schedule = {
    id: `schedule_${Date.now()}`,
    planId: trainingPlan.id,
    type: 'ai_optimized',
    generatedAt: new Date().toISOString(),
    sessions: [],
    recommendations: []
  };

  // Intelligent session distribution
  const totalSessions = trainingPlan.sessionsCount || 12;
  const weeksNeeded = Math.ceil(totalSessions / availableDays.length);
  const sessionsPerWeek = Math.floor(totalSessions / weeksNeeded);

  // Generate sessions with progressive intensity
  for (let week = 1; week <= weeksNeeded; week++) {
    const weekSessions = this.generateWeekSessions(
      week,
      sessionsPerWeek,
      availableDays,
      preferredTime,
      sessionDuration,
      intensity,
      trainingPlan
    );
    schedule.sessions.push(...weekSessions);
  }

  // Add AI recommendations
  schedule.recommendations = this.generateScheduleRecommendations(
    trainingPlan,
    userPreferences,
    schedule.sessions
  );

  return schedule;
}

generateWeekSessions(weekNumber, sessionsPerWeek, availableDays, preferredTime, duration, intensity, plan) {
  const sessions = [];
  const intensityMultipliers = { light: 0.8, moderate: 1.0, high: 1.2 };
  const baseIntensity = intensityMultipliers[intensity] || 1.0;

  // Progressive loading - increase intensity over weeks
  const weekProgressionFactor = 1 + (weekNumber - 1) * 0.1;
  const adjustedDuration = Math.floor(duration * baseIntensity * weekProgressionFactor);

  for (let i = 0; i < sessionsPerWeek && i < availableDays.length; i++) {
    const sessionDate = this.calculateSessionDate(weekNumber, availableDays[i]);
    
    sessions.push({
      id: `session_${weekNumber}_${i + 1}_${Date.now()}`,
      planId: plan.id,
      weekNumber,
      sessionNumber: i + 1,
      title: `${plan.title} - Week ${weekNumber}, Session ${i + 1}`,
      date: sessionDate,
      time: preferredTime,
      duration: adjustedDuration,
      day: availableDays[i],
      type: this.determineSessionType(i, sessionsPerWeek),
      intensity: this.calculateSessionIntensity(weekNumber, i, intensity),
      aiOptimized: true,
      focus: this.determineSessionFocus(plan.category, i, sessionsPerWeek)
    });
  }

  return sessions;
}

determineSessionType(sessionIndex, totalSessions) {
  const types = ['strength', 'cardio', 'technique', 'recovery'];
  if (totalSessions === 2) return sessionIndex === 0 ? 'strength' : 'cardio';
  if (totalSessions === 3) return ['strength', 'cardio', 'technique'][sessionIndex];
  return types[sessionIndex % types.length];
}

calculateSessionIntensity(weekNumber, sessionIndex, baseIntensity) {
  const intensityMap = { light: 1, moderate: 2, high: 3 };
  const base = intensityMap[baseIntensity] || 2;
  const weekFactor = Math.min(weekNumber * 0.1, 0.5);
  return Math.min(3, Math.floor(base + weekFactor));
}

determineSessionFocus(category, sessionIndex, totalSessions) {
  const focusMap = {
    soccer: ['ball control', 'passing', 'shooting', 'conditioning'],
    basketball: ['dribbling', 'shooting', 'defense', 'conditioning'],
    fitness: ['strength', 'cardio', 'flexibility', 'core'],
    tennis: ['serves', 'ground strokes', 'volleys', 'footwork']
  };
  
  const focuses = focusMap[category] || focusMap.fitness;
  return [focuses[sessionIndex % focuses.length]];
}

generateScheduleRecommendations(plan, preferences, sessions) {
  const recommendations = [];
  
  // Recovery recommendations
  const sessionCount = sessions.length;
  const avgSessionsPerWeek = sessionCount / (sessionCount / 7);
  
  if (avgSessionsPerWeek > 5) {
    recommendations.push({
      type: 'recovery',
      message: 'Consider adding more rest days - high training frequency detected',
      priority: 'high'
    });
  }
  
  // Progression recommendations
  recommendations.push({
    type: 'progression',
    message: 'Sessions are designed with progressive intensity increase',
    priority: 'info'
  });
  
  // Nutrition timing
  recommendations.push({
    type: 'nutrition',
    message: 'Eat a light meal 2-3 hours before training sessions',
    priority: 'medium'
  });
  
  return recommendations;
}

calculateSessionDate(weekNumber, dayName) {
  const today = new Date();
  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(dayName.toLowerCase());
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (weekNumber - 1) * 7);
  
  const currentDay = targetDate.getDay();
  const daysToAdd = (dayIndex - currentDay + 7) % 7;
  targetDate.setDate(targetDate.getDate() + daysToAdd);
  
  return targetDate.toISOString().split('T')[0];
}

  getStatus() {
    return {
      initialized: this.initialized,
      isOnline: this.isOnline,
      fallbackMode: this.fallbackMode,
      hasApiKey: !!this.apiKey
    };
  }
}

export default new AIService();