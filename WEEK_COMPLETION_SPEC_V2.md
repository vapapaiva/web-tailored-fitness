# Week Completion & Full App Loop - Complete UX/UI Specification

## 🎯 **OBJECTIVE**
Define the complete user experience for fitness plan generation, weekly progression, completion, and gap recovery. This spec covers ALL flows from initial onboarding to continuous use.

---

## 📱 **INITIAL PLAN GENERATION FLOW**

### **Context & Triggers**
User has completed onboarding and has no fitness plan. They see "Generate Fitness Plan" button.

### **Generation Timing Logic**
**CRITICAL**: Plan duration depends on when user generates it:

- **Monday - Thursday**: Generate rest of current week (uses `prompts_fitness_plan_generation`)
- **Friday - Sunday**: Generate till end of next week (uses `prompts_fitness_plan_generation_rest_of_the_week`)

### **UI: Initial Generation Screen**
```
┌─────────────────────────────────────────────────────────┐
│ Generate Your Personalized Fitness Plan                │
├─────────────────────────────────────────────────────────┤
│ [Loading skeleton with "Generating your plan..."]      │
└─────────────────────────────────────────────────────────┘
```

### **UI: Plan Preview/Approval Screen**
```
┌─────────────────────────────────────────────────────────┐
│ Your Personalized Fitness Plan                         │
├─────────────────────────────────────────────────────────┤
│ Jan 20 - 26 - Foundation Week                          │ ← Dates + focus/title (no week number)
│                                                         │
│ [Workout cards with dates...]                          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Want changes? Add your comments:                   │ │
│ │ [Text area: "More cardio please"]                  │ │
│ │ [Regenerate Plan]                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Approve & Start Training 🚀]                          │
└─────────────────────────────────────────────────────────┘
```

**Specific Elements:**
- Week header shows: `"Week {number}: {start date} - {end date} - {week focus}"`
- Regenerate button triggers `prompts_fitness_plan_regenerate_with_comment` with user comment
- Approve button sets plan status to 'approved' and starts training

### **Data Flow: Initial Generation**

**Step 1: Determine Week Duration**
```typescript
const today = new Date();
const dayOfWeek = today.getDay(); // 0=Sunday, 6=Saturday

// Monday=1, Tuesday=2, Wednesday=3, Thursday=4
const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;

const promptKey = isMonToThu 
  ? 'prompts_fitness_plan_generation' 
  : 'prompts_fitness_plan_generation_rest_of_the_week';
```

**Step 2: Calculate Date Range**
```typescript
// App calculates date range, NOT the AI
const weekStartDate = getMonday(today); // This week's Monday
const weekEndDate = isMonToThu 
  ? getSunday(today) // This week's Sunday
  : getSunday(addDays(today, 7)); // Next week's Sunday

const dateRange = { start: weekStartDate, end: weekEndDate };
```

**Step 3: AI Prompt Data**
```typescript
{
  userProfile: user.profile,
  customPrompt: "", // Empty on first generation
  currentDate: today.toISOString(),
  weekDateRange: dateRange, // App provides this to AI
  // No workout history on first generation
}
```

**Step 4: AI Response Processing**
```typescript
// AI returns workouts with dayOfWeek ONLY (1=Monday, 0=Sunday)
const aiResponse = {
  macrocycle: {...},
  mesocycle: {...},
  microcycle: {
    week: 1,
    focus: "Foundation Week",
    workouts: [
      { dayOfWeek: 1, name: "Upper Body", ... },
      { dayOfWeek: 3, name: "Lower Body", ... }
    ]
  }
};

// App assigns actual dates to workouts
const microcycleWithDates = {
  ...aiResponse.microcycle,
  dateRange: dateRange, // Add date range to microcycle
  workouts: aiResponse.microcycle.workouts.map(w => ({
    ...w,
    date: calculateDateFromDayOfWeek(w.dayOfWeek, weekStartDate)
  }))
};
```

---

## 📅 **HAPPY PATH FLOW: NORMAL PROGRESSION**

### **Visual State: Days 1-6 of Microcycle**
```
Week 1: Jan 20 - 26 - Foundation Week

┌─────────────────────────────────────────────────────────┐
│          Complete Week 🎯          [DISABLED]          │
└─────────────────────────────────────────────────────────┘

💡 Complete this week on Sunday, Jan 26 to save your progress

Monday, Jan 20    Tuesday, Jan 21    Wednesday, Jan 22    ...
[workout card]    [workout card]     [workout card]
```

