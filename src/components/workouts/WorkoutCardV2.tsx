/**
 * Workout Card V2 - Adapted for standalone workout tracking
 * Supports both draggable (dnd-kit) and static contexts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkoutDocument } from '@/types/workout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Play, 
  CheckCircle, 
  RotateCcw,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { 
  analyzeWorkoutCompletion, 
  getStatusDisplayText, 
  formatCompletionStats 
} from '@/lib/workoutCompletion';

interface WorkoutCardV2Props {
  workout: WorkoutDocument;
  onStart: (workout: WorkoutDocument) => void;
  onComplete?: (workout: WorkoutDocument) => void;
  onReset?: (workout: WorkoutDocument) => void;
  isEditable?: boolean;
  isDraggable?: boolean; // Enable drag & drop
  showSource?: boolean; // Show manual vs AI Coach badge
}

/**
 * Workout card component for new workout system
 */
export const WorkoutCardV2 = React.memo(function WorkoutCardV2({ 
  workout, 
  onStart, 
  onComplete,
  onReset,
  isEditable = true,
  isDraggable = false,
  showSource = true
}: WorkoutCardV2Props) {
  const navigate = useNavigate();
  
  // Only use sortable if draggable
  const sortableProps = isDraggable ? useSortable({
    id: workout.id,
    data: { workout }
  }) : null;

  const {
    attributes = {},
    listeners = {},
    setNodeRef = () => {},
    transform = null,
    transition = undefined,
    isDragging = false,
  } = sortableProps || {};

  const style = isDraggable ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : {};

  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleCardClick = (e: React.MouseEvent) => {
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
      onStart(workout);
      setClickTimeout(null);
    }, 150);
    
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

  // Analyze workout completion status
  const completionStats = analyzeWorkoutCompletion(workout);
  const statusText = getStatusDisplayText(completionStats.status);
  const formattedStats = formatCompletionStats(completionStats);

  // Status-based styling with theme support
  const getStatusStyling = () => {
    switch (completionStats.status) {
      case 'completed':
        return {
          cardClass: 'border-green-500/20 bg-green-500/5 dark:border-green-400/20 dark:bg-green-400/5',
          statusBadge: { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-500 dark:bg-green-900 dark:text-green-200 dark:border-green-400' },
          icon: <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
        };
      case 'partially-done':
        return {
          cardClass: 'border-orange-500/20 bg-orange-500/5 dark:border-orange-400/20 dark:bg-orange-400/5',
          statusBadge: { variant: 'outline' as const, className: 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300' },
          icon: <Play className="h-3 w-3 text-orange-600 dark:text-orange-400" />
        };
      case 'not-started':
      default:
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
      {...(isDraggable ? attributes : {})}
      {...(isDraggable ? listeners : {})}
      onClick={handleCardClick}
      onMouseDown={handleMouseDown}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-sm truncate">{workout.name}</h4>
              {statusStyling.icon}
            </div>
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <Badge 
                variant={statusStyling.statusBadge.variant}
                className={`text-xs ${statusStyling.statusBadge.className}`}
              >
                {statusText}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formattedStats.exerciseText}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formattedStats.setText}
              </Badge>
              {workout.estimatedDuration && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {workout.actualDuration || workout.estimatedDuration}min
                </div>
              )}
              
              {/* Source Badge */}
              {showSource && workout.source && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    workout.source === 'ai-coach' 
                      ? 'border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300' 
                      : ''
                  }`}
                >
                  {workout.source === 'ai-coach' && <Sparkles className="h-3 w-3 mr-1" />}
                  {workout.source === 'ai-coach' ? 'AI Coach' : 'Manual'}
                </Badge>
              )}
            </div>
            {workout.status === 'completed' && workout.date && (
              <div className="text-xs text-muted-foreground mt-1">
                Scheduled: {new Date(workout.date).toLocaleDateString()}
              </div>
            )}
            {workout.status === 'completed' && workout.completedAt && workout.completedAt.split('T')[0] !== workout.date && (
              <div className="text-xs text-muted-foreground">
                Completed: {new Date(workout.completedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          
          {isEditable && (
            <div className="flex items-center space-x-1 ml-2">
              {/* AI Coach Link */}
              {workout.source === 'ai-coach' && workout.aiCoachContext && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => handleButtonClick(e, () => navigate('/app/ai-coach'))}
                  title="View in AI Coach"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              
              {/* Action Buttons */}
              {(completionStats.status === 'not-started' || completionStats.status === 'partially-done') && (
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
              
              {completionStats.status === 'completed' && onReset && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => handleButtonClick(e, () => onReset(workout))}
                  title="Reset workout"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

