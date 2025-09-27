import axios from 'axios';
import { HfInference } from '@huggingface/inference';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AIService {
  constructor() {
    this.initialized = false;
    this.apiKey = null;
    this.hfInference = null;
    this.isOnline = false;
    this.fallbackMode = true;
    this.rateLimitCounter = 0;
    this.rateLimitReset = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    this.models = {
      textGeneration: 'google/flan-t5-base',
      planGeneration: 'google/flan-t5-large',
      sessionAnalysis: 'microsoft/DialoGPT-medium',
      summarization: 'facebook/bart-large-cnn',
      questionAnswering: 'deepset/roberta-base-squad2',
      sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest'
    };
    
    this.sportsKnowledge = {
      soccer: {
        keySkills: ['ball control', 'passing', 'shooting', 'defending', 'dribbling'],
        ageProgression: {
          '4-6': { focus: 'fun', duration: 30, complexity: 'very_simple' },
          '7-9': { focus: 'basic_skills', duration: 45, complexity: 'simple' },
          '10-12': { focus: 'technique', duration: 60, complexity: 'moderate' },
          '13-15': { focus: 'tactics', duration: 75, complexity: 'advanced' },
          '16+': { focus: 'performance', duration: 90, complexity: 'professional' }
        },
        equipment: ['balls', 'cones', 'goals', 'bibs', 'ladders'],
        safetyConsiderations: ['proper warm-up', 'hydration', 'age-appropriate contact']
      },
      basketball: {
        keySkills: ['dribbling', 'shooting', 'passing', 'defense', 'rebounding'],
        ageProgression: {
          '6-8': { focus: 'coordination', duration: 30, complexity: 'basic' },
          '9-11': { focus: 'fundamentals', duration: 45, complexity: 'simple' },
          '12-14': { focus: 'skills', duration: 60, complexity: 'moderate' },
          '15-17': { focus: 'strategy', duration: 75, complexity: 'advanced' },
          '18+': { focus: 'competition', duration: 90, complexity: 'elite' }
        },
        equipment: ['basketballs', 'cones', 'hoops', 'ladders'],
        safetyConsiderations: ['ankle support', 'proper footwork', 'collision awareness']
      }
    };
    
    this.offlineCapabilities = {
      planEnhancement: true,
      sessionPersonalization: true,
      smartScheduling: true,
      progressTracking: true,
      basicCoaching: true
    };

    this.initialize();
  }

  async initialize() {
    try {
      console.log('AIService: Starting initialization...');
      
      await this.loadStoredSettings();
      
      if (this.apiKey) {
        this.hfInference = new HfInference(this.apiKey);
        console.log('AIService: Hugging Face client initialized');
        await this.validateConnection();
      } else {
        console.log('AIService: No API key found, running in fallback mode');
        this.fallbackMode = true;
      }
      
      this.startQueueProcessor();
      this.initialized = true;
      console.log('AIService: Initialization complete');
      
      return {
        success: true,
        mode: this.fallbackMode ? 'intelligent_fallback' : 'online',
        hasApiKey: !!this.apiKey,
        capabilities: this.offlineCapabilities,
        models: Object.keys(this.models)
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

  async loadStoredSettings() {
    try {
      const settings = await AsyncStorage.multiGet([
        'huggingface_api_key',
        'ai_preferences',
        'ai_usage_stats'
      ]);
      
      this.apiKey = settings[0][1];
      this.preferences = settings[1][1] ? JSON.parse(settings[1][1]) : {};
      this.usageStats = settings[2][1] ? JSON.parse(settings[2][1]) : {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0
      };
    } catch (error) {
      console.warn('Failed to load AI settings:', error);
    }
  }

  async saveSettings() {
    try {
      await AsyncStorage.multiSet([
        ['ai_preferences', JSON.stringify(this.preferences)],
        ['ai_usage_stats', JSON.stringify(this.usageStats)]
      ]);
    } catch (error) {
      console.warn('Failed to save AI settings:', error);
    }
  }

  async validateConnection() {
    try {
      console.log('AIService: Validating connection...');
      
      const response = await this.hfInference.textGeneration({
        model: this.models.textGeneration,
        inputs: 'Test connection',
        parameters: {
          max_length: 20,
          temperature: 0.1
        }
      });
      
      if (response && response.generated_text) {
        this.isOnline = true;
        this.fallbackMode = false;
        console.log('AIService: Connection validated');
        
        this.usageStats.successfulRequests++;
        await this.saveSettings();
        
        return true;
      }
      
    } catch (error) {
      console.warn('AIService: Connection validation failed:', error.message);
      this.handleAPIError(error);
      return false;
    }
  }

  async setApiKey(apiKey) {
    try {
      await AsyncStorage.setItem('huggingface_api_key', apiKey);
      this.apiKey = apiKey;
      this.hfInference = new HfInference(apiKey);
      
      const isValid = await this.validateConnection();
      
      return { 
        success: isValid, 
        message: isValid ? 'API key validated successfully' : 'API key validation failed'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Add this method to your AIService class (in AIService.js)

// ============= OPTIMAL SCHEDULE GENERATION =============

async generateOptimalSchedule(trainingPlan, preferences = {}) {
  if (!this.initialized) {
    await this.initialize();
  }

  try {
    console.log('AIService: Generating optimal schedule...');
    
    if (this.isOnline && !this.fallbackMode) {
      return await this.generateScheduleWithAI(trainingPlan, preferences);
    } else {
      return await this.generateScheduleWithFallback(trainingPlan, preferences);
    }
  } catch (error) {
    console.error('AIService: Schedule generation failed:', error);
    return await this.generateScheduleWithFallback(trainingPlan, preferences);
  }
}

async generateScheduleWithAI(trainingPlan, preferences) {
  try {
    const prompt = this.createSchedulePrompt(trainingPlan, preferences);
    
    const response = await this.queueRequest({
      model: this.models.planGeneration,
      inputs: prompt,
      parameters: {
        max_length: 300,
        temperature: 0.6,
        do_sample: true,
        top_p: 0.8
      }
    });

    const schedule = this.parseScheduleResponse(response.generated_text, trainingPlan, preferences);
    
    return {
      ...schedule,
      aiGenerated: true,
      aiProvider: 'huggingface',
      confidence: this.calculateConfidence(response.generated_text)
    };

  } catch (error) {
    console.warn('AI schedule generation failed, using fallback:', error);
    return await this.generateScheduleWithFallback(trainingPlan, preferences);
  }
}

async generateScheduleWithFallback(trainingPlan, preferences = {}) {
  console.log('AIService: Using fallback schedule generation');
  
  const defaultPreferences = {
    availableDays: ['monday', 'wednesday', 'friday'],
    preferredTime: '16:00',
    sessionDuration: 90,
    intensity: 'moderate',
    weeksCount: 12,
    sessionsPerWeek: 3
  };

  const prefs = { ...defaultPreferences, ...preferences };
  const schedule = this.createOptimalSessionSchedule(trainingPlan, prefs);
  
  return {
    planId: trainingPlan.id,
    planTitle: trainingPlan.title,
    sessions: schedule,
    totalSessions: schedule.length,
    totalWeeks: prefs.weeksCount,
    generatedAt: new Date().toISOString(),
    preferences: prefs,
    aiGenerated: true,
    aiProvider: 'intelligent_fallback',
    confidence: 0.85,
    scheduleType: 'optimized_progression'
  };
}

createSchedulePrompt(trainingPlan, preferences) {
  const sport = trainingPlan.category || 'general fitness';
  const duration = preferences.sessionDuration || 90;
  const days = preferences.availableDays || ['monday', 'wednesday', 'friday'];
  
  return `Create an optimal training schedule for a ${sport} program:

PROGRAM DETAILS:
- Title: ${trainingPlan.title}
- Duration: ${trainingPlan.duration || '12 weeks'}
- Difficulty: ${trainingPlan.difficulty || 'intermediate'}
- Sessions per week: ${days.length}

PREFERENCES:
- Available days: ${days.join(', ')}
- Session duration: ${duration} minutes
- Intensity: ${preferences.intensity || 'moderate'}

Provide a structured weekly schedule with:
1. Progressive intensity
2. Proper recovery periods
3. Skill development phases
4. Performance peaks

Focus on sustainable long-term development.`;
}

parseScheduleResponse(response, trainingPlan, preferences) {
  // Parse AI response and create schedule structure
  const lines = response.split('\n').filter(line => line.trim());
  const sessions = [];
  
  // If AI response parsing fails, fall back to structured generation
  if (lines.length < 5) {
    return this.createOptimalSessionSchedule(trainingPlan, preferences);
  }
  
  // Try to extract schedule information from AI response
  let currentWeek = 1;
  let sessionId = 1;
  
  lines.forEach(line => {
    const weekMatch = line.match(/week\s*(\d+)/i);
    if (weekMatch) {
      currentWeek = parseInt(weekMatch[1]);
    }
    
    // Look for day and time information
    const dayMatch = line.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
    
    if (dayMatch && currentWeek <= 12) {
      sessions.push({
        id: `optimal_${sessionId++}_${Date.now()}`,
        week: currentWeek,
        day: dayMatch[1].toLowerCase(),
        date: this.calculateOptimalDate(currentWeek, dayMatch[1]),
        time: timeMatch ? timeMatch[0] : preferences.preferredTime || '16:00',
        duration: preferences.sessionDuration || 90,
        type: this.getSessionType(currentWeek, sessions.length % 3),
        intensity: this.calculateProgressiveIntensity(currentWeek, preferences.intensity),
        focus: this.getWeeklyFocus(currentWeek, trainingPlan.category),
        aiSuggested: true
      });
    }
  });
  
  // If no sessions extracted from AI, use fallback generation
  if (sessions.length === 0) {
    return this.createOptimalSessionSchedule(trainingPlan, preferences);
  }
  
  return sessions;
}

createOptimalSessionSchedule(trainingPlan, preferences) {
  const sessions = [];
  const { availableDays, preferredTime, sessionDuration, weeksCount = 12 } = preferences;
  
  for (let week = 1; week <= weeksCount; week++) {
    availableDays.forEach((day, dayIndex) => {
      const sessionDate = this.calculateOptimalDate(week, day);
      
      sessions.push({
        id: `optimal_${week}_${dayIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        week: week,
        day: day.toLowerCase(),
        date: sessionDate,
        time: preferredTime,
        duration: sessionDuration,
        type: this.getSessionType(week, dayIndex),
        intensity: this.calculateProgressiveIntensity(week, preferences.intensity),
        focus: this.getWeeklyFocus(week, trainingPlan.category),
        phase: this.getTrainingPhase(week, weeksCount),
        objectives: this.getWeeklyObjectives(week, trainingPlan.category),
        equipment: this.getSessionEquipment(trainingPlan.category),
        aiOptimized: true
      });
    });
  }
  
  return sessions;
}

calculateOptimalDate(weekNumber, dayName) {
  const today = new Date();
  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(dayName.toLowerCase());
  
  // Start from next Monday if today is weekend, otherwise start from today
  const startDate = new Date(today);
  const currentDay = startDate.getDay();
  
  if (currentDay === 0 || currentDay === 6) { // Sunday or Saturday
    const daysUntilMonday = currentDay === 0 ? 1 : 2;
    startDate.setDate(startDate.getDate() + daysUntilMonday);
  }
  
  // Calculate target date for this week and day
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
  
  // Adjust to correct day of week
  const targetDay = targetDate.getDay();
  const daysToAdd = (dayIndex - targetDay + 7) % 7;
  targetDate.setDate(targetDate.getDate() + daysToAdd);
  
  return targetDate.toISOString().split('T')[0];
}

getSessionType(week, dayIndex) {
  const types = ['technique', 'conditioning', 'tactical', 'strength', 'recovery'];
  
  // Progressive session type selection based on week
  if (week <= 4) {
    return ['technique', 'conditioning', 'technique'][dayIndex % 3];
  } else if (week <= 8) {
    return ['tactical', 'strength', 'technique'][dayIndex % 3];
  } else {
    return ['tactical', 'conditioning', 'strength'][dayIndex % 3];
  }
}

calculateProgressiveIntensity(week, baseIntensity) {
  const intensityMap = { 
    low: 0.5, 
    moderate: 0.7, 
    high: 0.85,
    very_high: 0.95 
  };
  
  const baseLevel = intensityMap[baseIntensity] || 0.7;
  
  // Progressive intensity with periodization
  let weeklyMultiplier;
  if (week <= 3) {
    weeklyMultiplier = 0.7 + (week * 0.1); // Build-up phase
  } else if (week <= 8) {
    weeklyMultiplier = 0.9 + (week * 0.02); // Development phase
  } else if (week <= 10) {
    weeklyMultiplier = 1.0; // Peak phase
  } else {
    weeklyMultiplier = 0.8; // Recovery phase
  }
  
  const finalIntensity = Math.min(baseLevel * weeklyMultiplier, 1.0);
  return Math.round(finalIntensity * 100);
}

getWeeklyFocus(week, sport) {
  const sportFocus = {
    soccer: {
      1: ['ball control', 'basic passing'],
      2: ['dribbling', 'first touch'],
      3: ['shooting', 'finishing'],
      4: ['defending', 'tackling'],
      5: ['tactical awareness', 'positioning'],
      6: ['crossing', 'heading'],
      7: ['set pieces', 'free kicks'],
      8: ['match simulation', 'decision making'],
      9: ['advanced tactics', 'team play'],
      10: ['peak performance', 'competition prep'],
      11: ['match readiness', 'strategy'],
      12: ['performance review', 'next level prep']
    },
    basketball: {
      1: ['dribbling basics', 'ball handling'],
      2: ['shooting form', 'free throws'],
      3: ['passing', 'court vision'],
      4: ['defense', 'positioning'],
      5: ['rebounding', 'boxing out'],
      6: ['offensive plays', 'screens'],
      7: ['fast break', 'transition'],
      8: ['half court offense', 'spacing'],
      9: ['defensive systems', 'help defense'],
      10: ['game situations', 'clutch performance'],
      11: ['team chemistry', 'execution'],
      12: ['championship prep', 'mental toughness']
    },
    fitness: {
      1: ['foundation building', 'form'],
      2: ['strength development', 'endurance'],
      3: ['cardiovascular fitness', 'stamina'],
      4: ['flexibility', 'mobility'],
      5: ['power development', 'explosiveness'],
      6: ['functional movement', 'stability'],
      7: ['high intensity training', 'intervals'],
      8: ['compound movements', 'strength'],
      9: ['sport specific', 'performance'],
      10: ['peak conditioning', 'testing'],
      11: ['competition prep', 'tapering'],
      12: ['maintenance', 'recovery']
    }
  };
  
  const focuses = sportFocus[sport] || sportFocus.fitness;
  return focuses[week] || ['general training', 'skill development'];
}

getTrainingPhase(week, totalWeeks) {
  const phaseLength = Math.floor(totalWeeks / 4);
  
  if (week <= phaseLength) return 'foundation';
  if (week <= phaseLength * 2) return 'development';
  if (week <= phaseLength * 3) return 'intensification';
  return 'peaking';
}

getWeeklyObjectives(week, sport) {
  const baseObjectives = {
    1: ['Establish baseline fitness', 'Learn fundamental movements'],
    2: ['Improve basic skills', 'Build endurance base'],
    3: ['Develop coordination', 'Increase strength'],
    4: ['Master basic techniques', 'Assess progress'],
    5: ['Introduce advanced skills', 'Build power'],
    6: ['Combine skills in drills', 'Improve speed'],
    7: ['Practice under pressure', 'Peak strength phase'],
    8: ['Tactical understanding', 'Maintain fitness'],
    9: ['Advanced tactical play', 'Fine-tune skills'],
    10: ['Peak performance', 'Competition simulation'],
    11: ['Mental preparation', 'Strategy execution'],
    12: ['Performance evaluation', 'Set future goals']
  };
  
  return baseObjectives[week] || ['Skill development', 'Fitness maintenance'];
}

getSessionEquipment(sport) {
  const equipment = {
    soccer: ['soccer balls', 'cones', 'goals', 'bibs'],
    basketball: ['basketballs', 'hoops', 'cones', 'agility ladder'],
    fitness: ['dumbbells', 'resistance bands', 'mats', 'cones'],
    tennis: ['tennis balls', 'rackets', 'cones', 'net'],
    general: ['basic equipment', 'cones', 'markers', 'balls']
  };
  
  return equipment[sport] || equipment.general;
}

// 2. Add this method to AIService.js to support single session improvement

async improveSingleSession(sessionData, userProfile = {}) {
  if (!this.initialized) {
    await this.initialize();
  }

  try {
    console.log('AIService: Improving single session with AI');
    
    if (this.isOnline && !this.fallbackMode) {
      return await this.improveSingleSessionWithHuggingFace(sessionData, userProfile);
    } else {
      return await this.improveSingleSessionWithFallback(sessionData, userProfile);
    }
  } catch (error) {
    console.error('AIService: Single session improvement error:', error);
    return await this.improveSingleSessionWithFallback(sessionData, userProfile);
  }
}

// Add these missing helper methods to your AIService class

generateSportSpecificDrills(sport, ageGroup, duration) {
  const baseDrills = {
    soccer: [
      'Ball control and first touch practice',
      'Passing accuracy in pairs',
      'Dribbling through cones',
      'Shooting technique from various angles',
      'Defensive positioning and tackling'
    ],
    basketball: [
      'Dribbling with both hands',
      'Chest and bounce passing',
      'Free throw shooting technique',
      'Layup from both sides',
      'Defensive stance and movement'
    ],
    general: [
      'Agility ladder exercises',
      'Coordination drills with equipment',
      'Team-building activities',
      'Fitness stations rotation',
      'Stretching and mobility work'
    ]
  };

  const drills = baseDrills[sport] || baseDrills.general;
  const drillDuration = Math.round(duration * 0.1); // Each drill ~10% of session

  return drills.map((drill, index) => ({
    id: `drill_${index}`,
    name: drill,
    duration: drillDuration,
    description: `${drill} - adapted for ${ageGroup} level`,
    equipment: this.getBasicEquipment(sport),
    instructions: `Focus on proper technique and safety`
  }));
}

getBasicEquipment(sport) {
  const equipment = {
    soccer: ['soccer balls', 'cones', 'goals'],
    basketball: ['basketballs', 'hoops', 'cones'],
    general: ['cones', 'markers', 'basic equipment']
  };
  return equipment[sport] || equipment.general;
}

// Also add this method if it's missing:
async improveSingleSessionWithHuggingFace(sessionData, userProfile) {
  try {
    const prompt = `As an expert sports coach, enhance this training session:

SESSION DETAILS:
Title: ${sessionData.title}
Duration: ${sessionData.duration} minutes
Sport: ${sessionData.sport || 'General'}
Age Group: ${sessionData.ageGroup || 'Youth'}
Participants: ${sessionData.participants || 15}

CURRENT CONTENT:
${sessionData.rawContent || sessionData.documentContent || 'Basic training session'}

FOCUS AREAS: ${sessionData.focus?.join(', ') || 'General fitness'}

Please provide:
1. Enhanced session structure
2. Specific drill improvements
3. Safety considerations
4. Progression tips
5. Equipment alternatives

Make it actionable and age-appropriate.`;

    const response = await this.queueRequest({
      model: this.models.textGeneration,
      inputs: prompt,
      parameters: {
        max_length: 400,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9
      }
    });

    const enhancements = this.parseSessionImprovements(response.generated_text);
    
    return {
      originalSession: sessionData,
      enhancedSession: {
        ...sessionData,
        title: sessionData.title + ' (AI Enhanced)',
        description: enhancements.description || sessionData.description,
        structure: enhancements.structure || [],
        drills: enhancements.drills || sessionData.drills || [],
        safety: enhancements.safety || [],
        progression: enhancements.progression || [],
        equipment: enhancements.equipment || sessionData.equipment || [],
        coachingTips: enhancements.coachingTips || [],
        aiEnhanced: true,
        enhancedAt: new Date().toISOString()
      },
      improvements: enhancements.improvements || [],
      confidence: this.calculateConfidence(response.generated_text)
    };

  } catch (error) {
    throw error;
  }
}

parseSessionImprovements(response) {
  const improvements = {
    description: '',
    structure: [],
    drills: [],
    safety: [],
    progression: [],
    equipment: [],
    coachingTips: [],
    improvements: []
  };

  const lines = response.split('\n').filter(line => line.trim());
  let currentSection = null;

  lines.forEach(line => {
    const cleanLine = line.trim();
    
    if (cleanLine.toLowerCase().includes('structure')) {
      currentSection = 'structure';
    } else if (cleanLine.toLowerCase().includes('drill') || cleanLine.toLowerCase().includes('exercise')) {
      currentSection = 'drills';
    } else if (cleanLine.toLowerCase().includes('safety')) {
      currentSection = 'safety';
    } else if (cleanLine.toLowerCase().includes('progression') || cleanLine.toLowerCase().includes('advance')) {
      currentSection = 'progression';
    } else if (cleanLine.toLowerCase().includes('equipment')) {
      currentSection = 'equipment';
    } else if (cleanLine.toLowerCase().includes('tip') || cleanLine.toLowerCase().includes('coach')) {
      currentSection = 'coachingTips';
    } else if (currentSection && cleanLine.length > 10) {
      improvements[currentSection].push(cleanLine);
    }
  });

  return improvements;
}

async improveSingleSessionWithFallback(sessionData, userProfile) {
  console.log('AIService: Using fallback session improvement');
  
  const sport = sessionData.sport?.toLowerCase() || 'general';
  const ageGroup = sessionData.ageGroup || 'Youth';
  const duration = sessionData.duration || 90;
  
  const improvements = {
    structure: [
      `Warm-up (${Math.round(duration * 0.15)} min): Dynamic stretching and activation`,
      `Technical Skills (${Math.round(duration * 0.35)} min): ${sport}-specific skill development`,
      `Tactical Work (${Math.round(duration * 0.25)} min): Game situations and decision making`,
      `Conditioning (${Math.round(duration * 0.15)} min): Fitness and endurance work`,
      `Cool-down (${Math.round(duration * 0.10)} min): Recovery and flexibility`
    ],
    drills: this.generateSportSpecificDrills(sport, ageGroup, duration),
    safety: [
      'Ensure proper warm-up before intense activities',
      'Monitor hydration throughout the session',
      'Check all equipment before use',
      'Maintain appropriate work-to-rest ratios',
      'Watch for signs of fatigue and adjust intensity'
    ],
    progression: [
      'Start with basic movements, progress to complex skills',
      'Gradually increase intensity throughout the session',
      'Provide modifications for different skill levels',
      'Focus on quality over quantity of repetitions'
    ],
    coachingTips: [
      'Use positive reinforcement to maintain motivation',
      'Demonstrate proper technique before each drill',
      'Encourage peer learning and team support',
      'Focus on effort and improvement, not just outcomes',
      'Provide specific, actionable feedback'
    ]
  };

  return {
    originalSession: sessionData,
    enhancedSession: {
      ...sessionData,
      title: sessionData.title + ' (AI Enhanced)',
      structure: improvements.structure,
      drills: improvements.drills,
      safety: improvements.safety,
      progression: improvements.progression,
      coachingTips: improvements.coachingTips,
      aiEnhanced: true,
      enhancementMethod: 'intelligent_fallback',
      enhancedAt: new Date().toISOString()
    },
    improvements: [
      'Added structured session timeline',
      'Included sport-specific drill recommendations',
      'Enhanced safety considerations',
      'Provided progression guidelines',
      'Added coaching tips for better engagement'
    ],
    confidence: 0.85
  };
}

  // ============= SESSION ENHANCEMENT =============

  async enhanceExtractedSessions(sessions, userProfile = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('AIService: Enhancing sessions');
      
      if (this.isOnline && !this.fallbackMode) {
        return await this.enhanceWithHuggingFace(sessions, userProfile);
      } else {
        return await this.enhanceWithAdvancedFallback(sessions, userProfile);
      }
    } catch (error) {
      console.error('AIService: Session enhancement error:', error);
      this.usageStats.failedRequests++;
      return await this.enhanceWithAdvancedFallback(sessions, userProfile);
    }
  }

  async enhanceWithHuggingFace(sessions, userProfile) {
    console.log('AIService: Using Hugging Face for enhancement');
    
    const enhancedSessions = [];
    const batchSize = 3;
    
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      const batchPromises = batch.map(async (weekSession) => {
        
        try {
          const prompt = this.createAdvancedTrainingPrompt(weekSession, userProfile);
          
          const aiResponse = await this.queueRequest({
            model: this.models.textGeneration,
            inputs: prompt,
            parameters: {
              max_length: 300,
              temperature: 0.7,
              do_sample: true,
              top_p: 0.9,
              repetition_penalty: 1.1
            }
          });

          const aiEnhancements = this.parseTrainingResponse(aiResponse.generated_text);
          
          return {
            ...weekSession,
            aiEnhanced: true,
            aiProvider: 'huggingface',
            aiModel: this.models.textGeneration,
            aiConfidence: this.calculateConfidence(aiResponse.generated_text),
            aiEnhancements: aiEnhancements,
            dailySessions: weekSession.dailySessions.map(session => 
              this.applyAIEnhancements(session, aiEnhancements, userProfile)
            ),
            processedAt: new Date().toISOString()
          };
          
        } catch (error) {
          console.warn(`HF enhancement failed for week ${weekSession.weekNumber}:`, error);
          return await this.enhanceWeekWithAdvancedFallback(weekSession, userProfile);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      enhancedSessions.push(...batchResults);
      
      if (i + batchSize < sessions.length) {
        await this.delay(1000);
      }
    }

    this.usageStats.successfulRequests += sessions.length;
    await this.saveSettings();
    
    return enhancedSessions;
  }

  createAdvancedTrainingPrompt(weekSession, userProfile) {
    const sport = userProfile.sport || 'general sports';
    const ageGroup = userProfile.ageGroup || 'youth';
    const experience = userProfile.experience || 'beginner';
    const sportsData = this.sportsKnowledge[sport.toLowerCase()] || this.sportsKnowledge.soccer;
    
    return `As an expert ${sport} coach, enhance this training session for ${ageGroup} ${experience} players:

CURRENT SESSION:
Week ${weekSession.weekNumber}: ${weekSession.title}
Duration: ${weekSession.totalDuration} minutes
Focus Areas: ${weekSession.focus?.join(', ') || 'General training'}

PLAYER CONTEXT:
- Age Group: ${ageGroup}
- Experience: ${experience}
- Sport: ${sport}
- Key Skills: ${sportsData.keySkills.join(', ')}

PROVIDE ENHANCEMENTS FOR:
1. Age-Appropriate Modifications
2. Progressive Skill Development
3. Safety Considerations
4. Engagement Techniques
5. Assessment Methods

Be specific and actionable.`;
  }

  parseTrainingResponse(response) {
    try {
      const enhancements = {
        ageModifications: [],
        skillProgression: [],
        safetyTips: [],
        engagementTechniques: [],
        assessmentMethods: [],
        equipmentTips: [],
        individualAdaptations: []
      };

      const sections = response.split('\n').filter(line => line.trim());
      let currentSection = null;

      sections.forEach(line => {
        const cleanLine = line.trim();
        
        if (cleanLine.toLowerCase().includes('age') || cleanLine.toLowerCase().includes('modification')) {
          currentSection = 'ageModifications';
        } else if (cleanLine.toLowerCase().includes('skill') || cleanLine.toLowerCase().includes('progress')) {
          currentSection = 'skillProgression';
        } else if (cleanLine.toLowerCase().includes('safety') || cleanLine.toLowerCase().includes('injury')) {
          currentSection = 'safetyTips';
        } else if (cleanLine.toLowerCase().includes('engagement') || cleanLine.toLowerCase().includes('motivat')) {
          currentSection = 'engagementTechniques';
        } else if (cleanLine.toLowerCase().includes('assess') || cleanLine.toLowerCase().includes('measure')) {
          currentSection = 'assessmentMethods';
        } else if (cleanLine.toLowerCase().includes('equipment')) {
          currentSection = 'equipmentTips';
        } else if (cleanLine.toLowerCase().includes('individual') || cleanLine.toLowerCase().includes('adapt')) {
          currentSection = 'individualAdaptations';
        } else if (currentSection && cleanLine.length > 10) {
          enhancements[currentSection].push(cleanLine);
        }
      });

      return enhancements;
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      return { general: [response.substring(0, 200)] };
    }
  }

  applyAIEnhancements(session, aiEnhancements, userProfile) {
    const enhanced = {
      ...session,
      aiEnhanced: true,
      aiSuggestions: aiEnhancements,
      originalDuration: session.duration,
      enhancedAt: new Date().toISOString()
    };

    if (aiEnhancements.ageModifications?.length > 0) {
      const ageGroup = userProfile.ageGroup || 'youth';
      const sport = userProfile.sport || 'soccer';
      const sportsData = this.sportsKnowledge[sport.toLowerCase()];
      
      if (sportsData?.ageProgression[ageGroup]) {
        enhanced.duration = Math.min(
          session.duration,
          sportsData.ageProgression[ageGroup].duration
        );
      }
    }

    if (aiEnhancements.safetyTips?.length > 0) {
      enhanced.safetyNotes = aiEnhancements.safetyTips.join('. ');
    }

    if (aiEnhancements.engagementTechniques?.length > 0) {
      enhanced.engagementTips = aiEnhancements.engagementTechniques;
    }

    if (aiEnhancements.assessmentMethods?.length > 0) {
      enhanced.assessmentCriteria = aiEnhancements.assessmentMethods;
    }

    return enhanced;
  }

  // ============= ADVANCED FALLBACK =============

  async enhanceWithAdvancedFallback(sessions, userProfile) {
    console.log('AIService: Using intelligent fallback enhancement');
    
    return sessions.map(weekSession => ({
      ...weekSession,
      aiEnhanced: true,
      enhancementMethod: 'advanced_fallback',
      aiProvider: 'internal_intelligence',
      aiConfidence: 0.85,
      dailySessions: weekSession.dailySessions.map(session => 
        this.personalizeSessionAdvanced(session, userProfile, weekSession.weekNumber)
      ),
      aiEnhancements: this.generateFallbackEnhancements(weekSession, userProfile)
    }));
  }

  async enhanceWeekWithAdvancedFallback(weekSession, userProfile) {
    return {
      ...weekSession,
      aiEnhanced: true,
      enhancementMethod: 'advanced_fallback',
      aiProvider: 'internal_intelligence',
      aiConfidence: 0.85,
      dailySessions: weekSession.dailySessions.map(session => 
        this.personalizeSessionAdvanced(session, userProfile, weekSession.weekNumber)
      ),
      aiEnhancements: this.generateFallbackEnhancements(weekSession, userProfile)
    };
  }

  personalizeSessionAdvanced(session, userProfile, weekNumber) {
    const { ageGroup = 'youth', experience = 'beginner', sport = 'soccer', preferences = [], injuries = [] } = userProfile;
    const sportsData = this.sportsKnowledge[sport.toLowerCase()] || this.sportsKnowledge.soccer;
    
    let enhancedSession = { ...session };
    const modifications = [];
    const progressionFactor = Math.min(weekNumber / 12, 1);

    const ageConfig = sportsData.ageProgression[ageGroup] || sportsData.ageProgression['10-12'];
    
    enhancedSession.duration = Math.min(session.duration, ageConfig.duration);
    enhancedSession.complexity = ageConfig.complexity;
    modifications.push(`Duration adjusted to ${enhancedSession.duration} minutes for ${ageGroup}`);

    if (experience === 'beginner') {
      enhancedSession.title = session.title.replace(/Advanced|Expert/gi, 'Beginner-Friendly');
      enhancedSession.repetitions = Math.max(1, Math.floor((session.repetitions || 3) * 0.7));
      modifications.push('Reduced repetitions for skill building focus');
    } else if (experience === 'advanced') {
      enhancedSession.repetitions = Math.ceil((session.repetitions || 3) * (1 + progressionFactor * 0.3));
      modifications.push('Increased repetitions for advanced skill refinement');
    }

    const intensityMultiplier = 0.7 + (progressionFactor * 0.4);
    if (session.intensity) {
      enhancedSession.intensity = Math.round(session.intensity * intensityMultiplier);
    }

    if (injuries.length > 0) {
      enhancedSession.injuryModifications = this.generateInjuryModifications(injuries, sport);
      modifications.push(`Modified for ${injuries.join(', ')} considerations`);
    }

    const weeklySkillFocus = sportsData.keySkills[weekNumber % sportsData.keySkills.length];
    enhancedSession.primarySkillFocus = weeklySkillFocus;
    modifications.push(`Week focus: ${weeklySkillFocus} development`);

    if (preferences.includes('gamification') || ageGroup.includes('4-') || ageGroup.includes('6') || ageGroup.includes('7-9')) {
      enhancedSession.gamificationElements = this.generateGameElements(session, sport, ageGroup);
      modifications.push('Added game-based learning');
    }

    enhancedSession.weatherAlternatives = this.generateWeatherAlternatives(session);
    
    enhancedSession.equipmentOptimization = {
      required: sportsData.equipment.slice(0, 3),
      alternatives: this.generateEquipmentAlternatives(sportsData.equipment),
      setupTips: ['Ensure safe spacing', 'Check equipment condition', 'Have backup options']
    };

    enhancedSession.assessmentCriteria = this.generateAssessmentCriteria(weeklySkillFocus, ageGroup);
    enhancedSession.aiModifications = modifications;
    enhancedSession.enhancedAt = new Date().toISOString();
    
    return enhancedSession;
  }

  generateInjuryModifications(injuries, sport) {
    const modifications = {};
    
    injuries.forEach(injury => {
      switch (injury.toLowerCase()) {
        case 'knee':
          modifications.knee = [
            'Avoid deep lunges and sharp direction changes',
            'Focus on straight-line movements',
            'Include knee strengthening exercises'
          ];
          break;
        case 'ankle':
          modifications.ankle = [
            'Minimize jumping and landing exercises',
            'Emphasize balance and stability work',
            'Include proprioception exercises'
          ];
          break;
        case 'shoulder':
          modifications.shoulder = [
            'Limit overhead movements',
            'Focus on pain-free range of motion',
            'Include gentle stretching'
          ];
          break;
        default:
          modifications.general = [
            'Monitor pain levels throughout',
            'Modify intensity based on comfort',
            'Consult medical team for clearance'
          ];
      }
    });
    
    return modifications;
  }

  generateGameElements(session, sport, ageGroup) {
    const baseGames = {
      soccer: [
        'King of the Ring - ball control',
        'Traffic Light - stop/go work',
        'Sharks and Minnows - dribbling',
        'Red Light Green Light - skills'
      ],
      basketball: [
        'Dribble Tag - handling fun',
        'Shooting Stars - point-based',
        'Mirror Match - coordination',
        'Musical Basketballs - fundamentals'
      ]
    };

    const ageMultiplier = ageGroup.includes('4-') || ageGroup.includes('6') ? 1.5 : 1.0;
    const games = baseGames[sport.toLowerCase()] || baseGames.soccer;
    
    return {
      primaryGame: games[0],
      alternatives: games.slice(1, 3),
      points: Math.round(session.duration * ageMultiplier / 10),
      rewards: ['High-five', 'Team cheer', 'Skill badge'],
      progressLevels: ['Bronze', 'Silver', 'Gold', 'Champion']
    };
  }

  generateAssessmentCriteria(skillFocus, ageGroup) {
    const criteria = {
      technical: [],
      tactical: [],
      physical: [],
      mental: []
    };

    switch (skillFocus) {
      case 'ball control':
        criteria.technical = ['Touch consistency', 'Balance during control', 'Speed of control'];
        criteria.tactical = ['Body positioning', 'First touch direction', 'Awareness of space'];
        break;
      case 'passing':
        criteria.technical = ['Accuracy', 'Appropriate weight', 'Technique consistency'];
        criteria.tactical = ['Target selection', 'Timing', 'Communication'];
        break;
      case 'shooting':
        criteria.technical = ['Contact with ball', 'Follow-through', 'Body position'];
        criteria.tactical = ['Shot selection', 'Placement vs power', 'Quick release'];
        break;
      default:
        criteria.technical = ['Skill execution', 'Consistency', 'Form improvement'];
        criteria.tactical = ['Decision making', 'Awareness', 'Application'];
    }

    if (ageGroup.includes('4-') || ageGroup.includes('6') || ageGroup.includes('7-9')) {
      criteria.fun = ['Enjoyment level', 'Participation', 'Effort shown'];
      criteria.social = ['Cooperation', 'Encouragement', 'Following instructions'];
    }

    criteria.physical = ['Movement quality', 'Stamina', 'Coordination'];
    criteria.mental = ['Focus level', 'Confidence', 'Resilience'];

    return criteria;
  }

  generateWeatherAlternatives(session) {
    return {
      rain: ['Move to indoor facility', 'Focus on covered areas', 'Tactical discussions'],
      heat: ['Increase water breaks', 'Reduce duration by 20%', 'Seek shaded areas'],
      cold: ['Extended warm-up', 'Keep players moving', 'Have indoor backup'],
      wind: ['Adjust ball work', 'Use wind for challenges', 'Focus on ground-based']
    };
  }

  generateEquipmentAlternatives(standardEquipment) {
    const alternatives = {};
    
    standardEquipment.forEach(item => {
      switch (item) {
        case 'cones':
          alternatives[item] = ['water bottles', 'shoes', 'shirts'];
          break;
        case 'balls':
          alternatives[item] = ['tennis balls', 'balloons', 'rolled socks'];
          break;
        case 'goals':
          alternatives[item] = ['cones as posts', 'trees', 'chalk lines'];
          break;
        case 'bibs':
          alternatives[item] = ['colored shirts', 'armbands', 'colored tape'];
          break;
        case 'ladders':
          alternatives[item] = ['chalk lines', 'rope', 'cones in line'];
          break;
        default:
          alternatives[item] = ['improvise with available materials'];
      }
    });
    
    return alternatives;
  }

  generateFallbackEnhancements(weekSession, userProfile) {
    const sport = userProfile.sport || 'soccer';
    const ageGroup = userProfile.ageGroup || 'youth';
    const experience = userProfile.experience || 'beginner';
    
    return {
      ageModifications: [
        `Session adapted for ${ageGroup} players`,
        experience === 'beginner' ? 'Extra demonstration time' : 'Advanced variations',
        'Duration optimized for attention span'
      ],
      skillProgression: [
        `Week ${weekSession.weekNumber} builds on previous skills`,
        'Progressive difficulty scaling',
        'Clear learning objectives'
      ],
      safetyTips: [
        'Proper warm-up and cool-down',
        'Age-appropriate intensity',
        'Equipment safety checks'
      ],
      engagementTechniques: [
        ageGroup.includes('4-') || ageGroup.includes('6-') || ageGroup.includes('7-9') ? 
          'Game-based learning' : 'Skill challenges',
        'Positive reinforcement',
        'Activity variety'
      ],
      assessmentMethods: [
        'Track skill improvements',
        'Recognize effort and attitude',
        'Monitor individual progress'
      ],
      equipmentTips: [
        'Setup for maximum participation',
        'Safety positioning',
        'Backup options available'
      ],
      individualAdaptations: [
        'Modifications for skill levels',
        'Physical limitation accommodations',
        'Confidence-building approaches'
      ]
    };
  }

  // ============= REQUEST MANAGEMENT =============

  async queueRequest(requestParams) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        params: requestParams,
        resolve,
        reject,
        timestamp: Date.now()
      });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        if (this.rateLimitCounter >= 100 && this.rateLimitReset && Date.now() < this.rateLimitReset) {
          const waitTime = this.rateLimitReset - Date.now();
          console.log(`Rate limit reached, waiting ${waitTime}ms`);
          await this.delay(waitTime);
        }

        const response = await this.hfInference.textGeneration(request.params);
        this.rateLimitCounter++;
        this.usageStats.totalRequests++;
        request.resolve(response);

        await this.delay(500);

      } catch (error) {
        this.handleAPIError(error);
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  handleAPIError(error) {
    if (error.message.includes('rate limit')) {
      this.rateLimitReset = Date.now() + (60 * 1000);
      console.warn('Rate limit hit, implementing backoff');
    } else if (error.message.includes('quota')) {
      this.fallbackMode = true;
      console.warn('API quota exceeded, switching to fallback');
    } else {
      console.warn('API error:', error.message);
    }
    
    this.usageStats.failedRequests++;
  }

  // ============= UTILITY METHODS =============

  calculateConfidence(response) {
    if (!response || response.length < 20) return 0.3;
    
    const lengthScore = Math.min(response.length / 200, 0.4);
    const coherenceScore = response.split('.').length > 1 ? 0.3 : 0.1;
    const specificityScore = /\d+/.test(response) ? 0.2 : 0.1;
    const contextScore = response.toLowerCase().includes('training') || 
                        response.toLowerCase().includes('coach') ? 0.2 : 0.0;
    
    return Math.min(lengthScore + coherenceScore + specificityScore + contextScore, 1.0);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startQueueProcessor() {
    setInterval(() => {
      if (this.requestQueue.length > 0 && !this.isProcessingQueue) {
        this.processQueue();
      }
    }, 2000);
  }

  // ============= PUBLIC METHODS =============

  getStatus() {
    return {
      initialized: this.initialized,
      isOnline: this.isOnline,
      fallbackMode: this.fallbackMode,
      hasApiKey: !!this.apiKey,
      queueLength: this.requestQueue.length,
      usageStats: this.usageStats,
      rateLimitStatus: {
        current: this.rateLimitCounter,
        resetTime: this.rateLimitReset
      },
      capabilities: this.offlineCapabilities,
      supportedSports: Object.keys(this.sportsKnowledge)
    };
  }

  async resetUsageStats() {
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
    await this.saveSettings();
  }

  async clearApiKey() {
    try {
      await AsyncStorage.removeItem('huggingface_api_key');
      this.apiKey = null;
      this.hfInference = null;
      this.isOnline = false;
      this.fallbackMode = true;
      return { success: true, message: 'API key cleared' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  addSportKnowledge(sport, knowledge) {
    this.sportsKnowledge[sport.toLowerCase()] = knowledge;
    console.log(`Added knowledge for ${sport}`);
  }

  getSportKnowledge(sport) {
    return this.sportsKnowledge[sport.toLowerCase()] || null;
  }
}

export default new AIService();