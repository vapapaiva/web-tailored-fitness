/**
 * Without Date Workouts - Shows workouts without assigned dates
 * These can serve as workout templates or library
 */

import { useState } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import { WorkoutCardV2 } from './WorkoutCardV2';
import { WorkoutExecutionDialog } from './WorkoutExecutionDialog';

interface WithoutDateWorkoutsProps {
  workouts: WorkoutDocument[];
}

/**
 * Without date workouts component
 */
export function WithoutDateWorkouts({ workouts }: WithoutDateWorkoutsProps) {
  const [executingWorkout, setExecutingWorkout] = useState<WorkoutDocument | null>(null);

  if (workouts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No workouts without dates
      </div>
    );
  }

  const handleStartWorkout = (workout: WorkoutDocument) => {
    setExecutingWorkout(workout);
  };

  // Without date workouts can be edited but not marked as complete without a date
  const handleCompleteWorkout = async (workout: WorkoutDocument) => {
    // TODO: Prompt user to assign a date first
    console.log('Cannot complete workout without date. Assign a date first.');
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
            isEditable={true}
            isDraggable={true}
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

