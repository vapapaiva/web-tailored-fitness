/**
 * Done Section - Container for completed workouts and stats
 * Includes: Stats display and completed workouts list
 */

import { useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WorkoutStatsDisplay } from './WorkoutStatsDisplay';
import { CompletedWorkoutsList } from './CompletedWorkoutsList';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

/**
 * Done section component
 */
export function DoneSection() {
  // Subscribe to workouts array to ensure reactivity
  const workouts = useWorkoutsStore(state => state.workouts);
  const getCompletedWorkouts = useWorkoutsStore(state => state.getCompletedWorkouts);
  const getWorkoutStats = useWorkoutsStore(state => state.getWorkoutStats);
  
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  // Recompute on every render (triggered by workouts changes)
  const completedWorkouts = getCompletedWorkouts();
  const stats = getWorkoutStats();

  // Empty state
  if (completedWorkouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Done</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">No completed workouts yet</h3>
              <p className="text-sm text-muted-foreground">
                Complete your first workout to start tracking progress
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Done</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Subsection (Expandable) */}
        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between hover:bg-muted/50"
            >
              <span className="font-medium">Statistics</span>
              {isStatsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <WorkoutStatsDisplay stats={stats} />
          </CollapsibleContent>
        </Collapsible>

        {/* Completed Workouts List */}
        <div className="space-y-2">
          <h3 className="font-medium px-2 text-sm text-muted-foreground">
            Completed Workouts
          </h3>
          <CompletedWorkoutsList workouts={completedWorkouts} />
        </div>
      </CardContent>
    </Card>
  );
}

