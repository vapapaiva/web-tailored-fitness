/**
 * Goals Review - Review and approve/edit/regenerate generated goals
 * Step 4 of goals generation flow - with direct text editing
 */

import { useState, useEffect } from 'react';
import type { AIPlan, MacrocycleGoal, MesocycleMilestone } from '@/types/aiCoach';
import type { CustomPromptConfig } from '@/types/profile';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  RotateCcw, 
  ArrowLeft,
  AlertCircle,
  Info,
  Loader2
} from 'lucide-react';
import { PromptEditor } from './PromptEditor';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { remoteConfig } from '@/lib/firebase';

interface GoalsReviewProps {
  plan: AIPlan;
  onBack: () => void;
}

/**
 * Parse text format into structured goals
 */
function parseGoalsText(text: string): { macrocycle: MacrocycleGoal; mesocycles: MesocycleMilestone[] } | null {
  try {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let macrocycle: MacrocycleGoal | null = null;
    const mesocycles: MesocycleMilestone[] = [];
    
    let currentSection: 'macro' | 'meso' | null = null;
    let currentMeso: Partial<MesocycleMilestone> | null = null;
    let mesoIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Section headers
      if (line === 'MACRO GOAL:') {
        currentSection = 'macro';
        macrocycle = {
          name: '',
          value: '',
          promisedOutcome: '',
          durationWeeks: 24,
          startDate: '',
          endDate: ''
        };
        continue;
      }
      
      if (line === 'MESOCYCLES:') {
        currentSection = 'meso';
        continue;
      }
      
      // Check for new mesocycle
      const phaseMatch = line.match(/^Phase \d+:$/);
      if (phaseMatch && currentSection === 'meso') {
        // Save previous mesocycle if exists
        if (currentMeso && currentMeso.name) {
          mesocycles.push({
            id: `meso_${Date.now()}_${mesoIndex}`,
            name: currentMeso.name || '',
            value: currentMeso.value || '',
            focus: currentMeso.focus || '',
            durationWeeks: currentMeso.durationWeeks || 4,
            startDate: currentMeso.startDate || '',
            endDate: currentMeso.endDate || ''
          });
          mesoIndex++;
        }
        // Start new mesocycle
        currentMeso = {};
        continue;
      }
      
      // Parse field values
      if (currentSection === 'macro' && macrocycle) {
        if (line.startsWith('Name:')) {
          macrocycle.name = line.substring(5).trim();
        } else if (line.startsWith('Description:')) {
          macrocycle.value = line.substring(12).trim();
        } else if (line.startsWith('Duration:')) {
          const weeks = parseInt(line.substring(9).trim());
          if (!isNaN(weeks)) macrocycle.durationWeeks = weeks;
        }
      } else if (currentSection === 'meso' && currentMeso) {
        if (line.startsWith('Name:')) {
          currentMeso.name = line.substring(5).trim();
        } else if (line.startsWith('Focus:')) {
          currentMeso.focus = line.substring(6).trim();
        } else if (line.startsWith('Duration:')) {
          const weeks = parseInt(line.substring(9).trim());
          if (!isNaN(weeks)) currentMeso.durationWeeks = weeks;
        } else if (line.startsWith('Description:')) {
          currentMeso.value = line.substring(12).trim();
        }
      }
    }
    
    // Save last mesocycle
    if (currentMeso && currentMeso.name) {
      mesocycles.push({
        id: `meso_${Date.now()}_${mesoIndex}`,
        name: currentMeso.name || '',
        value: currentMeso.value || '',
        focus: currentMeso.focus || '',
        durationWeeks: currentMeso.durationWeeks || 4,
        startDate: currentMeso.startDate || '',
        endDate: currentMeso.endDate || ''
      });
    }
    
    if (!macrocycle || mesocycles.length === 0) {
      return null;
    }
    
    return { macrocycle, mesocycles };
  } catch (error) {
    console.error('Failed to parse goals text:', error);
    return null;
  }
}

/**
 * Convert structured goals to text format
 */
function goalsToText(macrocycle: MacrocycleGoal, mesocycles: MesocycleMilestone[]): string {
  let text = 'MACRO GOAL:\n';
  text += `Name: ${macrocycle.name}\n`;
  text += `Description: ${macrocycle.value}\n`;
  text += `Duration: ${macrocycle.durationWeeks}\n`;
  text += '\n';
  text += 'MESOCYCLES:\n\n';
  
  mesocycles.forEach((meso, index) => {
    text += `Phase ${index + 1}:\n`;
    text += `Name: ${meso.name}\n`;
    text += `Focus: ${meso.focus}\n`;
    text += `Duration: ${meso.durationWeeks}\n`;
    text += `Description: ${meso.value}\n`;
    if (index < mesocycles.length - 1) {
      text += '\n';
    }
  });
  
  return text;
}

/**
 * Goals review component with direct text editing
 */
