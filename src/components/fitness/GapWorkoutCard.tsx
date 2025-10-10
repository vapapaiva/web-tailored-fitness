import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Dumbbell, Trash2 } from 'lucide-react';
import type { CompletedWorkout } from '@/types/fitness';
import { formatDateForDisplay } from '@/lib/gapWorkoutParser';

interface GapWorkoutCardProps {
  workout: CompletedWorkout;
  onEdit: (workout: CompletedWorkout) => void;
  onDelete: (workoutId: string) => void;
}

/**
 * Compact workout card for gap recovery
 * Shows name + date, click to edit
 */
export function GapWorkoutCard({ workout, onEdit, onDelete }: GapWorkoutCardProps) {
  const handleCardClick = () => {
    onEdit(workout);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(workout.workoutId);
  };

  const displayDate = formatDateForDisplay(workout.date);
  const exerciseCount = workout.exercises.length;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {/* Workout Name */}
            <div className="flex items-center space-x-2">
              <Dumbbell className="h-4 w-4 text-green-600 flex-shrink-0" />
              <h3 className="font-medium text-base line-clamp-1">{workout.name}</h3>
            </div>
            
            {/* Date and Exercise Count */}
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>{displayDate}</span>
              </div>
              {exerciseCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


