/**
 * Add Workout Dialog - Form for creating new workouts
 */

import { useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTodayISO } from '@/lib/dateUtils';
import { Plus, X } from 'lucide-react';

interface AddWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutCreated?: (workoutId: string) => void; // Callback when workout is created
}

/**
 * Add workout dialog component
 */
export function AddWorkoutDialog({ isOpen, onClose, onWorkoutCreated }: AddWorkoutDialogProps) {
  const { addWorkout } = useWorkoutsStore();
  
  const [name, setName] = useState('');
  const [dateString, setDateString] = useState<string>(getTodayISO());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      const workoutData = {
        name: name.trim(),
        date: dateString || undefined, // Empty string becomes undefined
        source: 'manual' as const,
        status: 'planned' as const,
        type: 'general',
        focus: 'General Training',
        value: 'Workout session',
        exercises: [],
        estimatedDuration: 60,
        checkIns: {
          greenFlags: [],
          redFlags: []
        }
      };

      const workoutId = await addWorkout(workoutData);
      
      // Reset form and close
      setName('');
      setDateString(getTodayISO());
      onClose();
      
      // Notify parent to open execution mode
      if (onWorkoutCreated) {
        onWorkoutCreated(workoutId);
      }
    } catch (error) {
      console.error('Failed to add workout:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setDateString(getTodayISO());
    onClose();
  };

  const handleClearDate = () => {
    setDateString('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Workout</DialogTitle>
          <DialogDescription>
            Create a new workout and add it to your schedule
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Workout Name */}
            <div className="space-y-2">
              <Label htmlFor="workout-name">Workout Name</Label>
              <Input
                id="workout-name"
                placeholder="e.g., Upper Body Strength"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Date Input */}
            <div className="space-y-2">
              <Label htmlFor="workout-date">
                Date <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="workout-date"
                  type="date"
                  value={dateString}
                  onChange={(e) => setDateString(e.target.value)}
                  className="flex-1"
                />
                {dateString && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDate}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!dateString && (
                <p className="text-xs text-muted-foreground">
                  Without a date, workout will be added to your library
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Workout'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

