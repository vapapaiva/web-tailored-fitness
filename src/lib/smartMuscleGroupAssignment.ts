/**
 * Smart muscle group assignment system that handles LLM-generated exercise names
 * Uses pattern matching, NLP techniques, and user feedback to classify exercises
 */

import { findExerciseDefinition, type ExerciseDefinition } from './exerciseDatabase';

export interface SmartExerciseClassification {
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  confidence: number; // 0-1 confidence score
  matchMethod: 'exact' | 'alias' | 'pattern' | 'keyword' | 'fallback';
  suggestions?: string[]; // Alternative classifications user can choose
}

/**
 * Muscle group keywords for pattern matching
 */
const MUSCLE_GROUP_PATTERNS = {
  // Upper Body Push
  chest: ['chest', 'pec', 'bench', 'press', 'push'],
  triceps: ['tricep', 'tri', 'extension', 'dip', 'push'],
  shoulders: ['shoulder', 'delt', 'overhead', 'lateral', 'front raise', 'rear delt'],
  
  // Upper Body Pull
  back: ['back', 'lat', 'row', 'pull', 'chin', 'pulldown'],
  biceps: ['bicep', 'curl', 'chin'],
  traps: ['trap', 'shrug', 'upright'],
  
  // Lower Body
  quadriceps: ['quad', 'squat', 'lunge', 'leg press', 'extension'],
  hamstrings: ['hamstring', 'ham', 'curl', 'deadlift', 'rdl'],
  glutes: ['glute', 'hip', 'bridge', 'thrust', 'squat'],
  calves: ['calf', 'raise', 'heel'],
  
  // Core
  core: ['core', 'ab', 'plank', 'crunch', 'sit', 'twist', 'russian'],
  
  // Full Body
  legs: ['leg', 'squat', 'lunge', 'step'],
  arms: ['arm', 'curl', 'extension', 'press'],
  
  // Cardio indicators
  cardio: ['run', 'jog', 'walk', 'bike', 'cycle', 'swim', 'row', 'elliptical', 'treadmill']
};

/**
 * Exercise category patterns
 */
const CATEGORY_PATTERNS = {
  strength: ['press', 'curl', 'extension', 'squat', 'deadlift', 'row', 'pull', 'push', 'lift'],
  cardio: ['run', 'jog', 'walk', 'bike', 'cycle', 'swim', 'elliptical', 'treadmill', 'sprint'],
  flexibility: ['stretch', 'yoga', 'mobility', 'foam roll'],
  balance: ['balance', 'stability', 'bosu', 'single leg'],
  plyometric: ['jump', 'hop', 'bound', 'explosive', 'plyometric'],
  functional: ['functional', 'movement', 'carry', 'farmer']
};

/**
 * Smart classification function that handles varied LLM exercise names
 */
export function classifyExercise(exerciseName: string): SmartExerciseClassification {
  const normalizedName = exerciseName.toLowerCase().trim();
  
  // Step 1: Try exact database match
  const exactMatch = findExerciseDefinition(exerciseName);
  if (exactMatch) {
    return {
      category: exactMatch.category,
      primaryMuscles: exactMatch.primaryMuscles,
      secondaryMuscles: exactMatch.secondaryMuscles,
      equipment: exactMatch.equipment,
      confidence: 1.0,
      matchMethod: 'exact'
    };
  }
  
  // Step 2: Pattern-based classification
  const patternResult = classifyByPatterns(normalizedName);
  if (patternResult.confidence > 0.7) {
    return patternResult;
  }
  
  // Step 3: Keyword-based fallback
  const keywordResult = classifyByKeywords(normalizedName);
  if (keywordResult.confidence > 0.5) {
    return keywordResult;
  }
  
  // Step 4: Ultimate fallback with suggestions
  return {
    category: 'General',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    confidence: 0.1,
    matchMethod: 'fallback',
    suggestions: generateSuggestions(normalizedName)
  };
}

/**
 * Classify exercise using muscle group and category patterns
 */
function classifyByPatterns(normalizedName: string): SmartExerciseClassification {
  const detectedMuscles: string[] = [];
  const detectedCategories: string[] = [];
  let confidence = 0;
  
  // Check muscle group patterns
  Object.entries(MUSCLE_GROUP_PATTERNS).forEach(([muscle, patterns]) => {
    patterns.forEach(pattern => {
      if (normalizedName.includes(pattern)) {
        detectedMuscles.push(muscle);
        confidence += 0.2;
      }
    });
  });
  
  // Check category patterns
  Object.entries(CATEGORY_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      if (normalizedName.includes(pattern)) {
        detectedCategories.push(category);
        confidence += 0.1;
      }
    });
  });
  
  // Determine primary category
  const category = detectedCategories.length > 0 
    ? capitalizeFirst(detectedCategories[0]) 
    : 'Strength'; // Default to strength
  
  // Split muscles into primary and secondary
  const primaryMuscles = detectedMuscles.slice(0, 2).map(capitalizeFirst);
  const secondaryMuscles = detectedMuscles.slice(2, 4).map(capitalizeFirst);
  
  return {
    category,
    primaryMuscles,
    secondaryMuscles,
    equipment: inferEquipment(normalizedName),
    confidence: Math.min(confidence, 1.0),
    matchMethod: 'pattern'
  };
}

