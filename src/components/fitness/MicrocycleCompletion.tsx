import { useState } from 'react';
import type { FitnessPlan, Workout, CompletedWorkout } from '@/types/fitness';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Clock, Target, AlertCircle } from 'lucide-react';

interface MicrocycleCompletionProps {
  plan: FitnessPlan;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => void;
}

export function MicrocycleCompletion({ 
  plan, 
  isOpen, 
  onClose, 
  onComplete 
}: MicrocycleCompletionProps) {
  const [weeklyNotes, setWeeklyNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const completedWorkouts = plan.currentMicrocycle.workouts.filter(w => w.status === 'completed');
  const totalWorkouts = plan.currentMicrocycle.workouts.length;
  const completionRate = totalWorkouts > 0 ? (completedWorkouts.length / totalWorkouts) * 100 : 0;

  const convertToCompletedWorkout = (workout: Workout): CompletedWorkout => {
    return {
      workoutId: workout.id,
      name: workout.name,
      date: workout.completedAt || new Date().toISOString(),
      exercises: workout.exercises.map(exercise => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets.map(set => ({
          reps: set.reps,
          weight: set.weight,
          duration: set.duration,
          notes: set.notes,
          completed: true, // All sets are considered completed
        })),
        notes: exercise.instructions,
      })),
      duration: workout.actualDuration || workout.estimatedDuration,
      notes: workout.notes,
      completed: true,
    };
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const completedWorkoutsData = completedWorkouts.map(convertToCompletedWorkout);
      await onComplete(completedWorkoutsData, weeklyNotes);
      onClose();
    } catch (error) {
      console.error('Failed to complete microcycle:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Complete Week {plan.currentMicrocycle.week}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Completion Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Week Summary</span>
                <Badge 
                  variant={completionRate === 100 ? "default" : completionRate >= 70 ? "secondary" : "destructive"}
                  className="text-sm"
                >
                  {completionRate.toFixed(0)}% Complete
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedWorkouts.length}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{totalWorkouts - completedWorkouts.length}</div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalWorkouts}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Workouts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Completed Workouts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedWorkouts.length > 0 ? (
                <div className="space-y-3">
                  {completedWorkouts.map((workout) => (
                    <div key={workout.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <div>
                          <div className="font-medium">{workout.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {workout.exercises.length} exercises • {workout.actualDuration || workout.estimatedDuration}min
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {workout.completedAt && new Date(workout.completedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No workouts completed this week</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Reflection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="weekly-notes">
                  How did this week go? Any observations, challenges, or achievements?
                </Label>
                <Textarea
                  id="weekly-notes"
                  value={weeklyNotes}
                  onChange={(e) => setWeeklyNotes(e.target.value)}
                  placeholder="Reflect on your week... What went well? What was challenging? Any adjustments needed for next week?"
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={isCompleting || completedWorkouts.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompleting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Week & Generate Next
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
