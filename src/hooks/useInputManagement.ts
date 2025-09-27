import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '@/types/fitness';
import { getVolumeRows } from '@/lib/volumeRowUtils';

/**
 * Custom hook for managing local input values in workout execution
 */
export function useInputManagement(workout: Workout) {
  const [localInputValues, setLocalInputValues] = useState<{ [key: string]: string }>({});
  const [localVolumeRowValues, setLocalVolumeRowValues] = useState<{ [key: string]: string }>({});

  const getInputKey = useCallback((exerciseId: string, setIndex: number, field: string): string => 
    `${exerciseId}-${setIndex}-${field}`, []);

  const getVolumeRowKey = useCallback((exerciseId: string, rowIndex: number, field: string): string => 
    `${exerciseId}-${rowIndex}-${field}`, []);

  const handleInputChange = useCallback((
    exerciseId: string, 
    setIndex: number, 
    field: string, 
    value: string,
    onUpdate: (exerciseId: string, setIndex: number, field: string, value: number) => void
  ): void => {
    const key = getInputKey(exerciseId, setIndex, field);
    setLocalInputValues(prev => ({ ...prev, [key]: value }));
    
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      onUpdate(exerciseId, setIndex, field, numericValue);
    }
  }, [getInputKey]);

  const handleVolumeRowInputChange = useCallback((
    exerciseId: string, 
    rowIndex: number, 
    field: string, 
    value: string,
    onUpdate: (exerciseId: string, rowIndex: number, updates: { [key: string]: number }) => void
  ): void => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    setLocalVolumeRowValues(prev => ({ ...prev, [key]: value }));
    
    const numericValue = parseFloat(value);
    // Only trigger update for valid positive numbers
    // This prevents updates for empty strings, invalid input, etc.
    if (!isNaN(numericValue) && numericValue > 0) {
      // Clamp the value to reasonable bounds based on field type
      let clampedValue = numericValue;
      if (field === 'totalSets') {
        clampedValue = Math.max(1, Math.min(15, numericValue));
      } else if (field === 'reps') {
        clampedValue = Math.max(1, Math.min(999, numericValue));
      } else if (field === 'weight') {
        clampedValue = Math.max(0, Math.min(9999, numericValue));
      } else if (field === 'duration') {
        clampedValue = Math.max(0.1, Math.min(999, numericValue));
      } else if (field === 'distance') {
        clampedValue = Math.max(0.1, Math.min(999, numericValue));
      }
      
      onUpdate(exerciseId, rowIndex, { [field]: clampedValue });
    }
  }, [getVolumeRowKey]);

  const handleInputBlur = useCallback((
    exerciseId: string, 
    setIndex: number, 
    field: string, 
    defaultValue: number,
    onUpdate: (exerciseId: string, setIndex: number, field: string, value: number) => void
  ): void => {
    const key = getInputKey(exerciseId, setIndex, field);
    const currentValue = localInputValues[key];
    const numericValue = parseFloat(currentValue);
    
    if (isNaN(numericValue) || numericValue <= 0) {
      setLocalInputValues(prev => ({ ...prev, [key]: defaultValue.toString() }));
      onUpdate(exerciseId, setIndex, field, defaultValue);
    }
  }, [getInputKey, localInputValues]);

  const handleVolumeRowInputBlur = useCallback((
    exerciseId: string, 
    rowIndex: number, 
    field: string, 
    defaultValue: number,
    onUpdate: (exerciseId: string, rowIndex: number, updates: { [key: string]: number }) => void
  ): void => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    const currentValue = localVolumeRowValues[key];
    const numericValue = parseFloat(currentValue);
    
    // Only update if the value is invalid (NaN or <= 0)
    // AND if it's different from the default value to prevent unnecessary updates
    if (isNaN(numericValue) || numericValue <= 0) {
      const clampedDefault = Math.max(1, defaultValue); // Ensure minimum value of 1
      setLocalVolumeRowValues(prev => ({ ...prev, [key]: clampedDefault.toString() }));
      onUpdate(exerciseId, rowIndex, { [field]: clampedDefault });
    }
    // If the value is valid, don't trigger an update - onChange already handled it
  }, [getVolumeRowKey, localVolumeRowValues]);

  const getInputValue = useCallback((exerciseId: string, setIndex: number, field: string, currentValue: number): string => {
    const key = getInputKey(exerciseId, setIndex, field);
    return localInputValues[key] !== undefined ? localInputValues[key] : currentValue.toString();
  }, [getInputKey, localInputValues]);

  const getVolumeRowValue = useCallback((exerciseId: string, rowIndex: number, field: string, currentValue: number): string => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    return localVolumeRowValues[key] !== undefined ? localVolumeRowValues[key] : currentValue.toString();
  }, [getVolumeRowKey, localVolumeRowValues]);

  const clearInputValues = useCallback(() => {
    setLocalInputValues({});
    setLocalVolumeRowValues({});
  }, []);

  // Initialize local input values when workout changes
  useEffect(() => {
    // Always start fresh to avoid stale values
    const newValues: { [key: string]: string } = {};
    
    workout.exercises.forEach(exercise => {
      exercise.sets.forEach((set, setIndex) => {
        const repsKey = getInputKey(exercise.id, setIndex, 'reps');
        const weightKey = getInputKey(exercise.id, setIndex, 'weight');
        const durationKey = getInputKey(exercise.id, setIndex, 'duration');
        const distanceKey = getInputKey(exercise.id, setIndex, 'distance');
        
        // Always set values from current workout state (no caching)
        newValues[repsKey] = set.reps.toString();
        newValues[weightKey] = set.weight?.toString() || '0';
        newValues[durationKey] = set.duration ? (set.duration / 60).toString() : '0';
        
        // Extract distance from notes field (e.g., "5km" -> "5")
        const distanceValue = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
        newValues[distanceKey] = distanceValue.toString();
      });
    });
    
    setLocalInputValues(newValues);

    // Clear and reinitialize volume row values when workout structure changes
    // This prevents stale state from causing duplicate updates
    setLocalVolumeRowValues(() => {
      const newValues: { [key: string]: string } = {};
      
      workout.exercises.forEach(exercise => {
        const volumeRows = getVolumeRows(exercise);
        volumeRows.forEach((volumeRow, rowIndex) => {
          const totalSetsKey = getVolumeRowKey(exercise.id, rowIndex, 'totalSets');
          const repsKey = getVolumeRowKey(exercise.id, rowIndex, 'reps');
          const weightKey = getVolumeRowKey(exercise.id, rowIndex, 'weight');
          const durationKey = getVolumeRowKey(exercise.id, rowIndex, 'duration');
          const distanceKey = getVolumeRowKey(exercise.id, rowIndex, 'distance');
          
          newValues[totalSetsKey] = volumeRow.totalSets.toString();
          newValues[repsKey] = volumeRow.reps.toString();
          newValues[weightKey] = volumeRow.weight?.toString() || '0';
          newValues[durationKey] = volumeRow.duration?.toString() || '0';
          newValues[distanceKey] = volumeRow.distance?.toString() || '0';
        });
      });
      
      return newValues;
    });
  }, [workout, getInputKey, getVolumeRowKey]);

  return {
    localInputValues,
    localVolumeRowValues,
    handleInputChange,
    handleVolumeRowInputChange,
    handleInputBlur,
    handleVolumeRowInputBlur,
    getInputValue,
    getVolumeRowValue,
    clearInputValues
  };
}
