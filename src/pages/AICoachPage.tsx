/**
 * AI Coach Page - AI-powered fitness planning
 * Two-phase generation: Goals first, then workouts
 */

import { useEffect } from 'react';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { GoalsGenerationFlow } from '@/components/ai-coach/GoalsGenerationFlow';
import { MicrocycleGenerationFlow } from '@/components/ai-coach/MicrocycleGenerationFlow';
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
    startRealtimeSync();
    
    // CRITICAL: Also load and sync workouts (needed for microcycle display)
    loadWorkouts();
    startWorkoutsSync();
    
    return () => {
      stopRealtimeSync();
      stopWorkoutsSync();
    };
  }, [loadPlan, startRealtimeSync, stopRealtimeSync, loadWorkouts, startWorkoutsSync, stopWorkoutsSync]);

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

  // Goals approved but no workouts → show workout generation flow
  if (currentPlan.status === 'goals-approved' && !currentPlan.currentMicrocycle) {
    return <MicrocycleGenerationFlow />;
  }

  // Has active plan → show dashboard
  return <AICoachDashboard plan={currentPlan} />;
}

