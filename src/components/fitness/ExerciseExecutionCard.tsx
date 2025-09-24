import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';
import type { Exercise } from '@/types/fitness';
import { VolumeRowEditor } from './VolumeRowEditor';
import { getVolumeRows, type VolumeRow } from '@/lib/volumeRowUtils';

interface ExerciseProgress {
  completedSets: boolean[];
  completedCount: number;
  totalCount: number;
  isCompleted: boolean;
  percentage: number;
}

interface ExerciseExecutionCardProps {
  exercise: Exercise;
  exerciseProgress: ExerciseProgress;
  viewMode: 'expanded' | 'collapsed';
  onUpdateExercise: (exerciseId: string, updates: Partial<Exercise>) => void;
  onRemoveExercise: (exerciseId: string) => void;
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

export function ExerciseExecutionCard({
  exercise,
  exerciseProgress,
  viewMode,
  onUpdateExercise,
  onRemoveExercise,
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
}: ExerciseExecutionCardProps) {
  
  return (
    <Card 
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
              onCheckedChange={() => onToggleExerciseCompletion(exercise.id)}
              className="mt-1"
            />
            <Input
              value={exercise.name}
              onChange={(e) => onUpdateExercise(exercise.id, { name: e.target.value })}
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
              onClick={() => onRemoveExercise(exercise.id)}
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
            {exercise.sets.filter(set => set.volumeType !== 'completion').map((set, setIndex) => {
              // Find the actual index in the original sets array
              const actualSetIndex = exercise.sets.findIndex(s => s === set);
              const isCompleted = exerciseProgress.completedSets[actualSetIndex] || false;
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
                    onCheckedChange={() => onToggleSetCompletion(exercise.id, actualSetIndex)}
                  />
                  <span className="text-sm w-8">#{setIndex + 1}</span>
                  
                  <div className="flex items-center space-x-2">
                    <Label className="text-xs">Reps:</Label>
                    <Input
                      type="number"
                      value={getInputValue(exercise.id, actualSetIndex, 'reps', set.reps)}
                      onChange={(e) => handleInputChange(exercise.id, actualSetIndex, 'reps', e.target.value)}
                      onBlur={() => handleInputBlur(exercise.id, actualSetIndex, 'reps', 1)}
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
                          value={getInputValue(exercise.id, actualSetIndex, 'weight', set.weight || 0)}
                          onChange={(e) => handleInputChange(exercise.id, actualSetIndex, 'weight', e.target.value)}
                          onBlur={() => handleInputBlur(exercise.id, actualSetIndex, 'weight', 0)}
                          className="w-16 h-7 text-xs"
                          min="0"
                          step="0.5"
                        />
                        <Select
                          value={set.weightUnit || 'kg'}
                          onValueChange={(value) => {
                            onUpdateSetField(exercise.id, actualSetIndex, 'weightUnit', value as any);
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
                        value={getInputValue(exercise.id, actualSetIndex, 'duration', (set.duration || 0) / 60)}
                        onChange={(e) => handleInputChange(exercise.id, actualSetIndex, 'duration', e.target.value)}
                        onBlur={() => handleInputBlur(exercise.id, actualSetIndex, 'duration', 1)}
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
                          onUpdateSetField(exercise.id, actualSetIndex, 'notes', `${e.target.value}${set.distanceUnit || 'km'}` as any);
                        }}
                        className="w-16 h-7 text-xs"
                        min="0"
                        step="0.1"
                      />
                      <Select
                        value={set.distanceUnit || 'km'}
                        onValueChange={(value) => {
                          const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
                          onUpdateSetField(exercise.id, actualSetIndex, 'distanceUnit', value as any);
                          onUpdateSetField(exercise.id, actualSetIndex, 'notes', `${distance}${value}` as any);
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
            {exercise.sets.filter(set => set.volumeType !== 'completion').length === 0 && (
              <div className="text-sm text-muted-foreground italic p-2 border rounded bg-muted/20">
                No volume configured - use exercise checkbox to mark as complete
              </div>
            )}
          </div>
        ) : (
          // Collapsed view - grouped by volume type
          <div className="space-y-2">
            <Label className="text-sm font-medium">Volume</Label>
            {getVolumeRows(exercise).map((volumeRow, rowIndex) => (
              <VolumeRowEditor
                key={rowIndex}
                volumeRow={volumeRow}
                exerciseId={exercise.id}
                rowIndex={rowIndex}
                completedSets={exerciseProgress.completedSets}
                onUpdate={onUpdateVolumeRow}
                onDelete={onRemoveVolumeRow}
                onToggleSet={onToggleSetCompletion}
                getVolumeRowValue={getVolumeRowValue}
                handleVolumeRowInputChange={handleVolumeRowInputChange}
                handleVolumeRowInputBlur={handleVolumeRowInputBlur}
              />
            ))}
            
            {getVolumeRows(exercise).length === 0 && (
              <div className="text-sm text-muted-foreground italic p-2 border rounded bg-muted/20">
                No volume configured - use exercise checkbox to mark as complete
              </div>
            )}
            
            <Button 
              onClick={() => onAddVolumeRow(exercise.id)} 
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
              onChange={(e) => onUpdateExercise(exercise.id, { instructions: e.target.value })}
              className="mt-1 min-h-[60px]"
              placeholder="Exercise instructions or cues..."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
