import type { Exercise, ExerciseSet } from '@/types/fitness';

export interface VolumeRow {
  type: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance' | 'completion';
  totalSets: number;
  reps: number;
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  duration?: number; // in minutes
  distance?: number;
  distanceUnit?: 'km' | 'mi' | 'm';
  setIndices: number[]; // which sets this volume row represents
}

/**
 * Get volume rows for an exercise by grouping sets with the same volumeRowId
 * - Respects user intent by grouping only sets with same volumeRowId
 * - Ensures Add Volume always creates separate rows
 * - Allows mixed values within the same volumeRowId (for backwards compatibility)
 */
export function getVolumeRows(exercise: Exercise): VolumeRow[] {
  const volumeRows: VolumeRow[] = [];
  const groupedSets: { [volumeRowId: string]: { sets: ExerciseSet[], indices: number[] } } = {};

  // Filter out completion sets - they shouldn't be shown in UI volume rows
  exercise.sets.forEach((set, index) => {
    if (set.volumeType === 'completion') {
      return; // Skip completion sets in volume row display
    }
    
    const key = set.volumeRowId || `legacy-${index}`;

    if (!groupedSets[key]) {
      groupedSets[key] = { sets: [], indices: [] };
    }
    groupedSets[key].sets.push(set);
    groupedSets[key].indices.push(index);
  });

  // Convert to array and sort by minimum set index
  const sortedGroups = Object.entries(groupedSets)
    .map(([volumeRowId, group]) => ({ volumeRowId, ...group }))
    .sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

  // Process each group: group identical sets together, split different ones
  sortedGroups.forEach((group) => {
    // Group sets within this volumeRowId by their actual values
    const valueGroups: { [key: string]: { sets: ExerciseSet[], indices: number[] } } = {};
    
    group.sets.forEach((set, setIndexInGroup) => {
      const actualIndex = group.indices[setIndexInGroup];
      
      // Create a key based on all relevant values
      const valueKey = JSON.stringify({
        volumeType: set.volumeType,
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        duration: set.duration,
        notes: set.notes,
        distanceUnit: set.distanceUnit
      });
      
      if (!valueGroups[valueKey]) {
        valueGroups[valueKey] = { sets: [], indices: [] };
      }
      valueGroups[valueKey].sets.push(set);
      valueGroups[valueKey].indices.push(actualIndex);
    });
    
    // Create volume rows for each value group
    Object.values(valueGroups).forEach(valueGroup => {
      const firstSet = valueGroup.sets[0];
      
      const volumeRow: VolumeRow = {
        type: (firstSet.volumeType || 'sets-reps') as VolumeRow['type'],
        totalSets: valueGroup.sets.length,
        reps: firstSet.reps,
        setIndices: valueGroup.indices
      };

      if (firstSet.volumeType === 'sets-reps-weight') {
        volumeRow.weight = firstSet.weight;
        volumeRow.weightUnit = firstSet.weightUnit;
      } else if (firstSet.volumeType === 'duration') {
        volumeRow.duration = (firstSet.duration || 0) / 60; // Convert to minutes
      } else if (firstSet.volumeType === 'distance') {
        const distance = parseFloat(firstSet.notes?.replace(/[^\d.]/g, '') || '0');
        volumeRow.distance = distance;
        volumeRow.distanceUnit = firstSet.distanceUnit;
      }

      volumeRows.push(volumeRow);
    });
  });

  return volumeRows;
}

/**
 * Update a volume row and return the updated exercise
 */
