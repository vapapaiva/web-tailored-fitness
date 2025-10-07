/**
 * Week Completion Logic
 * Determines when and how the week completion button should appear
 */

import type { Microcycle } from '../types/fitness';
import { daysSince } from './dateUtils';

export type WeekCompletionButtonState = 'disabled' | 'ready' | 'overdue' | 'long-gap';

export interface WeekCompletionState {
  canComplete: boolean;
  state: WeekCompletionButtonState;
  message: string;
  daysSinceEnd?: number;
}

/**
 * Check the week completion state based on microcycle data and current date
 * @param microcycle - The current microcycle to check
 * @param currentDate - The current date (defaults to now)
 * @returns WeekCompletionState with button state and messaging
 */
export function checkWeekCompletionState(
  microcycle: Microcycle | null,
  currentDate: Date = new Date()
): WeekCompletionState {
  // No microcycle or no date range
  if (!microcycle || !microcycle.dateRange) {
    return {
      canComplete: false,
      state: 'disabled',
      message: 'No active week'
    };
  }

  // Already completed
  if (microcycle.status === 'completed') {
    return {
      canComplete: false,
      state: 'disabled',
      message: 'Week already completed'
    };
  }

  const daysSinceEnd = daysSince(microcycle.dateRange.end);

  // Long gap (8+ days) - triggers gap recovery flow
  if (daysSinceEnd > 7) {
    return {
      canComplete: false,
      state: 'long-gap',
      message: `Week ended ${daysSinceEnd} days ago. Gap recovery needed.`,
      daysSinceEnd
    };
  }

  // Short overdue (1-7 days after week end)
  if (daysSinceEnd > 0 && daysSinceEnd <= 7) {
    return {
      canComplete: true,
      state: 'overdue',
      message: `This week ended ${daysSinceEnd} day${daysSinceEnd > 1 ? 's' : ''} ago. Complete it now to get back on track`,
      daysSinceEnd
    };
  }

  // Ready (last day of week, daysSinceEnd === 0)
  if (daysSinceEnd === 0) {
    return {
      canComplete: true,
      state: 'ready',
      message: `Week ends today! Complete it now to generate your personalized next week`,
      daysSinceEnd: 0
    };
  }

  // Disabled (days 1-6 of week, daysSinceEnd < 0)
  const endDate = new Date(microcycle.dateRange.end);
  const formattedEndDate = endDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return {
    canComplete: false,
    state: 'disabled',
    message: `Complete this week on ${formattedEndDate} to save your progress`,
    daysSinceEnd
  };
}

/**
 * Check if a microcycle is eligible for completion
 * @param microcycle - The microcycle to check
 * @returns true if can be completed
 */
export function canCompleteMicrocycle(microcycle: Microcycle | null): boolean {
  const state = checkWeekCompletionState(microcycle);
  return state.canComplete;
}

/**
 * Get button styling class based on state
 * @param state - The button state
 * @returns CSS class string for styling
 */
export function getButtonClassName(state: WeekCompletionButtonState): string {
  const baseClass = "w-full py-6 text-lg font-semibold transition-all duration-200";
  
  switch (state) {
    case 'ready':
      return `${baseClass} bg-green-600 hover:bg-green-700 text-white shadow-lg`;
    case 'overdue':
      return `${baseClass} bg-orange-600 hover:bg-orange-700 text-white shadow-md`;
    case 'disabled':
    case 'long-gap':
      return `${baseClass} bg-muted text-muted-foreground cursor-not-allowed`;
    default:
      return baseClass;
  }
}

/**
 * Get button text based on state
 * @param state - The button state
 * @returns Button text string
 */
export function getButtonText(state: WeekCompletionButtonState): string {
  switch (state) {
    case 'ready':
      return 'Complete Week & Generate Next 🚀';
    case 'overdue':
      return 'Complete Overdue Week & Generate Next ⚠️';
    case 'disabled':
    case 'long-gap':
      return 'Complete Week 🎯';
    default:
      return 'Complete Week';
  }
}

/**
 * Get message styling class based on state
 * @param state - The button state
 * @returns CSS class string for message styling
 */
export function getMessageClassName(state: WeekCompletionButtonState): string {
  const baseClass = "text-sm mt-2 text-center";
  
  switch (state) {
    case 'ready':
      return `${baseClass} text-green-600 dark:text-green-400 font-semibold`;
    case 'overdue':
      return `${baseClass} text-orange-600 dark:text-orange-400 font-semibold`;
    case 'disabled':
    case 'long-gap':
      return `${baseClass} text-muted-foreground`;
    default:
      return baseClass;
  }
}

/**
 * Get emoji prefix for message based on state
 * @param state - The button state
 * @returns Emoji string
 */
export function getMessageEmoji(state: WeekCompletionButtonState): string {
  switch (state) {
    case 'ready':
      return '🎯 ';
    case 'overdue':
      return '⚠️ ';
    case 'disabled':
      return '💡 ';
    case 'long-gap':
      return '👋 ';
    default:
      return '';
  }
}
