import { useAuthStore } from '@/stores/authStore';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';
import { useNavigate } from 'react-router-dom';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TestTube, RotateCcw, User, Calendar, History } from 'lucide-react';
import { addDays, getTodayISO } from '@/lib/dateUtils';
import { checkWeekCompletionState } from '@/lib/weekCompletionLogic';
import { getWorkoutHistory } from '@/lib/workoutHistoryService';
import { useState } from 'react';

/**
 * Testing page with development and testing utilities
 */
export function TestingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const { currentPlan, deletePlan, updatePlan } = useFitnessPlanStore();
  const [historyCount, setHistoryCount] = useState<number | null>(null);

  const handleResetOnboarding = async () => {
    if (!user) return;
    
    try {
      await updateProfile({
        onboardingCompleted: false,
        profile: undefined,
      });
      navigate('/onboarding');
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  };

  const handleClearProfile = async () => {
    if (!user) return;
    
    try {
      await updateProfile({
        profile: {},
      });
      alert('Profile data cleared!');
    } catch (error) {
      console.error('Failed to clear profile:', error);
    }
  };

  const handleTestRemoteConfig = async () => {
    try {
      console.log('Testing Firebase Remote Config...');
      
      // Force fetch and activate
      await fetchAndActivate(remoteConfig);
      
      // Test all parameters
      const apiKeyValue = getValue(remoteConfig, 'openai_api_key');
      const profileConfigValue = getValue(remoteConfig, 'profile_config');
      const promptsValue = getValue(remoteConfig, 'prompts_fitness_plan_generation');
      
      console.log('=== Remote Config Test Results ===');
      console.log('API Key Source:', apiKeyValue.getSource());
      console.log('API Key Available:', !!apiKeyValue.asString());
      console.log('API Key Length:', apiKeyValue.asString().length);
      
      console.log('Profile Config Source:', profileConfigValue.getSource());
      console.log('Profile Config Available:', !!profileConfigValue.asString());
      console.log('Profile Config Length:', profileConfigValue.asString().length);
      
      console.log('Prompts Source:', promptsValue.getSource());
      console.log('Prompts Available:', !!promptsValue.asString());
      console.log('Prompts Length:', promptsValue.asString().length);
      
      alert(`Remote Config Test Complete! Check console for details.\n\nAPI Key: ${apiKeyValue.getSource()}\nProfile Config: ${profileConfigValue.getSource()}\nPrompts: ${promptsValue.getSource()}`);
      
    } catch (error) {
      console.error('Remote Config test failed:', error);
      alert(`Remote Config test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleResetFitnessPlan = async () => {
    if (!user) return;
    
    try {
      await deletePlan();
      alert('Fitness plan deleted!');
      navigate('/app'); // Redirect to show the generation prompt
    } catch (error) {
      console.error('Failed to reset fitness plan:', error);
      alert('Failed to delete fitness plan');
    }
  };

  // Week Completion Button Testing Functions
  const setWeekDatesByEndOffset = async (endDaysOffset: number) => {
    if (!currentPlan) {
      alert('No fitness plan exists. Generate a plan first.');
      return;
    }

    const today = getTodayISO();
    const newEnd = addDays(today, endDaysOffset); // Offset for END date
    const newStart = addDays(newEnd, -6); // 7-day week (start is 6 days before end)

    const updatedPlan = {
      ...currentPlan,
      currentMicrocycle: {
        ...currentPlan.currentMicrocycle,
        dateRange: {
          start: newStart,
          end: newEnd
        }
      }
    };

    try {
      await updatePlan(updatedPlan);
      const state = checkWeekCompletionState(updatedPlan.currentMicrocycle);
      alert(`Week dates updated!\n\nToday: ${today}\nNew range: ${newStart} to ${newEnd}\nButton state: ${state.state}\n\n${state.message}`);
    } catch (error) {
      console.error('Failed to update dates:', error);
      alert('Failed to update dates');
    }
  };

  const handleSetDisabledState = () => setWeekDatesByEndOffset(3); // Week ends in 3 days (future)
  const handleSetReadyState = () => setWeekDatesByEndOffset(1); // Week ends TODAY
  const handleSetOverdueState = () => setWeekDatesByEndOffset(-4); // Week ended 4 days ago
  const handleSetLongGapState = () => setWeekDatesByEndOffset(-14); // Week ended 14 days ago

  // Workout History Testing
  const handleCheckWorkoutHistory = async () => {
    if (!user) {
      alert('No user logged in');
      return;
    }

    try {
      const history = await getWorkoutHistory(user.uid);
      setHistoryCount(history.length);
      
      const historyDetails = history.map(h => 
        `Week ${h.weekNumber} (${h.dateRange.start} to ${h.dateRange.end}): ${h.completedWorkouts.length} workouts`
      ).join('\n');
      
      alert(`Workout History Retrieved!\n\nTotal weeks: ${history.length}\n\n${historyDetails || 'No history found'}`);
      
      console.log('[Testing] Full workout history:', history);
    } catch (error) {
      console.error('Failed to retrieve workout history:', error);
      alert('Failed to retrieve workout history');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <TestTube className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Testing Mode</h1>
            <p className="text-muted-foreground">
              Development and testing utilities
            </p>
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Remote Config Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TestTube className="h-5 w-5" />
                <span>Remote Config</span>
              </CardTitle>
              <CardDescription>
                Test Firebase Remote Config connectivity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleTestRemoteConfig}
                variant="default"
                className="w-full"
              >
                Test Remote Config
              </Button>
              <p className="text-sm text-muted-foreground">
                This will test if all Firebase Remote Config parameters are accessible.
              </p>
            </CardContent>
          </Card>

          {/* Onboarding Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>Onboarding Controls</span>
              </CardTitle>
              <CardDescription>
                Reset or modify the onboarding process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleResetOnboarding}
                variant="destructive"
                className="w-full"
              >
                Reset Onboarding
              </Button>
              <p className="text-sm text-muted-foreground">
                This will mark onboarding as incomplete and redirect you to the onboarding flow.
              </p>
            </CardContent>
          </Card>

          {/* Fitness Plan Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TestTube className="h-5 w-5" />
                <span>Fitness Plan</span>
              </CardTitle>
              <CardDescription>
                Manage fitness plan data for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleResetFitnessPlan}
                variant="destructive"
                className="w-full"
                disabled={!currentPlan}
              >
                Reset Fitness Plan
              </Button>
              <p className="text-sm text-muted-foreground">
                {currentPlan 
                  ? `Current plan: ${currentPlan.name} (${currentPlan.status})`
                  : 'No fitness plan exists'
                }
              </p>
            </CardContent>
          </Card>

          {/* Profile Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Controls</span>
              </CardTitle>
              <CardDescription>
                Manage profile data for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleClearProfile}
                variant="outline"
                className="w-full"
              >
                Clear Profile Data
              </Button>
              <Button 
                onClick={() => navigate('/app/profile')}
                variant="default"
                className="w-full"
              >
                View Profile
              </Button>
              <p className="text-sm text-muted-foreground">
                Clear all profile answers or view the current profile data.
              </p>
            </CardContent>
          </Card>

          {/* Workout History Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>Workout History</span>
              </CardTitle>
              <CardDescription>
                Test workout history persistence and retrieval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleCheckWorkoutHistory}
                variant="default"
                className="w-full"
              >
                Check Workout History
              </Button>
              {historyCount !== null && (
                <div className="text-sm bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                  <p><strong>History Count:</strong> {historyCount} week(s)</p>
                  <p className="text-muted-foreground mt-1">
                    Complete a week to add to history. Check console for full details.
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                This will retrieve all saved workout history from Firebase. History is automatically saved when you complete a week.
              </p>
            </CardContent>
          </Card>

          {/* Week Completion Button Testing */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Week Completion Button States</span>
              </CardTitle>
              <CardDescription>
                Test different button states by adjusting the current week's date range
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Button 
                  onClick={handleSetDisabledState}
                  variant="outline"
                  className="w-full"
                  disabled={!currentPlan}
                >
                  🔒 Disabled State
                </Button>
                <Button 
                  onClick={handleSetReadyState}
                  variant="outline"
                  className="w-full bg-green-50 dark:bg-green-950 hover:bg-green-100"
                  disabled={!currentPlan}
                >
                  ✅ Ready State
                </Button>
                <Button 
                  onClick={handleSetOverdueState}
                  variant="outline"
                  className="w-full bg-orange-50 dark:bg-orange-950 hover:bg-orange-100"
                  disabled={!currentPlan}
                >
                  ⚠️ Overdue State
                </Button>
                <Button 
                  onClick={handleSetLongGapState}
                  variant="outline"
                  className="w-full bg-red-50 dark:bg-red-950 hover:bg-red-100"
                  disabled={!currentPlan}
                >
                  👋 Long Gap State
                </Button>
              </div>
              <div className="text-sm space-y-2 bg-muted p-4 rounded-md">
                <p><strong>Disabled:</strong> Week ends in 3 days (button gray, not clickable)</p>
                <p><strong>Ready:</strong> Week ends today (button green with pulse)</p>
                <p><strong>Overdue:</strong> Week ended 4 days ago (button orange warning)</p>
                <p><strong>Long Gap:</strong> Week ended 14 days ago (button hidden, triggers gap recovery)</p>
                <p className="text-muted-foreground italic mt-2">
                  After clicking, navigate to Fitness Plan page to see the button in action!
                </p>
              </div>
              <div className="text-sm bg-orange-50 dark:bg-orange-950 border border-orange-500 dark:border-orange-400 p-4 rounded-md">
                <p className="font-semibold text-orange-900 dark:text-orange-300">⚠️ Warning: Testing Buttons Override Dates</p>
                <p className="text-orange-800 dark:text-orange-400 mt-1">
                  These buttons will overwrite your current week's date range. Use ONLY for testing button states on the first week. 
                  Once you're progressing through weeks naturally (Week 2, 3, etc.), do NOT use these buttons as they will disrupt your progression.
                </p>
              </div>
              {currentPlan && currentPlan.currentMicrocycle.dateRange && (
                <div className="text-sm bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                  <p><strong>Current Week Range:</strong></p>
                  <p className="font-mono">{currentPlan.currentMicrocycle.dateRange.start} to {currentPlan.currentMicrocycle.dateRange.end}</p>
                  <p className="mt-2"><strong>Current Button State:</strong></p>
                  <p>{checkWeekCompletionState(currentPlan.currentMicrocycle).state} - {checkWeekCompletionState(currentPlan.currentMicrocycle).message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Current User Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current User Information</CardTitle>
            <CardDescription>
              Debug information about the current user state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">User ID:</span>
                  <p className="text-muted-foreground break-all">{user?.uid}</p>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
                <div>
                  <span className="font-medium">Display Name:</span>
                  <p className="text-muted-foreground">{user?.displayName || 'Not set'}</p>
                </div>
                <div>
                  <span className="font-medium">Onboarding Complete:</span>
                  <p className="text-muted-foreground">
                    {user?.onboardingCompleted ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Theme:</span>
                  <p className="text-muted-foreground">{user?.theme}</p>
                </div>
                <div>
                  <span className="font-medium">Profile Fields:</span>
                  <p className="text-muted-foreground">
                    {user?.profile ? Object.keys(user.profile).length : 0} fields
                  </p>
                </div>
                <div>
                  <span className="font-medium">Fitness Plan:</span>
                  <p className="text-muted-foreground">
                    {currentPlan ? `${currentPlan.status} - ${currentPlan.currentMicrocycle.workouts.length} workouts` : 'Not generated'}
                  </p>
                </div>
              </div>
              
              {user?.profile && Object.keys(user.profile).length > 0 && (
                <div className="mt-4">
                  <span className="font-medium">Profile Data:</span>
                  <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto">
                    {JSON.stringify(user.profile, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