**Button State:**
- **Disabled** (not clickable)
- Gray/outline styling
- Helper text below explains when it activates

### **Visual State: Last Day of Microcycle (Day 7) + Up to 7 Days After**
```
Week 1: Jan 20 - 26 - Foundation Week

┌─────────────────────────────────────────────────────────┐
│    Complete Week & Generate Next 🚀   [ENABLED]        │ ← GREEN + PULSE ANIMATION
└─────────────────────────────────────────────────────────┘

🎯 Week ends today! Complete it now to generate your personalized next week

[Workout cards with completion status...]
```

**Button Enabling Logic:**
```typescript
const canComplete = (microcycle: Microcycle): boolean => {
  if (!microcycle.dateRange) return false;
  
  const today = new Date();
  const weekEndDate = new Date(microcycle.dateRange.end);
  const daysSinceEnd = Math.floor((today.getTime() - weekEndDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Enable on last day (daysSinceEnd === 0) or up to 7 days after
  return daysSinceEnd >= 0 && daysSinceEnd <= 7;
};
```

### **Visual State: Short Overdue (1-7 Days After Week End)**
```
Week 1: Jan 20 - 26 - Foundation Week

┌─────────────────────────────────────────────────────────┐
│    Complete Overdue Week & Generate Next ⚠️  [ENABLED]  │ ← ORANGE WARNING
└─────────────────────────────────────────────────────────┘

⚠️ This week ended 3 days ago. Complete it now to get back on track
```

**Button State:**
- Orange/warning color
- Shows days since week ended
- Same functionality as normal completion

---

## 🗓️ **WEEK COMPLETION DIALOG**

### **Dialog UI**
```
┌─────────────────────────────────────────────────────────┐
│ Complete Week 1: Jan 20 - 26 - Foundation Week         │ ← Include focus
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Your Progress                                          │
│ Completed Workouts: 3/5 (60%)                         │
│ [████████████░░░░░░] 60%                               │
│                                                         │
│ ✅ Monday, Jan 20 - Upper Body Strength (45min)        │
│    4 exercises completed                                │
│    "Felt strong today!"                                 │
│                                                         │
│ ✅ Wednesday, Jan 22 - Cardio Session (30min)          │
│    2 exercises completed                                │
│                                                         │
│ ✅ Friday, Jan 24 - Lower Body Power (50min)           │
│    5 exercises completed                                │
│                                                         │
│ ❌ Tuesday, Jan 21 - Core Work (Not completed)         │
│ ❌ Saturday, Jan 25 - Active Recovery (Not completed)  │
│                                                         │
│ [+ Add Workout] [Edit Workouts]                        │ ← Inline editing capability
│                                                         │
│ Weekly Reflection (Optional)                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ How did this week go? Any challenges or wins?      │ │
│ │ [Large text area for user input...]                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]    [Complete Week & Generate Next 🚀]         │
└─────────────────────────────────────────────────────────┘
```

**Specific Elements:**
1. **Dialog Title**: Shows week number, date range, AND focus/title
2. **Progress Summary**: Completion count and percentage with progress bar
3. **Workout List**: Shows ALL workouts (completed with ✅, not completed with ❌)
4. **Inline Editing**: 
   - [+ Add Workout] button allows adding ad-hoc workouts
   - [Edit Workouts] opens workout editor inline or as sub-dialog
5. **Weekly Reflection**: Large text area (4+ rows), optional
6. **Actions**: 
   - Cancel: Close dialog without completing
   - Complete & Generate: Triggers completion flow

### **Loading State During Generation**
```
┌─────────────────────────────────────────────────────────┐
│ Generating Next Week...                                │
├─────────────────────────────────────────────────────────┤
│ [Spinner animation]                                    │
│                                                         │
│ Analyzing your progress and creating your              │
│ personalized plan for Week 2...                        │
└─────────────────────────────────────────────────────────┘
```

**Button State Change:**
- "Complete Week & Generate Next 🚀" → "Generating..."
- Button disabled during generation
- Dialog stays open, shows progress
- Auto-closes on success

### **Data Flow: Week Completion**

