/**
 * Volume Statistics Display - Shows volume-based progress tracking
 * Uses improved volume calculations for completed workouts
 */

import { useMemo } from 'react';
import type { WorkoutDocument } from '@/types/workout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';
import { calculateImprovedExerciseVolume, formatImprovedVolume } from '@/lib/improvedVolumeCalculations';
import { useAuthStore } from '@/stores/authStore';

interface VolumeStatsDisplayProps {
  completedWorkouts: WorkoutDocument[];
}

interface ExerciseVolumeStats {
  totalVolume: number;
  completedVolume: number;
  volumeUnit: string;
  completionRate: number;
  totalSets: number;
  completedSets: number;
  totalReps?: number;
  completedReps?: number;
  averageIntensity: number;
  maxIntensity: number;
}

/**
 * Calculate volume statistics for all completed workouts
 */
function calculateVolumeStats(
  completedWorkouts: WorkoutDocument[],
  userBodyweight: number
): Record<string, ExerciseVolumeStats> {
  const exerciseStats: Record<string, ExerciseVolumeStats> = {};

  completedWorkouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      const volumeMetrics = calculateImprovedExerciseVolume(exercise, userBodyweight);
      
      if (!exerciseStats[exercise.name]) {
        exerciseStats[exercise.name] = {
          totalVolume: 0,
          completedVolume: 0,
          volumeUnit: volumeMetrics.volumeUnit,
          completionRate: 0,
          totalSets: 0,
          completedSets: 0,
          totalReps: 0,
          completedReps: 0,
          averageIntensity: 0,
          maxIntensity: 0
        };
      }

      const stats = exerciseStats[exercise.name];
      stats.totalVolume += volumeMetrics.totalRelativeVolume;
      stats.completedVolume += volumeMetrics.completedRelativeVolume;
      stats.totalSets += volumeMetrics.totalSets;
      stats.completedSets += volumeMetrics.completedSets;
      
      if (volumeMetrics.totalReps !== undefined) {
        stats.totalReps = (stats.totalReps || 0) + volumeMetrics.totalReps;
      }
      if (volumeMetrics.completedReps !== undefined) {
        stats.completedReps = (stats.completedReps || 0) + volumeMetrics.completedReps;
      }
      
      stats.averageIntensity = Math.max(stats.averageIntensity, volumeMetrics.averageIntensity || 0);
      stats.maxIntensity = Math.max(stats.maxIntensity, volumeMetrics.maxIntensity || 0);
    });
  });

  // Calculate completion rates
  Object.values(exerciseStats).forEach(stats => {
    stats.completionRate = stats.totalVolume > 0 
      ? (stats.completedVolume / stats.totalVolume) * 100 
      : 0;
  });

  return exerciseStats;
}

/**
 * Get badge style based on completion rate
 */
function getCompletionBadgeStyle(completionRate: number): React.CSSProperties {
  const rate = Math.max(0, Math.min(100, completionRate));
  
  if (rate === 0) return {};
  
  let hue: number;
  const saturation = 80;
  const backgroundLightness = 75;
  const textLightness = 20;
  const borderLightness = 50;
  
  if (rate <= 50) {
    hue = 60; // Yellow
  } else {
    const progress = (rate - 50) / 50;
    hue = 60 + (progress * 60); // 60° to 120° (yellow to green)
  }
  
  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${backgroundLightness}%)`,
    color: `hsl(${hue}, ${Math.min(saturation + 10, 90)}%, ${textLightness}%)`,
    border: `1px solid hsl(${hue}, ${saturation}%, ${borderLightness}%)`,
    fontWeight: '600'
  };
}

/**
 * Volume statistics display component
 */
export function VolumeStatsDisplay({ completedWorkouts }: VolumeStatsDisplayProps) {
  const { user } = useAuthStore();
  const userBodyweight = (user?.profile?.bodyweight as number) || 75;

  const exerciseVolumeStats = useMemo(
    () => calculateVolumeStats(completedWorkouts, userBodyweight),
    [completedWorkouts, userBodyweight]
  );

  const sortedExercises = useMemo(
    () => Object.entries(exerciseVolumeStats)
      .sort(([, a], [, b]) => b.completedVolume - a.completedVolume)
      .slice(0, 10), // Top 10 exercises by volume
    [exerciseVolumeStats]
  );

  if (sortedExercises.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Volume Progress by Exercise
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedExercises.map(([exerciseName, stats]) => (
            <div key={exerciseName} className="space-y-3 p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-base">{exerciseName}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {formatImprovedVolume(stats.completedVolume, stats.volumeUnit)} / {formatImprovedVolume(stats.totalVolume, stats.volumeUnit)}
                  </span>
                  <Badge 
                    size="sm"
                    variant={stats.completionRate === 0 ? "secondary" : undefined}
                    style={getCompletionBadgeStyle(stats.completionRate)}
                  >
                    {Math.round(stats.completionRate)}%
                  </Badge>
                </div>
              </div>
              <Progress value={stats.completionRate} className="h-2" />
              
              {/* Volume Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Total Sets</div>
                  <div className="font-medium">{stats.completedSets}/{stats.totalSets}</div>
                </div>
                {stats.totalReps && stats.totalReps > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Total Reps</div>
                    <div className="font-medium">{stats.completedReps}/{stats.totalReps}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Avg Intensity</div>
                  <div className="font-medium">{Math.round(stats.averageIntensity)} units/rep</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max Intensity</div>
                  <div className="font-medium">{Math.round(stats.maxIntensity)} units/rep</div>
                </div>
              </div>
              
              {/* Volume-based progress explanation */}
              <div className="text-xs text-muted-foreground/70 italic mt-2">
                Progress based on training volume - weighted sets contribute more than bodyweight sets
              </div>
            </div>
          ))}
          
          {Object.keys(exerciseVolumeStats).length > 10 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Showing top 10 exercises by volume. {Object.keys(exerciseVolumeStats).length - 10} more tracked.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

