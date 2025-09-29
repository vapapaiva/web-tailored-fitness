/**
 * Improved volume calculations based on fitness science and real app approaches
 * Uses relative strength principles instead of linear weight scaling
 */

import type { Exercise, ExerciseSet } from '@/types/fitness';
import { findExerciseDefinition } from './exerciseDatabase';

export interface ImprovedVolumeMetrics {
  // Relative volume (accounts for bodyweight and difficulty scaling)
  totalRelativeVolume: number;
  completedRelativeVolume: number;
  volumeUnit: string;
  
  // Raw metrics for comparison
  totalRawVolume: number;
  completedRawVolume: number;
  
  // Completion tracking
  completionRate: number;
  totalSets: number;
  completedSets: number;
  
  // Additional metrics
  totalReps?: number;
  completedReps?: number;
  averageIntensity?: number; // Average relative difficulty per rep
  maxIntensity?: number; // Highest relative difficulty achieved
}

/**
 * Volume calculation coefficients based on exercise science
 */
const VOLUME_COEFFICIENTS = {
  // External weight difficulty scaling (diminishing returns)
  externalWeight: 0.12, // Each kg adds 12% difficulty (not 100%!)
  
  // Bodyweight baseline multipliers by exercise type
  bodyweightMultipliers: {
    'pull-ups': 1.0, // Pull-ups use full bodyweight
    'push-ups': 0.64, // Push-ups use ~64% of bodyweight
    'squats': 1.0, // Bodyweight squats use full weight
    'dips': 0.77, // Dips use ~77% of bodyweight
    'pistol-squats': 1.0, // Single leg = full bodyweight
    'handstand-push-ups': 0.9, // ~90% bodyweight
    'default': 0.7 // Conservative estimate for unknown exercises
  },
  
  // Duration and distance scaling
  durationIntensity: 1.0, // 1 minute = 1 unit
  distanceIntensity: 1.0, // 1km = 1 unit (direct mapping)
};

/**
 * Get bodyweight multiplier for an exercise
 */
