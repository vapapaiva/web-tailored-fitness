import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RefObject } from 'react';

interface WorkoutExecutionTextProps {
  textEditorValue: string;
  onTextChange: (value: string) => void;
  textAreaRef?: RefObject<HTMLTextAreaElement | null>;
  isGapRecovery?: boolean;
}

export function WorkoutExecutionText({ textEditorValue, onTextChange, textAreaRef, isGapRecovery = false }: WorkoutExecutionTextProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="workout-text" className="text-sm font-medium">
        {isGapRecovery ? "Workout Text" : "Workout Text (with progress tracking)"}
      </Label>
      <Textarea
        ref={textAreaRef}
        id="workout-text"
        value={textEditorValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={isGapRecovery ? "Edit workout text..." : "Edit workout text with progress indicators..."}
        className="min-h-[400px] font-mono text-sm"
      />
      {!isGapRecovery && (
        <p className="text-xs text-muted-foreground">
          Use + symbols to mark completed sets. Example: "3x10x25kg +++" means all 3 sets completed.
        </p>
      )}
    </div>
  );
}
