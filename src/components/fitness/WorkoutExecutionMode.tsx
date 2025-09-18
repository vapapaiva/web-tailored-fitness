import { useState } from 'react';
import type { Workout, ExerciseSet } from '@/types/fitness';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  Clock, 
  Play,
  Pause,
  SkipForward 
} from 'lucide-react';

interface WorkoutExecutionModeProps {
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ExerciseProgress {
  exerciseId: string;
  completed: boolean;
  completedSets: boolean[];
  notes: string;
}

/**
 * Workout execution mode for checking off exercises and tracking progress
 */
export function WorkoutExecutionMode({ 
  workout, 
  isOpen, 
  onClose, 
  onComplete 
}: WorkoutExecutionModeProps) {
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>(
    workout.exercises.map(ex => ({
      exerciseId: ex.id,
      completed: false,
      completedSets: new Array(ex.sets.length).fill(false),
      notes: '',
    }))
  );
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime] = useState(0); // Timer functionality to be implemented

  const totalSets = workout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
  const completedSets = exerciseProgress.reduce(
    (total, progress) => total + progress.completedSets.filter(Boolean).length,
    0
  );
  const progressPercentage = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const toggleSet = (exerciseId: string, setIndex: number) => {
    setExerciseProgress(prev => prev.map(progress => {
      if (progress.exerciseId === exerciseId) {
        const newCompletedSets = [...progress.completedSets];
        newCompletedSets[setIndex] = !newCompletedSets[setIndex];
        
        // Auto-mark exercise as completed if all sets are done
        const allSetsCompleted = newCompletedSets.every(Boolean);
        
        return {
          ...progress,
          completedSets: newCompletedSets,
          completed: allSetsCompleted,
        };
      }
      return progress;
    }));
  };

  const toggleExercise = (exerciseId: string) => {
    setExerciseProgress(prev => prev.map(progress => {
      if (progress.exerciseId === exerciseId) {
        const newCompleted = !progress.completed;
        return {
          ...progress,
          completed: newCompleted,
          completedSets: new Array(progress.completedSets.length).fill(newCompleted),
        };
      }
      return progress;
    }));
  };

  const updateExerciseNotes = (exerciseId: string, notes: string) => {
    setExerciseProgress(prev => prev.map(progress => 
      progress.exerciseId === exerciseId ? { ...progress, notes } : progress
    ));
  };

  const handleCompleteWorkout = () => {
    // In real app, this would save progress to Firestore
    onComplete();
  };

  const formatSetDisplay = (set: ExerciseSet) => {
    if (set.duration) {
      const minutes = Math.floor(set.duration / 60);
      const seconds = set.duration % 60;
      return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
    } else if (set.notes && (set.notes.includes('km') || set.notes.includes('mi') || set.notes.includes('m'))) {
      return set.notes;
    } else if (set.weight) {
      return `${set.reps} × ${set.weight}kg`;
    } else {
      return `${set.reps} reps`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{workout.name}</h2>
              <p className="text-sm text-muted-foreground">
                {workout.focus} • {workout.estimatedDuration} min • {workout.exercises.length} exercises
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={isTimerRunning ? "destructive" : "default"}
                size="sm"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
              >
                {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Overview */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completedSets}/{totalSets} sets</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Exercise List */}
          <div className="space-y-4">
            {workout.exercises.map((exercise) => {
              const progress = exerciseProgress.find(p => p.exerciseId === exercise.id);
              if (!progress) return null;

              return (
                <Card key={exercise.id} className={progress.completed ? 'bg-green-50 dark:bg-green-950' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={progress.completed}
                          onCheckedChange={() => toggleExercise(exercise.id)}
                        />
                        <div>
                          <CardTitle className="text-base">{exercise.name}</CardTitle>
                          {exercise.instructions && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {exercise.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={progress.completed ? "default" : "secondary"}>
                        {progress.completedSets.filter(Boolean).length}/{exercise.sets.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Sets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {exercise.sets.map((set, setIndex) => (
                        <div
                          key={setIndex}
                          className={`flex items-center justify-between p-2 border rounded cursor-pointer transition-colors ${
                            progress.completedSets[setIndex] 
                              ? 'bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => toggleSet(exercise.id, setIndex)}
                        >
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={progress.completedSets[setIndex]}
                              onChange={() => toggleSet(exercise.id, setIndex)}
                            />
                            <span className="text-sm font-medium">Set {setIndex + 1}</span>
                          </div>
                          <span className="text-sm">{formatSetDisplay(set)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Exercise Notes */}
                    <div className="space-y-2">
                      <Label className="text-xs">Exercise Notes</Label>
                      <Textarea
                        value={progress.notes}
                        onChange={(e) => updateExerciseNotes(exercise.id, e.target.value)}
                        placeholder="How did it feel? Any modifications made?"
                        className="text-sm"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Workout Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workout Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder="Overall workout notes, how you felt, modifications made..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Save & Exit
            </Button>
            <div className="space-x-2">
              <Button 
                variant="outline"
                onClick={() => {
                  // Quick complete all
                  setExerciseProgress(prev => prev.map(p => ({
                    ...p,
                    completed: true,
                    completedSets: new Array(p.completedSets.length).fill(true),
                  })));
                }}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Complete All
              </Button>
              <Button 
                onClick={handleCompleteWorkout}
                disabled={completedSets === 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Finish Workout
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
