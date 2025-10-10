# Week Completion & Full App Loop - Complete Implementation Plan

## 📋 **EXECUTIVE SUMMARY**

This plan implements the complete user journey from COMPLETE_APP_LOOP_UX.md:
1. **Initial Plan Generation** (with timing-based logic)
2. **Normal Progression** (happy path with week completion)
3. **Gap Recovery** (7+ day pause handling)

The plan follows incremental development, maintains backward compatibility, and adheres to the real-time sync pattern.

---

## 🔍 **CURRENT STATE vs REQUIRED STATE**

### **What We Have**
- ✅ Basic AI plan generation (single prompt only)
- ✅ Workout completion tracking
- ✅ Real-time sync pattern with mutation tracking
- ✅ Optimistic updates
- ✅ Type-safe data structures

### **What's Missing**
- ❌ Date ranges in microcycles
- ❌ Multiple prompts for different scenarios
- ❌ Initial generation timing logic (Mon-Thu vs Fri-Sun)
- ❌ Week completion button and dialog
- ❌ Workout history persistence
- ❌ Gap recovery flow (completely missing)
- ❌ Plan regeneration with comments
- ❌ Week focus/title in UI
- ❌ Progress page implementation

---

## 🎯 **IMPLEMENTATION STRATEGY**

### **Core Principles**
1. **Follow UX Spec Exactly**: No deviations from COMPLETE_APP_LOOP_UX.md
2. **Incremental & Testable**: Each phase delivers working functionality
3. **Backward Compatible**: Existing plans continue to work
4. **Real-time Sync Compliant**: Use mutation tracking patterns
5. **Type Safety First**: Maintain TypeScript strictness

### **Development Approach**
- Work in phases that can be tested independently
- Use feature flags if needed to hide incomplete features
- Test each phase thoroughly before moving to next
- Update documentation as you go

---

## 📅 **PHASE-BY-PHASE IMPLEMENTATION**

## **PHASE 1: Foundation - Date Infrastructure** 
*Duration: 2 days | Priority: CRITICAL*

### **Objective**
Create date calculation and formatting utilities that support all flows.

### **Tasks**

#### **1.1 Create Date Utilities**
**File**: `src/lib/dateUtils.ts`

```typescript
/**
 * Date utilities for fitness plan week calculations
 */

export interface DateRange {
  start: string; // ISO date string: "2025-01-20"
  end: string;   // ISO date string: "2025-01-26"
}

/**
 * Get the Monday of the current week
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Get the Sunday of the current week
 */
export function getWeekEndDate(date: Date = new Date()): string {
  const startDate = new Date(getWeekStartDate(date));
  startDate.setDate(startDate.getDate() + 6);
  return startDate.toISOString().split('T')[0];
}

/**
 * Add days to a date
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate initial week date range based on current day
 * Mon-Thu: Rest of current week
 * Fri-Sun: Till end of next week
 */
export function calculateInitialWeekRange(date: Date = new Date()): DateRange {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;
  
  const start = getWeekStartDate(date);
  const end = isMonToThu 
    ? getWeekEndDate(date) 
    : addDays(getWeekEndDate(date), 7);
  
  return { start, end };
}

/**
 * Calculate next week date range
 */
export function calculateNextWeekRange(currentRange: DateRange): DateRange {
  const nextStart = addDays(currentRange.end, 1);
  const nextEnd = addDays(nextStart, 6);
  return { start: nextStart, end: nextEnd };
}

/**
 * Calculate date from dayOfWeek (0=Sunday, 1=Monday, etc.)
 */
export function calculateDateFromDayOfWeek(dayOfWeek: number, weekStartDate: string): string {
  const dayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-based
  return addDays(weekStartDate, dayOffset);
}

/**
 * Format week header: "Week 1: Jan 20 - 26 - Foundation Week"
 */
export function formatWeekHeader(weekNumber: number, dateRange: DateRange, focus: string): string {
  const start = formatMonthDay(dateRange.start);
  const end = formatMonthDay(dateRange.end);
  
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  // Cross-month check
  if (startDate.getMonth() !== endDate.getMonth()) {
    return `Week ${weekNumber}: ${start} - ${end} - ${focus}`;
  }
  
  // Same month: "Week 1: Jan 20 - 26 - Foundation Week"
  const startParts = start.split(' ');
  return `Week ${weekNumber}: ${start} - ${startParts[1]} - ${focus}`;
}

/**
 * Format month and day: "Jan 20"
 */
export function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Format day header: "Monday, Jan 20"
 */
export function formatDayHeader(dayOfWeek: number, weekStartDate: string): string {
  const date = calculateDateFromDayOfWeek(dayOfWeek, weekStartDate);
  const d = new Date(date);
  const weekday = d.toLocaleString('en-US', { weekday: 'long' });
  return `${weekday}, ${formatMonthDay(date)}`;
}

/**
 * Calculate days since a date
 */
export function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
```

#### **1.2 Update Type Definitions**
**File**: `src/types/fitness.ts`

```typescript
// Add to existing file
export interface DateRange {
  start: string; // ISO date string
  end: string;   // ISO date string
}

// Update Microcycle interface (make dateRange REQUIRED)
export interface Microcycle {
  id: string;
  week: number;
  focus: string;
  value: string;
  workouts: Workout[];
  weeklyCheckIns: WorkoutCheckIns;
  status: 'active' | 'completed';
  completedAt?: string;
  completedWorkouts: CompletedWorkout[];
  weeklyNotes?: string;
  dateRange: DateRange; // REQUIRED (not optional)
}

// Update Workout interface to include date field
export interface Workout {
  // ... existing fields ...
  date?: string; // ISO date string: "2025-01-20"
}

// Add workout history types
export interface WorkoutHistoryDocument {
  weekId: string;
  weekNumber: number;
  weekFocus: string;
  dateRange: DateRange;
  completedWorkouts: CompletedWorkout[];
  weeklyReflection: string;
  completedAt: string; // ISO timestamp
  planSnapshot: {
    macrocycleId: string;
    mesocycleId: string;
    microcycleId: string;
  };
}

// Add gap recovery types
export interface TrainingGap {
  gapId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  activities?: string;
  workouts: CompletedWorkout[];
  resumedAt: string;
}
```

