/**
 * Microcycle Generation Flow - Generate first week of workouts
 * Phase 2 of AI Coach setup
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MicrocyclePreview } from './MicrocyclePreview';
import { GoalsEditor } from './GoalsEditor';
import { Sparkles, Dumbbell, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { calculateInitialWeekRange } from '@/lib/dateUtils';
import type { MicrocycleGenerationRequest } from '@/types/aiCoach';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Step = 'ready' | 'generating' | 'review' | 'editGoals';

/**
 * Microcycle generation flow component
 */
export function MicrocycleGenerationFlow() {
  const { user } = useAuthStore();
  const { currentPlan, generating, error, generateMicrocycle, approveMicrocycle, clearError } = useAICoachStore();
  const workouts = useWorkoutsStore(state => state.workouts);
  
  const [step, setStep] = useState<Step>('ready');
  const [waitingForWorkouts, setWaitingForWorkouts] = useState(false);

  // Wait for workouts to appear after generation
  useEffect(() => {
    if (step === 'generating' && currentPlan?.currentMicrocycle && !generating) {
      const expectedIds = currentPlan.currentMicrocycle.workoutIds;
      const currentIds = workouts.map(w => w.id);
      const allPresent = expectedIds.every(id => currentIds.includes(id));
      
      console.log('[MicrocycleFlow] Checking workout presence:', {
        expected: expectedIds.length,
        found: expectedIds.filter(id => currentIds.includes(id)).length,
        allPresent
      });
      
      if (allPresent) {
        console.log('[MicrocycleFlow] All workouts present, showing review');
        setStep('review');
        setWaitingForWorkouts(false);
      } else if (!waitingForWorkouts) {
        // Start waiting
        setWaitingForWorkouts(true);
        console.log('[MicrocycleFlow] Waiting for workouts to sync...');
        
        // Timeout after 5 seconds
        setTimeout(() => {
          const currentPlanState = useAICoachStore.getState().currentPlan;
          const workoutsState = useWorkoutsStore.getState().workouts;
          if (currentPlanState?.currentMicrocycle) {
            const stillMissing = currentPlanState.currentMicrocycle.workoutIds.filter(
              id => !workoutsState.find(w => w.id === id)
            );
            if (stillMissing.length > 0) {
              console.warn('[MicrocycleFlow] Timeout: Still missing workouts:', stillMissing);
            }
          }
          // Show review anyway after timeout
          setStep('review');
          setWaitingForWorkouts(false);
        }, 5000);
      }
    }
  }, [step, generating, currentPlan, workouts, waitingForWorkouts]);

  const handleGenerate = async () => {
    if (!user || !currentPlan) return;

    setStep('generating');
    setWaitingForWorkouts(false);

    // Get user profile
    const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
    const userProfile = profileDoc.exists() ? profileDoc.data() : {};

    // Calculate week date range
    const weekDateRange = calculateInitialWeekRange(new Date());

    const request: MicrocycleGenerationRequest = {
      userProfile,
      macrocycleGoal: currentPlan.macrocycleGoal,
      mesocycleMilestones: currentPlan.mesocycleMilestones,
      currentDate: new Date().toISOString(),
      weekNumber: 1,
      weekDateRange,
    };

    await generateMicrocycle(request);
    
    // Check if generation succeeded
    const { error: genError } = useAICoachStore.getState();
    if (genError) {
      setStep('ready');
    }
    // If no error, useEffect will handle transition to 'review' when workouts appear
  };

  const handleApprove = async () => {
    await approveMicrocycle();
  };

  // Edit goals
  if (step === 'editGoals' && currentPlan) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <GoalsEditor
          plan={currentPlan}
          onSave={() => setStep('ready')}
          onCancel={() => setStep('ready')}
        />
      </div>
    );
  }

  // Ready to generate
  if (step === 'ready') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Goals Approved!</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Now let's generate your first week of workouts
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

          {/* Goals Summary with Edit Option */}
          {currentPlan && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Your Approved Goals</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setStep('editGoals' as any)}
                  >
                    Edit Goals
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Macrocycle Goal:</p>
                  <p className="text-sm text-muted-foreground">{currentPlan.macrocycleGoal.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{currentPlan.mesocycleMilestones.length} Training Phases</p>
                  <p className="text-xs text-muted-foreground">
                    {currentPlan.mesocycleMilestones.map(m => m.name).join(' → ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                <Dumbbell className="h-5 w-5" />
                <span>Generate Your First Microcycle</span>
              </CardTitle>
              <CardDescription>
                AI will create personalized workouts for your first training week based on your goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={handleGenerate}
                  size="lg"
                  disabled={generating}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate First Microcycle
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Generating
  if (step === 'generating') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold">Generating Your Workouts</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  AI is creating your personalized first microcycle...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review
  if (step === 'review' && currentPlan?.currentMicrocycle) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <MicrocyclePreview
          plan={currentPlan}
          onApprove={handleApprove}
        />
      </div>
    );
  }

  return null;
}

