/**
 * Current Microcycle Card - Shows current week workouts and progress
 */

import { useState } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import type { WorkoutDocument } from '@/types/workout';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkoutCardV2 } from '@/components/workouts/WorkoutCardV2';
import { WorkoutExecutionDialog } from '@/components/workouts/WorkoutExecutionDialog';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Calendar, RotateCcw } from 'lucide-react';
import { formatWeekHeader } from '@/lib/dateUtils';

interface CurrentMicrocycleCardProps {
  plan: AIPlan;
  workouts: WorkoutDocument[];
}

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

/**
 * Current microcycle card component
 */
export function CurrentMicrocycleCard({ plan, workouts }: CurrentMicrocycleCardProps) {
  const { markAsComplete, markAsIncomplete, deleteWorkout } = useWorkoutsStore();
  const { regenerateMicrocycle } = useAICoachStore();
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (!plan.currentMicrocycle) return null;

  // Group by actual date (not dayOfWeek)
  const workoutsByDate = new Map<string, WorkoutDocument[]>();
  workouts.forEach(w => {
    if (w.date) {
      if (!workoutsByDate.has(w.date)) {
        workoutsByDate.set(w.date, []);
      }
      workoutsByDate.get(w.date)!.push(w);
    }
  });

  // Get sorted dates in microcycle range
  const microcycleDates: Array<{ date: string; dayOfWeek: number; dayName: string }> = [];
  const startDate = new Date(plan.currentMicrocycle.dateRange.start);
  const endDate = new Date(plan.currentMicrocycle.dateRange.end);
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const dayName = DAYS.find(day => day.id === dayOfWeek)?.name || '';
    microcycleDates.push({ date: dateStr, dayOfWeek, dayName });
  }

  const handleCompleteWorkout = async (workout: WorkoutDocument) => {
    await markAsComplete(workout.id);
    setEditingWorkoutId(null);
  };

  const handleResetWorkout = async (workout: WorkoutDocument) => {
    await markAsIncomplete(workout.id);
  };

  const handleDeleteWorkout = async (workout: WorkoutDocument) => {
    await deleteWorkout(workout.id);
  };

  const editingWorkout = editingWorkoutId ? workouts.find(w => w.id === editingWorkoutId) : null;

  return (
    <>
      {/* Regenerate Feedback */}
      {showRegenerate && (
        <Alert className="mb-4">
          <RotateCcw className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">Regenerate Current Week</p>
            <Textarea
              placeholder="Optional: Add feedback (e.g., more upper body, less cardio...)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setShowRegenerate(false)}>
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={async () => {
                  await regenerateMicrocycle(feedback);
                  setShowRegenerate(false);
                  setFeedback('');
                }}
              >
                Regenerate
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>
                  Current Microcycle: {formatWeekHeader(
                    0, // Week number not used
                    plan.currentMicrocycle.dateRange,
                    plan.currentMicrocycle.focus
                  )}
                </span>
              </CardTitle>
              <CardDescription>{plan.currentMicrocycle.value}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowRegenerate(!showRegenerate)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {microcycleDates.map(({ date, dayName }) => {
              const dayWorkouts = workoutsByDate.get(date) || [];
              if (dayWorkouts.length === 0) return null;

              return (
                <div key={date}>
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    {dayName}, {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="space-y-2">
                    {dayWorkouts.map((workout: WorkoutDocument) => (
                      <WorkoutCardV2
                        key={workout.id}
                        workout={workout}
                        onStart={(w) => setEditingWorkoutId(w.id)}
                        onComplete={handleCompleteWorkout}
                        onReset={handleResetWorkout}
                        onDelete={handleDeleteWorkout}
                        isEditable={true}
                        isDraggable={false}
                        showSource={false}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Workout Editing Dialog */}
      {editingWorkout && (
        <WorkoutExecutionDialog
          workout={editingWorkout}
          isOpen={true}
          onClose={() => setEditingWorkoutId(null)}
          onComplete={handleCompleteWorkout}
        />
      )}
    </>
  );
}

