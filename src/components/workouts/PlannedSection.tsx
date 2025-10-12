/**
 * Planned Section - Container for all planned workouts
 * Includes: Past, Current Week, Later, Without Date subsections
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PastWorkouts } from './PastWorkouts';
import { CurrentWeekWorkouts } from './CurrentWeekWorkouts';
import { LaterWorkouts } from './LaterWorkouts';
import { WithoutDateWorkouts } from './WithoutDateWorkouts';
import { Plus, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface PlannedSectionProps {
  onAddWorkout: () => void;
}

/**
 * Planned section component
 */
export function PlannedSection({ onAddWorkout }: PlannedSectionProps) {
  const navigate = useNavigate();
  
  // Subscribe to workouts array to ensure reactivity
  const workouts = useWorkoutsStore(state => state.workouts);
  const getPastWorkouts = useWorkoutsStore(state => state.getPastWorkouts);
  const getCurrentWeekWorkouts = useWorkoutsStore(state => state.getCurrentWeekWorkouts);
  const getLaterWorkouts = useWorkoutsStore(state => state.getLaterWorkouts);
  const getWithoutDateWorkouts = useWorkoutsStore(state => state.getWithoutDateWorkouts);

  const [isPastOpen, setIsPastOpen] = useState(false);
  const [isLaterOpen, setIsLaterOpen] = useState(false);
  const [isWithoutDateOpen, setIsWithoutDateOpen] = useState(false);

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

  return (
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
            )}

            {/* Without Date (Collapsible) */}
            {withoutDateWorkouts.length > 0 && (
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
                  <WithoutDateWorkouts workouts={withoutDateWorkouts} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

