import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';
import { checkWeekCompletionState } from '@/lib/weekCompletionLogic';

/**
 * Hook to detect if user has a training gap (7+ days since week end)
 * Automatically redirects to gap recovery page when detected
 */
export function useGapDetection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan } = useFitnessPlanStore();

  useEffect(() => {
    // Don't check if already on gap recovery page
    if (location.pathname === '/app/gap-recovery') {
      return;
    }

    // Only check for gaps if plan exists and is approved
    if (!currentPlan || currentPlan.status !== 'approved') {
      return;
    }

    // Check if current microcycle has a long gap
    const state = checkWeekCompletionState(currentPlan.currentMicrocycle);
    
    if (state.state === 'long-gap') {
      console.log('[Gap Detection] Long gap detected, redirecting to gap recovery page');
      navigate('/app/gap-recovery');
    }
  }, [currentPlan, navigate, location.pathname]);

  return { hasGap: currentPlan && checkWeekCompletionState(currentPlan.currentMicrocycle).state === 'long-gap' };
}

