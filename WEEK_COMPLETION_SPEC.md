# Week Completion Flow - UX/UI Specification

## 🎯 **OBJECTIVE**
Define the specific UX/UI changes needed to implement a week completion flow that allows users to review their progress and generate the next week.

## 📱 **UI CHANGES REQUIRED**

### **1. Main Fitness Plan Page Header**

#### **CURRENT STATE:**
```
Week 1
[Workout cards below...]
```

#### **WHAT WE NEED:**
```
Week 1: Jan 20 - 26
[Complete Week 🎯 button - only when week period has ended]
[Workout cards below...]
```

**Specific Changes:**
- **Week Header Format**: Change from "Week 1" to "Week 1: Jan 20 - 26"
- **Cross-Month Format**: When spanning months: "Week 1: Jan 27 - Feb 2"
- **Complete Week Button**: Large, prominent button that only appears when `today >= week end date`
- **Button Text**: "Complete Week 🎯"
- **Button Styling**: Large size, primary styling to draw attention

### **2. Weekly Schedule Display**

#### **CURRENT STATE:**
```
Monday     Tuesday    Wednesday   Thursday    Friday     Saturday   Sunday
[workout]  [workout]  [workout]   [workout]   [workout]  [workout]  [workout]
```

#### **WHAT WE NEED:**
```
Monday, Jan 20    Tuesday, Jan 21    Wednesday, Jan 22    Thursday, Jan 23    Friday, Jan 24    Saturday, Jan 25    Sunday, Jan 26
[workout]         [workout]          [workout]            [workout]           [workout]         [workout]           [workout]
```

**Specific Changes:**
- **Day Headers**: Add actual dates to weekday names
- **Format**: "Monday, Jan 20" (weekday, month abbreviation, day)
- **Workout Cards**: Keep exactly the same as current implementation
- **No Changes to Workout Cards**: Cards themselves don't need date modifications

### **3. Week Completion Dialog (NEW COMPONENT)**

#### **CURRENT STATE:**
*Does not exist*

#### **WHAT WE NEED:**
```
┌─────────────────────────────────────────────────────────┐
│ Complete Week: Jan 20 - 26                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Completed Workouts (3/5)                               │
│ [████████░░] 60%                                        │
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
│ Weekly Reflection                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ How did this week go? Any challenges or wins?      │ │
│ │                                                     │ │
│ │ [Large text area for user input...]                │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Back to Edit Workouts]    [Generate Next Week 🚀]     │
└─────────────────────────────────────────────────────────┘
```

**Specific Elements:**
- **Dialog Title**: "Complete Week: Jan 20 - 26" (date range format)
- **Progress Section**: 
  - Completion count: "Completed Workouts (3/5)"
  - Progress bar showing completion percentage
- **Completed Workouts List**: 
  - Only show workouts marked as completed
  - Format: "✅ Monday, Jan 20 - Workout Name (duration)"
  - Show exercise count: "4 exercises completed"
  - Show workout notes if present: "Felt strong today!"
- **Weekly Reflection**:
  - Large text area (4+ rows)
  - Placeholder: "How did this week go? Any challenges or wins?"
- **Action Buttons**:
  - Left: "Back to Edit Workouts" (outline style)
  - Right: "Generate Next Week 🚀" (primary green style)

### **4. Loading State During Generation**

#### **CURRENT STATE:**
*No loading state for week completion*

#### **WHAT WE NEED:**
- **Button State Change**: "Generate Next Week 🚀" → "Generating Next Week..."
- **Button Disabled**: Prevent multiple clicks during generation
- **Dialog Behavior**: Keep dialog open during generation, close automatically when complete

## 🔄 **USER INTERACTION FLOWS**

### **Primary Flow:**
1. **User sees week with dates** in header and day labels
2. **User completes workouts** throughout the week (existing functionality)
3. **"Complete Week" button appears** when week period ends
4. **User clicks "Complete Week"** → Opens completion dialog
5. **User reviews completed workouts** (only completed ones shown)
6. **User adds weekly reflection** in text area
7. **User clicks "Generate Next Week"** → Button shows loading state
8. **System saves workout history to Firebase** (see Data Persistence section)
9. **System generates tailored next week** using AI with complete context
10. **Dialog closes, new week appears** with proper date ranges

### **Alternative Flow:**
- **User clicks "Back to Edit Workouts"** → Returns to main page
- **User can mark more workouts complete** → Can return to completion dialog
- **Updated completion data** shown in dialog

## 🎨 **VISUAL SPECIFICATIONS**

### **Date Formatting Rules:**
- **Week Header**: "Week {number}: {start_month} {start_day} - {end_day}" or "Week {number}: {start_month} {start_day} - {end_month} {end_day}"
- **Day Headers**: "{Weekday}, {Month} {Day}" (e.g., "Monday, Jan 20")
- **Dialog Dates**: Same format as week header

### **Button Specifications:**
- **Complete Week Button**: Large size, primary styling, only visible when week can be completed
- **Dialog Buttons**: Standard size, outline vs primary styling
- **Loading State**: Disabled appearance with loading text

