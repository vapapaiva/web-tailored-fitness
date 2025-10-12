/**
 * Workout Execution Dialog - Enhanced wrapper for WorkoutExecutionMode
 * Adds date editing functionality and proper state management
 */

import { useState, useEffect } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import type { Workout } from '@/types/fitness';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, RotateCcw, Trash2, X, Calendar } from 'lucide-react';
import { WorkoutExecutionUI } from '@/components/fitness/WorkoutExecutionUI';
import { WorkoutExecutionText } from '@/components/fitness/WorkoutExecutionText';
import { useWorkoutExecution } from '@/hooks/useWorkoutExecution';
import { useTextSync } from '@/hooks/useTextSync';
import { useInputManagement } from '@/hooks/useInputManagement';
import { updateVolumeRow, addVolumeRow, removeVolumeRow, type VolumeRow } from '@/lib/volumeRowUtils';
import type { Exercise } from '@/types/fitness';

interface WorkoutExecutionDialogProps {
  workout: WorkoutDocument;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (workout: WorkoutDocument) => void;
}

/**
 * Workout execution dialog with date editing
 */
export function WorkoutExecutionDialog({ 
  workout, 
  isOpen, 
  onClose,
  onComplete 
}: WorkoutExecutionDialogProps) {
  const { updateWorkout, deleteWorkout, markAsComplete, markAsIncomplete, workouts } = useWorkoutsStore();
  
  // UI state
  const [activeTab, setActiveTab] = useState<'ui' | 'text'>('ui');
  const [viewMode, setViewMode] = useState<'expanded' | 'collapsed'>('collapsed');
  const [dateString, setDateString] = useState(workout.date || '');
  
  // Local workout state
  const [localWorkout, setLocalWorkout] = useState<Workout>(() => ({
    ...workout,
    dayOfWeek: workout.dayOfWeek || 0,
  }));

  // Sync with store updates
  useEffect(() => {
    const latestWorkout = workouts.find(w => w.id === workout.id);
    if (latestWorkout) {
      setLocalWorkout({
        ...latestWorkout,
        dayOfWeek: latestWorkout.dayOfWeek || 0,
      });
      setDateString(latestWorkout.date || '');
    }
  }, [workouts, workout.id]);

  // Custom hooks
  const {
    executionState,
    updateWorkoutStructure,
    updateWorkoutAndProgress,
    toggleSetCompletion,
    toggleExerciseCompletion,
    getExerciseProgress,
    getOverallProgress
  } = useWorkoutExecution({ 
    initialWorkout: localWorkout, 
    onWorkoutUpdate: (updated) => {
      setLocalWorkout(updated);
      handleInternalWorkoutUpdate(updated);
    },
    isGapRecovery: false
  });

  const {
    textEditorValue,
    setTextEditorValue,
    syncUIToText,
    syncTextToUI,
    textAreaRef
  } = useTextSync({ 
    workout: executionState.workout, 
    progress: executionState.progress, 
    onWorkoutAndProgressUpdate: updateWorkoutAndProgress,
    enableRealtimeSync: true,
    isGapRecovery: false
  });

  const {
    getInputValue,
    getVolumeRowValue,
    handleInputChange: handleInputChangeBase,
    handleInputBlur: handleInputBlurBase,
    handleVolumeRowInputChange: handleVolumeRowInputChangeBase,
    handleVolumeRowInputBlur: handleVolumeRowInputBlurBase
  } = useInputManagement(executionState.workout);

  // Save preferences
  useEffect(() => {
    const savedActiveTab = localStorage.getItem('workout-execution-active-tab') as 'ui' | 'text' | null;
    const savedViewMode = localStorage.getItem('workout-execution-view-mode') as 'expanded' | 'collapsed' | null;
    
    if (savedActiveTab) setActiveTab(savedActiveTab);
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  useEffect(() => {
    localStorage.setItem('workout-execution-active-tab', activeTab);
    localStorage.setItem('workout-execution-view-mode', viewMode);
  }, [activeTab, viewMode]);

  // Tab handling
  useEffect(() => {
    if (activeTab === 'text') {
      syncUIToText();
    }
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    const newTab = value as 'ui' | 'text';
    if (newTab === 'text' && activeTab === 'ui') {
      syncUIToText();
    } else if (newTab === 'ui' && activeTab === 'text') {
      syncTextToUI();
    }
    setActiveTab(newTab);
  };

  const handleInternalWorkoutUpdate = (updatedWorkout: Workout) => {
    // Check if all exercises are now complete
    const allExercisesComplete = updatedWorkout.exercises.length > 0 && 
      updatedWorkout.exercises.every(exercise => 
        exercise.sets.every(set => set.completed)
      );
    
    // Auto-complete workout if all exercises are done
    const shouldAutoComplete = allExercisesComplete && workout.status !== 'completed';
    
    // Update in store (async, silent)
    updateWorkout(workout.id, {
      name: updatedWorkout.name,
      type: updatedWorkout.type,
      focus: updatedWorkout.focus,
      value: updatedWorkout.value,
      exercises: updatedWorkout.exercises,
      estimatedDuration: updatedWorkout.estimatedDuration,
      actualDuration: updatedWorkout.actualDuration,
      notes: updatedWorkout.notes,
      checkIns: updatedWorkout.checkIns,
      // Auto-complete if all exercises are done
      ...(shouldAutoComplete && {
        status: 'completed' as const,
        completedAt: new Date().toISOString()
      })
    }).catch(error => {
      console.error('Failed to update workout:', error);
    });
  };

  const handleDateChange = (newDate: string) => {
    setDateString(newDate);
    
    // Compute dayOfWeek
    let dayOfWeek = 0;
    if (newDate) {
      const date = new Date(newDate);
      dayOfWeek = date.getDay();
    }
    
    // Update in store
    updateWorkout(workout.id, {
      date: newDate || undefined,
      dayOfWeek
    }).catch(error => {
      console.error('Failed to update workout date:', error);
    });
  };

  const handleClearDate = () => {
    handleDateChange('');
  };

  const handleDeleteWorkout = () => {
    if (confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      deleteWorkout(workout.id);
      onClose();
    }
  };

  const handleCompleteWorkout = async () => {
    await markAsComplete(workout.id);
    onComplete(workout as WorkoutDocument);
  };

  const handleResetWorkout = async () => {
    await markAsIncomplete(workout.id);
  };

  // Exercise management
  const handleUpdateExercise = (exerciseId: string, updates: Partial<Exercise>) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      )
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleAddExercise = () => {
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

  const handleRemoveExercise = (exerciseId: string) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.filter(ex => ex.id !== exerciseId)
    };
    updateWorkoutStructure(updatedWorkout);
  };

  // Volume row management
  const handleUpdateVolumeRow = (exerciseId: string, rowIndex: number, updates: Partial<VolumeRow>) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          return updateVolumeRow(exercise, rowIndex, updates);
        }
        return exercise;
      })
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleAddVolumeRow = (exerciseId: string) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          return addVolumeRow(exercise);
        }
        return exercise;
      })
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleRemoveVolumeRow = (exerciseId: string, rowIndex: number) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          return removeVolumeRow(exercise, rowIndex);
        }
        return exercise;
      })
    };
    updateWorkoutStructure(updatedWorkout);
  };

  // Set field updates
  const handleUpdateSetField = (exerciseId: string, setIndex: number, field: string, value: number) => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(exercise => {
        if (exercise.id === exerciseId) {
          const updatedExercise = {
            ...exercise,
            sets: exercise.sets.map((set, index) => {
              if (index === setIndex) {
                const updatedSet = { ...set };
                if (field === 'reps') updatedSet.reps = value;
                if (field === 'weight') updatedSet.weight = value;
                if (field === 'duration') updatedSet.duration = value * 60;
                updatedSet.volumeRowId = `individual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                return updatedSet;
              }
              return set;
            })
          };
          return updatedExercise;
        }
        return exercise;
      })
    };
    updateWorkoutStructure(updatedWorkout);
  };

  // Input handlers
  const handleInputChange = (exerciseId: string, setIndex: number, field: string, value: string) => {
    handleInputChangeBase(exerciseId, setIndex, field, value, handleUpdateSetField);
  };

  const handleInputBlur = (exerciseId: string, setIndex: number, field: string, defaultValue: number) => {
    handleInputBlurBase(exerciseId, setIndex, field, defaultValue, handleUpdateSetField);
  };

  const handleVolumeRowInputChange = (exerciseId: string, rowIndex: number, field: string, value: string) => {
    handleVolumeRowInputChangeBase(exerciseId, rowIndex, field, value, handleUpdateVolumeRow);
  };

  const handleVolumeRowInputBlur = (exerciseId: string, rowIndex: number, field: string, defaultValue: number) => {
    handleVolumeRowInputBlurBase(exerciseId, rowIndex, field, defaultValue, handleUpdateVolumeRow);
  };

  const overallProgress = getOverallProgress();
  const isCompleted = workout.status === 'completed';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-3">
              {/* Workout Name */}
              <div className="flex items-center space-x-2">
                <Input
                  value={executionState.workout.name}
                  onChange={(e) => {
                    const updatedWorkout = { ...executionState.workout, name: e.target.value };
                    updateWorkoutStructure(updatedWorkout);
                  }}
                  className="text-xl font-bold flex-1"
                  placeholder="Workout name"
                />
                <Badge 
                  variant={overallProgress.isWorkoutComplete ? "default" : "outline"}
                  className={overallProgress.isWorkoutComplete ? "bg-green-600 text-white" : ""}
                >
                  {overallProgress.completedCount}/{overallProgress.totalCount} sets
                  {overallProgress.isWorkoutComplete && " ✓"}
                </Badge>
              </div>
              
              {/* Date Field */}
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date:
                </Label>
                <Input
                  type="date"
                  value={dateString}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="text-sm flex-1 max-w-[200px]"
                />
                {dateString && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDate}
                    className="flex-shrink-0 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Delete Button Only */}
            <div className="flex items-center space-x-2">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteWorkout}
                title="Delete workout"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tabs for UI/Text Editor */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ui">UI Editor</TabsTrigger>
              <TabsTrigger value="text">Text Editor</TabsTrigger>
            </TabsList>

            <TabsContent value="ui" className="space-y-4">
              <WorkoutExecutionUI
                exercises={executionState.workout.exercises}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                getExerciseProgress={getExerciseProgress}
                onUpdateExercise={handleUpdateExercise}
                onRemoveExercise={handleRemoveExercise}
                onAddExercise={handleAddExercise}
                onToggleSetCompletion={toggleSetCompletion}
                onToggleExerciseCompletion={toggleExerciseCompletion}
                onUpdateVolumeRow={handleUpdateVolumeRow}
                onAddVolumeRow={handleAddVolumeRow}
                onRemoveVolumeRow={handleRemoveVolumeRow}
                onUpdateSetField={handleUpdateSetField}
                getInputValue={getInputValue}
                getVolumeRowValue={getVolumeRowValue}
                handleInputChange={handleInputChange}
                handleInputBlur={handleInputBlur}
                handleVolumeRowInputChange={handleVolumeRowInputChange}
                handleVolumeRowInputBlur={handleVolumeRowInputBlur}
                isGapRecovery={false}
              />
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <WorkoutExecutionText
                textEditorValue={textEditorValue}
                onTextEditorChange={setTextEditorValue}
                textAreaRef={textAreaRef}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer with Complete/Reset Button */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Close
          </Button>
          
          <div className="flex items-center space-x-2">
            {overallProgress.isWorkoutComplete || isCompleted ? (
              <Button 
                variant="outline"
                onClick={handleResetWorkout}
                title="Reset workout to planned state"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Workout
              </Button>
            ) : (
              <Button 
                variant="outline"
                onClick={handleCompleteWorkout}
                disabled={executionState.workout.exercises.length === 0}
                title="Mark workout as complete"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Workout
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