**Step 1: User Clicks Complete Button**
```typescript
// Extract completed workouts from current microcycle
const completedWorkouts = currentPlan.currentMicrocycle.workouts
  .filter(w => w.status === 'completed')
  .map(w => ({
    workoutId: w.id,
    name: w.name,
    date: w.date,
    exercises: w.exercises.map(e => ({
      exerciseId: e.id,
      name: e.name,
      sets: e.sets.map(s => ({ ...s, completed: s.completed || false }))
    })),
    duration: w.actualDuration,
    notes: w.notes,
    completed: true
  }));

const weeklyReflection = userInput; // From text area
```

**Step 2: Save to Workout History**
```typescript
// Save to: users/{userId}/workoutHistory/{weekId}
const historyDoc = {
  weekId: `${microcycle.dateRange.start}_week-${microcycle.week}`,
  weekNumber: microcycle.week,
  weekFocus: microcycle.focus,
  dateRange: microcycle.dateRange,
  completedWorkouts: completedWorkouts,
  weeklyReflection: weeklyReflection,
  completedAt: serverTimestamp(),
  planSnapshot: {
    macrocycleId: currentPlan.macrocycle.id,
    mesocycleId: currentPlan.mesocycle.id,
    microcycleId: microcycle.id
  }
};
```

**Step 3: Generate Next Week**
```typescript
// Fetch last 8 weeks of workout history
const workoutHistory = await getWorkoutHistory(userId, { limit: 8 });

// Prepare AI prompt
const promptData = {
  userProfile: user.profile,
  currentDate: new Date().toISOString(),
  currentPlan: {
    macrocycle: currentPlan.macrocycle,
    mesocycle: currentPlan.mesocycle,
  },
  previousMicrocycle: {
    planned: currentPlan.currentMicrocycle,
    actual: completedWorkouts
  },
  weeklyReflection: weeklyReflection,
  workoutHistory: workoutHistory, // Last 8 weeks
  nextWeekNumber: microcycle.week + 1,
  // Date range for next week - APP CALCULATES
  nextWeekDateRange: {
    start: addDays(microcycle.dateRange.end, 1), // Day after current week ends
    end: addDays(microcycle.dateRange.end, 7)    // 7 days later
  }
};

// Use prompt: prompts_fitness_plan_generate_next_microcycle
const response = await callOpenAI('prompts_fitness_plan_generate_next_microcycle', promptData);

// AI returns workouts with dayOfWeek only
// App assigns dates based on nextWeekDateRange
const nextMicrocycle = {
  ...response.microcycle,
  dateRange: promptData.nextWeekDateRange,
  workouts: response.microcycle.workouts.map(w => ({
    ...w,
    date: calculateDateFromDayOfWeek(w.dayOfWeek, promptData.nextWeekDateRange.start)
  }))
};
```

**Step 4: Update UI**
```typescript
// Replace current microcycle with new one
useFitnessPlanStore.setState({
  currentPlan: {
    ...currentPlan,
    currentMicrocycle: nextMicrocycle
  },
  generating: false
});

// Close dialog
// User sees new week with updated dates
```

---

## 🚨 **GAP/PAUSE FLOW: LONG PAUSE (7+ DAYS)**

### **Trigger Logic**
```typescript
const isLongGap = (microcycle: Microcycle): boolean => {
  if (!microcycle.dateRange) return false;
  
  const today = new Date();
  const weekEndDate = new Date(microcycle.dateRange.end);
  const daysSinceEnd = Math.floor((today.getTime() - weekEndDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Gap flow triggers 8+ days after week end
  return daysSinceEnd > 7;
};
```

### **When to Show Gap Recovery Dialog**
User opens app and:
1. Has an approved fitness plan
2. Current microcycle ended 8+ days ago
3. No new microcycle has been generated

**App behavior:** Immediately show Gap Recovery Dialog (full-screen, cannot dismiss without action)

