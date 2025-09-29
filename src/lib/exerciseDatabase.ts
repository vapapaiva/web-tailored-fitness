/**
 * Comprehensive exercise database with categories, muscle groups, and volume calculations
 * This provides intelligent exercise classification and proper volume tracking
 */

export interface ExerciseDefinition {
  name: string;
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Balance' | 'Plyometric' | 'Functional';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  volumeCalculation: 'weight-reps' | 'reps-only' | 'duration' | 'distance' | 'completion';
  aliases: string[]; // Alternative names for the same exercise
}

/**
 * Exercise database with comprehensive exercise definitions
 */
export const EXERCISE_DATABASE: ExerciseDefinition[] = [
  // STRENGTH - Upper Body Push
  {
    name: 'Push-ups',
    category: 'Strength',
    primaryMuscles: ['Chest', 'Triceps'],
    secondaryMuscles: ['Shoulders', 'Core'],
    equipment: ['Bodyweight'],
    difficulty: 'Beginner',
    volumeCalculation: 'reps-only',
    aliases: ['pushup', 'push up', 'press up']
  },
  {
    name: 'Bench Press',
    category: 'Strength',
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Shoulders'],
    equipment: ['Barbell', 'Bench'],
    difficulty: 'Intermediate',
    volumeCalculation: 'weight-reps',
    aliases: ['bench', 'chest press']
  },
  {
    name: 'Overhead Press',
    category: 'Strength',
    primaryMuscles: ['Shoulders'],
    secondaryMuscles: ['Triceps', 'Core'],
    equipment: ['Barbell', 'Dumbbells'],
    difficulty: 'Intermediate',
    volumeCalculation: 'weight-reps',
    aliases: ['shoulder press', 'military press', 'press']
  },

  // STRENGTH - Upper Body Pull
  {
    name: 'Pull-ups',
    category: 'Strength',
    primaryMuscles: ['Back', 'Biceps'],
    secondaryMuscles: ['Shoulders', 'Core'],
    equipment: ['Pull-up bar'],
    difficulty: 'Intermediate',
    volumeCalculation: 'weight-reps', // Can be weighted
    aliases: ['pullup', 'pull up', 'chin up', 'chinup']
  },
  {
    name: 'Deadlift',
    category: 'Strength',
    primaryMuscles: ['Back', 'Glutes', 'Hamstrings'],
    secondaryMuscles: ['Traps', 'Core', 'Forearms'],
    equipment: ['Barbell'],
    difficulty: 'Advanced',
    volumeCalculation: 'weight-reps',
    aliases: ['deadlifts', 'dl']
  },
  {
    name: 'Bent-over Row',
    category: 'Strength',
    primaryMuscles: ['Back'],
    secondaryMuscles: ['Biceps', 'Shoulders'],
    equipment: ['Barbell', 'Dumbbells'],
    difficulty: 'Intermediate',
    volumeCalculation: 'weight-reps',
    aliases: ['barbell row', 'bent over row', 'row']
  },

  // STRENGTH - Lower Body
  {
    name: 'Squats',
    category: 'Strength',
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core', 'Calves'],
    equipment: ['Barbell', 'Bodyweight'],
    difficulty: 'Beginner',
    volumeCalculation: 'weight-reps',
    aliases: ['squat', 'back squat', 'bodyweight squat']
  },
  {
    name: 'Lunges',
    category: 'Strength',
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core', 'Calves'],
    equipment: ['Dumbbells', 'Bodyweight'],
    difficulty: 'Beginner',
    volumeCalculation: 'weight-reps',
    aliases: ['lunge', 'walking lunges', 'reverse lunges']
  },

  // CORE
  {
    name: 'Sit-ups',
    category: 'Strength',
    primaryMuscles: ['Core'],
    secondaryMuscles: ['Hip Flexors'],
    equipment: ['Bodyweight'],
    difficulty: 'Beginner',
    volumeCalculation: 'reps-only',
    aliases: ['situp', 'sit up', 'crunches', 'crunch']
  },
  {
    name: 'Plank',
    category: 'Strength',
    primaryMuscles: ['Core'],
    secondaryMuscles: ['Shoulders', 'Back'],
    equipment: ['Bodyweight'],
    difficulty: 'Beginner',
    volumeCalculation: 'duration',
    aliases: ['planks', 'front plank']
  },

  // CARDIO
  {
    name: 'Running',
    category: 'Cardio',
    primaryMuscles: ['Legs'],
    secondaryMuscles: ['Core', 'Glutes'],
    equipment: ['None'],
    difficulty: 'Beginner',
    volumeCalculation: 'distance',
    aliases: ['run', 'jog', 'jogging']
  },
  {
    name: 'Brisk Walking',
    category: 'Cardio',
    primaryMuscles: ['Legs'],
    secondaryMuscles: ['Core'],
    equipment: ['None'],
    difficulty: 'Beginner',
    volumeCalculation: 'duration',
    aliases: ['walking', 'walk', 'brisk walk']
  },
  {
    name: 'Cycling',
    category: 'Cardio',
    primaryMuscles: ['Legs'],
    secondaryMuscles: ['Core', 'Glutes'],
    equipment: ['Bike'],
    difficulty: 'Beginner',
    volumeCalculation: 'distance',
    aliases: ['bike', 'biking', 'bicycle']
  },
  {
    name: 'Steady Jog',
    category: 'Cardio',
    primaryMuscles: ['Legs'],
    secondaryMuscles: ['Core', 'Glutes'],
    equipment: ['None'],
    difficulty: 'Beginner',
    volumeCalculation: 'duration',
    aliases: ['jogging', 'light jog', 'easy jog']
  },

  // FLEXIBILITY
  {
    name: 'Stretching',
    category: 'Flexibility',
    primaryMuscles: ['Full Body'],
    secondaryMuscles: [],
    equipment: ['None'],
    difficulty: 'Beginner',
    volumeCalculation: 'duration',
    aliases: ['stretch', 'stretches', 'flexibility']
  }
];

