/**
 * Goals Review - Review and approve/edit/regenerate generated goals
 * Step 4 of goals generation flow - with inline editing
 */

import { useState } from 'react';
import type { AIPlan, MacrocycleGoal, MesocycleMilestone } from '@/types/aiCoach';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  RotateCcw, 
  Target, 
  Calendar,
  ArrowLeft,
  AlertCircle,
  ChevronUp,
  Edit
} from 'lucide-react';

interface GoalsReviewProps {
  plan: AIPlan;
  onBack: () => void;
}

/**
 * Goals review component with inline editing
 */
export function GoalsReview({ plan, onBack }: GoalsReviewProps) {
  const { approveGoals, regenerateGoals, updateGoals, generating, error, clearError } = useAICoachStore();
  
  // Local state for inline editing
  const [macrocycle, setMacrocycle] = useState<MacrocycleGoal>(plan.macrocycleGoal);
  const [mesocycles, setMesocycles] = useState<MesocycleMilestone[]>(plan.mesocycleMilestones);
  const [hasEdits, setHasEdits] = useState(false);
  
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const [isEditingMacro, setIsEditingMacro] = useState(false);
  const [editingMesoIndex, setEditingMesoIndex] = useState<number | null>(null);

  const handleApprove = async () => {
    // Save any edits first
    if (hasEdits) {
      await updateGoals({
        macrocycleGoal: macrocycle,
        mesocycleMilestones: mesocycles,
      });
    }
    
    // Then approve
    await approveGoals();
  };

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    
    await regenerateGoals(feedback);
    setFeedback('');
    setShowRegenerate(false);
  };
  
  const updateMacrocycle = (updates: Partial<MacrocycleGoal>) => {
    setMacrocycle(prev => ({ ...prev, ...updates }));
    setHasEdits(true);
  };
  
  const updateMesocycle = (index: number, updates: Partial<MesocycleMilestone>) => {
    const updated = [...mesocycles];
    updated[index] = { ...updated[index], ...updates };
    setMesocycles(updated);
    setHasEdits(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Your Fitness Goals</h1>
          <p className="text-muted-foreground mt-1">
            AI-generated goals based on your profile and input
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

      {/* Macrocycle Goal - Compact with Edit Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>{macrocycle.name}</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{macrocycle.durationWeeks} weeks</Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsEditingMacro(!isEditingMacro)}
              >
                {isEditingMacro ? <ChevronUp className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <CardDescription>
            {new Date(plan.macrocycleGoal.startDate).toLocaleDateString()} - {new Date(plan.macrocycleGoal.endDate).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditingMacro ? (
            <>
              <Input
                value={macrocycle.name}
                onChange={(e) => updateMacrocycle({ name: e.target.value })}
                className="font-medium"
                placeholder="Goal name"
              />
              <Textarea
                value={macrocycle.value}
                onChange={(e) => updateMacrocycle({ value: e.target.value })}
                rows={2}
                className="resize-none text-sm"
                placeholder="Goal description"
              />
              <Input
                type="number"
                value={macrocycle.durationWeeks}
                onChange={(e) => updateMacrocycle({ durationWeeks: parseInt(e.target.value) || 24 })}
                min={4}
                max={52}
                className="w-32"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{macrocycle.value}</p>
          )}
        </CardContent>
      </Card>

      {/* Mesocycle Milestones - Compact with Inline Edit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Training Phases ({mesocycles.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {mesocycles.map((meso, index) => (
              <Card key={meso.id} className="border-dashed">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">Phase {index + 1}</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingMesoIndex(editingMesoIndex === index ? null : index)}
                    >
                      {editingMesoIndex === index ? <ChevronUp className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
                    </Button>
                  </div>
                  
                  {editingMesoIndex === index ? (
                    <div className="space-y-2">
                      <Input
                        value={meso.name}
                        onChange={(e) => updateMesocycle(index, { name: e.target.value })}
                        className="font-medium text-sm"
                        placeholder="Phase name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={meso.focus}
                          onChange={(e) => updateMesocycle(index, { focus: e.target.value })}
                          className="text-xs"
                          placeholder="Focus"
                        />
                        <Input
                          type="number"
                          value={meso.durationWeeks}
                          onChange={(e) => updateMesocycle(index, { durationWeeks: parseInt(e.target.value) || 4 })}
                          min={1}
                          max={12}
                          className="text-xs"
                          placeholder="Weeks"
                        />
                      </div>
                      <Textarea
                        value={meso.value}
                        onChange={(e) => updateMesocycle(index, { value: e.target.value })}
                        rows={2}
                        className="text-xs resize-none"
                        placeholder="Description"
                      />
                    </div>
                  ) : (
                    <>
                      <h4 className="font-medium text-sm">{meso.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {meso.durationWeeks} weeks • {meso.focus}
                      </p>
                      <p className="text-xs line-clamp-2">{meso.value}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
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

      {/* Help Text */}
      {hasEdits && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've made changes. Click "Approve Goals" to save and continue.
          </AlertDescription>
        </Alert>
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
            {hasEdits ? 'Save & Approve Goals' : 'Approve Goals'}
          </Button>
        </div>
      </div>
    </div>
  );
}

