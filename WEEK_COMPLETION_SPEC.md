# Week Completion Flow - Technical Specification

## 🎯 **OBJECTIVE**
Implement a complete week completion flow that allows users to review their actual vs planned workouts, then generate the next week using LLM with clean, structured data.

## 📊 **CURRENT STATE ANALYSIS**

### **✅ What We Have**
- Planned workouts stored in `currentPlan.currentMicrocycle.workouts[]`
- Workout completion status (`'planned' | 'completed'`)
- Exercise structure with sets, reps, weights, etc.
- Firebase sync with real-time updates
- Basic workout execution and marking as complete

### **❌ What's Missing**
- **No actual dates** - Only `dayOfWeek` numbers (0-6)
- **No "Complete Week" UI flow** - Users can't formally complete a week
- **Messy data structure** - Not optimized for LLM consumption
- **No progress history storage** - Completed weeks aren't stored for future reference
- **No week-level completion tracking** - Only individual workout completion

## 🏗️ **TECHNICAL IMPLEMENTATION**

### **Phase 1: Date Management & UI Updates**

#### **1.1 Data Structure Updates**

**Update `Microcycle` interface:**
```typescript
export interface Microcycle {
  id: string;
  week: number;
  startDate: string;        // NEW: ISO date string (e.g., "2025-01-20")
  endDate: string;          // NEW: ISO date string (e.g., "2025-01-26")
  focus: string;
  value: string;
  workouts: Workout[];
  weeklyCheckIns: WorkoutCheckIns;
  status: 'active' | 'completed';
  completedAt?: string;
  completedWorkouts: CompletedWorkout[];
  weeklyNotes?: string;
}
```

**Update `Workout` interface:**
```typescript
export interface Workout {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;        // Keep for backward compatibility
  date: string;             // NEW: Actual date (e.g., "2025-01-20")
  estimatedDuration: number;
  focus: string;
  value: string;
  exercises: Exercise[];
  checkIns: WorkoutCheckIns;
  status: 'planned' | 'completed';
  completedAt?: string;
  actualDuration?: number;
  notes?: string;
  rank: string;
  lastMutation?: MutationInfo;
}
```

#### **1.2 Date Utility Functions**

**Create `src/lib/dateUtils.ts`:**
```typescript
export function getWeekDates(startDate: Date): {
  startDate: string;
  endDate: string;
  dailyDates: string[];
} {
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() - startDate.getDay() + 1); // Get Monday
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return {
    startDate: dates[0],
    endDate: dates[6],
    dailyDates: dates
  };
}

export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
}

export function isWeekComplete(microcycle: Microcycle): boolean {
  const today = new Date().toISOString().split('T')[0];
  return today > microcycle.endDate;
}
```

#### **1.3 Update Fitness Plan Store**

**Add date management to `fitnessPlanStore.ts`:**
```typescript
// Add new action
interface FitnessPlanState {
  // ... existing fields
  completeWeek: (weeklyNotes: string) => Promise<void>;
  canCompleteWeek: () => boolean;
}

// Implementation
completeWeek: async (weeklyNotes: string) => {
  const { currentPlan } = get();
  if (!currentPlan) return;
  
  // Convert to LLM format and generate next week
  const llmData = convertToLLMFormat(currentPlan.currentMicrocycle);
  
  // Store completed week in progress collection
  await storeWeekProgress(currentPlan.currentMicrocycle, weeklyNotes);
  
  // Generate next microcycle
  await get().generateNextMicrocycle(llmData, weeklyNotes);
},

canCompleteWeek: () => {
  const { currentPlan } = get();
  if (!currentPlan) return false;
  
  const today = new Date().toISOString().split('T')[0];
  return today >= currentPlan.currentMicrocycle.endDate;
}
```

### **Phase 2: LLM-Optimized Data Structure**

#### **2.1 Clean Data Format for LLM**

