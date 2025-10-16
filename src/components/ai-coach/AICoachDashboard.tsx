/**
 * AI Coach Dashboard - Main dashboard showing goals, current week, and progress
 */

import { useState, useEffect } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { FitnessGoalsCard } from './FitnessGoalsCard';
import { CurrentMicrocycleCard } from './CurrentMicrocycleCard';
import { WeekCompletionDialog } from './WeekCompletionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, TrendingUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { daysSince } from '@/lib/dateUtils';
import { checkWeekCompletionState, getButtonClassName, getButtonText, getMessageClassName, getMessageEmoji } from '@/lib/weekCompletionLogic';

interface AICoachDashboardProps {
  plan: AIPlan;
}

/**
 * AI Coach dashboard component
 */
export function AICoachDashboard({ plan }: AICoachDashboardProps) {
  const navigate = useNavigate();
  const workouts = useWorkoutsStore(state => state.workouts);
  const [showWeekCompletion, setShowWeekCompletion] = useState(false);
  
  // Convert AIPlan microcycle to old Microcycle format for week completion logic
  const microcycleForCompletion = plan.currentMicrocycle ? {
    ...plan.currentMicrocycle,
    workouts: [], // Not needed for button logic
    weeklyCheckIns: { greenFlags: [], redFlags: [] },
    completedWorkouts: []
  } : null;

  const [completionState, setCompletionState] = useState(() => 
    checkWeekCompletionState(microcycleForCompletion as any)
  );

  // Re-check state every minute
  useEffect(() => {
    setCompletionState(checkWeekCompletionState(microcycleForCompletion as any));
    
    const interval = setInterval(() => {
      setCompletionState(checkWeekCompletionState(microcycleForCompletion as any));
    }, 60000);

    return () => clearInterval(interval);
  }, [plan.currentMicrocycle]);

  // Get workouts for current microcycle
  const currentWeekWorkouts = workouts.filter(w => 
    plan.currentMicrocycle?.workoutIds.includes(w.id)
  );

  // Calculate completion stats
  const completedCount = currentWeekWorkouts.filter(w => w.status === 'completed').length;
  const totalCount = currentWeekWorkouts.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Coach</h1>
          <p className="text-muted-foreground mt-1">
            Your personalized fitness plan and progress
          </p>
        </div>

        {/* Fitness Goals Card */}
        <FitnessGoalsCard plan={plan} />

        {/* Current Microcycle Card */}
        {plan.currentMicrocycle && (
          <CurrentMicrocycleCard 
            plan={plan}
            workouts={currentWeekWorkouts}
          />
        )}

        {/* Progress Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-base">
              <TrendingUp className="h-4 w-4" />
              <span>Current Week Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {totalCount} workouts completed
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/app/workouts')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Workouts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Week Completion Button with Smart State */}
        {plan.currentMicrocycle && completionState.state !== 'long-gap' && (
          <div className="flex flex-col items-center space-y-2">
            <Button 
              onClick={() => setShowWeekCompletion(true)}
              disabled={!completionState.canComplete}
              size="lg"
              className={getButtonClassName(completionState.state)}
            >
              {getButtonText(completionState.state)}
            </Button>
            <p className={getMessageClassName(completionState.state)}>
              {getMessageEmoji(completionState.state)}
              {completionState.message}
            </p>
          </div>
        )}

        {/* Week Completion Dialog */}
        {plan.currentMicrocycle && (
          <WeekCompletionDialog
            plan={plan}
            workouts={currentWeekWorkouts}
            isOpen={showWeekCompletion}
            onClose={() => setShowWeekCompletion(false)}
          />
        )}
      </div>
    </div>
  );
}


