import { useState, useEffect, useCallback } from 'react';
import type { Workout, Exercise, ExerciseSet } from '@/types/fitness';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  Clock, 
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { ComprehensiveWorkoutParser } from '@/lib/comprehensiveWorkoutParser';

interface WorkoutExecutionModeProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onWorkoutUpdate: (updatedWorkout: Workout) => void;
}

// Unified state that contains both structure and progress
interface WorkoutExecutionState {
  workout: Workout;
  progress: { [exerciseId: string]: boolean[] };
}

// Volume row interface for collapsed view
interface VolumeRow {
  type: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance';
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
 * Enhanced workout execution mode with unified state and full UI functionality
 */
export function WorkoutExecutionMode({ 
  workout, 
  isOpen, 
  onClose, 
  onComplete,
  onWorkoutUpdate
}: WorkoutExecutionModeProps) {
  
  // UNIFIED STATE - Single source of truth
  const [executionState, setExecutionState] = useState<WorkoutExecutionState>(() => ({
    workout: workout,
    progress: workout.exercises.reduce((acc, exercise) => {
      acc[exercise.id] = new Array(exercise.sets.length).fill(false);
      return acc;
    }, {} as { [exerciseId: string]: boolean[] })
  }));

  // UI state
  const [activeTab, setActiveTab] = useState<'ui' | 'text'>('ui');
  const [viewMode, setViewMode] = useState<'expanded' | 'collapsed'>('collapsed');
  const [textEditorValue, setTextEditorValue] = useState('');
  
  // Local input management for field editing
  const [localInputValues, setLocalInputValues] = useState<{ [key: string]: string }>({});
  const [localVolumeRowValues, setLocalVolumeRowValues] = useState<{ [key: string]: string }>({});

  // Load user preferences
  useEffect(() => {
    const savedActiveTab = localStorage.getItem('workout-execution-active-tab') as 'ui' | 'text' | null;
    const savedViewMode = localStorage.getItem('workout-execution-view-mode') as 'expanded' | 'collapsed' | null;
    
    if (savedActiveTab) setActiveTab(savedActiveTab);
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  // Save user preferences
  useEffect(() => {
    localStorage.setItem('workout-execution-active-tab', activeTab);
    localStorage.setItem('workout-execution-view-mode', viewMode);
  }, [activeTab, viewMode]);

  // Sync executionState when workout prop changes
  useEffect(() => {
    console.log(`🔄 [USEEFFECT] Workout prop changed, updating execution state`);
    console.log(`🔄 [USEEFFECT] New workout:`, workout.exercises.map(ex => ({ name: ex.name, setsCount: ex.sets.length })));
    
    setExecutionState(prev => {
      console.log(`🔄 [USEEFFECT] Previous progress:`, prev.progress);
      
      const newProgress = workout.exercises.reduce((acc, exercise) => {
        // Try to preserve existing progress
        const existingProgress = prev.progress[exercise.id];
        if (existingProgress && existingProgress.length === exercise.sets.length) {
          console.log(`🔄 [USEEFFECT] Preserving progress for ${exercise.name}:`, existingProgress);
          acc[exercise.id] = existingProgress;
        } else {
          console.log(`🔄 [USEEFFECT] Resetting progress for ${exercise.name} (length mismatch: ${existingProgress?.length} vs ${exercise.sets.length})`);
          acc[exercise.id] = new Array(exercise.sets.length).fill(false);
        }
        return acc;
      }, {} as { [exerciseId: string]: boolean[] });
      
      console.log(`🔄 [USEEFFECT] New progress from useEffect:`, newProgress);
      
      return {
        workout: workout,
        progress: newProgress
      };
    });
  }, [workout]);

  // CONVERSION FUNCTIONS - State ↔ Representations

  // State → Text
  const generateTextFromState = useCallback((): string => {
    return ComprehensiveWorkoutParser.generateWorkoutText(
      executionState.workout, 
      executionState.progress
    );
  }, [executionState]);

  // Initialize text editor when executionState changes
  useEffect(() => {
    if (activeTab === 'text') {
      setTextEditorValue(generateTextFromState());
    }
  }, [executionState, activeTab, generateTextFromState]);

  // Text → State
  const parseTextToState = (text: string): void => {
    try {
      console.log(`🔧 [PARSE START] Parsing text:`, JSON.stringify(text));
      const parsed = ComprehensiveWorkoutParser.parseWorkoutText(text);
      console.log(`🔧 [PARSE RESULT] Parsed workout:`, JSON.stringify(parsed, null, 2));
      
      // Progress will be calculated after conversion to ensure it matches final structure

      // Convert parsed exercises to Exercise format, preserving IDs
      const exercises = ComprehensiveWorkoutParser.convertToExercises(parsed, executionState.workout);
      console.log(`🔧 [CONVERT RESULT] Converted exercises:`, JSON.stringify(exercises, null, 2));
      
      // Map back to original exercise IDs to maintain consistency
      const updatedExercises = exercises.map((exercise, index) => {
        const originalExercise = executionState.workout.exercises[index];
        if (originalExercise) {
          return { ...exercise, id: originalExercise.id };
        }
        return exercise;
      });

      const newWorkout: Workout = {
        ...executionState.workout,
        exercises: updatedExercises
      };
      
      console.log(`🔧 [NEW WORKOUT] Final workout structure:`, JSON.stringify(newWorkout, null, 2));

      // Recalculate progress based on final exercise structure and parsed completion data
      const newProgress: { [exerciseId: string]: boolean[] } = {};
      
      newWorkout.exercises.forEach((exercise, exerciseIndex) => {
        const parsedExercise = parsed.workout[exerciseIndex];
        const existingProgress = executionState.progress[exercise.id] || [];
        const progressArray = new Array(exercise.sets.length).fill(false);
        
        console.log(`🔧 [PROGRESS CALC] Exercise ${exerciseIndex} (${exercise.name}):`, {
          parsedExercise: parsedExercise,
          finalSetsCount: exercise.sets.length,
          existingProgress: existingProgress,
          initialProgressArray: [...progressArray]
        });
        
        if (parsedExercise) {
          // Handle set-based completion (3x10x25kg ++)
          if (parsedExercise.sets && parsedExercise.sets.length > 0) {
            console.log(`🔧 [PROGRESS CALC] Processing set-based completion for ${exercise.name}`);
            let setIndex = 0;
            parsedExercise.sets.forEach(parsedSet => {
              const setsCompleted = parsedSet.sets_done || 0;
              const setsPlanned = parsedSet.sets_planned;
              console.log(`🔧 [PROGRESS CALC] Set: ${setsCompleted}/${setsPlanned} completed`);
              
              for (let i = 0; i < setsPlanned; i++) {
                if (setIndex < progressArray.length) {
                  progressArray[setIndex] = i < setsCompleted;
                  setIndex++;
                }
              }
            });
          }
          
          // Handle granular completion for distance/duration volume rows
          console.log(`🔧 [PROGRESS CALC] Checking granular completion for ${exercise.name}:`, {
            distanceDone: parsedExercise.distanceDone,
            timeDone: parsedExercise.timeDone,
            generalDone: parsedExercise.done
          });
          
          // Apply completion to specific volume row types
          exercise.sets.forEach((set, setIndex) => {
            if (set.volumeType === 'distance' && parsedExercise.distanceDone) {
              console.log(`🔧 [PROGRESS CALC] ✅ Marking distance set at index ${setIndex} as complete`);
              if (setIndex < progressArray.length) {
                progressArray[setIndex] = true;
              }
            } else if (set.volumeType === 'duration' && parsedExercise.timeDone) {
              console.log(`🔧 [PROGRESS CALC] ✅ Marking duration set at index ${setIndex} as complete`);
              if (setIndex < progressArray.length) {
                progressArray[setIndex] = true;
              }
            }
          });
          
          // Handle pure distance/duration exercises (no sets, just distance/time)
          const hasNoSets = !parsedExercise.sets || parsedExercise.sets.length === 0;
          if (hasNoSets && parsedExercise.done) {
            console.log(`🔧 [PROGRESS CALC] ✅ Pure distance/duration exercise - marking first set complete`);
            if (progressArray.length > 0) {
              progressArray[0] = true;
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
        
        console.log(`🔧 [PROGRESS CALC] Final progress for ${exercise.name}:`, progressArray);
        newProgress[exercise.id] = progressArray;
      });

      console.log(`🔧 [PROGRESS FINAL] Complete new progress:`, newProgress);
      console.log(`🔧 [STATE UPDATE] Updating execution state...`);

      setExecutionState({
        workout: newWorkout,
        progress: newProgress
      });
      onWorkoutUpdate(newWorkout);
      
      console.log(`🔧 [PARENT UPDATE] Called onWorkoutUpdate`);
      
      // Clear local input values to force re-sync with new workout structure
      setLocalInputValues({});
      setLocalVolumeRowValues({});
      
    } catch (error) {
      console.error('Error parsing workout text:', error);
    }
  };

  // STATE UPDATE FUNCTIONS

  const updateProgress = (exerciseId: string, setIndex: number, completed: boolean): void => {
    setExecutionState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [exerciseId]: prev.progress[exerciseId]?.map((isCompleted, index) => 
          index === setIndex ? completed : isCompleted
        ) || []
      }
    }));
  };

  const updateWorkoutStructure = (newWorkout: Workout): void => {
    // When workout structure changes, preserve existing progress where possible
    const newProgress: { [exerciseId: string]: boolean[] } = {};
    
    newWorkout.exercises.forEach(exercise => {
      const existingProgress = executionState.progress[exercise.id] || [];
      const newProgressArray = new Array(exercise.sets.length).fill(false);
      
      // Preserve existing progress for the sets that still exist
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
    
    // Clear local volume row values to force re-sync with new workout structure
    setLocalVolumeRowValues({});
  };

  // TAB SYNC LOGIC

  const handleTabChange = (value: string): void => {
    const newTab = value as 'ui' | 'text';
    
    console.log(`🔄 [TAB SWITCH] ${activeTab} → ${newTab}`);
    console.log(`📊 [BEFORE SWITCH] Current state:`, {
      workout: executionState.workout.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.map(set => ({
          volumeType: set.volumeType,
          notes: set.notes,
          duration: set.duration,
          distanceUnit: set.distanceUnit
        }))
      })),
      progress: executionState.progress
    });
    
    if (newTab === 'text' && activeTab === 'ui') {
      // Switching from UI to text: generate text from current state
      console.log(`📝 [UI → TEXT] Generating text from state...`);
      const generatedText = generateTextFromState();
      console.log(`📝 [UI → TEXT] Generated text:`, JSON.stringify(generatedText));
      setTextEditorValue(generatedText);
    } else if (newTab === 'ui' && activeTab === 'text') {
      // Switching from text to UI: parse text and update state
      console.log(`🔧 [TEXT → UI] Parsing text to state...`);
      console.log(`🔧 [TEXT → UI] Text content:`, JSON.stringify(textEditorValue));
      parseTextToState(textEditorValue);
    }
    
    setActiveTab(newTab);
    
    // Log state after tab change (with a small delay to catch async updates)
    setTimeout(() => {
      console.log(`📊 [AFTER SWITCH] New state:`, {
        workout: executionState.workout.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets.map(set => ({
            volumeType: set.volumeType,
            notes: set.notes,
            duration: set.duration,
            distanceUnit: set.distanceUnit
          }))
        })),
        progress: executionState.progress
      });
      console.log(`🔄 [TAB SWITCH COMPLETE] Now on ${newTab} tab`);
      console.log('---');
    }, 100);
  };

  // INPUT FIELD MANAGEMENT

  const getInputKey = (exerciseId: string, setIndex: number, field: string): string => 
    `${exerciseId}-${setIndex}-${field}`;

  const getVolumeRowKey = (exerciseId: string, rowIndex: number, field: string): string => 
    `${exerciseId}-${rowIndex}-${field}`;

  const handleInputChange = (exerciseId: string, setIndex: number, field: string, value: string): void => {
    const key = getInputKey(exerciseId, setIndex, field);
    setLocalInputValues(prev => ({ ...prev, [key]: value }));
    
    // Sync to state immediately if value is valid
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      updateSetField(exerciseId, setIndex, field, numericValue);
    }
  };

  const handleVolumeRowInputChange = (exerciseId: string, rowIndex: number, field: string, value: string): void => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    setLocalVolumeRowValues(prev => ({ ...prev, [key]: value }));
    
    // Sync to state immediately if value is valid
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      updateVolumeRow(exerciseId, rowIndex, { [field]: numericValue });
    }
  };

  const handleInputBlur = (exerciseId: string, setIndex: number, field: string, defaultValue: number): void => {
    const key = getInputKey(exerciseId, setIndex, field);
    const currentValue = localInputValues[key];
    const numericValue = parseFloat(currentValue);
    
    // Only handle invalid/empty values on blur (valid values are already synced on change)
    if (isNaN(numericValue) || numericValue <= 0) {
      setLocalInputValues(prev => ({ ...prev, [key]: defaultValue.toString() }));
      updateSetField(exerciseId, setIndex, field, defaultValue);
    }
  };

  const handleVolumeRowInputBlur = (exerciseId: string, rowIndex: number, field: string, defaultValue: number): void => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    const currentValue = localVolumeRowValues[key];
    const numericValue = parseFloat(currentValue);
    
    // Only handle invalid/empty values on blur (valid values are already synced on change)
    if (isNaN(numericValue) || numericValue <= 0) {
      setLocalVolumeRowValues(prev => ({ ...prev, [key]: defaultValue.toString() }));
      updateVolumeRow(exerciseId, rowIndex, { [field]: defaultValue });
    }
  };

  const getInputValue = (exerciseId: string, setIndex: number, field: string, currentValue: number): string => {
    const key = getInputKey(exerciseId, setIndex, field);
    return localInputValues[key] !== undefined ? localInputValues[key] : currentValue.toString();
  };

  const getVolumeRowValue = (exerciseId: string, rowIndex: number, field: string, currentValue: number): string => {
    const key = getVolumeRowKey(exerciseId, rowIndex, field);
    return localVolumeRowValues[key] !== undefined ? localVolumeRowValues[key] : currentValue.toString();
  };

  const updateSetField = (exerciseId: string, setIndex: number, field: string, value: number): void => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            sets: exercise.sets.map((set, index) => {
              if (index === setIndex) {
                const updatedSet = { ...set };
                if (field === 'reps') updatedSet.reps = value;
                if (field === 'weight') updatedSet.weight = value;
                if (field === 'duration') updatedSet.duration = value * 60; // Convert minutes to seconds
                return updatedSet;
              }
              return set;
            })
          };
        }
        return exercise;
      })
    };
    
    updateWorkoutStructure(updatedWorkout);
  };

  // VOLUME ROW MANAGEMENT (for collapsed view)

  const getVolumeRows = (exercise: Exercise): VolumeRow[] => {
    const volumeRows: VolumeRow[] = [];
    const groupedSets: { [volumeRowId: string]: { sets: ExerciseSet[], indices: number[] } } = {};

    exercise.sets.forEach((set, index) => {
      // Group by volumeRowId if it exists, otherwise create a unique key for backward compatibility
      const key = set.volumeRowId || `legacy-${index}`;

      if (!groupedSets[key]) {
        groupedSets[key] = { sets: [], indices: [] };
      }
      groupedSets[key].sets.push(set);
      groupedSets[key].indices.push(index);
    });

    // Convert to array and sort by minimum set index to ensure consistent ordering
    const sortedGroups = Object.entries(groupedSets)
      .map(([volumeRowId, group]) => ({ volumeRowId, ...group }))
      .sort((a, b) => Math.min(...a.indices) - Math.min(...b.indices));

    sortedGroups.forEach((group) => {
      const firstSet = group.sets[0];
      const volumeRow: VolumeRow = {
        type: (firstSet.volumeType || 'sets-reps') as 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance',
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
  };

  const updateVolumeRow = (exerciseId: string, rowIndex: number, updates: Partial<VolumeRow>): void => {
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const volumeRows = getVolumeRows(exercise);
    const volumeRow = volumeRows[rowIndex];
    if (!volumeRow) return;

    const updatedRow = { ...volumeRow, ...updates };

    // Handle totalSets changes - add/remove sets as needed
    let newSets = [...exercise.sets];
    
    // Check if this is a type change to distance/duration (special case)
    const isTypeChangeToSingleSet = updates.type && (updates.type === 'distance' || updates.type === 'duration') && volumeRow.type !== updates.type;
    
    // Check if this is a type change from distance/duration to sets-based (special case)
    const isTypeChangeToMultipleSets = updates.type && (updates.type === 'sets-reps' || updates.type === 'sets-reps-weight') && 
      (volumeRow.type === 'distance' || volumeRow.type === 'duration');
    
    if (isTypeChangeToSingleSet) {
      // Special handling for type change to distance/duration: force to 1 set and update type
      updatedRow.totalSets = 1;
      
      // Keep only the first set and update its properties
      const templateSet = exercise.sets[volumeRow.setIndices[0]];
      const updatedSet: ExerciseSet = {
        ...templateSet,
        reps: updatedRow.reps,
        volumeType: updatedRow.type,
        volumeRowId: templateSet.volumeRowId
      };

      if (updatedRow.type === 'duration') {
        updatedSet.duration = (updatedRow.duration || 0) * 60; // Convert to seconds
      } else if (updatedRow.type === 'distance') {
        updatedSet.notes = `${updatedRow.distance || 0}${updatedRow.distanceUnit || 'km'}`;
        updatedSet.distanceUnit = updatedRow.distanceUnit || templateSet.distanceUnit;
      }

      // Remove all sets from this volume row and add the single updated set at the correct position
      const insertPosition = Math.min(...volumeRow.setIndices);
      newSets = newSets.filter((_, index) => !volumeRow.setIndices.includes(index));
      newSets.splice(insertPosition, 0, updatedSet);
      
    } else if (isTypeChangeToMultipleSets) {
      // Special handling for type change from distance/duration to sets-based: expand to default 3 sets
      updatedRow.totalSets = 3;
      
      // Remove the existing single set and create 3 new sets at the correct position
      const templateSet = exercise.sets[volumeRow.setIndices[0]];
      const insertPosition = Math.min(...volumeRow.setIndices);
      newSets = newSets.filter((_, index) => !volumeRow.setIndices.includes(index));
      
      // Create 3 new sets with the updated type
      const newSetsToInsert: ExerciseSet[] = [];
      for (let i = 0; i < 3; i++) {
        const newSet: ExerciseSet = {
          reps: updatedRow.reps || 10, // Default to 10 reps
          restTime: templateSet.restTime,
          notes: '',
          volumeType: updatedRow.type,
          volumeRowId: templateSet.volumeRowId // Preserve the same volumeRowId
        };

        if (updatedRow.type === 'sets-reps-weight') {
          newSet.weight = updatedRow.weight || 0;
          newSet.weightUnit = updatedRow.weightUnit || 'kg';
        }

        newSetsToInsert.push(newSet);
      }
      
      // Insert all new sets at the correct position
      newSets.splice(insertPosition, 0, ...newSetsToInsert);
      
    } else if (updates.totalSets !== undefined && updates.totalSets !== volumeRow.totalSets) {
      // Handle explicit totalSets changes (not from type change)
      const setsDifference = updates.totalSets - volumeRow.totalSets;
      
      if (setsDifference > 0) {
        // Add new sets with same properties as existing ones at the end of this volume row
        const templateSet = exercise.sets[volumeRow.setIndices[0]]; // Use first set as template
        const insertPosition = Math.max(...volumeRow.setIndices) + 1; // Insert after the last set of this volume row
        const newSetsToInsert: ExerciseSet[] = [];
        
        for (let i = 0; i < setsDifference; i++) {
          const newSet: ExerciseSet = {
            reps: updatedRow.reps,
            restTime: templateSet.restTime,
            notes: templateSet.notes,
            volumeType: updatedRow.type,
            volumeRowId: templateSet.volumeRowId // Preserve the same volumeRowId
          };

          if (updatedRow.type === 'sets-reps-weight') {
            newSet.weight = updatedRow.weight || templateSet.weight || 0;
            newSet.weightUnit = updatedRow.weightUnit || templateSet.weightUnit || 'kg';
          } else if (updatedRow.type === 'duration') {
            newSet.duration = (updatedRow.duration || 0) * 60; // Convert to seconds
          } else if (updatedRow.type === 'distance') {
            newSet.notes = `${updatedRow.distance || 0}${updatedRow.distanceUnit || 'km'}`;
            newSet.distanceUnit = updatedRow.distanceUnit || templateSet.distanceUnit;
          }

          newSetsToInsert.push(newSet);
        }
        
        // Insert new sets at the correct position
        newSets.splice(insertPosition, 0, ...newSetsToInsert);
      } else if (setsDifference < 0) {
        // Remove sets from the end of this volume row
        const setsToRemove = Math.abs(setsDifference);
        const indicesToRemove = volumeRow.setIndices.slice(-setsToRemove);
        newSets = newSets.filter((_, index) => !indicesToRemove.includes(index));
      }
    } else {
      // Update existing sets in this volume row (no count change, no type change to single set)
      newSets = newSets.map((set, setIndex) => {
        if (volumeRow.setIndices.includes(setIndex)) {
          const newSet: ExerciseSet = {
            ...set,
            reps: updatedRow.reps,
            restTime: set.restTime,
            notes: set.notes,
            volumeType: updatedRow.type,
            volumeRowId: set.volumeRowId // Preserve existing volumeRowId
          };

          if (updatedRow.type === 'sets-reps-weight') {
            newSet.weight = updatedRow.weight || 0;
            newSet.weightUnit = updatedRow.weightUnit || 'kg';
          } else if (updatedRow.type === 'duration') {
            newSet.duration = (updatedRow.duration || 0) * 60; // Convert to seconds
          } else if (updatedRow.type === 'distance') {
            newSet.notes = `${updatedRow.distance || 0}${updatedRow.distanceUnit || 'km'}`;
            newSet.distanceUnit = updatedRow.distanceUnit;
          }

          return newSet;
        }
        return set;
      });
    }

    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, sets: newSets } : ex
      )
    };

    updateWorkoutStructure(updatedWorkout);
    
    // Force immediate progress sync for this specific exercise to ensure checkboxes match
    const updatedExercise = updatedWorkout.exercises.find(ex => ex.id === exerciseId);
    if (updatedExercise) {
      const currentProgress = executionState.progress[exerciseId] || [];
      const newProgressArray = new Array(updatedExercise.sets.length).fill(false);
      
      // Preserve existing progress where possible
      for (let i = 0; i < Math.min(currentProgress.length, newProgressArray.length); i++) {
        newProgressArray[i] = currentProgress[i];
      }
      
      // Update progress immediately
      setExecutionState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          [exerciseId]: newProgressArray
        }
      }));
    }
  };

  // DERIVED VALUES FROM STATE

  const getExerciseProgress = (exerciseId: string) => {
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
  };

  const getOverallProgress = () => {
    const allProgress = Object.values(executionState.progress).flat();
    const completedCount = allProgress.filter(Boolean).length;
    const totalCount = allProgress.length;
    
    return {
      completedCount,
      totalCount,
      percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0
    };
  };

  // EVENT HANDLERS

  const handleCompleteWorkout = (): void => {
    onComplete();
  };

  const toggleSetCompletion = (exerciseId: string, setIndex: number): void => {
    const currentProgress = executionState.progress[exerciseId] || [];
    const isCurrentlyCompleted = currentProgress[setIndex] || false;
    const newState = !isCurrentlyCompleted;
    
    console.log(`☑️ [CHECKBOX TOGGLE] Exercise: ${exerciseId}, Set: ${setIndex}, ${isCurrentlyCompleted} → ${newState}`);
    console.log(`☑️ [CHECKBOX TOGGLE] Current progress for exercise:`, currentProgress);
    
    updateProgress(exerciseId, setIndex, newState);
    
    // Log after update
    setTimeout(() => {
      const updatedProgress = executionState.progress[exerciseId] || [];
      console.log(`☑️ [CHECKBOX UPDATED] New progress for exercise:`, updatedProgress);
    }, 50);
  };

  const toggleExerciseCompletion = (exerciseId: string): void => {
    const currentProgress = executionState.progress[exerciseId] || [];
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    // Check if all sets are currently completed
    const allCompleted = currentProgress.every(Boolean) && currentProgress.length === exercise.sets.length;
    
    // Set all sets to the opposite of current state
    const newProgress = new Array(exercise.sets.length).fill(!allCompleted);
    
    setExecutionState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [exerciseId]: newProgress
      }
    }));
  };

  const addExercise = (): void => {
    const newExercise: Exercise = {
      id: `exercise_${Date.now()}_${Math.random()}`,
      name: 'New Exercise',
      category: 'General',
      muscleGroups: [],
      equipment: [],
      instructions: '',
      sets: [{
        reps: 10,
        restTime: 90,
        notes: '',
        volumeType: 'sets-reps',
        volumeRowId: `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }]
    };

    const updatedWorkout = {
      ...executionState.workout,
      exercises: [...executionState.workout.exercises, newExercise]
    };

    updateWorkoutStructure(updatedWorkout);
  };

  const removeExercise = (exerciseId: string): void => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.filter(ex => ex.id !== exerciseId)
    };

    updateWorkoutStructure(updatedWorkout);
  };

  const addVolumeRow = (exerciseId: string): void => {
    // Generate unique volumeRowId for this new volume row
    const volumeRowId = `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create 3 sets with the same volumeRowId (default: 3x10 sets-reps)
    const newSets: ExerciseSet[] = Array.from({ length: 3 }, () => ({
      reps: 10,
      restTime: 90,
      notes: '',
      volumeType: 'sets-reps',
      volumeRowId
    }));

    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            sets: [...exercise.sets, ...newSets]
          };
        }
        return exercise;
      })
    };

    updateWorkoutStructure(updatedWorkout);
  };

  const removeVolumeRow = (exerciseId: string, rowIndex: number): void => {
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const volumeRows = getVolumeRows(exercise);
    const volumeRow = volumeRows[rowIndex];
    if (!volumeRow) return;

    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => {
        if (ex.id === exerciseId) {
          return {
            ...ex,
            sets: ex.sets.filter((_, setIndex) => !volumeRow.setIndices.includes(setIndex))
          };
        }
        return ex;
      })
    };

    updateWorkoutStructure(updatedWorkout);
  };

  // Initialize local input values (only add missing keys, preserve existing ones)
  useEffect(() => {
    setLocalInputValues(prev => {
      const newValues = { ...prev };
      
      executionState.workout.exercises.forEach(exercise => {
        exercise.sets.forEach((set, setIndex) => {
          const repsKey = getInputKey(exercise.id, setIndex, 'reps');
          const weightKey = getInputKey(exercise.id, setIndex, 'weight');
          const durationKey = getInputKey(exercise.id, setIndex, 'duration');
          
          // Only initialize if key doesn't exist (preserve user input)
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

    setLocalVolumeRowValues(prev => {
      const newVolumeRowValues = { ...prev };
      
      executionState.workout.exercises.forEach(exercise => {
        // Initialize volume row values for collapsed view
        const volumeRows = getVolumeRows(exercise);
        volumeRows.forEach((volumeRow, rowIndex) => {
          const totalSetsKey = getVolumeRowKey(exercise.id, rowIndex, 'totalSets');
          const repsKey = getVolumeRowKey(exercise.id, rowIndex, 'reps');
          const weightKey = getVolumeRowKey(exercise.id, rowIndex, 'weight');
          const durationKey = getVolumeRowKey(exercise.id, rowIndex, 'duration');
          const distanceKey = getVolumeRowKey(exercise.id, rowIndex, 'distance');
          
          // Only initialize if key doesn't exist (preserve user input)
          if (newVolumeRowValues[totalSetsKey] === undefined) {
            newVolumeRowValues[totalSetsKey] = volumeRow.totalSets.toString();
          }
          if (newVolumeRowValues[repsKey] === undefined) {
            newVolumeRowValues[repsKey] = volumeRow.reps.toString();
          }
          if (volumeRow.weight !== undefined && newVolumeRowValues[weightKey] === undefined) {
            newVolumeRowValues[weightKey] = volumeRow.weight.toString();
          }
          if (volumeRow.duration !== undefined && newVolumeRowValues[durationKey] === undefined) {
            newVolumeRowValues[durationKey] = volumeRow.duration.toString();
          }
          if (volumeRow.distance !== undefined && newVolumeRowValues[distanceKey] === undefined) {
            newVolumeRowValues[distanceKey] = volumeRow.distance.toString();
          }
        });
      });
      
      return newVolumeRowValues;
    });
  }, [executionState.workout]);

  const overallProgress = getOverallProgress();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Input
                value={executionState.workout.name}
                onChange={(e) => {
                  const updatedWorkout = { ...executionState.workout, name: e.target.value };
                  updateWorkoutStructure(updatedWorkout);
                }}
                className="text-xl font-bold flex-1"
                placeholder="Workout name"
              />
              <Badge variant="outline">
                {overallProgress.completedCount}/{overallProgress.totalCount} sets
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with workout info and progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm">Duration:</Label>
                  <Input
                    type="number"
                    value={executionState.workout.estimatedDuration}
                    onChange={(e) => {
                      const updatedWorkout = { 
                        ...executionState.workout, 
                        estimatedDuration: parseInt(e.target.value) || 0 
                      };
                      updateWorkoutStructure(updatedWorkout);
                    }}
                    className="w-20 h-8"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Progress: {Math.round(overallProgress.percentage)}%</span>
              </div>
            </div>
            <Progress value={overallProgress.percentage} className="h-2" />
          </div>

          {/* Tabs for UI and Text editing */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ui">UI Editor</TabsTrigger>
              <TabsTrigger value="text">Text Editor</TabsTrigger>
            </TabsList>
            
            {/* View mode toggle (only for UI tab) */}
            {activeTab === 'ui' && (
              <div className="flex space-x-2 mt-4">
                <Button
                  variant={viewMode === 'collapsed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('collapsed')}
                >
                  Collapsed
                </Button>
                <Button
                  variant={viewMode === 'expanded' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('expanded')}
                >
                  Expanded
                </Button>
              </div>
            )}

            <TabsContent value="ui" className="space-y-4">
              <div className="space-y-4">
                {executionState.workout.exercises.map((exercise) => {
                  const exerciseProgress = getExerciseProgress(exercise.id);
                  
                  return (
                    <Card 
                      key={exercise.id} 
                      className={`relative transition-colors ${
                        exerciseProgress.isCompleted 
                          ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                          : ''
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Checkbox
                              checked={exerciseProgress.isCompleted}
                              onCheckedChange={() => toggleExerciseCompletion(exercise.id)}
                              className="mt-1"
                            />
                            <Input
                              value={exercise.name}
                              onChange={(e) => {
                                const updatedWorkout = {
                                  ...executionState.workout,
                                  exercises: executionState.workout.exercises.map(ex => 
                                    ex.id === exercise.id ? { ...ex, name: e.target.value } : ex
                                  )
                                };
                                updateWorkoutStructure(updatedWorkout);
                              }}
                              className="text-lg font-semibold border-none p-0 h-auto bg-transparent"
                              placeholder="Exercise name"
                            />
                            {exerciseProgress.isCompleted && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={exerciseProgress.isCompleted ? 'default' : 'secondary'}
                              className={exerciseProgress.isCompleted ? 'bg-green-600' : ''}
                            >
                              {exerciseProgress.completedCount}/{exerciseProgress.totalCount}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExercise(exercise.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {exerciseProgress.totalCount > 0 && (
                          <Progress 
                            value={exerciseProgress.percentage} 
                            className={`h-1 ${
                              exerciseProgress.isCompleted 
                                ? '[&>div]:bg-green-600' 
                                : ''
                            }`} 
                          />
                        )}
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        {viewMode === 'expanded' ? (
                          // Expanded view - one row per set
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Sets</Label>
                            {exercise.sets.map((set, setIndex) => {
                              const isCompleted = exerciseProgress.completedSets[setIndex] || false;
                              return (
                                <div 
                                  key={setIndex} 
                                  className={`flex items-center space-x-3 p-2 border rounded transition-colors ${
                                    isCompleted 
                                      ? 'bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700' 
                                      : ''
                                  }`}
                                >
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => toggleSetCompletion(exercise.id, setIndex)}
                                  />
                                  <span className="text-sm w-8">#{setIndex + 1}</span>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Label className="text-xs">Reps:</Label>
                                    <Input
                                      type="number"
                                      value={getInputValue(exercise.id, setIndex, 'reps', set.reps)}
                                      onChange={(e) => handleInputChange(exercise.id, setIndex, 'reps', e.target.value)}
                                      onBlur={() => handleInputBlur(exercise.id, setIndex, 'reps', 1)}
                                      className="w-16 h-7 text-xs"
                                      min="1"
                                    />
                                  </div>

                                  {set.volumeType === 'sets-reps-weight' && (
                                    <>
                                      <div className="flex items-center space-x-2">
                                        <Label className="text-xs">Weight:</Label>
                                        <Input
                                          type="number"
                                          value={getInputValue(exercise.id, setIndex, 'weight', set.weight || 0)}
                                          onChange={(e) => handleInputChange(exercise.id, setIndex, 'weight', e.target.value)}
                                          onBlur={() => handleInputBlur(exercise.id, setIndex, 'weight', 0)}
                                          className="w-16 h-7 text-xs"
                                          min="0"
                                          step="0.5"
                                        />
                                        <Select
                                          value={set.weightUnit || 'kg'}
                                          onValueChange={(value) => {
                                            const updatedWorkout = {
                                              ...executionState.workout,
                                              exercises: executionState.workout.exercises.map(ex => {
                                                if (ex.id === exercise.id) {
                                                  return {
                                                    ...ex,
                                                    sets: ex.sets.map((s, i) => 
                                                      i === setIndex ? { ...s, weightUnit: value as 'kg' | 'lb' } : s
                                                    )
                                                  };
                                                }
                                                return ex;
                                              })
                                            };
                                            updateWorkoutStructure(updatedWorkout);
                                          }}
                                        >
                                          <SelectTrigger className="w-16 h-7 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="kg">kg</SelectItem>
                                            <SelectItem value="lb">lb</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {set.volumeType === 'duration' && (
                                    <div className="flex items-center space-x-2">
                                      <Label className="text-xs">Duration (min):</Label>
                                      <Input
                                        type="number"
                                        value={getInputValue(exercise.id, setIndex, 'duration', (set.duration || 0) / 60)}
                                        onChange={(e) => handleInputChange(exercise.id, setIndex, 'duration', e.target.value)}
                                        onBlur={() => handleInputBlur(exercise.id, setIndex, 'duration', 1)}
                                        className="w-16 h-7 text-xs"
                                        min="0"
                                        step="0.5"
                                      />
                                    </div>
                                  )}

                                  {set.volumeType === 'distance' && (
                                    <div className="flex items-center space-x-2">
                                      <Label className="text-xs">Distance:</Label>
                                      <Input
                                        type="number"
                                        value={parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0')}
                                        onChange={(e) => {
                                          const updatedWorkout = {
                                            ...executionState.workout,
                                            exercises: executionState.workout.exercises.map(ex => {
                                              if (ex.id === exercise.id) {
                                                return {
                                                  ...ex,
                                                  sets: ex.sets.map((s, i) => 
                                                    i === setIndex ? { 
                                                      ...s, 
                                                      notes: `${e.target.value}${s.distanceUnit || 'km'}` 
                                                    } : s
                                                  )
                                                };
                                              }
                                              return ex;
                                            })
                                          };
                                          updateWorkoutStructure(updatedWorkout);
                                        }}
                                        className="w-16 h-7 text-xs"
                                        min="0"
                                        step="0.1"
                                      />
                                      <Select
                                        value={set.distanceUnit || 'km'}
                                        onValueChange={(value) => {
                                          const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
                                          const updatedWorkout = {
                                            ...executionState.workout,
                                            exercises: executionState.workout.exercises.map(ex => {
                                              if (ex.id === exercise.id) {
                                                return {
                                                  ...ex,
                                                  sets: ex.sets.map((s, i) => 
                                                    i === setIndex ? { 
                                                      ...s, 
                                                      distanceUnit: value as 'km' | 'mi' | 'm',
                                                      notes: `${distance}${value}`
                                                    } : s
                                                  )
                                                };
                                              }
                                              return ex;
                                            })
                                          };
                                          updateWorkoutStructure(updatedWorkout);
                                        }}
                                      >
                                        <SelectTrigger className="w-16 h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="km">km</SelectItem>
                                          <SelectItem value="mi">mi</SelectItem>
                                          <SelectItem value="m">m</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          // Collapsed view - grouped by volume type
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Volume</Label>
                            {getVolumeRows(exercise).map((volumeRow, rowIndex) => {
                              const completedCount = volumeRow.setIndices.filter(setIndex => 
                                exerciseProgress.completedSets[setIndex]
                              ).length;
                              const isRowCompleted = completedCount === volumeRow.totalSets;
                              
                              return (
                                <div 
                                  key={rowIndex} 
                                  className={`grid grid-cols-12 gap-2 items-end p-2 border rounded transition-colors ${
                                    isRowCompleted 
                                      ? 'bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700' 
                                      : ''
                                  }`}
                                >
                                  {/* Checkboxes */}
                                  <div className="col-span-2 flex space-x-1">
                                    {volumeRow.setIndices.map(setIndex => (
                                      <Checkbox
                                        key={setIndex}
                                        checked={exerciseProgress.completedSets[setIndex] || false}
                                        onCheckedChange={() => toggleSetCompletion(exercise.id, setIndex)}
                                      />
                                    ))}
                                  </div>

                                  {/* Volume Type */}
                                  <div className="col-span-2 space-y-1">
                                    <Label className="text-xs">Type</Label>
                                    <Select
                                      value={volumeRow.type}
                                      onValueChange={(value) => {
                                        updateVolumeRow(exercise.id, rowIndex, { 
                                          type: value as 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance'
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sets-reps">Sets × Reps</SelectItem>
                                        <SelectItem value="sets-reps-weight">Sets × Reps × Weight</SelectItem>
                                        <SelectItem value="duration">Duration</SelectItem>
                                        <SelectItem value="distance">Distance</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Sets */}
                                  {(volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight') && (
                                    <div className="col-span-1 space-y-1">
                                      <Label className="text-xs">Sets</Label>
                                      <Input
                                        type="number"
                                        value={getVolumeRowValue(exercise.id, rowIndex, 'totalSets', volumeRow.totalSets)}
                                        onChange={(e) => handleVolumeRowInputChange(exercise.id, rowIndex, 'totalSets', e.target.value)}
                                        onBlur={() => handleVolumeRowInputBlur(exercise.id, rowIndex, 'totalSets', 1)}
                                        className="h-8 text-xs"
                                        min="1"
                                        max="10"
                                      />
                                    </div>
                                  )}

                                  {/* Reps */}
                                  {(volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight') && (
                                    <div className="col-span-1 space-y-1">
                                      <Label className="text-xs">Reps</Label>
                                      <Input
                                        type="number"
                                        value={getVolumeRowValue(exercise.id, rowIndex, 'reps', volumeRow.reps)}
                                        onChange={(e) => handleVolumeRowInputChange(exercise.id, rowIndex, 'reps', e.target.value)}
                                        onBlur={() => handleVolumeRowInputBlur(exercise.id, rowIndex, 'reps', 1)}
                                        className="h-8 text-xs"
                                        min="1"
                                      />
                                    </div>
                                  )}

                                  {/* Weight */}
                                  {volumeRow.type === 'sets-reps-weight' && (
                                    <>
                                      <div className="col-span-2 space-y-1">
                                        <Label className="text-xs">Weight</Label>
                                        <Input
                                          type="number"
                                          value={getVolumeRowValue(exercise.id, rowIndex, 'weight', volumeRow.weight || 0)}
                                          onChange={(e) => handleVolumeRowInputChange(exercise.id, rowIndex, 'weight', e.target.value)}
                                          onBlur={() => handleVolumeRowInputBlur(exercise.id, rowIndex, 'weight', 0)}
                                          className="h-8 text-xs"
                                          min="0"
                                          step="0.5"
                                        />
                                      </div>
                                      <div className="col-span-1 space-y-1">
                                        <Label className="text-xs">Unit</Label>
                                        <Select
                                          value={volumeRow.weightUnit || 'kg'}
                                          onValueChange={(value) => {
                                            updateVolumeRow(exercise.id, rowIndex, { 
                                              weightUnit: value as 'kg' | 'lb' 
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="kg">kg</SelectItem>
                                            <SelectItem value="lb">lb</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {/* Duration */}
                                  {volumeRow.type === 'duration' && (
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-xs">Duration (min)</Label>
                                      <Input
                                        type="number"
                                        value={getVolumeRowValue(exercise.id, rowIndex, 'duration', volumeRow.duration || 0)}
                                        onChange={(e) => handleVolumeRowInputChange(exercise.id, rowIndex, 'duration', e.target.value)}
                                        onBlur={() => handleVolumeRowInputBlur(exercise.id, rowIndex, 'duration', 1)}
                                        className="h-8 text-xs"
                                        min="0"
                                        step="0.5"
                                      />
                                    </div>
                                  )}

                                  {/* Distance */}
                                  {volumeRow.type === 'distance' && (
                                    <>
                                      <div className="col-span-2 space-y-1">
                                        <Label className="text-xs">Distance</Label>
                                        <Input
                                          type="number"
                                          value={getVolumeRowValue(exercise.id, rowIndex, 'distance', volumeRow.distance || 0)}
                                          onChange={(e) => handleVolumeRowInputChange(exercise.id, rowIndex, 'distance', e.target.value)}
                                          onBlur={() => handleVolumeRowInputBlur(exercise.id, rowIndex, 'distance', 1)}
                                          className="h-8 text-xs"
                                          min="0"
                                          step="0.1"
                                        />
                                      </div>
                                      <div className="col-span-1 space-y-1">
                                        <Label className="text-xs">Unit</Label>
                                        <Select
                                          value={volumeRow.distanceUnit || 'km'}
                                          onValueChange={(value) => {
                                            updateVolumeRow(exercise.id, rowIndex, { 
                                              distanceUnit: value as 'km' | 'mi' | 'm' 
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="km">km</SelectItem>
                                            <SelectItem value="mi">mi</SelectItem>
                                            <SelectItem value="m">m</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {/* Delete button */}
                                  <div className="col-span-1 flex justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeVolumeRow(exercise.id, rowIndex)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            
                            <Button 
                              onClick={() => addVolumeRow(exercise.id)} 
                              variant="outline" 
                              size="sm"
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Volume
                            </Button>
                          </div>
                        )}

                        {exercise.instructions && (
                          <div className="text-sm text-muted-foreground mt-2">
                            <Label className="text-xs font-medium">Instructions:</Label>
                            <Textarea
                              value={exercise.instructions}
                              onChange={(e) => {
                                const updatedWorkout = {
                                  ...executionState.workout,
                                  exercises: executionState.workout.exercises.map(ex => 
                                    ex.id === exercise.id ? { ...ex, instructions: e.target.value } : ex
                                  )
                                };
                                updateWorkoutStructure(updatedWorkout);
                              }}
                              className="mt-1 min-h-[60px]"
                              placeholder="Exercise instructions or cues..."
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                <Button onClick={addExercise} className="w-full" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exercise
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workout-text" className="text-sm font-medium">
                  Workout Text (with progress tracking)
                </Label>
                <Textarea
                  id="workout-text"
                  value={textEditorValue}
                  onChange={(e) => setTextEditorValue(e.target.value)}
                  placeholder="Edit workout text with progress indicators..."
                  className="min-h-[400px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use + symbols to mark completed sets. Example: "3x10x25kg +++" means all 3 sets completed.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <div className="space-x-2">
              <Button onClick={handleCompleteWorkout}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Workout
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