**Create `src/types/llmData.ts`:**
```typescript
export interface LLMWorkoutData {
  week_info: {
    start_date: string;
    end_date: string;
    focus: string;
    completion_rate: number;
  };
  
  planned_workouts: {
    workout_name: string;
    date: string;
    day_of_week: string;
    estimated_duration_minutes: number;
    focus: string;
    exercises: {
      exercise_name: string;
      category: string;
      volume: {
        volume_type: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance';
        sets?: number;
        reps?: number;
        weight?: number;
        weight_unit?: 'kg' | 'lb';
        duration_minutes?: number;
        distance?: number;
        distance_unit?: 'km' | 'mi' | 'm';
      }[];
    }[];
  }[];
  
  actually_done_workouts: {
    workout_name: string;
    date: string;
    day_of_week: string;
    actual_duration_minutes?: number;
    notes?: string;
    exercises: {
      exercise_name: string;
      category: string;
      volume: {
        volume_type: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance';
        sets?: number;
        reps?: number;
        weight?: number;
        weight_unit?: 'kg' | 'lb';
        duration_minutes?: number;
        distance?: number;
        distance_unit?: 'km' | 'mi' | 'm';
        completed: boolean;
      }[];
    }[];
  }[];
  
  user_feedback: {
    weekly_notes: string;
    completion_patterns: {
      preferred_days: string[];
      struggling_exercises: string[];
      progressing_exercises: string[];
    };
  };
}
```

#### **2.2 Data Conversion Function**

**Create `src/lib/llmDataConverter.ts`:**
```typescript
import type { Microcycle } from '@/types/fitness';
import type { LLMWorkoutData } from '@/types/llmData';

export function convertToLLMFormat(microcycle: Microcycle): LLMWorkoutData {
  const completedWorkouts = microcycle.workouts.filter(w => w.status === 'completed');
  const completionRate = microcycle.workouts.length > 0 
    ? completedWorkouts.length / microcycle.workouts.length 
    : 0;

  return {
    week_info: {
      start_date: microcycle.startDate,
      end_date: microcycle.endDate,
      focus: microcycle.focus,
      completion_rate: completionRate
    },
    
    planned_workouts: microcycle.workouts.map(workout => ({
      workout_name: workout.name,
      date: workout.date,
      day_of_week: new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long' }),
      estimated_duration_minutes: workout.estimatedDuration,
      focus: workout.focus,
      exercises: workout.exercises.map(exercise => ({
        exercise_name: exercise.name,
        category: exercise.category,
        volume: exercise.sets.map(set => convertSetToLLMVolume(set))
      }))
    })),
    
    actually_done_workouts: completedWorkouts.map(workout => ({
      workout_name: workout.name,
      date: workout.date,
      day_of_week: new Date(workout.date).toLocaleDateString('en-US', { weekday: 'long' }),
      actual_duration_minutes: workout.actualDuration,
      notes: workout.notes,
      exercises: workout.exercises.map(exercise => ({
        exercise_name: exercise.name,
        category: exercise.category,
        volume: exercise.sets.map(set => ({
          ...convertSetToLLMVolume(set),
          completed: true // All sets in completed workouts are considered done
        }))
      }))
    })),
    
    user_feedback: {
      weekly_notes: microcycle.weeklyNotes || '',
      completion_patterns: analyzeCompletionPatterns(microcycle)
    }
  };
}

function convertSetToLLMVolume(set: ExerciseSet) {
  const base = {
    volume_type: set.volumeType || 'sets-reps'
  };
  
  switch (set.volumeType) {
    case 'sets-reps':
      return { ...base, reps: set.reps };
    case 'sets-reps-weight':
      return { 
        ...base, 
        reps: set.reps, 
        weight: set.weight, 
        weight_unit: set.weightUnit 
      };
    case 'duration':
      return { 
        ...base, 
        duration_minutes: set.duration ? set.duration / 60 : 0 
      };
    case 'distance':
      const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
      return { 
        ...base, 
        distance, 
        distance_unit: set.distanceUnit 
      };
    default:
      return { ...base, reps: set.reps };
  }
}

function analyzeCompletionPatterns(microcycle: Microcycle) {
  const completedWorkouts = microcycle.workouts.filter(w => w.status === 'completed');
  
  return {
    preferred_days: completedWorkouts.map(w => 
      new Date(w.date).toLocaleDateString('en-US', { weekday: 'long' })
    ),
    struggling_exercises: [], // TODO: Implement based on completion rates
    progressing_exercises: [] // TODO: Implement based on volume increases
  };
}
```

### **Phase 3: Progress Storage System**

#### **3.1 Firebase Collection Structure**
```
users/{userId}/
  ├── currentPlan/
  │   └── plan                    // Current active fitness plan
  └── progress/
      └── weeks/
          ├── 2025-01-20          // Week documents by start date
          ├── 2025-01-27
          └── ...
```

