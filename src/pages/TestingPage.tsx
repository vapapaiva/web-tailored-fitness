import { useAuthStore } from '@/stores/authStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { useNavigate } from 'react-router-dom';
import { fetchAndActivate, getValue } from 'firebase/remote-config';
import { remoteConfig, db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TestTube, RotateCcw, User, Brain, Trash2 } from 'lucide-react';

/**
 * Testing page with development and testing utilities
 */
export function TestingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const { currentPlan: aiPlan, loadPlan: loadAIPlan } = useAICoachStore();
  const workoutsStore = useWorkoutsStore();

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

          {/* AI Coach Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>AI Coach Controls</span>
              </CardTitle>
              <CardDescription>
                Manage AI Coach data for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button 
                  onClick={async () => {
                    if (!user) return;
                    try {
                      // Smart deletion: Handle workouts first
                      let deletedCount = 0;
                      let preservedCount = 0;
                      
                      if (aiPlan?.currentMicrocycle) {
                        const microcycleWorkouts = workoutsStore.workouts.filter(w => 
                          aiPlan.currentMicrocycle?.workoutIds.includes(w.id)
                        );
                        
                        for (const workout of microcycleWorkouts) {
                          // Check if user has made any progress
                          const hasProgress = 
                            workout.exercises.some(ex => ex.sets.some(set => set.completed === true)) ||
                            workout.hasManualChanges === true ||
                            workout.status === 'completed';
                          
                          if (hasProgress) {
                            // PRESERVE: Detach from microcycle but keep the workout
                            await workoutsStore.updateWorkout(workout.id, {
                              aiCoachContext: undefined // Remove microcycle association
                            });
                            preservedCount++;
                          } else {
                            // DELETE: User hasn't touched this workout
                            await workoutsStore.deleteWorkout(workout.id);
                            deletedCount++;
                          }
                        }
                      }
                      
                      // Delete the AI plan document
                      const planRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
                      await deleteDoc(planRef);
                      await loadAIPlan();
                      
                      alert(
                        `AI Coach plan deleted!\n\n` +
                        `✅ Deleted: ${deletedCount} untouched workout(s)\n` +
                        `💪 Preserved: ${preservedCount} workout(s) with progress (now deletable manually)`
                      );
                    } catch (error) {
                      console.error('Failed to delete AI plan:', error);
                      alert('Failed to delete AI plan');
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                  disabled={!aiPlan}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Entire AI Plan
                </Button>
                
                <Button 
                  onClick={async () => {
                    if (!user || !aiPlan?.currentMicrocycle) return;
                    try {
                      // Smart deletion: Only delete workouts with no progress
                      const microcycleWorkouts = workoutsStore.workouts.filter(w => 
                        aiPlan.currentMicrocycle?.workoutIds.includes(w.id)
                      );
                      
                      let deletedCount = 0;
                      let preservedCount = 0;
                      
                      for (const workout of microcycleWorkouts) {
                        // Check if user has made any progress (same logic as regenerateMicrocycle)
                        const hasProgress = 
                          workout.exercises.some(ex => ex.sets.some(set => set.completed === true)) ||
                          workout.hasManualChanges === true ||
                          workout.status === 'completed';
                        
                        if (hasProgress) {
                          // PRESERVE: Detach from microcycle but keep the workout
                          await workoutsStore.updateWorkout(workout.id, {
                            aiCoachContext: undefined // Remove microcycle association
                          });
                          preservedCount++;
                        } else {
                          // DELETE: User hasn't touched this workout
                          await workoutsStore.deleteWorkout(workout.id);
                          deletedCount++;
                        }
                      }
                      
                      // Clear microcycle reference
                      const planRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
                      await updateDoc(planRef, {
                        currentMicrocycle: null,
                        status: 'goals-approved',
                        updatedAt: serverTimestamp()
                      });
                      await loadAIPlan();
                      
                      alert(
                        `AI Coach microcycle cleared!\n\n` +
                        `✅ Deleted: ${deletedCount} untouched workout(s)\n` +
                        `💪 Preserved: ${preservedCount} workout(s) with progress (now deletable)\n` +
                        `Goals preserved.`
                      );
                    } catch (error) {
                      console.error('Failed to clear microcycle:', error);
                      alert('Failed to clear microcycle');
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  disabled={!aiPlan?.currentMicrocycle}
                >
                  Clear Microcycle Only
                </Button>
                
                <Button 
                  onClick={async () => {
                    if (!user) return;
                    try {
                      // Smart cleanup: Delete AI workouts without progress, detach those with progress
                      const aiWorkouts = workoutsStore.workouts.filter(w => w.source === 'ai-coach');
                      
                      let deletedCount = 0;
                      let preservedCount = 0;
                      let alreadyDetachedCount = 0;
                      
                      for (const workout of aiWorkouts) {
                        // Check if user has made any progress
                        const hasProgress = 
                          workout.exercises.some(ex => ex.sets.some(set => set.completed === true)) ||
                          workout.hasManualChanges === true ||
                          workout.status === 'completed';
                        
                        if (hasProgress) {
                          // Check if already detached
                          if (!workout.aiCoachContext) {
                            alreadyDetachedCount++;
                          } else {
                            // PRESERVE: Detach from microcycle but keep the workout
                            await workoutsStore.updateWorkout(workout.id, {
                              aiCoachContext: undefined
                            });
                            preservedCount++;
                          }
                        } else {
                          // DELETE: User hasn't touched this workout
                          await workoutsStore.deleteWorkout(workout.id);
                          deletedCount++;
                        }
                      }
                      
                      alert(
                        `Smart AI Workouts Cleanup Complete!\n\n` +
                        `✅ Deleted: ${deletedCount} untouched workout(s)\n` +
                        `💪 Detached: ${preservedCount} workout(s) with progress\n` +
                        `ℹ️ Already detached: ${alreadyDetachedCount} workout(s)`
                      );
                    } catch (error) {
                      console.error('Failed to cleanup AI workouts:', error);
                      alert('Failed to cleanup AI workouts');
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Smart Cleanup AI Workouts
                </Button>
                
                <Button 
                  onClick={async () => {
                    if (!user) return;
                    if (!confirm('This will DELETE ALL AI workouts, even those with progress. Are you sure?')) return;
                    try {
                      // Delete all AI-generated workouts (keep manual ones)
                      const aiWorkouts = workoutsStore.workouts.filter(w => w.source === 'ai-coach');
                      for (const workout of aiWorkouts) {
                        await workoutsStore.deleteWorkout(workout.id);
                      }
                      alert(`Deleted ${aiWorkouts.length} AI-generated workouts!`);
                    } catch (error) {
                      console.error('Failed to delete AI workouts:', error);
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  Force Delete ALL AI Workouts
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {aiPlan 
                  ? `AI Plan Status: ${aiPlan.status}, Week: ${aiPlan.currentMicrocycle?.week || 'N/A'}`
                  : 'No AI plan exists'
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
