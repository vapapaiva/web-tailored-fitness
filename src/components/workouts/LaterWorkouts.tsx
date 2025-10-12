/**
 * Later Workouts - Shows workouts scheduled beyond the current week
 */

import { useState } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { WorkoutCardV2 } from './WorkoutCardV2';
import { WorkoutExecutionDialog } from './WorkoutExecutionDialog';

interface LaterWorkoutsProps {
  workouts: WorkoutDocument[];
}

/**
 * Later workouts component
 */
export function LaterWorkouts({ workouts }: LaterWorkoutsProps) {
  const { markAsComplete } = useWorkoutsStore();
  const [executingWorkout, setExecutingWorkout] = useState<WorkoutDocument | null>(null);

  if (workouts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No future workouts scheduled
      </div>
    );
  }

  const handleStartWorkout = (workout: WorkoutDocument) => {
    setExecutingWorkout(workout);
  };

  const handleCompleteWorkout = async (workout: WorkoutDocument) => {
    await markAsComplete(workout.id);
    setExecutingWorkout(null);
  };

  return (
    <>
      <div className="space-y-2">
        {workouts.map((workout) => (
          <WorkoutCardV2
            key={workout.id}
            workout={workout}
            onStart={handleStartWorkout}
            onComplete={handleCompleteWorkout}
            isEditable={true}
            isDraggable={false}
            showSource={true}
          />
        ))}
      </div>

      {/* Workout Execution Dialog */}
      {executingWorkout && (
        <WorkoutExecutionDialog
          workout={executingWorkout}
          isOpen={!!executingWorkout}
          onClose={() => setExecutingWorkout(null)}
          onComplete={handleCompleteWorkout}
        />
      )}
    </>
  );
}

