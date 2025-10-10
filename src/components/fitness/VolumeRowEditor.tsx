import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
import type { VolumeRow } from '@/lib/volumeRowUtils';

interface VolumeRowEditorProps {
  volumeRow: VolumeRow;
  exerciseId: string;
  rowIndex: number;
  completedSets: boolean[];
  onUpdate: (exerciseId: string, rowIndex: number, updates: Partial<VolumeRow>) => void;
  onDelete: (exerciseId: string, rowIndex: number) => void;
  onToggleSet: (exerciseId: string, setIndex: number) => void;
  getVolumeRowValue: (exerciseId: string, rowIndex: number, field: string, currentValue: number) => string;
  handleVolumeRowInputChange: (exerciseId: string, rowIndex: number, field: string, value: string) => void;
  handleVolumeRowInputBlur: (exerciseId: string, rowIndex: number, field: string, defaultValue: number) => void;
  isGapRecovery?: boolean;
}

export function VolumeRowEditor({
  volumeRow,
  exerciseId,
  rowIndex,
  completedSets,
  onUpdate,
  onDelete,
  onToggleSet,
  getVolumeRowValue,
  handleVolumeRowInputChange,
  handleVolumeRowInputBlur,
  isGapRecovery = false
}: VolumeRowEditorProps) {
  const completedCount = volumeRow.setIndices.filter(setIndex => completedSets[setIndex]).length;
  const isRowCompleted = completedCount === volumeRow.totalSets;

  return (
    <div 
      className={`relative flex items-end gap-3 p-2 border rounded transition-colors ${
        isRowCompleted 
          ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400' 
          : ''
      }`}
    >
      {/* Delete button - top right corner */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(exerciseId, rowIndex)}
        className="absolute top-1 right-1 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      {/* Volume Type */}
      <div className="flex-shrink-0 space-y-1">
        <Label className="text-xs">Type</Label>
        <Select
          value={volumeRow.type}
          onValueChange={(value) => {
            onUpdate(exerciseId, rowIndex, { 
              type: value as VolumeRow['type']
            });
          }}
        >
          <SelectTrigger className="h-8 text-xs w-32">
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
      {volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight' ? (
        <div className="flex-shrink-0 space-y-1">
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            value={getVolumeRowValue(exerciseId, rowIndex, 'totalSets', volumeRow.totalSets)}
            onChange={(e) => {
              // Let the input management handle clamping and validation
              handleVolumeRowInputChange(exerciseId, rowIndex, 'totalSets', e.target.value);
            }}
            onBlur={() => {
              // Use a consistent default value - let the blur handler decide if update is needed
              handleVolumeRowInputBlur(exerciseId, rowIndex, 'totalSets', 1);
            }}
            className="h-8 text-xs w-16"
            min="1"
            max="15"
          />
        </div>
      ) : null}

      {/* Reps */}
      {volumeRow.type === 'sets-reps' || volumeRow.type === 'sets-reps-weight' ? (
        <div className="flex-shrink-0 space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            value={getVolumeRowValue(exerciseId, rowIndex, 'reps', volumeRow.reps)}
            onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'reps', e.target.value)}
            onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'reps', 1)}
            className="h-8 text-xs w-16"
            min="1"
          />
        </div>
      ) : null}

      {/* Weight */}
      {volumeRow.type === 'sets-reps-weight' && (
        <>
          <div className="flex-shrink-0 space-y-1">
            <Label className="text-xs">Weight</Label>
            <Input
              type="number"
              value={getVolumeRowValue(exerciseId, rowIndex, 'weight', volumeRow.weight || 0)}
              onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'weight', e.target.value)}
              onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'weight', 0)}
              className="h-8 text-xs w-20"
              min="0"
              step="0.5"
            />
          </div>
          <div className="flex-shrink-0 space-y-1">
            <Label className="text-xs">Unit</Label>
            <Select
              value={volumeRow.weightUnit || 'kg'}
              onValueChange={(value) => {
                onUpdate(exerciseId, rowIndex, { 
                  weightUnit: value as 'kg' | 'lb' 
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs w-16">
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
        <div className="flex-shrink-0 space-y-1">
          <Label className="text-xs">Duration (min)</Label>
          <Input
            type="number"
            value={getVolumeRowValue(exerciseId, rowIndex, 'duration', volumeRow.duration || 0)}
            onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'duration', e.target.value)}
            onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'duration', 1)}
            className="h-8 text-xs w-20"
            min="0"
            step="0.5"
          />
        </div>
      )}

      {/* Distance */}
      {volumeRow.type === 'distance' && (
        <>
          <div className="flex-shrink-0 space-y-1">
            <Label className="text-xs">Distance</Label>
            <Input
              type="number"
              value={getVolumeRowValue(exerciseId, rowIndex, 'distance', volumeRow.distance || 0)}
              onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'distance', e.target.value)}
              onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'distance', 1)}
              className="h-8 text-xs w-20"
              min="0"
              step="0.1"
            />
          </div>
          <div className="flex-shrink-0 space-y-1">
            <Label className="text-xs">Unit</Label>
            <Select
              value={volumeRow.distanceUnit || 'km'}
              onValueChange={(value) => {
                onUpdate(exerciseId, rowIndex, { 
                  distanceUnit: value as 'km' | 'mi' | 'm' 
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs w-16">
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

      {/* Spacer to push checkboxes to the right */}
      <div className="flex-grow"></div>

      {/* Checkboxes - aligned to the right (hidden in gap recovery mode) */}
      {!isGapRecovery && (
        <div className="flex flex-wrap gap-1 items-end">
          {volumeRow.setIndices.map(setIndex => (
            <Checkbox
              key={setIndex}
              checked={completedSets[setIndex] || false}
              onCheckedChange={() => onToggleSet(exerciseId, setIndex)}
              className="flex-shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  );
}