function getBodyweightMultiplier(exerciseName: string): number {
  const name = exerciseName.toLowerCase();
  
  // Check for specific exercise patterns
  if (name.includes('pull') && name.includes('up')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['pull-ups'];
  if (name.includes('push') && name.includes('up')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['push-ups'];
  if (name.includes('squat')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['squats'];
  if (name.includes('dip')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['dips'];
  if (name.includes('pistol')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['pistol-squats'];
  if (name.includes('handstand')) return VOLUME_COEFFICIENTS.bodyweightMultipliers['handstand-push-ups'];
  
  return VOLUME_COEFFICIENTS.bodyweightMultipliers['default'];
}

/**
 * Calculate relative volume for a single set using improved methodology
 */
export function calculateImprovedSetVolume(
  set: ExerciseSet, 
  exerciseName: string, 
  userBodyweight: number = 75 // Default 75kg, should come from user profile
): number {
  // Prioritize the set's volumeType over database lookup for accuracy
  const definition = findExerciseDefinition(exerciseName);
  const volumeType = set.volumeType || definition?.volumeCalculation || 'reps-only';
  
  switch (volumeType) {
    case 'sets-reps-weight': {
      // Improved formula: (Bodyweight × Multiplier + ExternalWeight × Coefficient) × Reps
      const bodyweightMultiplier = getBodyweightMultiplier(exerciseName);
      const effectiveBodyweight = userBodyweight * bodyweightMultiplier;
      
      if (set.weight && set.weight > 0) {
        // Convert weight to kg if needed
        const weightInKg = set.weightUnit === 'lb' ? set.weight * 0.453592 : set.weight;
        const externalWeightContribution = weightInKg * VOLUME_COEFFICIENTS.externalWeight;
        const totalEffectiveWeight = effectiveBodyweight + externalWeightContribution;
        return totalEffectiveWeight * set.reps;
      } else {
        // Pure bodyweight
        return effectiveBodyweight * set.reps;
      }
    }
      
    case 'sets-reps':
    case 'reps-only': {
      // For bodyweight exercises, account for partial bodyweight usage
      const multiplier = getBodyweightMultiplier(exerciseName);
      return userBodyweight * multiplier * set.reps;
    }
      
    case 'duration': {
      // Duration in minutes with intensity scaling
      const durationMinutes = set.duration ? set.duration / 60 : 0;
      return durationMinutes * VOLUME_COEFFICIENTS.durationIntensity;
    }
      
    case 'distance':
      // Distance with intensity scaling
      if (set.notes) {
        const distanceMatch = set.notes.match(/([0-9]+(?:\.[0-9]+)?)(km|mi|m)/);
        if (distanceMatch) {
          const value = parseFloat(distanceMatch[1]);
          const unit = distanceMatch[2];
          
          let distanceInKm = 0;
          switch (unit) {
            case 'km': distanceInKm = value; break;
            case 'mi': distanceInKm = value * 1.60934; break;
            case 'm': distanceInKm = value / 1000; break;
          }
          
          return distanceInKm * VOLUME_COEFFICIENTS.distanceIntensity;
        }
      }
      return 0;
      
    case 'completion':
      // Simple completion tracking
      return set.completed ? 1 : 0;
      
    default:
      // Fallback to bodyweight-adjusted reps
      return userBodyweight * 0.5 * set.reps;
  }
}

/**
 * Calculate comprehensive improved volume metrics for an exercise
 */
export function calculateImprovedExerciseVolume(
  exercise: Exercise, 
  userBodyweight: number = 75
): ImprovedVolumeMetrics {
  const definition = findExerciseDefinition(exercise.name);
  
  let totalRelativeVolume = 0;
  let completedRelativeVolume = 0;
  let totalRawVolume = 0;
  let completedRawVolume = 0;
  const totalSets = exercise.sets.length;
  let completedSets = 0;
  let totalReps = 0;
  let completedReps = 0;
  let intensitySum = 0;
  let maxIntensity = 0;
  
  // Determine the primary volume type from the sets (for mixed exercises)
  const volumeTypes = exercise.sets.map(set => set.volumeType || 'reps-only');
  const primaryVolumeType = volumeTypes[0] || definition?.volumeCalculation || 'reps-only';
  
  exercise.sets.forEach(set => {
    const relativeVolume = calculateImprovedSetVolume(set, exercise.name, userBodyweight);
    const rawVolume = (set.weight || 0) * set.reps; // Old linear calculation for comparison
    
    totalRelativeVolume += relativeVolume;
    totalRawVolume += rawVolume;
    
    if (set.completed) {
      completedRelativeVolume += relativeVolume;
      completedRawVolume += rawVolume;
      completedSets++;
      completedReps += set.reps;
      
      // Track intensity (relative difficulty per rep)
      const intensity = relativeVolume / set.reps;
      intensitySum += intensity;
      maxIntensity = Math.max(maxIntensity, intensity);
    }
    
    totalReps += set.reps;
  });
  
  const completionRate = totalRelativeVolume > 0 ? (completedRelativeVolume / totalRelativeVolume) * 100 : 0;
  const averageIntensity = completedSets > 0 ? intensitySum / completedSets : 0;
  
  // Determine volume unit based on primary exercise type
  let volumeUnit = '';
  switch (primaryVolumeType) {
    case 'sets-reps-weight':
    case 'sets-reps':
    case 'reps-only':
      volumeUnit = 'relative units';
      break;
    case 'duration':
      volumeUnit = 'minutes';
      break;
    case 'distance':
      volumeUnit = 'km';
      break;
    case 'completion':
      volumeUnit = 'completions';
      break;
    default:
      volumeUnit = 'units';
  }
  
  return {
    totalRelativeVolume,
    completedRelativeVolume,
    volumeUnit,
    totalRawVolume,
    completedRawVolume,
    completionRate,
    totalSets,
    completedSets,
    totalReps: primaryVolumeType === 'reps-only' || primaryVolumeType === 'sets-reps' || primaryVolumeType === 'sets-reps-weight' ? totalReps : undefined,
    completedReps: primaryVolumeType === 'reps-only' || primaryVolumeType === 'sets-reps' || primaryVolumeType === 'sets-reps-weight' ? completedReps : undefined,
    averageIntensity,
    maxIntensity
  };
}

/**
 * Format improved volume for display
 */
export function formatImprovedVolume(volume: number, unit: string): string {
  switch (unit) {
    case 'relative units':
      return `${Math.round(volume)} units`;
    case 'minutes':
      if (volume >= 60) {
        const hours = Math.floor(volume / 60);
        const minutes = Math.round(volume % 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
      return `${Math.round(volume)}m`;
    case 'km':
      return volume >= 1 ? `${volume.toFixed(1)}km` : `${Math.round(volume * 1000)}m`;
    case 'completions':
      return `${Math.round(volume)}`;
    default:
      return `${Math.round(volume)} ${unit}`;
  }
}

/**
 * Compare old vs new volume calculation methods
 */
export function compareVolumeCalculations(exercise: Exercise, userBodyweight: number = 75): {
  oldMethod: { volume: number; description: string };
  newMethod: { volume: number; description: string };
  improvement: string;
} {
  const oldVolume = exercise.sets.reduce((sum, set) => {
    return sum + (set.weight || 0) * set.reps;
  }, 0);
  
  const newMetrics = calculateImprovedExerciseVolume(exercise, userBodyweight);
  
  return {
    oldMethod: {
      volume: oldVolume,
      description: `Linear: ${oldVolume} kg×reps`
    },
    newMethod: {
      volume: newMetrics.completedRelativeVolume,
      description: `Relative: ${Math.round(newMetrics.completedRelativeVolume)} units`
    },
    improvement: newMetrics.completedRelativeVolume > oldVolume 
      ? `New method accounts for bodyweight contribution (+${Math.round(((newMetrics.completedRelativeVolume - oldVolume) / Math.max(oldVolume, 1)) * 100)}%)`
      : `New method provides more realistic scaling (-${Math.round(((oldVolume - newMetrics.completedRelativeVolume) / Math.max(oldVolume, 1)) * 100)}%)`
  };
}