/**
 * Find exercise definition by name (fuzzy matching)
 */
export function findExerciseDefinition(exerciseName: string): ExerciseDefinition | null {
  const normalizedName = exerciseName.toLowerCase().trim();
  
  // First try exact match
  let match = EXERCISE_DATABASE.find(ex => 
    ex.name.toLowerCase() === normalizedName ||
    ex.aliases.some(alias => alias.toLowerCase() === normalizedName)
  );
  
  if (match) return match;
  
  // Then try partial match
  match = EXERCISE_DATABASE.find(ex => 
    ex.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(ex.name.toLowerCase()) ||
    ex.aliases.some(alias => 
      alias.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(alias.toLowerCase())
    )
  );
  
  return match || null;
}

/**
 * Get all muscle groups from exercise definitions
 */
export function getAllMuscleGroups(): string[] {
  const muscleGroups = new Set<string>();
  
  EXERCISE_DATABASE.forEach(exercise => {
    exercise.primaryMuscles.forEach(muscle => muscleGroups.add(muscle));
    exercise.secondaryMuscles.forEach(muscle => muscleGroups.add(muscle));
  });
  
  return Array.from(muscleGroups).sort();
}

/**
 * Get all exercise categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  EXERCISE_DATABASE.forEach(exercise => categories.add(exercise.category));
  return Array.from(categories).sort();
}

/**
 * Enhance exercise with database information
 */
export function enhanceExerciseWithDatabase(exercise: {
  name: string;
  category?: string;
  muscleGroups?: string[];
  equipment?: string[];
}): {
  category: string;
  muscleGroups: string[];
  equipment: string[];
  volumeCalculation: string;
} {
  const definition = findExerciseDefinition(exercise.name);
  
  if (definition) {
    return {
      category: definition.category,
      muscleGroups: [...definition.primaryMuscles, ...definition.secondaryMuscles],
      equipment: definition.equipment,
      volumeCalculation: definition.volumeCalculation
    };
  }
  
  // Fallback to existing data or defaults
  return {
    category: exercise.category || 'General',
    muscleGroups: exercise.muscleGroups || [],
    equipment: exercise.equipment || [],
    volumeCalculation: 'reps-only'
  };
}
