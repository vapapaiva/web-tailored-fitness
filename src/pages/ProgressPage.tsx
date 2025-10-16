/**
 * Progress Page - Shows workout statistics and completed workouts history
 * Completely redesigned to show stats from workoutsStore
 */

import { useEffect, useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WorkoutStatsDisplay } from '@/components/workouts/WorkoutStatsDisplay';
import { VolumeStatsDisplay } from '@/components/workouts/VolumeStatsDisplay';
import { CompletedWorkoutsList } from '@/components/workouts/CompletedWorkoutsList';
import { ChevronDown, ChevronUp, TrendingUp, Loader2, AlertCircle } from 'lucide-react';

/**
 * Progress page - displays workout statistics and completed workouts
 */
export function ProgressPage() {
  const { 
    loadWorkouts, 
    startRealtimeSync, 
    stopRealtimeSync, 
    loading,
    error,
    clearError,
    getCompletedWorkouts,
    getWorkoutStats
  } = useWorkoutsStore();
  
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  useEffect(() => {
    // Load workouts and start real-time sync
    loadWorkouts();
    startRealtimeSync();
    
    // Cleanup on unmount
    return () => {
      stopRealtimeSync();
    };
  }, [loadWorkouts, startRealtimeSync, stopRealtimeSync]);

  // Recompute on every render (triggered by workouts changes)
  const completedWorkouts = getCompletedWorkouts();
  const stats = getWorkoutStats();

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your progress...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (completedWorkouts.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
            <p className="text-muted-foreground">
              Track your fitness journey and achievements
            </p>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
          <p className="text-muted-foreground">
            Track your fitness journey and achievements
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Section (Expandable) */}
        <Card>
          <CardHeader>
            <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between hover:bg-muted/50 p-0"
                >
                  <CardTitle className="font-medium">Statistics</CardTitle>
                  {isStatsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <WorkoutStatsDisplay stats={stats} />
                <VolumeStatsDisplay completedWorkouts={completedWorkouts} />
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>

        {/* Completed Workouts Section */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletedWorkoutsList workouts={completedWorkouts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