#### **1.3 Create Migration Utilities**
**File**: `src/lib/dateMigration.ts`

```typescript
import { Microcycle, FitnessPlan } from '@/types/fitness';
import { calculateInitialWeekRange } from './dateUtils';

/**
 * Migrate existing plans to include date ranges
 */
export function migratePlanWithDates(plan: FitnessPlan): FitnessPlan {
  // If already has date range, return as-is
  if (plan.currentMicrocycle.dateRange) {
    return plan;
  }
  
  // Calculate date range based on current date
  const dateRange = calculateInitialWeekRange(new Date());
  
  return {
    ...plan,
    currentMicrocycle: {
      ...plan.currentMicrocycle,
      dateRange
    }
  };
}
```

### **Testing Phase 1**
- [ ] Unit tests for all date calculation functions
- [ ] Test cross-month scenarios (Jan-Feb)
- [ ] Test cross-year scenarios (Dec-Jan)
- [ ] Test Mon-Thu vs Fri-Sun logic
- [ ] Test date formatting with various inputs
- [ ] Test migration utilities with existing plans

---

## **PHASE 2: Initial Generation Enhancement** 
*Duration: 2 days | Priority: HIGH*

### **Objective**
Implement timing-based initial plan generation with plan regeneration capability.

### **Tasks**

#### **2.1 Update Firebase Remote Config**
Add new prompts to Firebase Remote Config:
1. `prompts_fitness_plan_generation` (existing, for Mon-Thu)
2. `prompts_fitness_plan_generation_rest_of_the_week` (new, for Fri-Sun)
3. `prompts_fitness_plan_regenerate_with_comment` (new, for regeneration)

**Prompt template structure:**
```json
{
  "system_prompt": "You are a fitness coach...",
  "user_prompt_template": "User Profile:\n{USER_PROFILE}\n\nCurrent Date: {CURRENT_DATE}\n\nWeek Date Range: {WEEK_DATE_RANGE}\n\n{CUSTOM_PROMPT}\n\nGenerate a personalized fitness plan...",
  "version": "1.0"
}
```

#### **2.2 Update Store Generation Logic**
**File**: `src/stores/fitnessPlanStore.ts`

```typescript
// Update generatePlan function
generatePlan: async (customPrompt?: string) => {
  const authStore = useAuthStore.getState();
  const { user } = authStore;
  
  if (!user || !user.onboardingCompleted || !user.profile) {
    set({ error: 'Please complete your profile first' });
    return;
  }

  try {
    set({ generating: true, error: null });

    await fetchAndActivate(remoteConfig);

    // Get API key
    const apiKey = getValue(remoteConfig, 'openai_api_key').asString();
    if (!apiKey) throw new Error('OpenAI API key not configured');

    // CRITICAL: Determine which prompt to use based on day of week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;
    
    const promptKey = isMonToThu 
      ? 'prompts_fitness_plan_generation' 
      : 'prompts_fitness_plan_generation_rest_of_the_week';
    
    const promptValue = getValue(remoteConfig, promptKey);
    const promptString = promptValue.asString();
    
    if (!promptString) {
      throw new Error(`Prompt ${promptKey} not configured in Firebase Remote Config`);
    }

    const promptConfig = JSON.parse(promptString);

    // Calculate week date range (app does this, not AI)
    const weekDateRange = calculateInitialWeekRange(today);

    // Prepare generation request
    const generationRequest: GenerationRequest = {
      userProfile: user.profile,
      customPrompt: customPrompt || '',
      currentDate: today.toISOString(),
      weekDateRange: weekDateRange // NEW: Pass date range to AI
    };

    // Populate user prompt
    const userPrompt = promptConfig.user_prompt_template
      .replace('{USER_PROFILE}', JSON.stringify(generationRequest.userProfile, null, 2))
      .replace('{CUSTOM_PROMPT}', generationRequest.customPrompt)
      .replace('{CURRENT_DATE}', generationRequest.currentDate)
      .replace('{WEEK_DATE_RANGE}', JSON.stringify(weekDateRange, null, 2));

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: promptConfig.system_prompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error('No response from OpenAI');

    // Clean and parse JSON
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const planResponse: FitnessPlanResponse = JSON.parse(cleanContent);
    
    if (!planResponse.plan) {
      throw new Error('Invalid plan response structure');
    }

    // CRITICAL: Assign dates to workouts (AI only returns dayOfWeek)
    const microcycleWithDates = {
      ...planResponse.plan.currentMicrocycle,
      dateRange: weekDateRange,
      workouts: planResponse.plan.currentMicrocycle.workouts.map(workout => ({
        ...workout,
        date: calculateDateFromDayOfWeek(workout.dayOfWeek, weekDateRange.start)
      }))
    };

    const planWithDates = {
      ...planResponse.plan,
      currentMicrocycle: microcycleWithDates,
      status: 'draft' as const // Set as draft, not approved yet
    };

    // Update regeneration count if there's an existing plan
    const currentPlan = get().currentPlan;
    if (currentPlan) {
      planWithDates.generationMetadata.regenerationCount = 
        currentPlan.generationMetadata.regenerationCount + 1;
    }

    // Save to Firestore
    const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
    await setDoc(planDocRef, sanitizeWorkoutForFirebase({
      ...planWithDates,
      updatedAt: serverTimestamp(),
    }));

    set({ currentPlan: planWithDates, generating: false });

  } catch (error) {
    console.error('Generate plan error:', error);
    set({ 
      error: error instanceof Error ? error.message : 'Failed to generate plan',
      generating: false 
    });
  }
},
```

