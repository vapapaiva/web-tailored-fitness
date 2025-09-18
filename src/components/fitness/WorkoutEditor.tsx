import React, { useState, useEffect } from 'react';
import type { Workout, Exercise, ExerciseSet } from '@/types/fitness';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { parseExerciseText, convertParsedToExercise, exerciseToText, groupSimilarSets } from '@/lib/exerciseParser';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface WorkoutEditorProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWorkout: Workout) => void;
}

/**
 * Workout editor with text and UI editing modes
 */
export function WorkoutEditor({ workout, isOpen, onClose, onSave }: WorkoutEditorProps) {
  const [editedWorkout, setEditedWorkout] = useState<Workout>(workout);
  const [textInput, setTextInput] = useState(() => 
    workout.exercises.map(ex => exerciseToText(ex)).join('\n\n')
  );
  const [activeTab, setActiveTab] = useState<'ui' | 'text'>('ui');

  // Sync editedWorkout when workout prop changes
  useEffect(() => {
    setEditedWorkout(workout);
    setTextInput(workout.exercises.map(ex => exerciseToText(ex)).join('\n\n'));
  }, [workout]);

  // Sync text input when switching from UI to text mode
  const handleTabChange = (value: string) => {
    const newTab = value as 'ui' | 'text';
    if (newTab === 'text' && activeTab === 'ui') {
      // Sync UI changes to text
      setTextInput(editedWorkout.exercises.map(ex => exerciseToText(ex)).join('\n\n'));
    } else if (newTab === 'ui' && activeTab === 'text') {
      // Sync text changes to UI
      syncTextToUI();
    }
    setActiveTab(newTab);
  };

  const syncTextToUI = () => {
    try {
      const parsedExercises = parseExerciseText(textInput);
      const exercises: Exercise[] = parsedExercises.map((parsed, index) => 
        convertParsedToExercise(parsed, `exercise_${Date.now()}_${index}`)
      );
      setEditedWorkout(prev => ({ ...prev, exercises }));
    } catch (error) {
      console.error('Failed to parse exercise text:', error);
      // Could show a toast notification here
    }
  };

  const handleSave = () => {
    try {
      let finalWorkout = { ...editedWorkout };

      // If user was in text mode, parse the text and update exercises
      if (activeTab === 'text') {
        const parsedExercises = parseExerciseText(textInput);
        const exercises: Exercise[] = parsedExercises.map((parsed, index) => 
          convertParsedToExercise(parsed, `exercise_${Date.now()}_${index}`)
        );
        finalWorkout.exercises = exercises;
      }

      // Validation: Ensure workout has at least 1 exercise
      if (finalWorkout.exercises.length === 0) {
        alert('Please add at least one exercise to the workout.');
        return;
      }

      // Validation: Ensure all exercises have valid volume data
      for (const exercise of finalWorkout.exercises) {
        if (exercise.sets.length === 0) {
          alert(`Exercise "${exercise.name}" must have at least one set.`);
          return;
        }

        // Check if any sets have empty volume data
        for (const set of exercise.sets) {
          const hasReps = set.reps && set.reps > 0;
          const hasDuration = set.duration && set.duration > 0;
          const hasDistance = set.notes && set.notes.match(/\d+(?:\.\d+)?(km|mi|m)/);

          if (!hasReps && !hasDuration && !hasDistance) {
            alert(`Exercise "${exercise.name}" has sets with no volume data. Please fill in reps, duration, or distance.`);
            return;
          }
        }
      }

      onSave(finalWorkout);
      onClose();
    } catch (error) {
      console.error('Failed to save workout:', error);
      // Could show a toast notification here
    }
  };

  const handleCancel = () => {
    // Reset to original state
    setEditedWorkout(workout);
    setTextInput(workout.exercises.map(ex => exerciseToText(ex)).join('\n\n'));
    onClose();
  };

  const addExercise = () => {
    const newExercise: Exercise = {
      id: `exercise_${Date.now()}`,
      name: 'New Exercise',
      category: 'unknown',
      muscleGroups: [],
      equipment: [],
      instructions: '',
      sets: [{
        reps: 10,
        weight: undefined,
        duration: undefined,
        restTime: 90,
        notes: '',
      }],
    };

    setEditedWorkout(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));
  };

  const updateExercise = (exerciseId: string, updates: Partial<Exercise>) => {
    setEditedWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      ),
    }));
  };

  const deleteExercise = (exerciseId: string) => {
    // Validation: Prevent deleting the last exercise
    if (editedWorkout.exercises.length <= 1) {
      alert('A workout must have at least one exercise. Add another exercise before deleting this one.');
      return;
    }

    setEditedWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter(ex => ex.id !== exerciseId),
    }));
  };



  // Volume row management
  const getVolumeRows = (exercise: Exercise) => {
    return groupSimilarSets(exercise.sets).map((group) => {
      // Try to get the stored volume type from the first set in the group
      const firstSet = exercise.sets.find(set => 
        set.weight === group.weight && 
        set.reps === group.reps && 
        set.duration === group.duration &&
        set.notes === group.notes
      );
      
      // Use stored volume type if available, otherwise detect from data
      let volumeType = firstSet?.volumeType;
      if (!volumeType) {
        volumeType = group.duration ? 'duration' : 
              group.notes?.match(/\d+(?:\.\d+)?(km|mi|m)/) ? 'distance' :
              group.weight !== undefined ? 'sets-reps-weight' : 'sets-reps';
      }
      
      return {
        type: volumeType,
        sets: group.count,
        reps: group.reps,
        weight: group.weight,
        duration: group.duration,
        distance: group.notes?.match(/(\d+(?:\.\d+)?)(km|mi|m)/)?.[1],
        unit: group.notes?.match(/\d+(?:\.\d+)?(km|mi|m|kg|lb)/)?.[1] || 
              (group.weight !== undefined ? 'kg' : 'km'),
      };
    });
  };

  const addVolumeRow = (exerciseId: string) => {
    const newSet: ExerciseSet = {
      reps: 10,
      restTime: 90,
      notes: '',
      volumeType: 'sets-reps', // Default volume type for new rows
    };

    const exercise = editedWorkout.exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      updateExercise(exerciseId, { sets: [...exercise.sets, newSet] });
    }
  };

  const updateVolumeRow = (exerciseId: string, rowIndex: number, updatedRow: any) => {
    const exercise = editedWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const volumeRows = getVolumeRows(exercise);
    const currentRow = volumeRows[rowIndex];
    
    // Determine number of sets to create
    const setsToCreate = (updatedRow.type === 'duration' || updatedRow.type === 'distance') 
      ? 1 
      : (updatedRow.sets || 1);
    
    // Create new sets based on updated row
    const newSets: ExerciseSet[] = [];
    for (let i = 0; i < setsToCreate; i++) {
      const newSet: ExerciseSet = {
        reps: updatedRow.reps || 1,
        restTime: 90,
        notes: '',
        volumeType: updatedRow.type, // Store the user's volume type choice
      };

      if (updatedRow.type === 'sets-reps-weight') {
        newSet.weight = updatedRow.weight || 0;
      } else if (updatedRow.type === 'duration') {
        newSet.duration = updatedRow.duration || 60;
        newSet.reps = 1; // Keep reps as 1 for data structure consistency
      } else if (updatedRow.type === 'distance') {
        newSet.notes = `${updatedRow.distance || 0}${updatedRow.unit || 'km'}`;
        newSet.reps = 1;
      }

      newSets.push(newSet);
    }

    // Replace the sets for this row
    let setIndex = 0;
    for (let i = 0; i < rowIndex; i++) {
      setIndex += volumeRows[i].sets;
    }

    const updatedSets = [...exercise.sets];
    updatedSets.splice(setIndex, currentRow.sets, ...newSets);
    
    updateExercise(exerciseId, { sets: updatedSets });
  };

  const deleteVolumeRow = (exerciseId: string, rowIndex: number) => {
    const exercise = editedWorkout.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const volumeRows = getVolumeRows(exercise);
    
    // Validation: Prevent deleting the last volume row
    if (volumeRows.length <= 1) {
      alert('An exercise must have at least one volume row. Add another volume row before deleting this one.');
      return;
    }

    const currentRow = volumeRows[rowIndex];
    
    // Find the starting index for this row
    let setIndex = 0;
    for (let i = 0; i < rowIndex; i++) {
      setIndex += volumeRows[i].sets;
    }

    // Remove the sets for this row
    const updatedSets = [...exercise.sets];
    updatedSets.splice(setIndex, currentRow.sets);
    
    updateExercise(exerciseId, { sets: updatedSets });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-4">
                  <Input
                    value={editedWorkout.name}
                    onChange={(e) => setEditedWorkout(prev => ({ ...prev, name: e.target.value }))}
                    className="text-lg font-semibold flex-1"
                    placeholder="Workout name"
                  />
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">Duration:</Label>
                    <Input
                      type="number"
                      value={editedWorkout.estimatedDuration}
                      onChange={(e) => setEditedWorkout(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) || 0 }))}
                      className="w-20 h-8"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this workout?')) {
                        onSave({ ...editedWorkout, exercises: [] }); // Signal deletion by emptying exercises
                        onClose();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ui">Visual Editor</TabsTrigger>
            <TabsTrigger value="text">Text Editor</TabsTrigger>
          </TabsList>

          {/* UI Editor Tab */}
          <TabsContent value="ui" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Exercises ({editedWorkout.exercises.length})</h3>
              <Button onClick={addExercise} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </div>

            <div className="space-y-4">
              {editedWorkout.exercises.map((exercise) => (
                <Card key={exercise.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={exercise.name}
                          onChange={(e) => updateExercise(exercise.id, { name: e.target.value })}
                          className="font-medium"
                          placeholder="Exercise name"
                        />
                        <Textarea
                          value={exercise.instructions}
                          onChange={(e) => updateExercise(exercise.id, { instructions: e.target.value })}
                          placeholder="Instructions, form cues, RPE guidance..."
                          className="text-sm"
                          rows={2}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExercise(exercise.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Volume Management */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Volume</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVolumeRow(exercise.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Volume
                        </Button>
                      </div>
                      
                      {/* Volume Rows */}
                      <div className="space-y-2">
                        {getVolumeRows(exercise).map((volumeRow, rowIndex) => (
                          <VolumeRow
                            key={rowIndex}
                            volumeRow={volumeRow}
                            onUpdate={(updatedRow) => updateVolumeRow(exercise.id, rowIndex, updatedRow)}
                            onDelete={() => deleteVolumeRow(exercise.id, rowIndex)}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Text Editor Tab */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label>Exercise List</Label>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Enter exercises in this format:
- Weighted pull ups
3x10x45kg
10x10
zone 2, <145bpm
- Running
10km
- Plank
60s`}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Supported formats:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code>Exercise name 3x10x40kg</code> - Sets x Reps x Weight</li>
                <li><code>Exercise name 3x10</code> - Sets x Reps (bodyweight)</li>
                <li><code>Exercise name 10km</code> - Distance</li>
                <li><code>Exercise name 30s</code> - Duration</li>
                <li>Add instructions on new lines after exercise name</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline volume row component for editing
 */
function VolumeRow({ volumeRow, onUpdate, onDelete }: {
  volumeRow: any;
  onUpdate: (updatedRow: any) => void;
  onDelete: () => void;
}) {
  // Local state for input values to allow clearing while focused
  const [localValues, setLocalValues] = React.useState({
    sets: volumeRow.sets?.toString() || '',
    reps: volumeRow.reps?.toString() || '',
    weight: volumeRow.weight?.toString() || '',
    duration: volumeRow.duration ? Math.round(volumeRow.duration / 60 * 100) / 100 : '',
    distance: volumeRow.distance?.toString() || '',
  });

  // Update local values when volumeRow changes (e.g., from type change)
  React.useEffect(() => {
    setLocalValues({
      sets: volumeRow.sets?.toString() || '',
      reps: volumeRow.reps?.toString() || '',
      weight: volumeRow.weight?.toString() || '',
      duration: volumeRow.duration ? Math.round(volumeRow.duration / 60 * 100) / 100 : '',
      distance: volumeRow.distance?.toString() || '',
    });
  }, [volumeRow]);

  const handleTypeChange = (newType: string) => {
    // Reset fields when changing type and set defaults
    let updatedRow = { ...volumeRow, type: newType };
    
    if (newType === 'sets-reps') {
      updatedRow = { ...updatedRow, sets: 3, reps: 10, weight: undefined, duration: undefined, distance: undefined, unit: undefined };
    } else if (newType === 'sets-reps-weight') {
      updatedRow = { ...updatedRow, sets: 3, reps: 10, weight: 20, duration: undefined, distance: undefined, unit: 'kg' };
    } else if (newType === 'duration') {
      updatedRow = { ...updatedRow, sets: undefined, reps: undefined, weight: undefined, duration: 60, distance: undefined, unit: 'm' }; // 60 seconds = 1 minute
    } else if (newType === 'distance') {
      updatedRow = { ...updatedRow, sets: undefined, reps: 1, weight: undefined, duration: undefined, distance: 5, unit: 'km' };
    }
    
    onUpdate(updatedRow);
  };

  // Helper function to handle input changes with local state
  const handleInputChange = (field: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
  };

  // Helper function to handle blur with default values
  const handleInputBlur = (field: string, defaultValue: number) => {
    const currentValue = localValues[field as keyof typeof localValues];
    const numericValue = parseFloat(currentValue);
    
    if (isNaN(numericValue) || numericValue <= 0) {
      // Set default value and update both local state and parent
      setLocalValues(prev => ({ ...prev, [field]: defaultValue.toString() }));
      
      if (field === 'duration') {
        const seconds = Math.round(defaultValue * 60);
        onUpdate({ ...volumeRow, [field]: seconds });
      } else {
        onUpdate({ ...volumeRow, [field]: defaultValue });
      }
    } else {
      // Update parent with the valid value
      if (field === 'duration') {
        const seconds = Math.round(numericValue * 60);
        onUpdate({ ...volumeRow, [field]: seconds });
      } else {
        onUpdate({ ...volumeRow, [field]: numericValue });
      }
    }
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
      {/* Volume Type */}
      <div className="col-span-3 space-y-1">
        <Label className="text-xs">Volume Type</Label>
        <Select
          value={volumeRow.type}
          onValueChange={handleTypeChange}
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

      {/* Sets (for sets-reps and sets-reps-weight) */}
      {(volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight') && (
        <div className="col-span-1 space-y-1">
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            value={localValues.sets}
            onChange={(e) => handleInputChange('sets', e.target.value)}
            onBlur={() => handleInputBlur('sets', 3)}
            className="h-8 text-xs"
            min="1"
          />
        </div>
      )}

      {/* Reps (for sets-reps and sets-reps-weight only) */}
      {(volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight') && (
        <div className="col-span-1 space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            value={localValues.reps}
            onChange={(e) => handleInputChange('reps', e.target.value)}
            onBlur={() => handleInputBlur('reps', 10)}
            className="h-8 text-xs"
            min="1"
          />
        </div>
      )}

      {/* Weight (for sets-reps-weight) */}
      {volumeRow.type === 'sets-reps-weight' && (
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Weight</Label>
          <Input
            type="number"
            value={localValues.weight}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            onBlur={() => handleInputBlur('weight', 20)}
            className="h-8 text-xs"
            step="0.5"
            min="0"
          />
        </div>
      )}

      {/* Weight Unit (for sets-reps-weight) */}
      {volumeRow.type === 'sets-reps-weight' && (
        <div className="col-span-1 space-y-1">
          <Label className="text-xs">Unit</Label>
          <Select
            value={volumeRow.unit || 'kg'}
            onValueChange={(unit) => onUpdate({ ...volumeRow, unit })}
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
      )}

      {/* Duration (for duration type) */}
      {volumeRow.type === 'duration' && (
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Duration (min)</Label>
          <Input
            type="number"
            value={localValues.duration}
            onChange={(e) => handleInputChange('duration', e.target.value)}
            onBlur={() => handleInputBlur('duration', 1)}
            className="h-8 text-xs"
            step="0.25"
            min="0.25"
          />
        </div>
      )}

      {/* Distance (for distance type) */}
      {volumeRow.type === 'distance' && (
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Distance</Label>
          <Input
            type="number"
            value={localValues.distance}
            onChange={(e) => handleInputChange('distance', e.target.value)}
            onBlur={() => handleInputBlur('distance', 5)}
            className="h-8 text-xs"
            step="0.1"
            min="0"
          />
        </div>
      )}

      {/* Distance Unit (for distance type) */}
      {volumeRow.type === 'distance' && (
        <div className="col-span-1 space-y-1">
          <Label className="text-xs">Unit</Label>
          <Select
            value={volumeRow.unit || 'km'}
            onValueChange={(unit) => onUpdate({ ...volumeRow, unit })}
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
      )}

      {/* Delete Button */}
      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive p-1 h-8 w-8"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
