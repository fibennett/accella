//src/services/SessionExtractor.js
import PlatformUtils from '../utils/PlatformUtils';
import AIService from './AIService';

class SessionExtractor {
  constructor() {
    this.sessionPatterns = {
      // Week patterns
      weekPattern: /^(week\s*\d+|session\s*\d+|day\s*\d+)/i,
      
      // Training day patterns  
      trainingDayPattern: /(sunday|monday|tuesday|wednesday|thursday|friday|saturday).*?(\d+\s*hours?)/i,
      
      // Duration patterns
      durationPattern: /(\d+)\s*(minutes?|hours?|mins?|hrs?)/i,
      
      // Academy/Title patterns
      academyPattern: /^([A-Z][A-Z\s]+ACADEMY|[A-Z][A-Z\s]+CLUB)/i,
      
      // Age group patterns
      agePattern: /(\d+[-–]\d+\s*years?|under\s*\d+|u\d+|\d+\s*years?)/i,
      
      // Sport patterns
      sportPattern: /(soccer|football|basketball|tennis|volleyball|swimming)/i
    };
  }

// Main extraction method
async extractSessionsFromDocument(document, trainingPlan) {
  try {
    PlatformUtils.logDebugInfo('Starting AI-enhanced session extraction', {
      documentId: document.id,
      planId: trainingPlan.id
    });

    // Your existing extraction logic...
    const DocumentProcessor = (await import('./DocumentProcessor')).default;
    const extractionResult = await DocumentProcessor.extractDocumentText(document);
    const text = extractionResult.text;

    const documentStructure = this.parseDocumentStructure(text);
    const academyInfo = this.extractAcademyInfo(text, trainingPlan);
    const sessions = this.extractWeeklySessions(text, documentStructure, academyInfo);
    
    // NEW: AI Enhancement with smarter scheduling
    let enhancedSessions = sessions;
    try {
      enhancedSessions = await AIService.enhanceExtractedSessions(sessions, {
        ageGroup: academyInfo.ageGroup,
        sport: academyInfo.sport,
        experience: trainingPlan.difficulty || 'beginner'
      });
      console.log('Sessions enhanced with AI successfully');
    } catch (error) {
      console.warn('AI enhancement failed, using basic sessions:', error);
    }

    // NEW: Generate optimal schedule for sessions
    let optimizedSchedule = null;
    try {
      const schedulePreferences = {
        availableDays: ['monday', 'wednesday', 'friday'],
        preferredTime: '16:00',
        sessionDuration: 90,
        intensity: trainingPlan.difficulty || 'moderate'
      };
      
      optimizedSchedule = await AIService.generateOptimalSchedule(trainingPlan, schedulePreferences);
      console.log('Optimal schedule generated with AI');
    } catch (error) {
      console.warn('Schedule generation failed:', error);
    }

    const result = {
      academyInfo,
      sessions: enhancedSessions,
      optimizedSchedule, // NEW: AI-generated schedule
      totalWeeks: enhancedSessions.length,
      totalSessions: enhancedSessions.reduce((sum, week) => sum + week.dailySessions.length, 0),
      extractedAt: new Date().toISOString(),
      sourceDocument: document.id,
      sourcePlan: trainingPlan.id,
      aiEnhanced: enhancedSessions !== sessions, // Only true if AI enhancement worked
      aiScheduled: !!optimizedSchedule // Only true if schedule was generated
    };

    PlatformUtils.logDebugInfo('AI-enhanced session extraction completed', {
      totalWeeks: result.totalWeeks,
      totalSessions: result.totalSessions,
      aiEnhanced: result.aiEnhanced,
      aiScheduled: result.aiScheduled
    });

    return result;
  } catch (error) {
    console.error('Session extraction failed:', error);
    throw PlatformUtils.handlePlatformError(error, 'AI-Enhanced Session Extraction');
  }
}

parseDocumentStructure(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const structure = {
    title: '',
    weeks: [],
    currentWeek: null,
    currentDay: null,
    sections: []
  };

  // Enhanced week pattern to catch more variations
  const enhancedWeekPattern = /^(week\s*\d+|session\s*\d+|day\s*\d+|training\s*week\s*\d+|week\s*\d+\s*[-–—:]\s*)/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    
    // Check for week/session headers with improved detection
    if (enhancedWeekPattern.test(line) || this.isWeekHeader(line, nextLine)) {
      if (structure.currentWeek) {
        structure.weeks.push(structure.currentWeek);
      }
      
      structure.currentWeek = {
        title: line,
        lineNumber: i,
        days: [],
        content: [line]
      };
      structure.currentDay = null; // Reset current day
      continue;
    }

    // Enhanced training day detection
    const dayMatch = line.match(this.sessionPatterns.trainingDayPattern) || 
                    this.detectTrainingDay(line);
    
    if (dayMatch && structure.currentWeek) {
      structure.currentDay = {
        day: dayMatch[1] || this.extractDayName(line),
        duration: dayMatch[2] || this.extractDuration(line) || '',
        lineNumber: i,
        activities: [],
        content: [line]
      };
      structure.currentWeek.days.push(structure.currentDay);
      continue;
    }

    // Add content to current context
    if (structure.currentDay) {
      structure.currentDay.content.push(line);
    } else if (structure.currentWeek) {
      structure.currentWeek.content.push(line);
    }
  }

