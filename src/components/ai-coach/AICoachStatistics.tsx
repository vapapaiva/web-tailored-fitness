/**
 * AI Coach Statistics - Shows workout statistics and AI Coach impact
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, Target, Dumbbell, CheckCircle, Info } from 'lucide-react';
import { useWorkoutsStore } from '@/stores/workoutsStore';

/**
 * AI Coach statistics component
 */
export function AICoachStatistics() {
  const workouts = useWorkoutsStore(state => state.workouts);

  // Calculate statistics
  const plannedWorkouts = workouts.filter(w => w.status === 'planned' || w.status === 'in-progress');
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  
  // AI suggested workouts (all workouts with source: 'ai-coach')
  const aiPlannedWorkouts = plannedWorkouts.filter(w => w.source === 'ai-coach');
  const aiCompletedWorkouts = completedWorkouts.filter(w => w.source === 'ai-coach');
  
  const aiPlannedPercentage = plannedWorkouts.length > 0
    ? Math.round((aiPlannedWorkouts.length / plannedWorkouts.length) * 100)
    : 0;
  
  const aiCompletedPercentage = completedWorkouts.length > 0
    ? Math.round((aiCompletedWorkouts.length / completedWorkouts.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Info about AI Coach tracking */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>AI Suggested:</strong> Workouts with source "AI Coach" - includes all AI-generated workouts, 
          even if modified or no longer linked to a microcycle
        </AlertDescription>
      </Alert>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Planned Workouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planned Workouts</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plannedWorkouts.length}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {aiPlannedWorkouts.length} AI Suggested
              </Badge>
              {aiPlannedPercentage > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({aiPlannedPercentage}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Workouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Workouts</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedWorkouts.length}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {aiCompletedWorkouts.length} AI Suggested
              </Badge>
              {aiCompletedPercentage > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({aiCompletedPercentage}%)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Goals Progress (Placeholder) */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">Coming Soon</div>
            <p className="text-xs text-muted-foreground mt-2">
              Goal tracking and progress metrics
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


