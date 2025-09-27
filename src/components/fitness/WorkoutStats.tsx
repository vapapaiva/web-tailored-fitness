/**
 * Enhanced workout statistics component showing actual vs planned progress
 * Replaces the basic stats in WeeklyScheduleV2 with comprehensive completion tracking
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

interface WorkoutStatsProps {
  workouts: Workout[];
  showDetailed?: boolean;
}

/**
 * Enhanced workout statistics component with actual vs planned tracking
 */
export function WorkoutStats({ workouts, showDetailed = false }: WorkoutStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate basic and detailed stats
  const basicStats = useMemo(() => calculateWorkoutStats(workouts), [workouts]);
  
  const detailedStats = useMemo(() => 
    showDetailed ? calculateDetailedWorkoutStats(workouts) : null, 
    [workouts, showDetailed]
  );

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <Dumbbell className="h-4 w-4 text-primary" />
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
      </div>


      {/* Detailed Stats (Expandable) */}
      {showDetailed && detailedStats && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              <TrendingUp className="h-4 w-4 mr-2" />
              Detailed Statistics
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Exercise Types Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Exercise Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(detailedStats.exerciseTypes).map(([category, stats]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{category}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">
                            {stats.completed}/{stats.planned}
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
                      <Progress value={stats.completionRate} className="h-1" />
                      
                      {/* Individual exercises in this category */}
                      <div className="ml-4 space-y-1">
                        {stats.exercises.map((exercise, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {exercise.name}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {exercise.setsCompleted}/{exercise.setsPlanned} sets
                              </span>
                              <span className="text-xs" style={getCompletionGradientStyle(exercise.completionRate)}>
                                {Math.round(exercise.completionRate)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Muscle Groups Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Muscle Groups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(detailedStats.muscleGroups).map(([muscleGroup, stats]) => (
                    <div key={muscleGroup} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{muscleGroup}</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-muted-foreground">
                            {stats.completed}/{stats.planned}
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
                      <Progress value={stats.completionRate} className="h-1" />
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
