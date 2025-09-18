import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Progress page - placeholder for future implementation
 */
export function ProgressPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
          <p className="text-muted-foreground">
            Track your fitness journey and achievements
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Progress tracking and analytics will be available here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p>Progress tracking will be implemented here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