### **Progress Visualization:**
- **Progress Bar**: Standard progress component showing completion percentage
- **Completion Count**: Clear fraction format "(3/5)"
- **Workout Status**: Checkmark emoji for completed workouts

## ✅ **IMPLEMENTATION CHECKLIST**

### **Phase 1: Date Display**
- [ ] Update week header to show date range format
- [ ] Update day headers in weekly schedule to include dates  
- [ ] Ensure proper formatting for cross-month weeks

### **Phase 2: Week Completion Button**
- [ ] Add "Complete Week" button to main page
- [ ] Implement logic to show button only when week period has ended
- [ ] Style button as large and prominent

### **Phase 3: Completion Dialog**
- [ ] Create new WeekCompletionDialog component
- [ ] Implement progress visualization (count + progress bar)
- [ ] Show only completed workouts with details
- [ ] Add weekly reflection text area
- [ ] Implement action buttons with proper styling

### **Phase 4: Loading States**
- [ ] Add loading state to "Generate Next Week" button
- [ ] Prevent multiple submissions during generation
- [ ] Handle dialog close after successful generation

### **Phase 5: Data Persistence**
- [ ] Create Firebase `workoutHistory` collection structure
- [ ] Implement workout history saving logic
- [ ] Add workout history retrieval for Progress page
- [ ] Calculate volume statistics from historical data

### **Phase 6: AI Generation Enhancement**
- [ ] Update Firebase Remote Config prompts to request explicit dates
- [ ] Modify AI generation to include workout history context
- [ ] Ensure AI response includes proper date ranges
- [ ] Integrate weekly reflection into AI prompt context

### **Phase 7: Integration & Testing**
- [ ] Connect dialog to week completion logic
- [ ] Ensure proper data flow between components
- [ ] Test complete user flow end-to-end
- [ ] Verify Progress page displays historical data correctly

## 💾 **DATA PERSISTENCE & AI GENERATION**

### **Firebase Data Storage**
When user completes a week and clicks "Generate Next Week":

#### **1. Save Workout History**
Store completed workouts in Firebase collection: `users/{userId}/workoutHistory/{weekId}`

**Document Structure:**
```typescript
{
  weekId: string;           // e.g., "2025-01-20_week-1"
  weekNumber: number;       // 1, 2, 3...
  dateRange: {
    start: string;          // "2025-01-20"
    end: string;            // "2025-01-26"
  };
  completedWorkouts: [
    {
      date: string;         // "2025-01-20"
      workoutName: string;  // "Upper Body Strength"
      duration: number;     // minutes
      exercises: [
        {
          name: string;     // "Bench Press"
          volumeRows: [
            {
              sets: number;
              reps?: number;
              weight?: number;
              distance?: number;
              duration?: number;
              unit: string; // "reps", "kg", "km", "min"
            }
          ]
        }
      ];
      notes?: string;       // User's workout notes
    }
  ];
  weeklyReflection: string; // User's weekly reflection
  completedAt: timestamp;   // When week was completed
}
```

#### **2. Progress Page Integration**
- **Display workout history** from `workoutHistory` collection
- **Calculate weekly volume stats** by exercise type and muscle group
- **Show progression over time** with charts and trends
- **Filter by date ranges** and exercise categories

### **AI-Powered Next Week Generation**

#### **Prompt Context Assembly**
When generating next week, include in OpenAI prompt:

1. **User Profile Data** (from `users/{userId}/profile`)
2. **Current Fitness Plan Structure** (macro/meso/microcycle info)
3. **Complete Workout History** (all previous weeks from `workoutHistory`)
4. **Weekly Reflection** (from current week completion)

#### **Critical AI Response Requirement**
**MANDATORY**: AI response must include explicit date ranges:

```json
{
  "weekNumber": 2,
  "dateRange": {
    "start": "2025-01-27",
    "end": "2025-02-02"
  },
  "workouts": [...]
}
```

**Why This Matters:**
- Week completion button logic relies on `dateRange.end` to determine when to show
- Without explicit dates, the system cannot properly track week boundaries
- Ensures consistent date handling across the application

#### **Prompt Enhancement Requirements**
Update Firebase Remote Config `prompts_fitness_plan_generation` to:
- Request explicit date ranges in response
- Include workout history context
- Incorporate weekly reflections for personalization
- Consider volume progression based on completed exercises

## 🎯 **SUCCESS CRITERIA**

1. **Week headers show actual date ranges** in specified format
2. **Day headers include actual dates** alongside weekday names
3. **Complete Week button appears** only when appropriate
4. **Completion dialog shows accurate progress** and only completed workouts
5. **Weekly reflection is captured** and used for next week generation
6. **Loading states provide clear feedback** during generation process
7. **User can navigate back** to edit workouts if needed
8. **Workout history is permanently saved** to Firebase with complete exercise data
9. **Progress page displays historical workouts** with volume statistics
10. **AI generates contextually aware next week** using complete workout history
11. **Generated weeks include explicit date ranges** for proper week boundary tracking
