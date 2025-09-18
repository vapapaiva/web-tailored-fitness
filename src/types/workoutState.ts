/**
 * Workout execution and progress tracking types
 */

export type WorkoutStatus = 'planned' | 'in-progress' | 'completed';

export interface WorkoutProgress {
  workoutId: string;
  status: WorkoutStatus;
  startedAt?: string;
  completedAt?: string;
  exerciseProgress: ExerciseProgress[];
  notes?: string;
}

export interface ExerciseProgress {
  exerciseId: string;
  completed: boolean;
  completedSets: SetProgress[];
  notes?: string;
}

export interface SetProgress {
  setIndex: number;
  completed: boolean;
  actualReps?: number;
  actualWeight?: number;
  actualDuration?: number;
  notes?: string;
}

export interface WeeklyWorkoutState {
  weekId: string;
  workoutProgress: WorkoutProgress[];
}
