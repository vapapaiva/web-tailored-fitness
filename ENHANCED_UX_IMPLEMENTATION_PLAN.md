# Enhanced UX Implementation Plan

**Goal**: Decouple workout tracking from AI fitness planning, making the app valuable as a standalone workout tracker with optional AI coaching.

**Reference Document**: `enhanced_complete_app_UX_loop.md`

---

## 🎯 Implementation Overview

### Phases
1. **Phase A**: Core Workout Tracking (Workouts Page) - **HIGHEST PRIORITY**
2. **Phase B**: AI Coach - Goals Generation - **MEDIUM PRIORITY**
3. **Phase C**: AI Coach - Workout Generation & Week Completion - **MEDIUM PRIORITY**
4. **Phase D**: Data Migration for Existing Users - **MEDIUM PRIORITY**
5. **Phase E**: Polish, Enhancement & Optimization - **LOWER PRIORITY**

### Estimated Timeline
- **Phase A**: 3-5 days (critical path)
- **Phase B**: 2-3 days
- **Phase C**: 2-3 days
- **Phase D**: 1-2 days
- **Phase E**: 2-3 days
- **Total**: ~10-16 days

---

## 📦 Phase A: Core Workout Tracking (Workouts Page)

**Goal**: Build standalone workout tracking system that works completely independently from AI Coach.

### Step A1: Data Structure & Store Setup

#### A1.1: Define New Types
**File**: `src/types/workout.ts` (new file)

```typescript
/**
 * Workout document structure (independent from AI plan)
 */
export interface WorkoutDocument {
  id: string;
  name: string;
  date?: string; // ISO date string or undefined
  status: 'planned' | 'in-progress' | 'completed';
  completedAt?: string; // ISO timestamp
  exercises: Exercise[]; // Reuse from existing fitness.ts
  actualDuration?: number;
  estimatedDuration?: number;
  notes?: string;
  source: 'manual' | 'ai-coach'; // Track origin
  aiCoachContext?: {
    microcycleId: string;
    weekNumber: number;
  };
  // Existing workout fields
  type: string;
  focus: string;
  value: string;
  checkIns: WorkoutCheckIns;
  rank: string; // For ordering within days
  createdAt: string;
  updatedAt: string;
}

/**
 * Stats aggregation types
 */
export interface WorkoutStats {
  totalWorkouts: number;
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number; // weight * reps
  totalTime: number; // minutes
  exerciseTypeBreakdown: Record<string, number>;
  muscleGroupBreakdown: Record<string, number>;
  weeklyBreakdown: Array<{
    weekStart: string;
    workouts: number;
    completionRate: number;
  }>;
}

/**
 * Exercise progress tracking
 */
export interface ExerciseProgress {
  exerciseName: string;
  dataPoints: Array<{
    date: string;
    volume: number;
    maxWeight?: number;
    totalReps: number;
  }>;
}
```

#### A1.2: Create Workouts Store
**File**: `src/stores/workoutsStore.ts` (new file)

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from './authStore';
import type { WorkoutDocument, WorkoutStats, ExerciseProgress } from '@/types/workout';
import { sanitizeWorkoutForFirebase } from '@/lib/firebaseUtils';

interface WorkoutsState {
  workouts: WorkoutDocument[];
  loading: boolean;
  error: string | null;
  realtimeUnsubscribe: (() => void) | null;
  
