/**
 * Workout normalization utilities
 * Ensures workout data from various sources (AI, parsing, manual) has consistent structure
 */

import type { Exercise, ExerciseSet } from '@/types/fitness';

/**
 * Normalize volumeType based on set properties
 * This ensures volumeType is always set correctly regardless of source
 */
export function normalizeVolumeType(set: ExerciseSet): ExerciseSet['volumeType'] {
  // If already set correctly, keep it
  if (set.volumeType) {
    // Validate it matches the data
    if (set.volumeType === 'duration' && set.duration) return 'duration';
    if (set.volumeType === 'distance' && set.distance) return 'distance';
    if (set.volumeType === 'completion') return 'completion';
    if (set.volumeType === 'sets-reps-weight' && set.weight) return 'sets-reps-weight';
    if (set.volumeType === 'sets-reps' || set.volumeType === 'reps-only') {
      // If weight is present but volumeType says sets-reps, upgrade it
      if (set.weight) return 'sets-reps-weight';
      return set.volumeType;
    }
  }
  
  // Infer from properties
  if (set.duration) return 'duration';
  if (set.distance) return 'distance';
  if (set.weight && set.weight > 0) return 'sets-reps-weight';
  if (set.reps) return 'sets-reps';
  
  return 'reps-only';
}

/**
 * Normalize a single exercise
 * Ensures all sets have correct volumeType and structure
 */
export function normalizeExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    sets: exercise.sets.map(set => ({
      ...set,
      volumeType: normalizeVolumeType(set),
      completed: set.completed === true // Normalize to boolean
    }))
  };
}

/**
 * Normalize all exercises in a workout
 */
export function normalizeExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map(normalizeExercise);
}

/**
 * Normalize exercises for comparison (remove fields that don't affect workout structure)
 * 
 * Core workout structure = what exercise + how much volume
 * Guidance/metadata = instructions, notes, categories, etc.
 */
export function normalizeForComparison(exercises: Exercise[]): any[] {
  return exercises.map(ex => ({
    name: ex.name,
    // Explicitly excluded as guidance/metadata:
    // - category: auto-assigned metadata
    // - muscleGroups: metadata
    // - equipment: metadata
    // - instructions: AI guidance text
    sets: ex.sets.map(set => {
      // Only include fields that define the workout structure
      // NOTE: We deliberately exclude notes, restTime, instructions because:
      // - notes are just AI guidance text, not core structure
      // - restTime is a user preference/adjustment
      // - instructions are guidance, not what workout you're doing
      const normalized: any = {
        reps: set.reps
        // notes intentionally excluded - guidance
        // restTime intentionally excluded - preference
      };
      
      // Include volumeType for structure comparison
      const volumeType = normalizeVolumeType(set);
      normalized.volumeType = volumeType;
      
      // Include type-specific fields
      if (volumeType === 'sets-reps-weight' && set.weight) {
        normalized.weight = set.weight;
        normalized.weightUnit = set.weightUnit || 'kg';
      }
      if (volumeType === 'duration') {
        normalized.duration = set.duration;
      }
      if (volumeType === 'distance') {
        normalized.distance = set.distance;
        normalized.distanceUnit = set.distanceUnit || 'km';
      }
      
      return normalized;
    })
  }));
}

