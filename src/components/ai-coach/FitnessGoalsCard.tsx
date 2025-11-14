/**
 * Fitness Goals Card - Displays macrocycle and mesocycles with editing capability
 */

import { useState, useEffect } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import type { CustomPromptConfig } from '@/types/profile';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GoalsEditor } from './GoalsEditor';
import { PromptEditor } from './PromptEditor';
import { Target, Calendar, ChevronDown, ChevronUp, Edit, Info, X, RotateCcw, Loader2 } from 'lucide-react';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';

interface FitnessGoalsCardProps {
  plan: AIPlan;
}

/**
 * Fitness goals card component
 */
export function FitnessGoalsCard({ plan }: FitnessGoalsCardProps) {
  const { user } = useAuthStore();
  const { 
    generateGoals,
    generating,
    loading,
    customGoalsPrompt,
    saveCustomGoalsPrompt,
    resetGoalsPromptToDefault
  } = useAICoachStore();
  const [showEditor, setShowEditor] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRegenerateGoalsDialog, setShowRegenerateGoalsDialog] = useState(false);
  const [goalsFeedback, setGoalsFeedback] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState<CustomPromptConfig | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPromptConfig | null>(null);
  
  // Load default prompt
  useEffect(() => {
    const loadDefaultPrompt = async () => {
      try {
        await fetchAndActivate(remoteConfig);
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_goals_generation');
        const promptString = promptValue.asString();
        
        if (promptString) {
          const promptConfig = JSON.parse(promptString);
          const prompt = {
            systemPrompt: promptConfig.system_prompt,
            userPromptTemplate: promptConfig.user_prompt_template
          };
          setDefaultPrompt(prompt);
          setEditingPrompt(customGoalsPrompt || prompt);
        }
      } catch (error) {
        console.error('Failed to load default prompt:', error);
      }
    };
    loadDefaultPrompt();
  }, [customGoalsPrompt]);

  if (showEditor) {
    return (
      <GoalsEditor
        plan={plan}
        onSave={() => setShowEditor(false)}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Goals Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Your Fitness Goals</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowRegenerateGoalsDialog(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Regenerate Goals
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowEditor(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Macrocycle Goal */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{plan.macrocycleGoal.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {plan.macrocycleGoal.durationWeeks} weeks
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="space-y-3">
                <p className="text-sm">{plan.macrocycleGoal.value}</p>
                
                {plan.macrocycleGoal.promisedOutcome && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Expected Outcome:</p>
                    <p className="text-sm">{plan.macrocycleGoal.promisedOutcome}</p>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Mesocycle Milestones */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">Training Phases</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {plan.mesocycleMilestones.map((meso, index) => (
                <Card key={meso.id} className="border-dashed">
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">Phase {index + 1}</Badge>
                      <h5 className="font-medium text-sm">{meso.name}</h5>
                      <p className="text-xs text-muted-foreground">
                        {meso.durationWeeks} weeks • {meso.focus}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Goals Dialog */}
      <Dialog open={showRegenerateGoalsDialog} onOpenChange={setShowRegenerateGoalsDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RotateCcw className="h-5 w-5" />
              <span>Regenerate Fitness Goals</span>
            </DialogTitle>
            <DialogDescription>
              Provide feedback and customize the prompt to regenerate your goals
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Previous Goals Context */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your current goals will be used as context. Add feedback below to guide changes.
              </AlertDescription>
            </Alert>

            {/* Feedback Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Feedback</CardTitle>
                <CardDescription>
                  Describe what you want to change (optional but recommended)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="e.g., 'Focus more on strength', 'Shorter timeline', 'Add mobility work'..."
                  value={goalsFeedback}
                  onChange={(e) => setGoalsFeedback(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Prompt Editor */}
            {editingPrompt && defaultPrompt && (
              <PromptEditor
                title="Goals Regeneration Prompt"
                description="Customize the prompt used to regenerate your goals"
                initialPrompt={editingPrompt}
                availablePlaceholders={[
                  { placeholder: 'USER_PROFILE', description: 'Complete user profile data' },
                  { placeholder: 'FITNESS_GOAL_INPUT', description: 'User\'s fitness goal from profile' },
                  { placeholder: 'CUSTOM_INPUT', description: 'Feedback + context about previous goals' },
                  { placeholder: 'CURRENT_DATE', description: 'Current date (ISO format)' }
                ]}
                populatedData={user?.profile ? {
                  USER_PROFILE: JSON.stringify(user.profile, null, 2),
                  FITNESS_GOAL_INPUT: String(user.profile.goals || 'Not set'),
                  CUSTOM_INPUT: `Previous Goals:\nMacro: ${plan.macrocycleGoal.name}\nMesocycles: ${plan.mesocycleMilestones.map(m => m.name).join(', ')}\n\nFeedback: ${goalsFeedback || 'Not provided'}`,
                  CURRENT_DATE: new Date().toISOString()
                } : undefined}
                onSave={async (prompt) => {
                  await saveCustomGoalsPrompt(prompt);
                  setEditingPrompt(prompt);
                }}
                onReset={async () => {
                  await resetGoalsPromptToDefault();
                  setEditingPrompt(defaultPrompt);
                }}
                loading={loading}
              />
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRegenerateGoalsDialog(false);
                  setGoalsFeedback('');
                }}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  if (!user?.profile) return;
                  
                  // Build customInput with previous goals context + feedback
                  const previousGoalsContext = `Current Goals:\nMacrocycle: ${plan.macrocycleGoal.name} - ${plan.macrocycleGoal.value}\nMesocycles: ${plan.mesocycleMilestones.map(m => `${m.name} (${m.focus})`).join(', ')}`;
                  const feedbackSection = goalsFeedback.trim() ? `\n\nUser Feedback: ${goalsFeedback}` : '';
                  const customInput = previousGoalsContext + feedbackSection + '\n\nPlease regenerate goals taking the above context and feedback into account.';
                  
                  const request = {
                    userProfile: user.profile,
                    fitnessGoalInput: String(user.profile.goals || ''),
                    customInput,
                    currentDate: new Date().toISOString(),
                  };
                  
                  await generateGoals(request, editingPrompt || undefined);
                  setShowRegenerateGoalsDialog(false);
                  setGoalsFeedback('');
                }}
                disabled={generating}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate Goals
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