  // Actions
  loadWorkouts: () => Promise<void>;
  addWorkout: (workout: Partial<WorkoutDocument>) => Promise<string>; // Returns workout ID
  updateWorkout: (id: string, updates: Partial<WorkoutDocument>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  markAsComplete: (id: string, completedAt?: string) => Promise<void>;
  markAsIncomplete: (id: string) => Promise<void>;
  
  // Realtime sync
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  
  // Computed/Filtered getters
  getPlannedWorkouts: () => WorkoutDocument[];
  getCompletedWorkouts: () => WorkoutDocument[];
  getPastWorkouts: () => WorkoutDocument[];
  getCurrentWeekWorkouts: () => WorkoutDocument[];
  getLaterWorkouts: () => WorkoutDocument[];
  getWithoutDateWorkouts: () => WorkoutDocument[];
  
  // Stats
  getWorkoutStats: () => WorkoutStats;
  getExerciseProgress: (exerciseName: string) => ExerciseProgress;
  
  clearError: () => void;
}

export const useWorkoutsStore = create<WorkoutsState>()(
  subscribeWithSelector((set, get) => ({
    workouts: [],
    loading: false,
    error: null,
    realtimeUnsubscribe: null,

    loadWorkouts: async () => {
      // Implementation
    },

    addWorkout: async (workout) => {
      // Implementation
    },

    updateWorkout: async (id, updates) => {
      // Implementation with optimistic updates
    },

    deleteWorkout: async (id) => {
      // Implementation
    },

    markAsComplete: async (id, completedAt) => {
      // Implementation
    },

    markAsIncomplete: async (id) => {
      // Implementation
    },

    startRealtimeSync: () => {
      // Implementation (reuse pattern from fitnessPlanStore)
    },

    stopRealtimeSync: () => {
      // Implementation
    },

    getPlannedWorkouts: () => {
      // Filter logic
    },

    getCompletedWorkouts: () => {
      // Filter logic (status === 'completed')
    },

    getPastWorkouts: () => {
      // Workouts with date < today && status !== 'completed'
    },

    getCurrentWeekWorkouts: () => {
      // Workouts with date in current week (Mon-Sun)
    },

    getLaterWorkouts: () => {
      // Workouts with date > current week end
    },

    getWithoutDateWorkouts: () => {
      // Workouts without date
    },

    getWorkoutStats: () => {
      // Calculate and return stats
    },

    getExerciseProgress: (exerciseName) => {
      // Calculate progress for specific exercise
    },

    clearError: () => set({ error: null }),
  }))
);
```

**Tasks**:
- [ ] Create `src/types/workout.ts` with all workout types
- [ ] Create `src/stores/workoutsStore.ts` with full implementation
- [ ] Add Firebase collection path: `users/{userId}/workouts/{workoutId}`
- [ ] Implement real-time sync using `onSnapshot`
- [ ] Implement optimistic updates pattern (same as fitnessPlanStore)
- [ ] Add comprehensive error handling
- [ ] Test store actions in isolation

---

### Step A2: Build WorkoutsPage Layout

#### A2.1: Main Page Component
**File**: `src/pages/WorkoutsPage.tsx` (new file)

```typescript
import { useEffect, useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlannedSection } from '@/components/workouts/PlannedSection';
import { DoneSection } from '@/components/workouts/DoneSection';
import { AddWorkoutDialog } from '@/components/workouts/AddWorkoutDialog';
import { Plus, Loader2 } from 'lucide-react';

export function WorkoutsPage() {
  const { 
    loadWorkouts, 
    startRealtimeSync, 
    stopRealtimeSync, 
    loading 
  } = useWorkoutsStore();
  
  const [showAddWorkout, setShowAddWorkout] = useState(false);

  useEffect(() => {
    loadWorkouts();
    startRealtimeSync();
    
    return () => {
      stopRealtimeSync();
    };
  }, [loadWorkouts, startRealtimeSync, stopRealtimeSync]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your workouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workouts</h1>
            <p className="text-muted-foreground">
              Track and plan your workouts
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Planned Section */}
          <PlannedSection onAddWorkout={() => setShowAddWorkout(true)} />

          {/* Done Section */}
          <DoneSection />
        </div>

        {/* Add Workout Dialog */}
        <AddWorkoutDialog
          isOpen={showAddWorkout}
          onClose={() => setShowAddWorkout(false)}
        />
      </div>
    </div>
  );
}
```

**Tasks**:
- [ ] Create `src/pages/WorkoutsPage.tsx`
- [ ] Add to routing in `App.tsx`
- [ ] Update navigation in `AppLayout.tsx`
- [ ] Test page loading and real-time sync

---

### Step A3: Build Planned Section Components

#### A3.1: Planned Section Main Component
**File**: `src/components/workouts/PlannedSection.tsx` (new file)

```typescript
import { useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PastWorkouts } from './PastWorkouts';
import { CurrentWeekWorkouts } from './CurrentWeekWorkouts';
import { LaterWorkouts } from './LaterWorkouts';
import { WithoutDateWorkouts } from './WithoutDateWorkouts';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface PlannedSectionProps {
  onAddWorkout: () => void;
}

