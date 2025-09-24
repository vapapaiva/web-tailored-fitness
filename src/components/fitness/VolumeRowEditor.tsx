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
  handleVolumeRowInputBlur
}: VolumeRowEditorProps) {
  const completedCount = volumeRow.setIndices.filter(setIndex => completedSets[setIndex]).length;
  const isRowCompleted = completedCount === volumeRow.totalSets;

  return (
    <div 
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
            checked={completedSets[setIndex] || false}
            onCheckedChange={() => onToggleSet(exerciseId, setIndex)}
          />
        ))}
      </div>

      {/* Volume Type */}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">Type</Label>
        <Select
          value={volumeRow.type}
          onValueChange={(value) => {
            onUpdate(exerciseId, rowIndex, { 
              type: value as VolumeRow['type']
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
            value={getVolumeRowValue(exerciseId, rowIndex, 'totalSets', volumeRow.totalSets)}
            onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'totalSets', e.target.value)}
            onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'totalSets', 1)}
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
            value={getVolumeRowValue(exerciseId, rowIndex, 'reps', volumeRow.reps)}
            onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'reps', e.target.value)}
            onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'reps', 1)}
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
              value={getVolumeRowValue(exerciseId, rowIndex, 'weight', volumeRow.weight || 0)}
              onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'weight', e.target.value)}
              onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'weight', 0)}
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
                onUpdate(exerciseId, rowIndex, { 
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
            value={getVolumeRowValue(exerciseId, rowIndex, 'duration', volumeRow.duration || 0)}
            onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'duration', e.target.value)}
            onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'duration', 1)}
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
              value={getVolumeRowValue(exerciseId, rowIndex, 'distance', volumeRow.distance || 0)}
              onChange={(e) => handleVolumeRowInputChange(exerciseId, rowIndex, 'distance', e.target.value)}
              onBlur={() => handleVolumeRowInputBlur(exerciseId, rowIndex, 'distance', 1)}
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
                onUpdate(exerciseId, rowIndex, { 
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
          onClick={() => onDelete(exerciseId, rowIndex)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
