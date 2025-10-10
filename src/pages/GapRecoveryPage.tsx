import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import type { UserProfile, ProfileFieldValue } from '@/types/profile';
import type { CompletedWorkout, Workout } from '@/types/fitness';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/forms/FormField';
import { CollapsibleChoiceField } from '@/components/forms/CollapsibleChoiceField';
import { GapWorkoutCard } from '@/components/fitness/GapWorkoutCard';
import { WorkoutExecutionMode } from '@/components/fitness/WorkoutExecutionMode';
import { 
  Loader2, 
  Sparkles, 
  Calendar, 
  User, 
  Dumbbell,
  Plus,
  FileText,
  AlertCircle,
  Save
} from 'lucide-react';
import { formatWeekHeader } from '@/lib/dateUtils';
import { parseGapWorkoutsText, formatDateForDisplay } from '@/lib/gapWorkoutParser';
import { getLastCompletedWeek } from '@/lib/workoutHistoryService';

/**
 * Full-page Gap Recovery experience for users returning after 7+ days
 */
export function GapRecoveryPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();
  const { currentPlan, generating, generateGapRecoveryPlan } = useFitnessPlanStore();
  const { config, loading: configLoading } = useProfileConfigStore();
  
  const [gapActivities, setGapActivities] = useState('');
  const [gapWorkouts, setGapWorkouts] = useState<CompletedWorkout[]>([]);
  const [profileData, setProfileData] = useState<UserProfile>(user?.profile || {});
  const [profileHasChanges, setProfileHasChanges] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Workout editing state
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [showWorkoutEditor, setShowWorkoutEditor] = useState(false);
  
  // Bulk text entry state
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  // Last active week from history (more accurate than current plan)
  const [lastActiveWeek, setLastActiveWeek] = useState<{
    week: number;
    focus: string;
    dateRange: { start: string; end: string };
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Initialize gap workouts from last microcycle
  useEffect(() => {
    if (currentPlan?.currentMicrocycle.completedWorkouts) {
      setGapWorkouts([...currentPlan.currentMicrocycle.completedWorkouts]);
    }
  }, [currentPlan]);

  // Update local profile when user profile changes
  useEffect(() => {
    if (user?.profile) {
      setProfileData(user.profile);
      setProfileHasChanges(false);
    }
  }, [user?.profile]);

  // Fetch last completed week from history (more accurate than current plan which may be modified by testing)
  useEffect(() => {
    const fetchLastActive = async () => {
      if (!user) return;

      setLoadingHistory(true);
      try {
        const lastWeek = await getLastCompletedWeek(user.uid);
        console.log('[Gap Recovery Page] Last completed week from history:', lastWeek);
        
        if (lastWeek) {
          setLastActiveWeek({
            week: lastWeek.weekNumber,
            focus: lastWeek.weekFocus,
            dateRange: lastWeek.dateRange
          });
        } else {
          // Fallback to current plan if no history
          console.log('[Gap Recovery Page] No history found, using current plan');
          if (currentPlan?.currentMicrocycle.dateRange) {
            setLastActiveWeek({
              week: currentPlan.currentMicrocycle.week,
              focus: currentPlan.currentMicrocycle.focus,
              dateRange: currentPlan.currentMicrocycle.dateRange
            });
          }
        }
      } catch (error) {
        console.error('[Gap Recovery] Failed to fetch last active week:', error);
        // Fallback to current plan
        if (currentPlan?.currentMicrocycle.dateRange) {
          setLastActiveWeek({
            week: currentPlan.currentMicrocycle.week,
            focus: currentPlan.currentMicrocycle.focus,
            dateRange: currentPlan.currentMicrocycle.dateRange
          });
        }
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchLastActive();
  }, [user, currentPlan]);

  if (!currentPlan || !currentPlan.currentMicrocycle.dateRange) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active plan found. Please generate a fitness plan first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading while fetching history
  if (loadingHistory || !lastActiveWeek) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your training history...</p>
        </div>
      </div>
    );
  }

  // Use last active week from history
  const activeWeek = lastActiveWeek;
  
  const weekEndDate = new Date(activeWeek.dateRange.end);
  const gapDays = Math.floor((new Date().getTime() - weekEndDate.getTime()) / (1000 * 60 * 60 * 24));
  const weekTitle = formatWeekHeader(activeWeek.week, activeWeek.dateRange, activeWeek.focus);
  const weekEndFormatted = formatDistanceToNow(weekEndDate, { addSuffix: true });

  const handleProfileFieldChange = (fieldId: string, value: ProfileFieldValue) => {
    setProfileData(prev => ({
      ...prev,
      [fieldId]: value
    }));
    setProfileHasChanges(true);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfile({ profile: profileData });
      setProfileHasChanges(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddSingleWorkout = () => {
    const newWorkout: Workout = {
      id: `gap_workout_${Date.now()}`,
      name: 'New Workout',
      type: 'strength',
      dayOfWeek: 1,
      date: new Date().toISOString().split('T')[0],
      estimatedDuration: 45,
      focus: '',
      value: '',
      exercises: [],
      status: 'planned'
    };
    setEditingWorkout(newWorkout);
    setShowWorkoutEditor(true);
  };

  const handleEditWorkout = (workout: CompletedWorkout) => {
    // Convert CompletedWorkout to Workout for editing
    const workoutForEditing: Workout = {
      id: workout.workoutId,
      name: workout.name,
      type: 'strength',
      dayOfWeek: 1,
      date: workout.date,
      estimatedDuration: workout.duration || 45,
      focus: '',
      value: '',
      exercises: workout.exercises.map(ex => ({
        id: ex.exerciseId,
        name: ex.name,
        category: 'compound',
        muscleGroups: [],
        equipment: [],
        instructions: ex.notes || '',
        sets: ex.sets.map(set => ({
          ...set,
          volumeType: set.distance ? 'distance-duration' : set.duration ? 'duration' : 'sets-reps-weight',
          restTime: 60
        }))
      })),
      status: 'completed'
    };
    setEditingWorkout(workoutForEditing);
    setShowWorkoutEditor(true);
  };

  const handleUpdateWorkout = (updatedWorkout: Workout) => {
    // Real-time update: Update the editing workout state (don't close dialog)
    setEditingWorkout(updatedWorkout);
  };

  const handleCloseEditor = () => {
    // Convert current editing workout to CompletedWorkout before closing
    if (!editingWorkout) {
      setShowWorkoutEditor(false);
      return;
    }

    const completedWorkout: CompletedWorkout = {
      workoutId: editingWorkout.id,
      name: editingWorkout.name,
      date: editingWorkout.date || new Date().toISOString().split('T')[0],
      exercises: editingWorkout.exercises.map(ex => ({
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.sets.map(set => ({
          ...set,
          completed: true // All gap workouts considered complete
        })),
        notes: ex.instructions
      })),
      duration: editingWorkout.estimatedDuration,
      completed: true,
      notes: 'Added during gap recovery'
    };

    setGapWorkouts(prev => {
      const existing = prev.findIndex(w => w.workoutId === completedWorkout.workoutId);
      if (existing >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existing] = completedWorkout;
        return updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        // Add new
        return [...prev, completedWorkout].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    });

    setShowWorkoutEditor(false);
    setEditingWorkout(null);
  };

  const handleDeleteWorkout = (workoutId: string) => {
    setGapWorkouts(prev => prev.filter(w => w.workoutId !== workoutId));
  };

  const handleBulkEntry = () => {
    if (!bulkText.trim()) return;

    try {
      const parsedWorkouts = parseGapWorkoutsText(bulkText);
      setGapWorkouts(prev => [...prev, ...parsedWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setBulkText('');
      setShowBulkEntry(false);
    } catch (error) {
      console.error('Failed to parse workouts:', error);
      alert('Failed to parse workouts. Please check the format and try again.');
    }
  };

  const handleGenerateFreshPlan = async () => {
    console.log('[Gap Recovery Page] ===== STARTING PLAN GENERATION =====');
    console.log('[Gap Recovery Page] Gap duration:', gapDays, 'days');
    console.log('[Gap Recovery Page] Gap activities:', gapActivities || '(none)');
    console.log('[Gap Recovery Page] Gap workouts count:', gapWorkouts.length);
    console.log('[Gap Recovery Page] Active week for context:', activeWeek);
    
    try {
      await generateGapRecoveryPlan({
        gapDurationDays: gapDays,
        gapActivities: gapActivities || undefined,
        gapWorkouts: gapWorkouts,
        lastCompletedMicrocycle: {
          week: activeWeek.week,
          dateRange: activeWeek.dateRange,
          completedWorkouts: currentPlan.currentMicrocycle.completedWorkouts || []
        }
      });

      console.log('[Gap Recovery Page] ===== PLAN GENERATED SUCCESSFULLY =====');
      console.log('[Gap Recovery Page] Waiting for Firebase sync...');
      
      // Wait a moment for Firebase to persist the new plan
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[Gap Recovery Page] Navigating to /app/fitness-plan...');
      
      // Navigate to fitness plan page
      navigate('/app/fitness-plan', { replace: true });
    } catch (error) {
      console.error('[Gap Recovery Page] ===== GENERATION FAILED =====');
      console.error('[Gap Recovery Page] Error:', error);
      alert(`Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome Back! 👋</h1>
          <p className="text-lg text-muted-foreground">
            Last active: <strong>{weekTitle}</strong> ended {weekEndFormatted} ({gapDays} days ago)
          </p>
          <p className="text-muted-foreground mt-2">
            Ready to get back on track with a fresh fitness plan?
          </p>
        </div>

        <div className="space-y-6">
          {/* Gap Activities Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>What were you up to during this break?</span>
              </CardTitle>
              <CardDescription>
                This helps us tailor your return plan (optional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Traveling, sick, vacation, busy with work, injury recovery..."
                value={gapActivities}
                onChange={(e) => setGapActivities(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Workouts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Dumbbell className="h-5 w-5" />
                <span>Workouts we should know about</span>
              </CardTitle>
              <CardDescription>
                Add any workouts you did during the gap period
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Workouts Grid */}
              {gapWorkouts.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {gapWorkouts.map((workout) => (
                    <GapWorkoutCard
                      key={workout.workoutId}
                      workout={workout}
                      onEdit={handleEditWorkout}
                      onDelete={handleDeleteWorkout}
                    />
                  ))}
                </div>
              )}

              {/* Add Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleAddSingleWorkout} variant="outline" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Workout
                </Button>
                <Button onClick={() => setShowBulkEntry(true)} variant="outline" className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Multiple (Text)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Profile Review & Edit Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Review your profile</span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Make sure your fitness information is up to date
                  </CardDescription>
                </div>
                {profileHasChanges && (
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm">
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading profile configuration...
                </div>
              ) : !config ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load profile configuration.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {config.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="space-y-4">
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {section.fields.map((field) => (
                          <div key={field.id} className={field.type === 'multipleChoice' ? 'md:col-span-2' : ''}>
                            {field.type === 'singleChoice' || field.type === 'multipleChoice' ? (
                              <CollapsibleChoiceField
                                field={field}
                                value={profileData[field.id]}
                                onChange={(value) => handleProfileFieldChange(field.id, value)}
                              />
                            ) : (
                              <FormField
                                field={field}
                                value={profileData[field.id]}
                                onChange={(value) => handleProfileFieldChange(field.id, value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <div className="sticky bottom-6 z-10">
            <Button
              onClick={handleGenerateFreshPlan}
              disabled={generating || profileHasChanges}
              className="w-full h-14 text-lg shadow-lg"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating your return-to-training plan...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Fresh Plan 🚀
                </>
              )}
            </Button>
            {profileHasChanges && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                Please save your profile changes before generating a plan
              </p>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground pb-8">
            Your new plan will start from Week 1 with a fresh approach tailored to your return.
          </p>
        </div>
      </div>

      {/* Workout Editor Modal */}
      {editingWorkout && (
        <WorkoutExecutionMode
          workout={editingWorkout}
          isOpen={showWorkoutEditor}
          onClose={handleCloseEditor}
          onComplete={() => {}}
          onWorkoutUpdate={handleUpdateWorkout}
          onWorkoutDelete={(id) => {
            handleDeleteWorkout(id);
            setShowWorkoutEditor(false);
            setEditingWorkout(null);
          }}
          isGapRecovery={true}
        />
      )}

      {/* Bulk Text Entry Dialog */}
      <Dialog open={showBulkEntry} onOpenChange={setShowBulkEntry}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Multiple Workouts (Text Format)</DialogTitle>
            <DialogDescription>
              Enter workouts using the format below. Each workout starts with # followed by name and date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm bg-muted p-4 rounded-md space-y-2">
              <p className="font-semibold">Format:</p>
              <pre className="text-xs">
{`# Workout Name dd-mm-yyyy
-- Exercise 1
3 x 10 x 50kg
-- Exercise 2
2.5km

# Another Workout dd-mm-yyyy
-- Exercise 3
4 x 8 x 60kg`}
              </pre>
              <p className="text-muted-foreground text-xs">
                Date formats supported: dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy
              </p>
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Enter workouts here..."
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBulkEntry(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkEntry} disabled={!bulkText.trim()}>
                Add Workouts
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
