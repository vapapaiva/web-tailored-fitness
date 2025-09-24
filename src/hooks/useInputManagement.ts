import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '@/types/fitness';

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
    if (!isNaN(numericValue) && numericValue > 0) {
      onUpdate(exerciseId, rowIndex, { [field]: numericValue });
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
    
    if (isNaN(numericValue) || numericValue <= 0) {
      setLocalVolumeRowValues(prev => ({ ...prev, [key]: defaultValue.toString() }));
      onUpdate(exerciseId, rowIndex, { [field]: defaultValue });
    }
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
    setLocalInputValues(prev => {
      const newValues = { ...prev };
      
      workout.exercises.forEach(exercise => {
        exercise.sets.forEach((set, setIndex) => {
          const repsKey = getInputKey(exercise.id, setIndex, 'reps');
          const weightKey = getInputKey(exercise.id, setIndex, 'weight');
          const durationKey = getInputKey(exercise.id, setIndex, 'duration');
          
          if (newValues[repsKey] === undefined) {
            newValues[repsKey] = set.reps.toString();
          }
          if (newValues[weightKey] === undefined) {
            newValues[weightKey] = set.weight?.toString() || '';
          }
          if (newValues[durationKey] === undefined) {
            newValues[durationKey] = set.duration ? (set.duration / 60).toString() : '';
          }
        });
      });
      
      return newValues;
    });
  }, [workout, getInputKey]);

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
