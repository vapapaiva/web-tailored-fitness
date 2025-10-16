/**
 * AI Coach types - Decoupled fitness planning system
 * Separate from workout tracking, integrates with WorkoutsStore
 */

import type { DateRange } from './fitness';

/**
 * AI Plan status
 */
export type AIPlanStatus = 'goals-draft' | 'goals-approved' | 'active' | 'paused';

/**
 * Macrocycle goal - 6-month overarching fitness goal
 */
export interface MacrocycleGoal {
  id: string;
  name: string;
  value: string; // Description/summary
  durationWeeks: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  successIndicators: string[];
  promisedOutcome: string;
}

/**
 * Mesocycle milestone - Phase within macrocycle (typically 4-6 phases)
 */
export interface MesocycleMilestone {
  id: string;
  name: string;
  durationWeeks: number;
  focus: string;
  value: string; // Description/summary
  successIndicators: string[];
}

/**
 * Microcycle reference - References workouts in WorkoutsStore
 */
export interface MicrocycleReference {
  id: string;
  week: number;
  focus: string;
  value: string; // Description/summary
  dateRange: DateRange;
  workoutIds: string[]; // References to WorkoutDocument IDs in WorkoutsStore
  status: 'active' | 'completed';
  completedAt?: string; // ISO timestamp
  weeklyReflection?: string;
}

/**
 * Generation metadata
 */
export interface GenerationMetadata {
  generatedAt: string; // ISO timestamp
  regenerationCount: number;
  llmModel: string;
}

/**
 * AI Plan - Complete AI Coach plan structure
 */
export interface AIPlan {
  id: string;
  userId: string;
  
  // Phase 1: Fitness Goals
  macrocycleGoal: MacrocycleGoal;
  mesocycleMilestones: MesocycleMilestone[];
  
  // Phase 2: Current Microcycle (optional until workouts generated)
  currentMicrocycle?: MicrocycleReference;
  
  // History
  completedMicrocycles: Array<{
    id: string;
    week: number;
    completedAt: string;
    workoutIds: string[];
    weeklyReflection: string;
  }>;
  
  // Status and metadata
  status: AIPlanStatus;
  generationMetadata: GenerationMetadata;
  userFeedback: string[]; // History of user feedback for regenerations
  goalsLastModified?: string; // ISO timestamp of last manual goal edit
  showRegenerationSuggestion?: boolean; // Show banner to regenerate workouts after manual goal edit
  
  // Timestamps
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Goals generation request (Phase 1)
 */
export interface GoalsGenerationRequest {
  userProfile: Record<string, any>;
  fitnessGoalInput: string; // Answer to fitness goal question from profile
  customInput: string; // User's detailed description
  currentDate: string; // ISO date
}

/**
 * Goals generation response from AI (Phase 1)
 */
export interface GoalsGenerationResponse {
  macrocycleGoal: MacrocycleGoal;
  mesocycleMilestones: MesocycleMilestone[];
  explanation: string;
  generated_at: string;
}

/**
 * Microcycle generation request (Phase 2)
 */
export interface MicrocycleGenerationRequest {
  userProfile: Record<string, any>;
  macrocycleGoal: MacrocycleGoal;
  mesocycleMilestones: MesocycleMilestone[];
  currentDate: string;
  weekNumber: number;
  weekDateRange: DateRange;
  previousMicrocycle?: {
    planned: {
      week: number;
      focus: string;
      dateRange: DateRange;
      workouts: any[]; // Simplified workout data
    };
    actual: {
      completedWorkouts: any[];
      weeklyReflection: string;
      completionRate: number;
    };
  };
  workoutHistory?: any[]; // Historical workout data
  customFeedback?: string; // User feedback for regeneration
}

/**
 * Microcycle generation response from AI (Phase 2)
 */
export interface MicrocycleGenerationResponse {
  microcycle: {
    id: string;
    week: number;
    focus: string;
    value: string;
    workouts: any[]; // Workout data to create WorkoutDocument objects
  };
  explanation: string;
  generated_at: string;
}

/**
 * Helper type for partial updates
 */
export type AIPlanUpdate = Partial<Omit<AIPlan, 'id' | 'userId' | 'createdAt'>>;

/**
 * Helper function to check if goals are approved
 */
export function areGoalsApproved(plan: AIPlan): boolean {
  return plan.status === 'goals-approved' || plan.status === 'active';
}

/**
 * Helper function to check if plan is active
 */
export function isPlanActive(plan: AIPlan): boolean {
  return plan.status === 'active';
}

/**
 * Helper function to check if current week can be completed
 */
export function canCompleteWeek(plan: AIPlan): boolean {
  return plan.status === 'active' && 
         !!plan.currentMicrocycle && 
         plan.currentMicrocycle.status === 'active';
}

