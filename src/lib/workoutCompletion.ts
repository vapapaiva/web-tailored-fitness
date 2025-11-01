/**
 * Utility functions for analyzing workout completion status
 * Determines if a workout is not started, partially done, or completed
 */

import type { Workout, Exercise } from '@/types/fitness';

export interface WorkoutCompletionStats {
  status: 'not-started' | 'partially-done' | 'completed';
  exercises: {
    completed: number;
    total: number;
    completionRate: number;
  };
  sets: {
    completed: number;
    total: number;
    completionRate: number;
  };
  hasAnyProgress: boolean;
}

/**
 * Check if an exercise has any completed sets
 */
export function hasExerciseProgress(exercise: Exercise): boolean {
  return exercise.sets.some(set => set.completed === true);
}

/**
 * Check if an exercise is fully completed (all sets marked as completed)
 */
export function isExerciseFullyCompleted(exercise: Exercise): boolean {
  if (exercise.sets.length === 0) return false;
  return exercise.sets.every(set => set.completed === true);
}

/**
 * Calculate exercise completion stats
 */
export function calculateExerciseStats(exercise: Exercise): {
  completed: boolean;
  hasProgress: boolean;
  setsCompleted: number;
  setsTotal: number;
  completionRate: number;
} {
  const setsTotal = exercise.sets.length;
  const setsCompleted = exercise.sets.filter(set => set.completed === true).length;
  const completionRate = setsTotal > 0 ? (setsCompleted / setsTotal) * 100 : 0;
  
  return {
    completed: isExerciseFullyCompleted(exercise),
    hasProgress: hasExerciseProgress(exercise),
    setsCompleted,
    setsTotal,
    completionRate
  };
}

/**
 * Analyze workout completion status and calculate detailed stats
 */
export function analyzeWorkoutCompletion(workout: Workout): WorkoutCompletionStats {
  let exercisesCompleted = 0;
  let exercisesWithProgress = 0;
  let totalSets = 0;
  let completedSets = 0;
  
  workout.exercises.forEach(exercise => {
    const exerciseStats = calculateExerciseStats(exercise);
    
    if (exerciseStats.completed) {
      exercisesCompleted++;
    }
    
    if (exerciseStats.hasProgress) {
      exercisesWithProgress++;
    }
    
    totalSets += exerciseStats.setsTotal;
    completedSets += exerciseStats.setsCompleted;
  });
  
  const totalExercises = workout.exercises.length;
  const exerciseCompletionRate = totalExercises > 0 ? (exercisesCompleted / totalExercises) * 100 : 0;
  const setCompletionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const hasAnyProgress = exercisesWithProgress > 0 || completedSets > 0;
  
  // Determine overall status based on actual exercise completion
  let status: 'not-started' | 'partially-done' | 'completed';
  
  if (exercisesCompleted === totalExercises && totalExercises > 0) {
    // All exercises are fully completed
    status = 'completed';
  } else if (!hasAnyProgress) {
    // No progress at all
    status = 'not-started';
  } else {
    // Some progress but not all exercises completed
    status = 'partially-done';
  }
  
  return {
    status,
    exercises: {
      completed: exercisesCompleted,
      total: totalExercises,
      completionRate: exerciseCompletionRate
    },
    sets: {
      completed: completedSets,
      total: totalSets,
      completionRate: setCompletionRate
    },
    hasAnyProgress
  };
}

/**
 * Get status display text for UI
 */
export function getStatusDisplayText(status: 'not-started' | 'partially-done' | 'completed'): string {
  switch (status) {
    case 'not-started':
      return 'Planned';
    case 'partially-done':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    default:
      return 'Planned';
  }
}

/**
 * Get status badge variant for UI styling
 */
export function getStatusBadgeVariant(status: 'not-started' | 'partially-done' | 'completed'): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'not-started':
      return 'secondary';
    case 'partially-done':
      return 'outline';
    case 'completed':
      return 'default';
    default:
      return 'secondary';
  }
}

/**
 * Get status icon component name for UI
 */
export function getStatusIcon(status: 'not-started' | 'partially-done' | 'completed'): 'Clock' | 'Play' | 'CheckCircle' {
  switch (status) {
    case 'not-started':
      return 'Clock';
    case 'partially-done':
      return 'Play';
    case 'completed':
      return 'CheckCircle';
    default:
      return 'Clock';
  }
}

/**
 * Format completion stats for display
 */
export function formatCompletionStats(stats: WorkoutCompletionStats): {
  exerciseText: string;
  setText: string;
  shortSummary: string;
} {
  const exerciseText = `${stats.exercises.completed}/${stats.exercises.total} exercises`;
  const setText = `${stats.sets.completed}/${stats.sets.total} sets`;
  
  let shortSummary = '';
  if (stats.status === 'completed') {
    shortSummary = 'All done!';
  } else if (stats.status === 'partially-done') {
    shortSummary = `${Math.round(stats.sets.completionRate)}% complete`;
  } else {
    shortSummary = 'Not started';
  }
  
  return {
    exerciseText,
    setText,
    shortSummary
  };
}
