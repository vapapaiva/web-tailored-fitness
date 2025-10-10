import { useState, useCallback, useEffect, useRef } from 'react';
import type { Workout } from '@/types/fitness';
import { ComprehensiveWorkoutParser } from '@/lib/comprehensiveWorkoutParser';

interface UseTextSyncProps {
  workout: Workout;
  progress: { [exerciseId: string]: boolean[] };
  onWorkoutAndProgressUpdate: (workout: Workout, progress: { [exerciseId: string]: boolean[] }) => void;
  enableRealtimeSync?: boolean; // Optional flag to enable real-time sync
  isGapRecovery?: boolean; // Gap recovery mode: mark all exercises as complete
}

/**
 * Custom hook for managing text editor synchronization
 */
export function useTextSync({ workout, progress, onWorkoutAndProgressUpdate, enableRealtimeSync = false, isGapRecovery = false }: UseTextSyncProps) {
  const [textEditorValue, setTextEditorValue] = useState('');
  
  // Refs for debouncing and preventing sync loops
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingFromUIRef = useRef(false);
  const lastParsedTextRef = useRef('');
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

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
        const progressArray = new Array(exercise.sets.length).fill(false);
        
        // Gap recovery mode: mark all exercises as complete by default
        if (isGapRecovery) {
          progressArray.fill(true);
        } else if (parsedExercise) {
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
            
            // Handle granular completion for distance/duration volume rows using new arrays
            let distanceSetIndex = 0;
            let timeSetIndex = 0;
            
            exercise.sets.forEach((set, setIndex) => {
              if (set.volumeType === 'distance') {
                // Map to specific distance entry completion status
                if (parsedExercise.distances && distanceSetIndex < parsedExercise.distances.length) {
                  const distanceEntry = parsedExercise.distances[distanceSetIndex];
                  if (setIndex < progressArray.length) {
                    progressArray[setIndex] = distanceEntry.done || false;
                  }
                  distanceSetIndex++;
                } else if (parsedExercise.distanceDone) {
                  // Fallback to legacy logic
                  if (setIndex < progressArray.length) {
                    progressArray[setIndex] = true;
                  }
                }
              } else if (set.volumeType === 'duration') {
                // Map to specific time entry completion status
                if (parsedExercise.times && timeSetIndex < parsedExercise.times.length) {
                  const timeEntry = parsedExercise.times[timeSetIndex];
                  if (setIndex < progressArray.length) {
                    progressArray[setIndex] = timeEntry.done || false;
                  }
                  timeSetIndex++;
                } else if (parsedExercise.timeDone) {
                  // Fallback to legacy logic
                  if (setIndex < progressArray.length) {
                    progressArray[setIndex] = true;
                  }
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
        
        // REMOVED: Progress preservation logic that overrode user intent
        // Text editor is the source of truth - always respect what user typed
        
        newProgress[exercise.id] = progressArray;
      });

      // Update both workout structure and progress atomically
      onWorkoutAndProgressUpdate(newWorkout, newProgress);
      lastParsedTextRef.current = text;
    } catch (error) {
      console.error('Error parsing workout text:', error);
    }
  }, [onWorkoutAndProgressUpdate]); // Removed workout/progress deps to prevent function recreation

  const syncUIToText = useCallback(() => {
    isUpdatingFromUIRef.current = true;
    
    const generatedText = generateTextFromState();
    setTextEditorValue(generatedText);
    lastParsedTextRef.current = generatedText;
    
    // Reset flag immediately after setting the text
    // The flag is only to prevent the immediate handleTextChange from triggering
    isUpdatingFromUIRef.current = false;
  }, [generateTextFromState]);

  const syncTextToUI = useCallback(() => {
    parseTextToState(textEditorValue);
  }, [textEditorValue, parseTextToState]);

  // Simple text change handler - always sync text to state
  const handleTextChange = useCallback((newText: string) => {
    setTextEditorValue(newText);
    
    if (!enableRealtimeSync) return;
    
    // Don't sync if we're updating from UI to prevent loops
    if (isUpdatingFromUIRef.current) return;
    
    // Don't sync if text hasn't actually changed from last parse
    if (newText === lastParsedTextRef.current) return;
    
    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Debounce the parsing to avoid performance issues while typing
    debounceTimeoutRef.current = setTimeout(() => {
      parseTextToState(newText); // Always sync - no blocking!
    }, 300); // Back to 300ms for responsiveness
  }, [enableRealtimeSync, parseTextToState]); // parseTextToState is now stable

  // No automatic state-to-text sync - only manual via syncUIToText

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    textEditorValue,
    setTextEditorValue: handleTextChange, // Always syncs text to state
    syncUIToText,
    syncTextToUI,
    generateTextFromState,
    parseTextToState,
    textAreaRef // Expose ref for cursor position management
  };
}
