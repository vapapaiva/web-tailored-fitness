/**
 * Goals Generation Flow - Multi-step wizard for generating fitness goals
 * Phase 1 of AI Coach setup
 */

import { useState, useEffect } from 'react';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useAuthStore } from '@/stores/authStore';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FitnessGoalsInput } from './FitnessGoalsInput';
import { GoalsReview } from './GoalsReview';
import { PromptEditor } from './PromptEditor';
import { Sparkles, Target, AlertCircle, Loader2, Settings } from 'lucide-react';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';
import type { CustomPromptConfig } from '@/types/profile';

type Step = 'welcome' | 'input' | 'generating' | 'review';

/**
 * Goals generation flow component
 */
export function GoalsGenerationFlow() {
  const { user } = useAuthStore();
  const { fetchConfig } = useProfileConfigStore();
  const { 
    currentPlan, 
    generating, 
    error, 
    loading,
    customGoalsPrompt,
    generateGoals, 
    saveCustomGoalsPrompt,
    resetGoalsPromptToDefault,
    loadCustomPrompts,
    clearError 
  } = useAICoachStore();
  
  const [step, setStep] = useState<Step>('welcome');
  const [fitnessGoalInput, setFitnessGoalInput] = useState(user?.profile?.goals || '');
  const [customInput, setCustomInput] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState<CustomPromptConfig | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPromptConfig | null>(null);
  
  // Fetch profile config and prompts on mount
  useEffect(() => {
    fetchConfig();
    loadCustomPrompts();
    loadDefaultPrompt();
  }, [fetchConfig, loadCustomPrompts]);

  const loadDefaultPrompt = async () => {
    try {
      await fetchAndActivate(remoteConfig);
      const promptValue = getValue(remoteConfig, 'prompts_ai_coach_goals_generation');
      const promptString = promptValue.asString();
      
      if (promptString) {
        const promptConfig = JSON.parse(promptString);
        setDefaultPrompt({
          systemPrompt: promptConfig.system_prompt,
          userPromptTemplate: promptConfig.user_prompt_template
        });
      }
    } catch (error) {
      console.error('Failed to load default prompt:', error);
    }
  };

  const handleStartAICoach = () => {
    // Initialize editing prompt with custom or default
    setEditingPrompt(customGoalsPrompt || defaultPrompt);
    setStep('input');
  };

  const handlePromptSaved = async (prompt: CustomPromptConfig) => {
    await saveCustomGoalsPrompt(prompt);
    setEditingPrompt(prompt);
  };

  const handlePromptReset = async () => {
    await resetGoalsPromptToDefault();
    setEditingPrompt(defaultPrompt);
  };

  const handleGenerateGoals = async () => {
    if (!user?.profile) {
      alert('Please complete your profile first');
      return;
    }

    setStep('generating');
    
    // Use editing prompt if available
    await generateGoals({
      userProfile: user.profile,
      fitnessGoalInput,
      customInput,
      currentDate: new Date().toISOString(),
    }, editingPrompt || undefined);
    
    // Check if generation succeeded
    const { error: genError } = useAICoachStore.getState();
    if (!genError) {
      setStep('review');
    } else {
      setStep('input'); // Go back to input on error
    }
  };

  const handleBack = () => {
    if (step === 'input') setStep('welcome');
    if (step === 'review') setStep('input');
  };

  // Welcome Step
  if (step === 'welcome') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">AI Fitness Coach</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get a personalized 6-month fitness plan with AI-generated goals and weekly workouts tailored to your needs.
            </p>
          </div>

          {/* Features Card */}
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                <Target className="h-5 w-5 text-primary" />
                <span>What You'll Get</span>
              </CardTitle>
              <CardDescription>
                Two-phase AI planning: Goals first, then workouts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Features Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Phase 1: Fitness Goals</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 6-month macrocycle goal</li>
                    <li>• 4-6 mesocycle milestones</li>
                    <li>• Measurable success indicators</li>
                    <li>• Approve or regenerate</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Phase 2: Weekly Workouts</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI-generated workouts</li>
                    <li>• Integrated with Workouts page</li>
                    <li>• Weekly progression</li>
                    <li>• Edit anytime</li>
                  </ul>
                </div>
              </div>

              {/* Start Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={handleStartAICoach}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start AI Coach
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Input Step (now includes prompt editing)
  if (step === 'input') {
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

    const placeholders = [
      { placeholder: 'USER_PROFILE', description: 'Complete user profile data', example: 'JSON object with all profile fields' },
      { placeholder: 'FITNESS_GOAL_INPUT', description: 'User\'s selected fitness goal', example: 'Build muscle, Lose weight, etc.' },
      { placeholder: 'CUSTOM_INPUT', description: 'User\'s detailed custom description', example: 'Free-form text with details' },
      { placeholder: 'CURRENT_DATE', description: 'Current date (ISO format)', example: '2025-01-15T10:30:00.000Z' }
    ];

    const populatedData = user?.profile ? {
      USER_PROFILE: JSON.stringify(user.profile, null, 2),
      FITNESS_GOAL_INPUT: fitnessGoalInput || 'Not set',
      CUSTOM_INPUT: customInput || 'Not set',
      CURRENT_DATE: new Date().toISOString()
    } : undefined;
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Define Your Fitness Goals</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Describe your goals and customize how AI generates your plan
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

          {/* Goals Input */}
          <FitnessGoalsInput
            fitnessGoalInput={fitnessGoalInput}
            customInput={customInput}
            onFitnessGoalChange={setFitnessGoalInput}
            onCustomInputChange={setCustomInput}
            onBack={handleBack}
            onNext={handleGenerateGoals}
            isGenerating={generating}
          />

          {/* Prompt Editor (collapsible/advanced section) */}
          <PromptEditor
            title="Advanced: Customize AI Prompt"
            description="Customize the prompt used to generate your goals (optional)"
            initialPrompt={editingPrompt}
            availablePlaceholders={placeholders}
            populatedData={populatedData}
            onSave={handlePromptSaved}
            onReset={handlePromptReset}
            loading={loading}
          />
        </div>
      </div>
    );
  }

  // Generating Step
  if (step === 'generating') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold">Generating Your Fitness Goals</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  AI is analyzing your profile and creating personalized goals...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review Step
  if (step === 'review' && currentPlan) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <GoalsReview
          plan={currentPlan}
          onBack={handleBack}
        />
      </div>
    );
  }

  return null;
}