#### **3.2 Week Progress Interface**

**Add to `src/types/fitness.ts`:**
```typescript
export interface WeekProgress {
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  focus: string;
  plannedWorkouts: LLMWorkoutData['planned_workouts'];
  actualWorkouts: LLMWorkoutData['actually_done_workouts'];
  weeklyNotes: string;
  completionRate: number;
  completedAt: string;
  nextWeekGenerated: boolean;
}
```

#### **3.3 Progress Storage Functions**

**Create `src/lib/progressStorage.ts`:**
```typescript
import { doc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WeekProgress } from '@/types/fitness';
import type { LLMWorkoutData } from '@/types/llmData';

export async function storeWeekProgress(
  userId: string,
  llmData: LLMWorkoutData,
  weeklyNotes: string
): Promise<void> {
  const weekProgress: WeekProgress = {
    weekStartDate: llmData.week_info.start_date,
    weekEndDate: llmData.week_info.end_date,
    weekNumber: getWeekNumber(llmData.week_info.start_date),
    focus: llmData.week_info.focus,
    plannedWorkouts: llmData.planned_workouts,
    actualWorkouts: llmData.actually_done_workouts,
    weeklyNotes,
    completionRate: llmData.week_info.completion_rate,
    completedAt: new Date().toISOString(),
    nextWeekGenerated: false
  };

  const weekDocRef = doc(db, 'users', userId, 'progress', 'weeks', llmData.week_info.start_date);
  await setDoc(weekDocRef, weekProgress);
}

export async function getWeekHistory(userId: string): Promise<WeekProgress[]> {
  const weeksRef = collection(db, 'users', userId, 'progress', 'weeks');
  const q = query(weeksRef, orderBy('weekStartDate', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data() as WeekProgress);
}

function getWeekNumber(dateString: string): number {
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}
```

### **Phase 4: UI Components**

#### **4.1 Update Main Fitness Plan Page**

**Update `src/pages/FitnessPlanPage.tsx`:**
```typescript
// Add date display and complete week button
const { currentPlan, canCompleteWeek, completeWeek } = useFitnessPlanStore();
const [showCompleteWeek, setShowCompleteWeek] = useState(false);

// In render:
<div className="mb-6">
  <h2 className="text-2xl font-bold">
    Week of {formatDateForDisplay(currentPlan.currentMicrocycle.startDate)} - 
    {formatDateForDisplay(currentPlan.currentMicrocycle.endDate)}
  </h2>
  
  {canCompleteWeek() && (
    <Button 
      onClick={() => setShowCompleteWeek(true)}
      className="mt-4"
      size="lg"
    >
      Complete Week 🎯
    </Button>
  )}
</div>

// Update workout cards to show dates
{currentPlan.currentMicrocycle.workouts.map(workout => (
  <WorkoutCard 
    key={workout.id}
    workout={workout}
    date={formatDateForDisplay(workout.date)}
    // ... other props
  />
))}
```

#### **4.2 Week Completion Dialog**

**Create `src/components/fitness/WeekCompletionDialog.tsx`:**
```typescript
interface WeekCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  microcycle: Microcycle;
  onComplete: (weeklyNotes: string) => Promise<void>;
}

export function WeekCompletionDialog({ 
  isOpen, 
  onClose, 
  microcycle, 
  onComplete 
}: WeekCompletionDialogProps) {
  const [weeklyNotes, setWeeklyNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const completedWorkouts = microcycle.workouts.filter(w => w.status === 'completed');
  const completionRate = (completedWorkouts.length / microcycle.workouts.length) * 100;

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete(weeklyNotes);
      onClose();
    } catch (error) {
      console.error('Failed to complete week:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Complete Week: {formatDateForDisplay(microcycle.startDate)} - 
            {formatDateForDisplay(microcycle.endDate)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Completed Workouts ({completedWorkouts.length}/{microcycle.workouts.length})
            </h3>
            <Progress value={completionRate} className="mb-4" />
            
            {completedWorkouts.map(workout => (
              <div key={workout.id} className="border rounded p-3 mb-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">
                    {formatDateForDisplay(workout.date)} - {workout.name}
                  </h4>
                  <Badge variant="secondary">
                    {workout.actualDuration || workout.estimatedDuration}min
                  </Badge>
                </div>
                
                <div className="mt-2 text-sm text-muted-foreground">
                  {workout.exercises.length} exercises completed
                  {workout.notes && (
                    <div className="mt-1 italic">"{workout.notes}"</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div>
            <Label htmlFor="weeklyNotes" className="text-base font-medium">
              Weekly Reflection
            </Label>
            <Textarea
              id="weeklyNotes"
              placeholder="How did this week go? Any challenges or wins?"
              value={weeklyNotes}
              onChange={(e) => setWeeklyNotes(e.target.value)}
              className="mt-2"
              rows={4}
            />
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Back to Edit Workouts
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={isCompleting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompleting ? 'Generating Next Week...' : 'Generate Next Week 🚀'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### **4.3 Update Workout Cards with Dates**

**Update `src/components/fitness/WorkoutCard.tsx`:**
```typescript
interface WorkoutCardProps {
  workout: Workout;
  date: string;  // NEW: Formatted date string
  // ... other props
}

