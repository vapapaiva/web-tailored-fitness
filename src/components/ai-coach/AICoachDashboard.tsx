/**
 * AI Coach Dashboard - Main dashboard showing goals, current week, and progress
 */

import { useState, useEffect } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { FitnessGoalsCard } from './FitnessGoalsCard';
import { CurrentMicrocycleCard } from './CurrentMicrocycleCard';
import { WeekCompletionDialog } from './WeekCompletionDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const generating = useAICoachStore(state => state.generating);
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
    const state = checkWeekCompletionState(microcycleForCompletion as any);
    setCompletionState(state);
    
    const interval = setInterval(() => {
      const updatedState = checkWeekCompletionState(microcycleForCompletion as any);
      setCompletionState(updatedState);
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

  // Show generating overlay during next week generation
  if (generating) {
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

          {/* Generating Card */}
          <Card className="border-primary">
            <CardContent className="py-12">
              <div className="text-center space-y-6">
                <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Generating Your Next Microcycle</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    AI is analyzing your progress and creating personalized workouts for the upcoming week...
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  <span>This may take 20-30 seconds</span>
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
        {plan.currentMicrocycle && (
          <>
            {completionState.state === 'long-gap' ? (
              // Long gap state - show prominent call-to-action card
              <Card className="border-orange-500 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-orange-900 dark:text-orange-200">
                    <TrendingUp className="h-6 w-6" />
                    <span>Week Outdated - Time to Move Forward!</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-orange-800 dark:text-orange-300 font-medium">
                      {getMessageEmoji(completionState.state)}
                      {completionState.message}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      Your current week ended on {new Date(plan.currentMicrocycle.dateRange.end).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}. Let's complete it and generate fresh workouts for the upcoming week!
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => setShowWeekCompletion(true)}
                    size="lg"
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg py-6 text-lg font-semibold"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Complete & Generate Next Microcycle 🚀
                  </Button>
                </CardContent>
              </Card>
            ) : (
              // Normal state - show standard button
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
          </>
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


