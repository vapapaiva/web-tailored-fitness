/**
 * Goals Editor - Manual editing of macrocycle and mesocycle goals
 */

import { useState } from 'react';
import type { AIPlan, MacrocycleGoal, MesocycleMilestone } from '@/types/aiCoach';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, X, Target, Calendar } from 'lucide-react';

interface GoalsEditorProps {
  plan: AIPlan;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Goals editor component
 */
export function GoalsEditor({ plan, onSave, onCancel }: GoalsEditorProps) {
  const { updateGoals } = useAICoachStore();
  
  const [macrocycle, setMacrocycle] = useState<MacrocycleGoal>(plan.macrocycleGoal);
  const [mesocycles, setMesocycles] = useState<MesocycleMilestone[]>(plan.mesocycleMilestones);

  const handleSave = async () => {
    await updateGoals({
      macrocycleGoal: macrocycle,
      mesocycleMilestones: mesocycles,
    });
    onSave();
  };

  const updateMesocycle = (index: number, updates: Partial<MesocycleMilestone>) => {
    const updated = [...mesocycles];
    updated[index] = { ...updated[index], ...updates };
    setMesocycles(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Your Fitness Goals</h1>
          <p className="text-muted-foreground mt-1">
            Manually adjust your goals as needed
          </p>
        </div>
      </div>

      {/* Macrocycle Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>6-Month Goal (Macrocycle)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="macro-name">Goal Name</Label>
            <Input
              id="macro-name"
              value={macrocycle.name}
              onChange={(e) => setMacrocycle({ ...macrocycle, name: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="macro-value">Description</Label>
            <Textarea
              id="macro-value"
              value={macrocycle.value}
              onChange={(e) => setMacrocycle({ ...macrocycle, value: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="macro-outcome">Promised Outcome</Label>
            <Textarea
              id="macro-outcome"
              value={macrocycle.promisedOutcome}
              onChange={(e) => setMacrocycle({ ...macrocycle, promisedOutcome: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="macro-duration">Duration (weeks)</Label>
            <Input
              id="macro-duration"
              type="number"
              value={macrocycle.durationWeeks}
              onChange={(e) => setMacrocycle({ ...macrocycle, durationWeeks: parseInt(e.target.value) || 24 })}
              min={1}
              max={52}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mesocycles Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Training Phases (Mesocycles)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mesocycles.map((meso, index) => (
              <Card key={meso.id} className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Phase {index + 1}</Label>
                    <Badge variant="outline" className="text-xs">
                      {meso.durationWeeks} weeks
                    </Badge>
                  </div>
                  
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`meso-${index}-name`} className="text-xs">Name</Label>
                      <Input
                        id={`meso-${index}-name`}
                        value={meso.name}
                        onChange={(e) => updateMesocycle(index, { name: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`meso-${index}-focus`} className="text-xs">Focus</Label>
                      <Input
                        id={`meso-${index}-focus`}
                        value={meso.focus}
                        onChange={(e) => updateMesocycle(index, { focus: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`meso-${index}-value`} className="text-xs">Description</Label>
                    <Textarea
                      id={`meso-${index}-value`}
                      value={meso.value}
                      onChange={(e) => updateMesocycle(index, { value: e.target.value })}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`meso-${index}-duration`} className="text-xs">Duration (weeks)</Label>
                    <Input
                      id={`meso-${index}-duration`}
                      type="number"
                      value={meso.durationWeeks}
                      onChange={(e) => updateMesocycle(index, { durationWeeks: parseInt(e.target.value) || 4 })}
                      className="text-sm"
                      min={1}
                      max={12}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onCancel}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