// In render:
<Card>
  <CardHeader>
    <div className="flex justify-between items-start">
      <div>
        <CardTitle className="text-lg">{workout.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>
      <Badge variant={workout.status === 'completed' ? 'default' : 'secondary'}>
        {workout.status === 'completed' ? '✅ Done' : '⏳ Planned'}
      </Badge>
    </div>
  </CardHeader>
  {/* ... rest of card */}
</Card>
```

## 🔄 **MIGRATION STRATEGY**

### **Existing Users Data Migration**

**Create `src/lib/dataMigration.ts`:**
```typescript
export async function migrateMicrocycleToIncludeDates(microcycle: Microcycle): Microcycle {
  // If dates already exist, return as-is
  if (microcycle.startDate && microcycle.endDate) {
    return microcycle;
  }
  
  // Generate dates based on current week
  const today = new Date();
  const { startDate, endDate, dailyDates } = getWeekDates(today);
  
  const updatedWorkouts = microcycle.workouts.map(workout => ({
    ...workout,
    date: dailyDates[workout.dayOfWeek]
  }));
  
  return {
    ...microcycle,
    startDate,
    endDate,
    workouts: updatedWorkouts
  };
}
```

## 📋 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Core Infrastructure**
- [ ] Update `Microcycle` and `Workout` interfaces with date fields
- [ ] Create `dateUtils.ts` with date management functions
- [ ] Update fitness plan store with week completion logic
- [ ] Add data migration for existing users

### **Phase 2: LLM Integration**
- [ ] Create `LLMWorkoutData` interface
- [ ] Implement `convertToLLMFormat()` function
- [ ] Update `generateNextMicrocycle()` to use clean data format
- [ ] Test LLM prompt generation with new data structure

### **Phase 3: UI Implementation**
- [ ] Update main fitness plan page with dates
- [ ] Create `WeekCompletionDialog` component
- [ ] Update workout cards to show actual dates
- [ ] Add "Complete Week" button with proper conditions

### **Phase 4: Progress Storage**
- [ ] Create Firebase progress collection structure
- [ ] Implement `storeWeekProgress()` function
- [ ] Create progress retrieval functions
- [ ] Add progress page (future enhancement)

### **Phase 5: Testing & Polish**
- [ ] Test complete week flow end-to-end
- [ ] Test LLM data format with actual API calls
- [ ] Test data migration for existing users
- [ ] Add error handling and loading states

## 🎯 **SUCCESS CRITERIA**

1. **User can see actual dates** on all workouts and week headers
2. **"Complete Week" button appears** when appropriate (end of week)
3. **Week completion dialog** shows only completed workouts for review
4. **LLM receives clean, structured data** for next week generation
5. **Completed weeks are stored** in Firebase progress collection
6. **Next week is generated** with improved personalization based on actual performance

## ⚠️ **CRITICAL CONSIDERATIONS**

### **Data Consistency**
- Ensure all date operations are timezone-aware
- Handle edge cases (user in different timezone, week spanning month boundary)
- Maintain backward compatibility during migration

### **User Experience**
- Don't force week completion - make it optional but encouraged
- Allow users to edit workouts after marking complete
- Provide clear feedback during LLM generation process

### **Performance**
- Optimize LLM data structure to minimize token usage
- Cache week completion status to avoid repeated calculations
- Use Firebase batching for progress storage operations

This specification provides a complete roadmap for implementing the week completion flow with clean data structure for LLM integration.
