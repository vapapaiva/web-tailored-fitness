/**
 * Workouts Page - Standalone workout tracking and planning
 * Main hub for all workout management independent of AI Coach
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlannedSection } from '@/components/workouts/PlannedSection';
import { DoneSection } from '@/components/workouts/DoneSection';
import { AddWorkoutDialog } from '@/components/workouts/AddWorkoutDialog';
import { WorkoutExecutionDialog } from '@/components/workouts/WorkoutExecutionDialog';
import { Loader2, AlertCircle, Dumbbell } from 'lucide-react';

/**
 * Workouts page component
 */
export function WorkoutsPage() {
  const navigate = useNavigate();
  const { 
    loadWorkouts, 
    startRealtimeSync, 
    stopRealtimeSync, 
    loading,
    error,
    clearError,
    workouts
  } = useWorkoutsStore();
  
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    // Load workouts and start real-time sync
    loadWorkouts();
    startRealtimeSync();
    
    // Cleanup on unmount
    return () => {
      stopRealtimeSync();
    };
  }, [loadWorkouts, startRealtimeSync, stopRealtimeSync]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your workouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Dumbbell className="h-8 w-8" />
              Workouts
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and plan your workouts
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Planned Section */}
          <PlannedSection onAddWorkout={() => setShowAddWorkout(true)} />

          {/* Done Section */}
          <DoneSection />
        </div>

        {/* Add Workout Dialog */}
        <AddWorkoutDialog
          isOpen={showAddWorkout}
          onClose={() => setShowAddWorkout(false)}
          onWorkoutCreated={(workoutId) => {
            setShowAddWorkout(false);
            // Wait a moment for real-time sync to update workouts array
            setTimeout(() => {
              setEditingWorkoutId(workoutId);
            }, 100);
          }}
        />
        
        {/* Workout Editing Dialog (opened after creation) */}
        {editingWorkoutId && (() => {
          const workout = workouts.find(w => w.id === editingWorkoutId);
          if (!workout) return null;
          
          return (
            <WorkoutExecutionDialog
              workout={workout}
              isOpen={true}
              onClose={() => setEditingWorkoutId(null)}
              onComplete={() => setEditingWorkoutId(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}
