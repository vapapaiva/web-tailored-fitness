import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Workout } from '@/types/fitness';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  Edit3,
  RotateCcw
} from 'lucide-react';

interface WorkoutCardProps {
  workout: Workout;
  onEdit: (workout: Workout) => void;
  onStart: (workout: Workout) => void;
  onComplete: (workout: Workout) => void;
  onReset: (workout: Workout) => void;
  isEditable: boolean;
}

// Workout status logic can be added here when needed

export const WorkoutCard = React.memo(function WorkoutCard({ 
  workout, 
  onEdit, 
  onStart, 
  onComplete, 
  onReset,
  isEditable 
}: WorkoutCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: workout.id,
    data: { workout }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleDragAreaClick = (e: React.MouseEvent) => {
    // Only handle clicks when not dragging and not on buttons
    if (isDragging) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
    // Clear any existing timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }
    
    // Set a short delay to distinguish from drag start
    const timeout = setTimeout(() => {
      onEdit(workout);
      setClickTimeout(null);
    }, 150); // 150ms delay
    
    setClickTimeout(timeout);
  };

  const handleMouseDown = () => {
    // Clear click timeout when drag might start
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    action();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  // Status-based styling with theme support
  const getStatusStyling = () => {
    switch (workout.status) {
      case 'completed':
        return {
          cardClass: 'border-green-500/20 bg-green-500/5 dark:border-green-400/20 dark:bg-green-400/5',
          statusBadge: { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700' },
          icon: <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
        };
      default: // 'planned'
        return {
          cardClass: 'border-border bg-card',
          statusBadge: { variant: 'secondary' as const, className: '' },
          icon: <Clock className="h-3 w-3 text-muted-foreground" />
        };
    }
  };

  const statusStyling = getStatusStyling();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all hover:shadow-md ${
        isDragging ? 'shadow-lg' : ''
      } ${statusStyling.cardClass}`}
      {...attributes}
      {...listeners}
      onClick={handleDragAreaClick}
      onMouseDown={handleMouseDown}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-sm truncate">{workout.name}</h4>
              {statusStyling.icon}
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={statusStyling.statusBadge.variant}
                className={`text-xs ${statusStyling.statusBadge.className}`}
              >
                {workout.status === 'completed' ? 'Completed' : 'Planned'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {workout.exercises.length} exercises
              </Badge>
              {workout.estimatedDuration && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {workout.actualDuration || workout.estimatedDuration}min
                </div>
              )}
            </div>
            {workout.completedAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Completed {new Date(workout.completedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          
          {isEditable && (
            <div className="flex items-center space-x-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => handleButtonClick(e, () => onEdit(workout))}
                title="Edit workout"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              
              {workout.status === 'planned' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => handleButtonClick(e, () => onStart(workout))}
                  title="Start workout"
                >
                  <Play className="h-3 w-3" />
                </Button>
              )}
              
              {workout.status === 'completed' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleButtonClick(e, () => onComplete(workout))}
                    title="Complete workout"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleButtonClick(e, () => onReset(workout))}
                    title="Reset workout"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
