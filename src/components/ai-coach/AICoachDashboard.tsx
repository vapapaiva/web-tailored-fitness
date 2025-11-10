/**
 * AI Coach Dashboard - Main dashboard showing goals, statistics, and generation button
 * Redesigned for flexible "coach suggests" system
 */

import { useState } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import { FitnessGoalsCard } from './FitnessGoalsCard';
import { AICoachStatistics } from './AICoachStatistics';
import { MicrocycleGenerationFlow } from './MicrocycleGenerationFlow';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';

interface AICoachDashboardProps {
  plan: AIPlan;
}

/**
 * AI Coach dashboard component
 */
export function AICoachDashboard({ plan }: AICoachDashboardProps) {
  const [showGenerationFlow, setShowGenerationFlow] = useState(false);

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

        {/* Statistics Dashboard */}
        <AICoachStatistics />

        {/* Generate Suggestions Button - Always Available */}
        <div className="flex flex-col items-center space-y-2 py-8">
              <Button 
            onClick={() => setShowGenerationFlow(true)}
            size="lg"
            className="px-8"
              >
            <Sparkles className="h-5 w-5 mr-2" />
            Get Weekly Workout Suggestions
              </Button>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Ask AI Coach to suggest workouts for the upcoming week based on your goals and current plan
                    </p>
                  </div>
                  
        {/* TODO: Completed Microcycles History */}
        {plan.completedMicrocycles.length > 0 && (
          <div className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Completed Weeks</h2>
            <p className="text-sm text-muted-foreground">
              You've completed {plan.completedMicrocycles.length} week{plan.completedMicrocycles.length !== 1 ? 's' : ''} with AI Coach
                </p>
              </div>
        )}
      </div>

      {/* Generation Flow Dialog */}
      <Dialog open={showGenerationFlow} onOpenChange={setShowGenerationFlow}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0">
          <MicrocycleGenerationFlow onClose={() => setShowGenerationFlow(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
