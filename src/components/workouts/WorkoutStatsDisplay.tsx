/**
 * Workout Stats Display - Shows aggregated statistics for completed workouts
 * With charts and visualizations using Recharts
 */

import type { WorkoutStats } from '@/types/workout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, Activity, Clock, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface WorkoutStatsDisplayProps {
  stats: WorkoutStats;
}

// Color palette for charts
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a78bfa', '#fb923c', '#34d399'];

/**
 * Workout stats display component with charts
 */
export function WorkoutStatsDisplay({ stats }: WorkoutStatsDisplayProps) {
  // Prepare data for weekly breakdown chart
  const weeklyChartData = stats.weeklyBreakdown.slice(0, 12).reverse().map(week => ({
    week: new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    workouts: week.workoutsCompleted,
    completionRate: week.completionRate,
  }));

  // Prepare data for exercise type pie chart
  const exerciseTypePieData = Object.entries(stats.exerciseTypeBreakdown)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }))
    .sort((a, b) => b.value - a.value);

  // Prepare data for muscle group bar chart
  const muscleGroupBarData = Object.entries(stats.muscleGroupBreakdown)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      exercises: value
    }))
    .sort((a, b) => b.exercises - a.exercises)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Workouts</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.totalWorkouts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Exercises</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.totalExercises}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sets</span>
            </div>
            <div className="text-2xl font-bold mt-2">{stats.totalSets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Time</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {Math.round(stats.totalTime / 60)}
              <span className="text-sm font-normal text-muted-foreground ml-1">hrs</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {stats.totalWorkouts > 0 && (
        <>
          {/* Weekly Workout Trend */}
          {weeklyChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  <span>Weekly Workout Trend</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="workouts" 
                      stroke="#8884d8" 
                      name="Workouts Completed"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Exercise Types & Muscle Groups */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Exercise Type Pie Chart */}
            {exerciseTypePieData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <PieChart className="h-4 w-4" />
                    <span>Exercise Types</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={exerciseTypePieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {exerciseTypePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Muscle Group Bar Chart */}
            {muscleGroupBarData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <BarChart3 className="h-4 w-4" />
                    <span>Muscle Groups Trained</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={muscleGroupBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="exercises" fill="#82ca9d" name="Exercises" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Weekly Completion Rate */}
          {stats.weeklyBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  <span>Weekly Completion Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                      label={{ value: '%', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar 
                      dataKey="completionRate" 
                      fill="#34d399" 
                      name="Completion Rate"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

