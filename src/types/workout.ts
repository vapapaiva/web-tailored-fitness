/**
 * Workout types for standalone workout tracking (decoupled from AI fitness plan)
 * These types enable workout tracking independent of AI Coach
 */

import type { Exercise, ExerciseSet, WorkoutCheckIns, DateRange } from './fitness';

/**
 * Source of the workout
 */
export type WorkoutSource = 'manual' | 'ai-coach';

/**
 * Workout status for tracking
 */
export type WorkoutStatus = 'planned' | 'in-progress' | 'completed';

/**
 * AI Coach context for tracking which microcycle a workout belongs to
 */
export interface AICoachContext {
  microcycleId: string;
  weekNumber: number;
}

/**
 * Workout document - standalone workout record
 * This extends the existing Workout type with additional fields for standalone tracking
 */
export interface WorkoutDocument {
  // Core identification
  id: string;
  name: string;
  
  // Scheduling
  date?: string; // ISO date string (YYYY-MM-DD) or undefined if no date assigned
  dayOfWeek?: number; // 0=Sunday, 1=Monday, etc. (computed from date)
  
  // Status tracking
  status: WorkoutStatus;
  completedAt?: string; // ISO timestamp
  
  // Workout details
  type: string; // e.g., 'strength', 'cardio', 'hybrid'
  focus: string; // e.g., 'Upper Body', 'HIIT', 'Full Body'
  value: string; // Description/summary
  exercises: Exercise[];
  checkIns: WorkoutCheckIns;
  
  // Duration
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  
  // Notes
  notes?: string;
  
  // Source tracking
  source: WorkoutSource; // Track if created manually or by AI Coach
  aiCoachContext?: AICoachContext; // Set if source === 'ai-coach'
  
  // Ordering
  rank: string; // LexoRank for drag & drop ordering within days
  
  // Timestamps
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  
  // Mutation tracking for real-time sync
  lastMutation?: {
    clientId: string;
    mutationId: string;
    timestamp: number;
  };
}

/**
 * Stats aggregation for completed workouts
 */
export interface WorkoutStats {
  // Counts
  totalWorkouts: number;
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  
  // Volume
  totalVolume: number; // weight * reps (kg or lb depending on user preference)
  totalDistance: number; // km or mi
  totalDuration: number; // minutes
  
  // Time
  totalTime: number; // Total minutes spent on workouts
  averageWorkoutDuration: number; // minutes
  
  // Breakdown
  exerciseTypeBreakdown: Record<string, number>; // { 'strength': 10, 'cardio': 5, ... }
  muscleGroupBreakdown: Record<string, number>; // { 'chest': 8, 'legs': 12, ... }
  
  // Weekly stats
  weeklyBreakdown: Array<{
    weekStart: string; // ISO date string (Monday)
    weekEnd: string; // ISO date string (Sunday)
    workoutsPlanned: number;
    workoutsCompleted: number;
    completionRate: number; // percentage (0-100)
  }>;
  
  // Current streak
  currentStreak: number; // days with at least one completed workout
  longestStreak: number; // longest streak in days
}

/**
 * Exercise progress tracking for specific exercises
 */
export interface ExerciseProgress {
  exerciseName: string;
  category: string;
  muscleGroups: string[];
  
  // Data points over time
  dataPoints: Array<{
    date: string; // ISO date string
    workoutId: string;
    sets: number;
    reps: number;
    volume: number; // weight * reps
    maxWeight?: number; // heaviest single set
    totalReps: number; // total reps across all sets
    duration?: number; // for duration-based exercises
    distance?: number; // for distance-based exercises
  }>;
  
  // Summary
  totalWorkouts: number;
  firstSeen: string; // ISO date string
  lastSeen: string; // ISO date string
  personalRecords: {
    maxWeight?: { value: number; unit: string; date: string };
    maxReps?: { value: number; date: string };
    maxVolume?: { value: number; date: string };
    maxDistance?: { value: number; unit: string; date: string };
    minDuration?: { value: number; date: string }; // best time for timed exercises
  };
}

/**
 * Workout filter options
 */
export interface WorkoutFilters {
  status?: WorkoutStatus | WorkoutStatus[];
  source?: WorkoutSource | WorkoutSource[];
  dateRange?: DateRange;
  hasDate?: boolean; // true = has date, false = no date, undefined = all
}

/**
 * Helper type for workout updates (partial)
 */
export type WorkoutUpdate = Partial<Omit<WorkoutDocument, 'id' | 'createdAt'>>;

/**
 * Helper function to check if a workout is from AI Coach
 */
export function isAICoachWorkout(workout: WorkoutDocument): boolean {
  return workout.source === 'ai-coach';
}

/**
 * Helper function to check if a workout is completed
 */
export function isCompletedWorkout(workout: WorkoutDocument): boolean {
  return workout.status === 'completed';
}

/**
 * Helper function to check if a workout is planned
 */
export function isPlannedWorkout(workout: WorkoutDocument): boolean {
  return workout.status === 'planned' || workout.status === 'in-progress';
}

