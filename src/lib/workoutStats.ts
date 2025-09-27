/**
 * Comprehensive workout statistics calculation utilities
 * Tracks actual completion vs planned targets with detailed breakdowns
 */

import type { Workout, Exercise, ExerciseSet } from '@/types/fitness';

export interface WorkoutStats {
  // Basic completion stats
  workouts: {
    completed: number;
    planned: number;
    completionRate: number;
  };
  exercises: {
    completed: number;
    planned: number;
    completionRate: number;
  };
  sets: {
    completed: number;
    planned: number;
    completionRate: number;
  };
  duration: {
    actual: number; // in minutes
    planned: number; // in minutes
    completionRate: number;
  };
}

export interface DetailedWorkoutStats extends WorkoutStats {
  // Exercise type breakdown
  exerciseTypes: {
    [category: string]: {
      completed: number;
      planned: number;
      completionRate: number;
      exercises: {
        name: string;
        completed: boolean;
        setsCompleted: number;
        setsPlanned: number;
        completionRate: number;
      }[];
    };
  };
  // Muscle group breakdown
  muscleGroups: {
    [muscleGroup: string]: {
      completed: number;
      planned: number;
      completionRate: number;
    };
  };
}

/**
 * Calculate basic workout statistics from a list of workouts
 */
export function calculateWorkoutStats(workouts: Workout[]): WorkoutStats {
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  
  // Workout stats
  const workoutStats = {
    completed: completedWorkouts.length,
    planned: workouts.length,
    completionRate: workouts.length > 0 ? (completedWorkouts.length / workouts.length) * 100 : 0
  };

  // Exercise stats
  let totalExercises = 0;
  let completedExercises = 0;
  
  workouts.forEach(workout => {
    totalExercises += workout.exercises.length;
    
    workout.exercises.forEach(exercise => {
      const isExerciseCompleted = isExerciseFullyCompleted(exercise);
      if (isExerciseCompleted) {
        completedExercises++;
      }
    });
  });

  const exerciseStats = {
    completed: completedExercises,
    planned: totalExercises,
    completionRate: totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0
  };

  // Set stats
  let totalSets = 0;
  let completedSets = 0;
  
  workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      totalSets += exercise.sets.length;
      // Handle undefined completed flags - only count sets that are explicitly true
      completedSets += exercise.sets.filter(set => set.completed === true).length;
    });
  });

  const setStats = {
    completed: completedSets,
    planned: totalSets,
    completionRate: totalSets > 0 ? (completedSets / totalSets) * 100 : 0
  };

  // Duration stats
  const plannedDuration = workouts.reduce((total, w) => total + w.estimatedDuration, 0);
  const actualDuration = completedWorkouts.reduce((total, w) => total + (w.actualDuration || w.estimatedDuration), 0);
  
  const durationStats = {
    actual: actualDuration,
    planned: plannedDuration,
    completionRate: plannedDuration > 0 ? (actualDuration / plannedDuration) * 100 : 0
  };

  return {
    workouts: workoutStats,
    exercises: exerciseStats,
    sets: setStats,
    duration: durationStats
  };
}

/**
 * Calculate detailed workout statistics with exercise type and muscle group breakdowns
 */
export function calculateDetailedWorkoutStats(workouts: Workout[]): DetailedWorkoutStats {
  const basicStats = calculateWorkoutStats(workouts);
  
  // Exercise type breakdown
  const exerciseTypes: DetailedWorkoutStats['exerciseTypes'] = {};
  
  // Muscle group breakdown
  const muscleGroups: DetailedWorkoutStats['muscleGroups'] = {};
  
  workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      const category = exercise.category || 'Other';
      const isCompleted = isExerciseFullyCompleted(exercise);
      const setsCompleted = exercise.sets.filter(set => set.completed === true).length;
      const setsPlanned = exercise.sets.length;
      
      // Exercise type stats
      if (!exerciseTypes[category]) {
        exerciseTypes[category] = {
          completed: 0,
          planned: 0,
          completionRate: 0,
          exercises: []
        };
      }
      
      exerciseTypes[category].planned++;
      if (isCompleted) {
        exerciseTypes[category].completed++;
      }
      
      exerciseTypes[category].exercises.push({
        name: exercise.name,
        completed: isCompleted,
        setsCompleted,
        setsPlanned,
        completionRate: setsPlanned > 0 ? (setsCompleted / setsPlanned) * 100 : 0
      });
      
      // Muscle group stats
      exercise.muscleGroups.forEach(muscleGroup => {
        if (!muscleGroups[muscleGroup]) {
          muscleGroups[muscleGroup] = {
            completed: 0,
            planned: 0,
            completionRate: 0
          };
        }
        
        muscleGroups[muscleGroup].planned++;
        if (isCompleted) {
          muscleGroups[muscleGroup].completed++;
        }
      });
    });
  });
  
  // Calculate completion rates for exercise types
  Object.keys(exerciseTypes).forEach(category => {
    const stats = exerciseTypes[category];
    stats.completionRate = stats.planned > 0 ? (stats.completed / stats.planned) * 100 : 0;
  });
  
  // Calculate completion rates for muscle groups
  Object.keys(muscleGroups).forEach(muscleGroup => {
    const stats = muscleGroups[muscleGroup];
    stats.completionRate = stats.planned > 0 ? (stats.completed / stats.planned) * 100 : 0;
  });

  return {
    ...basicStats,
    exerciseTypes,
    muscleGroups
  };
}

