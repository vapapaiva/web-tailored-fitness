# Fitness Plan Generation & Week Completion - Enhanced Two-Step UX

## 🎯 **OVERVIEW**

This document defines an **enhanced two-step approach** to fitness planning where **strategic goal setting** (macro/mesocycles) is separated from **tactical week planning** (microcycles). This provides better user control, flexibility to change goals mid-journey, and clearer decision-making.

**Key Difference from Current UX:**
- **Current**: Single-step generation (macro + meso + micro in one prompt)
- **Enhanced**: Two-step generation (goals first, then weekly workouts)

---

## **STEP 1: GOAL SETTING (MACRO/MESOCYCLES)**

### **What Changes in Profile Structure**

**Current Profile:**
- Has a "Goals" field (e.g., "Build muscle", "Lose weight")
- Goals are part of general profile data

**Enhanced Profile:**
Splits into two sections:

#### **1. Personal Data** (remains in profile)
- Age, sex, height, weight
- Fitness level
- Available equipment
- Time constraints (days per week, minutes per session)
- Injuries/limitations

#### **2. Fitness Goals** (new dedicated section)
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Your Fitness Goals                                   │
├─────────────────────────────────────────────────────────┤
│ Primary Goals: [Build muscle, Lose weight]              │ ← From profile "Goals" field
│                                                          │
│ Additional Comments:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ • "Focus on upper body development"                 │ │
│ │ • "Want to improve cardiovascular endurance"        │ │
│ │ [+ Add Comment]                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Edit Goals] [Regenerate Training Plan with AI]         │
└─────────────────────────────────────────────────────────┘
```

**Goal Comments Features:**
- User can add unlimited text comments
- Each comment can be edited/deleted
- Comments sent to AI for macro/meso generation
- Allows nuanced goal expression beyond dropdown options

---

## **INITIAL PLAN GENERATION (TWO-STEP)**

### **Step 1: Generate Strategic Plan (Macro/Meso)**

**Trigger:** User completes onboarding and has no fitness plan

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Define Your Training Goals                     │
├─────────────────────────────────────────────────────────┤
│ Let's create your 6-month training vision               │
│                                                         │
│ Primary Goals: Build muscle, Improve endurance         │
│                                                         │
│ Additional Comments:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Text area for custom goal details...]              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Generate Training Plan 🎯]                            │
└─────────────────────────────────────────────────────────┘
```

