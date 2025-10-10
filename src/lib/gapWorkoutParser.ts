import { ComprehensiveWorkoutParser } from './comprehensiveWorkoutParser';
import type { CompletedWorkout, CompletedExercise, Exercise } from '@/types/fitness';

/**
 * Parse gap workout text with format:
 * # Workout Name dd-mm-yyyy
 * -- Exercise 1
 * 3 x 10 x 50kg
 * 
 * Supports date formats: dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy
 */
export function parseGapWorkoutsText(text: string): CompletedWorkout[] {
  const workouts: CompletedWorkout[] = [];
  
  // Split by # to get workout blocks
  const workoutBlocks = text.split(/^#\s+/m).filter(block => block.trim());
  
  for (const block of workoutBlocks) {
    const lines = block.split('\n');
    if (lines.length === 0) continue;
    
    // Parse header: "Workout Name dd-mm-yyyy"
    const headerLine = lines[0].trim();
    const { name, date } = parseWorkoutHeader(headerLine);
    
    if (!name || !date) {
      console.warn('[Gap Workout Parser] Invalid header:', headerLine);
      continue;
    }
    
    // Parse exercises using existing parser
    const exerciseText = lines.slice(1).join('\n');
    const parsedExercises = parseExercisesForGap(exerciseText);
    
    workouts.push({
      workoutId: `gap_workout_${Date.now()}_${Math.random()}`,
      name,
      date,
      exercises: parsedExercises,
      completed: true,
      notes: 'Added during gap recovery'
    });
  }
  
  // Sort by date (oldest first)
  workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return workouts;
}

/**
 * Parse workout header to extract name and date
 * Format: "Workout Name dd-mm-yyyy" or "Workout Name dd.mm.yyyy" or "Workout Name dd/mm/yyyy"
 */
function parseWorkoutHeader(headerLine: string): { name: string; date: string } {
  // Match date at the end (dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy)
  const datePattern = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/;
  const match = headerLine.match(datePattern);
  
  if (!match) {
    return { name: headerLine.trim(), date: new Date().toISOString() };
  }
  
  const [fullMatch, day, month, year] = match;
  const name = headerLine.replace(fullMatch, '').trim();
  
  // Convert to ISO format (YYYY-MM-DD)
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  return { name, date: isoDate };
}

/**
 * Parse exercises from text and convert to CompletedExercise format
 * All exercises are marked as completed
 */
function parseExercisesForGap(text: string): CompletedExercise[] {
  const parsed = ComprehensiveWorkoutParser.parseWorkoutText(text);
  const completedExercises: CompletedExercise[] = [];
  
  for (const parsedEx of parsed.workout) {
    const exercise: CompletedExercise = {
      exerciseId: `gap_exercise_${Date.now()}_${Math.random()}`,
      name: parsedEx.exercise.replace(/^[✓✗]\s*/, '').trim(),
      sets: [],
      notes: parsedEx.cues
    };
    
    // Convert sets (all marked as completed)
    if (parsedEx.sets && parsedEx.sets.length > 0) {
      for (const set of parsedEx.sets) {
        for (let i = 0; i < set.sets_planned; i++) {
          exercise.sets.push({
            reps: set.reps,
            weight: set.weight ? parseFloat(set.weight) : undefined,
            completed: true
          });
        }
      }
    }
    
    // Convert distances (all marked as completed)
    if (parsedEx.distances && parsedEx.distances.length > 0) {
      for (const dist of parsedEx.distances) {
        exercise.sets.push({
          distance: dist.value,
          completed: true
        });
      }
    }
    
    // Convert times/durations (all marked as completed)
    if (parsedEx.times && parsedEx.times.length > 0) {
      for (const time of parsedEx.times) {
        exercise.sets.push({
          duration: time.value,
          completed: true
        });
      }
    }
    
    // Legacy distance support
    if (parsedEx.distance) {
      exercise.sets.push({
        distance: parsedEx.distance,
        completed: true
      });
    }
    
    // Legacy time support
    if (parsedEx.time) {
      exercise.sets.push({
        duration: parsedEx.time,
        completed: true
      });
    }
    
    completedExercises.push(exercise);
  }
  
  return completedExercises;
}

/**
 * Format date from ISO to dd-mm-yyyy for display
 */
export function formatDateForDisplay(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parse single date string to ISO format
 * Supports: dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy
 */
export function parseDateToISO(dateStr: string): string {
  const datePattern = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/;
  const match = dateStr.match(datePattern);
  
  if (!match) {
    // If no match, return today's date
    return new Date().toISOString().split('T')[0];
  }
  
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}