### **Gap Recovery Dialog UI**
```
┌─────────────────────────────────────────────────────────┐
│                    Welcome Back! 👋                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Last active: Week 1 ended Jan 26 (15 days ago)        │ ← Show last active week
│                                                         │
│ Ready to get back on track with a fresh fitness plan?  │
│                                                         │
│ ┌───────────────────────────────────────────────────── │
│ │ 📝 What were you up to during this break? (Optional)│ │
│ │    This helps us tailor your return plan            │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ [Text area: "Traveling, sick, vacation..."]    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────── │
│                                                         │
│ ┌───────────────────────────────────────────────────── │
│ │ 🏋️ Did you do any workouts we should know about?    │ │
│ │                                                      │ │
│ │ [Previously completed workouts from Week 1:]        │ │
│ │ ✅ Monday, Jan 20 - Upper Body Strength            │ │
│ │ ✅ Wednesday, Jan 22 - Cardio Session              │ │
│ │                                                      │ │
│ │ [+ Add Workout]  [Edit Workouts]                   │ │ ← Allow adding gap workouts
│ └───────────────────────────────────────────────────── │
│                                                         │
│ ┌───────────────────────────────────────────────────── │
│ │ 👤 Review your profile to ensure it's up to date    │ │
│ │                                                      │ │
│ │ Goals: Build strength, Lose weight                 │ │
│ │ Fitness Level: Intermediate                        │ │
│ │ Available Equipment: Barbell, Dumbbells, Bench    │ │
│ │ Workout Days: 4 days/week                          │ │
│ │                                                      │ │
│ │ [Edit Profile]                                      │ │ ← Inline profile editing
│ └───────────────────────────────────────────────────── │
│                                                         │
│ [Generate Fresh Plan 🚀]                               │ ← PRIMARY ACTION
└─────────────────────────────────────────────────────────┘
```

**Critical Elements:**
1. **Last Active Info**: Shows which week ended and how long ago
2. **Gap Activities**: Optional text area for user to describe their break
3. **Workout Tracking**: 
   - Shows any completed workouts from last microcycle
   - Allows adding ad-hoc workouts done during gap
4. **Profile Review**: 
   - Shows current profile data
   - Allows inline editing or opens profile editor
5. **Generate Button**: Primary action, cannot be skipped

### **Data Flow: Gap Recovery**

**Step 1: Collect Gap Context**
```typescript
const gapContext = {
  gapDurationDays: Math.floor((today - microcycle.dateRange.end) / (1000 * 60 * 60 * 24)),
  gapActivities: userInputText, // From text area
  gapWorkouts: userAddedWorkouts, // Any workouts user added
  lastCompletedMicrocycle: {
    week: microcycle.week,
    dateRange: microcycle.dateRange,
    completedWorkouts: microcycle.completedWorkouts
  }
};
```

**Step 2: Fetch Workout History**
```typescript
// Get ALL workout history (no limit, but max last 6 months to avoid staleness)
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
const workoutHistory = await getWorkoutHistory(userId, { 
  startAfter: sixMonthsAgo.toISOString() 
});
```

**Step 3: Generate Return-to-Training Plan**
```typescript
const promptData = {
  userProfile: user.profile, // Current profile (may have been edited)
  currentDate: new Date().toISOString(),
  gapContext: gapContext,
  workoutHistory: workoutHistory,
  // For return, generate current week OR till end of next week (same logic as initial)
  weekDateRange: calculateInitialWeekRange(today)
};

// Use prompt: prompts_fitness_plan (general plan generation, not next microcycle)
const response = await callOpenAI('prompts_fitness_plan', promptData);

// Create fresh plan (new macrocycle, mesocycle, microcycle)
const freshPlan = {
  ...response.plan,
  status: 'approved', // Auto-approve for gap recovery
  currentMicrocycle: {
    ...response.plan.currentMicrocycle,
    dateRange: promptData.weekDateRange,
    workouts: response.plan.currentMicrocycle.workouts.map(w => ({
      ...w,
      date: calculateDateFromDayOfWeek(w.dayOfWeek, promptData.weekDateRange.start)
    }))
  }
};
```

**Step 4: Save Gap Record (Optional)**
```typescript
// Optionally save gap context to: users/{userId}/trainingGaps/{gapId}
const gapRecord = {
  startDate: microcycle.dateRange.end,
  endDate: today.toISOString(),
  durationDays: gapContext.gapDurationDays,
  activities: gapContext.gapActivities,
  workouts: gapContext.gapWorkouts,
  resumedAt: serverTimestamp()
};
```

**Step 5: Update UI & Start Fresh**
```typescript
// Replace entire plan with fresh plan
useFitnessPlanStore.setState({
  currentPlan: freshPlan,
  generating: false
});

// User sees new Week 1 (fresh start)
```

---

## 🎨 **UI SPECIFICATIONS**

