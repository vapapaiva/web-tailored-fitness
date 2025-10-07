import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { FitnessPlan, Workout } from '@/types/fitness';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { WeeklyScheduleV2 } from './WeeklyScheduleV2';
import { formatWeekHeader } from '@/lib/dateUtils';
import { 
  Calendar, 
  Target, 
  CheckCircle, 
  RotateCcw, 
  MessageSquare,
  Plus,
  X
} from 'lucide-react';

interface FitnessPlanDisplayProps {
  plan: FitnessPlan;
  onPlanUpdate: (updatedPlan: FitnessPlan) => Promise<void>;
  onRegeneratePlan: (customPrompt?: string) => void;
  onApprovePlan: () => void;
  isGenerating?: boolean;
}

/**
 * Complete fitness plan display with approval flow and editing capabilities
 */
export const FitnessPlanDisplay = React.memo(function FitnessPlanDisplay({ 
  plan, 
  onPlanUpdate, 
  onRegeneratePlan, 
  onApprovePlan,
  isGenerating = false 
}: FitnessPlanDisplayProps) {
  const [customComments, setCustomComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  
  // Track if we're in the middle of a drag operation to prevent re-renders
  const isDraggingRef = useRef(false);

  const isApproved = plan.status === 'approved' || plan.status === 'active';

  const handleWorkoutsChange = useCallback(async (updatedWorkouts: Workout[]) => {
    // Skip updates during drag operations to prevent blinking
    if (isDraggingRef.current) return;
    
    // Use a more stable approach to prevent unnecessary re-renders
    const updatedPlan = {
      ...plan,
      currentMicrocycle: {
        ...plan.currentMicrocycle,
        workouts: updatedWorkouts,
      },
    };
    await onPlanUpdate(updatedPlan);
  }, [plan, onPlanUpdate]);
  
  // Handle workout changes after drag is complete
  const handleWorkoutsChangeAfterDrag = useCallback(async (updatedWorkouts: Workout[]) => {
    const updatedPlan = {
      ...plan,
      currentMicrocycle: {
        ...plan.currentMicrocycle,
        workouts: updatedWorkouts,
      },
    };
    await onPlanUpdate(updatedPlan);
  }, [plan, onPlanUpdate]);

  const addCustomComment = useCallback(() => {
    if (newComment.trim()) {
      setCustomComments([...customComments, newComment.trim()]);
      setNewComment('');
    }
  }, [newComment, customComments]);

  const removeCustomComment = useCallback((index: number) => {
    setCustomComments(customComments.filter((_, i) => i !== index));
  }, [customComments]);

  const handleRegenerateWithComments = useCallback(() => {
    const allComments = customComments.join('\n');
    onRegeneratePlan(allComments);
    setCustomComments([]);
    setNewComment('');
    setShowComments(false);
  }, [customComments, onRegeneratePlan]);


  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
            <p className="text-muted-foreground">{plan.description}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {plan.status}
              </span>
              <span className="text-sm text-muted-foreground">
                Generated {new Date(plan.generationMetadata.generatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        
        <div className="flex space-x-2">
          {!isApproved && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowComments(!showComments)}
                disabled={isGenerating}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {showComments ? 'Cancel' : 'Regenerate Plan'}
              </Button>
              <Button onClick={onApprovePlan}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Plan
              </Button>
            </>
          )}
          
          {isApproved && (
            <Button
              variant="outline"
              onClick={() => setShowComments(!showComments)}
              disabled={isGenerating}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {showComments ? 'Cancel' : 'Regenerate Plan'}
            </Button>
          )}
        </div>
      </div>

      {/* Custom Comments Section */}
      {showComments && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Requirements</CardTitle>
            <CardDescription>
              Add specific comments or modifications you'd like for the regenerated plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Comments */}
            {customComments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your comments:</Label>
                {customComments.map((comment, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 bg-muted rounded">
                    <span className="text-sm flex-1">{comment}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomComment(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Comment */}
            <div className="space-y-2">
              <Label>Add comment:</Label>
              <div className="flex space-x-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="e.g., Focus more on upper body, reduce workout duration to 30 minutes, add more cardio..."
                  className="flex-1"
                  rows={3}
                />
                <Button
                  onClick={addCustomComment}
                  disabled={!newComment.trim()}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowComments(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRegenerateWithComments}
                disabled={isGenerating}
              >
                {isGenerating ? 'Regenerating...' : 'Regenerate with Comments'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Macrocycle Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>{plan.macrocycle.name}</span>
          </CardTitle>
          <CardDescription>
            {plan.macrocycle.value} • {plan.macrocycle.durationWeeks} weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plan.macrocycle.mesocycles.map((meso, index) => (
              <Card key={meso.id} className="border-dashed">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Phase {index + 1}: {meso.name}</h4>
                    <p className="text-xs text-muted-foreground">{meso.durationWeeks} weeks</p>
                    <p className="text-xs">{meso.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Microcycle with Integrated Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>
              {plan.currentMicrocycle.dateRange 
                ? formatWeekHeader(plan.currentMicrocycle.week, plan.currentMicrocycle.dateRange, plan.currentMicrocycle.focus)
                : `Week ${plan.currentMicrocycle.week} - ${plan.currentMicrocycle.focus}`
              }
            </span>
          </CardTitle>
          <CardDescription>
            {plan.currentMicrocycle.value}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyScheduleV2
            workouts={plan.currentMicrocycle.workouts}
            onWorkoutsChange={handleWorkoutsChange}
            weekDateRange={plan.currentMicrocycle.dateRange}
            onWorkoutsChangeAfterDrag={handleWorkoutsChangeAfterDrag}
            isEditable={true}
            isDraggingRef={isDraggingRef}
          />
        </CardContent>
      </Card>

    </div>
  );
});
