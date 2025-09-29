/**
 * Advanced volume calculations for different exercise types
 * Provides proper volume tracking that considers weight, reps, duration, distance
 */

import type { Exercise, ExerciseSet } from '@/types/fitness';
import { findExerciseDefinition } from './exerciseDatabase';

export interface VolumeMetrics {
  // Raw volume (weight × reps × sets)
  totalVolume: number;
  volumeUnit: string;
  
  // Completed volume (only completed sets)
  completedVolume: number;
  completionRate: number;
  
  // Set-based metrics
  totalSets: number;
  completedSets: number;
  
  // Additional metrics based on exercise type
  totalReps?: number;
  completedReps?: number;
  totalDuration?: number; // in seconds
  completedDuration?: number;
  totalDistance?: number; // in km
  completedDistance?: number;
}

/**
 * Calculate volume for a single set based on exercise type
 */
export function calculateSetVolume(set: ExerciseSet, exerciseName: string): number {
  const definition = findExerciseDefinition(exerciseName);
  const volumeType = definition?.volumeCalculation || 'reps-only';
  
  switch (volumeType) {
    case 'weight-reps':
      // Volume = Weight × Reps (standard strength training volume)
      if (set.weight && set.reps) {
        // Convert to kg if needed
        const weightInKg = set.weightUnit === 'lb' ? set.weight * 0.453592 : set.weight;
        return weightInKg * set.reps;
      }
      // Fallback to reps if no weight (bodyweight exercises)
      return set.reps;
      
    case 'reps-only':
      // Volume = Reps (bodyweight exercises, calisthenics)
      return set.reps;
      
    case 'duration':
      // Volume = Duration in minutes
      return set.duration ? set.duration / 60 : 0;
      
    case 'distance':
      // Volume = Distance in km
      if (set.notes) {
        const distanceMatch = set.notes.match(/([0-9]+(?:\.[0-9]+)?)(km|mi|m)/);
        if (distanceMatch) {
          const value = parseFloat(distanceMatch[1]);
          const unit = distanceMatch[2];
          
          // Convert to km
          switch (unit) {
            case 'km': return value;
            case 'mi': return value * 1.60934;
            case 'm': return value / 1000;
            default: return value;
          }
        }
      }
      return 0;
      
    case 'completion':
      // Volume = 1 if completed, 0 if not
      return set.completed ? 1 : 0;
      
    default:
      return set.reps;
  }
}

/**
 * Calculate comprehensive volume metrics for an exercise
 */
export function calculateExerciseVolume(exercise: Exercise): VolumeMetrics {
  const definition = findExerciseDefinition(exercise.name);
  const volumeType = definition?.volumeCalculation || 'reps-only';
  
  let totalVolume = 0;
  let completedVolume = 0;
  let totalSets = exercise.sets.length;
  let completedSets = 0;
  let totalReps = 0;
  let completedReps = 0;
  let totalDuration = 0;
  let completedDuration = 0;
  let totalDistance = 0;
  let completedDistance = 0;
  
  exercise.sets.forEach(set => {
    const setVolume = calculateSetVolume(set, exercise.name);
    totalVolume += setVolume;
    
    if (set.completed) {
      completedVolume += setVolume;
      completedSets++;
    }
    
    // Track additional metrics
    totalReps += set.reps;
    if (set.completed) {
      completedReps += set.reps;
    }
    
    if (set.duration) {
      totalDuration += set.duration;
      if (set.completed) {
        completedDuration += set.duration;
      }
    }
    
    // Distance tracking
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
        
        totalDistance += distanceInKm;
        if (set.completed) {
          completedDistance += distanceInKm;
        }
      }
    }
  });
  
  const completionRate = totalVolume > 0 ? (completedVolume / totalVolume) * 100 : 0;
  
  // Determine volume unit based on exercise type
  let volumeUnit = '';
  switch (volumeType) {
    case 'weight-reps':
      volumeUnit = 'kg×reps';
      break;
    case 'reps-only':
      volumeUnit = 'reps';
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
  
  const metrics: VolumeMetrics = {
    totalVolume,
    volumeUnit,
    completedVolume,
    completionRate,
    totalSets,
    completedSets
  };
  
  // Add optional metrics based on exercise type
  if (volumeType === 'reps-only' || volumeType === 'weight-reps') {
    metrics.totalReps = totalReps;
    metrics.completedReps = completedReps;
  }
  
  if (volumeType === 'duration' || totalDuration > 0) {
    metrics.totalDuration = totalDuration;
    metrics.completedDuration = completedDuration;
  }
  
  if (volumeType === 'distance' || totalDistance > 0) {
    metrics.totalDistance = totalDistance;
    metrics.completedDistance = completedDistance;
  }
  
  return metrics;
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number, unit: string): string {
  switch (unit) {
    case 'kg×reps':
      return `${Math.round(volume)} kg×reps`;
    case 'reps':
      return `${Math.round(volume)} reps`;
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
 * Compare volumes between different time periods
 */
export function compareVolumes(current: VolumeMetrics, previous: VolumeMetrics): {
  volumeChange: number;
  volumeChangePercent: number;
  trend: 'up' | 'down' | 'stable';
} {
  const volumeChange = current.completedVolume - previous.completedVolume;
  const volumeChangePercent = previous.completedVolume > 0 
    ? (volumeChange / previous.completedVolume) * 100 
    : 0;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(volumeChangePercent) > 5) {
    trend = volumeChangePercent > 0 ? 'up' : 'down';
  }
  
  return {
    volumeChange,
    volumeChangePercent,
    trend
  };
}

/**
 * Calculate relative intensity (for strength exercises)
 */
export function calculateRelativeIntensity(exercise: Exercise): {
  averageIntensity: number; // Average weight per rep
  maxIntensity: number; // Highest weight used
  volumeLoad: number; // Total weight moved
} {
  const definition = findExerciseDefinition(exercise.name);
  
  if (definition?.volumeCalculation !== 'weight-reps') {
    return { averageIntensity: 0, maxIntensity: 0, volumeLoad: 0 };
  }
  
  let totalWeight = 0;
  let totalReps = 0;
  let maxWeight = 0;
  let volumeLoad = 0;
  
  exercise.sets.forEach(set => {
    if (set.weight && set.completed) {
      const weightInKg = set.weightUnit === 'lb' ? set.weight * 0.453592 : set.weight;
      totalWeight += weightInKg * set.reps;
      totalReps += set.reps;
      maxWeight = Math.max(maxWeight, weightInKg);
      volumeLoad += weightInKg * set.reps;
    }
  });
  
  const averageIntensity = totalReps > 0 ? totalWeight / totalReps : 0;
  
  return {
    averageIntensity,
    maxIntensity: maxWeight,
    volumeLoad
  };
}
