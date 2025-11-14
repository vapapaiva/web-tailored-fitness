/**
 * Workout Suggestions Dialog - Shows AI-suggested workouts for user to accept
 * Part of the flexible "coach suggests" system
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Plus, Trash2, Calendar, Clock, Dumbbell, Sparkles, Info } from 'lucide-react';
import type { MicrocycleSuggestion, WorkoutSuggestion } from '@/types/aiCoach';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface WorkoutSuggestionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => Promise<void>; // Called when user clicks Done (clears suggestions)
  suggestion: MicrocycleSuggestion;
  onAcceptWorkout: (index: number) => Promise<void>;
  onAcceptAll: () => Promise<void>;
  onRegenerate: (feedback: string) => Promise<void>;
  accepting?: boolean;
}

/**
 * Dialog showing AI's workout suggestions
 */
export function WorkoutSuggestionsDialog({
  isOpen,
  onClose,
  onDone,
  suggestion,
  onAcceptWorkout,
  onAcceptAll,
  onRegenerate,
  accepting = false
}: WorkoutSuggestionsDialogProps) {
  const [addedIndexes, setAddedIndexes] = useState<Set<number>>(new Set());
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setAddedIndexes(new Set());
      setShowRegenerateInput(false);
      setFeedback('');
    }
  }, [isOpen]);

  const handleAddWorkout = async (index: number) => {
    try {
      await onAcceptWorkout(index);
      setAddedIndexes(prev => new Set(prev).add(index));
    } catch (error) {
      console.error('Failed to add workout:', error);
    }
  };

  const handleAddAll = async () => {
    try {
      await onAcceptAll();
      const allIndexes = suggestion.suggestedWorkouts.map((_, i) => i);
      setAddedIndexes(new Set(allIndexes));
    } catch (error) {
      console.error('Failed to add all workouts:', error);
    }
  };

  const handleRemove = async (index: number) => {
    // TODO: Implement remove functionality
    setAddedIndexes(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(feedback);
      setShowRegenerateInput(false);
      setFeedback('');
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setRegenerating(false);
    }
  };

  // Group workouts by date
  const workoutsByDate = suggestion.suggestedWorkouts.reduce((acc, workout, index) => {
    const date = workout.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push({ workout, index });
    return acc;
  }, {} as Record<string, Array<{ workout: WorkoutSuggestion; index: number }>>);

  const sortedDates = Object.keys(workoutsByDate).sort();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>AI Coach Workout Suggestions</span>
          </DialogTitle>
          <DialogDescription>
            Your AI coach has analyzed your plan and goals
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI Assessment */}
          {suggestion.assessment && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">AI Assessment:</div>
                <div className="text-sm">{suggestion.assessment}</div>
              </AlertDescription>
            </Alert>
          )}

          {/* No workouts needed case */}
          {suggestion.suggestedWorkouts.length === 0 && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                  <h3 className="text-lg font-medium">Your Plan Looks Good!</h3>
                  <p className="text-sm text-muted-foreground">
                    No additional workouts needed at this time. Keep up the great work!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Suggested workouts */}
          {suggestion.suggestedWorkouts.length > 0 && (
            <>
              {/* Actions Bar */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {suggestion.suggestedWorkouts.length} workout{suggestion.suggestedWorkouts.length !== 1 ? 's' : ''} suggested
                </div>
                <div className="flex space-x-2">
                  {!showRegenerateInput && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRegenerateInput(true)}
                      >
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddAll}
                        disabled={accepting || addedIndexes.size === suggestion.suggestedWorkouts.length}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add All to Plan
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Regenerate Input */}
              {showRegenerateInput && (
                <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
                  <CardHeader>
                    <CardTitle className="text-base">Provide Feedback for Regeneration</CardTitle>
                    <CardDescription>
                      Tell the AI what you'd like to change about these suggestions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="feedback">Your Feedback (optional)</Label>
                      <Textarea
                        id="feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="E.g., 'I want more upper body focus' or 'Make the workouts shorter'"
                        rows={3}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                      >
                        {regenerating ? 'Regenerating...' : 'Regenerate'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowRegenerateInput(false)}
                        disabled={regenerating}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Workouts Grouped by Date */}
              <div className="space-y-4">
                {sortedDates.map(date => (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm font-medium">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                    
                    {workoutsByDate[date].map(({ workout, index }) => (
                      <Card key={index} className={addedIndexes.has(index) ? 'border-green-500/50 bg-green-500/5' : ''}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base flex items-center space-x-2">
                                <Dumbbell className="h-4 w-4" />
                                <span>{workout.name}</span>
                              </CardTitle>
                              <CardDescription className="flex items-center space-x-4 mt-1">
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {workout.estimatedDuration}min
                                </span>
                                <Badge variant="secondary">{workout.type}</Badge>
                                <Badge variant="outline">{workout.exercises.length} exercises</Badge>
                              </CardDescription>
                            </div>
                            
                            <div>
                              {addedIndexes.has(index) ? (
                                <div className="flex items-center space-x-2">
                                  <Badge variant="default" className="bg-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Added
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleAddWorkout(index)}
                                  disabled={accepting}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add to Plan
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        {/* Workout Details */}
                        <CardContent>
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium">Focus:</p>
                              <p className="text-sm text-muted-foreground">{workout.focus}</p>
                            </div>
                            {workout.value && (
                              <div>
                                <p className="text-sm font-medium">Description:</p>
                                <p className="text-sm text-muted-foreground">{workout.value}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">Exercises:</p>
                              <ul className="text-sm text-muted-foreground ml-4 list-disc">
                                {workout.exercises.slice(0, 5).map((ex, i) => (
                                  <li key={i}>{ex.name}</li>
                                ))}
                                {workout.exercises.length > 5 && (
                                  <li className="text-muted-foreground/70">
                                    +{workout.exercises.length - 5} more...
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Done Button */}
          <div className="flex justify-end">
            <Button onClick={async () => {
              await onDone(); // Clear suggestions from AI plan
              onClose(); // Close dialog
            }}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