/**
 * Classify using individual keywords
 */
function classifyByKeywords(normalizedName: string): SmartExerciseClassification {
  const words = normalizedName.split(/\s+/);
  const detectedMuscles: string[] = [];
  let confidence = 0;
  
  // Check each word against muscle patterns
  words.forEach(word => {
    Object.entries(MUSCLE_GROUP_PATTERNS).forEach(([muscle, patterns]) => {
      if (patterns.some(pattern => word.includes(pattern) || pattern.includes(word))) {
        if (!detectedMuscles.includes(muscle)) {
          detectedMuscles.push(muscle);
          confidence += 0.3;
        }
      }
    });
  });
  
  // Determine category from muscles
  let category = 'General';
  if (detectedMuscles.some(m => ['chest', 'triceps', 'shoulders', 'back', 'biceps'].includes(m))) {
    category = 'Strength';
  } else if (detectedMuscles.includes('cardio')) {
    category = 'Cardio';
  }
  
  return {
    category,
    primaryMuscles: detectedMuscles.slice(0, 2).map(capitalizeFirst),
    secondaryMuscles: detectedMuscles.slice(2).map(capitalizeFirst),
    equipment: inferEquipment(normalizedName),
    confidence: Math.min(confidence, 1.0),
    matchMethod: 'keyword'
  };
}

/**
 * Infer equipment from exercise name
 */
function inferEquipment(normalizedName: string): string[] {
  const equipment: string[] = [];
  
  const equipmentPatterns = {
    'Barbell': ['barbell', 'bb', 'olympic'],
    'Dumbbell': ['dumbbell', 'db', 'dumbell'],
    'Kettlebell': ['kettlebell', 'kb'],
    'Cable': ['cable', 'pulley'],
    'Machine': ['machine', 'smith', 'leg press'],
    'Bodyweight': ['bodyweight', 'bw', 'calisthenics'],
    'Resistance Band': ['band', 'elastic', 'resistance'],
    'Pull-up bar': ['pull up', 'chin up', 'pullup'],
    'Bench': ['bench'],
    'None': ['run', 'walk', 'jog', 'sprint']
  };
  
  Object.entries(equipmentPatterns).forEach(([equip, patterns]) => {
    if (patterns.some(pattern => normalizedName.includes(pattern))) {
      equipment.push(equip);
    }
  });
  
  return equipment.length > 0 ? equipment : ['Unknown'];
}

/**
 * Generate suggestions for manual classification
 */
function generateSuggestions(normalizedName: string): string[] {
  const suggestions: string[] = [];
  
  // Find similar exercises in database
  const allExercises = []; // Would need to import full database
  
  // Add common categories as suggestions
  suggestions.push('Strength', 'Cardio', 'Flexibility');
  
  return suggestions;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Batch classify multiple exercises
 */
export function batchClassifyExercises(exerciseNames: string[]): SmartExerciseClassification[] {
  return exerciseNames.map(name => classifyExercise(name));
}

/**
 * User feedback system to improve classifications
 */
export interface UserFeedback {
  exerciseName: string;
  suggestedCategory: string;
  suggestedPrimaryMuscles: string[];
  suggestedSecondaryMuscles: string[];
  confidence: number;
}

/**
 * Learn from user feedback (would integrate with backend)
 */
export function submitUserFeedback(feedback: UserFeedback): void {
  // In a real system, this would:
  // 1. Store feedback in database
  // 2. Update classification patterns
  // 3. Improve future predictions
  console.log('User feedback received:', feedback);
}

/**
 * Get classification confidence explanation
 */
export function explainClassification(classification: SmartExerciseClassification): string {
  switch (classification.matchMethod) {
    case 'exact':
      return 'Found exact match in exercise database';
    case 'alias':
      return 'Matched known exercise alias';
    case 'pattern':
      return `Classified using muscle group patterns (${Math.round(classification.confidence * 100)}% confidence)`;
    case 'keyword':
      return `Classified using keyword analysis (${Math.round(classification.confidence * 100)}% confidence)`;
    case 'fallback':
      return 'Could not classify automatically - manual review recommended';
    default:
      return 'Unknown classification method';
  }
}
