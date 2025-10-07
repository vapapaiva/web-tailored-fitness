import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFitnessPlanStore, checkProfileCompleteness } from '@/stores/fitnessPlanStore';
import type { FitnessPlan, CompletedWorkout } from '@/types/fitness';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlanLoadingSkeleton } from '@/components/fitness/PlanLoadingSkeleton';
import { FitnessPlanDisplay } from '@/components/fitness/FitnessPlanDisplay';
import { MicrocycleCompletion } from '@/components/fitness/MicrocycleCompletion';
import { WeekCompletionButton } from '@/components/fitness/WeekCompletionButton';
import { Dumbbell, User, Sparkles, AlertCircle } from 'lucide-react';

/**
 * Fitness Plan page - shows generation prompt or current plan
 */
export function FitnessPlanPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentPlan, loading, generating, error, generatePlan, loadPlan, clearError, approvePlan, updatePlanSilently, startRealtimeSync, stopRealtimeSync, completeMicrocycle } = useFitnessPlanStore();
  const { fetchConfig } = useProfileConfigStore();
  const [showMicrocycleCompletion, setShowMicrocycleCompletion] = useState(false);

  // Load plan and config on component mount
  useEffect(() => {
    loadPlan();
    fetchConfig();
    startRealtimeSync(); // Start real-time sync for multi-device support
    
    // Cleanup on unmount
    return () => {
      stopRealtimeSync();
    };
  }, [loadPlan, fetchConfig, startRealtimeSync, stopRealtimeSync]);

  const isProfileComplete = checkProfileCompleteness(user?.profile);

  const handleCompleteWeek = useCallback(async (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => {
    try {
      await completeMicrocycle(completedWorkouts, weeklyNotes);
      setShowMicrocycleCompletion(false);
    } catch (error) {
      console.error('Failed to complete week:', error);
    }
  }, [completeMicrocycle]);

  const handleGeneratePlan = useCallback(async () => {
    if (!isProfileComplete) {
      navigate('/onboarding');
      return;
    }
    
    await generatePlan();
  }, [isProfileComplete, navigate, generatePlan]);

  const handleViewProfile = useCallback(() => {
    navigate('/app/profile');
  }, [navigate]);

  // Hybrid update: immediate local state + async Firebase persistence
  const handlePlanUpdate = useCallback(async (updatedPlan: FitnessPlan) => {
    // 1. IMMEDIATE: Update local state for smooth UX (no blinking)
    useFitnessPlanStore.setState({
      currentPlan: updatedPlan
    });

    // 2. ASYNC: Persist to Firebase silently (no store updates, no re-renders)
    try {
      await updatePlanSilently(updatedPlan);
    } catch (error) {
      console.error('Failed to persist plan changes to Firebase:', error);
      // Could show a toast notification here for user awareness
    }
  }, [updatePlanSilently]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your fitness plan...</p>
        </div>
      </div>
    );
  }

  // Show loading skeleton when generating
  if (generating) {
    return <PlanLoadingSkeleton />;
  }

  // Show generation prompt if no plan exists
  if (!currentPlan) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Your Fitness Journey Awaits</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              You don't have a fitness plan yet. Let's create a personalized workout plan based on your profile data.
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

          {/* Profile Completeness Check */}
          {!isProfileComplete && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Please complete your profile first to generate a personalized fitness plan.
              </AlertDescription>
            </Alert>
          )}

          {/* Generation Card */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Generate Your Fitness Plan</span>
              </CardTitle>
              <CardDescription>
                We'll create a personalized 6-month fitness plan with weekly workouts tailored to your goals, fitness level, and available equipment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Features */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">What you'll get:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 6-month structured plan</li>
                    <li>• Weekly workout schedules</li>
                    <li>• Detailed exercise instructions</li>
                    <li>• Progressive difficulty</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Personalized for:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Your fitness level</li>
                    <li>• Available equipment</li>
                    <li>• Time constraints</li>
                    <li>• Personal goals</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleViewProfile}
                  variant="outline"
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  Review Profile
                </Button>
                <Button 
                  onClick={handleGeneratePlan}
                  disabled={generating || !isProfileComplete}
                  className="flex-1"
                >
                  {generating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Plan...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Generate My Plan
                    </div>
                  )}
                </Button>
              </div>

              {!isProfileComplete && (
                <p className="text-xs text-muted-foreground text-center">
                  Complete your profile to unlock plan generation
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show plan content with full UI
  return (
    <div className="container mx-auto p-6">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FitnessPlanDisplay
        plan={currentPlan}
        onPlanUpdate={handlePlanUpdate}
        onRegeneratePlan={generatePlan}
        onApprovePlan={approvePlan}
        isGenerating={generating}
      />

      {/* Smart Week Completion Button */}
      {currentPlan && (
        <WeekCompletionButton
          microcycle={currentPlan.currentMicrocycle}
          onComplete={() => setShowMicrocycleCompletion(true)}
        />
      )}

      {/* Microcycle Completion Dialog */}
      {currentPlan && (
        <MicrocycleCompletion
          plan={currentPlan}
          isOpen={showMicrocycleCompletion}
          onClose={() => setShowMicrocycleCompletion(false)}
          onComplete={handleCompleteWeek}
        />
      )}
    </div>
  );
}