### **Date Formatting Rules**
| Context | Format | Example |
|---------|--------|---------|
| Week Header | "{start} - {end} - {focus}" | "Jan 20 - 26 - Foundation Week" |
| Week Header (cross-month) | "{start} - {end} - {focus}" | "Jan 27 - Feb 2 - Strength Building" |
| Day Header | "{Weekday}, {Month} {Day}" | "Monday, Jan 20" |
| Dialog Title | "Complete Week: {start} - {end} - {focus}" | "Complete Week: Jan 20 - 26 - Foundation Week" |

### **Button States Specification**

| State | Condition | Color | Text | Enabled |
|-------|-----------|-------|------|---------|
| **Disabled** | Days 1-6 of microcycle | Gray outline | "Complete Week 🎯" | No |
| **Ready** | Last day (day 7) of week | Green primary + pulse | "Complete Week & Generate Next 🚀" | Yes |
| **Short Overdue** | 1-7 days after week end | Orange warning | "Complete Overdue Week & Generate Next ⚠️" | Yes |

### **Loading States**
| Context | Message | Visual |
|---------|---------|--------|
| Initial plan generation | "Generating your personalized plan..." | Full-screen skeleton |
| Plan regeneration | "Regenerating with your feedback..." | Full-screen skeleton |
| Week completion | "Generating next week..." | Button spinner + disabled |
| Gap recovery | "Creating your return-to-training plan..." | Full-screen skeleton |

---

## 💾 **FIREBASE DATA STRUCTURES**

### **Microcycle Type Update**
```typescript
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
  dateRange: DateRange; // NEW: REQUIRED (not optional)
}

export interface DateRange {
  start: string; // ISO date string: "2025-01-20"
  end: string;   // ISO date string: "2025-01-26"
}
```

### **Workout History Collection**
```
Collection: users/{userId}/workoutHistory/{weekId}

Document Structure:
{
  weekId: "2025-01-20_week-1",
  weekNumber: 1,
  weekFocus: "Foundation Week",
  dateRange: {
    start: "2025-01-20",
    end: "2025-01-26"
  },
  completedWorkouts: [ /* CompletedWorkout[] */ ],
  weeklyReflection: "Great week! Felt strong.",
  completedAt: Timestamp,
  planSnapshot: {
    macrocycleId: "macro-1",
    mesocycleId: "meso-1",
    microcycleId: "micro-1"
  }
}
```

### **Training Gaps Collection (Optional)**
```
Collection: users/{userId}/trainingGaps/{gapId}

Document Structure:
{
  gapId: "gap-2025-01-26",
  startDate: "2025-01-26",
  endDate: "2025-02-10",
  durationDays: 15,
  activities: "Was traveling for work, did some hotel workouts",
  workouts: [ /* Any ad-hoc workouts user added */ ],
  resumedAt: Timestamp
}
```

---

## 🤖 **AI GENERATION SPECIFICATIONS**

### **Prompt Inventory**

| Prompt Key | Use Case | Context Data |
|------------|----------|--------------|
| `prompts_fitness_plan_generation` | Initial plan (Mon-Thu) | User profile, current date, week date range |
| `prompts_fitness_plan_generation_rest_of_the_week` | Initial plan (Fri-Sun) | User profile, current date, extended week date range |
| `prompts_fitness_plan_regenerate_with_comment` | User requests regeneration | User profile, current date, previous plan, user comment |
| `prompts_fitness_plan_generate_next_microcycle` | Happy path progression | User profile, previous microcycle (planned + actual), history, reflection, next week date range |
| `prompts_fitness_plan` | Gap recovery | User profile, gap context, workout history, week date range |

### **Critical AI Response Rule**
**AI MUST return workouts with `dayOfWeek` field ONLY (1=Monday, 0=Sunday).**

**App (not AI) calculates and assigns actual dates** based on provided date range.

```typescript
// AI Response (what AI returns)
{
  microcycle: {
    week: 2,
    focus: "Strength Building",
    workouts: [
      { dayOfWeek: 1, name: "Upper Body", ... }, // Monday
      { dayOfWeek: 3, name: "Lower Body", ... }, // Wednesday
      { dayOfWeek: 5, name: "Full Body", ... }   // Friday
    ]
  }
}

// App Processing (what app does)
const microcycleWithDates = {
  ...aiResponse.microcycle,
  dateRange: { start: "2025-01-27", end: "2025-02-02" },
  workouts: aiResponse.microcycle.workouts.map(workout => ({
    ...workout,
    date: calculateDateFromDayOfWeek(workout.dayOfWeek, "2025-01-27")
  }))
};
```