/**
 * Check if an exercise is fully completed (all sets marked as completed)
 */
export function isExerciseFullyCompleted(exercise: Exercise): boolean {
  if (exercise.sets.length === 0) return false;
  
  // Handle undefined completed flags - treat undefined as false
  
  return exercise.sets.every(set => set.completed === true);
}

/**
 * Check if a workout is fully completed (all exercises fully completed)
 */
export function isWorkoutFullyCompleted(workout: Workout): boolean {
  if (workout.status !== 'completed') return false;
  return workout.exercises.every(exercise => isExerciseFullyCompleted(exercise));
}

/**
 * Get completion percentage for a specific exercise
 */
export function getExerciseCompletionRate(exercise: Exercise): number {
  if (exercise.sets.length === 0) return 0;
  const completedSets = exercise.sets.filter(set => set.completed === true).length;
  return (completedSets / exercise.sets.length) * 100;
}

/**
 * Get completion percentage for a specific workout
 */
export function getWorkoutCompletionRate(workout: Workout): number {
  if (workout.exercises.length === 0) return 0;
  
  const totalSets = workout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
  const completedSets = workout.exercises.reduce((total, ex) => 
    total + ex.sets.filter(set => set.completed === true).length, 0
  );
  
  return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get color class based on completion rate with smooth gradient
 * Improved contrast for both light and dark themes
 */
export function getCompletionColor(completionRate: number): string {
  if (completionRate >= 80) return 'text-green-700 dark:text-green-400';
  if (completionRate >= 60) return 'text-green-600 dark:text-green-300';
  if (completionRate >= 40) return 'text-yellow-600 dark:text-yellow-400';
  if (completionRate >= 20) return 'text-orange-600 dark:text-orange-400';
  if (completionRate > 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400'; // 0% gets a neutral gray
}

/**
 * Get badge variant based on completion rate with gentler thresholds
 */
export function getCompletionBadgeVariant(completionRate: number): 'default' | 'secondary' | 'destructive' {
  if (completionRate >= 70) return 'default'; // Green for good progress
  if (completionRate >= 30) return 'secondary'; // Gray for moderate progress
  return 'destructive'; // Red only for very low progress
}

/**
 * Get inline style with smooth gradient color based on completion rate
 * Creates a smooth transition with proper contrast for both themes
 */
export function getCompletionGradientStyle(completionRate: number): { color: string } {
  // Clamp the rate between 0 and 100
  const rate = Math.max(0, Math.min(100, completionRate));
  
  if (rate === 0) {
    // Special case: 0% gets neutral gray with theme awareness
    return { color: 'hsl(220, 9%, 46%)' }; // Better neutral gray
  }
  
  let hue: number;
  let saturation = 75; // Slightly higher saturation for better visibility
  let lightness: number;
  
  if (rate <= 50) {
    // 0-50%: Red (0°) to Yellow (60°)
    hue = (rate / 50) * 60;
    // Darker colors for better contrast on light backgrounds
    lightness = 40; // Darker for light theme readability
  } else {
    // 50-100%: Yellow (60°) to Green (120°)
    hue = 60 + ((rate - 50) / 50) * 60;
    // Consistent darkness for good contrast
    lightness = 35; // Even darker for green (better contrast)
  }
  
  return {
    color: `hsl(${hue}, ${saturation}%, ${lightness}%)`
  };
}

/**
 * Get inline style for badge background with smooth gradient color
 * 0% = Default theme colors, 50% = Yellow, 100% = Green
 * Follows WCAG AA contrast guidelines (4.5:1 ratio minimum)
 */
export function getCompletionBadgeStyle(completionRate: number): { 
  backgroundColor?: string; 
  color?: string; 
  border?: string;
  fontWeight?: string;
} {
  // Clamp the rate between 0 and 100
  const rate = Math.max(0, Math.min(100, completionRate));
  
  if (rate === 0) {
    // 0% uses default theme colors (no custom styling)
    return {};
  }
  
  let hue: number;
  let saturation: number;
  let backgroundLightness: number;
  let textLightness: number;
  let borderLightness: number;
  
  if (rate <= 50) {
    // 0-50%: Transition from default to Yellow (60°)
    hue = 60; // Yellow hue
    saturation = Math.min(80, (rate / 50) * 80); // Higher saturation for better visibility
    
    // Optimized for light theme contrast (WCAG AA compliant)
    backgroundLightness = Math.max(75, 90 - (rate / 50) * 15); // 90% → 75%
    textLightness = Math.min(25, 10 + (rate / 50) * 15); // 10% → 25% (very dark text)
    borderLightness = backgroundLightness - 25; // Strong border contrast
  } else {
    // 50-100%: Yellow (60°) to Green (120°)
    const progress = (rate - 50) / 50; // 0 to 1
    hue = 60 + (progress * 60); // 60° to 120°
    saturation = 80; // Higher saturation for vibrant colors
    
    // Optimized contrast for both yellow and green
    backgroundLightness = 75; // Consistent medium-light background
    textLightness = 20; // Very dark text for maximum contrast
    borderLightness = 50; // Strong, visible border
  }
  
  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${backgroundLightness}%)`,
    color: `hsl(${hue}, ${Math.min(saturation + 10, 90)}%, ${textLightness}%)`,
    border: `1px solid hsl(${hue}, ${saturation}%, ${borderLightness}%)`,
    fontWeight: '600' // Semi-bold for better readability
  };
}
