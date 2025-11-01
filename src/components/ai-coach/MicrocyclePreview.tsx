/**
 * Microcycle Preview - Review and approve/regenerate generated workouts
 */

import { useState } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { WorkoutCardV2 } from '@/components/workouts/WorkoutCardV2';
import { WorkoutExecutionDialog } from '@/components/workouts/WorkoutExecutionDialog';
import { 
  CheckCircle, 
  RotateCcw, 
  Calendar,
  Dumbbell
} from 'lucide-react';
import { formatMicrocycleDateRange, formatWeekHeader } from '@/lib/dateUtils';

interface MicrocyclePreviewProps {
  plan: AIPlan;
  onApprove: () => void;
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
 * Microcycle preview component
 */
export function MicrocyclePreview({ plan, onApprove }: MicrocyclePreviewProps) {
  const { regenerateMicrocycle, generating } = useAICoachStore();
  const workouts = useWorkoutsStore(state => state.workouts);
  const { deleteWorkout } = useWorkoutsStore();
  
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);

  if (!plan.currentMicrocycle) return null;

  // Get workouts for this microcycle
  const microcycleWorkouts = workouts.filter(w => 
    plan.currentMicrocycle?.workoutIds.includes(w.id)
  );

  // Group by actual date (not dayOfWeek)
  const workoutsByDate = new Map<string, WorkoutDocument[]>();
  microcycleWorkouts.forEach(w => {
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

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    await regenerateMicrocycle(feedback);
    setFeedback('');
    setShowRegenerate(false);
  };

  const handleDeleteWorkout = async (workout: WorkoutDocument) => {
    await deleteWorkout(workout.id);
  };

  const editingWorkout = editingWorkoutId ? workouts.find(w => w.id === editingWorkoutId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Review Microcycle ({formatMicrocycleDateRange(plan.currentMicrocycle.dateRange.start, plan.currentMicrocycle.dateRange.end)})
          </h1>
          <p className="text-muted-foreground mt-1">
            {plan.currentMicrocycle.focus}
          </p>
        </div>
        <Badge variant="outline">Draft</Badge>
      </div>

      {/* Week Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-base">
            <Calendar className="h-4 w-4" />
            <span>
              {formatWeekHeader(
                plan.currentMicrocycle.week,
                plan.currentMicrocycle.dateRange,
                plan.currentMicrocycle.focus
              )}
            </span>
          </CardTitle>
          <CardDescription>{plan.currentMicrocycle.value}</CardDescription>
        </CardHeader>
      </Card>

      {/* Workouts Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Dumbbell className="h-5 w-5" />
            <span>Generated Workouts ({microcycleWorkouts.length})</span>
          </CardTitle>
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

      {/* Regenerate Section */}
      {showRegenerate && (
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="text-base">Provide Feedback for Regeneration</CardTitle>
            <CardDescription>
              Tell the AI what you'd like to change about these workouts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Add more upper body focus, Reduce workout duration, Add cardio sessions..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRegenerate(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRegenerate}
                disabled={!feedback.trim() || generating}
              >
                {generating ? 'Regenerating...' : 'Regenerate Workouts'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button 
          variant="outline" 
          onClick={() => setShowRegenerate(!showRegenerate)}
          disabled={generating}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {showRegenerate ? 'Cancel' : 'Regenerate'}
        </Button>
        <Button 
          onClick={onApprove}
          disabled={generating}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve & Start Microcycle
        </Button>
      </div>

      {/* Workout Editing Dialog */}
      {editingWorkout && (
        <WorkoutExecutionDialog
          workout={editingWorkout}
          isOpen={true}
          onClose={() => setEditingWorkoutId(null)}
          onComplete={() => setEditingWorkoutId(null)}
        />
      )}
    </div>
  );
}