export function GoalsReview({ plan, onBack }: GoalsReviewProps) {
  const { user } = useAuthStore();
  const { 
    approveGoals, 
    generateGoals,
    updateGoals, 
    generating, 
    error, 
    clearError,
    customGoalsPrompt,
    saveCustomGoalsPrompt,
    resetGoalsPromptToDefault,
    loading
  } = useAICoachStore();
  
  // Convert initial plan to text format
  const [goalsText, setGoalsText] = useState(() => 
    goalsToText(plan.macrocycleGoal, plan.mesocycleMilestones)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [feedback, setFeedback] = useState('');
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
  
  // Update text when plan changes (e.g., after regeneration)
  useEffect(() => {
    setGoalsText(goalsToText(plan.macrocycleGoal, plan.mesocycleMilestones));
  }, [plan.macrocycleGoal, plan.mesocycleMilestones]);

  const handleApprove = async () => {
    // Parse and validate text before approving
    const parsed = parseGoalsText(goalsText);
    
    if (!parsed) {
      setParseError('Could not parse goals. Please check the format.');
      return;
    }
    
    setParseError(null);
    
    // Save edits first
    await updateGoals({
      macrocycleGoal: {
        ...plan.macrocycleGoal,
        ...parsed.macrocycle,
        // Preserve dates
        startDate: plan.macrocycleGoal.startDate,
        endDate: plan.macrocycleGoal.endDate,
        promisedOutcome: plan.macrocycleGoal.promisedOutcome
      },
      mesocycleMilestones: parsed.mesocycles.map((meso, index) => ({
        ...meso,
        // Preserve or calculate dates
        startDate: plan.mesocycleMilestones[index]?.startDate || '',
        endDate: plan.mesocycleMilestones[index]?.endDate || ''
      }))
    });
    
    // Then approve
    await approveGoals();
  };

  const handleRegenerate = async () => {
    if (!user?.profile) return;
    
    // Build request with feedback
    const request = {
      userProfile: user.profile,
      fitnessGoalInput: user.profile.goals || '',
      customInput: feedback.trim() ? `Previous goals feedback: ${feedback}\n\nPlease regenerate goals taking this feedback into account.` : '',
      currentDate: new Date().toISOString(),
    };
    
    // Generate with custom prompt if edited
    await generateGoals(request, editingPrompt || undefined);
    setFeedback('');
    setShowRegenerate(false);
  };
  
  const handlePromptSaved = async (prompt: CustomPromptConfig) => {
    await saveCustomGoalsPrompt(prompt);
    setEditingPrompt(prompt);
  };

  const handlePromptReset = async () => {
    await resetGoalsPromptToDefault();
    setEditingPrompt(defaultPrompt);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Your Fitness Goals</h1>
          <p className="text-muted-foreground mt-1">
            Edit directly in the text below
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Draft
        </Badge>
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

      {/* Parse Error Alert */}
      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* Format Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How to edit:</strong> Edit the text directly below. To add mesocycles, copy the "Phase X:" format. 
          To remove, delete the entire phase section. Keep the format consistent: "Name:", "Description:", "Duration:", "Focus:".
        </AlertDescription>
      </Alert>

      {/* Text Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Goals Editor</CardTitle>
          <CardDescription>
            Edit your macro goal and training phases directly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={goalsText}
            onChange={(e) => {
              setGoalsText(e.target.value);
              setParseError(null);
            }}
            rows={20}
            className="font-mono text-sm resize-none"
            placeholder="Edit your goals here..."
          />
        </CardContent>
      </Card>

      {/* Regenerate Section */}
      {showRegenerate && editingPrompt && defaultPrompt && (
        <div className="space-y-6 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-6 bg-orange-50/30 dark:bg-orange-950/20">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <RotateCcw className="h-5 w-5" />
              <span>Regenerate Goals</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the prompt and add feedback to regenerate your goals
            </p>
          </div>
          
          {/* Previous Goals Context */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Context:</strong> Your current goals will be used as context for regeneration. Add feedback below to guide changes.
            </AlertDescription>
          </Alert>
          
          {/* Feedback Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Feedback</CardTitle>
              <CardDescription>
                Describe what you want to change about your current goals (optional but recommended)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g., 'Focus more on strength than cardio', 'Make the timeline shorter', 'I want to target specific muscle groups'..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                This feedback will be included in the prompt to guide AI regeneration
              </p>
            </CardContent>
          </Card>
          
          {/* Prompt Editor - Fully Visible */}
          <PromptEditor
            title="AI Regeneration Prompt"
            description="This prompt will be used to regenerate your goals. It includes your current goals as context."
            initialPrompt={editingPrompt}
            availablePlaceholders={[
              { placeholder: 'USER_PROFILE', description: 'Complete user profile data' },
              { placeholder: 'FITNESS_GOAL_INPUT', description: 'User\'s fitness goal from profile' },
              { placeholder: 'CUSTOM_INPUT', description: 'Your feedback + context about previous goals', example: 'Includes current goals and your feedback' },
              { placeholder: 'CURRENT_DATE', description: 'Current date (ISO format)' }
            ]}
            populatedData={user?.profile ? {
              USER_PROFILE: JSON.stringify(user.profile, null, 2),
              FITNESS_GOAL_INPUT: user.profile.goals || 'Not set',
              CUSTOM_INPUT: `Previous Goals:\nMacro: ${plan.macrocycleGoal.name}\nMesocycles: ${plan.mesocycleMilestones.map(m => m.name).join(', ')}\n\nFeedback: ${feedback || 'Not provided'}`,
              CURRENT_DATE: new Date().toISOString()
            } : undefined}
            onSave={handlePromptSaved}
            onReset={handlePromptReset}
            loading={loading}
          />
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRegenerate(false);
                setFeedback('');
              }}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRegenerate}
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
                  Regenerate Goals Now
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-between">
        <Button 
          variant="outline" 
          onClick={onBack}
          disabled={generating}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowRegenerate(!showRegenerate)}
            disabled={generating}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {showRegenerate ? 'Cancel' : 'Regenerate with Feedback'}
          </Button>
          <Button 
            onClick={handleApprove}
            disabled={generating}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Goals
          </Button>
        </div>
      </div>
    </div>
  );
}
