import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getWorkoutHistory } from '@/lib/workoutHistoryService';
import type { WorkoutHistoryDocument } from '@/types/fitness';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Calendar, 
  Dumbbell, 
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { formatWeekHeader } from '@/lib/dateUtils';

/**
 * Progress page - displays workout history and statistics
 */
export function ProgressPage() {
  const { user } = useAuthStore();
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const history = await getWorkoutHistory(user.uid);
        setWorkoutHistory(history);
      } catch (err) {
        console.error('[Progress Page] Failed to fetch history:', err);
        setError('Failed to load workout history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  // Calculate stats
  const totalWeeks = workoutHistory.length;
  const totalWorkouts = workoutHistory.reduce((sum, week) => sum + week.completedWorkouts.length, 0);
  const totalExercises = workoutHistory.reduce(
    (sum, week) => sum + week.completedWorkouts.reduce((s, w) => s + w.exercises.length, 0),
    0
  );

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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (workoutHistory.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
            <p className="text-muted-foreground">
              Track your fitness journey and achievements
            </p>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No Progress Yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete your first week to start tracking progress
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

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Weeks Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalWeeks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Training weeks logged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Workouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalWorkouts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sessions completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Exercises
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalExercises}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Exercises performed
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Workout History Timeline */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Workout History</h2>

          {workoutHistory.map((week) => {
            const weekTitle = formatWeekHeader(week.weekNumber, week.dateRange, week.weekFocus);
            const completionRate = week.completedWorkouts.length > 0 
              ? 100 
              : 0;

            return (
              <Card key={week.weekId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Calendar className="h-5 w-5" />
                        <span>{weekTitle}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Completed {new Date(week.completedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={completionRate === 100 ? "default" : completionRate >= 70 ? "secondary" : "destructive"}
                      className={completionRate === 100 ? "bg-green-600" : ""}
                    >
                      {week.completedWorkouts.length} workout{week.completedWorkouts.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Weekly Reflection */}
                  {week.weeklyReflection && (
                    <div className="text-sm bg-muted/50 p-3 rounded-md">
                      <p className="font-medium mb-1">Weekly Reflection:</p>
                      <p className="text-muted-foreground italic">{week.weeklyReflection}</p>
                    </div>
                  )}

                  {/* Completed Workouts */}
                  {week.completedWorkouts.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Completed Workouts:</p>
                      {week.completedWorkouts.map((workout) => (
                        <div
                          key={workout.workoutId}
                          className="flex items-center justify-between p-3 rounded-md border bg-card"
                        >
                          <div className="flex items-center space-x-3">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <div>
                              <p className="font-medium">{workout.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {workout.exercises.length} exercises
                                {workout.duration && ` • ${workout.duration} min`}
                              </p>
                            </div>
                          </div>
                          {workout.date && (
                            <Badge variant="outline" className="text-xs">
                              {new Date(workout.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No workouts completed this week
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {workoutHistory.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No History Yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete your first week to start seeing your progress here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
