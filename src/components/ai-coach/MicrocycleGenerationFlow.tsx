/**
 * Microcycle Generation Flow - Generate workout suggestions (not auto-added)
 * Phase 2 of AI Coach - Flexible "coach suggests" system
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { WorkoutSuggestionsDialog } from './WorkoutSuggestionsDialog';
import { PromptEditor } from './PromptEditor';
import { Sparkles, AlertCircle, Loader2, Target, Info } from 'lucide-react';
import { calculateInitialWeekRange } from '@/lib/dateUtils';
import type { MicrocycleGenerationRequest } from '@/types/aiCoach';
import type { CustomPromptConfig } from '@/types/profile';
import { doc, getDoc } from 'firebase/firestore';
import { db, remoteConfig } from '@/lib/firebase';
import { getValue, fetchAndActivate } from 'firebase/remote-config';

interface MicrocycleGenerationFlowProps {
  weekNumber?: number; // Optional week number (for regeneration from dashboard)
  onClose?: () => void; // Optional close handler (when opened from dashboard)
}

/**
 * Microcycle generation flow component
 */
export function MicrocycleGenerationFlow({ weekNumber, onClose }: MicrocycleGenerationFlowProps = {}) {
  const { user } = useAuthStore();
  const { 
    currentPlan, 
    generating, 
    error, 
    loading,
    customMicrocyclePrompt,
    generateMicrocycle,
    acceptSuggestedWorkouts,
    saveCustomMicrocyclePrompt,
    resetMicrocyclePromptToDefault,
    clearError 
  } = useAICoachStore();
  
  const workoutsStore = useWorkoutsStore();
  
  const [customFeedback, setCustomFeedback] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState<CustomPromptConfig | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPromptConfig | null>(null);
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false);

  // Load default prompt
  useEffect(() => {
    const loadDefaultPrompt = async () => {
      try {
        await fetchAndActivate(remoteConfig);
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_workout_generation');
        const promptString = promptValue.asString();
        
        if (promptString) {
          const promptConfig = JSON.parse(promptString);
          const prompt = {
            systemPrompt: promptConfig.system_prompt,
            userPromptTemplate: promptConfig.user_prompt_template
          };
          setDefaultPrompt(prompt);
          setEditingPrompt(customMicrocyclePrompt || prompt);
        }
      } catch (error) {
        console.error('Failed to load default prompt:', error);
      }
    };
    loadDefaultPrompt();
  }, [customMicrocyclePrompt]);

  // Show suggestions dialog when generation completes
  useEffect(() => {
    if (currentPlan?.currentSuggestion && !generating) {
      setShowSuggestionsDialog(true);
    }
  }, [currentPlan?.currentSuggestion, generating]);

  const handleGenerate = async () => {
    if (!user || !currentPlan) return;

    // Get user profile
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const userProfile = userData.profile || {};

    // Calculate week date range
    const weekDateRange = calculateInitialWeekRange(new Date());

    const request: MicrocycleGenerationRequest = {
      userProfile,
      macrocycleGoal: currentPlan.macrocycleGoal,
      mesocycleMilestones: currentPlan.mesocycleMilestones,
      currentDate: new Date().toISOString(),
      weekNumber: weekNumber || 1,
      weekDateRange,
      customFeedback: customFeedback || undefined,
    };

    await generateMicrocycle(request);
  };

  const handlePromptSaved = async (prompt: CustomPromptConfig) => {
    await saveCustomMicrocyclePrompt(prompt);
    setEditingPrompt(prompt);
  };

  const handlePromptReset = async () => {
    await resetMicrocyclePromptToDefault();
    setEditingPrompt(defaultPrompt);
  };

  const handleAcceptWorkout = async (index: number) => {
    await acceptSuggestedWorkouts([index]);
  };

  const handleAcceptAll = async () => {
    if (!currentPlan?.currentSuggestion) return;
    const allIndexes = currentPlan.currentSuggestion.suggestedWorkouts.map((_, i) => i);
    await acceptSuggestedWorkouts(allIndexes);
  };

  const handleRegenerate = async (feedback: string) => {
    setCustomFeedback(feedback);
    setShowSuggestionsDialog(false);
    await handleGenerate();
  };

  const handleCloseSuggestions = () => {
    setShowSuggestionsDialog(false);
    if (onClose) onClose();
  };

  if (!editingPrompt || !defaultPrompt) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading configuration...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get planned workouts for context
  const weekDateRange = calculateInitialWeekRange(new Date());
  const plannedWorkouts = workoutsStore.workouts.filter(w => {
    if (!w.date || w.status === 'completed') return false;
    const workoutDate = new Date(w.date);
    const startDate = new Date(weekDateRange.start);
    const endDate = new Date(weekDateRange.end);
    return workoutDate >= startDate && workoutDate <= endDate;
  });

  const placeholders = [
    { placeholder: 'USER_PROFILE', description: 'Complete user profile data' },
    { placeholder: 'MACROCYCLE', description: 'Your 6-month macrocycle goal' },
    { placeholder: 'MESOCYCLE', description: 'Current mesocycle phase' },
    { placeholder: 'CURRENT_DATE', description: 'Current date (ISO format)' },
    { placeholder: 'NEXT_WEEK_NUMBER', description: 'Week number in plan' },
    { placeholder: 'WEEK_DATE_RANGE', description: 'Date range for the microcycle' },
    { placeholder: 'PLANNED_WORKOUTS', description: 'Already planned workouts for this period' },
    { placeholder: 'CUSTOM_PROMPT', description: 'Your custom feedback/instructions' },
  ];

  const populatedData = user?.profile && currentPlan ? {
    USER_PROFILE: JSON.stringify(user.profile, null, 2),
    MACROCYCLE: currentPlan.macrocycleGoal.name,
    MESOCYCLE: currentPlan.mesocycleMilestones[0]?.name || 'N/A',
    CURRENT_DATE: new Date().toISOString(),
    NEXT_WEEK_NUMBER: String(weekNumber || 1),
    WEEK_DATE_RANGE: `${weekDateRange.start} to ${weekDateRange.end}`,
    PLANNED_WORKOUTS: plannedWorkouts.length > 0
      ? plannedWorkouts.map(w => `${w.name} (${w.date})`).join(', ')
      : 'None',
    CUSTOM_PROMPT: customFeedback || 'Not provided'
  } : undefined;

    return (
    <>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Get Weekly Workout Suggestions</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              AI Coach will analyze your goals and current plan to suggest workouts
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={clearError}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Goals Summary (Read-only) */}
          {currentPlan && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Your Goals</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Macrocycle Goal:</p>
                  <p className="text-sm text-muted-foreground">{currentPlan.macrocycleGoal.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Current Phase:</p>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan.mesocycleMilestones[0]?.name || 'N/A'} - {currentPlan.mesocycleMilestones[0]?.focus || 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Planned Workouts Info */}
          {plannedWorkouts.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You already have {plannedWorkouts.length} workout{plannedWorkouts.length !== 1 ? 's' : ''} planned for this period. 
                AI will consider these when making suggestions.
              </AlertDescription>
            </Alert>
          )}

          {/* Custom Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Instructions (Optional)</CardTitle>
              <CardDescription>
                Any specific requests or preferences for this week's workouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g., 'Focus on upper body this week', 'I have limited time, shorter workouts please', 'Include more core work'..."
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Prompt Editor */}
          <PromptEditor
            title="Microcycle Generation Prompt"
            description="Customize how AI generates workout suggestions for you"
            initialPrompt={editingPrompt}
            availablePlaceholders={placeholders}
            populatedData={populatedData}
            onSave={handlePromptSaved}
            onReset={handlePromptReset}
            loading={loading}
          />

          {/* Generate Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={handleGenerate}
                  size="lg"
                  disabled={generating}
                >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Suggestions...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Workout Suggestions
                </>
              )}
            </Button>
          </div>

          {onClose && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={onClose}>
                Cancel
                </Button>
              </div>
          )}
        </div>
      </div>

      {/* Suggestions Dialog */}
      {currentPlan?.currentSuggestion && (
        <WorkoutSuggestionsDialog
          isOpen={showSuggestionsDialog}
          onClose={handleCloseSuggestions}
          suggestion={currentPlan.currentSuggestion}
          onAcceptWorkout={handleAcceptWorkout}
          onAcceptAll={handleAcceptAll}
          onRegenerate={handleRegenerate}
          accepting={false}
        />
      )}
    </>
    );
  }
