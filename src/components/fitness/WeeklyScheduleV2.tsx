import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react';
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
import type { Workout, DateRange } from '@/types/fitness';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { WorkoutExecutionMode } from './WorkoutExecutionMode';
import { WorkoutCard } from './WorkoutCard';
import { WorkoutStats } from './WorkoutStats';
import { 
  Plus,
  Dumbbell
} from 'lucide-react';
import { useDragState } from '@/hooks/useDragState';
import { generateInitialRank } from '@/lib/lexoRank';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';
import { formatDayHeader } from '@/lib/dateUtils';

interface WeeklyScheduleV2Props {
  workouts: Workout[];
  onWorkoutsChange: (workouts: Workout[]) => Promise<void>;
  onWorkoutsChangeAfterDrag: (workouts: Workout[]) => Promise<void>;
  isEditable?: boolean;
  isDraggingRef?: React.MutableRefObject<boolean>;
  weekDateRange?: DateRange; // NEW: Optional date range for displaying dates in day headers
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

// Workout status logic moved to WorkoutCard component

const DroppableDay = React.memo(function DroppableDay({ 
  day, 
  workouts, 
  onStartWorkout,
  onCompleteWorkout,
  onResetWorkout,
  isEditable,
  weekDateRange
}: { 
  day: typeof DAYS[0]; 
  workouts: Workout[]; 
  onStartWorkout: (workout: Workout) => void;
  onCompleteWorkout: (workout: Workout) => void;
  onResetWorkout: (workout: Workout) => void;
  isEditable: boolean;
  weekDateRange?: DateRange;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { dayId: day.id },
  });

  // Format day header with date if weekDateRange is provided
  const dayHeader = weekDateRange 
    ? formatDayHeader(day.id, weekDateRange.start)
    : day.name;

  // console.log('📅 DroppableDay render:', { dayName: day.name, workoutCount: workouts.length });

  return (
    <div 
      ref={setNodeRef}
      className={`transition-all duration-200 ${
        isOver ? 'bg-primary/5 border-primary/20' : ''
      }`}
    >
      <div className="mb-2">
        <h3 className="text-sm font-medium text-center py-2">{dayHeader}</h3>
      </div>
      
      <div className="space-y-2">
        <SortableContext
          items={workouts.map(w => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* SortableContext items */}
          {workouts.length > 0 ? (
            workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onStart={onStartWorkout}
                onComplete={onCompleteWorkout}
                onReset={onResetWorkout}
                isEditable={isEditable}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-sm">Rest Day</div>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
});

// WorkoutCard component moved to separate file

/**
 * Enhanced weekly schedule with integrated stats and better UX
 */
// Custom hook to manage drag state and prevent parent updates

export const WeeklyScheduleV2 = React.memo(function WeeklyScheduleV2({
  workouts,
  onWorkoutsChange,
  onWorkoutsChangeAfterDrag,
  isEditable = true,
  isDraggingRef: parentIsDraggingRef,
  weekDateRange
}: WeeklyScheduleV2Props) {
  const { updateWorkout } = useFitnessPlanStore();
  // LOCAL STATE: Component owns its workout layout state
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>(workouts);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [executingWorkout, setExecutingWorkout] = useState<Workout | null>(null);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay();
    return today;
  });

  // DRAG STATE TRACKING: Use custom hook to manage drag state
  const { isDraggingRef, parentUpdateBlockedRef, startDrag, endDrag } = useDragState();
  const dragStartTimeRef = useRef<number>(0);
  
  // Create a stable reference to prevent parent re-renders
  const stableOnWorkoutsChange = useRef(onWorkoutsChange);
  stableOnWorkoutsChange.current = onWorkoutsChange;
  
  // Create a stable reference to prevent parent re-renders
  const stableWorkouts = useRef(workouts);
  stableWorkouts.current = workouts;
  
  // DEBOUNCED SYNC: Batch updates to parent to prevent cascade re-renders
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedStateRef = useRef<Workout[]>(workouts);
  const expectedStateRef = useRef<Workout[]>(workouts);
  const pendingChangesRef = useRef<Workout[] | null>(null);

  const syncToParent = useCallback((newWorkouts: Workout[]) => {
    // Skip parent sync during drag operations
    if (isDraggingRef.current || parentUpdateBlockedRef.current) {
      pendingChangesRef.current = newWorkouts;
      return;
    }

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Update expected state immediately
    expectedStateRef.current = newWorkouts;

    // Debounce sync to parent (prevents cascade re-renders)
    syncTimeoutRef.current = setTimeout(async () => {
      startTransition(async () => {
        lastSyncedStateRef.current = newWorkouts;
        await onWorkoutsChange(newWorkouts);
      });
    }, 100);
  }, [onWorkoutsChange]);

  // SMART RECONCILIATION: Only sync when not dragging and state actually changed
  useEffect(() => {
    // Skip reconciliation during drag operations or when parent updates are blocked
    if (isDraggingRef.current || parentUpdateBlockedRef.current) return;

    // Skip reconciliation if parent state matches our expected state
    const parentMatchesExpected = JSON.stringify(workouts) === JSON.stringify(expectedStateRef.current);
    if (parentMatchesExpected) return;

    // Only reconcile if parent state is genuinely different from what we last synced
    const workoutsChanged = JSON.stringify(stableWorkouts.current) !== JSON.stringify(lastSyncedStateRef.current);
    
    if (workoutsChanged) {
      setLocalWorkouts(stableWorkouts.current);
      lastSyncedStateRef.current = stableWorkouts.current;
      expectedStateRef.current = stableWorkouts.current;
    }
  }, [workouts]);

  // CLEANUP: Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // console.log('🎮 DnD Sensors initialized:', sensors.length);

  const handleDragStart = (event: DragStartEvent) => {
    // Set drag state flags using custom hook
    startDrag();
    dragStartTimeRef.current = Date.now();
    
    // Also update parent's drag state
    if (parentIsDraggingRef) {
      parentIsDraggingRef.current = true;
    }
    
    const workout = event.active.data.current?.workout;
    setActiveWorkout(workout);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Clear drag state flags
    endDrag();
    if (parentIsDraggingRef) {
      parentIsDraggingRef.current = false;
    }
    setActiveWorkout(null);

    if (!over) return;

    const draggedWorkout = active.data.current?.workout as Workout;
    if (!draggedWorkout) return;

    // Determine target day
    let newDayOfWeek: number;
    if (over.id.toString().startsWith('day-')) {
      newDayOfWeek = parseInt(over.id.toString().replace('day-', ''));
    } else {
      const targetWorkout = localWorkouts.find(w => w.id === over.id);
      if (!targetWorkout) return;
      newDayOfWeek = targetWorkout.dayOfWeek;
    }

    // Only update if day actually changed
    if (draggedWorkout.dayOfWeek !== newDayOfWeek) {
      const updatedWorkouts = localWorkouts.map(w =>
        w.id === draggedWorkout.id ? { ...w, dayOfWeek: newDayOfWeek } : w
      );
      
      setLocalWorkouts(updatedWorkouts);
      
      // Sync to parent after drag is complete
      startTransition(async () => {
        lastSyncedStateRef.current = updatedWorkouts;
        expectedStateRef.current = updatedWorkouts;
        await onWorkoutsChangeAfterDrag(updatedWorkouts);
      });
    }
  };


  const createNewWorkout = useCallback(() => {
    try {
      // Generate proper LexoRank for new workout
      const dayWorkouts = localWorkouts.filter(w => w.dayOfWeek === selectedDay);
      const existingRanks = dayWorkouts.map(w => w.rank).filter(Boolean);
      const newRank = generateInitialRank(existingRanks);

      const newWorkout: Workout = {
        id: `workout_${Date.now()}`,
        name: 'New Workout',
        type: 'general',
        dayOfWeek: selectedDay,
        estimatedDuration: 45,
        focus: 'general',
        value: 'New workout session',
        exercises: [],
        checkIns: {
          greenFlags: [],
          redFlags: [],
        },
        status: 'planned',
        rank: newRank,
      };

      const updatedWorkouts = [...localWorkouts, newWorkout];
      setLocalWorkouts(updatedWorkouts);
      
      // Update expected state to match our local changes
      expectedStateRef.current = updatedWorkouts;
      lastSyncedStateRef.current = updatedWorkouts;
      
      // Skip parent sync during drag operations
      if (isDraggingRef.current) return;
      
      syncToParent(updatedWorkouts);
      setExecutingWorkout(newWorkout); // Changed from setEditingWorkout to setExecutingWorkout
      setShowAddWorkout(false);
    } catch (error) {
      console.error('Failed to create new workout:', error);
    }
  }, [localWorkouts, selectedDay, syncToParent]);

  const handleStartWorkout = useCallback(async (workout: Workout) => {
    // Start workout execution mode (no status change needed)
    setExecutingWorkout(workout);
  }, []);

  const handleCompleteWorkout = useCallback(async (workout: Workout) => {
    // ALWAYS mark all sets as completed first (no validation, just complete everything)
    const workoutWithAllSetsCompleted = {
      ...workout,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      exercises: workout.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completed: true // Mark ALL sets as completed
        }))
      }))
    };
    
    // Update local state immediately
    const updatedWorkouts = localWorkouts.map(w => 
      w.id === workout.id ? workoutWithAllSetsCompleted : w
    );
    setLocalWorkouts(updatedWorkouts);
    syncToParent(updatedWorkouts);
    
    // Update the entire workout in store (this will persist all changes including set completion)
    await updateWorkout(workout.id, {
      status: 'completed',
      completedAt: workoutWithAllSetsCompleted.completedAt,
      exercises: workoutWithAllSetsCompleted.exercises
    });
    
    // Close execution mode
    setExecutingWorkout(null);
  }, [updateWorkout, localWorkouts, syncToParent]);

  const handleResetWorkout = useCallback(async (workout: Workout) => {
    // Create workout with all sets marked as incomplete
    const resetWorkout = { 
      ...workout, 
      status: 'planned' as const,
      completedAt: undefined,
      actualDuration: undefined,
      exercises: workout.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(set => ({
          ...set,
          completed: false // Reset all set completion status
        }))
      }))
    };
    
    // Update local state immediately
    const updatedWorkouts = localWorkouts.map(w => 
      w.id === workout.id ? resetWorkout : w
    );
    setLocalWorkouts(updatedWorkouts);
    syncToParent(updatedWorkouts);
    
    // Update the entire workout in store (this will persist all changes including set completion reset)
    await updateWorkout(workout.id, {
      status: 'planned',
      completedAt: undefined,
      actualDuration: undefined,
      exercises: resetWorkout.exercises
    });
  }, [updateWorkout, localWorkouts, syncToParent]);

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={() => {}}
      >
        <div className="space-y-4">
          {/* Enhanced Weekly Stats with Actual vs Planned Progress */}
          <WorkoutStats workouts={workouts} showDetailed={true} />

          {/* Daily Workout Rows */}
          <div className="space-y-3">
            {DAYS.map((day) => {
              const dayWorkouts = localWorkouts.filter(w => w.dayOfWeek === day.id);
              
              return (
                <DroppableDay
                  key={day.id}
                  day={day}
                  workouts={dayWorkouts}
                  onStartWorkout={handleStartWorkout}
                  onCompleteWorkout={handleCompleteWorkout}
                  onResetWorkout={handleResetWorkout}
                  isEditable={isEditable}
                  weekDateRange={weekDateRange}
                />
              );
            })}
          </div>

          {/* Single Add Workout Button */}
          {isEditable && (
            <div className="flex justify-center pt-4">
              <Dialog open={showAddWorkout} onOpenChange={setShowAddWorkout}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Workout</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Workout</DialogTitle>
                    <DialogDescription>
                      Create a new workout and assign it to a specific day of the week.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Day</label>
                      <Select value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day.id} value={day.id.toString()}>
                              {day.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={() => setShowAddWorkout(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button onClick={createNewWorkout} className="flex-1">
                        Create Workout
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
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

      {/* Modals */}
      {executingWorkout && (
        <WorkoutExecutionMode
          workout={executingWorkout}
          isOpen={!!executingWorkout}
          onClose={() => setExecutingWorkout(null)}
          onComplete={() => {
            // Get the latest workout state from localWorkouts to ensure we have the most recent data
            const currentWorkout = localWorkouts.find(w => w.id === executingWorkout.id) || executingWorkout;
            handleCompleteWorkout(currentWorkout);
          }}
          onWorkoutUpdate={(updatedWorkout) => {
            // Update local state
            const updatedWorkouts = localWorkouts.map(w => 
              w.id === updatedWorkout.id ? updatedWorkout : w
            );
            setLocalWorkouts(updatedWorkouts);
            syncToParent(updatedWorkouts);
            
            // Update executing workout to reflect the changes
            setExecutingWorkout(updatedWorkout);
          }}
          onWorkoutDelete={(workoutId) => {
            // Delete workout from local state
            const updatedWorkouts = localWorkouts.filter(w => w.id !== workoutId);
            setLocalWorkouts(updatedWorkouts);
            syncToParent(updatedWorkouts);
            setExecutingWorkout(null);
          }}
        />
      )}
    </>
  );
});