### **Workout History Context Limits**
- **Normal progression**: Include last 8 weeks
- **Gap recovery**: Include all history from last 6 months (max)
- **Very long gaps (6+ months)**: Treat as new user, ignore old history

---

## ⚠️ **EDGE CASES & ERROR HANDLING**

### **Profile Issues**
- **Incomplete profile during gap recovery**: Force profile completion before plan generation
- **Missing equipment**: Show warning, allow generation with bodyweight exercises

### **Date Edge Cases**
- **Month boundaries**: Handle weeks spanning months (e.g., "Jan 27 - Feb 2")
- **Year boundaries**: Handle New Year transitions (e.g., "Dec 30 - Jan 5")
- **Timezone**: Always use user's local timezone for date calculations

### **AI Generation Failures**
- **Network error**: Show retry button, maintain dialog state with user input
- **Invalid response**: Log error, show user-friendly message, offer retry
- **Timeout**: 30-second timeout, graceful fallback with error message

### **Data Consistency**
- **Multiple devices**: Real-time sync prevents conflicts (existing mutation tracker)
- **Offline usage**: Queue operations, sync when online
- **Corrupted data**: Validate on load, offer regeneration if needed

### **User Behavior Edge Cases**
- **No completed workouts**: Allow completion with 0% rate, adjust next week accordingly
- **All workouts completed early**: Still enforce waiting until last day to complete week
- **Very long gaps (6+ months)**: Treat as new user, ignore old history, fresh macrocycle
- **Rapid completions**: Prevent double-submissions with loading states and button disabling
- **Exiting gap dialog**: Must generate plan (no dismiss option) to continue using app

---

## ✅ **SUCCESS CRITERIA**

### **Initial Generation**
1. ✅ Correct prompt selected based on day of week (Mon-Thu vs Fri-Sun)
2. ✅ Week duration matches specification
3. ✅ User can regenerate with comments
4. ✅ Approval flow works correctly

### **Normal Progression**
1. ✅ Week headers show date ranges AND focus/title
2. ✅ Day headers include actual dates
3. ✅ Complete Week button appears only when appropriate (day 7 + up to 7 days)
4. ✅ Completion dialog shows accurate progress and ALL workouts
5. ✅ User can add/edit workouts within completion dialog
6. ✅ Weekly reflection is captured and used for next generation
7. ✅ Workout history is permanently saved to Firebase
8. ✅ Next week generation includes workout history context (last 8 weeks)
9. ✅ Generated weeks include proper date ranges

### **Gap Recovery**
1. ✅ Gap recovery dialog triggers at correct time (8+ days after week end)
2. ✅ Last active info is displayed correctly
3. ✅ User can describe gap activities (optional)
4. ✅ User can add workouts done during gap
5. ✅ User can review/edit profile inline
6. ✅ Fresh plan is generated with gap context
7. ✅ Plan starts from current date (fresh macrocycle)

### **Progress Page**
1. ✅ Historical workouts are displayed from workoutHistory collection
2. ✅ Volume statistics calculated correctly
3. ✅ Progress trends visualized
4. ✅ Filtering and sorting work as expected

---

## 📊 **TESTING CHECKLIST**

- [ ] Initial plan generation (Monday)
- [ ] Initial plan generation (Thursday)
- [ ] Initial plan generation (Friday)
- [ ] Initial plan generation (Sunday)
- [ ] Plan regeneration with comment
- [ ] Week completion button states (disabled → enabled → overdue)
- [ ] Week completion dialog with 0% completion
- [ ] Week completion dialog with 100% completion
- [ ] Week completion dialog with mixed completion
- [ ] Inline workout editing in completion dialog
- [ ] Weekly reflection capture
- [ ] Workout history saving to Firebase
- [ ] Next week generation with history context
- [ ] Gap recovery dialog trigger (8 days)
- [ ] Gap recovery dialog trigger (30 days)
- [ ] Gap recovery with gap activities
- [ ] Gap recovery with added workouts
- [ ] Gap recovery with profile editing
- [ ] Cross-month week display (Jan-Feb)
- [ ] Cross-year week display (Dec-Jan)
- [ ] Multi-device real-time sync during week completion
- [ ] Offline queueing and sync
- [ ] AI generation error handling
- [ ] Network failure retry
- [ ] Progress page display with historical data
