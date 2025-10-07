/**
 * Migration utilities for backward compatibility with existing fitness plans
 * Handles adding date ranges to plans that don't have them
 */

import type { FitnessPlan, Microcycle } from '../types/fitness';
import { calculateInitialWeekRange, calculateDateFromDayOfWeek } from './dateUtils';

/**
 * Check if a microcycle has a valid date range
 * @param microcycle - The microcycle to check
 * @returns true if microcycle has a valid date range
 */
export function hasDateRange(microcycle: Microcycle): boolean {
  return !!(microcycle as any).dateRange?.start && !!(microcycle as any).dateRange?.end;
}

/**
 * Migrate a microcycle to include date ranges
 * Uses current date to calculate appropriate date range
 * @param microcycle - The microcycle to migrate
 * @returns Microcycle with date range added
 */
export function migrateMicrocycleWithDates(microcycle: Microcycle): Microcycle {
  // If already has date range, return as-is
  if (hasDateRange(microcycle)) {
    return microcycle;
  }
  
  // Calculate date range based on current date
  const dateRange = calculateInitialWeekRange(new Date());
  
  // Assign dates to all workouts based on dayOfWeek
  const workoutsWithDates = microcycle.workouts.map(workout => ({
    ...workout,
    date: calculateDateFromDayOfWeek(workout.dayOfWeek, dateRange.start)
  }));
  
  return {
    ...microcycle,
    dateRange,
    workouts: workoutsWithDates
  };
}

/**
 * Migrate an entire fitness plan to include date ranges
 * This is the main migration function to use when loading plans
 * @param plan - The fitness plan to migrate
 * @returns Plan with date ranges added to current microcycle
 */
export function migratePlanWithDates(plan: FitnessPlan): FitnessPlan {
  // If current microcycle already has date range, return as-is
  if (hasDateRange(plan.currentMicrocycle)) {
    return plan;
  }
  
  console.log('[Migration] Adding date ranges to existing plan:', plan.id);
  
  // Migrate the current microcycle
  const migratedMicrocycle = migrateMicrocycleWithDates(plan.currentMicrocycle);
  
  return {
    ...plan,
    currentMicrocycle: migratedMicrocycle
  };
}

/**
 * Check if a plan needs migration
 * @param plan - The fitness plan to check
 * @returns true if plan needs migration
 */
export function needsMigration(plan: FitnessPlan | null): boolean {
  if (!plan) return false;
  return !hasDateRange(plan.currentMicrocycle);
}

/**
 * Get migration status for a plan
 * Useful for debugging and logging
 * @param plan - The fitness plan to check
 * @returns Object with migration status details
 */
export function getMigrationStatus(plan: FitnessPlan | null): {
  needsMigration: boolean;
  hasDateRange: boolean;
  workoutsWithDates: number;
  totalWorkouts: number;
} {
  if (!plan) {
    return {
      needsMigration: false,
      hasDateRange: false,
      workoutsWithDates: 0,
      totalWorkouts: 0
    };
  }
  
  const hasDR = hasDateRange(plan.currentMicrocycle);
  const totalWorkouts = plan.currentMicrocycle.workouts.length;
  const workoutsWithDates = plan.currentMicrocycle.workouts.filter(w => !!w.date).length;
  
  return {
    needsMigration: !hasDR,
    hasDateRange: hasDR,
    workoutsWithDates,
    totalWorkouts
  };
}
