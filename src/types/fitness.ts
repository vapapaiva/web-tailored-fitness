/**
 * Fitness plan data types based on the OpenAI response structure
 */

/**
 * Date range for microcycles
 */
export interface DateRange {
  start: string; // ISO date string: "2025-01-20"
  end: string;   // ISO date string: "2025-01-26"
}

export interface ExerciseSet {
  reps: number;
  weight?: number;
  duration?: number;
  restTime: number;
  notes?: string;
  volumeType?: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance' | 'completion';
  weightUnit?: 'kg' | 'lb';
  distanceUnit?: 'km' | 'mi' | 'm';
  volumeRowId?: string; // Groups sets into volume rows
  completed?: boolean; // Track if this set is completed
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  instructions: string;
  sets: ExerciseSet[];
}

export interface CheckInFlag {
  flag: string;
  question: string;
  action?: string;
}

export interface WorkoutCheckIns {
  greenFlags: CheckInFlag[];
  redFlags: CheckInFlag[];
}

export interface Workout {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  estimatedDuration: number;
  focus: string;
  value: string;
  exercises: Exercise[];
  checkIns: WorkoutCheckIns;
  // Workout execution status
  status: 'planned' | 'completed';
  completedAt?: string;
  actualDuration?: number;
  notes?: string;
  // Date assignment (calculated from dayOfWeek + week start date)
  date?: string; // ISO date string: "2025-01-20"
  // Ranking system for drag & drop
  rank: string;
  // Mutation tracking
  lastMutation?: {
    clientId: string;
    mutationId: string;
    timestamp: number;
  };
}

export interface Microcycle {
  id: string;
  week: number;
  focus: string;
  value: string;
  workouts: Workout[];
  weeklyCheckIns: WorkoutCheckIns;
  // Microcycle completion tracking
  status: 'active' | 'completed';
  completedAt?: string;
  completedWorkouts: CompletedWorkout[];
  weeklyNotes?: string;
  // Date range for the microcycle (REQUIRED for week completion logic)
  dateRange: DateRange;
}

export interface Mesocycle {
  id: string;
  name: string;
  durationWeeks: number;
  focus: string;
  value: string;
  successIndicators: string[];
}

export interface Macrocycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  focus: string;
  value: string;
  durationWeeks: number;
  successIndicators: string[];
  promisedOutcome: string;
  mesocycles: Mesocycle[];
}

export interface GenerationMetadata {
  generatedAt: string;
  regenerationCount: number;
  llmModel: string;
}

export interface FitnessPlan {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'approved' | 'active';
  macrocycle: Macrocycle;
  currentMicrocycle: Microcycle;
  generationMetadata: GenerationMetadata;
  userFeedback: string[];
}

export interface FitnessPlanResponse {
  plan: FitnessPlan;
  explanation: string;
  generated_at: string;
}

/**
 * User progress tracking types
 */
export interface CompletedSet {
  reps: number;
  weight?: number;
  duration?: number;
  notes?: string;
  completed: boolean;
}

export interface CompletedExercise {
  exerciseId: string;
  name: string;
  sets: CompletedSet[];
  notes?: string;
}

export interface CompletedWorkout {
  workoutId: string;
  name: string;
  date: string;
  exercises: CompletedExercise[];
  duration?: number;
  notes?: string;
  completed: boolean;
}

export interface WeeklyProgress {
  week: number;
  startDate: string;
  endDate: string;
  workouts: CompletedWorkout[];
  weeklyNotes?: string;
}

/**
 * Exercise parsing types
 */
export interface ParsedSet {
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  distance?: number;
  unit?: string;
}

export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  instructions?: string;
}

/**
 * Generation request types
 */
export interface GenerationRequest {
  userProfile: Record<string, any>;
  customPrompt?: string;
  currentDate: string;
  previousProgress?: WeeklyProgress[];
  currentPlan?: FitnessPlan;
  weekDateRange?: DateRange; // Date range for the week being generated
  workoutHistory?: WorkoutHistoryDocument[]; // Historical workout data for AI context
  gapContext?: GapContext; // Context for gap recovery generation
}

/**
 * Workout history storage types
 */
export interface WorkoutHistoryDocument {
  weekId: string;
  weekNumber: number;
  weekFocus: string;
  dateRange: DateRange;
  completedWorkouts: CompletedWorkout[];
  weeklyReflection: string;
  completedAt: string; // ISO timestamp
  planSnapshot: {
    macrocycleId: string;
    mesocycleId: string;
    microcycleId: string;
  };
}

/**
 * Gap recovery types
 */
export interface GapContext {
  gapDurationDays: number;
  gapActivities?: string;
  gapWorkouts: CompletedWorkout[];
  lastCompletedMicrocycle?: {
    week: number;
    dateRange: DateRange;
    completedWorkouts: CompletedWorkout[];
  };
}

export interface TrainingGap {
  gapId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  activities?: string;
  workouts: CompletedWorkout[];
  resumedAt: string;
}
