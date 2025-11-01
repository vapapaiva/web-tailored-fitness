/**
 * Current Week Workouts - Weekly calendar view with drag & drop
 * Shows all workouts (both planned and completed) until week passes
 * Fully integrated with dnd-kit for drag & drop reordering
 */

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { WorkoutCardV2 } from './WorkoutCardV2';
import { WorkoutExecutionDialog } from './WorkoutExecutionDialog';
import { Card, CardContent } from '@/components/ui/card';
import { getWeekStartDate, formatDayHeader } from '@/lib/dateUtils';

interface CurrentWeekWorkoutsProps {
  workouts: WorkoutDocument[];
}

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 0, name: 'Sunday', short: 'Sun' },
];

// Droppable day component
function DroppableDay({ 
  day, 
  workouts, 
  onStartWorkout,
  onCompleteWorkout,
  onResetWorkout,
  onDeleteWorkout,
  weekStart
}: { 
  day: typeof DAYS[0]; 
  workouts: WorkoutDocument[];
  onStartWorkout: (workout: WorkoutDocument) => void;
  onCompleteWorkout: (workout: WorkoutDocument) => void;
  onResetWorkout: (workout: WorkoutDocument) => void;
  onDeleteWorkout: (workout: WorkoutDocument) => void;
  weekStart: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { dayId: day.id }
  });

  const dayHeader = formatDayHeader(day.id, weekStart);

  return (
    <div 
      ref={setNodeRef}
      className={`transition-all duration-200 ${
        isOver ? 'bg-primary/5 border-primary/20' : ''
      }`}
    >
      <div className="text-sm font-medium text-center py-2 text-muted-foreground bg-muted/30 rounded-t-lg">
        {dayHeader}
      </div>
      
      {workouts.length > 0 ? (
        <div className="space-y-2 p-2 border border-t-0 rounded-b-lg min-h-[60px]">
          <SortableContext
            items={workouts.map(w => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {workouts.map(workout => (
              <WorkoutCardV2
                key={workout.id}
                workout={workout}
                onStart={onStartWorkout}
                onComplete={onCompleteWorkout}
                onReset={onResetWorkout}
                onDelete={onDeleteWorkout}
                isEditable={true}
                isDraggable={true}
                showSource={true}
              />
            ))}
          </SortableContext>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-muted-foreground border border-t-0 rounded-b-lg min-h-[60px]">
          Rest Day
        </div>
      )}
    </div>
  );
}

/**
 * Current week workouts component with drag & drop
 */
export function CurrentWeekWorkouts({ workouts }: CurrentWeekWorkoutsProps) {
  const { markAsComplete, markAsIncomplete, deleteWorkout } = useWorkoutsStore();
  const [executingWorkout, setExecutingWorkout] = useState<WorkoutDocument | null>(null);
  const weekStart = getWeekStartDate();

  if (workouts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-sm text-muted-foreground">
            No workouts scheduled for this week
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group workouts by day
  const workoutsByDay = new Map<number, WorkoutDocument[]>();
  workouts.forEach(workout => {
    if (workout.dayOfWeek !== undefined) {
      if (!workoutsByDay.has(workout.dayOfWeek)) {
        workoutsByDay.set(workout.dayOfWeek, []);
      }
      workoutsByDay.get(workout.dayOfWeek)!.push(workout);
    }
  });

  const handleStartWorkout = (workout: WorkoutDocument) => {
    setExecutingWorkout(workout);
  };

  const handleCompleteWorkout = async (workout: WorkoutDocument) => {
    await markAsComplete(workout.id);
    setExecutingWorkout(null);
  };

  const handleResetWorkout = async (workout: WorkoutDocument) => {
    await markAsIncomplete(workout.id);
  };

  const handleDeleteWorkout = async (workout: WorkoutDocument) => {
    await deleteWorkout(workout.id);
  };

  return (
    <>
      <div className="space-y-3">
        {DAYS.map((day) => {
          const dayWorkouts = workoutsByDay.get(day.id) || [];
          
          return (
            <DroppableDay
              key={day.id}
              day={day}
              workouts={dayWorkouts}
              onStartWorkout={handleStartWorkout}
              onCompleteWorkout={handleCompleteWorkout}
              onResetWorkout={handleResetWorkout}
              onDeleteWorkout={handleDeleteWorkout}
              weekStart={weekStart}
            />
          );
        })}
      </div>

      {/* Workout Execution Dialog */}
      {executingWorkout && (
        <WorkoutExecutionDialog
          workout={executingWorkout}
          isOpen={!!executingWorkout}
          onClose={() => setExecutingWorkout(null)}
          onComplete={handleCompleteWorkout}
        />
      )}
    </>
  );
}

