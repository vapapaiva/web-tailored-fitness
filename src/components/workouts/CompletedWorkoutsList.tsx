/**
 * Completed Workouts List - Shows list of completed workouts
 */

import { useState } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { WorkoutCardV2 } from './WorkoutCardV2';
import { WorkoutExecutionDialog } from './WorkoutExecutionDialog';

interface CompletedWorkoutsListProps {
  workouts: WorkoutDocument[];
}

/**
 * Completed workouts list component
 */
export function CompletedWorkoutsList({ workouts }: CompletedWorkoutsListProps) {
  const { markAsIncomplete } = useWorkoutsStore();
  const [executingWorkout, setExecutingWorkout] = useState<WorkoutDocument | null>(null);

  if (workouts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No completed workouts
      </div>
    );
  }

  const handleStartWorkout = (workout: WorkoutDocument) => {
    setExecutingWorkout(workout);
  };

  const handleResetWorkout = async (workout: WorkoutDocument) => {
    await markAsIncomplete(workout.id);
  };

  return (
    <>
      <div className="space-y-2">
        {workouts.map((workout) => (
          <WorkoutCardV2
            key={workout.id}
            workout={workout}
            onStart={handleStartWorkout}
            onReset={handleResetWorkout}
            isEditable={true}
            isDraggable={false}
            showSource={true}
          />
        ))}
      </div>

      {/* Workout Execution Dialog (for viewing) */}
      {executingWorkout && (
        <WorkoutExecutionDialog
          workout={executingWorkout}
          isOpen={!!executingWorkout}
          onClose={() => setExecutingWorkout(null)}
          onComplete={() => setExecutingWorkout(null)} // Already completed, just close
        />
      )}
    </>
  );
}

