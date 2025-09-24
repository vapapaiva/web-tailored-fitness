import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Exercise } from '@/types/fitness';
import { ExerciseExecutionCard } from './ExerciseExecutionCard';
import type { VolumeRow } from '@/lib/volumeRowUtils';

interface ExerciseProgress {
  completedSets: boolean[];
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
  percentage: number;
}

interface WorkoutExecutionUIProps {
  exercises: Exercise[];
  viewMode: 'expanded' | 'collapsed';
  onViewModeChange: (mode: 'expanded' | 'collapsed') => void;
  getExerciseProgress: (exerciseId: string) => ExerciseProgress;
  onUpdateExercise: (exerciseId: string, updates: Partial<Exercise>) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onAddExercise: () => void;
  onToggleSetCompletion: (exerciseId: string, setIndex: number) => void;
  onToggleExerciseCompletion: (exerciseId: string) => void;
  onUpdateVolumeRow: (exerciseId: string, rowIndex: number, updates: Partial<VolumeRow>) => void;
  onAddVolumeRow: (exerciseId: string) => void;
  onRemoveVolumeRow: (exerciseId: string, rowIndex: number) => void;
  onUpdateSetField: (exerciseId: string, setIndex: number, field: string, value: number) => void;
  getInputValue: (exerciseId: string, setIndex: number, field: string, currentValue: number) => string;
  getVolumeRowValue: (exerciseId: string, rowIndex: number, field: string, currentValue: number) => string;
  handleInputChange: (exerciseId: string, setIndex: number, field: string, value: string) => void;
  handleInputBlur: (exerciseId: string, setIndex: number, field: string, defaultValue: number) => void;
  handleVolumeRowInputChange: (exerciseId: string, rowIndex: number, field: string, value: string) => void;
  handleVolumeRowInputBlur: (exerciseId: string, rowIndex: number, field: string, defaultValue: number) => void;
}

export function WorkoutExecutionUI({
  exercises,
  viewMode,
  onViewModeChange,
  getExerciseProgress,
  onUpdateExercise,
  onRemoveExercise,
  onAddExercise,
  onToggleSetCompletion,
  onToggleExerciseCompletion,
  onUpdateVolumeRow,
  onAddVolumeRow,
  onRemoveVolumeRow,
  onUpdateSetField,
  getInputValue,
  getVolumeRowValue,
  handleInputChange,
  handleInputBlur,
  handleVolumeRowInputChange,
  handleVolumeRowInputBlur
}: WorkoutExecutionUIProps) {
  
  return (
    <>
      {/* View mode toggle */}
      <div className="flex space-x-2 mt-4">
        <Button
          variant={viewMode === 'collapsed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('collapsed')}
        >
          Collapsed
        </Button>
        <Button
          variant={viewMode === 'expanded' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewModeChange('expanded')}
        >
          Expanded
        </Button>
      </div>

      <div className="space-y-4">
        {exercises.map((exercise) => {
          const exerciseProgress = getExerciseProgress(exercise.id);
          
          return (
            <ExerciseExecutionCard
              key={exercise.id}
              exercise={exercise}
              exerciseProgress={exerciseProgress}
              viewMode={viewMode}
              onUpdateExercise={onUpdateExercise}
              onRemoveExercise={onRemoveExercise}
              onToggleSetCompletion={onToggleSetCompletion}
              onToggleExerciseCompletion={onToggleExerciseCompletion}
              onUpdateVolumeRow={onUpdateVolumeRow}
              onAddVolumeRow={onAddVolumeRow}
              onRemoveVolumeRow={onRemoveVolumeRow}
              onUpdateSetField={onUpdateSetField}
              getInputValue={getInputValue}
              getVolumeRowValue={getVolumeRowValue}
              handleInputChange={handleInputChange}
              handleInputBlur={handleInputBlur}
              handleVolumeRowInputChange={handleVolumeRowInputChange}
              handleVolumeRowInputBlur={handleVolumeRowInputBlur}
            />
          );
        })}

        <Button onClick={onAddExercise} className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Exercise
        </Button>
      </div>
    </>
  );
}
