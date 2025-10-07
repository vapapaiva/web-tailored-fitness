/**
 * Week Completion Button Component
 * 
 * Smart button that appears when it's time to complete a week and generate the next one.
 * Has different states based on timing:
 * - Disabled (days 1-6): Gray, not clickable
 * - Ready (day 7): Green with pulse animation
 * - Overdue (days 8-14): Orange warning
 * - Long gap (15+): Hidden (triggers gap recovery dialog instead)
 */

import { Button } from '@/components/ui/button';
import type { Microcycle } from '@/types/fitness';
import { 
  checkWeekCompletionState,
  getButtonClassName,
  getButtonText,
  getMessageClassName,
  getMessageEmoji
} from '@/lib/weekCompletionLogic';
import { useEffect, useState } from 'react';

interface WeekCompletionButtonProps {
  microcycle: Microcycle | null;
  onComplete: () => void;
}

/**
 * Week Completion Button with smart state detection
 */
export function WeekCompletionButton({ microcycle, onComplete }: WeekCompletionButtonProps) {
  const [state, setState] = useState(() => checkWeekCompletionState(microcycle));

  // Re-check state every minute (in case day changes while user has app open)
  useEffect(() => {
    setState(checkWeekCompletionState(microcycle));
    
    const interval = setInterval(() => {
      setState(checkWeekCompletionState(microcycle));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [microcycle]);

  // Don't render for long gaps (handled by gap recovery dialog)
  if (state.state === 'long-gap') {
    return null;
  }

  // Don't render if no microcycle or already completed
  if (!microcycle || microcycle.status === 'completed') {
    return null;
  }

  return (
    <div className="mb-6">
      <Button
        onClick={onComplete}
        disabled={!state.canComplete}
        className={getButtonClassName(state.state)}
      >
        {getButtonText(state.state)}
      </Button>
      
      <p className={getMessageClassName(state.state)}>
        {getMessageEmoji(state.state)}
        {state.message}
      </p>
    </div>
  );
}
