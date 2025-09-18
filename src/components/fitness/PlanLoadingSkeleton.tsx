import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for fitness plan generation
 * Shows the structure of macro -> meso -> micro -> workouts -> exercises
 */
export function PlanLoadingSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Plan Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span>Generating Your Fitness Plan...</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Macrocycle Skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-80" />
            </div>
            
            {/* Mesocycles Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <div className="space-y-1">
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Week Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>This Week's Workouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-7">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <Card key={day} className={`border-dashed ${index % 2 === 0 ? 'bg-muted/20' : ''}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-medium text-center">{day}</div>
                  {index % 2 === 0 ? (
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-3/4 mx-auto" />
                      <div className="space-y-1">
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-2 w-5/6" />
                        <Skeleton className="h-2 w-4/5" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Skeleton className="h-3 w-12 mx-auto" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workout Details Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Exercise List */}
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                  <div className="flex space-x-4">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Generation Progress */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Creating your personalized plan...</p>
              <p className="text-xs text-muted-foreground">
                This may take 30-60 seconds as we analyze your profile and generate detailed workouts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
