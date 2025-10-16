/**
 * Fitness Goals Card - Displays macrocycle and mesocycles with editing capability
 */

import { useState } from 'react';
import type { AIPlan } from '@/types/aiCoach';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoalsEditor } from './GoalsEditor';
import { Target, Calendar, ChevronDown, ChevronUp, Edit, Info, X, RotateCcw } from 'lucide-react';

interface FitnessGoalsCardProps {
  plan: AIPlan;
}

/**
 * Fitness goals card component
 */
export function FitnessGoalsCard({ plan }: FitnessGoalsCardProps) {
  const { dismissRegenerationSuggestion, regenerateMicrocycle, regenerateGoals } = useAICoachStore();
  const [showEditor, setShowEditor] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRegenerateFeedback, setShowRegenerateFeedback] = useState(false);
  const [showRegenerateGoals, setShowRegenerateGoals] = useState(false);
  const [weekFeedback, setWeekFeedback] = useState('');
  const [goalsFeedback, setGoalsFeedback] = useState('');

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
      {/* Regeneration Suggestion Banner */}
      {plan.showRegenerationSuggestion && !showRegenerateFeedback && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your goals have changed. Would you like to regenerate the current week to match your new goals?
            </span>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => dismissRegenerationSuggestion()}
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowRegenerateFeedback(true)}
              >
                Regenerate Week
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Regenerate Week Feedback Input */}
      {showRegenerateFeedback && (
        <Alert>
          <RotateCcw className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">Regenerate Current Week</p>
            <Textarea
              placeholder="Optional: Add feedback for regeneration (e.g., more upper body focus, less cardio...)"
              value={weekFeedback}
              onChange={(e) => setWeekFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setShowRegenerateFeedback(false);
                  setWeekFeedback('');
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={async () => {
                  await regenerateMicrocycle(weekFeedback);
                  setShowRegenerateFeedback(false);
                  setWeekFeedback('');
                }}
              >
                Regenerate Week
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Regenerate Goals Feedback Input */}
      {showRegenerateGoals && (
        <Alert>
          <RotateCcw className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">Regenerate Fitness Goals</p>
            <Textarea
              placeholder="Optional: Tell AI what you'd like to change about your goals..."
              value={goalsFeedback}
              onChange={(e) => setGoalsFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setShowRegenerateGoals(false);
                  setGoalsFeedback('');
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={async () => {
                  await regenerateGoals(goalsFeedback);
                  setShowRegenerateGoals(false);
                  setGoalsFeedback('');
                }}
              >
                Regenerate Goals
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
                onClick={() => setShowRegenerateGoals(!showRegenerateGoals)}
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
    </div>
  );
}

