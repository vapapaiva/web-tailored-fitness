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
      // Initialize progress from actual set completion status
      acc[exercise.id] = exercise.sets.map(set => set.completed || false);
      return acc;
    }, {} as { [exerciseId: string]: boolean[] })
  }));

  // Sync execution state when workout prop changes
  useEffect(() => {
    const newProgress = initialWorkout.exercises.reduce((acc, exercise) => {
      // Always load progress from the actual workout data (database state)
      acc[exercise.id] = exercise.sets.map(set => set.completed || false);
      return acc;
    }, {} as { [exerciseId: string]: boolean[] });
    
    setExecutionState({
      workout: initialWorkout,
      progress: newProgress
    });
  }, [initialWorkout]);

  const updateProgress = useCallback((exerciseId: string, setIndex: number, completed: boolean) => {
    setExecutionState(prev => {
      // Update progress state
      const newProgress = {
        ...prev.progress,
        [exerciseId]: prev.progress[exerciseId]?.map((isCompleted, index) => 
          index === setIndex ? completed : isCompleted
        ) || []
      };

      // Check if all sets are completed after this change
      const allSetsCompleted = Object.values(newProgress).every(exerciseProgress => 
        exerciseProgress.every(Boolean) && exerciseProgress.length > 0
      );

      // Update workout data structure to persist completion status
      const updatedWorkout = {
        ...prev.workout,
        exercises: prev.workout.exercises.map(exercise => {
          if (exercise.id === exerciseId) {
            return {
              ...exercise,
              sets: exercise.sets.map((set, index) => ({
                ...set,
                completed: index === setIndex ? completed : (set.completed || false)
              }))
            };
          }
          return exercise;
        }),
        // Auto-update workout status based on completion
        status: allSetsCompleted ? 'completed' as const : 'planned' as const,
        completedAt: allSetsCompleted ? (prev.workout.completedAt || new Date().toISOString()) : undefined
      };

      // Persist to database
      onWorkoutUpdate(updatedWorkout);

      return {
        workout: updatedWorkout,
        progress: newProgress
      };
    });
  }, [onWorkoutUpdate]);

  const updateProgressState = useCallback((newProgress: { [exerciseId: string]: boolean[] }) => {
    setExecutionState(prev => ({
      ...prev,
      progress: newProgress
    }));
  }, []);

  const updateWorkoutAndProgress = useCallback((newWorkout: Workout, newProgress: { [exerciseId: string]: boolean[] }) => {
    // Check if all sets are completed based on the new progress
    const allSetsCompleted = Object.values(newProgress).every(exerciseProgress => 
      exerciseProgress.every(Boolean) && exerciseProgress.length > 0
    );

    // Update workout with automatic status sync
    const workoutWithStatus = {
      ...newWorkout,
      status: allSetsCompleted ? 'completed' as const : 'planned' as const,
      completedAt: allSetsCompleted ? (newWorkout.completedAt || new Date().toISOString()) : undefined,
      // Also update the set completion in the workout structure to match progress
      exercises: newWorkout.exercises.map(exercise => {
        const exerciseProgress = newProgress[exercise.id] || [];
        return {
          ...exercise,
          sets: exercise.sets.map((set, index) => ({
            ...set,
            completed: exerciseProgress[index] || false
          }))
        };
      })
    };

    setExecutionState({
      workout: workoutWithStatus,
      progress: newProgress
    });
    onWorkoutUpdate(workoutWithStatus);
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
    setExecutionState(prev => {
      const currentProgress = prev.progress[exerciseId] || [];
      const exercise = prev.workout.exercises.find(ex => ex.id === exerciseId);
      if (!exercise) return prev;

      const allCompleted = currentProgress.every(Boolean) && currentProgress.length === exercise.sets.length;
      const newCompletionStatus = !allCompleted;
      const newProgress = new Array(exercise.sets.length).fill(newCompletionStatus);
      
      // Calculate overall completion after this change
      const updatedProgress = {
        ...prev.progress,
        [exerciseId]: newProgress
      };
      
      const allSetsCompleted = Object.values(updatedProgress).every(exerciseProgress => 
        exerciseProgress.every(Boolean) && exerciseProgress.length > 0
      );
      
      // Update workout data structure to persist completion status
      const updatedWorkout = {
        ...prev.workout,
        exercises: prev.workout.exercises.map(ex => {
          if (ex.id === exerciseId) {
            return {
              ...ex,
              sets: ex.sets.map(set => ({
                ...set,
                completed: newCompletionStatus
              }))
            };
          }
          return ex;
        }),
        // Auto-update workout status based on completion
        status: allSetsCompleted ? 'completed' as const : 'planned' as const,
        completedAt: allSetsCompleted ? (prev.workout.completedAt || new Date().toISOString()) : undefined
      };

      // Persist to database
      onWorkoutUpdate(updatedWorkout);

      return {
        workout: updatedWorkout,
        progress: updatedProgress
      };
    });
  }, [onWorkoutUpdate]);

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
    const isWorkoutComplete = totalCount > 0 && completedCount === totalCount;
    
    return {
      completedCount,
      totalCount,
      percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
      isWorkoutComplete
    };
  }, [executionState.progress]);

  const completeAllExercises = useCallback(() => {
    setExecutionState(prev => {
      const newProgress: { [exerciseId: string]: boolean[] } = {};
      
      // Update progress state
      prev.workout.exercises.forEach(exercise => {
        newProgress[exercise.id] = new Array(exercise.sets.length).fill(true);
      });

      // Update workout data structure to persist completion status
      const updatedWorkout = {
        ...prev.workout,
        exercises: prev.workout.exercises.map(exercise => ({
          ...exercise,
          sets: exercise.sets.map(set => ({
            ...set,
            completed: true
          }))
        }))
      };

      // Persist to database
      onWorkoutUpdate(updatedWorkout);

      return {
        workout: updatedWorkout,
        progress: newProgress
      };
    });
  }, [onWorkoutUpdate]);

  return {
    executionState,
    updateProgress,
    updateProgressState,
    updateWorkoutStructure,
    updateWorkoutAndProgress,
    toggleSetCompletion,
    toggleExerciseCompletion,
    getExerciseProgress,
    getOverallProgress,
    completeAllExercises
  };
}
