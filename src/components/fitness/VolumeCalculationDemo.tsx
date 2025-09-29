/**
 * Demo component to show how volume calculations work for different exercise types
 * This helps explain the difference between set counting vs volume calculation
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calculateExerciseVolume, formatVolume } from '@/lib/volumeCalculations';
import { findExerciseDefinition } from '@/lib/exerciseDatabase';
import type { Exercise } from '@/types/fitness';

export function VolumeCalculationDemo() {
  // Example exercises with different volume types
  const demoExercises: Exercise[] = [
    {
      id: 'pullups-demo',
      name: 'Pull-ups',
      category: 'Strength',
      muscleGroups: ['Back', 'Biceps'],
      equipment: ['Pull-up bar'],
      instructions: 'Bodyweight + weighted sets',
      sets: [
        // 5 bodyweight sets of 7 reps each
        { reps: 7, restTime: 90, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 7, restTime: 90, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 7, restTime: 90, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 7, restTime: 90, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 7, restTime: 90, notes: '', volumeType: 'sets-reps', completed: true },
        // 4 weighted sets of 5 reps with 40kg
        { reps: 5, weight: 40, weightUnit: 'kg', restTime: 90, notes: '', volumeType: 'sets-reps-weight', completed: true },
        { reps: 5, weight: 40, weightUnit: 'kg', restTime: 90, notes: '', volumeType: 'sets-reps-weight', completed: true },
        { reps: 5, weight: 40, weightUnit: 'kg', restTime: 90, notes: '', volumeType: 'sets-reps-weight', completed: true },
        { reps: 5, weight: 40, weightUnit: 'kg', restTime: 90, notes: '', volumeType: 'sets-reps-weight', completed: false }, // Last set incomplete
      ]
    },
    {
      id: 'pushups-demo',
      name: 'Push-ups',
      category: 'Strength',
      muscleGroups: ['Chest', 'Triceps'],
      equipment: ['Bodyweight'],
      instructions: 'Bodyweight only',
      sets: [
        { reps: 15, restTime: 60, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 12, restTime: 60, notes: '', volumeType: 'sets-reps', completed: true },
        { reps: 10, restTime: 60, notes: '', volumeType: 'sets-reps', completed: false },
      ]
    },
    {
      id: 'running-demo',
      name: 'Running',
      category: 'Cardio',
      muscleGroups: ['Legs'],
      equipment: ['None'],
      instructions: 'Distance-based cardio',
      sets: [
        { reps: 1, restTime: 0, notes: '5km', volumeType: 'distance', completed: true },
        { reps: 1, restTime: 0, notes: '3km', volumeType: 'distance', completed: false },
      ]
    },
    {
      id: 'plank-demo',
      name: 'Plank',
      category: 'Strength',
      muscleGroups: ['Core'],
      equipment: ['Bodyweight'],
      instructions: 'Duration-based exercise',
      sets: [
        { reps: 1, duration: 60, restTime: 30, notes: '', volumeType: 'duration', completed: true },
        { reps: 1, duration: 45, restTime: 30, notes: '', volumeType: 'duration', completed: true },
        { reps: 1, duration: 30, restTime: 30, notes: '', volumeType: 'duration', completed: false },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Volume Calculation Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            This shows how different exercise types are calculated for volume vs simple set counting.
          </div>
          
          <div className="space-y-6">
            {demoExercises.map(exercise => {
              const volumeMetrics = calculateExerciseVolume(exercise);
              const definition = findExerciseDefinition(exercise.name);
              
              return (
                <div key={exercise.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{exercise.name}</h3>
                      <div className="text-sm text-muted-foreground">
                        Category: {definition?.category || 'Unknown'} | 
                        Volume Type: {definition?.volumeCalculation || 'reps-only'}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {definition?.volumeCalculation || 'reps-only'}
                    </Badge>
                  </div>
                  
                  {/* Set Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Set Breakdown:</h4>
                      <div className="space-y-1 text-xs">
                        {exercise.sets.map((set, index) => (
                          <div key={index} className={`flex justify-between ${set.completed ? 'text-green-600' : 'text-muted-foreground'}`}>
                            <span>Set {index + 1}:</span>
                            <span>
                              {set.weight ? `${set.reps} × ${set.weight}${set.weightUnit}` : 
                               set.duration ? `${set.duration}s` :
                               set.notes ? set.notes :
                               `${set.reps} reps`}
                              {set.completed ? ' ✓' : ' ○'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-2">Volume Calculation:</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Simple Set Count:</span>
                          <span>{volumeMetrics.completedSets}/{volumeMetrics.totalSets} sets</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Actual Volume:</span>
                          <span>
                            {formatVolume(volumeMetrics.completedVolume, volumeMetrics.volumeUnit)} / 
                            {formatVolume(volumeMetrics.totalVolume, volumeMetrics.volumeUnit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Completion Rate:</span>
                          <span>{Math.round(volumeMetrics.completionRate)}%</span>
                        </div>
                        {volumeMetrics.totalReps && (
                          <div className="flex justify-between">
                            <span>Total Reps:</span>
                            <span>{volumeMetrics.completedReps}/{volumeMetrics.totalReps}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Explanation */}
                  <div className="bg-muted/50 p-3 rounded text-xs">
                    <strong>Why this matters:</strong> {getVolumeExplanation(exercise.name, volumeMetrics)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getVolumeExplanation(exerciseName: string, metrics: any): string {
  switch (exerciseName) {
    case 'Pull-ups':
      return `Simple set counting shows ${metrics.completedSets}/${metrics.totalSets} sets (${Math.round((metrics.completedSets/metrics.totalSets)*100)}%), but volume calculation shows ${Math.round(metrics.completionRate)}% because the weighted sets contribute much more training volume (40kg × 5 reps = 200 kg×reps per set vs 0kg × 7 reps = 7 reps per bodyweight set).`;
    
    case 'Push-ups':
      return `For bodyweight exercises, volume = total reps completed. Missing the last set of 10 reps significantly impacts volume (${metrics.completedReps}/${metrics.totalReps} reps = ${Math.round(metrics.completionRate)}%) vs set completion (${metrics.completedSets}/${metrics.totalSets} = ${Math.round((metrics.completedSets/metrics.totalSets)*100)}%).`;
    
    case 'Running':
      return `Distance-based exercises measure volume in km. Completing 5km but missing 3km = ${Math.round(metrics.completionRate)}% volume completion, which is more meaningful than just counting "runs completed".`;
    
    case 'Plank':
      return `Duration exercises measure volume in minutes. Total planned time was ${Math.round(metrics.totalDuration/60)} minutes, but only completed ${Math.round(metrics.completedDuration/60)} minutes = ${Math.round(metrics.completionRate)}% volume completion.`;
    
    default:
      return 'Volume calculation provides more meaningful progress tracking than simple set counting.';
  }
}
