/**
 * Workout History Service
 * 
 * Manages persistence and retrieval of completed workout history.
 * History is used for:
 * - AI generation of next week's plan
 * - Progress tracking and analytics
 * - Gap recovery analysis
 */

import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import type { Microcycle, CompletedWorkout, WorkoutHistoryDocument, FitnessPlan } from '@/types/fitness';
import { sanitizeWorkoutForFirebase } from './firebaseUtils';

/**
 * Save a completed week's workout history
 * @param userId - User ID
 * @param microcycle - Completed microcycle
 * @param weeklyReflection - User's weekly reflection notes
 * @param planSnapshot - Reference to the plan context
 */
export async function saveWorkoutHistory(
  userId: string,
  microcycle: Microcycle,
  weeklyReflection: string,
  planSnapshot: {
    macrocycleId: string;
    mesocycleId: string;
    microcycleId: string;
  }
): Promise<void> {
  if (!microcycle.dateRange) {
    throw new Error('Microcycle must have a date range to save history');
  }

  // Generate unique week ID with timestamp to prevent overwrites: "2025-01-20_week-1_1704067200000"
  const timestamp = Date.now();
  const weekId = `${microcycle.dateRange.start}_week-${microcycle.week}_${timestamp}`;
  const historyDocRef = doc(db, 'users', userId, 'workoutHistory', weekId);

  const historyDoc: WorkoutHistoryDocument = {
    weekId,
    weekNumber: microcycle.week,
    weekFocus: microcycle.focus,
    dateRange: microcycle.dateRange,
    completedWorkouts: microcycle.completedWorkouts || [],
    weeklyReflection,
    completedAt: new Date().toISOString(),
    planSnapshot,
  };

  // Save to Firebase with sanitization
  await setDoc(historyDocRef, sanitizeWorkoutForFirebase({
    ...historyDoc,
    savedAt: serverTimestamp()
  }));

  console.log('[Workout History] Saved:', weekId, 'with', historyDoc.completedWorkouts.length, 'completed workouts');
}

/**
 * Get workout history for a user
 * @param userId - User ID
 * @param options - Query options
 * @returns Array of workout history documents
 */
export async function getWorkoutHistory(
  userId: string,
  options: {
    limit?: number;
    startAfter?: string; // ISO date
    endBefore?: string; // ISO date
  } = {}
): Promise<WorkoutHistoryDocument[]> {
  const historyCollection = collection(db, 'users', userId, 'workoutHistory');
  
  let q = query(
    historyCollection,
    orderBy('completedAt', 'desc')
  );

  // Apply date filters if provided
  if (options.startAfter) {
    q = query(q, where('dateRange.end', '>', options.startAfter));
  }
  
  if (options.endBefore) {
    q = query(q, where('dateRange.end', '<', options.endBefore));
  }

  // Apply limit
  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  const history: WorkoutHistoryDocument[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    
    // Convert Firestore Timestamps to ISO strings
    if (data.completedAt && data.completedAt instanceof Timestamp) {
      data.completedAt = data.completedAt.toDate().toISOString();
    }

    history.push(data as WorkoutHistoryDocument);
  });

  console.log('[Workout History] Retrieved:', history.length, 'weeks');
  return history;
}

/**
 * Get the most recent completed week
 * @param userId - User ID
 * @returns Most recent workout history document, or null if none exists
 */
export async function getLastCompletedWeek(userId: string): Promise<WorkoutHistoryDocument | null> {
  const history = await getWorkoutHistory(userId, { limit: 1 });
  return history.length > 0 ? history[0] : null;
}

/**
 * Get workout history for a specific date range
 * Useful for gap analysis
 * @param userId - User ID
 * @param startDate - Start date (ISO)
 * @param endDate - End date (ISO)
 * @returns Array of workout history documents in the range
 */
export async function getHistoryInDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WorkoutHistoryDocument[]> {
  return getWorkoutHistory(userId, {
    startAfter: startDate,
    endBefore: endDate
  });
}

/**
 * Check if user has any workout history
 * @param userId - User ID
 * @returns true if user has completed at least one week
 */
export async function hasWorkoutHistory(userId: string): Promise<boolean> {
  const history = await getWorkoutHistory(userId, { limit: 1 });
  return history.length > 0;
}

/**
 * Get total number of completed workouts across all history
 * @param userId - User ID
 * @returns Total count of completed workouts
 */
export async function getTotalCompletedWorkouts(userId: string): Promise<number> {
  const history = await getWorkoutHistory(userId);
  return history.reduce((total, week) => total + week.completedWorkouts.length, 0);
}

/**
 * Convert microcycle workouts to CompletedWorkout format
 * Used when saving history from a microcycle
 * @param microcycle - Microcycle with workouts
 * @returns Array of completed workouts
 */
export function extractCompletedWorkouts(microcycle: Microcycle): CompletedWorkout[] {
  return microcycle.workouts
    .filter(workout => workout.status === 'completed')
    .map(workout => ({
      workoutId: workout.id,
      name: workout.name,
      date: workout.date || workout.completedAt || new Date().toISOString(),
      exercises: workout.exercises.map(exercise => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets.map(set => ({
          reps: set.reps,
          weight: set.weight,
          duration: set.duration,
          notes: set.notes,
          completed: set.completed || false
        })),
        notes: exercise.instructions
      })),
      duration: workout.actualDuration || workout.estimatedDuration,
      notes: workout.notes,
      completed: true
    }));
}

