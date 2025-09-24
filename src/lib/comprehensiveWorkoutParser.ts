import type { Exercise, ExerciseSet, Workout } from '@/types/fitness';

export interface ParsedWorkout {
  workout: ParsedExercise[];
}

export interface ParsedExercise {
  exercise: string;
  done?: boolean;
  exerciseLevelDone?: boolean; // NEW: marks all volume in exercise as done
  sets?: ParsedSet[];
  distance?: string;
  distanceDone?: boolean;
  time?: string;
  timeDone?: boolean;
  cues?: string;
}

export interface ParsedSet {
  sets_planned: number;
  reps: number;
  weight?: string;
  sets_done?: number;
}

/**
 * Comprehensive workout text parser that follows exact specifications
 */
export class ComprehensiveWorkoutParser {
  /**
   * Parse workout text into structured data following exact rules
   */
  static parseWorkoutText(text: string): ParsedWorkout {
    const lines = this.preprocessText(text);
    const exercises: ParsedExercise[] = [];
    let currentExercise: ParsedExercise | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for exercise header
      const headerMatch = line.match(/^-+\s+(.*)$/);
      if (headerMatch) {
        // Save previous exercise if exists
        if (currentExercise) {
          exercises.push(currentExercise);
        }
        
        // Start new exercise
        const rawHeader = headerMatch[1];
        currentExercise = {
          exercise: rawHeader,
          sets: []
        };
        continue;
      }
      
      // Process line within current exercise
      if (currentExercise) {
        // Check for set line
        const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)(?:\s*x\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|lb)))?\s*([\+\s]*)\s*$/);
        if (setMatch) {
          const [, setsPlanned, reps, weight, plusesAndSpaces] = setMatch;
          // Count actual + symbols, ignoring spaces
          const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
          const parsedSet: ParsedSet = {
            sets_planned: parseInt(setsPlanned),
            reps: parseInt(reps),
            sets_done: plusCount > 0 ? plusCount : undefined
          };
          
          if (weight) {
            parsedSet.weight = weight.trim();
          }
          
          currentExercise.sets!.push(parsedSet);
          continue;
        }
        
        // Check for distance line
        const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*([\+\s]*)\s*$/);
        if (distanceMatch) {
          const [, value, unit, plusesAndSpaces] = distanceMatch;
          currentExercise.distance = `${value}${unit}`;
          // Count actual + symbols, ignoring spaces
          const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
          if (plusCount > 0) {
            currentExercise.distanceDone = true;
            currentExercise.done = true; // Keep for backward compatibility
          }
          continue;
        }
        
        // Check for time line (supports formats like 15m, 15min, 1h30m)
        const timeMatch = line.match(/^\s*(?:(\d+)h)?\s*(?:(\d+)(?:m|min))?\s*([\+\s]*)\s*$/);
        if (timeMatch) {
          const [, hours, minutes, plusesAndSpaces] = timeMatch;
          let timeStr = '';
          if (hours) timeStr += hours + 'h';
          if (minutes) timeStr += minutes + 'm';
          if (timeStr) {
            currentExercise.time = timeStr;
            // Count actual + symbols, ignoring spaces
            const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
            if (plusCount > 0) {
              currentExercise.timeDone = true;
              currentExercise.done = true; // Keep for backward compatibility
            }
          }
          continue;
        }
        
        // Any other non-blank line is a cue/note
        if (line.trim()) {
          if (currentExercise.cues) {
            currentExercise.cues += '\n' + line;
          } else {
            currentExercise.cues = line;
          }
        }
      }
    }
    
    // Save last exercise
    if (currentExercise) {
      // Process exercise header for done status
      this.processExerciseHeader(currentExercise);
      exercises.push(currentExercise);
    }
    
    return { workout: exercises };
  }
  
  /**
   * Preprocess text: split, trim, collapse blanks
   */
  private static preprocessText(text: string): string[] {
    const lines = text.split('\n').map(line => line.trim());
    const processed: string[] = [];
    let lastWasBlank = false;
    
    for (const line of lines) {
      if (line === '') {
        if (!lastWasBlank) {
          processed.push(line);
          lastWasBlank = true;
        }
      } else {
        processed.push(line);
        lastWasBlank = false;
      }
    }
    
    return processed;
  }
  
  /**
   * Process exercise header for done status and name extraction
   */
  private static processExerciseHeader(exercise: ParsedExercise): void {
    const rawHeader = exercise.exercise;
    
    // Check if exercise has volume (sets, distance, or time)
    const hasVolume = (exercise.sets && exercise.sets.length > 0) || 
                      exercise.distance || 
                      exercise.time;
    
    if (rawHeader.endsWith('+')) {
      exercise.exercise = rawHeader.replace(/\+\s*$/, '').trim();
      
      if (hasVolume) {
        // Has volume: + after exercise name marks all volume as done
        exercise.exerciseLevelDone = true;
      } else {
        // No volume: + after exercise name marks exercise as done
        exercise.done = true;
      }
    }
  }
  
  /**
   * Convert parsed workout to Exercise format for UI
   */
  static convertToExercises(parsedWorkout: ParsedWorkout, existingWorkout?: Workout): Exercise[] {
    return parsedWorkout.workout.map((parsedExercise, index) => {
      const existingExercise = existingWorkout?.exercises[index];
      
      const exercise: Exercise = {
        id: existingExercise?.id || `exercise_${Date.now()}_${Math.random()}`,
        name: parsedExercise.exercise,
        category: existingExercise?.category || 'General',
        muscleGroups: existingExercise?.muscleGroups || [],
        equipment: existingExercise?.equipment || [],
        instructions: parsedExercise.cues || '',
        sets: []
      };
      
      // Convert sets
      if (parsedExercise.sets) {
        parsedExercise.sets.forEach(parsedSet => {
          // Generate unique volumeRowId for this set line
          const volumeRowId = `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Create individual sets based on sets_planned
          for (let i = 0; i < parsedSet.sets_planned; i++) {
            const exerciseSet: ExerciseSet = {
              reps: parsedSet.reps,
              restTime: 90,
              notes: '',
              volumeType: parsedSet.weight ? 'sets-reps-weight' : 'sets-reps',
              volumeRowId // All sets from the same line get the same volumeRowId
            };
            
            if (parsedSet.weight) {
              const weightMatch = parsedSet.weight.match(/([0-9]+(?:\.[0-9]+)?)\s*(kg|lb)/);
              if (weightMatch) {
                exerciseSet.weight = parseFloat(weightMatch[1]);
                exerciseSet.weightUnit = weightMatch[2] as 'kg' | 'lb';
              }
            }
            
            exercise.sets.push(exerciseSet);
          }
        });
      }
      
      // Handle distance
      if (parsedExercise.distance) {
        const distanceMatch = parsedExercise.distance.match(/([0-9]+(?:\.[0-9]+)?)(km|mi|m)/);
        if (distanceMatch) {
          const exerciseSet: ExerciseSet = {
            reps: 1,
            restTime: 90,
            notes: parsedExercise.distance,
            volumeType: 'distance',
            distanceUnit: distanceMatch[2] as 'km' | 'mi' | 'm',
            volumeRowId: `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
          exercise.sets.push(exerciseSet);
        }
      }
      
      // Handle time
      if (parsedExercise.time) {
        const exerciseSet: ExerciseSet = {
          reps: 1,
          restTime: 90,
          notes: parsedExercise.time,
          volumeType: 'duration',
          duration: this.parseTimeToSeconds(parsedExercise.time),
          volumeRowId: `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        exercise.sets.push(exerciseSet);
      }
      
      // Ensure all exercises have at least one set for progress tracking
      if (exercise.sets.length === 0) {
        exercise.sets.push({
          reps: 1,
          restTime: 0,
          notes: '',
          volumeType: 'completion',
          volumeRowId: `completion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
      
      return exercise;
    });
  }
  
  /**
   * Parse time string to seconds
   */
  private static parseTimeToSeconds(timeStr: string): number {
    let totalSeconds = 0;
    
    const hoursMatch = timeStr.match(/(\d+)h/);
    if (hoursMatch) {
      totalSeconds += parseInt(hoursMatch[1]) * 3600;
    }
    
    const minutesMatch = timeStr.match(/(\d+)m/);
    if (minutesMatch) {
      totalSeconds += parseInt(minutesMatch[1]) * 60;
    }
    
    return totalSeconds;
  }
  
  /**
   * Generate workout text from structured data
   */
  static generateWorkoutText(workout: Workout, progress: { [exerciseId: string]: boolean[] }): string {
    let text = '';
    
    workout.exercises.forEach(exercise => {
      const exerciseProgress = progress[exercise.id] || [];
      
      // Check if this is a completion-only exercise (no real volume)
      const hasOnlyCompletionSets = exercise.sets.every(set => set.volumeType === 'completion');
      const isCompletionExerciseCompleted = hasOnlyCompletionSets && exerciseProgress.some(Boolean);
      
      // Generate exercise name with completion marker if needed
      if (isCompletionExerciseCompleted) {
        text += `- ${exercise.name} +\n`;
      } else {
        text += `- ${exercise.name}\n`;
      }
      
      if (exercise.instructions) {
        text += `${exercise.instructions}\n`;
      }
      
      // Only show volume for exercises that have real volume (not just completion sets)
      if (!hasOnlyCompletionSets) {
        // Group sets by type for better display
        const groupedSets = this.groupSetsByType(exercise.sets, exerciseProgress);
        
        Object.entries(groupedSets).forEach(([key, group]) => {
          const completedCount = group.completedCount;
          const totalSets = group.sets.length;
          const pluses = '+'.repeat(completedCount);
          
          // For distance and duration, don't prefix with sets count
          const firstSet = group.sets[0];
          if (firstSet?.volumeType === 'distance' || firstSet?.volumeType === 'duration') {
            text += `${key} ${pluses}\n`;
          } else {
            text += `${totalSets}x${key} ${pluses}\n`;
          }
        });
      }
      
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
      // Skip completion sets - they should not appear in text output
      if (set.volumeType === 'completion') {
        return;
      }
      
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
