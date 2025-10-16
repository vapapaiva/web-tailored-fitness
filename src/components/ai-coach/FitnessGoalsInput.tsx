/**
 * Fitness Goals Input - Step 2 of goals generation
 * Collects fitness goal from profile + detailed custom input
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { useProfileConfigStore } from '@/stores/profileConfigStore';
import { CollapsibleChoiceField } from '@/components/forms/CollapsibleChoiceField';
import type { ProfileFieldValue } from '@/types/profile';
import { Target, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface FitnessGoalsInputProps {
  fitnessGoalInput: string;
  customInput: string;
  onFitnessGoalChange: (value: string) => void;
  onCustomInputChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  isGenerating: boolean;
}

/**
 * Fitness goals input component
 */
export function FitnessGoalsInput({
  fitnessGoalInput,
  customInput,
  onFitnessGoalChange,
  onCustomInputChange,
  onBack,
  onNext,
  isGenerating
}: FitnessGoalsInputProps) {
  const { user, updateProfile } = useAuthStore();
  const { config } = useProfileConfigStore();
  const [localGoalValue, setLocalGoalValue] = useState<ProfileFieldValue>(user?.profile?.goals || '');
  
  // Find the fitness goals field from config
  const goalsField = config?.sections
    .flatMap(s => s.fields)
    .find(f => f.id === 'goals');

  const handleGoalChange = async (value: ProfileFieldValue) => {
    setLocalGoalValue(value);
    onFitnessGoalChange(value as string);
    
    // Auto-save to profile
    if (user?.profile) {
      await updateProfile({ ...user.profile, goals: value });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Define Your Fitness Goals</span>
        </CardTitle>
        <CardDescription>
          Help the AI understand what you want to achieve
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fitness Goal from Profile (Collapsible Field) */}
        {goalsField && (
          <div>
            <CollapsibleChoiceField
              field={goalsField}
              value={localGoalValue}
              onChange={handleGoalChange}
            />
          </div>
        )}

        {/* Custom Detailed Input */}
        <div className="space-y-2">
          <Label htmlFor="custom-input">
            Describe your fitness goals in detail <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="custom-input"
            placeholder="Tell us more about your goals, preferences, constraints, past experience, specific outcomes you're hoping for, training schedule preferences, etc. The more detail you provide, the better AI can tailor your fitness plan."
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            rows={10}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {customInput.length} characters • Be as detailed as you like
          </p>
        </div>

        {/* Helper Text */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Tip:</strong> The more specific you are, the better your personalized goals will be. 
            Mention things like target weight, specific events you're training for, body parts you want to focus on, timeline constraints, etc.
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={onBack}
            disabled={isGenerating}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={onNext}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate Goals
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

