import { useState, useEffect } from 'react';
import type { Workout, Exercise } from '@/types/fitness';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, Trash2 } from 'lucide-react';
import { WorkoutExecutionUI } from './WorkoutExecutionUI';
import { WorkoutExecutionText } from './WorkoutExecutionText';
import { useWorkoutExecution } from '@/hooks/useWorkoutExecution';
import { useTextSync } from '@/hooks/useTextSync';
import { useInputManagement } from '@/hooks/useInputManagement';
import { updateVolumeRow, addVolumeRow, removeVolumeRow, type VolumeRow } from '@/lib/volumeRowUtils';

interface WorkoutExecutionModeProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onWorkoutUpdate: (updatedWorkout: Workout) => void;
  onWorkoutDelete?: (workoutId: string) => void;
}

/**
 * Enhanced workout execution mode with clean architecture
 */
export function WorkoutExecutionMode({ 
  workout, 
  isOpen, 
  onClose, 
  onComplete,
  onWorkoutUpdate,
  onWorkoutDelete
}: WorkoutExecutionModeProps) {

  // UI state
  const [activeTab, setActiveTab] = useState<'ui' | 'text'>('ui');
  const [viewMode, setViewMode] = useState<'expanded' | 'collapsed'>('collapsed');

  // Custom hooks for state management
  const {
    executionState,
    updateWorkoutStructure,
    updateWorkoutAndProgress,
    toggleSetCompletion,
    toggleExerciseCompletion,
    getExerciseProgress,
    getOverallProgress
  } = useWorkoutExecution({ initialWorkout: workout, onWorkoutUpdate });

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
    enableRealtimeSync: true // Enable real-time sync for better UX
  });

  const {
    getInputValue,
    getVolumeRowValue,
    handleInputChange: handleInputChangeBase,
    handleInputBlur: handleInputBlurBase,
    handleVolumeRowInputChange: handleVolumeRowInputChangeBase,
    handleVolumeRowInputBlur: handleVolumeRowInputBlurBase
  } = useInputManagement(executionState.workout);

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

  // Initialize text editor when switching to text tab
  useEffect(() => {
    if (activeTab === 'text') {
      syncUIToText();
    }
  }, [activeTab]); // FIXED: Removed syncUIToText dependency to prevent auto-sync on state changes

  // Tab change handler
  const handleTabChange = (value: string): void => {
    const newTab = value as 'ui' | 'text';
    
    if (newTab === 'text' && activeTab === 'ui') {
      syncUIToText();
    } else if (newTab === 'ui' && activeTab === 'text') {
      syncTextToUI();
    }
    
    setActiveTab(newTab);
  };

  // Exercise management
  const handleUpdateExercise = (exerciseId: string, updates: Partial<Exercise>): void => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      )
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleAddExercise = (): void => {
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

  const handleRemoveExercise = (exerciseId: string): void => {
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.filter(ex => ex.id !== exerciseId)
    };
    updateWorkoutStructure(updatedWorkout);
  };

  // Volume row management
  const handleUpdateVolumeRow = (exerciseId: string, rowIndex: number, updates: Partial<VolumeRow>): void => {
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const updatedExercise = updateVolumeRow(exercise, rowIndex, updates);
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? updatedExercise : ex
      )
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleAddVolumeRow = (exerciseId: string): void => {
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const updatedExercise = addVolumeRow(exercise);
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? updatedExercise : ex
      )
    };
    updateWorkoutStructure(updatedWorkout);
  };

  const handleRemoveVolumeRow = (exerciseId: string, rowIndex: number): void => {
    const exercise = executionState.workout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const updatedExercise = removeVolumeRow(exercise, rowIndex);
    const updatedWorkout = {
      ...executionState.workout,
      exercises: executionState.workout.exercises.map(ex => 
        ex.id === exerciseId ? updatedExercise : ex
      )
    };
    updateWorkoutStructure(updatedWorkout);
  };

  // Set field updates
  const handleUpdateSetField = (exerciseId: string, setIndex: number, field: string, value: number): void => {
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
                if (field === 'distance') {
                  // Update notes field with distance value and unit
                  const unit = set.distanceUnit || 'km';
                  updatedSet.notes = `${value}${unit}`;
                }
                if (field === 'weightUnit') updatedSet.weightUnit = value as any;
                if (field === 'distanceUnit') {
                  updatedSet.distanceUnit = value as any;
                  // Update notes field to reflect new unit
                  const distanceValue = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
                  updatedSet.notes = `${distanceValue}${value}`;
                }
                if (field === 'notes') updatedSet.notes = value as any;
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

  // Input handlers with proper typing
  const handleInputChange = (exerciseId: string, setIndex: number, field: string, value: string): void => {
    handleInputChangeBase(exerciseId, setIndex, field, value, handleUpdateSetField);
  };

  const handleInputBlur = (exerciseId: string, setIndex: number, field: string, defaultValue: number): void => {
    handleInputBlurBase(exerciseId, setIndex, field, defaultValue, handleUpdateSetField);
  };

  const handleVolumeRowInputChange = (exerciseId: string, rowIndex: number, field: string, value: string): void => {
    handleVolumeRowInputChangeBase(exerciseId, rowIndex, field, value, handleUpdateVolumeRow);
  };

  const handleVolumeRowInputBlur = (exerciseId: string, rowIndex: number, field: string, defaultValue: number): void => {
    handleVolumeRowInputBlurBase(exerciseId, rowIndex, field, defaultValue, handleUpdateVolumeRow);
  };

  // Workout deletion handler
  const handleDeleteWorkout = (): void => {
    if (confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      onWorkoutDelete?.(workout.id);
      onClose();
    }
  };

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
              {onWorkoutDelete && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDeleteWorkout}
                  title="Delete workout"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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

          {/* Action buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <div className="space-x-2">
              <Button onClick={onComplete}>
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