  // Don't forget the last week
  if (structure.currentWeek) {
    structure.weeks.push(structure.currentWeek);
  }

  PlatformUtils.logDebugInfo('Document structure parsed', {
    totalWeeks: structure.weeks.length,
    linesProcessed: lines.length
  });

  return structure;
}

// Add these helper methods to the SessionExtractor class:

isWeekHeader(line, nextLine) {
  // Check if line looks like a week header even without exact pattern match
  const weekIndicators = [
    /week\s*\d+/i,
    /training.*week/i,
    /session.*\d+/i,
    /^w\d+/i // Handles "W1", "W2" etc.
  ];
  
  const hasWeekIndicator = weekIndicators.some(pattern => pattern.test(line));
  const isShortLine = line.length < 50;
  const nextLineHasContent = nextLine && nextLine.length > 20;
  
  return hasWeekIndicator && isShortLine && nextLineHasContent;
}

detectTrainingDay(line) {
  const dayPatterns = [
    /(daily\s*session)/i,
    /(training\s*session)/i,
    /(\d+\s*hour.*session)/i,
    /(warm.*up|technical|conditioning)/i
  ];
  
  for (const pattern of dayPatterns) {
    const match = line.match(pattern);
    if (match) {
      return [match[0], match[1] || 'training'];
    }
  }
  
  return null;
}

extractDayName(line) {
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const foundDay = dayNames.find(day => line.toLowerCase().includes(day));
  
  if (foundDay) {
    return foundDay;
  }
  
  // Default naming based on content
  if (line.toLowerCase().includes('warm') || line.toLowerCase().includes('coordination')) {
    return 'training_day';
  }
  
  return 'session';
}

extractDuration(line) {
  const durationMatch = line.match(/(\d+)\s*(minutes?|hours?|mins?|hrs?)/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    return unit.includes('hour') ? `${value} hours` : `${value} minutes`;
  }
  return null;
}

  extractAcademyInfo(text, trainingPlan) {
    const lines = text.split('\n').slice(0, 20); // Check first 20 lines
    
    let academyName = '';
    let sport = '';
    let ageGroup = '';
    let program = '';

    // Extract academy name
    for (const line of lines) {
      const academyMatch = line.match(this.sessionPatterns.academyPattern);
      if (academyMatch) {
        academyName = academyMatch[1].trim();
        break;
      }
    }

    // Extract sport
    const sportMatch = text.match(this.sessionPatterns.sportPattern);
    if (sportMatch) {
      sport = sportMatch[1].toLowerCase();
    }

    // Extract age group
    const ageMatch = text.match(this.sessionPatterns.agePattern);
    if (ageMatch) {
      ageGroup = ageMatch[1];
    }

    // Extract program name
    const programLines = lines.filter(line => 
      line.includes('COACHING') || 
      line.includes('PLAN') || 
      line.includes('PROGRAM')
    );
    if (programLines.length > 0) {
      program = programLines[0].trim();
    }

    return {
      academyName: academyName || trainingPlan.academyName || trainingPlan.title || 'Training Academy',
      sport: sport || trainingPlan.category || 'soccer',
      ageGroup: ageGroup || 'Youth',
      program: program || trainingPlan.title || 'Training Program',
      location: 'Training Facility', // Default value
      difficulty: trainingPlan.difficulty || 'intermediate'
    };
  }

