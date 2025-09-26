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
    
    // Enhanced model configurations for sports training
    this.models = {
      textGeneration: 'google/flan-t5-base', // Primary for training plans
      planGeneration: 'google/flan-t5-large', // For complex plan generation
      sessionAnalysis: 'microsoft/DialoGPT-medium', // For real-time coaching
      summarization: 'facebook/bart-large-cnn', // For document summarization
      questionAnswering: 'deepset/roberta-base-squad2', // For training Q&A
      sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest' // For feedback analysis
    };
    
    // Sports-specific knowledge base
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
      // Add more sports as needed
    };
    
    this.offlineCapabilities = {
      planEnhancement: true,
      sessionPersonalization: true,
      smartScheduling: true,
      progressTracking: true,
      basicCoaching: true
    };

    // Initialize immediately
    this.initialize();
  }

  async initialize() {
    try {
      console.log('AIService: Starting comprehensive initialization...');
      
      // Load stored API key and settings
      await this.loadStoredSettings();
      
      if (this.apiKey) {
        this.hfInference = new HfInference(this.apiKey);
        console.log('AIService: Hugging Face client initialized');
        await this.validateConnection();
      } else {
        console.log('AIService: No API key found, running in intelligent fallback mode');
        this.fallbackMode = true;
      }
      
      // Initialize request queue processor
      this.startQueueProcessor();
      
      this.initialized = true;
      console.log('AIService: Comprehensive initialization complete');
      
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
      console.log('AIService: Validating Hugging Face connection...');
      
      const response = await this.hfInference.textGeneration({
        model: this.models.textGeneration,
        inputs: 'Test connection for sports coaching AI',
        parameters: {
          max_length: 20,
          temperature: 0.1
        }
      });
      
      if (response && response.generated_text) {
        this.isOnline = true;
        this.fallbackMode = false;
        console.log('AIService: Hugging Face connection validated successfully');
        
        // Update usage stats
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

  // ============= ENHANCED SESSION PROCESSING =============

  async enhanceExtractedSessions(sessions, userProfile = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('AIService: Enhancing sessions with advanced AI processing');
      
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
    console.log('AIService: Using Hugging Face for session enhancement');
    
    const enhancedSessions = [];
    const batchSize = 3; // Process in batches to avoid rate limits
    
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      const batchPromises = batch.map(async (weekSession, index) => {
        
        try {
          // Create comprehensive prompt for this session
          const prompt = this.createAdvancedTrainingPrompt(weekSession, userProfile);
          
          // Queue the request to manage rate limits
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
      
      // Add delay between batches to respect rate limits
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
Current Drills: ${weekSession.dailySessions?.length || 0} planned activities

PLAYER CONTEXT:
- Age Group: ${ageGroup}
- Experience: ${experience}
- Sport: ${sport}
- Key Skills to Develop: ${sportsData.keySkills.join(', ')}

PROVIDE ENHANCEMENTS FOR:
1. Age-Appropriate Modifications: Adjust complexity and duration for ${ageGroup}
2. Progressive Skill Development: Build on previous weeks' learning
3. Safety Considerations: Injury prevention and safe practice methods  
4. Engagement Techniques: Keep players motivated and focused
5. Assessment Methods: How to measure progress and success
6. Equipment Optimization: Best use of available training equipment
7. Individual Adaptations: Modifications for different skill levels

Format your response with clear sections for each enhancement area. Be specific and actionable.`;
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

    // Apply age-appropriate duration adjustments
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

    // Add safety modifications to notes
    if (aiEnhancements.safetyTips?.length > 0) {
      enhanced.safetyNotes = aiEnhancements.safetyTips.join('. ');
    }

    // Add engagement techniques
    if (aiEnhancements.engagementTechniques?.length > 0) {
      enhanced.engagementTips = aiEnhancements.engagementTechniques;
    }

    // Add assessment methods
    if (aiEnhancements.assessmentMethods?.length > 0) {
      enhanced.assessmentCriteria = aiEnhancements.assessmentMethods;
    }

    return enhanced;
  }

  // ============= INTELLIGENT SCHEDULING =============

 async generateOptimalSchedule(trainingPlan, userPreferences = {}) {
  if (!this.initialized) {
    await this.initialize();
  }

  try {
    if (this.isOnline && !this.fallbackMode) {
      return await this.generateScheduleWithAI(trainingPlan, userPreferences);
    } else {
      // CHANGE THIS:
      return await this.generateScheduleFromPlan(trainingPlan, userPreferences);
    }
  } catch (error) {
    console.error('AI scheduling error:', error);
    // CHANGE THIS TOO:
    return this.generateScheduleFromPlan(trainingPlan, userPreferences);
  }
}

  async generateScheduleWithAI(trainingPlan, userPreferences) {
    const prompt = `Create an optimal training schedule for this plan:

TRAINING PLAN:
Title: ${trainingPlan.title}
Duration: ${trainingPlan.duration}
Sessions: ${trainingPlan.sessionsCount}
Difficulty: ${trainingPlan.difficulty}
Sport: ${trainingPlan.category}

USER PREFERENCES:
Available Days: ${userPreferences.availableDays?.join(', ') || 'Monday, Wednesday, Friday'}
Preferred Time: ${userPreferences.preferredTime || '18:00'}
Session Duration: ${userPreferences.sessionDuration || 60} minutes
Rest Days Required: ${userPreferences.restDays || 1} day(s) between sessions
Intensity Preference: ${userPreferences.intensity || 'moderate'}

REQUIREMENTS:
- Ensure adequate recovery time between intense sessions
- Progress intensity gradually over time
- Consider age-appropriate training loads
- Include variety in training types
- Account for seasonal considerations

Provide a detailed weekly schedule with specific recommendations for:
1. Session distribution across weeks
2. Intensity progression
3. Recovery periods
4. Performance milestones
5. Adaptation checkpoints`;

    try {
      const response = await this.queueRequest({
        model: this.models.planGeneration,
        inputs: prompt,
        parameters: {
          max_length: 400,
          temperature: 0.8,
          repetition_penalty: 1.2
        }
      });

      return this.parseScheduleResponse(response.generated_text, trainingPlan, userPreferences);
    } catch (error) {
      console.error('AI schedule generation failed:', error);
      return this.generateScheduleWithAdvancedLogic(trainingPlan, userPreferences);
    }
  }

  // ============= REAL-TIME COACHING =============

  async getRealtimeCoachingAdvice(sessionContext) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (!this.isOnline || this.fallbackMode) {
        return this.getIntelligentCoachingFallback(sessionContext);
      }

      const prompt = this.createCoachingPrompt(sessionContext);
      
      const response = await this.queueRequest({
        model: this.models.sessionAnalysis,
        inputs: prompt,
        parameters: {
          max_length: 80,
          temperature: 0.6,
          do_sample: true
        }
      });

      return {
        advice: response.generated_text,
        confidence: this.calculateConfidence(response.generated_text),
        priority: this.assessAdvicePriority(response.generated_text, sessionContext),
        timestamp: new Date().toISOString(),
        source: 'huggingface_ai'
      };

    } catch (error) {
      console.error('Real-time coaching error:', error);
      return this.getIntelligentCoachingFallback(sessionContext);
    }
  }

  createCoachingPrompt(context) {
    return `LIVE COACHING SITUATION:
Current Drill: ${context.currentDrill || 'Training session'}
Players: ${context.playerCount || 'Team'} 
Time Elapsed: ${context.timeElapsed || 0} minutes
Observed Issues: ${context.issues?.join(', ') || 'None reported'}
Player Energy: ${context.energyLevel || 'Normal'}
Weather/Conditions: ${context.conditions || 'Standard'}

Provide immediate, actionable coaching advice (max 50 words). Focus on:
- Immediate corrections needed
- Motivation techniques
- Safety considerations
- Next steps for improvement

Coach's advice:`;
  }

  // ============= ADVANCED FALLBACK METHODS =============

  async enhanceWithAdvancedFallback(sessions, userProfile) {
    console.log('AIService: Using advanced intelligent fallback enhancement');
    
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

  personalizeSessionAdvanced(session, userProfile, weekNumber) {
    const { ageGroup = 'youth', experience = 'beginner', sport = 'soccer', preferences = [], injuries = [] } = userProfile;
    const sportsData = this.sportsKnowledge[sport.toLowerCase()] || this.sportsKnowledge.soccer;
    
    let enhancedSession = { ...session };
    const modifications = [];
    const progressionFactor = Math.min(weekNumber / 12, 1); // Progressive difficulty

    // Age-based comprehensive modifications
    const ageConfig = sportsData.ageProgression[ageGroup] || sportsData.ageProgression['10-12'];
    
    enhancedSession.duration = Math.min(session.duration, ageConfig.duration);
    enhancedSession.complexity = ageConfig.complexity;
    modifications.push(`Duration adjusted to ${enhancedSession.duration} minutes for ${ageGroup}`);

    // Experience-based adaptations
    if (experience === 'beginner') {
      enhancedSession.title = session.title.replace(/Advanced|Expert/gi, 'Beginner-Friendly');
      enhancedSession.repetitions = Math.max(1, Math.floor((session.repetitions || 3) * 0.7));
      modifications.push('Reduced repetitions for skill building focus');
      modifications.push('Added extra demonstration time');
    } else if (experience === 'advanced') {
      enhancedSession.repetitions = Math.ceil((session.repetitions || 3) * (1 + progressionFactor * 0.3));
      modifications.push('Increased repetitions for advanced skill refinement');
    }

    // Progressive intensity scaling
    const intensityMultiplier = 0.7 + (progressionFactor * 0.4); // 70% to 110% intensity
    if (session.intensity) {
      enhancedSession.intensity = Math.round(session.intensity * intensityMultiplier);
    }

    // Injury considerations with specific adaptations
    if (injuries.length > 0) {
      enhancedSession.injuryModifications = this.generateInjuryModifications(injuries, sport);
      modifications.push(`Modified exercises for ${injuries.join(', ')} considerations`);
    }

    // Sport-specific skill focus
    const weeklySkillFocus = sportsData.keySkills[weekNumber % sportsData.keySkills.length];
    enhancedSession.primarySkillFocus = weeklySkillFocus;
    modifications.push(`Week focus: ${weeklySkillFocus} development`);

    // Gamification and engagement
    if (preferences.includes('gamification') || ageGroup.includes('4-') || ageGroup.includes('6') || ageGroup.includes('7-9')) {
      enhancedSession.gamificationElements = this.generateGameElements(session, sport, ageGroup);
      modifications.push('Added game-based learning elements');
    }

    // Weather and seasonal adaptations
    enhancedSession.weatherAlternatives = this.generateWeatherAlternatives(session);
    
    // Equipment optimization
    enhancedSession.equipmentOptimization = {
      required: sportsData.equipment.slice(0, 3),
      alternatives: this.generateEquipmentAlternatives(sportsData.equipment),
      setupTips: ['Ensure safe spacing', 'Check equipment condition', 'Have backup options ready']
    };

    // Assessment and progress tracking
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
            'Focus on straight-line movements initially',
            'Include knee strengthening exercises',
            'Use supportive bracing if recommended'
          ];
          break;
        case 'ankle':
          modifications.ankle = [
            'Minimize jumping and landing exercises',
            'Emphasize balance and stability work',
            'Avoid uneven surface training',
            'Include proprioception exercises'
          ];
          break;
        case 'shoulder':
          modifications.shoulder = [
            'Limit overhead movements and throwing',
            'Focus on controlled, pain-free range of motion',
            'Emphasize core and lower body training',
            'Include gentle stretching and mobility work'
          ];
          break;
        default:
          modifications.general = [
            'Monitor pain levels throughout session',
            'Modify intensity based on comfort',
            'Focus on unaffected areas for skill development',
            'Consult with medical team for clearance'
          ];
      }
    });
    
    return modifications;
  }

  generateGameElements(session, sport, ageGroup) {
    const baseGames = {
      soccer: [
        'King of the Ring - ball control challenge',
        'Traffic Light - stop/go ball work',
        'Sharks and Minnows - dribbling game',
        'Red Light Green Light - with ball skills'
      ],
      basketball: [
        'Dribble Tag - ball handling fun',
        'Shooting Stars - point-based shooting',
        'Mirror Match - coordination game',
        'Musical Basketballs - fun with fundamentals'
      ]
    };

    const ageMultiplier = ageGroup.includes('4-') || ageGroup.includes('6') ? 1.5 : 1.0;
    const games = baseGames[sport.toLowerCase()] || baseGames.soccer;
    
    return {
      primaryGame: games[0],
      alternatives: games.slice(1, 3),
      points: Math.round(session.duration * ageMultiplier / 10), // Points system
      rewards: ['High-five from coach', 'Team cheer', 'Skill badge', 'Extra fun time'],
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

    // Age-appropriate adjustments
    if (ageGroup.includes('4-') || ageGroup.includes('6') || ageGroup.includes('7-9')) {
      criteria.fun = ['Enjoyment level', 'Participation', 'Effort shown'];
      criteria.social = ['Cooperation', 'Encouragement of others', 'Following instructions'];
    }

    criteria.physical = ['Movement quality', 'Stamina throughout session', 'Coordination'];
    criteria.mental = ['Focus level', 'Confidence', 'Resilience to mistakes'];

    return criteria;
  }

  // ============= REQUEST MANAGEMENT & RATE LIMITING =============

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
        // Check rate limits
        if (this.rateLimitCounter >= 100 && this.rateLimitReset && Date.now() < this.rateLimitReset) {
          const waitTime = this.rateLimitReset - Date.now();
          console.log(`Rate limit reached, waiting ${waitTime}ms`);
          await this.delay(waitTime);
        }

        const response = await this.hfInference.textGeneration(request.params);
        this.rateLimitCounter++;
        this.usageStats.totalRequests++;
        request.resolve(response);

        // Add delay between requests to be respectful
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
      this.rateLimitReset = Date.now() + (60 * 1000); // Reset in 1 minute
      console.warn('Rate limit hit, implementing backoff');
    } else if (error.message.includes('quota')) {
      this.fallbackMode = true;
      console.warn('API quota exceeded, switching to fallback mode');
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

  assessAdvicePriority(advice, context) {
    if (!advice) return 'low';
    
    const urgentKeywords = ['stop', 'danger', 'injury', 'immediately', 'careful'];
    const importantKeywords = ['improve', 'focus', 'adjust', 'change', 'better'];
    
    if (urgentKeywords.some(keyword => advice.toLowerCase().includes(keyword))) {
      return 'urgent';
    } else if (importantKeywords.some(keyword => advice.toLowerCase().includes(keyword))) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  generateWeatherAlternatives(session) {
    return {
      rain: [
        'Move to indoor facility if available',
        'Focus on ball work in covered areas',
        'Use gymnasium for fitness components',
        'Emphasize tactical discussions'
      ],
      heat: [
        'Increase water breaks to every 15 minutes',
        'Reduce session duration by 20%',
        'Focus on technical skills over fitness',
        'Seek shaded areas for activities'
      ],
      cold: [
        'Extended warm-up period (15+ minutes)',
        'Keep players moving throughout session',
        'Focus on high-intensity activities',
        'Have backup indoor activities ready'
      ],
      wind: [
        'Adjust ball work for wind conditions',
        'Use wind for passing/shooting challenges',
        'Focus on ground-based activities',
        'Position goals to minimize wind impact'
      ]
    };
  }

  generateEquipmentAlternatives(standardEquipment) {
    const alternatives = {};
    
    standardEquipment.forEach(item => {
      switch (item) {
        case 'cones':
          alternatives[item] = ['water bottles', 'shoes', 'shirts', 'small rocks'];
          break;
        case 'balls':
          alternatives[item] = ['tennis balls', 'balloons', 'rolled socks', 'bean bags'];
          break;
        case 'goals':
          alternatives[item] = ['cones as posts', 'trees', 'bags', 'chalk lines'];
          break;
        case 'bibs':
          alternatives[item] = ['colored shirts', 'armbands', 'team assignment', 'colored tape'];
          break;
        case 'ladders':
          alternatives[item] = ['chalk lines', 'rope', 'cones in line', 'natural markers'];
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
        experience === 'beginner' ? 'Extra demonstration time included' : 'Advanced variations provided',
        'Duration optimized for attention span',
        'Rest periods adjusted for age group'
      ],
      skillProgression: [
        `Week ${weekSession.weekNumber} builds on previous skills`,
        'Progressive difficulty scaling implemented',
        'Multiple skill levels accommodated',
        'Clear learning objectives defined'
      ],
      safetyTips: [
        'Proper warm-up and cool-down emphasized',
        'Age-appropriate contact and intensity levels',
        'Equipment safety checks included',
        'Weather considerations addressed'
      ],
      engagementTechniques: [
        ageGroup.includes('4-') || ageGroup.includes('6-') || ageGroup.includes('7-9') ? 
          'Game-based learning prioritized' : 'Skill challenges incorporated',
        'Positive reinforcement strategies',
        'Variety in activities to maintain interest',
        'Individual and team goals balanced'
      ],
      assessmentMethods: [
        'Observable skill improvements tracked',
        'Effort and attitude recognition',
        'Individual progress monitoring',
        'Team cohesion development noted'
      ],
      equipmentTips: [
        'Equipment setup for maximum participation',
        'Safety positioning of all equipment',
        'Backup options for missing items',
        'Age-appropriate equipment sizing'
      ],
      individualAdaptations: [
        'Modifications for different skill levels',
        'Accommodations for physical limitations',
        'Confidence-building approaches',
        'Leadership opportunities for advanced players'
      ]
    };
  }

  getIntelligentCoachingFallback(sessionContext) {
    const advice = this.generateContextualAdvice(sessionContext);
    
    return {
      advice: advice.message,
      confidence: 0.8,
      priority: advice.priority,
      timestamp: new Date().toISOString(),
      source: 'intelligent_fallback',
      actionable: true
    };
  }

  generateContextualAdvice(context) {
    const { currentDrill, playerCount, timeElapsed, issues = [], energyLevel } = context;
    
    // Time-based advice
    if (timeElapsed > 60) {
      return {
        message: "Consider a water break and energy check. Keep activities varied to maintain focus.",
        priority: 'medium'
      };
    }
    
    if (timeElapsed > 45 && energyLevel === 'low') {
      return {
        message: "Switch to a high-energy activity or game to re-engage the players.",
        priority: 'high'
      };
    }
    
    // Issue-based advice
    if (issues.includes('lack of focus')) {
      return {
        message: "Use quick, engaging activities. Break into smaller groups for better attention.",
        priority: 'high'
      };
    }
    
    if (issues.includes('confusion')) {
      return {
        message: "Stop and re-demonstrate. Check understanding before continuing.",
        priority: 'urgent'
      };
    }
    
    if (issues.includes('low participation')) {
      return {
        message: "Encourage participation with positive reinforcement. Consider modifying difficulty.",
        priority: 'high'
      };
    }
    
    // Drill-specific advice
    if (currentDrill && currentDrill.includes('shooting')) {
      return {
        message: "Focus on technique over power. Encourage players to aim for corners.",
        priority: 'medium'
      };
    }
    
    if (currentDrill && currentDrill.includes('passing')) {
      return {
        message: "Emphasize accuracy and proper weight. Use both feet when possible.",
        priority: 'medium'
      };
    }
    
    // Default positive encouragement
    return {
      message: "Great progress! Keep encouraging effort over results. Maintain positive energy.",
      priority: 'low'
    };
  }

  parseScheduleResponse(response, trainingPlan, userPreferences) {
    const schedule = {
      id: `ai_schedule_${Date.now()}`,
      planId: trainingPlan.id,
      type: 'ai_optimized_hf',
      generatedAt: new Date().toISOString(),
      sessions: [],
      recommendations: [],
      weeklyBreakdown: [],
      aiGenerated: true,
      model: 'huggingface'
    };

    try {
      // Parse AI response for structured schedule data
      const lines = response.split('\n').filter(line => line.trim());
      let currentWeek = 1;
      let sessionCounter = 1;

      lines.forEach((line, index) => {
        // Look for week indicators
        if (line.toLowerCase().includes('week') && /\d+/.test(line)) {
          const weekMatch = line.match(/week\s*(\d+)/i);
          if (weekMatch) {
            currentWeek = parseInt(weekMatch[1]);
          }
        }

        // Look for session information
        if (line.toLowerCase().includes('session') || line.toLowerCase().includes('training')) {
          const session = {
            id: `ai_session_${sessionCounter}`,
            planId: trainingPlan.id,
            weekNumber: currentWeek,
            sessionNumber: sessionCounter,
            title: `${trainingPlan.title} - Week ${currentWeek} Session ${sessionCounter}`,
            generatedContent: line.trim(),
            aiScheduled: true
          };

          schedule.sessions.push(session);
          sessionCounter++;
        }

        // Look for recommendations
        if (line.toLowerCase().includes('recommend') || 
            line.toLowerCase().includes('consider') ||
            line.toLowerCase().includes('important')) {
          schedule.recommendations.push({
            type: 'ai_suggestion',
            message: line.trim(),
            priority: this.assessAdvicePriority(line, { context: 'scheduling' })
          });
        }
      });

      // If we didn't get enough structured data, generate based on plan parameters
      if (schedule.sessions.length === 0) {
        schedule.sessions = this.generateScheduleFromPlan(trainingPlan, userPreferences);
      }

    } catch (error) {
      console.error('Failed to parse AI schedule response:', error);
      schedule.sessions = this.generateScheduleFromPlan(trainingPlan, userPreferences);
    }

    return schedule;
  }

  generateScheduleFromPlan(trainingPlan, userPreferences) {
    const sessions = [];
    const totalSessions = trainingPlan.sessionsCount || 12;
    const availableDays = userPreferences.availableDays || ['monday', 'wednesday', 'friday'];
    const weeksNeeded = Math.ceil(totalSessions / availableDays.length);

    for (let week = 1; week <= weeksNeeded; week++) {
      const sessionsThisWeek = Math.min(
        availableDays.length, 
        totalSessions - (week - 1) * availableDays.length
      );

      for (let session = 0; session < sessionsThisWeek; session++) {
        const sessionData = {
          id: `schedule_${week}_${session + 1}`,
          planId: trainingPlan.id,
          weekNumber: week,
          sessionNumber: (week - 1) * availableDays.length + session + 1,
          title: `${trainingPlan.title} - Week ${week}, Session ${session + 1}`,
          day: availableDays[session],
          time: userPreferences.preferredTime || '18:00',
          duration: userPreferences.sessionDuration || 60,
          type: this.determineSessionType(session, sessionsThisWeek),
          intensity: this.calculateIntensity(week, weeksNeeded),
          aiScheduled: true,
          generatedAt: new Date().toISOString()
        };

        sessions.push(sessionData);
      }
    }

    return sessions;
  }

  determineSessionType(sessionIndex, totalSessions) {
    const types = ['technique', 'fitness', 'tactical', 'scrimmage'];
    return types[sessionIndex % types.length];
  }

  calculateIntensity(weekNumber, totalWeeks) {
    // Progressive intensity: start at 60%, peak at 90%, taper to 70%
    const progress = weekNumber / totalWeeks;
    if (progress <= 0.7) {
      return Math.round(60 + (progress * 30)); // 60% to 81%
    } else {
      return Math.round(90 - ((progress - 0.7) * 20)); // 90% to 70%
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startQueueProcessor() {
    // Process queue every 2 seconds
    setInterval(() => {
      if (this.requestQueue.length > 0 && !this.isProcessingQueue) {
        this.processQueue();
      }
    }, 2000);
  }

  // ============= PUBLIC STATUS AND MANAGEMENT METHODS =============

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

  // Sport knowledge management
  addSportKnowledge(sport, knowledge) {
    this.sportsKnowledge[sport.toLowerCase()] = knowledge;
    console.log(`Added knowledge for ${sport}`);
  }

  getSportKnowledge(sport) {
    return this.sportsKnowledge[sport.toLowerCase()] || null;
  }

  // ============= ANALYTICS AND INSIGHTS =============

  async generateSessionAnalytics(sessions) {
    const analytics = {
      totalSessions: sessions.length,
      averageDuration: 0,
      skillDistribution: {},
      difficultyProgression: [],
      aiEnhancementRate: 0,
      recommendations: []
    };

    if (sessions.length === 0) return analytics;

    // Calculate averages
    analytics.averageDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;

    // Track skill distribution
    sessions.forEach(session => {
      if (session.focus) {
        session.focus.forEach(skill => {
          analytics.skillDistribution[skill] = (analytics.skillDistribution[skill] || 0) + 1;
        });
      }
    });

    // Track AI enhancement rate
    const enhancedSessions = sessions.filter(s => s.aiEnhanced);
    analytics.aiEnhancementRate = (enhancedSessions.length / sessions.length) * 100;

    // Generate recommendations
    if (analytics.aiEnhancementRate < 50) {
      analytics.recommendations.push({
        type: 'improvement',
        message: 'Consider enabling AI enhancement for better session personalization',
        priority: 'medium'
      });
    }

    if (analytics.averageDuration > 90) {
      analytics.recommendations.push({
        type: 'duration',
        message: 'Average session duration may be too long for optimal engagement',
        priority: 'high'
      });
    }

    return analytics;
  }
}

export default new AIService();