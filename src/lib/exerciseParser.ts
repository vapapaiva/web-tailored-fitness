import type { Exercise, ExerciseSet, ParsedExercise, ParsedSet } from '@/types/fitness';

/**
 * Parses exercise text input into structured exercise data
 * Supports formats like:
 * - Running 10km
 * - Weighted pull ups 3x10x40kg
 * - Push ups 3x10
 * - Plank 30s
 * - Rest 2m
 */
export function parseExerciseText(text: string): ParsedExercise[] {
  const lines = text.split('\n').filter(line => line.trim());
  const exercises: ParsedExercise[] = [];
  let currentExercise: ParsedExercise | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // Skip empty lines and comments

    // Check if this is a new exercise (starts with -)
    if (trimmed.startsWith('-')) {
      // Save previous exercise if exists
      if (currentExercise) {
        exercises.push(currentExercise);
      }
      
      // Start new exercise
      const exerciseName = trimmed.replace(/^[-•*]\s*/, '').trim();
      currentExercise = {
        name: exerciseName,
        sets: [],
      };
    } else if (currentExercise) {
      // This is either a set definition or instruction
      const setData = parseSetLine(trimmed);
      if (setData) {
        if (!currentExercise.sets) currentExercise.sets = [];
        currentExercise.sets.push(setData);
      } else {
        // Treat as instruction
        currentExercise.instructions = currentExercise.instructions 
          ? `${currentExercise.instructions}\n${trimmed}`
          : trimmed;
      }
    }
  }

  // Add the last exercise
  if (currentExercise) {
    exercises.push(currentExercise);
  }

  return exercises;
}

function parseSetLine(line: string): ParsedSet | null {
  // Look for volume patterns
  const volumePatterns = [
    // Sets x Reps x Weight (3x10x40kg)
    /^(\d+)x(\d+)x(\d+(?:\.\d+)?)(kg|lb|lbs)$/i,
    // Sets x Reps (3x10)
    /^(\d+)x(\d+)$/,
    // Duration (30s, 2m, 45sec, 10min)
    /^(\d+(?:\.\d+)?)(s|sec|seconds?|m|min|minutes?)$/i,
    // Distance (10km, 5mi, 100m)
    /^(\d+(?:\.\d+)?)(km|mi|m|miles?)$/i,
  ];

  for (let i = 0; i < volumePatterns.length; i++) {
    const pattern = volumePatterns[i];
    const match = line.match(pattern);
    if (match) {
      if (i === 0) {
        // Sets x Reps x Weight
        return {
          reps: parseInt(match[2]),
          weight: parseFloat(match[3]),
          unit: match[4].toLowerCase(),
        };
      } else if (i === 1) {
        // Sets x Reps
        return {
          reps: parseInt(match[2]),
        };
      } else if (i === 2) {
        // Duration
        return {
          reps: 1,
          duration: convertToSeconds(parseFloat(match[1]), match[2]),
          unit: 'seconds',
        };
      } else if (i === 3) {
        // Distance
        return {
          reps: 1,
          distance: parseFloat(match[1]),
          unit: normalizeDistanceUnit(match[2]),
        };
      }
    }
  }

  return null;
}


function normalizeDistanceUnit(unit: string): string {
  const lower = unit.toLowerCase();
  if (lower.includes('km')) return 'km';
  if (lower.includes('mi')) return 'mi';
  if (lower.includes('m')) return 'm';
  return unit;
}

function convertToSeconds(value: number, unit: string): number {
  const lower = unit.toLowerCase();
  if (lower.includes('m')) return value * 60; // minutes to seconds
  if (lower.includes('s')) return value; // already seconds
  return value;
}

/**
 * Converts parsed exercises to the full Exercise format required by the fitness plan
 */
export function convertParsedToExercise(parsed: ParsedExercise, exerciseId: string): Exercise {
  const sets: ExerciseSet[] = parsed.sets.map(parsedSet => ({
    reps: parsedSet.reps,
    weight: parsedSet.weight,
    duration: parsedSet.duration,
    restTime: 90, // Default rest time
    notes: parsedSet.distance ? `${parsedSet.distance}${parsedSet.unit}` : '',
  }));

  // If no sets were parsed, create a default set
  if (sets.length === 0) {
    sets.push({
      reps: 10,
      restTime: 90,
      notes: '',
    });
  }

  return {
    id: exerciseId,
    name: parsed.name,
    category: 'unknown',
    muscleGroups: [],
    equipment: [],
    instructions: parsed.instructions || '',
    sets,
  };
}

/**
 * Converts Exercise back to text format for editing
 */
export function exerciseToText(exercise: Exercise): string {
  let result = `- ${exercise.name}`;
  
  // Group sets by type and combine identical sets
  const setGroups = groupSimilarSets(exercise.sets);
  
  setGroups.forEach(group => {
    if (group.duration) {
      // Duration exercise
      const minutes = Math.floor(group.duration / 60);
      const seconds = group.duration % 60;
      if (minutes > 0) {
        result += `\n${seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`}`;
      } else {
        result += `\n${seconds}s`;
      }
    } else if (group.notes && (group.notes.includes('km') || group.notes.includes('mi') || group.notes.includes('m'))) {
      // Distance exercise
      result += `\n${group.notes}`;
    } else {
      // Sets x Reps (x Weight)
      if (group.weight) {
        result += `\n${group.count}x${group.reps}x${group.weight}kg`;
      } else {
        result += `\n${group.count}x${group.reps}`;
      }
    }
  });

  // Add instructions if present
  if (exercise.instructions) {
    result += `\n${exercise.instructions}`;
  }

  return result;
}

/**
 * Groups similar sets together for better text representation
 */
export function groupSimilarSets(sets: ExerciseSet[]): Array<ExerciseSet & { count: number }> {
  const groups: Array<ExerciseSet & { count: number }> = [];
  
  sets.forEach(set => {
    // Find existing group with same parameters
    const existingGroup = groups.find(group => 
      group.reps === set.reps &&
      group.weight === set.weight &&
      group.duration === set.duration &&
      group.notes === set.notes
    );
    
    if (existingGroup) {
      existingGroup.count++;
    } else {
      groups.push({ ...set, count: 1 });
    }
  });
  
  return groups;
}