extractWeeklySessions(text, structure, academyInfo) {
  const sessions = [];

  // Log the structure for debugging
  PlatformUtils.logDebugInfo('Extracting sessions from structure', {
    weeksFound: structure.weeks.length,
    textLength: text.length,
    academyName: academyInfo.academyName
  });

  structure.weeks.forEach((week, weekIndex) => {
    const weekSession = {
      id: `week_${weekIndex + 1}_${Date.now()}`,
      weekNumber: weekIndex + 1,
      title: this.cleanWeekTitle(week.title) || `Week ${weekIndex + 1} Training`,
      description: this.extractWeekDescription(week.content),
      dailySessions: [],
      totalDuration: 0,
      focus: this.extractWeekFocus(week.content),
      notes: week.content.filter(line => this.isNote(line)),
      academyName: academyInfo.academyName,
      sport: academyInfo.sport,
      weekSchedule: this.extractWeekScheduleInfo(week.content)
    };

    // Log each week being processed
    PlatformUtils.logDebugInfo(`Processing week ${weekIndex + 1}`, {
      weekTitle: week.title,
      contentLines: week.content.length,
      daysFound: week.days.length
    });

    // Extract daily sessions from the week
    week.days.forEach((day, dayIndex) => {
      const dailySession = this.createDailySession(day, weekIndex, dayIndex, academyInfo, week);
      weekSession.dailySessions.push(dailySession);
      weekSession.totalDuration += dailySession.duration;
    });

    // If no daily sessions found, create a general week session
    if (weekSession.dailySessions.length === 0) {
      const generalSession = this.createGeneralWeekSession(week, weekIndex, academyInfo);
      weekSession.dailySessions.push(generalSession);
      weekSession.totalDuration += generalSession.duration;
    }

    sessions.push(weekSession);
  });

  // Final validation and logging
  PlatformUtils.logDebugInfo('Session extraction completed', {
    totalWeeks: sessions.length,
    totalDailySessions: sessions.reduce((sum, week) => sum + week.dailySessions.length, 0),
    extractionSource: 'document_structure'
  });

  // If we have significantly fewer sessions than expected, try alternative extraction
  if (sessions.length < 8 && text.includes('Week') && text.includes('12')) {
    console.warn('Detected potential missing weeks, attempting alternative extraction');
    const alternativeSessions = this.attemptAlternativeWeekExtraction(text, academyInfo);
    if (alternativeSessions.length > sessions.length) {
      PlatformUtils.logDebugInfo('Using alternative extraction results', {
        originalCount: sessions.length,
        alternativeCount: alternativeSessions.length
      });
      return alternativeSessions;
    }
  }

  return sessions;
}

// Add this alternative extraction method:

attemptAlternativeWeekExtraction(text, academyInfo) {
  const sessions = [];
  const weekPattern = /Week\s+(\d+)/gi;
  const matches = [];
  let match;
  
  while ((match = weekPattern.exec(text)) !== null) {
    matches.push({
      weekNumber: parseInt(match[1]),
      index: match.index,
      fullMatch: match[0]
    });
  }
  
  // Create sessions for each found week
  matches.forEach((weekMatch, index) => {
    const nextWeekIndex = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const weekText = text.substring(weekMatch.index, nextWeekIndex);
    
    const weekSession = {
      id: `week_${weekMatch.weekNumber}_alt_${Date.now()}`,
      weekNumber: weekMatch.weekNumber,
      title: `Week ${weekMatch.weekNumber} Training`,
      description: this.extractWeekDescription([weekText]),
      dailySessions: [],
      totalDuration: 120, // Default duration
      focus: this.extractWeekFocus([weekText]),
      notes: [],
      academyName: academyInfo.academyName,
      sport: academyInfo.sport,
      weekSchedule: { days: [], pattern: 'Weekly training' }
    };

    // Create a general session for this week
    const generalSession = {
      id: `session_${weekMatch.weekNumber}_alt_${Date.now()}`,
      weekNumber: weekMatch.weekNumber,
      dayNumber: 1,
      title: `${academyInfo.academyName} - Week ${weekMatch.weekNumber} Training Plan`,
      day: 'week_plan',
      date: this.calculateSessionDate(weekMatch.weekNumber, 'monday'),
      time: '08:00',
      duration: 120,
      location: academyInfo.location || 'Training Field',
      type: 'Weekly Plan',
      participants: this.estimateParticipants(academyInfo.ageGroup),
      status: 'scheduled',
      academyName: academyInfo.academyName,
      sport: academyInfo.sport,
      ageGroup: academyInfo.ageGroup,
      difficulty: academyInfo.difficulty,
      activities: this.extractActivities([weekText]),
      drills: this.extractDrills([weekText]),
      objectives: this.extractObjectives([weekText]),
      equipment: this.extractEquipment([weekText]),
      notes: weekText,
      rawContent: weekText,
      documentContent: weekText.substring(0, 1000),
      completionRate: 0,
      focus: this.extractWeekFocus([weekText]),
      week: `Week ${weekMatch.weekNumber}`,
      weekDescription: weekText.substring(0, 200)
    };

    weekSession.dailySessions.push(generalSession);
    sessions.push(weekSession);
  });

  return sessions;
}

