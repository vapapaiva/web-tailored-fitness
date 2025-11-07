/**
 * Goals Review - Review and approve/edit/regenerate generated goals
 * Step 4 of goals generation flow - with direct text editing
 */

import { useState, useEffect } from 'react';
import type { AIPlan, MacrocycleGoal, MesocycleMilestone } from '@/types/aiCoach';
import { useAICoachStore } from '@/stores/aiCoachStore';
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
  Info
} from 'lucide-react';

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
  const { approveGoals, regenerateGoals, updateGoals, generating, error, clearError } = useAICoachStore();
  
  // Convert initial plan to text format
  const [goalsText, setGoalsText] = useState(() => 
    goalsToText(plan.macrocycleGoal, plan.mesocycleMilestones)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [feedback, setFeedback] = useState('');
  
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
    if (!feedback.trim()) return;
    
    await regenerateGoals(feedback);
    setFeedback('');
    setShowRegenerate(false);
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
      {showRegenerate && (
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="text-base">Provide Feedback for Regeneration</CardTitle>
            <CardDescription>
              Tell the AI what you'd like to change about these goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Focus more on strength than cardio, Make the timeline shorter, Include specific body part goals..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRegenerate(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRegenerate}
                disabled={!feedback.trim() || generating}
              >
                {generating ? 'Regenerating...' : 'Regenerate with Feedback'}
              </Button>
            </div>
          </CardContent>
        </Card>
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