#### **2.3 Create Plan Approval UI**
**File**: `src/components/fitness/PlanApprovalCard.tsx` (NEW)

```typescript
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';

export function PlanApprovalCard() {
  const { currentPlan, generating, approvePlan, generatePlan } = useFitnessPlanStore();
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  if (!currentPlan || currentPlan.status === 'approved') return null;

  const handleRegenerate = async () => {
    if (!comment.trim()) {
      setShowCommentBox(true);
      return;
    }
    await generatePlan(comment);
    setComment('');
    setShowCommentBox(false);
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Review Your Plan</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This plan was generated based on your profile. You can approve it to start training, or request changes.
      </p>
      
      {showCommentBox && (
        <div className="mb-4">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What would you like to change? (e.g., 'More cardio', 'Less volume', 'Add mobility work')"
            className="mb-2"
            rows={3}
          />
        </div>
      )}
      
      <div className="flex gap-3">
        <Button 
          onClick={approvePlan}
          disabled={generating}
          size="lg"
          className="flex-1"
        >
          Approve & Start Training 🚀
        </Button>
        
        {!showCommentBox ? (
          <Button 
            onClick={() => setShowCommentBox(true)}
            disabled={generating}
            variant="outline"
            size="lg"
          >
            Request Changes
          </Button>
        ) : (
          <Button 
            onClick={handleRegenerate}
            disabled={generating || !comment.trim()}
            variant="outline"
            size="lg"
          >
            {generating ? 'Regenerating...' : 'Regenerate Plan'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

### **Testing Phase 2**
- [ ] Test generation on Monday (uses correct prompt)
- [ ] Test generation on Thursday (uses correct prompt)
- [ ] Test generation on Friday (uses extended prompt)
- [ ] Test generation on Sunday (uses extended prompt)
- [ ] Test plan regeneration with comment
- [ ] Verify date ranges are correctly calculated
- [ ] Verify workouts have correct dates
- [ ] Test approval flow

---

## **PHASE 3: Week Display Updates** 
*Duration: 1 day | Priority: HIGH*

### **Objective**
Update UI to show week headers with dates and focus, and day headers with dates.

### **Tasks**

#### **3.1 Update Week Header Component**
**File**: `src/components/fitness/FitnessPlanDisplay.tsx`

```typescript
// Add to imports
import { formatWeekHeader } from '@/lib/dateUtils';

// Update week header rendering
const renderWeekHeader = (microcycle: Microcycle) => {
  const headerText = microcycle.dateRange
    ? formatWeekHeader(microcycle.week, microcycle.dateRange, microcycle.focus)
    : `Week ${microcycle.week} - ${microcycle.focus}`; // Fallback

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">{headerText}</h2>
      {/* Rest of header content */}
    </div>
  );
};
```

#### **3.2 Update Day Headers in Weekly Schedule**
**File**: `src/components/fitness/WeeklyScheduleV2.tsx`

```typescript
// Add to imports
import { formatDayHeader } from '@/lib/dateUtils';

// Update day header rendering
const DayColumn = ({ day, workouts, microcycle }: DayColumnProps) => {
  const dayHeader = microcycle.dateRange
    ? formatDayHeader(day.id, microcycle.dateRange.start)
    : day.name; // Fallback

  return (
    <div className="flex flex-col min-w-[200px]">
      <div className="font-semibold mb-2 text-sm sticky top-0 bg-background z-10 pb-2">
        {dayHeader}
      </div>
      {/* Rest of day column */}
    </div>
  );
};
```

### **Testing Phase 3**
- [ ] Week headers show correct format
- [ ] Cross-month weeks display correctly
- [ ] Day headers show dates
- [ ] Backward compatibility with plans without dateRange
- [ ] Responsive design on mobile

---

## **PHASE 4: Week Completion Button & Logic** 
*Duration: 2 days | Priority: HIGH*

### **Objective**
Add week completion button with proper enabling logic.

### **Tasks**

#### **4.1 Create Week Completion Logic**
**File**: `src/lib/weekCompletionLogic.ts` (NEW)

```typescript
import { Microcycle } from '@/types/fitness';
import { daysSince } from './dateUtils';

export interface WeekCompletionState {
  canComplete: boolean;
  state: 'disabled' | 'ready' | 'overdue' | 'long-gap';
  message: string;
  daysSinceEnd?: number;
}

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

  // Short overdue (1-7 days)
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
      message: `Week ends today! Complete it now to generate your personalized plan`,
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
```

#### **4.2 Create Week Completion Button Component**
**File**: `src/components/fitness/WeekCompletionButton.tsx` (NEW)

```typescript
import { Button } from '@/components/ui/button';
import { Microcycle } from '@/types/fitness';
import { checkWeekCompletionState } from '@/lib/weekCompletionLogic';
import { useEffect, useState } from 'react';

interface WeekCompletionButtonProps {
  microcycle: Microcycle | null;
  onComplete: () => void;
}

