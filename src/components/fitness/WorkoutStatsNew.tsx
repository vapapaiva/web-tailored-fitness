/**
 * Enhanced workout statistics component showing actual vs planned progress
 * Focuses on volume tracking with improved calculations
 */

import React, { useState, useMemo } from 'react';
import type { Workout } from '@/types/fitness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, 
  Dumbbell, 
  Target, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  Activity
} from 'lucide-react';
import { 
  calculateWorkoutStats, 
  calculateDetailedWorkoutStats,
  formatDuration,
  getCompletionColor,
  getCompletionBadgeVariant,
  getCompletionGradientStyle,
  getCompletionBadgeStyle
} from '@/lib/workoutStats';
import { formatImprovedVolume } from '@/lib/improvedVolumeCalculations';

interface WorkoutStatsProps {
  workouts: Workout[];
  showDetailed?: boolean;
  userBodyweight?: number;
}

/**
 * Enhanced workout statistics component with volume tracking
 */
export function WorkoutStats({ workouts, showDetailed = false, userBodyweight = 75 }: WorkoutStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate basic and detailed stats
  const basicStats = useMemo(() => calculateWorkoutStats(workouts), [workouts]);
  
  const detailedStats = useMemo(() => 
    calculateDetailedWorkoutStats(workouts, userBodyweight), 
    [workouts, userBodyweight]
  );

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Workouts */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Workouts</span>
                </div>
                <Badge 
                  variant={basicStats.workouts.completionRate === 0 ? "secondary" : undefined}
                  style={getCompletionBadgeStyle(basicStats.workouts.completionRate)}
                >
                  {Math.round(basicStats.workouts.completionRate)}%
                </Badge>
              </div>
              <Progress value={basicStats.workouts.completionRate} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {basicStats.workouts.completed} of {basicStats.workouts.planned} completed
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercises */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Exercises</span>
                </div>
                <Badge 
                  variant={basicStats.exercises.completionRate === 0 ? "secondary" : undefined}
                  style={getCompletionBadgeStyle(basicStats.exercises.completionRate)}
                >
                  {Math.round(basicStats.exercises.completionRate)}%
                </Badge>
              </div>
              <Progress value={basicStats.exercises.completionRate} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {basicStats.exercises.completed} of {basicStats.exercises.planned} completed
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sets */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Sets</span>
                </div>
                <Badge 
                  variant={basicStats.sets.completionRate === 0 ? "secondary" : undefined}
                  style={getCompletionBadgeStyle(basicStats.sets.completionRate)}
                >
                  {Math.round(basicStats.sets.completionRate)}%
                </Badge>
              </div>
              <Progress value={basicStats.sets.completionRate} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {basicStats.sets.completed} of {basicStats.sets.planned} completed
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duration */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Duration</span>
                </div>
                <Badge 
                  variant={basicStats.duration.completionRate === 0 ? "secondary" : undefined}
                  style={getCompletionBadgeStyle(basicStats.duration.completionRate)}
                >
                  {Math.round(basicStats.duration.completionRate)}%
                </Badge>
              </div>
              <Progress value={basicStats.duration.completionRate} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {formatDuration(basicStats.duration.actual)} of {formatDuration(basicStats.duration.planned)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Volume</span>
                </div>
                <Badge 
                  variant={detailedStats.totalVolumeStats.totalVolume === 0 ? "secondary" : undefined}
                  style={getCompletionBadgeStyle(detailedStats.totalVolumeStats.completionRate)}
                >
                  {Math.round(detailedStats.totalVolumeStats.completionRate)}%
                </Badge>
              </div>
              <Progress 
                value={detailedStats.totalVolumeStats.completionRate} 
                className="h-2" 
              />
              <div className="text-xs text-muted-foreground">
                {formatImprovedVolume(detailedStats.totalVolumeStats.completedVolume, 'relative units')} / {formatImprovedVolume(detailedStats.totalVolumeStats.totalVolume, 'relative units')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats (Expandable) */}
      {showDetailed && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              Detailed Statistics
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Exercise Volume Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Exercise Volume Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(detailedStats.exerciseVolumeStats).map(([exerciseName, stats]) => (
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
                          <div className="font-medium">{stats.volumeMetrics.completedSets}/{stats.volumeMetrics.totalSets}</div>
                        </div>
                        {stats.volumeMetrics.totalReps && (
                          <div>
                            <div className="text-xs text-muted-foreground">Total Reps</div>
                            <div className="font-medium">{stats.volumeMetrics.completedReps}/{stats.volumeMetrics.totalReps}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Intensity</div>
                          <div className="font-medium">{Math.round(stats.volumeMetrics.averageIntensity || 0)} units/rep</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Max Intensity</div>
                          <div className="font-medium">{Math.round(stats.volumeMetrics.maxIntensity || 0)} units/rep</div>
                        </div>
                      </div>
                      
                      {/* Daily Volume Breakdown */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Daily Volume:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(stats.dailyVolume).map(([date, dailyStats]) => (
                            <div key={date} className="flex justify-between items-center text-xs p-2 bg-muted/20 rounded">
                              <span>{date}</span>
                              <span>
                                {formatImprovedVolume(dailyStats.completed, stats.volumeUnit)} / {formatImprovedVolume(dailyStats.planned, stats.volumeUnit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

/**
 * Compact version of workout stats for smaller spaces
 */
export function CompactWorkoutStats({ workouts }: { workouts: Workout[] }) {
  const stats = useMemo(() => calculateWorkoutStats(workouts), [workouts]);

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-center">
        <div className="text-sm font-bold">{stats.workouts.completed}/{stats.workouts.planned}</div>
        <div className="text-xs text-muted-foreground">Workouts</div>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{stats.exercises.completed}/{stats.exercises.planned}</div>
        <div className="text-xs text-muted-foreground">Exercises</div>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{stats.sets.completed}/{stats.sets.planned}</div>
        <div className="text-xs text-muted-foreground">Sets</div>
      </div>
    </div>
  );
}
