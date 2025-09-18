/**
 * Fitness plan data types based on the OpenAI response structure
 */

export interface ExerciseSet {
  reps: number;
  weight?: number;
  duration?: number;
  restTime: number;
  notes?: string;
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
}

export interface Microcycle {
  id: string;
  week: number;
  focus: string;
  value: string;
  workouts: Workout[];
  weeklyCheckIns: WorkoutCheckIns;
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
}
