/**
 * Workout Execution Dialog - Enhanced wrapper for WorkoutExecutionMode
 * Adds date editing functionality and proper state management
 */

import { useState, useEffect } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import type { Workout } from '@/types/fitness';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, RotateCcw, Trash2, X, Calendar, Info, Sparkles, AlertCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { WorkoutExecutionUI } from '@/components/fitness/WorkoutExecutionUI';
import { WorkoutExecutionText } from '@/components/fitness/WorkoutExecutionText';
import { useWorkoutExecution } from '@/hooks/useWorkoutExecution';
import { useTextSync } from '@/hooks/useTextSync';
import { useInputManagement } from '@/hooks/useInputManagement';
import { updateVolumeRow, addVolumeRow, removeVolumeRow, type VolumeRow } from '@/lib/volumeRowUtils';
import { normalizeForComparison } from '@/lib/workoutNormalization';
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
  const { currentPlan: aiPlan, loadPlan: loadAIPlan } = useAICoachStore();
  
  // UI state
  const [activeTab, setActiveTab] = useState<'ui' | 'text'>('ui');
  const [viewMode, setViewMode] = useState<'expanded' | 'collapsed'>('collapsed');
  const [dateString, setDateString] = useState(workout.date || '');
  const [dateError, setDateError] = useState<string>('');
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Always get the latest workout from store for reactive UI
  const latestWorkoutFromStore = workouts.find(w => w.id === workout.id) || workout;
  
  // Local workout state
  const [localWorkout, setLocalWorkout] = useState<Workout>(() => ({
    ...workout,
    dayOfWeek: workout.dayOfWeek || 0,
  }));

  // Load AI plan if this is an AI Coach workout (for validation)
  useEffect(() => {
    if (latestWorkoutFromStore.source === 'ai-coach' && !aiPlan) {
      console.log('[WorkoutExecution] Loading AI plan for validation');
      loadAIPlan();
    }
  }, [latestWorkoutFromStore.source, aiPlan, loadAIPlan]);

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
    
    // Check if workout has manual changes (for AI Coach workouts)
    let hasManualChanges = latestWorkoutFromStore.hasManualChanges || false;
    if (latestWorkoutFromStore.source === 'ai-coach' && latestWorkoutFromStore.originalAISuggestion) {
      // Compare current exercises with original AI suggestion
      // Use normalization function that only compares workout structure, not completion/UI state
      const currentNormalized = JSON.stringify(
        normalizeForComparison(updatedWorkout.exercises)
      );
      
      const originalNormalized = JSON.stringify(
        normalizeForComparison(latestWorkoutFromStore.originalAISuggestion.exercises)
      );
      
      hasManualChanges = currentNormalized !== originalNormalized;
      
      // Debug logging
      if (hasManualChanges) {
        console.log('[WorkoutExecution] Manual changes detected:');
        console.log('Current:', currentNormalized);
        console.log('Original:', originalNormalized);
      }
    }
    
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
      hasManualChanges, // Track if user modified AI workout
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
    // Clear previous errors
    setDateError('');
    
    console.log('[DateChange] Validating date change:', {
      newDate,
      source: latestWorkoutFromStore.source,
      hasContext: !!latestWorkoutFromStore.aiCoachContext,
      hasPlan: !!aiPlan?.currentMicrocycle,
      microcycleId: latestWorkoutFromStore.aiCoachContext?.microcycleId,
      planMicrocycleId: aiPlan?.currentMicrocycle?.id
    });
    
    // Validate date is within microcycle range for AI Coach workouts
    if (latestWorkoutFromStore.source === 'ai-coach' && latestWorkoutFromStore.aiCoachContext) {
      // For AI Coach workouts, ALWAYS validate against microcycle range
      if (aiPlan?.currentMicrocycle) {
        // Workout belongs to current microcycle - validate strictly
        if (latestWorkoutFromStore.aiCoachContext.microcycleId === aiPlan.currentMicrocycle.id) {
          const { start, end } = aiPlan.currentMicrocycle.dateRange;
          
          console.log('[DateChange] Validating against microcycle range:', { start, end, newDate });
          
          if (newDate && (newDate < start || newDate > end)) {
            console.log('[DateChange] VALIDATION FAILED - Date outside range');
            // Show inline error instead of alert
            setDateError(`Date must be within microcycle range: ${start} to ${end}`);
            // Reset to current value - DON'T allow the change
            setDateString(latestWorkoutFromStore.date || '');
            return; // EXIT - don't update
          }
        } else {
          // Workout from old microcycle - more lenient but still warn
          console.log('[DateChange] Workout from old microcycle, allowing change');
        }
      } else {
        // No current microcycle loaded, but it's an AI workout - be cautious
        console.warn('[DateChange] AI workout but no microcycle loaded - preventing change as safety measure');
        setDateError('Cannot change date: AI Coach plan not loaded');
        setDateString(latestWorkoutFromStore.date || '');
        return;
      }
    }
    
    console.log('[DateChange] Validation passed, updating date');
    setDateString(newDate);
    
    // Compute dayOfWeek - undefined if no date
    let dayOfWeek: number | undefined = undefined;
    if (newDate) {
      const date = new Date(newDate);
      dayOfWeek = date.getDay();
    }
    
    // Update in store
    updateWorkout(workout.id, {
      date: newDate || undefined,
      dayOfWeek: dayOfWeek
    }).catch(error => {
      console.error('Failed to update workout date:', error);
    });
  };

  const handleClearDate = () => {
    // Prevent clearing date for AI Coach workouts
    if (latestWorkoutFromStore.source === 'ai-coach' && latestWorkoutFromStore.aiCoachContext) {
      setDateError('AI Coach workouts must have a date to stay aligned with your training plan');
      return;
    }
    handleDateChange('');
  };

  const handleDeleteWorkout = () => {
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = () => {
    deleteWorkout(workout.id);
    onClose();
  };

  const handleCompleteWorkout = async () => {
    await markAsComplete(workout.id);
    onComplete(workout as WorkoutDocument);
  };

  const handleResetWorkout = async () => {
    await markAsIncomplete(workout.id);
  };
  
  const handleRevertToOriginal = () => {
    if (!latestWorkoutFromStore.originalAISuggestion) return;
    setShowRevertConfirm(true);
  };
  
  const confirmRevert = () => {
    if (!latestWorkoutFromStore.originalAISuggestion) return;
    
    const revertedWorkout = {
      ...executionState.workout,
      exercises: JSON.parse(JSON.stringify(latestWorkoutFromStore.originalAISuggestion.exercises)) // Deep copy
    };
    updateWorkoutStructure(revertedWorkout);
    
    // Reset hasManualChanges flag
    updateWorkout(workout.id, {
      hasManualChanges: false
    }).catch(error => {
      console.error('Failed to reset hasManualChanges flag:', error);
    });
    
    setShowRevertConfirm(false);
  };
  
  // Format workout as text for preview
  const formatWorkoutAsText = (exercises: Exercise[]) => {
    return exercises.map((ex, i) => {
      const sets = ex.sets.map((set, j) => {
        if (set.duration) {
          return `  Set ${j + 1}: ${Math.floor(set.duration / 60)}min`;
        } else if (set.distance) {
          return `  Set ${j + 1}: ${set.distance}km`;
        } else {
          return `  Set ${j + 1}: ${set.reps || 0} reps${set.weight ? ` @ ${set.weight}kg` : ''}`;
        }
      }).join('\n');
      
      return `${i + 1}. ${ex.name}\n${sets}`;
    }).join('\n\n');
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
    <>
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
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date:
                  </Label>
                  <Input
                    type="date"
                    value={dateString}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={`text-sm flex-1 max-w-[200px] ${dateError ? 'border-red-500' : ''}`}
                  />
                  {dateString && !latestWorkoutFromStore.aiCoachContext && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearDate}
                      className="flex-shrink-0 h-8 w-8 p-0"
                      title="Clear date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Proactive info for AI Coach workouts */}
                {latestWorkoutFromStore.source === 'ai-coach' && aiPlan?.currentMicrocycle && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    AI Coach workout • Must stay within {aiPlan.currentMicrocycle.dateRange.start} to {aiPlan.currentMicrocycle.dateRange.end}
                  </p>
                )}
                
                {/* Error message */}
                {dateError && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {dateError}
                  </p>
                )}
              </div>
            </div>
            
            {/* Delete Button with Info */}
            <div className="flex flex-col items-end gap-1">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteWorkout}
                disabled={latestWorkoutFromStore.source === 'ai-coach' && !!latestWorkoutFromStore.aiCoachContext}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {latestWorkoutFromStore.source === 'ai-coach' && latestWorkoutFromStore.aiCoachContext && (
                <p className="text-xs text-muted-foreground">
                  AI workouts can't be deleted
                </p>
              )}
              {latestWorkoutFromStore.source === 'ai-coach' && !latestWorkoutFromStore.aiCoachContext && (
                <p className="text-xs text-muted-foreground text-green-600 dark:text-green-400">
                  Detached from plan
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI Coach Original Suggestion Banner */}
          {latestWorkoutFromStore.originalAISuggestion && latestWorkoutFromStore.hasManualChanges && (
            <Alert className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-medium text-purple-900 dark:text-purple-200">
                    You've modified this AI Coach workout
                  </p>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    Original suggestion created {new Date(latestWorkoutFromStore.originalAISuggestion.createdAt).toLocaleDateString()}
                  </p>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900">
                        View original suggestion →
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-xs bg-white dark:bg-gray-900 p-3 rounded mt-2 max-h-48 overflow-y-auto border border-purple-200 dark:border-purple-800">
                        {formatWorkoutAsText(latestWorkoutFromStore.originalAISuggestion.exercises)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                  <Button 
                    size="sm"
                    onClick={handleRevertToOriginal}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <RotateCcw className="h-3 w-3 mr-2" />
                    Revert to AI Suggestion
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Tabs for UI/Text Editor */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ui">UI Editor</TabsTrigger>
              <TabsTrigger value="text">Text Editor</TabsTrigger>
            </TabsList>

            {/* Overall Workout Progress Bar */}
            <div className="pt-4 pb-2 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">
                  {overallProgress.completedCount}/{overallProgress.totalCount} sets
                  {overallProgress.isWorkoutComplete && " ✓"}
                </span>
              </div>
              <Progress 
                value={overallProgress.totalCount > 0 ? (overallProgress.completedCount / overallProgress.totalCount) * 100 : 0} 
                className="h-2"
              />
            </div>

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
                onTextChange={setTextEditorValue}
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
    
    {/* Confirmation Dialogs */}
    
    {/* Revert Confirmation Dialog */}
    <Dialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Revert to AI Suggestion?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will discard all your manual changes and restore the original AI Coach workout suggestion.
          </p>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. All your modifications will be permanently lost.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRevertConfirm(false)}>
            Cancel
          </Button>
          <Button variant="default" onClick={confirmRevert} className="bg-purple-600 hover:bg-purple-700">
            <RotateCcw className="h-4 w-4 mr-2" />
            Revert to AI Suggestion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete Workout?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{executionState.workout.name}"?
          </p>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. The workout and all its data will be permanently deleted.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