**On Generate:**
1. App gets `prompts_macrocycle_mesocycle_generation` from Firebase config
2. Populates with:
   - `{USER_PROFILE}` (personal data: age, fitness level, equipment, etc.)
   - `{PRIMARY_GOALS}` (from profile "Goals" field)
   - `{GOAL_COMMENTS}` (user's additional comments)
   - `{CURRENT_DATE}`
3. AI returns: Macrocycle + Mesocycles (NO microcycle yet)

**AI Response Structure:**
```json
{
  "macrocycle": {
    "name": "6-Month Strength Building",
    "focus": "Build muscle and strength",
    "durationWeeks": 24,
    "mesocycles": [
      {"name": "Foundation", "durationWeeks": 8, "focus": "..."},
      {"name": "Hypertrophy", "durationWeeks": 8, "focus": "..."},
      {"name": "Strength", "durationWeeks": 8, "focus": "..."}
    ]
  }
}
```

**Review & Approval UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Your 6-Month Training Plan                              │
├─────────────────────────────────────────────────────────┤
│ Goal: Build muscle and strength                         │
│                                                          │
│ Phase 1 (Weeks 1-8): Foundation                         │
│ Focus: Build base strength and technique                │
│                                                          │
│ Phase 2 (Weeks 9-16): Hypertrophy                       │
│ Focus: Muscle growth and volume                         │
│                                                          │
│ Phase 3 (Weeks 17-24): Strength                         │
│ Focus: Max strength development                         │
│                                                          │
│ [Want changes? Add comments and regenerate]             │
│ [Approve & Continue to Week Planning →]                 │
└─────────────────────────────────────────────────────────┘
```

### **Step 2: Generate First Week (Micro)**

**After approving macro/meso:**

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Step 2: Plan Your First Week                           │
├─────────────────────────────────────────────────────────┤
│ Based on your training plan:                            │
│ Phase 1: Foundation (Weeks 1-8)                         │
│                                                          │
│ [Generate This Week's Workouts 🚀]                      │
└─────────────────────────────────────────────────────────┘
```

**On Generate:**
1. App gets `prompts_microcycle_generation` from Firebase config
2. Populates with:
   - `{USER_PROFILE}` (personal data)
   - `{MACROCYCLE}` (approved strategic plan)
   - `{CURRENT_MESOCYCLE}` (which phase we're in)
   - `{WEEK_NUMBER}` (1 for first week)
   - `{WEEK_START_DATE}`, `{WEEK_END_DATE}` (calculated by app)
   - `{CURRENT_DATE}`
3. AI returns: Microcycle only (workouts for this week)

**Review & Approval:**
```
┌─────────────────────────────────────────────────────────┐
│ Week 1: Oct 7 - 13 - Foundation Week                   │
├─────────────────────────────────────────────────────────┤
│ Monday, Oct 7 - Upper Body Strength                     │
│ Wednesday, Oct 9 - Lower Body Strength                  │
│ Friday, Oct 11 - Cardio & Core                          │
│                                                          │
│ [Want changes? Add comments and regenerate]             │
│ [Approve & Start Training 🚀]                           │
└─────────────────────────────────────────────────────────┘
```

---

## **NORMAL PROGRESSION (HAPPY PATH)**

### **Weekly Completion**

**When:** User completes a week (same as current UX)

**Process:**
1. Complete week dialog (same as current)
2. Get `prompts_microcycle_generation_next` from Firebase config
3. Populate with:
   - `{USER_PROFILE}`
   - `{MACROCYCLE}`, `{CURRENT_MESOCYCLE}`
   - `{WEEK_NUMBER}` (incremented)
   - `{WEEK_START_DATE}`, `{WEEK_END_DATE}`
   - `{PREVIOUS_WEEK_PLANNED}`, `{PREVIOUS_WEEK_ACTUAL}`
   - `{WEEKLY_REFLECTION}`
   - `{WORKOUT_HISTORY}`
4. AI returns: Next microcycle only
5. User approves and continues

**Mesocycle Transitions:**
```
When transitioning from Phase 1 → Phase 2:
AI automatically uses new mesocycle context
No additional approval needed (seamless progression)
```

---

## **GOAL CHANGES MID-JOURNEY**

### **Trigger:** User realizes goals have changed

**UI Addition to Fitness Plan Page:**
```
┌─────────────────────────────────────────────────────────┐
│ Current Plan: Strength Building                         │
│ Phase 2: Hypertrophy (Week 12 of 24)                    │
│                                                          │
│ [Edit Training Goals]                                   │ ← NEW BUTTON
└─────────────────────────────────────────────────────────┘
```

**On Click "Edit Training Goals":**

**Option 1: Manual Edit**
```
┌─────────────────────────────────────────────────────────┐
│ Edit Training Plan                                      │
├─────────────────────────────────────────────────────────┤
│ Macrocycle Name: [Strength Building]                    │
│ Duration: [24] weeks                                    │
│                                                          │
│ Phase 1: [Foundation] - [8] weeks                       │
│ Phase 2: [Hypertrophy] - [8] weeks                      │
│ Phase 3: [Strength] - [8] weeks                         │
│                                                          │
│ [Cancel] [Save Changes]                                 │
└─────────────────────────────────────────────────────────┘
```

**Option 2: AI-Assisted Regeneration**
```
┌─────────────────────────────────────────────────────────┐
│ Regenerate Training Plan                                │
├─────────────────────────────────────────────────────────┤
│ What would you like to change about your training plan? │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ "I want to add more cardio to each phase"           │ │
│ │ "Focus on injury prevention and mobility"           │ │
│ │ "Reduce to 4-month plan due to time constraints"    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Cancel] [Regenerate Plan 🤖]                           │
└─────────────────────────────────────────────────────────┘
```

**After Regeneration:**
1. User reviews new macro/meso
2. User approves
3. App regenerates **current microcycle** within new framework
4. User continues with updated plan

---

## **GAP RECOVERY (TWO-STEP)**

### **Step 1: Review/Update Goals**

**Trigger:** User returns after 7+ days

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Welcome Back! 👋                                         │
├─────────────────────────────────────────────────────────┤
│ Last active: Week 3 ended Oct 9 (15 days ago)          │
│                                                          │
│ Let's check if your fitness goals are still valid       │
│                                                          │
│ 🎯 Your Training Goals                                  │
│ Previous Plan: Strength Building (24 weeks)             │
│   Phase 1: Foundation                                   │
│   Phase 2: Hypertrophy                                  │
│   Phase 3: Strength                                     │
│                                                          │
│ What were you up to during the break?                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Text area...]                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Workouts done during gap: [Add workouts...]             │
│                                                          │
│ Options:                                                │
│ [Keep Same Goals & Continue]                            │
│ [My Goals Have Changed - Regenerate]                    │
└─────────────────────────────────────────────────────────┘
```

**If "Keep Same Goals":**
- Skip to Step 2 (generate return-to-training micro)
- Use existing macro/meso with gap context

**If "My Goals Have Changed":**
- Show goal editing UI
- Option to manually edit or describe changes to AI
- Regenerate macro/meso with gap context
- Then proceed to Step 2

### **Step 2: Generate Return Workout Plan**

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Generate Your Return-to-Training Plan                   │
├─────────────────────────────────────────────────────────┤
│ Based on:                                               │
│ • 15-day training gap                                   │
│ • Your updated goals                                    │
│ • Previous training history                             │
│                                                          │
│ [Generate This Week's Workouts 🚀]                      │
└─────────────────────────────────────────────────────────┘
```

Same as normal micro generation, but with gap context.

---

## 🤖 **AI PROMPTS IN ENHANCED UX**

### **Prompt 1: Macro/Meso Generation (Initial)**
**Name:** `prompts_macrocycle_mesocycle_generation`

**When:** 
- Initial onboarding (after profile completion)
- User requests goal regeneration

**Populated With:**
- `{USER_PROFILE}` (personal data: age, fitness level, equipment, time)
- `{PRIMARY_GOALS}` (from profile "Goals" field)
- `{GOAL_COMMENTS}` (unlimited user comments array)
- `{CUSTOM_PROMPT}` (optional regeneration feedback)
- `{CURRENT_DATE}`

**Returns:**
```json
{
  "macrocycle": { ... },
  "mesocycles": [ {...}, {...}, {...} ]
}
```

### **Prompt 2: Macro/Meso Generation (Gap Recovery)**
**Name:** `prompts_macrocycle_mesocycle_generation_gap_recovery`

**When:** User returns after 7+ days and chooses "My Goals Have Changed"

**Populated With:**
- `{USER_PROFILE}`
- `{PRIMARY_GOALS}`
- `{GOAL_COMMENTS}`
- `{CUSTOM_PROMPT}`
- `{CURRENT_DATE}`
- `{GAP_DURATION_DAYS}`
- `{GAP_ACTIVITIES}` (what user did during gap)
- `{GAP_WORKOUTS}` (workouts done during gap)
- `{WORKOUT_HISTORY}` (last 6 months for context)
- `{PREVIOUS_MACROCYCLE}` (for reference)

**Returns:** Same as Prompt 1

### **Prompt 3: Microcycle Generation (Initial)**
**Name:** `prompts_microcycle_generation_initial`

**When:** 
- After macro/meso approval (first time)
- After gap recovery if goals kept same or regenerated

**Populated With:**
- `{USER_PROFILE}`
- `{MACROCYCLE}`
- `{CURRENT_MESOCYCLE}` (first mesocycle)
- `{WEEK_NUMBER}` (1 for initial)
- `{WEEK_START_DATE}`, `{WEEK_END_DATE}` (calculated by app)
- `{CURRENT_DATE}`
- **Gap recovery only:**
  - `{GAP_DURATION_DAYS}`
  - `{GAP_ACTIVITIES}`
  - `{GAP_WORKOUTS}`
  - `{WORKOUT_HISTORY}`

**Returns:**
```json
{
  "currentMicrocycle": {
    "week": 1,
    "focus": "...",
    "workouts": [ ... ]
  }
}
```

### **Prompt 4: Microcycle Generation (Next Week)**
**Name:** `prompts_microcycle_generation_next`

**When:** User completes a week (happy path)

**Populated With:**
- `{USER_PROFILE}`
- `{MACROCYCLE}`, `{CURRENT_MESOCYCLE}`
- `{WEEK_NUMBER}` (incremented)
- `{WEEK_START_DATE}`, `{WEEK_END_DATE}`
- `{PREVIOUS_MICROCYCLE_PLANNED}`, `{PREVIOUS_MICROCYCLE_ACTUAL}`
- `{WEEKLY_REFLECTION}`
- `{WORKOUT_HISTORY}` (last 8 weeks)
- `{CURRENT_DATE}`

**Returns:** Next microcycle only

---

## **DETAILED FLOWS**

### **INITIAL ONBOARDING FLOW**

1. User completes profile (personal data)
2. **Goal Setting Screen** appears:
   - Shows primary goals from profile
   - Shows goal comments section (can add multiple)
   - "Generate Training Plan" button
3. User clicks generate → **Loading: "Creating your 6-month vision..."**
4. **Macro/Meso Review** appears:
   - Shows 6-month plan structure
   - Shows all phases (mesocycles)
   - Can regenerate with comments
   - **Must approve** before continuing
5. User approves → **Week Planning Screen** appears:
   - "Generate This Week's Workouts" button
   - Shows context (Phase 1, Week 1)
6. User clicks generate → **Loading: "Planning your first week..."**
7. **Week Review** appears:
   - Shows workouts with dates
   - Can regenerate with comments
   - Approve to start training
8. User approves → Training begins!

**Total Steps:** 2 generations + 2 approvals

---

### **WEEKLY PROGRESSION FLOW** (Same as Current)

1. User completes week
2. Completion dialog (progress review, reflection)
3. Click "Complete Week & Generate Next"
4. AI generates next microcycle (within existing macro/meso framework)
5. User approves new week
6. Training continues

**Total Steps:** 1 generation + 1 approval

---

### **GOAL CHANGE FLOW** (New Feature)

**Trigger:** User clicks "Edit Training Goals" from fitness plan page

**Flow:**
```
1. Edit Goals Dialog appears
   - Current goals displayed
   - Can edit goal comments
   - Option A: Manual edit (text fields)
   - Option B: Describe changes to AI

2. User chooses option and saves/regenerates

3. Macro/Meso Review appears
   - Shows new 6-month vision
   - Highlights what changed
   - User approves

4. Current Week Regeneration
   - App regenerates current microcycle within new framework
   - User reviews and approves
   - Training continues with new goals
```

---

### **GAP RECOVERY FLOW** (Enhanced)

**Trigger:** User returns after 7+ days

**Flow:**
```
1. Welcome Back Screen appears
   - Last active info
   - Gap duration
   - "What were you up to?" text area
   - Workouts done during gap (add/edit/delete)
   
2. Goal Review Section
   - Shows previous macro/meso
   - Question: "Are your fitness goals still the same?"
   - [Yes, Keep Same Goals]
   - [No, My Goals Have Changed]

3a. If "Keep Same Goals":
    → Skip to step 4 (generate return micro)

3b. If "Goals Changed":
    → Show goal editing UI
    → Regenerate macro/meso with gap context
    → User reviews and approves new strategic plan
    → Proceed to step 4

4. Generate Return-to-Training Week
   - Uses approved macro/meso (existing or new)
   - Includes gap context (duration, activities, workouts)
   - Includes workout history
   - User reviews and approves
   - Training resumes!
```

---

## **PROFILE STRUCTURE IN ENHANCED UX**

### **Personal Data Section** (Always in Profile Page)
- Age, Sex, Height, Weight
- Fitness Level
- Available Equipment
- Workout Days per Week
- Workout Duration
- Injuries/Limitations

### **Fitness Goals Section** (Separate UI)

**Location:** Can be accessed from:
- Initial onboarding flow
- "Edit Training Goals" button on fitness plan page
- Gap recovery flow

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Fitness Goals                                        │
├─────────────────────────────────────────────────────────┤
│ Primary Goals (from profile):                           │
│ ☑ Build muscle                                          │
│ ☑ Improve endurance                                     │
│ ☐ Lose weight                                           │
│ ☐ Improve flexibility                                   │
│                                                          │
│ Additional Goal Details:                                │
│ • "Focus on upper body - arms and chest"                │
│ • "Want to run a 10K by end of plan"                    │
│ • "Avoid exercises that stress lower back"              │
│ [+ Add Comment]                                         │
│                                                          │
│ [Save] [Generate/Regenerate Training Plan]              │
└─────────────────────────────────────────────────────────┘
```

**Comment Management:**
- Click comment to edit
- Delete button (X) to remove
- Add button to create new
- All saved to user profile

---

## **BENEFITS OF ENHANCED UX**

### **For Users:**
1. ✅ **Flexibility**: Change goals without starting over
2. ✅ **Clarity**: Strategic decisions separate from weekly tactics
3. ✅ **Control**: Can regenerate goals anytime
4. ✅ **Context**: Better AI understanding through detailed goal comments
5. ✅ **Continuity**: Keep progress while adjusting direction

### **For AI:**
1. ✅ **Focused Prompts**: Each prompt has clear, single purpose
2. ✅ **Better Context**: Goal comments provide nuanced understanding
3. ✅ **Consistency**: Micros always align with approved macro/meso
4. ✅ **Adaptability**: Can adjust to goal changes mid-journey

---

## **IMPLEMENTATION NOTES**

### **Data Storage**

**User Profile:**
```typescript
{
  // Personal data (unchanged)
  age: 30,
  fitnessLevel: "Intermediate",
  equipment: ["Barbell", "Dumbbells"],
  
  // Goals (unchanged field, but used differently)
  goals: ["Build muscle", "Improve endurance"],
  
  // NEW: Goal comments (stored as array)
  goalComments: [
    "Focus on upper body development",
    "Want to improve cardiovascular endurance",
    "Avoid exercises that stress lower back"
  ]
}
```

**Fitness Plan:**
```typescript
{
  macrocycle: { ... }, // Can be regenerated
  mesocycles: [ ... ], // Can be regenerated
  currentMicrocycle: { ... }, // Regenerated weekly or on goal change
  
  // NEW: Track if macro/meso needs user review after regeneration
  needsMacroMesoApproval: boolean,
  previousMacrocycle?: { ... } // For comparison when goals change
}
```

### **UI Components Needed**

**New Components:**
1. `GoalManagementSection.tsx` - Edit goals and comments
2. `MacroMesoReview.tsx` - Review and approve strategic plan
3. `MacroMesoComparison.tsx` - Show changes when regenerating

**Modified Components:**
4. `ProfilePage.tsx` - Remove goals, add link to goal management
5. `FitnessPlanPage.tsx` - Add "Edit Training Goals" button
6. `GapRecoveryPage.tsx` - Add goal review section

---

## **MIGRATION PATH**

### **From Current → Enhanced:**

**Phase 1: Add Goal Comments** (Quick)
- Add `goalComments` field to profile
- Add UI for managing comments
- Send to existing single-step prompts

**Phase 2: Two-Step Generation** (Complex)
- Create macro/meso prompts
- Create separate micro prompts
- Add approval flows
- Migration: existing plans get default macro/meso extracted

**Phase 3: Goal Editing** (Feature)
- Add "Edit Training Goals" button
- Add regeneration flow
- Add change comparison UI

---

## **FUTURE ENHANCEMENTS**

### **Goal Templates**
Pre-defined goal combinations:
- "First-Time Lifter" → Foundation-focused plan
- "Weight Loss Journey" → Cardio + strength balance
- "Strength Athlete" → Progressive strength focus
- "General Fitness" → Balanced approach

### **Goal Analytics**
Track goal evolution:
- When goals changed
- What triggered the change
- How plan adapted
- Progress toward original vs new goals

### **Collaborative Planning**
AI asks clarifying questions:
- "Do you prefer morning or evening workouts?"
- "How important is muscle gain vs fat loss?"
- "Any specific events/deadlines to train for?"

---

## ⚠️ **IMPORTANT NOTES FOR IMPLEMENTATION**

### **Backward Compatibility**
Existing plans with single-step generation:
- Continue to work
- No forced migration
- Can opt-in to enhanced UX

### **Prompt Versioning**
All prompts should include:
- Version number
- Last updated date
- Backward compatibility notes

### **User Experience**
- Two-step should feel natural, not burdensome
- Clear progress indicators (Step 1 of 2, Step 2 of 2)
- Can always skip back if needed
- Tooltips explain why two steps

---

## 📝 **SUMMARY**

**Enhanced UX = Goals-First Approach:**
1. Define strategic vision (macro/meso) 
2. Plan tactical execution (micro)
3. Change goals anytime mid-journey
4. Better alignment between user intent and AI planning

**Implementation Complexity:**
- High (new flows, new prompts, new UI)
- But provides significantly better UX
- Especially for users whose goals evolve

**Recommendation:**
- Document now (this file)
- Implement in Phase 9+ as enhancement
- Start with simple single-step for MVP
- Gather user feedback before investing in two-step

---

## 🔄 **RELATIONSHIP TO CURRENT UX**

This document describes the **future enhanced state**.

Current implementation (in `COMPLETE_APP_LOOP_UX.md`) is the **MVP baseline**.

Both are valid approaches:
- **Current**: Faster to ship, simpler to use initially
- **Enhanced**: More powerful, better for long-term use

Users can start with current, migrate to enhanced later.

---

**Last Updated:** 2025-10-10
**Status:** Specification only - not yet implemented
**Priority:** Phase 9+ enhancement (after MVP complete)