cleanWeekTitle(title) {
  if (!title) return null;
  return title
    .replace(/^week\s*\d+/i, '')
    .replace(/[-–—:]/g, '')
    .trim();
}

createDailySession(day, weekIndex, dayIndex, academyInfo, week) {
  const sessionDate = this.calculateSessionDate(weekIndex + 1, day.day);
  
  return {
    id: `session_${weekIndex + 1}_${dayIndex + 1}_${Date.now()}`,
    weekNumber: weekIndex + 1,
    dayNumber: dayIndex + 1,
    title: `${academyInfo.academyName} - Week ${weekIndex + 1}, ${this.capitalizeFirst(day.day)} Training`,
    day: day.day.toLowerCase(),
    date: sessionDate,
    time: this.extractTime(day.content.join(' ')) || '08:00',
    duration: this.parseDuration(day.duration) || 90,
    location: academyInfo.location || 'Training Field',
    type: 'Team Training',
    participants: this.estimateParticipants(academyInfo.ageGroup),
    status: 'scheduled',
    academyName: academyInfo.academyName,
    sport: academyInfo.sport,
    ageGroup: academyInfo.ageGroup,
    difficulty: academyInfo.difficulty,
    activities: this.extractActivities(day.content),
    drills: this.extractDrills(day.content),
    objectives: this.extractObjectives(day.content),
    equipment: this.extractEquipment(day.content),
    notes: day.content.join('\n'),
    rawContent: day.content.join('\n'),
    documentContent: this.extractSessionContent(day.content),
    completionRate: 0,
    focus: this.extractSessionFocus(day.content),
    week: week.title || `Week ${weekIndex + 1}`,
    weekDescription: week.content.slice(0, 3).join(' ')
  };
}

createGeneralWeekSession(week, weekIndex, academyInfo) {
  const sessionDate = this.calculateSessionDate(weekIndex + 1, 'monday');
  
  return {
    id: `session_${weekIndex + 1}_general_${Date.now()}`,
    weekNumber: weekIndex + 1,
    dayNumber: 1,
    title: `${academyInfo.academyName} - Week ${weekIndex + 1} Training Plan`,
    day: 'week_plan',
    date: sessionDate,
    time: '08:00',
    duration: 120,
    location: academyInfo.location || 'Training Field',
    type: 'Weekly Plan',
    participants: this.estimateParticipants(academyInfo.ageGroup),
    status: 'scheduled',
    academyName: academyInfo.academyName,
    sport: academyInfo.sport,
    ageGroup: academyInfo.ageGroup,
    difficulty: academyInfo.difficulty,
    activities: this.extractActivities(week.content),
    drills: this.extractDrills(week.content),
    objectives: this.extractObjectives(week.content),
    equipment: this.extractEquipment(week.content),
    notes: week.content.join('\n'),
    rawContent: week.content.join('\n'),
    documentContent: week.content.join('\n'),
    completionRate: 0,
    focus: this.extractWeekFocus(week.content),
    week: week.title || `Week ${weekIndex + 1}`,
    weekDescription: this.extractWeekDescription(week.content)
  };
}

extractSessionContent(content) {
  // Extract the most relevant content for this specific session
  return content
    .filter(line => line.trim().length > 10)
    .filter(line => !this.isHeaderLine(line))
    .join('\n')
    .substring(0, 1000); // Limit to reasonable length
}

