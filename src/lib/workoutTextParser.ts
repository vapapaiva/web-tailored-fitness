import type { Exercise, ExerciseSet, Workout } from '@/types/fitness';

export interface ParsedWorkout {
  exercises: Exercise[];
  progress: { [exerciseId: string]: boolean[] };
}

export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  instructions: string;
}

export interface ParsedSet {
  reps: number;
  weight?: number;
  duration?: number;
  distance?: number;
  distanceUnit?: 'km' | 'mi' | 'm';
  weightUnit?: 'kg' | 'lb';
  volumeType: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance';
  completed: boolean;
}

/**
 * Comprehensive workout text parser that handles various formats
 */
export class WorkoutTextParser {
  /**
   * Parse workout text into structured data with progress tracking
   */
  static parseWorkoutText(text: string, existingWorkout?: Workout): ParsedWorkout {
    const lines = text.split('\n').filter(line => line.trim());
    const exercises: Exercise[] = [];
    const progress: { [exerciseId: string]: boolean[] } = {};
    
    let currentExercise: ParsedExercise | null = null;
    let exerciseIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('- ')) {
        // Exercise name line
        if (currentExercise) {
          // Save previous exercise
          const exercise = this.createExerciseFromParsed(currentExercise, exerciseIndex, existingWorkout);
          exercises.push(exercise);
          progress[exercise.id] = currentExercise.sets.map(set => set.completed);
        }
        
        // Start new exercise
        const exerciseName = line.substring(2).trim();
        currentExercise = {
          name: exerciseName,
          sets: [],
          instructions: ''
        };
        exerciseIndex++;
      } else if (line && currentExercise) {
        // Set line or instruction line
        const setMatch = this.parseSetLine(line);
        if (setMatch) {
          currentExercise.sets.push(setMatch);
        } else {
          // This is an instruction/cue line
          if (currentExercise.instructions) {
            currentExercise.instructions += '\n' + line;
          } else {
            currentExercise.instructions = line;
          }
        }
      }
    }
    
    // Don't forget the last exercise
    if (currentExercise) {
      const exercise = this.createExerciseFromParsed(currentExercise, exerciseIndex, existingWorkout);
      exercises.push(exercise);
      progress[exercise.id] = currentExercise.sets.map(set => set.completed);
    }
    
    return { exercises, progress };
  }
  
  /**
   * Parse a single set line with various formats
   */
  private static parseSetLine(line: string): ParsedSet | null {
    // Try different set formats in order of specificity
    
    // Format: 5x10x10kg +++++ (sets-reps-weight)
    let match = line.match(/^(\d+)x(\d+)x(\d+(?:\.\d+)?)(kg|lb)\s*(\+*)/);
    if (match) {
      const [, sets, reps, weight, unit, pluses] = match;
      const setsCount = parseInt(sets);
      const repsCount = parseInt(reps);
      const weightValue = parseFloat(weight);
      const completedCount = pluses.length;
      
      // Create multiple sets based on the sets count
      const result: ParsedSet = {
        reps: repsCount,
        weight: weightValue,
        weightUnit: unit as 'kg' | 'lb',
        volumeType: 'sets-reps-weight',
        completed: completedCount >= setsCount
      };
      
      return result;
    }
    
    // Format: 3x5 +++ (sets-reps)
    match = line.match(/^(\d+)x(\d+)\s*(\+*)/);
    if (match) {
      const [, sets, reps, pluses] = match;
      const setsCount = parseInt(sets);
      const repsCount = parseInt(reps);
      const completedCount = pluses.length;
      
      const result: ParsedSet = {
        reps: repsCount,
        volumeType: 'sets-reps',
        completed: completedCount >= setsCount
      };
      
      return result;
    }
    
    // Format: 10km + (distance)
    match = line.match(/^(\d+(?:\.\d+)?)(km|mi|m)\s*(\+*)/);
    if (match) {
      const [, distance, unit, pluses] = match;
      const distanceValue = parseFloat(distance);
      const completed = pluses.length > 0;
      
      const result: ParsedSet = {
        reps: 1,
        distance: distanceValue,
        distanceUnit: unit as 'km' | 'mi' | 'm',
        volumeType: 'distance',
        completed
      };
      
      return result;
    }
    
    // Format: 30min + (duration)
    match = line.match(/^(\d+(?:\.\d+)?)min\s*(\+*)/);
    if (match) {
      const [, duration, pluses] = match;
      const durationMinutes = parseFloat(duration);
      const completed = pluses.length > 0;
      
      const result: ParsedSet = {
        reps: 1,
        duration: durationMinutes * 60, // Convert to seconds
        volumeType: 'duration',
        completed
      };
      
      return result;
    }
    
    // Format: just + (completed exercise without sets)
    if (line === '+') {
      return {
        reps: 1,
        volumeType: 'sets-reps',
        completed: true
      };
    }
    
    return null;
  }
  
  /**
   * Create an Exercise from parsed data
   */
  private static createExerciseFromParsed(
    parsed: ParsedExercise, 
    index: number, 
    existingWorkout?: Workout
  ): Exercise {
    // Try to preserve existing exercise ID if possible
    const existingExercise = existingWorkout?.exercises[index];
    
    const exercise: Exercise = {
      id: existingExercise?.id || `exercise_${Date.now()}_${Math.random()}`,
      name: parsed.name,
      category: existingExercise?.category || 'General',
      muscleGroups: existingExercise?.muscleGroups || [],
      equipment: existingExercise?.equipment || [],
      instructions: parsed.instructions,
      sets: []
    };
    
    // Convert parsed sets to ExerciseSet format
    parsed.sets.forEach(parsedSet => {
      const exerciseSet: ExerciseSet = {
        reps: parsedSet.reps,
        restTime: 90,
        notes: parsedSet.distance ? `${parsedSet.distance}${parsedSet.distanceUnit}` : '',
        volumeType: parsedSet.volumeType,
        weight: parsedSet.weight,
        duration: parsedSet.duration,
        weightUnit: parsedSet.weightUnit,
        distanceUnit: parsedSet.distanceUnit
      };
      
      exercise.sets.push(exerciseSet);
    });
    
    return exercise;
  }
  
  /**
   * Generate workout text from structured data with progress
   */
  static generateWorkoutText(workout: Workout, progress: { [exerciseId: string]: boolean[] }): string {
    let text = '';
    
    workout.exercises.forEach(exercise => {
      const exerciseProgress = progress[exercise.id] || [];
      text += `- ${exercise.name}\n`;
      
      if (exercise.instructions) {
        text += `${exercise.instructions}\n`;
      }
      
      // Group sets by type for better display
      const groupedSets = this.groupSetsByType(exercise.sets, exerciseProgress);
      
      Object.entries(groupedSets).forEach(([key, group]) => {
        const completedCount = group.completedCount;
        const totalSets = group.sets.length;
        const pluses = '+'.repeat(completedCount);
        
        text += `${totalSets}x${key} ${pluses}\n`;
      });
      
      text += '\n';
    });
    
    return text.trim();
  }
  
  /**
   * Group sets by their type and values for display
   */
  private static groupSetsByType(sets: ExerciseSet[], progress: boolean[]) {
    const groups: { [key: string]: { sets: ExerciseSet[], completedCount: number } } = {};
    
    sets.forEach((set, index) => {
      let key = '';
      if (set.volumeType === 'sets-reps-weight') {
        key = `${set.reps}x${set.weight || 0}${set.weightUnit || 'kg'}`;
      } else if (set.volumeType === 'duration') {
        key = `${Math.round((set.duration || 0) / 60)}min`;
      } else if (set.volumeType === 'distance') {
        const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
        const unit = set.distanceUnit || 'km';
        key = `${distance}${unit}`;
      } else {
        key = `${set.reps}`;
      }
      
      if (!groups[key]) {
        groups[key] = { sets: [], completedCount: 0 };
      }
      
      groups[key].sets.push(set);
      if (progress[index]) {
        groups[key].completedCount++;
      }
    });
    
    return groups;
  }
}
