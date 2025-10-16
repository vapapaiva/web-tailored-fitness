/**
 * Planned Section - Container for all planned workouts
 * Includes: Past, Current Week, Later, Without Date subsections
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PastWorkouts } from './PastWorkouts';
import { CurrentWeekWorkouts } from './CurrentWeekWorkouts';
import { LaterWorkouts } from './LaterWorkouts';
import { WithoutDateWorkouts } from './WithoutDateWorkouts';
import { Plus, ChevronDown, ChevronUp, Sparkles, Dumbbell, AlertCircle, Calendar } from 'lucide-react';
import { getWeekStartDate, calculateDateFromDayOfWeek } from '@/lib/dateUtils';
import { generateRankAtPosition } from '@/lib/lexoRank';

interface PlannedSectionProps {
  onAddWorkout: () => void;
}

// Droppable wrapper component for subsections
function DroppableSubsection({ 
  id, 
  children, 
  className = '' 
}: { 
  id: string; 
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-primary/5 border-2 border-dashed border-primary rounded-lg' : ''}`}
    >
      {children}
    </div>
  );
}

/**
 * Planned section component with universal DND
 */
export function PlannedSection({ onAddWorkout }: PlannedSectionProps) {
  const navigate = useNavigate();
  
  // Subscribe to workouts array to ensure reactivity
  const workouts = useWorkoutsStore(state => state.workouts);
  const { updateWorkout } = useWorkoutsStore();
  const { currentPlan: aiPlan } = useAICoachStore();
  const getPastWorkouts = useWorkoutsStore(state => state.getPastWorkouts);
  const getCurrentWeekWorkouts = useWorkoutsStore(state => state.getCurrentWeekWorkouts);
  const getLaterWorkouts = useWorkoutsStore(state => state.getLaterWorkouts);
  const getWithoutDateWorkouts = useWorkoutsStore(state => state.getWithoutDateWorkouts);

  const [isPastOpen, setIsPastOpen] = useState(false);
  const [isLaterOpen, setIsLaterOpen] = useState(false);
  const [isWithoutDateOpen, setIsWithoutDateOpen] = useState(false);
  
  // DND state
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDocument | null>(null);
  const [dndError, setDndError] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingWorkout, setPendingWorkout] = useState<WorkoutDocument | null>(null);
  const [pendingDate, setPendingDate] = useState<string>('');
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Recompute on every render (triggered by workouts changes)
  const pastWorkouts = getPastWorkouts();
  const currentWeekWorkouts = getCurrentWeekWorkouts();
  const laterWorkouts = getLaterWorkouts();
  const withoutDateWorkouts = getWithoutDateWorkouts();

  const hasAnyWorkouts = 
    pastWorkouts.length > 0 || 
    currentWeekWorkouts.length > 0 || 
    laterWorkouts.length > 0 || 
    withoutDateWorkouts.length > 0;
  
  const weekStart = getWeekStartDate();
  
  // DND Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const workout = event.active.data.current?.workout as WorkoutDocument;
    setActiveWorkout(workout);
    setDndError('');
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorkout(null);
    
    if (!over) return;
    
    const draggedWorkout = active.data.current?.workout as WorkoutDocument;
    if (!draggedWorkout) return;
    
    const overId = over.id.toString();
    
    console.log('[PlannedSection DND] Drop detected:', {
      workoutName: draggedWorkout.name,
      source: draggedWorkout.source,
      targetId: overId
    });
    
    // Scenario 1: Dropped on a weekday (day-0 through day-6)
    if (overId.startsWith('day-')) {
      const targetDayOfWeek = parseInt(overId.replace('day-', ''));
      const targetDate = calculateDateFromDayOfWeek(targetDayOfWeek, weekStart);
      
      console.log('[PlannedSection DND] Dropped on weekday:', { targetDayOfWeek, targetDate });
      
      // Validate for AI Coach workouts
      if (draggedWorkout.source === 'ai-coach' && draggedWorkout.aiCoachContext && aiPlan?.currentMicrocycle) {
        if (draggedWorkout.aiCoachContext.microcycleId === aiPlan.currentMicrocycle.id) {
          const { start, end } = aiPlan.currentMicrocycle.dateRange;
          if (targetDate < start || targetDate > end) {
            setDndError(`Cannot move AI Coach workout outside microcycle range (${start} to ${end})`);
            setTimeout(() => setDndError(''), 5000);
            return;
          }
        }
      }
      
      // Update to weekday
      const targetDayWorkouts = currentWeekWorkouts.filter(w => w.dayOfWeek === targetDayOfWeek && w.id !== draggedWorkout.id);
      const existingRanks = targetDayWorkouts.map(w => w.rank).filter(Boolean);
      const newRank = generateRankAtPosition(existingRanks, targetDayWorkouts.length);
      
      await updateWorkout(draggedWorkout.id, {
        date: targetDate,
        dayOfWeek: targetDayOfWeek,
        rank: newRank
      });
      
      console.log('[PlannedSection DND] Moved to weekday successfully');
      return;
    }
    
    // Scenario 2: Dropped on subsection (past, later, without-date)
    if (overId === 'without-date') {
      console.log('[PlannedSection DND] Dropped on without-date section');
      
      // Prevent AI Coach workouts from losing their date
      if (draggedWorkout.source === 'ai-coach' && draggedWorkout.aiCoachContext) {
        console.log('[PlannedSection DND] Blocked: AI workout cannot be without date');
        setDndError('AI Coach workouts must have a date to stay aligned with your training plan');
        setTimeout(() => setDndError(''), 5000);
        return;
      }
      
      // Drop to "Without Date" - clear the date
      console.log('[PlannedSection DND] Clearing date for manual workout');
      await updateWorkout(draggedWorkout.id, {
        date: undefined,
        dayOfWeek: undefined
      });
      console.log('[PlannedSection DND] Date cleared successfully');
      return;
    }
    
    if (['past', 'later'].includes(overId)) {
      console.log('[PlannedSection DND] Dropped on past/later - showing date picker');
      
      // Validate AI Coach workouts can't be moved to these sections with date picker
      // They must stay within microcycle range
      if (draggedWorkout.source === 'ai-coach' && draggedWorkout.aiCoachContext && aiPlan?.currentMicrocycle) {
        if (draggedWorkout.aiCoachContext.microcycleId === aiPlan.currentMicrocycle.id) {
          setDndError('AI Coach workouts must stay within the current week of the microcycle');
          setTimeout(() => setDndError(''), 5000);
          return;
        }
      }
      
      // From weekday to past/later - ask for specific date
      setPendingWorkout(draggedWorkout);
      setPendingDate(draggedWorkout.date || '');
      setShowDatePicker(true);
      return;
    }
    
    // Scenario 3: Dropped on another workout (reorder within same section or move to weekday)
    const targetWorkout = workouts.find(w => w.id === overId);
    if (targetWorkout && targetWorkout.dayOfWeek !== undefined) {
      // Target is in current week
      const targetDate = targetWorkout.date || calculateDateFromDayOfWeek(targetWorkout.dayOfWeek, weekStart);
      
      console.log('[PlannedSection DND] Dropped on workout in current week:', { targetDate });
      
      // Validate for AI Coach workouts
      if (draggedWorkout.source === 'ai-coach' && draggedWorkout.aiCoachContext && aiPlan?.currentMicrocycle) {
        if (draggedWorkout.aiCoachContext.microcycleId === aiPlan.currentMicrocycle.id) {
          const { start, end } = aiPlan.currentMicrocycle.dateRange;
          if (targetDate < start || targetDate > end) {
            setDndError(`Cannot move AI Coach workout outside microcycle range (${start} to ${end})`);
            setTimeout(() => setDndError(''), 5000);
            return;
          }
        }
      }
      
      await updateWorkout(draggedWorkout.id, {
        date: targetDate,
        dayOfWeek: targetWorkout.dayOfWeek,
        rank: targetWorkout.rank // Will be adjusted by lexoRank if needed
      });
      
      console.log('[PlannedSection DND] Moved to workout position successfully');
    }
  };
  
  const handleDatePickerConfirm = async () => {
    if (!pendingWorkout || !pendingDate) return;
    
    // Validate for AI Coach workouts
    if (pendingWorkout.source === 'ai-coach' && pendingWorkout.aiCoachContext && aiPlan?.currentMicrocycle) {
      if (pendingWorkout.aiCoachContext.microcycleId === aiPlan.currentMicrocycle.id) {
        const { start, end } = aiPlan.currentMicrocycle.dateRange;
        if (pendingDate < start || pendingDate > end) {
          setDndError(`Date must be within microcycle range: ${start} to ${end}`);
          setTimeout(() => setDndError(''), 5000);
          // Don't close dialog, let user fix the date
          return;
        }
      }
    }
    
    const newDayOfWeek = new Date(pendingDate).getDay();
    
    await updateWorkout(pendingWorkout.id, {
      date: pendingDate,
      dayOfWeek: newDayOfWeek
    });
    
    setShowDatePicker(false);
    setPendingWorkout(null);
    setPendingDate('');
  };

  return (
    <>
    {/* DND Error Alert */}
    {dndError && (
      <Alert variant="destructive" className="mb-3">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{dndError}</AlertDescription>
      </Alert>
    )}
    
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Planned</CardTitle>
          <Button onClick={onAddWorkout} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Workout
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Empty State */}
        {!hasAnyWorkouts && (
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No workouts planned yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start tracking your fitness journey by adding your first workout
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={onAddWorkout}>
                <Plus className="h-4 w-4 mr-2" />
                Add Workout
              </Button>
              <Button variant="outline" onClick={() => navigate('/app/ai-coach')}>
                <Sparkles className="h-4 w-4 mr-2" />
                Use AI Coach
              </Button>
            </div>
          </div>
        )}

        {/* Workout Subsections */}
        {hasAnyWorkouts && (
          <>
            {/* Past (Collapsible) */}
            {pastWorkouts.length > 0 && (
              <DroppableSubsection id="past">
                <Collapsible open={isPastOpen} onOpenChange={setIsPastOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between hover:bg-muted/50"
                    >
                      <span className="font-medium">
                        Past <span className="text-muted-foreground">({pastWorkouts.length})</span>
                      </span>
                      {isPastOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <PastWorkouts workouts={pastWorkouts} />
                  </CollapsibleContent>
                </Collapsible>
              </DroppableSubsection>
            )}

            {/* Current Week (Always Expanded) */}
            <div className="space-y-2">
              <h3 className="font-medium px-2 text-sm text-muted-foreground">
                Current Week
              </h3>
              <CurrentWeekWorkouts workouts={currentWeekWorkouts} />
            </div>

            {/* Later (Collapsible) */}
            {laterWorkouts.length > 0 && (
              <DroppableSubsection id="later">
                <Collapsible open={isLaterOpen} onOpenChange={setIsLaterOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between hover:bg-muted/50"
                    >
                      <span className="font-medium">
                        Later <span className="text-muted-foreground">({laterWorkouts.length})</span>
                      </span>
                      {isLaterOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <LaterWorkouts workouts={laterWorkouts} />
                  </CollapsibleContent>
                </Collapsible>
              </DroppableSubsection>
            )}

          </>
        )}
        
        {/* Without Date (Always visible as drop target, even when empty) */}
        <DroppableSubsection id="without-date" className="min-h-[60px]">
          <Collapsible open={isWithoutDateOpen} onOpenChange={setIsWithoutDateOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between hover:bg-muted/50"
              >
                <span className="font-medium">
                  Without Date <span className="text-muted-foreground">({withoutDateWorkouts.length})</span>
                </span>
                {isWithoutDateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {withoutDateWorkouts.length > 0 ? (
                <WithoutDateWorkouts workouts={withoutDateWorkouts} />
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  Drop workouts here to remove their scheduled date
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </DroppableSubsection>
      </CardContent>
    </Card>
    
    {/* Drag Overlay */}
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
    
    {/* Date Picker Dialog */}
    <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Set Workout Date
          </DialogTitle>
          <DialogDescription>
            Choose a specific date for "{pendingWorkout?.name}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="workout-date">Date</Label>
            <Input
              id="workout-date"
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full"
              min={pendingWorkout?.source === 'ai-coach' && aiPlan?.currentMicrocycle ? aiPlan.currentMicrocycle.dateRange.start : undefined}
              max={pendingWorkout?.source === 'ai-coach' && aiPlan?.currentMicrocycle ? aiPlan.currentMicrocycle.dateRange.end : undefined}
            />
            {pendingWorkout?.source === 'ai-coach' && aiPlan?.currentMicrocycle && (
              <p className="text-xs text-purple-600 dark:text-purple-400">
                AI Coach workout • Must be between {aiPlan.currentMicrocycle.dateRange.start} and {aiPlan.currentMicrocycle.dateRange.end}
              </p>
            )}
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This workout will be moved to the selected date and appear in the appropriate section.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setShowDatePicker(false);
            setPendingWorkout(null);
            setPendingDate('');
          }}>
            Cancel
          </Button>
          <Button onClick={handleDatePickerConfirm} disabled={!pendingDate}>
            Confirm Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