extractWeekScheduleInfo(content) {
  const scheduleInfo = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  content.forEach(line => {
    days.forEach(day => {
      if (line.toLowerCase().includes(day)) {
        const timeMatch = line.match(/(\d{1,2}):(\d{2})|(\d{1,2})\s*(am|pm)/i);
        const durationMatch = line.match(/(\d+)\s*(min|hour)/i);
        
        scheduleInfo.push({
          day: this.capitalizeFirst(day),
          time: timeMatch ? timeMatch[0] : '08:00',
          duration: durationMatch ? durationMatch[0] : '90min',
          focus: line.trim()
        });
      }
    });
  });
  
  return scheduleInfo;
}

capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

isHeaderLine(line) {
  return /^(week\s*\d+|session\s*\d+|day\s*\d+)/i.test(line.trim());
}

  extractSchedulingInfo(text) {
    const days = [];
    const daysPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
    const matches = text.match(daysPattern);
    
    if (matches) {
      const uniqueDays = [...new Set(matches.map(day => day.toLowerCase()))];
      days.push(...uniqueDays);
    }

    // Extract frequency
    let frequency = 'weekly';
    if (text.includes('twice') || text.includes('2 times')) {
      frequency = 'bi-weekly';
    } else if (text.includes('daily') || text.includes('every day')) {
      frequency = 'daily';
    }

    return {
      frequency,
      days,
      pattern: `${days.length} days per week`,
      preferredTime: this.extractTime(text) || '08:00'
    };
  }

  // Helper methods
  extractTime(text) {
    const timePattern = /(\d{1,2}):(\d{2})|(\d{1,2})\s*(am|pm)/i;
    const match = text.match(timePattern);
    
    if (match) {
      if (match[1] && match[2]) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
      } else if (match[3] && match[4]) {
        let hour = parseInt(match[3]);
        if (match[4].toLowerCase() === 'pm' && hour !== 12) {
          hour += 12;
        } else if (match[4].toLowerCase() === 'am' && hour === 12) {
          hour = 0;
        }
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }
    
    return null;
  }

  parseDuration(durationText) {
    if (!durationText) return 90; // Default duration
    
    const match = durationText.match(this.sessionPatterns.durationPattern);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit.includes('hour') || unit.includes('hr')) {
        return value * 60;
      } else {
        return value;
      }
    }
    
    return 90;
  }

  extractActivities(content) {
    const activities = [];
    
    content.forEach(line => {
      if (this.isActivity(line)) {
        activities.push(line.trim());
      }
    });
    
    return activities.slice(0, 5); // Limit to top 5 activities
  }

  extractDrills(content) {
    const drills = [];
    
    content.forEach(line => {
      if (this.isDrill(line)) {
        const drill = {
          name: this.extractDrillName(line),
          description: line.trim(),
          duration: this.extractDrillDuration(line)
        };
        drills.push(drill);
      }
    });
    
    return drills;
  }

  extractObjectives(content) {
    const objectives = [];
    
    content.forEach(line => {
      if (this.isObjective(line)) {
        objectives.push(line.trim());
      }
    });
    
    return objectives.slice(0, 3);
  }

  extractEquipment(content) {
    const equipment = [];
    const equipmentKeywords = ['cones', 'balls', 'goals', 'bibs', 'ladders', 'hurdles', 'markers'];
    
    const text = content.join(' ').toLowerCase();
    equipmentKeywords.forEach(item => {
      if (text.includes(item)) {
        equipment.push(item);
      }
    });
    
    return equipment;
  }

  extractWeekDescription(content) {
    const meaningfulLines = content.filter(line => 
      line.length > 20 && 
      !this.sessionPatterns.weekPattern.test(line) &&
      !this.isActivity(line)
    );
    
    return meaningfulLines.slice(0, 2).join(' ').substring(0, 200) + '...';
  }

  extractWeekFocus(content) {
    const focus = [];
    const focusKeywords = ['shooting', 'passing', 'dribbling', 'defending', 'tactics', 'fitness'];
    
    const text = content.join(' ').toLowerCase();
    focusKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        focus.push(keyword);
      }
    });
    
    return focus.slice(0, 3);
  }

  extractSessionFocus(content) {
    return this.extractWeekFocus(content);
  }

  // Pattern recognition helpers
  isActivity(line) {
    const activityPatterns = [
      /^\d+\./,  // Numbered list
      /^[A-Z][a-z].*:/, // Title with colon
      /drill|exercise|activity|practice/i,
      /warm.*up|cool.*down/i
    ];
    
    return activityPatterns.some(pattern => pattern.test(line.trim()));
  }

  isDrill(line) {
    return line.toLowerCase().includes('drill') || 
           line.toLowerCase().includes('exercise') ||
           /^\d+\./.test(line.trim());
  }

  isNote(line) {
    return line.startsWith('*') || 
           line.toLowerCase().includes('note') ||
           line.toLowerCase().includes('emphasize') ||
           line.toLowerCase().includes('encourage');
  }

  isObjective(line) {
    return line.toLowerCase().includes('focus') ||
           line.toLowerCase().includes('objective') ||
           line.toLowerCase().includes('goal') ||
           line.toLowerCase().includes('emphasize');
  }

  extractDrillName(line) {
    // Extract drill name from line
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      return line.substring(0, colonIndex).trim();
    }
    
    const dotIndex = line.indexOf('.');
    if (dotIndex !== -1 && dotIndex < 50) {
      return line.substring(dotIndex + 1, Math.min(line.length, dotIndex + 30)).trim();
    }
    
    return line.substring(0, Math.min(30, line.length)).trim();
  }

  extractDrillDuration(line) {
    const match = line.match(this.sessionPatterns.durationPattern);
    return match ? parseInt(match[1]) : null;
  }

  estimateParticipants(ageGroup) {
    if (ageGroup.includes('individual') || ageGroup.includes('1-on-1')) {
      return 1;
    } else if (ageGroup.includes('small') || ageGroup.includes('youth')) {
      return 12;
    } else {
      return 15;
    }
  }

  // Convert extracted sessions to UpcomingSessions format
  convertToUpcomingSessions(extractedData) {
    const upcomingSessions = [];
    
    extractedData.sessions.forEach(week => {
      week.dailySessions.forEach(session => {
        // Convert to UpcomingSessions format
        const upcomingSession = {
          id: session.id,
          title: session.title,
          time: session.time,
          duration: session.duration,
          date: this.calculateSessionDate(week.weekNumber, session.day),
          location: session.location,
          type: session.type,
          participants: session.participants,
          status: session.status,
          academyName: session.academyName,
          sport: session.sport,
          ageGroup: session.ageGroup,
          difficulty: session.difficulty,
          completionRate: session.completionRate,
          notes: session.notes,
          activities: session.activities,
          drills: session.drills,
          objectives: session.objectives,
          equipment: session.equipment,
          focus: session.focus,
          // Additional fields for session details
          weekNumber: week.weekNumber,
          dayNumber: session.dayNumber,
          rawContent: session.rawContent,
          sourceDocument: extractedData.sourceDocument,
          sourcePlan: extractedData.sourcePlan
        };
        
        upcomingSessions.push(upcomingSession);
      });
    });
    
    return upcomingSessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  calculateSessionDate(weekNumber, dayName) {
    const today = new Date();
    const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .indexOf(dayName.toLowerCase());
    
    // Calculate the date for this session
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (weekNumber - 1) * 7);
    
    // Adjust to the correct day of week
    const currentDay = targetDate.getDay();
    const daysToAdd = (dayIndex - currentDay + 7) % 7;
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    
    return targetDate.toISOString().split('T')[0];
  }

  // Get extraction statistics
  getExtractionStats(extractedData) {
    return {
      totalWeeks: extractedData.totalWeeks,
      totalSessions: extractedData.totalSessions,
      averageSessionsPerWeek: Math.round(extractedData.totalSessions / extractedData.totalWeeks),
      totalDuration: extractedData.sessions.reduce((sum, week) => sum + week.totalDuration, 0),
      sports: [extractedData.academyInfo.sport],
      ageGroups: [extractedData.academyInfo.ageGroup],
      equipment: [...new Set(
        extractedData.sessions.flatMap(week => 
          week.dailySessions.flatMap(session => session.equipment)
        )
      )],
      focus: [...new Set(
        extractedData.sessions.flatMap(week => 
          week.dailySessions.flatMap(session => session.focus)
        )
      )]
    };
  }
}

export default new SessionExtractor();