export function WeekCompletionButton({ microcycle, onComplete }: WeekCompletionButtonProps) {
  const [state, setState] = useState(checkWeekCompletionState(microcycle));

  // Re-check state every minute (in case day changes)
  useEffect(() => {
    const interval = setInterval(() => {
      setState(checkWeekCompletionState(microcycle));
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [microcycle]);

  // Don't render for long gaps (handled by gap recovery dialog)
  if (state.state === 'long-gap') {
    return null;
  }

  const getButtonVariant = () => {
    switch (state.state) {
      case 'ready': return 'default';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getButtonText = () => {
    switch (state.state) {
      case 'ready': return 'Complete Week & Generate Next 🚀';
      case 'overdue': return 'Complete Overdue Week & Generate Next ⚠️';
      default: return 'Complete Week 🎯';
    }
  };

  const getButtonClassName = () => {
    const baseClass = "w-full py-6 text-lg font-semibold";
    switch (state.state) {
      case 'ready': return `${baseClass} bg-green-600 hover:bg-green-700 animate-pulse`;
      case 'overdue': return `${baseClass} bg-orange-600 hover:bg-orange-700`;
      default: return baseClass;
    }
  };

  return (
    <div className="mb-6">
      <Button
        onClick={onComplete}
        disabled={!state.canComplete}
        variant={getButtonVariant()}
        className={getButtonClassName()}
      >
        {getButtonText()}
      </Button>
      
      <p className={`text-sm mt-2 text-center ${
        state.state === 'ready' ? 'text-green-600 font-semibold' :
        state.state === 'overdue' ? 'text-orange-600 font-semibold' :
        'text-muted-foreground'
      }`}>
        {state.state === 'ready' && '🎯 '}
        {state.state === 'overdue' && '⚠️ '}
        {state.state === 'disabled' && '💡 '}
        {state.message}
      </p>
    </div>
  );
}
```

#### **4.3 Integrate Button into Fitness Plan Page**
**File**: `src/pages/FitnessPlanPage.tsx`

```typescript
// Add import
import { WeekCompletionButton } from '@/components/fitness/WeekCompletionButton';
import { useState } from 'react';

// Add state for dialog
const [showCompletionDialog, setShowCompletionDialog] = useState(false);

// Add button before workout cards
<WeekCompletionButton
  microcycle={currentPlan?.currentMicrocycle || null}
  onComplete={() => setShowCompletionDialog(true)}
/>
```

### **Testing Phase 4**
- [ ] Button shows correct state (disabled) on day 1-6
- [ ] Button enables on last day
- [ ] Button shows overdue state 1-7 days after
- [ ] Button hides for long gaps (8+ days)
- [ ] Message updates correctly
- [ ] Button re-checks state periodically

---

## **PHASE 5: Week Completion Dialog** 
*Duration: 3 days | Priority: HIGH* | **STATUS: ✅ COMPLETED**

### **Implementation Status**
**Completed:** Week completion dialog with progress summary, completed workouts list, weekly reflection, and completion action. Week is marked as complete and saved to Firebase. Button properly disappears after completion.

**Deferred to Phase 7:** Next week generation (stubbed out for now). Dialog shows "(Next week generation will be available in Phase 7)" message.

### **Objective**
Build complete week completion dialog with progress, workout list, editing, and reflection.

### **Tasks**

#### **5.1 Create Completion Dialog Component**
**File**: `src/components/fitness/WeekCompletionDialog.tsx` (NEW)

This is a large component - implement it with all sections from the spec:
- Dialog header with week info
- Progress summary
- Completed/uncompleted workout list
- Inline workout editing capability
- Weekly reflection text area
- Action buttons (Cancel, Complete & Generate)

**Key features:**
```typescript
interface WeekCompletionDialogProps {
  microcycle: Microcycle;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (weeklyReflection: string) => Promise<void>;
}

export function WeekCompletionDialog(props: WeekCompletionDialogProps) {
  const [weeklyReflection, setWeeklyReflection] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Calculate progress
  const completedCount = microcycle.workouts.filter(w => w.status === 'completed').length;
  const totalCount = microcycle.workouts.length;
  const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  const handleComplete = async () => {
    setIsGenerating(true);
    try {
      await onComplete(weeklyReflection);
      onClose();
    } catch (error) {
      // Handle error
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Implementation */}
    </Dialog>
  );
}
```

### **Testing Phase 5**
- [x] Dialog displays correct progress (completion rate, stats)
- [x] Shows all completed workouts with details
- [x] Shows "No workouts completed" warning when 0% completion
- [x] Allows completion with 0% rate (per UX spec)
- [x] Weekly reflection textarea works
- [x] Loading state during completion
- [x] Cancel button closes dialog
- [x] Complete button marks week as complete and saves to Firebase
- [x] No Firebase undefined value errors (sanitization works)
- [x] No React setState warnings (startTransition used)
- [x] Button disappears after completion (expected behavior)
- [ ] **DEFERRED TO PHASE 7:** Next week generation with proper prompt

---

## **PHASE 6: Workout History Persistence** 
*Duration: 2 days | Priority: HIGH*

### **Objective**
Save completed workouts to Firebase workout history collection.

### **Tasks**

#### **6.1 Create Workout History Service**
**File**: `src/lib/workoutHistoryService.ts` (NEW)

```typescript
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { Microcycle, CompletedWorkout, WorkoutHistoryDocument } from '@/types/fitness';

export async function saveWorkoutHistory(
  userId: string,
  microcycle: Microcycle,
  weeklyReflection: string,
  planSnapshot: { macrocycleId: string; mesocycleId: string; microcycleId: string }
): Promise<void> {
  const weekId = `${microcycle.dateRange.start}_week-${microcycle.week}`;
  const historyDocRef = doc(db, 'users', userId, 'workoutHistory', weekId);
  
  const historyDoc: WorkoutHistoryDocument = {
    weekId,
    weekNumber: microcycle.week,
    weekFocus: microcycle.focus,
    dateRange: microcycle.dateRange,
    completedWorkouts: microcycle.workouts
      .filter(w => w.status === 'completed')
      .map(w => ({
        workoutId: w.id,
        name: w.name,
        date: w.date || '',
        exercises: w.exercises.map(e => ({
          exerciseId: e.id,
          name: e.name,
          sets: e.sets.map(s => ({
            reps: s.reps,
            weight: s.weight,
            duration: s.duration,
            notes: s.notes,
            completed: s.completed || false
          }))
        })),
        duration: w.actualDuration,
        notes: w.notes,
        completed: true
      })),
    weeklyReflection,
    completedAt: new Date().toISOString(),
    planSnapshot
  };
  
  await setDoc(historyDocRef, historyDoc);
}

export async function getWorkoutHistory(
  userId: string,
  options?: { limit?: number; startAfter?: string }
): Promise<WorkoutHistoryDocument[]> {
  const historyCollectionRef = collection(db, 'users', userId, 'workoutHistory');
  
  let q = query(historyCollectionRef, orderBy('completedAt', 'desc'));
  
  if (options?.limit) {
    q = query(q, limit(options.limit));
  }
  
  if (options?.startAfter) {
    q = query(q, where('completedAt', '>', options.startAfter));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as WorkoutHistoryDocument);
}
```

#### **6.2 Update Store to Save History**
**File**: `src/stores/fitnessPlanStore.ts`

```typescript
// Update completeMicrocycle function
completeMicrocycle: async (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => {
  const { currentPlan, mutationState } = get();
  const authStore = useAuthStore.getState();
  const { user } = authStore;
  
  if (!user || !currentPlan) return;

  try {
    // Generate mutation for tracking
    addPendingMutation(mutationState, {
      type: 'microcycle_completion',
      data: { completedWorkouts, weeklyNotes }
    });

    // 1. IMMEDIATE: Update local state optimistically
    const updatedMicrocycle = {
      ...currentPlan.currentMicrocycle,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      completedWorkouts,
      weeklyNotes,
    };

    const updatedPlan = {
      ...currentPlan,
      currentMicrocycle: updatedMicrocycle,
    };

    set({ currentPlan: updatedPlan });

    // 2. ASYNC: Save to workout history
    await saveWorkoutHistory(
      user.uid,
      updatedMicrocycle,
      weeklyNotes,
      {
        macrocycleId: currentPlan.macrocycle.id,
        mesocycleId: currentPlan.currentMicrocycle.id, // Assuming mesocycle ID
        microcycleId: updatedMicrocycle.id
      }
    );

    // 3. Generate next microcycle
    await get().generateNextMicrocycle(completedWorkouts, weeklyNotes);

  } catch (error) {
    console.error('Failed to complete microcycle:', error);
    set({ 
      error: error instanceof Error ? error.message : 'Failed to complete microcycle'
    });
  }
},
```

### **Testing Phase 6**
- [ ] Workout history saved correctly
- [ ] All completed workouts included
- [ ] Weekly reflection saved
- [ ] Date ranges correct
- [ ] Plan snapshot saved
- [ ] History retrieval works
- [ ] Handles errors gracefully

---

## **PHASE 7: Next Week Generation with History** 
*Duration: 2 days | Priority: HIGH* | **STATUS: ✅ COMPLETED**

### **Implementation Status**
**Completed:** Full next week generation with workout history context, proper date calculation, AI prompt population, and plan approval flow. Happy path (initial plan → complete week → generate next week → repeat) is now fully functional.

**Key Features Implemented:**
1. ✅ `calculateNextWeekRange()` utility in `dateUtils.ts` - calculates proper 7-day forward progression
2. ✅ Complete rewrite of `generateNextMicrocycle()` with proper prompt fetching from Firebase Remote Config
3. ✅ Workout history retrieval (last 8 weeks) integrated into generation
4. ✅ Prompt template population with full context (profile, history, performance, reflection)
5. ✅ Markdown code block stripping (handles AI responses wrapped in ```json)
6. ✅ Date assignment to generated workouts
7. ✅ Plan status set to 'draft' requiring approval
8. ✅ UI updated with proper button text and loading states

**Testing Results:**
- Week 1 → Week 2 generation: ✅ Success
- Week 2 → Week 3 generation: ✅ Success
- Workout history accumulation: ✅ Working (1 week, then 2 weeks)
- Date progression: ✅ Correct (Oct 2-8 → Oct 9-15 → Oct 16-22)
- AI context: ✅ Includes performance, reflection, and history

### **Objective**
Generate next week using workout history context.

### **Tasks**

#### **7.1 Update Firebase Remote Config**
Add `prompts_fitness_plan_generate_next_microcycle` prompt with placeholders for:
- `{USER_PROFILE}`
- `{CURRENT_DATE}`
- `{NEXT_WEEK_DATE_RANGE}`
- `{MACROCYCLE}`
- `{MESOCYCLE}`
- `{PREVIOUS_MICROCYCLE_PLANNED}`
- `{PREVIOUS_MICROCYCLE_ACTUAL}`
- `{WEEKLY_REFLECTION}`
- `{WORKOUT_HISTORY}` (last 8 weeks)

#### **7.2 Update Store Generation Logic**
**File**: `src/stores/fitnessPlanStore.ts`

```typescript
generateNextMicrocycle: async (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => {
  const { currentPlan } = get();
  const authStore = useAuthStore.getState();
  const { user } = authStore;
  
  if (!user || !currentPlan) return;

  try {
    set({ generating: true, error: null });

    // Fetch workout history (last 8 weeks)
    const workoutHistory = await getWorkoutHistory(user.uid, { limit: 8 });

    // Get Firebase Remote Config
    await fetchAndActivate(remoteConfig);
    
    const apiKey = getValue(remoteConfig, 'openai_api_key').asString();
    const promptValue = getValue(remoteConfig, 'prompts_fitness_plan_generate_next_microcycle');
    const promptString = promptValue.asString();

    if (!apiKey || !promptString) {
      throw new Error('OpenAI API key or prompt not configured');
    }

    const promptConfig = JSON.parse(promptString);

    // Calculate next week date range
    const nextWeekDateRange = calculateNextWeekRange(currentPlan.currentMicrocycle.dateRange);

    // Prepare context
    const previousMicrocyclePlanned = {
      week: currentPlan.currentMicrocycle.week,
      focus: currentPlan.currentMicrocycle.focus,
      dateRange: currentPlan.currentMicrocycle.dateRange,
      workouts: currentPlan.currentMicrocycle.workouts
    };

    const previousMicrocycleActual = completedWorkouts;

    // Populate prompt
    const userPrompt = promptConfig.user_prompt_template
      .replace('{USER_PROFILE}', JSON.stringify(user.profile, null, 2))
      .replace('{CURRENT_DATE}', new Date().toISOString())
      .replace('{NEXT_WEEK_DATE_RANGE}', JSON.stringify(nextWeekDateRange, null, 2))
      .replace('{MACROCYCLE}', JSON.stringify(currentPlan.macrocycle, null, 2))
      .replace('{MESOCYCLE}', JSON.stringify(currentPlan.macrocycle.mesocycles[0], null, 2)) // Simplify
      .replace('{PREVIOUS_MICROCYCLE_PLANNED}', JSON.stringify(previousMicrocyclePlanned, null, 2))
      .replace('{PREVIOUS_MICROCYCLE_ACTUAL}', JSON.stringify(previousMicrocycleActual, null, 2))
      .replace('{WEEKLY_REFLECTION}', weeklyNotes)
      .replace('{WORKOUT_HISTORY}', JSON.stringify(workoutHistory, null, 2));

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: promptConfig.system_prompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error('No content from OpenAI');

    // Parse response
    const cleanContent = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const aiResponse = JSON.parse(cleanContent);

    // CRITICAL: Assign dates (AI only returns dayOfWeek)
    const nextMicrocycle = {
      ...aiResponse.microcycle,
      dateRange: nextWeekDateRange,
      status: 'active' as const,
      completedWorkouts: [],
      workouts: aiResponse.microcycle.workouts.map(w => ({
        ...w,
        date: calculateDateFromDayOfWeek(w.dayOfWeek, nextWeekDateRange.start)
      }))
    };

    // Update plan
    const updatedPlan = {
      ...currentPlan,
      currentMicrocycle: nextMicrocycle
    };

    set({ currentPlan: updatedPlan, generating: false });

    // Save to Firebase
    const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
    await setDoc(planDocRef, sanitizeWorkoutForFirebase({
      ...updatedPlan,
      updatedAt: serverTimestamp()
    }));

  } catch (error) {
    console.error('Failed to generate next microcycle:', error);
    set({ 
      generating: false,
      error: error instanceof Error ? error.message : 'Failed to generate next microcycle'
    });
  }
},
```

### **Testing Phase 7**
- [ ] Next week generation includes workout history
- [ ] Correct prompt used
- [ ] Date range calculated correctly
- [ ] Workouts assigned correct dates
- [ ] UI updates with new week
- [ ] Real-time sync works

---

## **PHASE 8: Gap Recovery Flow (CRITICAL)** 
*Duration: 3-4 days | Priority: CRITICAL* | **STATUS: ✅ COMPLETED + ENHANCED**

### **Implementation Status**
**Completed:** Full-page gap recovery experience with automatic navigation, advanced workout management, proper profile editing component reuse, and fresh plan generation.

**Key Features Implemented:**
1. ✅ `GapRecoveryPage` - Full-page dedicated gap recovery experience (not a popup)
2. ✅ `useGapDetection` hook - Automatic detection and navigation to `/app/gap-recovery`
3. ✅ **Enhanced Workout Management**:
   - Shows completed workouts from last microcycle as compact cards
   - Add single workout button (opens `WorkoutExecutionMode`)
   - Add multiple workouts via bulk text entry
   - Edit workouts by clicking cards (opens editor)
   - Delete workouts from list
   - Workouts sorted by date (oldest first)
   - All workouts automatically marked as complete (no checkboxes)
4. ✅ **Proper Profile Editing (Component Reuse)**:
   - Uses `CollapsibleChoiceField` for single/multiple choice (same as ProfilePage)
   - Shows selected values with "Edit" button (not expanded)
   - Uses `FormField` for other field types
   - Real-time editing with validation
   - Must save changes before generating plan
5. ✅ **Workout Editor Integration**:
   - `WorkoutExecutionMode` with `isGapRecovery={true}` prop
   - Hides all checkboxes (exercise-level and set-level)
   - Hides progress bar and completion UI
   - Supports both UI and Text editing modes
   - All exercises automatically considered complete
6. ✅ **Bulk Text Entry**:
   - `gapWorkoutParser.ts` - Parses workout text with dates
   - Format: `# Workout Name dd-mm-yyyy`
   - Supports 3 date formats (dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy)
   - Reuses existing `ComprehensiveWorkoutParser` for exercises
7. ✅ **Compact Workout Display**:
   - `GapWorkoutCard.tsx` - Shows name + date + exercise count
   - Click to edit, trash icon to delete
   - No completion badges or progress indicators
8. ✅ `generateGapRecoveryPlan()` in store - Full gap recovery generation logic
9. ✅ Gap record persistence to Firebase `trainingGaps` collection
10. ✅ Smart prompt selection (Mon-Thu vs Fri-Sun logic)
11. ✅ Workout history context (up to 6 months)
12. ✅ Auto-approval of recovery plans
13. ✅ Navigation: Redirects to fitness plan page after successful generation
14. ✅ Dependencies installed (date-fns for "X days ago" formatting)

**Component Architecture:**
- **Replaced**: `GapRecoveryDialog` (small popup) → `GapRecoveryPage` (full-page)
- **Reused**: `CollapsibleChoiceField`, `FormField` from ProfilePage
- **Enhanced**: `WorkoutExecutionMode`, `WorkoutExecutionUI`, `WorkoutExecutionText`, `ExerciseExecutionCard` with `isGapRecovery` mode
- **Created**: `GapWorkoutCard`, `gapWorkoutParser`

**Files Modified:**
- `src/pages/GapRecoveryPage.tsx` - Complete rebuild with proper component reuse
- `src/hooks/useGapDetection.ts` - Navigation instead of dialog
- `src/components/fitness/WorkoutExecutionMode.tsx` - Added `isGapRecovery` prop
- `src/components/fitness/WorkoutExecutionUI.tsx` - Pass through `isGapRecovery`
- `src/components/fitness/WorkoutExecutionText.tsx` - Conditional labels
- `src/components/fitness/ExerciseExecutionCard.tsx` - Hide checkboxes when `isGapRecovery={true}`

**Files Created:**
- `src/components/fitness/GapWorkoutCard.tsx` - Compact workout display
- `src/lib/gapWorkoutParser.ts` - Parse bulk workout text with dates
- `PHASE_8_ENHANCEMENTS.md` - Enhancement specification
- `PHASE_8_TESTING_INSTRUCTIONS.md` - Comprehensive testing guide

**Testing Instructions:**
See `PHASE_8_TESTING_INSTRUCTIONS.md` for comprehensive 11-step testing guide covering:
- Profile editing (collapsed choice fields with dialog)
- Single workout add/edit/delete
- Bulk text entry with 3 date formats
- Workout editor (no checkboxes mode)
- Plan generation with gap context
- Firebase gap record verification

### **Objective**
Implement complete gap recovery dialog for 8+ day pauses.

### **Tasks**

#### **8.1 Create Gap Detection Hook**
**File**: `src/hooks/useGapDetection.ts` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { useFitnessPlanStore } from '@/stores/fitnessPlanStore';
import { checkWeekCompletionState } from '@/lib/weekCompletionLogic';

export function useGapDetection() {
  const { currentPlan } = useFitnessPlanStore();
  const [showGapDialog, setShowGapDialog] = useState(false);

  useEffect(() => {
    if (!currentPlan || currentPlan.status !== 'approved') {
      setShowGapDialog(false);
      return;
    }

    const state = checkWeekCompletionState(currentPlan.currentMicrocycle);
    
    if (state.state === 'long-gap') {
      setShowGapDialog(true);
    }
  }, [currentPlan]);

  return { showGapDialog, setShowGapDialog };
}
```

#### **8.2 Create Gap Recovery Dialog**
**File**: `src/components/fitness/GapRecoveryDialog.tsx` (NEW)

This is a complex component that needs:
- Last active info display
- Gap activities text area
- Workout list with editing
- Profile review with editing
- Generate Fresh Plan button

```typescript
interface GapRecoveryDialogProps {
  isOpen: boolean;
  onClose: (generated: boolean) => void;
  microcycle: Microcycle;
}

export function GapRecoveryDialog(props: GapRecoveryDialogProps) {
  const [gapActivities, setGapActivities] = useState('');
  const [addedWorkouts, setAddedWorkouts] = useState<CompletedWorkout[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleGenerateFreshPlan = async () => {
    setIsGenerating(true);
    try {
      // Call gap recovery generation
      await generateGapRecoveryPlan(gapActivities, addedWorkouts);
      onClose(true);
    } catch (error) {
      // Handle error
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose(false)}>
      {/* Full implementation as per spec */}
    </Dialog>
  );
}
```

#### **8.3 Create Gap Recovery Generation**
**File**: `src/stores/fitnessPlanStore.ts`

Add new function:
```typescript
generateGapRecoveryPlan: async (gapActivities: string, gapWorkouts: CompletedWorkout[]) => {
  // Similar to generatePlan but:
  // - Uses 'prompts_fitness_plan' (general plan, not next microcycle)
  // - Includes gap context
  // - Fetches ALL workout history (last 6 months)
  // - Creates fresh plan (new macrocycle/mesocycle/microcycle)
  // - Auto-approves plan
  // - Optionally saves gap record
}
```

#### **8.4 Integrate Gap Dialog into App**
**File**: `src/pages/FitnessPlanPage.tsx` or `src/App.tsx`

```typescript
const { showGapDialog, setShowGapDialog } = useGapDetection();

// Render gap dialog (full-screen, cannot dismiss without action)
{showGapDialog && (
  <GapRecoveryDialog
    isOpen={showGapDialog}
    onClose={(generated) => {
      if (generated) {
        setShowGapDialog(false);
      }
      // Don't allow closing without generating
    }}
    microcycle={currentPlan.currentMicrocycle}
  />
)}
```

### **Testing Phase 8**
- [ ] Gap dialog triggers at 8+ days
- [ ] Last active info shows correctly
- [ ] Gap activities can be entered
- [ ] Workouts can be added/edited
- [ ] Profile can be reviewed/edited
- [ ] Fresh plan generation works
- [ ] Plan starts from correct date
- [ ] Cannot dismiss without generating
- [ ] Gap record saved (if implemented)

---

## **PHASE 8.1: Auto-Approve All Plans (UX Simplification)** 
*Duration: 1 hour | Priority: HIGH* | **STATUS: ✅ COMPLETED**

### **Objective**
Remove plan approval friction by auto-approving all generated plans. Users can still regenerate with comments if they want changes.

### **Implementation**
**Changed:** All plan generation now sets `status: 'approved'` instead of `'draft'`

**Files Modified:**
- `src/stores/fitnessPlanStore.ts`:
  - `generatePlan()` - Line 213: Auto-approve initial plans
  - `generateNextMicrocycle()` - Line 874: Auto-approve next week plans  
  - `generateGapRecoveryPlan()` - Already auto-approved

**UI Impact:**
- ❌ **Removed**: Plan approval card/dialog
- ❌ **Removed**: "Approve Plan" button
- ❌ **Removed**: Draft status badge
- ✅ **Kept**: "Regenerate Plan" button for making changes
- ✅ **Kept**: Comment system for regeneration feedback

### **Benefits**
- ✅ Faster onboarding (one less step)
- ✅ Smoother week transitions (no approval delay)
- ✅ Reduced friction in gap recovery
- ✅ Users still have full control via regeneration

### **Testing**
- [x] Initial plan generation: Plan status = 'approved'
- [x] Next week generation: Plan status = 'approved'
- [x] Gap recovery: Plan status = 'approved'
- [x] Regeneration still works
- [x] No approval UI shown

---

## **PHASE 9: Progress Page Implementation** 
*Duration: 2-3 days | Priority: MEDIUM*

### **Objective**
Replace placeholder progress page with functional workout history display.

### **Tasks**

#### **9.1 Create Progress Page Components**
**Files**:
- `src/components/progress/WorkoutHistoryTimeline.tsx`
- `src/components/progress/VolumeStatsChart.tsx`
- `src/components/progress/ProgressTrends.tsx`

#### **9.2 Update Progress Page**
**File**: `src/pages/ProgressPage.tsx`

Implement:
- Fetch and display workout history
- Volume statistics by exercise type and muscle group
- Progress trends over time
- Filtering and sorting capabilities

### **Testing Phase 9**
- [ ] Historical workouts display correctly
- [ ] Volume stats calculate accurately
- [ ] Charts render properly
- [ ] Filtering works
- [ ] Responsive design
- [ ] Performance with large datasets

---

## **PHASE 10: Integration & End-to-End Testing** 
*Duration: 2-3 days | Priority: HIGH*

### **Objective**
Ensure all components work together seamlessly.

### **Tasks**

#### **10.1 Complete User Journey Testing**
Test entire flows:
1. New user → Onboarding → Initial generation → Approval → Training → Week completion → Next week
2. User with gap → Gap recovery → Fresh plan
3. User regenerates plan with comments

#### **10.2 Multi-Device Sync Testing**
- [ ] Test week completion on device A, see update on device B
- [ ] Test workout status changes sync
- [ ] Test plan regeneration sync

#### **10.3 Edge Case Testing**
- [ ] Test all date edge cases (month/year boundaries)
- [ ] Test with 0% completion
- [ ] Test with 100% completion
- [ ] Test very long gaps (6+ months)
- [ ] Test rapid button clicks (prevent double submission)

#### **10.4 Update Testing Utilities**
**File**: `src/pages/TestingPage.tsx`

Add tools to:
- Manipulate microcycle end dates (for testing button states)
- Generate test workout history
- Trigger gap recovery manually
- Inspect Firebase data

### **Testing Phase 10**
- [ ] All E2E flows complete successfully
- [ ] Multi-device sync works
- [ ] All edge cases handled
- [ ] Testing utilities work
- [ ] Performance acceptable
- [ ] No console errors

---

## **PHASE 11: Documentation & Deployment** 
*Duration: 1 day | Priority: HIGH*

### **Objective**
Update documentation and prepare for deployment.

### **Tasks**

#### **11.1 Update .cursorrules**
Add all new features to Feature Registry:
- Initial generation with timing logic
- Week completion flow
- Gap recovery flow
- Workout history persistence
- Progress page
- Multiple prompts

#### **11.2 Update Firebase Remote Config**
Ensure all prompts are configured:
- `prompts_fitness_plan_generation`
- `prompts_fitness_plan_generation_rest_of_the_week`
- `prompts_fitness_plan_regenerate_with_comment`
- `prompts_fitness_plan_generate_next_microcycle`
- `prompts_fitness_plan`

#### **11.3 Create Deployment Checklist**
- [ ] All tests passing
- [ ] Firebase Remote Config updated
- [ ] Firebase Security Rules updated (for workoutHistory collection)
- [ ] Documentation updated
- [ ] Testing utilities available
- [ ] Performance benchmarks met

### **Deployment**
- Deploy to staging
- QA testing
- Deploy to production
- Monitor for issues

---

## ⚠️ **RISK MITIGATION**

### **Backward Compatibility**
- All existing plans without `dateRange` will be migrated on load
- Migration utilities handle edge cases
- No data loss during migration

### **Performance**
- Workout history limited to last 8 weeks for generation
- Progress page uses pagination
- Real-time sync uses existing mutation tracking

### **Error Handling**
- All AI generation failures have retry capability
- Network errors don't lose user input (dialog state persists)
- Corrupted data triggers regeneration flow

---

## 📊 **SUCCESS METRICS**

### **Technical**
- [ ] All unit tests passing (100%)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Page load times < 2s
- [ ] API response times < 500ms
- [ ] Real-time sync latency < 1s
- [ ] Zero data loss incidents

### **User Experience**
- [ ] Week completion flow completion rate > 90%
- [ ] Gap recovery flow completion rate > 85%
- [ ] Error rate < 1%
- [ ] Plan regeneration success rate > 95%

---

## 🎯 **CRITICAL PATH**

**Must-have for MVP:**
1. ✅ Phase 1: Date infrastructure
2. ✅ Phase 2: Initial generation with timing
3. ✅ Phase 3: Week display updates
4. ✅ Phase 4: Week completion button
5. ✅ Phase 5: Week completion dialog
6. ✅ Phase 6: Workout history persistence
7. ✅ Phase 7: Next week generation with history
8. ✅ Phase 8: Gap recovery flow (READY FOR TESTING)

**Can be deferred:**
- Phase 9: Progress page (can use basic version)
- Advanced analytics
- Additional testing utilities

**Total Estimated Time: 20-25 days** (3-4 weeks)
