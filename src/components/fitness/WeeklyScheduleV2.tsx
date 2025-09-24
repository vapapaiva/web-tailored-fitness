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
import type { Workout } from '@/types/fitness';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { WorkoutEditor } from './WorkoutEditor';
import { WorkoutExecutionMode } from './WorkoutExecutionMode';
import { WorkoutCard } from './WorkoutCard';
import { 
  Clock, 
  Plus,
  Target,
  Dumbbell
} from 'lucide-react';
import { useDragState } from '@/hooks/useDragState';
import { generateInitialRank } from '@/lib/lexoRank';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';

interface WeeklyScheduleV2Props {
  workouts: Workout[];
  onWorkoutsChange: (workouts: Workout[]) => Promise<void>;
  onWorkoutsChangeAfterDrag: (workouts: Workout[]) => Promise<void>;
  weeklyStats: {
    totalDuration: number;
    totalWorkouts: number;
    totalExercises: number;
  };
  isEditable?: boolean;
  isDraggingRef?: React.MutableRefObject<boolean>;
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
  onEditWorkout,
  onStartWorkout,
  onCompleteWorkout,
  onResetWorkout,
  isEditable 
}: { 
  day: typeof DAYS[0]; 
  workouts: Workout[]; 
  onEditWorkout: (workout: Workout) => void;
  onStartWorkout: (workout: Workout) => void;
  onCompleteWorkout: (workout: Workout) => void;
  onResetWorkout: (workout: Workout) => void;
  isEditable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { dayId: day.id },
  });

  // console.log('📅 DroppableDay render:', { dayName: day.name, workoutCount: workouts.length });

  return (
    <div 
      ref={setNodeRef}
      className={`transition-all duration-200 ${
        isOver ? 'bg-primary/5 border-primary/20' : ''
      }`}
    >
      <div className="mb-2">
        <h3 className="text-sm font-medium text-center py-2">{day.name}</h3>
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
                onEdit={onEditWorkout}
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
  weeklyStats,
  isEditable = true,
  isDraggingRef: parentIsDraggingRef
}: WeeklyScheduleV2Props) {
  const { updateWorkoutStatus } = useFitnessPlanStore();
  // LOCAL STATE: Component owns its workout layout state
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>(workouts);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
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
  const stableWeeklyStats = useRef(weeklyStats);
  stableWeeklyStats.current = weeklyStats;
  
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

  const handleWorkoutSave = useCallback((updatedWorkout: Workout) => {
    try {
      const updatedWorkouts = updatedWorkout.exercises.length === 0
        ? localWorkouts.filter(w => w.id !== updatedWorkout.id)
        : localWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w);
      
      setLocalWorkouts(updatedWorkouts);
      
      // Update editingWorkout if it's the same workout being edited
      if (editingWorkout && editingWorkout.id === updatedWorkout.id) {
        setEditingWorkout(updatedWorkout);
      }
      
      // Update expected state to match our local changes
      expectedStateRef.current = updatedWorkouts;
      lastSyncedStateRef.current = updatedWorkouts;
      
      // Skip parent sync during drag operations
      if (isDraggingRef.current) return;
      
      syncToParent(updatedWorkouts);
    } catch (error) {
      console.error('Failed to save workout:', error);
    }
  }, [localWorkouts, syncToParent, editingWorkout]);

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
      setEditingWorkout(newWorkout);
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
    // Update workout status to completed using store
    await updateWorkoutStatus(workout.id, 'completed');
    
    // Also update local state immediately for better UX
    const updatedWorkout = { 
      ...workout, 
      status: 'completed' as const,
      completedAt: new Date().toISOString()
    };
    const updatedWorkouts = localWorkouts.map(w => 
      w.id === workout.id ? updatedWorkout : w
    );
    setLocalWorkouts(updatedWorkouts);
    
    // Close execution mode
    setExecutingWorkout(null);
  }, [updateWorkoutStatus, localWorkouts]);

  const handleResetWorkout = useCallback(async (workout: Workout) => {
    // Reset workout status to planned using store
    await updateWorkoutStatus(workout.id, 'planned');
    
    // Also update local state immediately for better UX
    const updatedWorkout = { 
      ...workout, 
      status: 'planned' as const,
      completedAt: undefined,
      actualDuration: undefined
    };
    const updatedWorkouts = localWorkouts.map(w => 
      w.id === workout.id ? updatedWorkout : w
    );
    setLocalWorkouts(updatedWorkouts);
  }, [updateWorkoutStatus, localWorkouts]);

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={() => {}}
      >
        <div className="space-y-4">
          {/* Weekly Stats - Integrated */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold">{stableWeeklyStats.current.totalDuration}m</div>
                    <div className="text-xs text-muted-foreground">Weekly Volume</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold">{stableWeeklyStats.current.totalWorkouts}</div>
                    <div className="text-xs text-muted-foreground">Workouts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Target className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-lg font-bold">{stableWeeklyStats.current.totalExercises}</div>
                    <div className="text-xs text-muted-foreground">Exercises</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Workout Rows */}
          <div className="space-y-3">
            {DAYS.map((day) => {
              const dayWorkouts = localWorkouts.filter(w => w.dayOfWeek === day.id);
              
              return (
                <DroppableDay
                  key={day.id}
                  day={day}
                  workouts={dayWorkouts}
                  onEditWorkout={setEditingWorkout}
                  onStartWorkout={handleStartWorkout}
                  onCompleteWorkout={handleCompleteWorkout}
                  onResetWorkout={handleResetWorkout}
                  isEditable={isEditable}
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
      {editingWorkout && (
        <WorkoutEditor
          workout={editingWorkout}
          isOpen={!!editingWorkout}
          onClose={() => setEditingWorkout(null)}
          onSave={handleWorkoutSave}
        />
      )}

      {executingWorkout && (
        <WorkoutExecutionMode
          workout={executingWorkout}
          isOpen={!!executingWorkout}
          onClose={() => setExecutingWorkout(null)}
          onComplete={() => {
            handleCompleteWorkout(executingWorkout);
            setExecutingWorkout(null);
          }}
          onWorkoutUpdate={(updatedWorkout) => {
            // Update local state
            const updatedWorkouts = localWorkouts.map(w => 
              w.id === updatedWorkout.id ? updatedWorkout : w
            );
            setLocalWorkouts(updatedWorkouts);
            syncToParent(updatedWorkouts);
            
            // Update executing workout
            setExecutingWorkout(updatedWorkout);
          }}
        />
      )}
    </>
  );
});
