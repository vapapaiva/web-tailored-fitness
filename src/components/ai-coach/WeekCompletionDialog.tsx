/**
 * Week Completion Dialog - Complete current week and generate next week
 */

import { useState } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import type { WorkoutDocument } from '@/types/workout';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, Sparkles } from 'lucide-react';

interface WeekCompletionDialogProps {
  plan: AIPlan;
  workouts: WorkoutDocument[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Week completion dialog component
 */
export function WeekCompletionDialog({ 
  plan, 
  workouts, 
  isOpen, 
  onClose 
}: WeekCompletionDialogProps) {
  const { generateNextMicrocycle, generating } = useAICoachStore();
  const [reflection, setReflection] = useState('');
  const [step, setStep] = useState<'reflect' | 'generating'>('reflect');

  if (!plan.currentMicrocycle) return null;

  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const completionRate = workouts.length > 0 
    ? Math.round((completedWorkouts.length / workouts.length) * 100)
    : 0;

  const handleGenerateNext = async () => {
    setStep('generating');
    await generateNextMicrocycle(reflection);
    
    // Check if successful
    const { error } = useAICoachStore.getState();
    if (!error) {
      onClose();
      setReflection('');
      setStep('reflect');
    } else {
      setStep('reflect');
    }
  };

  const handleClose = () => {
    if (!generating) {
      onClose();
      setReflection('');
      setStep('reflect');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Complete Week {plan.currentMicrocycle.week}
          </DialogTitle>
          <DialogDescription>
            Reflect on your progress and generate next week's workouts
          </DialogDescription>
        </DialogHeader>

        {step === 'reflect' && (
          <div className="space-y-6">
            {/* Completion Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Week Completion</p>
                    <p className="text-2xl font-bold">{completionRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {completedWorkouts.length} of {workouts.length} workouts
                    </p>
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      {completedWorkouts.map(w => (
                        <CheckCircle key={w.id} className="h-4 w-4 text-green-600" />
                      ))}
                      {Array.from({ length: workouts.length - completedWorkouts.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-4 w-4 rounded-full border-2 border-muted" />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Completed Workouts List */}
            {completedWorkouts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Completed Workouts:</Label>
                <div className="space-y-1">
                  {completedWorkouts.map(workout => (
                    <div key={workout.id} className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span>{workout.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {workout.exercises.length} exercises
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Reflection */}
            <div className="space-y-2">
              <Label htmlFor="reflection">
                Weekly Reflection <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="reflection"
                placeholder="How did this week go? Any challenges? Successes? Adjustments needed for next week?"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Generating Next Week</h3>
              <p className="text-sm text-muted-foreground mt-2">
                AI is creating workouts for Week {plan.currentMicrocycle.week + 1}...
              </p>
            </div>
          </div>
        )}

        {step === 'reflect' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleGenerateNext} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Week {plan.currentMicrocycle.week + 1}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

