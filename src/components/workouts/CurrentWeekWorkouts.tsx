/**
 * Current Week Workouts - Weekly calendar view with drag & drop
 * Shows all workouts (both planned and completed) until week passes
 * Fully integrated with dnd-kit for drag & drop reordering
 */

import { useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { WorkoutCardV2 } from './WorkoutCardV2';
import { WorkoutExecutionDialog } from './WorkoutExecutionDialog';
import { Card, CardContent } from '@/components/ui/card';
import { getWeekStartDate, formatDayHeader, calculateDateFromDayOfWeek } from '@/lib/dateUtils';
import { generateRankAtPosition } from '@/lib/lexoRank';
import { Dumbbell } from 'lucide-react';

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
  weekStart
}: { 
  day: typeof DAYS[0]; 
  workouts: WorkoutDocument[];
  onStartWorkout: (workout: WorkoutDocument) => void;
  onCompleteWorkout: (workout: WorkoutDocument) => void;
  onResetWorkout: (workout: WorkoutDocument) => void;
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
  const { markAsComplete, markAsIncomplete, updateWorkout } = useWorkoutsStore();
  const [executingWorkout, setExecutingWorkout] = useState<WorkoutDocument | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDocument | null>(null);
  const weekStart = getWeekStartDate();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    const workout = event.active.data.current?.workout as WorkoutDocument;
    setActiveWorkout(workout);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorkout(null);

    if (!over) return;

    const draggedWorkout = active.data.current?.workout as WorkoutDocument;
    if (!draggedWorkout) return;

    // Determine target day
    let newDayOfWeek: number;
    if (over.id.toString().startsWith('day-')) {
      newDayOfWeek = parseInt(over.id.toString().replace('day-', ''));
    } else {
      const targetWorkout = workouts.find(w => w.id === over.id);
      if (!targetWorkout || !targetWorkout.dayOfWeek) return;
      newDayOfWeek = targetWorkout.dayOfWeek;
    }

    // Only update if day actually changed
    if (draggedWorkout.dayOfWeek !== newDayOfWeek) {
      // Calculate new date based on new dayOfWeek
      const newDate = calculateDateFromDayOfWeek(newDayOfWeek, weekStart);
      
      // Generate new rank for target day
      const targetDayWorkouts = workouts.filter(w => w.dayOfWeek === newDayOfWeek && w.id !== draggedWorkout.id);
      const existingRanks = targetDayWorkouts.map(w => w.rank).filter(Boolean);
      const newRank = generateRankAtPosition(existingRanks, targetDayWorkouts.length);
      
      // Update workout with new day and date
      await updateWorkout(draggedWorkout.id, {
        dayOfWeek: newDayOfWeek,
        date: newDate,
        rank: newRank
      });
      
      console.log('[CurrentWeek] Moved workout', draggedWorkout.name, 'to', DAYS.find(d => d.id === newDayOfWeek)?.name);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
                weekStart={weekStart}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeWorkout && (
            <Card className="w-64 shadow-lg rotate-3">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="h-4 w-4" />
                  <span className="font-medium text-sm">{activeWorkout.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeWorkout.exercises.length} exercises
                </p>
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

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

