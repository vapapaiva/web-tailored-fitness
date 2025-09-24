import { useState, useCallback } from 'react';
import type { Workout } from '@/types/fitness';
import { ComprehensiveWorkoutParser } from '@/lib/comprehensiveWorkoutParser';

interface UseTextSyncProps {
  workout: Workout;
  progress: { [exerciseId: string]: boolean[] };
  onWorkoutAndProgressUpdate: (workout: Workout, progress: { [exerciseId: string]: boolean[] }) => void;
}

/**
 * Custom hook for managing text editor synchronization
 */
export function useTextSync({ workout, progress, onWorkoutAndProgressUpdate }: UseTextSyncProps) {
  const [textEditorValue, setTextEditorValue] = useState('');

  const generateTextFromState = useCallback((): string => {
    return ComprehensiveWorkoutParser.generateWorkoutText(workout, progress);
  }, [workout, progress]);

  const parseTextToState = useCallback((text: string): void => {
    try {
      const parsed = ComprehensiveWorkoutParser.parseWorkoutText(text);
      const exercises = ComprehensiveWorkoutParser.convertToExercises(parsed, workout);
      
      const updatedExercises = exercises.map((exercise, index) => {
        const originalExercise = workout.exercises[index];
        if (originalExercise) {
          return { ...exercise, id: originalExercise.id };
        }
        return exercise;
      });

      const newWorkout: Workout = {
        ...workout,
        exercises: updatedExercises
      };
      
      // Calculate progress from parsed data
      const newProgress: { [exerciseId: string]: boolean[] } = {};
      
      newWorkout.exercises.forEach((exercise, exerciseIndex) => {
        const parsedExercise = parsed.workout[exerciseIndex];
        const existingProgress = progress[exercise.id] || [];
        const progressArray = new Array(exercise.sets.length).fill(false);
        
        if (parsedExercise) {
          // Handle exercise-level completion (- ex_1 +)
          if (parsedExercise.exerciseLevelDone) {
            // Mark all sets as completed
            progressArray.fill(true);
          } else {
            // Handle set-based completion (3x10x25kg ++)
            if (parsedExercise.sets && parsedExercise.sets.length > 0) {
              let setIndex = 0;
              parsedExercise.sets.forEach(parsedSet => {
                const setsCompleted = parsedSet.sets_done || 0;
                const setsPlanned = parsedSet.sets_planned;
                
                for (let i = 0; i < setsPlanned; i++) {
                  if (setIndex < progressArray.length) {
                    progressArray[setIndex] = i < setsCompleted;
                    setIndex++;
                  }
                }
              });
            }
            
            // Handle granular completion for distance/duration volume rows
            exercise.sets.forEach((set, setIndex) => {
              if (set.volumeType === 'distance' && parsedExercise.distanceDone) {
                if (setIndex < progressArray.length) {
                  progressArray[setIndex] = true;
                }
              } else if (set.volumeType === 'duration' && parsedExercise.timeDone) {
                if (setIndex < progressArray.length) {
                  progressArray[setIndex] = true;
                }
              }
            });
            
            // Handle completion-only exercises (no volume, just completion)
            if (parsedExercise.done) {
              // Mark the completion set as done
              const completionSetIndex = exercise.sets.findIndex(set => set.volumeType === 'completion');
              if (completionSetIndex !== -1 && completionSetIndex < progressArray.length) {
                progressArray[completionSetIndex] = true;
              } else if (progressArray.length > 0) {
                // Fallback: mark first set as completed
                progressArray[0] = true;
              }
            }
          }
        }
        
        // Preserve existing progress where possible (for sets not covered by parsing)
        for (let i = 0; i < Math.min(existingProgress.length, progressArray.length); i++) {
          if (progressArray[i] === false && existingProgress[i] === true) {
            // Only preserve if the parsed data didn't explicitly set this set's completion
            const wasExplicitlySet = parsedExercise?.sets || parsedExercise?.done;
            if (!wasExplicitlySet) {
              progressArray[i] = existingProgress[i];
            }
          }
        }
        
        newProgress[exercise.id] = progressArray;
      });

      // Update both workout structure and progress atomically
      onWorkoutAndProgressUpdate(newWorkout, newProgress);
    } catch (error) {
      console.error('Error parsing workout text:', error);
    }
  }, [workout, progress, onWorkoutAndProgressUpdate]);

  const syncUIToText = useCallback(() => {
    const generatedText = generateTextFromState();
    setTextEditorValue(generatedText);
  }, [generateTextFromState]);

  const syncTextToUI = useCallback(() => {
    parseTextToState(textEditorValue);
  }, [textEditorValue, parseTextToState]);

  return {
    textEditorValue,
    setTextEditorValue,
    syncUIToText,
    syncTextToUI,
    generateTextFromState,
    parseTextToState
  };
}
