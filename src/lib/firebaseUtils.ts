/**
 * Firebase utility functions for data sanitization and sync
 */

/**
 * Recursively removes undefined values from an object to prevent Firebase errors
 * Firebase doesn't allow undefined values - they must be omitted entirely
 */
export function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item)) as T;
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    
    return cleaned as T;
  }

  return obj;
}

/**
 * Sanitizes workout data before Firebase sync
 * Ensures all ExerciseSet objects have no undefined values
 */
export function sanitizeWorkoutForFirebase<T>(data: T): T {
  return removeUndefinedValues(data);
}
