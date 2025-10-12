/**
 * Workout Completion Logic - Determines behavior when workouts are completed
 * Handles special logic for current week workouts staying visible
 */

import type { WorkoutDocument } from '@/types/workout';
import { isDateInCurrentWeek, isDateInPast } from '@/lib/dateUtils';

/**
 * Destination for a completed workout
 */
export type CompletedWorkoutDestination = 'stay-in-place' | 'move-to-done';

/**
 * Determines where a completed workout should go based on its date
 * 
 * Rules:
 * - No date → User should not be able to complete (needs date first)
 * - Current week → Stay in Current Week view until week passes
 * - Past or Later → Move to Done section immediately
 * 
 * @param workout - The workout to check
 * @returns Destination for the completed workout
 */
export function getCompletedWorkoutDestination(
  workout: WorkoutDocument
): CompletedWorkoutDestination {
  // No date → shouldn't be completable, but if completed, move to Done
  if (!workout.date) {
    console.warn('[Completion Logic] Workout without date was completed:', workout.id);
    return 'move-to-done';
  }

  // Check if workout date is in current week
  if (isDateInCurrentWeek(workout.date)) {
    // Current week → stay visible in Current Week section
    return 'stay-in-place';
  } else {
    // Past or Later → move to Done immediately
    return 'move-to-done';
  }
}

/**
 * Check if a workout can be completed
 * Workouts without dates should not be completable until a date is assigned
 * 
 * @param workout - The workout to check
 * @returns true if workout can be marked as complete
 */
export function canCompleteWorkout(workout: WorkoutDocument): boolean {
  // Must have a date to be completed
  return !!workout.date;
}

/**
 * Get user-friendly message for why workout can't be completed
 * 
 * @param workout - The workout to check
 * @returns Error message or null if can be completed
 */
export function getCompletionBlockerMessage(workout: WorkoutDocument): string | null {
  if (!workout.date) {
    return 'Please assign a date to this workout before marking it as complete';
  }
  
  return null;
}

/**
 * Determines if a completed workout should be visible in a specific section
 * Used for filtering logic in subsection components
 * 
 * @param workout - The workout to check
 * @param section - The section to check visibility for
 * @returns true if workout should be visible in the section
 */
export function isWorkoutVisibleInSection(
  workout: WorkoutDocument,
  section: 'past' | 'current-week' | 'later' | 'without-date' | 'done'
): boolean {
  const isCompleted = workout.status === 'completed';
  const hasDate = !!workout.date;
  
  switch (section) {
    case 'past':
      // Past: Has date, in the past, NOT completed
      return hasDate && isDateInPast(workout.date!) && !isCompleted;
      
    case 'current-week':
      // Current Week: Has date, in current week (regardless of completion status)
      return hasDate && isDateInCurrentWeek(workout.date!);
      
    case 'later':
      // Later: Has date, beyond current week, NOT completed
      return hasDate && !isDateInCurrentWeek(workout.date!) && !isDateInPast(workout.date!) && !isCompleted;
      
    case 'without-date':
      // Without Date: No date, NOT completed
      return !hasDate && !isCompleted;
      
    case 'done':
      // Done: Completed status
      return isCompleted;
      
    default:
      return false;
  }
}

/**
 * Moves completed workouts from previous weeks to Done section
 * This should be called periodically (e.g., on app load, weekly cron)
 * 
 * @returns Array of workout IDs that were archived
 */
export async function archiveCompletedWorkoutsFromLastWeek(
  workouts: WorkoutDocument[]
): Promise<string[]> {
  const archivedIds: string[] = [];
  
  workouts.forEach(workout => {
    // If workout is completed, has a date, and date is NOT in current week
    if (
      workout.status === 'completed' && 
      workout.date && 
      !isDateInCurrentWeek(workout.date)
    ) {
      // This workout should be in Done section only
      // (The filtering in store getters handles this automatically)
      archivedIds.push(workout.id);
    }
  });
  
  console.log('[Archive] Found', archivedIds.length, 'workouts to archive from previous weeks');
  return archivedIds;
}