export function PlannedSection({ onAddWorkout }: PlannedSectionProps) {
  const { 
    getPastWorkouts, 
    getCurrentWeekWorkouts, 
    getLaterWorkouts, 
    getWithoutDateWorkouts 
  } = useWorkoutsStore();

  const [isPastOpen, setIsPastOpen] = useState(false);
  const [isLaterOpen, setIsLaterOpen] = useState(false);
  const [isWithoutDateOpen, setIsWithoutDateOpen] = useState(false);

  const pastWorkouts = getPastWorkouts();
  const currentWeekWorkouts = getCurrentWeekWorkouts();
  const laterWorkouts = getLaterWorkouts();
  const withoutDateWorkouts = getWithoutDateWorkouts();

  const hasAnyWorkouts = 
    pastWorkouts.length > 0 || 
    currentWeekWorkouts.length > 0 || 
    laterWorkouts.length > 0 || 
    withoutDateWorkouts.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Planned</CardTitle>
          <Button onClick={onAddWorkout} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Workout
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnyWorkouts && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No workouts planned yet</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={onAddWorkout}>
                Add Workout
              </Button>
              <Button variant="outline" onClick={() => {/* Navigate to AI Coach */}}>
                Use AI Coach
              </Button>
            </div>
          </div>
        )}

        {hasAnyWorkouts && (
          <>
            {/* Past (Collapsible) */}
            {pastWorkouts.length > 0 && (
              <Collapsible open={isPastOpen} onOpenChange={setIsPastOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Past ({pastWorkouts.length})</span>
                    {isPastOpen ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <PastWorkouts workouts={pastWorkouts} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Current Week (Always Expanded) */}
            <div>
              <h3 className="font-medium mb-2">Current Week</h3>
              <CurrentWeekWorkouts workouts={currentWeekWorkouts} />
            </div>

            {/* Later (Collapsible) */}
            {laterWorkouts.length > 0 && (
              <Collapsible open={isLaterOpen} onOpenChange={setIsLaterOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Later ({laterWorkouts.length})</span>
                    {isLaterOpen ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <LaterWorkouts workouts={laterWorkouts} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Without Date (Collapsible) */}
            {withoutDateWorkouts.length > 0 && (
              <Collapsible open={isWithoutDateOpen} onOpenChange={setIsWithoutDateOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Without Date ({withoutDateWorkouts.length})</span>
                    {isWithoutDateOpen ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <WithoutDateWorkouts workouts={withoutDateWorkouts} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

#### A3.2: Sub-Components for Each Subsection

**Files to Create**:
1. `src/components/workouts/PastWorkouts.tsx` - List view with date cards
2. `src/components/workouts/CurrentWeekWorkouts.tsx` - Weekly calendar view (reuse WeeklyScheduleV2)
3. `src/components/workouts/LaterWorkouts.tsx` - List view with date cards
4. `src/components/workouts/WithoutDateWorkouts.tsx` - Simple list view

**Tasks**:
- [ ] Create `PlannedSection.tsx` with collapsible subsections
- [ ] Create `PastWorkouts.tsx` (list of workout cards with dates)
- [ ] Create `CurrentWeekWorkouts.tsx` (adapt WeeklyScheduleV2)
- [ ] Create `LaterWorkouts.tsx` (list of workout cards with dates)
- [ ] Create `WithoutDateWorkouts.tsx` (simple list)
- [ ] Test collapsible behavior
- [ ] Test empty states
- [ ] Test workout filtering logic

---

### Step A4: Build Done Section Components

#### A4.1: Done Section Main Component
**File**: `src/components/workouts/DoneSection.tsx` (new file)

```typescript
import { useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WorkoutStatsDisplay } from './WorkoutStatsDisplay';
import { CompletedWorkoutsList } from './CompletedWorkoutsList';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

export function DoneSection() {
  const { getCompletedWorkouts, getWorkoutStats } = useWorkoutsStore();
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  const completedWorkouts = getCompletedWorkouts();
  const stats = getWorkoutStats();

  if (completedWorkouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Done</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No completed workouts yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Complete your first workout to start tracking progress
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Done</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Subsection (Expandable) */}
        <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>Statistics</span>
              {isStatsExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <WorkoutStatsDisplay stats={stats} />
          </CollapsibleContent>
        </Collapsible>

        {/* Completed Workouts List */}
        <div>
          <h3 className="font-medium mb-2">Completed Workouts</h3>
          <CompletedWorkoutsList workouts={completedWorkouts} />
        </div>
      </CardContent>
    </Card>
  );
}
```

#### A4.2: Stats Display Component
**File**: `src/components/workouts/WorkoutStatsDisplay.tsx` (new file)

This component will display:
- Overview cards (total workouts, exercises, sets, time)
- Volume graphs (line/bar charts)
- Exercise-specific progress graphs
- Time spent graphs
- Weekly breakdown
- Exercise type pie chart
- Muscle group heatmap

**Note**: Can reuse/adapt content from current ProgressPage

#### A4.3: Completed Workouts List
**File**: `src/components/workouts/CompletedWorkoutsList.tsx` (new file)

Simple list of workout cards, sorted by date (newest first)

**Tasks**:
- [ ] Create `DoneSection.tsx` with stats and list
- [ ] Create `WorkoutStatsDisplay.tsx` with graphs and visualizations
- [ ] Create `CompletedWorkoutsList.tsx` 
- [ ] Move/adapt content from ProgressPage
- [ ] Add charting library if needed (e.g., recharts)
- [ ] Test stats calculations
- [ ] Test empty state

---

### Step A5: Workout Card Adaptation

#### A5.1: Adapt WorkoutCard for New Context
**File**: `src/components/workouts/WorkoutCardV2.tsx` (new file, or modify existing)

**Changes Needed**:
- Add "source" badge (Manual vs AI Coach)
- Add link/icon to AI Coach if from AI
- Support new workout states
- Handle different contexts (planned vs done)

**Tasks**:
- [ ] Create or modify WorkoutCard component
- [ ] Add source badge UI
- [ ] Add AI Coach link (if applicable)
- [ ] Test in all contexts (past, current, later, done)

---

### Step A6: Add/Edit Workout Dialogs

#### A6.1: Add Workout Dialog
**File**: `src/components/workouts/AddWorkoutDialog.tsx` (new file)

```typescript
import { useState } from 'react';
import { useWorkoutsStore } from '@/stores/workoutsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import type { WorkoutDocument } from '@/types/workout';

interface AddWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWorkoutDialog({ isOpen, onClose }: AddWorkoutDialogProps) {
  const { addWorkout } = useWorkoutsStore();
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [withoutDate, setWithoutDate] = useState(false);

  const handleSubmit = async () => {
    const workout: Partial<WorkoutDocument> = {
      name,
      date: withoutDate ? undefined : date?.toISOString().split('T')[0],
      source: 'manual',
      status: 'planned',
      exercises: [],
      // ... other required fields
    };

    await addWorkout(workout);
    onClose();
    
    // Optional: Open workout execution mode immediately
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Workout</DialogTitle>
        </DialogHeader>
        {/* Form content */}
      </DialogContent>
    </Dialog>
  );
}
```

#### A6.2: Reuse WorkoutExecutionMode
The existing `WorkoutExecutionMode` component should work with minimal modifications. Just pass `WorkoutDocument` instead of `Workout`.

**Tasks**:
- [ ] Create `AddWorkoutDialog.tsx`
- [ ] Add workout name input
- [ ] Add date picker (with "without date" option)
- [ ] Handle workout creation
- [ ] Test dialog flow
- [ ] Reuse `WorkoutExecutionMode` for editing
- [ ] Test workout execution with new data structure

---

### Step A7: Workout Completion Logic

#### A7.1: Implement Special Completion Logic
**File**: `src/lib/workoutCompletionLogic.ts` (new file)

```typescript
import type { WorkoutDocument } from '@/types/workout';
import { isDateInCurrentWeek, isDateInPast } from '@/lib/dateUtils';

/**
 * Determines where a completed workout should go
 */
export function getCompletedWorkoutDestination(workout: WorkoutDocument): 'stay-in-place' | 'move-to-done' {
  if (!workout.date) {
    // No date → move to Done immediately
    return 'move-to-done';
  }

  const workoutDate = new Date(workout.date);
  
  if (isDateInCurrentWeek(workoutDate)) {
    // Current week → stay in Current Week until week passes
    return 'stay-in-place';
  } else {
    // Past or Later → move to Done immediately
    return 'move-to-done';
  }
}

/**
 * Moves completed workouts from current week to Done section
 * Should run at the start of each new week
 */
export async function archiveCompletedWorkoutsFromLastWeek() {
  // Get all workouts from last week that are completed
  // Already in Done section due to status, but ensures consistency
  // This is a maintenance function, not critical for UX
}
```

**Tasks**:
- [ ] Create `workoutCompletionLogic.ts`
- [ ] Implement destination logic
- [ ] Test with different workout dates
- [ ] Add to `markAsComplete` in workoutsStore

---

### Step A8: Integration & Testing

**Tasks**:
- [ ] Update `App.tsx` routing (add /app/workouts, keep /app for backward compatibility)
- [ ] Update `AppLayout.tsx` navigation (replace "Fitness Plan" and "Progress" with "Workouts")
- [ ] Test complete add → edit → complete → uncomplete flow
- [ ] Test drag & drop in Current Week
- [ ] Test collapsible sections
- [ ] Test real-time sync across multiple tabs
- [ ] Test empty states
- [ ] Test with many workouts (performance)
- [ ] Test mobile responsiveness

---

## 🤖 Phase B: AI Coach - Goals Generation

**Goal**: Build first phase of AI Coach (macro/mesocycle goal generation and approval).

### Step B1: Data Structure & Store Setup

#### B1.1: Define AI Coach Types
**File**: `src/types/aiCoach.ts` (new file)

```typescript
/**
 * AI Coach plan structure (decoupled from workouts)
 */
export interface AIPlan {
  id: string;
  userId: string;
  
  // Phase 1: Fitness Goals
  macrocycleGoal: {
    id: string;
    name: string;
    value: string; // Description
    durationWeeks: number;
    startDate: string;
    endDate: string;
    successIndicators: string[];
    promisedOutcome: string;
  };
  
  mesocycleMilestones: Array<{
    id: string;
    name: string;
    durationWeeks: number;
    focus: string;
    value: string; // Description
    successIndicators: string[];
  }>;
  
  // Phase 2: Current Microcycle
  currentMicrocycle?: {
    id: string;
    week: number;
    focus: string;
    value: string;
    dateRange: DateRange;
    workoutIds: string[]; // References to WorkoutDocument IDs
    status: 'active' | 'completed';
    completedAt?: string;
    weeklyReflection?: string;
  };
  
  // History
  completedMicrocycles: Array<{
    id: string;
    week: number;
    completedAt: string;
    workoutIds: string[];
    weeklyReflection: string;
  }>;
  
  // Metadata
  status: 'goals-draft' | 'goals-approved' | 'active' | 'paused';
  generationMetadata: {
    generatedAt: string;
    regenerationCount: number;
    llmModel: string;
  };
  userFeedback: string[];
  goalsLastModified?: string;
  showRegenerationSuggestion?: boolean; // For manual goal edits
  
  createdAt: string;
  updatedAt: string;
}

/**
 * AI generation request for goals
 */
export interface GoalsGenerationRequest {
  userProfile: Record<string, any>;
  fitnessGoalInput: string; // From onboarding question
  customInput: string; // User's detailed description
  currentDate: string;
}

/**
 * AI generation request for microcycle
 */
export interface MicrocycleGenerationRequest {
  userProfile: Record<string, any>;
  macrocycleGoal: AIPlan['macrocycleGoal'];
  mesocycleMilestones: AIPlan['mesocycleMilestones'];
  currentDate: string;
  weekNumber: number;
  weekDateRange: DateRange;
  previousMicrocycle?: {
    planned: any;
    actual: any;
    reflection: string;
  };
  workoutHistory?: any[];
  customFeedback?: string;
}
```

#### B1.2: Create AI Coach Store
**File**: `src/stores/aiCoachStore.ts` (rename from fitnessPlanStore)

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AIPlan, GoalsGenerationRequest, MicrocycleGenerationRequest } from '@/types/aiCoach';

interface AICoachState {
  currentPlan: AIPlan | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  
  // Phase 1: Goals Generation
  generateGoals: (request: GoalsGenerationRequest) => Promise<void>;
  approveGoals: () => Promise<void>;
  updateGoals: (updates: Partial<Pick<AIPlan, 'macrocycleGoal' | 'mesocycleMilestones'>>) => Promise<void>;
  regenerateGoals: (feedback: string) => Promise<void>;
  dismissRegenerationSuggestion: () => Promise<void>;
  
  // Phase 2: Workout Generation
  generateMicrocycle: (request: MicrocycleGenerationRequest) => Promise<void>;
  approveMicrocycle: () => Promise<void>; // Moves workouts to WorkoutsStore
  regenerateMicrocycle: (feedback: string) => Promise<void>;
  
  // Week Completion
  completeMicrocycle: (reflection: string) => Promise<void>;
  generateNextMicrocycle: (reflection: string) => Promise<void>;
  
  // Gap Recovery
  generateGapRecoveryPlan: (gapContext: GapContext) => Promise<void>;
  
  // Load & Sync
  loadPlan: () => Promise<void>;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  
  clearError: () => void;
}

export const useAICoachStore = create<AICoachState>()(
  subscribeWithSelector((set, get) => ({
    currentPlan: null,
    loading: false,
    generating: false,
    error: null,

    generateGoals: async (request) => {
      // Call OpenAI to generate macro/meso goals
      // Save as draft (status: 'goals-draft')
    },

    approveGoals: async () => {
      // Update status to 'goals-approved'
      // User can now generate workouts
    },

    updateGoals: async (updates) => {
      // Manual goal editing
      // Set showRegenerationSuggestion: true
    },

    regenerateGoals: async (feedback) => {
      // Regenerate with feedback
    },

    // ... other methods
  }))
);
```

**Tasks**:
- [ ] Create `src/types/aiCoach.ts` with all types
- [ ] Rename `fitnessPlanStore.ts` to `aiCoachStore.ts`
- [ ] Refactor store to new structure
- [ ] Update Firebase collection path: `users/{userId}/aiPlan/plan`
- [ ] Implement `generateGoals` method
- [ ] Implement `approveGoals` method
- [ ] Implement `updateGoals` with suggestion flag
- [ ] Test goals generation flow

---

### Step B2: Build AI Coach Page (Goals Phase)

#### B2.1: Main AI Coach Page
**File**: `src/pages/AICoachPage.tsx` (rename from FitnessPlanPage)

```typescript
import { useEffect, useState } from 'react';
import { useAICoachStore } from '@/stores/aiCoachStore';
import { GoalsGenerationFlow } from '@/components/ai-coach/GoalsGenerationFlow';
import { AICoachDashboard } from '@/components/ai-coach/AICoachDashboard';
import { Loader2 } from 'lucide-react';

export function AICoachPage() {
  const { currentPlan, loading, loadPlan, startRealtimeSync, stopRealtimeSync } = useAICoachStore();

  useEffect(() => {
    loadPlan();
    startRealtimeSync();
    
    return () => {
      stopRealtimeSync();
    };
  }, [loadPlan, startRealtimeSync, stopRealtimeSync]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading AI Coach...</p>
        </div>
      </div>
    );
  }

  // No plan → show goals generation flow
  if (!currentPlan || currentPlan.status === 'goals-draft') {
    return <GoalsGenerationFlow />;
  }

  // Has plan → show dashboard
  return <AICoachDashboard plan={currentPlan} />;
}
```

#### B2.2: Goals Generation Flow
**File**: `src/components/ai-coach/GoalsGenerationFlow.tsx` (new file)

Multi-step flow:
1. Welcome screen
2. Fitness goal question (reuse from profile)
3. Detailed description input
4. Generate goals (loading state)
5. Review goals
6. Approve / Edit / Regenerate with feedback

**Tasks**:
- [ ] Create `AICoachPage.tsx`
- [ ] Create `GoalsGenerationFlow.tsx` with multi-step wizard
- [ ] Create `FitnessGoalsInput.tsx` (step 2-3)
- [ ] Create `GoalsReview.tsx` (step 5)
- [ ] Create `GoalsEditor.tsx` (for manual editing)
- [ ] Test complete goals generation flow
- [ ] Test regeneration with feedback

---

### Step B3: Build Goals Display & Editing

#### B3.1: Fitness Goals Card
**File**: `src/components/ai-coach/FitnessGoalsCard.tsx` (new file)

Shows:
- Macrocycle goal (editable)
- Mesocycle milestones (editable)
- Edit button
- Regenerate button
- Suggestion banner (if goals were edited)

**Tasks**:
- [ ] Create `FitnessGoalsCard.tsx`
- [ ] Add inline editing capability
- [ ] Add suggestion banner for regeneration
- [ ] Test editing and banner dismissal

---

### Step B4: Firebase Remote Config for Goals Prompts

#### B4.1: Update Prompts in Firebase Remote Config

Add new prompt parameter: `prompts_ai_coach_goals_generation`

```json
{
  "system_prompt": "You are a professional fitness coach...",
  "user_prompt_template": "Generate macro and mesocycle goals for: {USER_PROFILE}..."
}
```

**Tasks**:
- [ ] Create goals generation prompt
- [ ] Add to Firebase Remote Config
- [ ] Test prompt retrieval
- [ ] Test goals generation with prompt

---

### Step B5: Integration & Testing

**Tasks**:
- [ ] Update routing (add /app/ai-coach)
- [ ] Update navigation in AppLayout
- [ ] Test complete goals flow (generate → approve)
- [ ] Test regeneration with feedback
- [ ] Test manual goal editing with suggestion
- [ ] Test persistence to Firebase
- [ ] Test real-time sync

---

## 🎯 Phase C: AI Coach - Workout Generation & Week Completion

**Goal**: Complete AI Coach with microcycle generation and week completion flow.

### Step C1: Microcycle Generation

#### C1.1: Generate Microcycle Flow
**File**: `src/components/ai-coach/MicrocycleGenerationFlow.tsx` (new file)

Flow:
1. Show approved goals
2. Click "Generate Workouts"
3. Loading state (generating)
4. Preview workouts
5. Approve / Edit / Regenerate with feedback

**Tasks**:
- [ ] Create `MicrocycleGenerationFlow.tsx`
- [ ] Create `MicrocyclePreview.tsx` (shows generated workouts)
- [ ] Implement `generateMicrocycle` in store
- [ ] Test generation flow
- [ ] Test regeneration with feedback

---

### Step C2: Approve Microcycle (Move to Workouts)

#### C2.1: Implement Approval Logic
**File**: `src/stores/aiCoachStore.ts`

```typescript
approveMicrocycle: async () => {
  const { currentPlan } = get();
  if (!currentPlan?.currentMicrocycle) return;

  // 1. Get generated workouts from plan
  const workoutIds = currentPlan.currentMicrocycle.workoutIds;
  
  // 2. Move workouts to WorkoutsStore
  // (Workouts are already created during generation, just update status)
  const workoutsStore = useWorkoutsStore.getState();
  await Promise.all(
    workoutIds.map(id => 
      workoutsStore.updateWorkout(id, { status: 'planned' })
    )
  );
  
  // 3. Update AI plan status to 'active'
  await updateDoc(planDocRef, {
    status: 'active',
    'currentMicrocycle.status': 'active'
  });
  
  set({ currentPlan: { ...currentPlan, status: 'active' } });
},
```

**Tasks**:
- [ ] Implement `approveMicrocycle` logic
- [ ] Create workouts in WorkoutsStore during generation
- [ ] Link workouts to AI plan via `aiCoachContext`
- [ ] Test workout creation and linking
- [ ] Verify workouts appear in Workouts page

---

### Step C3: AI Coach Dashboard

#### C3.1: Dashboard Component
**File**: `src/components/ai-coach/AICoachDashboard.tsx` (new file)

Shows:
1. Fitness Goals Card (with edit/regenerate)
2. Current Microcycle Card (with workouts)
3. Progress Summary
4. Complete Week button (if week is ending)

**Tasks**:
- [ ] Create `AICoachDashboard.tsx`
- [ ] Create `CurrentMicrocycleCard.tsx`
- [ ] Show workouts from WorkoutsStore (by IDs)
- [ ] Add "Complete Week" button logic
- [ ] Test dashboard display

---

### Step C4: Week Completion Flow

#### C4.1: Week Completion Dialog
**File**: `src/components/ai-coach/WeekCompletionDialog.tsx` (adapt from MicrocycleCompletion)

Flow:
1. Show completed workouts (read from WorkoutsStore)
2. Input reflection notes
3. Click "Generate Next Week"
4. Loading state
5. Preview next week's workouts
6. Approve / Edit / Regenerate

**Tasks**:
- [ ] Create `WeekCompletionDialog.tsx`
- [ ] Implement `completeMicrocycle` in store
- [ ] Implement `generateNextMicrocycle` in store
- [ ] Test week completion flow
- [ ] Test next week generation

---

### Step C5: Firebase Remote Config for Microcycle Prompts

#### C5.1: Update Prompts

Reuse existing prompts:
- `prompts_fitness_plan_generation` (initial microcycle)
- `prompts_fitness_plan_generate_next_microcycle` (subsequent weeks)

**Tasks**:
- [ ] Adapt prompts to new data structure
- [ ] Test microcycle generation
- [ ] Test next week generation

---

### Step C6: Integration & Testing

**Tasks**:
- [ ] Test complete AI Coach flow (goals → workouts → approve)
- [ ] Test workouts appearing in Workouts page
- [ ] Test week completion
- [ ] Test next week generation
- [ ] Test AI Coach + manual workout mixing
- [ ] Test gap recovery (if 7+ days)

---

## 🔄 Phase D: Data Migration for Existing Users

**Goal**: Migrate existing users from old fitness plan structure to new enhanced UX.

### Step D1: Migration Script

#### D1.1: Create Migration Function
**File**: `src/lib/dataMigration.ts` (new file)

```typescript
import { doc, getDoc, setDoc, collection, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FitnessPlan } from '@/types/fitness'; // Old structure
import type { AIPlan } from '@/types/aiCoach'; // New structure
import type { WorkoutDocument } from '@/types/workout'; // New structure

/**
 * Migrates a user from old fitness plan structure to enhanced UX
 */
export async function migrateUserToEnhancedUX(userId: string): Promise<boolean> {
  try {
    console.log('[Migration] Starting migration for user:', userId);
    
    // 1. Check if already migrated
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    if (userData?.enhancedUXMigrationCompleted) {
      console.log('[Migration] User already migrated');
      return true;
    }
    
    // 2. Load old fitness plan
    const oldPlanRef = doc(db, 'users', userId, 'currentPlan', 'plan');
    const oldPlanDoc = await getDoc(oldPlanRef);
    
    if (!oldPlanDoc.exists()) {
      console.log('[Migration] No fitness plan to migrate');
      // Mark migration as complete anyway
      await setDoc(userDocRef, { enhancedUXMigrationCompleted: true }, { merge: true });
      return true;
    }
    
    const oldPlan = oldPlanDoc.data() as FitnessPlan;
    
    // 3. Extract workouts from old plan
    const workouts = oldPlan.currentMicrocycle.workouts || [];
    const batch = writeBatch(db);
    const workoutIds: string[] = [];
    
    for (const workout of workouts) {
      const workoutId = workout.id;
      workoutIds.push(workoutId);
      
      const workoutDoc: WorkoutDocument = {
        ...workout,
        source: 'ai-coach',
        aiCoachContext: {
          microcycleId: oldPlan.currentMicrocycle.id,
          weekNumber: oldPlan.currentMicrocycle.week,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const workoutRef = doc(db, 'users', userId, 'workouts', workoutId);
      batch.set(workoutRef, workoutDoc);
    }
    
    // 4. Create new AI plan structure
    const newPlan: AIPlan = {
      id: oldPlan.id,
      userId,
      macrocycleGoal: {
        id: oldPlan.macrocycle.id,
        name: oldPlan.macrocycle.name,
        value: oldPlan.macrocycle.value,
        durationWeeks: oldPlan.macrocycle.durationWeeks,
        startDate: oldPlan.macrocycle.startDate,
        endDate: oldPlan.macrocycle.endDate,
        successIndicators: oldPlan.macrocycle.successIndicators,
        promisedOutcome: oldPlan.macrocycle.promisedOutcome,
      },
      mesocycleMilestones: oldPlan.macrocycle.mesocycles.map(meso => ({
        id: meso.id,
        name: meso.name,
        durationWeeks: meso.durationWeeks,
        focus: meso.focus,
        value: meso.value,
        successIndicators: meso.successIndicators,
      })),
      currentMicrocycle: {
        id: oldPlan.currentMicrocycle.id,
        week: oldPlan.currentMicrocycle.week,
        focus: oldPlan.currentMicrocycle.focus,
        value: oldPlan.currentMicrocycle.value,
        dateRange: oldPlan.currentMicrocycle.dateRange,
        workoutIds,
        status: oldPlan.currentMicrocycle.status === 'completed' ? 'completed' : 'active',
        completedAt: oldPlan.currentMicrocycle.completedAt,
        weeklyReflection: oldPlan.currentMicrocycle.weeklyNotes,
      },
      completedMicrocycles: [],
      status: 'active',
      generationMetadata: oldPlan.generationMetadata,
      userFeedback: oldPlan.userFeedback || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const newPlanRef = doc(db, 'users', userId, 'aiPlan', 'plan');
    batch.set(newPlanRef, newPlan);
    
    // 5. Mark migration complete
    batch.update(userDocRef, { enhancedUXMigrationCompleted: true });
    
    // 6. Commit all changes
    await batch.commit();
    
    console.log('[Migration] Migration completed successfully');
    console.log('[Migration] Migrated', workoutIds.length, 'workouts');
    
    return true;
    
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return false;
  }
}

/**
 * Check if user needs migration and run if needed
 */
export async function checkAndRunMigration(userId: string): Promise<void> {
  const userDocRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userDocRef);
  const userData = userDoc.data();
  
  if (!userData?.enhancedUXMigrationCompleted) {
    console.log('[Migration] User needs migration, starting...');
    await migrateUserToEnhancedUX(userId);
  }
}
```

#### D1.2: Add Migration Check on App Load
**File**: `src/App.tsx`

```typescript
useEffect(() => {
  if (user) {
    checkAndRunMigration(user.uid);
  }
}, [user]);
```

**Tasks**:
- [ ] Create `dataMigration.ts` with migration logic
- [ ] Test migration with sample old data
- [ ] Add migration check to App.tsx
- [ ] Add migration progress indicator (optional)
- [ ] Test with multiple users
- [ ] Handle edge cases (incomplete plans, etc.)

---

### Step D2: Migration UI (Optional)

#### D2.1: Migration Progress Dialog
**File**: `src/components/migration/MigrationDialog.tsx` (new file)

Shows progress during migration (optional, for better UX)

**Tasks**:
- [ ] Create migration progress dialog (optional)
- [ ] Show during migration (optional)
- [ ] Handle migration errors gracefully

---

## 🎨 Phase E: Polish, Enhancement & Optimization

**Goal**: Improve UX, add visual enhancements, optimize performance.

### Step E1: Visual Differentiation

**Tasks**:
- [ ] Add workout source badges (Manual vs AI Coach)
- [ ] Add AI Coach link icon on AI-generated workouts
- [ ] Improve empty states with illustrations
- [ ] Add loading skeletons everywhere
- [ ] Improve error messages with actionable suggestions
- [ ] Add help tooltips throughout app

---

### Step E2: Progress Visualization Enhancements

**Tasks**:
- [ ] Add charting library (recharts or chart.js)
- [ ] Implement volume graphs (line/bar charts)
- [ ] Implement exercise-specific progress graphs
- [ ] Implement time spent graphs
- [ ] Add weekly completion rings (like Apple Watch)
- [ ] Add exercise type pie chart
- [ ] Add muscle group heatmap
- [ ] Make graphs interactive (zoom, filter, etc.)

---

### Step E3: AI Coach Dashboard Enhancements

**Tasks**:
- [ ] Add mesocycle timeline visualization
- [ ] Add week-by-week completion badges
- [ ] Add goal achievement indicators
- [ ] Improve current week summary
- [ ] Add progress animations

---

### Step E4: Performance Optimization

**Tasks**:
- [ ] Optimize workout list rendering (virtualization if needed)
- [ ] Optimize graph rendering
- [ ] Add memoization to expensive computations
- [ ] Optimize Firebase queries (indexes, limits)
- [ ] Add pagination for completed workouts list
- [ ] Profile and fix any performance bottlenecks

---

### Step E5: Accessibility Audit

**Tasks**:
- [ ] Keyboard navigation for all interactive elements
- [ ] Screen reader support (ARIA labels)
- [ ] Focus management in dialogs
- [ ] Color contrast checks
- [ ] Test with accessibility tools

---

### Step E6: Mobile Responsiveness

**Tasks**:
- [ ] Test all pages on mobile
- [ ] Fix any layout issues
- [ ] Optimize touch targets
- [ ] Test drag & drop on mobile
- [ ] Test graphs on mobile

---

### Step E7: Documentation Updates

**Tasks**:
- [ ] Update .cursorrules with new features
- [ ] Update README with new architecture
- [ ] Add inline code documentation
- [ ] Update testing instructions
- [ ] Create user guide (optional)

---

## ✅ Testing Checklist

### Unit Tests
- [ ] workoutsStore actions
- [ ] aiCoachStore actions
- [ ] Workout completion logic
- [ ] Stats calculations
- [ ] Date filtering logic

### Integration Tests
- [ ] Complete workout tracking flow
- [ ] Complete AI Coach flow
- [ ] Workout approval (AI → Workouts)
- [ ] Week completion
- [ ] Data migration

### E2E Tests
- [ ] User can add and complete workout
- [ ] User can use AI Coach to generate plan
- [ ] User can mix manual and AI workouts
- [ ] User can view progress stats
- [ ] User can edit goals and regenerate

### Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers

---

## 📋 Daily Progress Tracking

### Day 1: Setup & Core Structure
- [ ] Create new types (workout.ts, aiCoach.ts)
- [ ] Create workoutsStore with full implementation
- [ ] Test store in isolation

### Day 2: Workouts Page - Planned Section
- [ ] Build WorkoutsPage layout
- [ ] Build PlannedSection with all subsections
- [ ] Test filtering and collapsible behavior

### Day 3: Workouts Page - Done Section
- [ ] Build DoneSection
- [ ] Build WorkoutStatsDisplay
- [ ] Move content from ProgressPage
- [ ] Test stats calculations

### Day 4: Workout Management
- [ ] Build AddWorkoutDialog
- [ ] Adapt WorkoutCard
- [ ] Implement completion logic
- [ ] Test CRUD operations

### Day 5: Workouts Page - Integration & Testing
- [ ] Add to routing and navigation
- [ ] Test complete workout tracking flow
- [ ] Test real-time sync
- [ ] Fix any bugs

### Day 6: AI Coach - Goals Generation
- [ ] Refactor stores (fitnessPlanStore → aiCoachStore)
- [ ] Build AICoachPage
- [ ] Build GoalsGenerationFlow
- [ ] Test goals generation

### Day 7: AI Coach - Workout Generation
- [ ] Build MicrocycleGenerationFlow
- [ ] Implement approval logic
- [ ] Test workout creation and linking
- [ ] Test in Workouts page

### Day 8: AI Coach - Dashboard & Week Completion
- [ ] Build AICoachDashboard
- [ ] Build WeekCompletionDialog
- [ ] Test week completion flow
- [ ] Test next week generation

### Day 9: Data Migration
- [ ] Write migration script
- [ ] Test with sample data
- [ ] Add to app load
- [ ] Test with multiple users

### Day 10: Polish & Optimization
- [ ] Add visual enhancements
- [ ] Add graphs and charts
- [ ] Performance optimization
- [ ] Bug fixes

---

## 🚀 Deployment Strategy

### Pre-Deployment
1. [ ] Complete all testing
2. [ ] Review all code changes
3. [ ] Update documentation
4. [ ] Create backup of production data

### Deployment Steps
1. [ ] Deploy to staging environment
2. [ ] Run full test suite on staging
3. [ ] Test migration with production data copy
4. [ ] Deploy to production
5. [ ] Monitor for errors
6. [ ] Be ready to rollback if needed

### Post-Deployment
1. [ ] Monitor Firebase usage
2. [ ] Monitor error logs
3. [ ] Check user feedback
4. [ ] Fix any critical bugs immediately
5. [ ] Plan next iteration

---

## 📝 Notes & Considerations

### Critical Success Factors
1. **Data migration must be bullet-proof** - no data loss allowed
2. **Real-time sync must work perfectly** - users expect instant updates
3. **Performance must remain good** - app should feel fast
4. **Backward compatibility** - existing users should not be disrupted

### Risk Mitigation
1. **Test migration extensively** with production data copies
2. **Add rollback mechanism** in case of critical bugs
3. **Monitor Firebase costs** - new structure may increase reads/writes
4. **Keep old code temporarily** - don't delete until migration proven

### Future Enhancements (Post-MVP)
1. Workout templates / library
2. Exercise database with videos
3. Social features
4. Wearable integration
5. Voice input
6. Nutrition tracking
7. Progress photos
8. Body measurements tracking

---

**End of Implementation Plan**

*This plan should be followed incrementally, testing thoroughly at each step. The goal is to build a robust, user-friendly app that provides value with or without AI coaching.*


