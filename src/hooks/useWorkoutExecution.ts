import { useState, useEffect, useCallback } from 'react';
import type { Workout } from '@/types/fitness';

interface WorkoutExecutionState {
  workout: Workout;
  progress: { [exerciseId: string]: boolean[] };
}

interface UseWorkoutExecutionProps {
  initialWorkout: Workout;
  onWorkoutUpdate: (workout: Workout) => void;
}

/**
 * Custom hook for managing workout execution state
 */
export function useWorkoutExecution({ initialWorkout, onWorkoutUpdate }: UseWorkoutExecutionProps) {
  const [executionState, setExecutionState] = useState<WorkoutExecutionState>(() => ({
    workout: initialWorkout,
    progress: initialWorkout.exercises.reduce((acc, exercise) => {
      acc[exercise.id] = new Array(exercise.sets.length).fill(false);
      return acc;
    }, {} as { [exerciseId: string]: boolean[] })
  }));

  // Sync execution state when workout prop changes
  useEffect(() => {
    setExecutionState(prev => {
      const newProgress = initialWorkout.exercises.reduce((acc, exercise) => {
        const existingProgress = prev.progress[exercise.id];
        if (existingProgress && existingProgress.length === exercise.sets.length) {
          acc[exercise.id] = existingProgress;
        } else {
          acc[exercise.id] = new Array(exercise.sets.length).fill(false);
        }
        return acc;
      }, {} as { [exerciseId: string]: boolean[] });
      
      return {
        workout: initialWorkout,
        progress: newProgress
      };
    });
  }, [initialWorkout]);

  const updateProgress = useCallback((exerciseId: string, setIndex: number, completed: boolean) => {
    setExecutionState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [exerciseId]: prev.progress[exerciseId]?.map((isCompleted, index) => 
          index === setIndex ? completed : isCompleted
        ) || []
      }
    }));
  }, []);

  const updateProgressState = useCallback((newProgress: { [exerciseId: string]: boolean[] }) => {
    setExecutionState(prev => ({
      ...prev,
      progress: newProgress
    }));
  }, []);

  const updateWorkoutAndProgress = useCallback((newWorkout: Workout, newProgress: { [exerciseId: string]: boolean[] }) => {
    setExecutionState({
      workout: newWorkout,
      progress: newProgress
    });
    onWorkoutUpdate(newWorkout);
  }, [onWorkoutUpdate]);

  const updateWorkoutStructure = useCallback((newWorkout: Workout) => {
    const newProgress: { [exerciseId: string]: boolean[] } = {};
    
    newWorkout.exercises.forEach(exercise => {
      const existingProgress = executionState.progress[exercise.id] || [];
      const newProgressArray = new Array(exercise.sets.length).fill(false);
      
      for (let i = 0; i < Math.min(existingProgress.length, newProgressArray.length); i++) {
        newProgressArray[i] = existingProgress[i];
      }
      
      newProgress[exercise.id] = newProgressArray;
    });

    setExecutionState({
      workout: newWorkout,
      progress: newProgress
    });
    onWorkoutUpdate(newWorkout);
  }, [executionState.progress, onWorkoutUpdate]);

  const toggleSetCompletion = useCallback((exerciseId: string, setIndex: number) => {
    const currentProgress = executionState.progress[exerciseId] || [];
    const isCurrentlyCompleted = currentProgress[setIndex] || false;
    updateProgress(exerciseId, setIndex, !isCurrentlyCompleted);
  }, [executionState.progress, updateProgress]);

  const toggleExerciseCompletion = useCallback((exerciseId: string) => {
    const currentProgress = executionState.progress[exerciseId] || [];
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const allCompleted = currentProgress.every(Boolean) && currentProgress.length === exercise.sets.length;
    const newProgress = new Array(exercise.sets.length).fill(!allCompleted);
    
    setExecutionState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [exerciseId]: newProgress
      }
    }));
  }, [executionState]);

  const getExerciseProgress = useCallback((exerciseId: string) => {
    const progress = executionState.progress[exerciseId] || [];
    const completedCount = progress.filter(Boolean).length;
    const totalCount = progress.length;
    const isCompleted = completedCount === totalCount && totalCount > 0;
    
    return {
      completedSets: progress,
      completedCount,
      totalCount,
      isCompleted,
      percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0
    };
  }, [executionState.progress]);

  const getOverallProgress = useCallback(() => {
    const allProgress = Object.values(executionState.progress).flat();
    const completedCount = allProgress.filter(Boolean).length;
    const totalCount = allProgress.length;
    
    return {
      completedCount,
      totalCount,
      percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0
    };
  }, [executionState.progress]);

  return {
    executionState,
    updateProgress,
    updateProgressState,
    updateWorkoutStructure,
    updateWorkoutAndProgress,
    toggleSetCompletion,
    toggleExerciseCompletion,
    getExerciseProgress,
    getOverallProgress
  };
}
