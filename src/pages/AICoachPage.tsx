/**
 * AI Coach Page - AI-powered fitness planning
 * Flexible "coach suggests" system with user-editable prompts
 */

import { useEffect } from 'react';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { GoalsGenerationFlow } from '@/components/ai-coach/GoalsGenerationFlow';
import { AICoachDashboard } from '@/components/ai-coach/AICoachDashboard';
import { Loader2 } from 'lucide-react';

/**
 * AI Coach page component
 */
export function AICoachPage() {
  const { 
    currentPlan, 
    loading, 
    loadPlan, 
    loadCustomPrompts,
    startRealtimeSync, 
    stopRealtimeSync 
  } = useAICoachStore();

  const {
    loadWorkouts,
    startRealtimeSync: startWorkoutsSync,
    stopRealtimeSync: stopWorkoutsSync
  } = useWorkoutsStore();

  useEffect(() => {
    // Load and sync AI plan
    loadPlan();
    loadCustomPrompts();
    startRealtimeSync();
    
    // Also load and sync workouts (needed for statistics)
    loadWorkouts();
    startWorkoutsSync();
    
    return () => {
      stopRealtimeSync();
      stopWorkoutsSync();
    };
  }, [loadPlan, loadCustomPrompts, startRealtimeSync, stopRealtimeSync, loadWorkouts, startWorkoutsSync, stopWorkoutsSync]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading AI Coach...</p>
        </div>
      </div>
    );
  }

  // No plan OR goals in draft → show goals generation flow
  if (!currentPlan || currentPlan.status === 'goals-draft') {
    return <GoalsGenerationFlow />;
  }

  // Goals approved → show dashboard (always, regardless of suggestions/microcycle)
  // Dashboard contains the generate button for getting suggestions
  return <AICoachDashboard plan={currentPlan} />;
}

