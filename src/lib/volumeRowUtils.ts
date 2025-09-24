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

  sortedGroups.forEach((group) => {
    const firstSet = group.sets[0];
    const volumeRow: VolumeRow = {
      type: (firstSet.volumeType || 'sets-reps') as VolumeRow['type'],
      totalSets: group.sets.length,
      reps: firstSet.reps,
      setIndices: group.indices
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

  const updatedRow = { ...volumeRow, ...updates };
  let newSets = [...exercise.sets];
  
  // Handle type changes to single-set types
  const isTypeChangeToSingleSet = updates.type && 
    (updates.type === 'distance' || updates.type === 'duration') && 
    volumeRow.type !== updates.type;
  
  // Handle type changes from single-set to multi-set types
  const isTypeChangeToMultipleSets = updates.type && 
    (updates.type === 'sets-reps' || updates.type === 'sets-reps-weight') && 
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
    
  } else if (updates.totalSets !== undefined && updates.totalSets !== volumeRow.totalSets) {
    // Handle explicit totalSets changes
    const setsDifference = updates.totalSets - volumeRow.totalSets;
    
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
    // Update existing sets
    newSets = newSets.map((set, setIndex) => {
      if (volumeRow.setIndices.includes(setIndex)) {
        // Start with base set properties, then add type-specific fields
        const newSet: ExerciseSet = {
          reps: updatedRow.reps,
          restTime: set.restTime,
          notes: '',
          volumeType: updatedRow.type,
          volumeRowId: set.volumeRowId
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

  return { ...exercise, sets: newSets };
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
    volumeRowId
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