export function updateVolumeRow(
  exercise: Exercise, 
  rowIndex: number, 
  updates: Partial<VolumeRow>
): Exercise {
  const volumeRows = getVolumeRows(exercise);
  const volumeRow = volumeRows[rowIndex];
  if (!volumeRow) return exercise;

  // Validate and sanitize updates to prevent invalid values
  const sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.totalSets !== undefined) {
    sanitizedUpdates.totalSets = Math.max(1, Math.min(15, Math.floor(sanitizedUpdates.totalSets)));
  }
  if (sanitizedUpdates.reps !== undefined) {
    sanitizedUpdates.reps = Math.max(1, Math.min(999, Math.floor(sanitizedUpdates.reps)));
  }
  if (sanitizedUpdates.weight !== undefined) {
    sanitizedUpdates.weight = Math.max(0, Math.min(9999, sanitizedUpdates.weight));
  }
  if (sanitizedUpdates.duration !== undefined) {
    sanitizedUpdates.duration = Math.max(0.1, Math.min(999, sanitizedUpdates.duration));
  }
  if (sanitizedUpdates.distance !== undefined) {
    sanitizedUpdates.distance = Math.max(0.1, Math.min(999, sanitizedUpdates.distance));
  }

  const updatedRow = { ...volumeRow, ...sanitizedUpdates };
  
  // Early return if no meaningful changes (prevents unnecessary updates)
  const hasChanges = Object.keys(sanitizedUpdates).some(key => {
    const oldValue = volumeRow[key as keyof VolumeRow];
    const newValue = sanitizedUpdates[key as keyof VolumeRow];
    return oldValue !== newValue;
  });
  
  if (!hasChanges) {
    return exercise; // No changes needed
  }
  
  let newSets = [...exercise.sets];
  
  // Handle type changes to single-set types
  const isTypeChangeToSingleSet = sanitizedUpdates.type && 
    (sanitizedUpdates.type === 'distance' || sanitizedUpdates.type === 'duration') && 
    volumeRow.type !== sanitizedUpdates.type;
  
  // Handle type changes from single-set to multi-set types
  const isTypeChangeToMultipleSets = sanitizedUpdates.type && 
    (sanitizedUpdates.type === 'sets-reps' || sanitizedUpdates.type === 'sets-reps-weight') && 
    (volumeRow.type === 'distance' || volumeRow.type === 'duration');
  
  if (isTypeChangeToSingleSet) {
    updatedRow.totalSets = 1;
    
    const templateSet = exercise.sets[volumeRow.setIndices[0]];
    // Create clean set with only type-specific fields (don't spread templateSet to avoid field pollution)
    const updatedSet: ExerciseSet = {
      reps: updatedRow.reps,
      restTime: templateSet.restTime,
      notes: '',
      volumeType: updatedRow.type,
      volumeRowId: templateSet.volumeRowId
    };

    // Add type-specific fields only
    if (updatedRow.type === 'sets-reps-weight') {
      updatedSet.weight = updatedRow.weight || 0;
      updatedSet.weightUnit = updatedRow.weightUnit || 'kg';
    } else if (updatedRow.type === 'duration') {
      updatedSet.duration = (updatedRow.duration || 15) * 60;
      updatedSet.reps = 1; // Duration exercises typically have 1 rep
    } else if (updatedRow.type === 'distance') {
      updatedSet.notes = `${updatedRow.distance || 10}${updatedRow.distanceUnit || 'km'}`;
      updatedSet.distanceUnit = updatedRow.distanceUnit || 'km';
      updatedSet.reps = 1; // Distance exercises typically have 1 rep
    }

    const insertPosition = Math.min(...volumeRow.setIndices);
    newSets = newSets.filter((_, index) => !volumeRow.setIndices.includes(index));
    newSets.splice(insertPosition, 0, updatedSet);
    
  } else if (isTypeChangeToMultipleSets) {
    updatedRow.totalSets = 3;
    
    const templateSet = exercise.sets[volumeRow.setIndices[0]];
    const insertPosition = Math.min(...volumeRow.setIndices);
    newSets = newSets.filter((_, index) => !volumeRow.setIndices.includes(index));
    
    const newSetsToInsert: ExerciseSet[] = [];
    for (let i = 0; i < 3; i++) {
      const newSet: ExerciseSet = {
        reps: updatedRow.reps || 10,
        restTime: templateSet.restTime,
        notes: '',
        volumeType: updatedRow.type,
        volumeRowId: templateSet.volumeRowId
      };

      if (updatedRow.type === 'sets-reps-weight') {
        newSet.weight = updatedRow.weight || 0;
        newSet.weightUnit = updatedRow.weightUnit || 'kg';
      }

      newSetsToInsert.push(newSet);
    }
    
    newSets.splice(insertPosition, 0, ...newSetsToInsert);
    
  } else if (sanitizedUpdates.totalSets !== undefined && sanitizedUpdates.totalSets !== volumeRow.totalSets) {
    // Handle explicit totalSets changes
    const setsDifference = sanitizedUpdates.totalSets - volumeRow.totalSets;
    
    if (setsDifference > 0) {
      // Add new sets
      const templateSet = exercise.sets[volumeRow.setIndices[0]];
      const insertPosition = Math.max(...volumeRow.setIndices) + 1;
      const newSetsToInsert: ExerciseSet[] = [];
      
      for (let i = 0; i < setsDifference; i++) {
        // Create clean set with only type-specific fields
        const newSet: ExerciseSet = {
          reps: updatedRow.reps,
          restTime: templateSet.restTime,
          notes: '',
          volumeType: updatedRow.type,
          volumeRowId: templateSet.volumeRowId
        };

        // Add type-specific fields only
        if (updatedRow.type === 'sets-reps-weight') {
          newSet.weight = updatedRow.weight || 0;
          newSet.weightUnit = updatedRow.weightUnit || 'kg';
        } else if (updatedRow.type === 'duration') {
          newSet.duration = (updatedRow.duration || 15) * 60;
          newSet.reps = 1; // Duration exercises typically have 1 rep
        } else if (updatedRow.type === 'distance') {
          newSet.notes = `${updatedRow.distance || 10}${updatedRow.distanceUnit || 'km'}`;
          newSet.distanceUnit = updatedRow.distanceUnit || 'km';
          newSet.reps = 1; // Distance exercises typically have 1 rep
        }

        newSetsToInsert.push(newSet);
      }
      
      newSets.splice(insertPosition, 0, ...newSetsToInsert);
    } else if (setsDifference < 0) {
      // Remove sets
      const setsToRemove = Math.abs(setsDifference);
      const indicesToRemove = volumeRow.setIndices.slice(-setsToRemove);
      newSets = newSets.filter((_, index) => !indicesToRemove.includes(index));
    }
  } else {
    // Update existing sets - ensure they all get the same volumeRowId to stay grouped
    const sharedVolumeRowId = exercise.sets[volumeRow.setIndices[0]]?.volumeRowId || 
      `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    newSets = newSets.map((set, setIndex) => {
      if (volumeRow.setIndices.includes(setIndex)) {
        // Start with base set properties, then add type-specific fields
        const newSet: ExerciseSet = {
          reps: updatedRow.reps,
          restTime: set.restTime,
          notes: '',
          volumeType: updatedRow.type,
          volumeRowId: sharedVolumeRowId // Ensure all sets in this volume row have same ID
        };

        // Add type-specific fields and clean up others
        if (updatedRow.type === 'sets-reps-weight') {
          newSet.weight = updatedRow.weight || 0;
          newSet.weightUnit = updatedRow.weightUnit || 'kg';
          // duration and distance fields are omitted (cleaned up)
        } else if (updatedRow.type === 'duration') {
          newSet.duration = (updatedRow.duration || 15) * 60;
          newSet.reps = 1; // Duration exercises typically have 1 rep
          // weight and distance fields are omitted (cleaned up)
        } else if (updatedRow.type === 'distance') {
          newSet.notes = `${updatedRow.distance || 10}${updatedRow.distanceUnit || 'km'}`;
          newSet.distanceUnit = updatedRow.distanceUnit || 'km';
          newSet.reps = 1; // Distance exercises typically have 1 rep
          // weight and duration fields are omitted (cleaned up)
        } else if (updatedRow.type === 'sets-reps') {
          // Only reps field, no weight/duration/distance
        }

        return newSet;
      }
      return set;
    });
  }

  // Return the updated exercise without normalization for now
  return { ...exercise, sets: newSets };
}

/**
 * Normalize exercise volume rows to ensure consistent grouping
 * This function ensures that sets with identical values get the same volumeRowId
 * while sets with different values get unique volumeRowIds
 */
export function normalizeExerciseVolumeRows(exercise: Exercise): Exercise {
  const normalizedSets = [...exercise.sets];
  
  // Group sets by their values (ignoring current volumeRowId)
  const valueGroups: { [key: string]: { sets: ExerciseSet[], indices: number[] } } = {};
  
  normalizedSets.forEach((set, index) => {
    if (set.volumeType === 'completion') return; // Skip completion sets
    
    // Create a key based on all relevant values
    const valueKey = JSON.stringify({
      volumeType: set.volumeType,
      reps: set.reps,
      weight: set.weight,
      weightUnit: set.weightUnit,
      duration: set.duration,
      notes: set.notes,
      distanceUnit: set.distanceUnit
    });
    
    if (!valueGroups[valueKey]) {
      valueGroups[valueKey] = { sets: [], indices: [] };
    }
    valueGroups[valueKey].sets.push(set);
    valueGroups[valueKey].indices.push(index);
  });
  
  // Assign consistent volumeRowIds within each value group
  Object.values(valueGroups).forEach(group => {
    if (group.sets.length > 1) {
      // Multiple sets with same values - give them the same volumeRowId
      const sharedVolumeRowId = group.sets[0].volumeRowId || 
        `normalized-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      group.indices.forEach(index => {
        normalizedSets[index] = {
          ...normalizedSets[index],
          volumeRowId: sharedVolumeRowId
        };
      });
    } else {
      // Single set with unique values - ensure it has a unique volumeRowId
      const index = group.indices[0];
      const currentSet = normalizedSets[index];
      
      // Only assign new ID if it doesn't have one or if it might conflict
      if (!currentSet.volumeRowId || currentSet.volumeRowId.startsWith('individual-')) {
        normalizedSets[index] = {
          ...currentSet,
          volumeRowId: `unique-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
      }
    }
  });
  
  return {
    ...exercise,
    sets: normalizedSets
  };
}

/**
 * Add a new volume row to an exercise
 */
export function addVolumeRow(exercise: Exercise): Exercise {
  const volumeRowId = `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newSets: ExerciseSet[] = Array.from({ length: 3 }, () => ({
    reps: 10,
    restTime: 90,
    notes: '',
    volumeType: 'sets-reps',
    volumeRowId,
    completed: false // Explicitly set completion status for new sets
    // Explicitly omit optional fields to avoid undefined values
    // weight, duration, weightUnit, distanceUnit will be undefined and cleaned by sanitizeWorkoutForFirebase
  }));

  return {
    ...exercise,
    sets: [...exercise.sets, ...newSets]
  };
}

/**
 * Remove a volume row from an exercise
 */
export function removeVolumeRow(exercise: Exercise, rowIndex: number): Exercise {
  const volumeRows = getVolumeRows(exercise);
  const volumeRow = volumeRows[rowIndex];
  if (!volumeRow) return exercise;

  return {
    ...exercise,
    sets: exercise.sets.filter((_, setIndex) => !volumeRow.setIndices.includes(setIndex))
  };
}

