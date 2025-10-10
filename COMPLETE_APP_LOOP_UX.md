# Fitness Plan Generation & Week Completion - UX Specification

## 🎯 **OVERVIEW**

This document defines the complete user experience for initial fitness plan generation, weekly progression, week completion, and next week generation. Focus is on practical UX flows and clear specifications.

---

## **INITIAL PLAN GENERATION**

### **1. Generate and approve plan**
1. User opens an app and signs in
2. User completes onboarding (if user has not completed onboarding — they have to do it; ✅ is already covered by current codebase)
3. User sees prompt "Generate fitness plan" (✅ is already covered by current codebase)
3.1. App gets prompt from firebase config (prompts_fitness_plan_generation), populate it with user profile data  (✅ is already covered by current codebase)
3.2. App sends populated prompt to LLM and gets a JSON formated responce with workouts assigned to specific weekdays. App parses it to show in UI in Fitness plan secion  (✅ is already covered by current codebase). **Data Sent to AI**:
- Complete user profile (goals, fitness level, equipment, time constraints, etc.)
- Current date for proper week scheduling
- No workout history (first plan)
4. User sees suggested plan, they can regenerate it with comments if they want or approve plan to start working out following it. **AI Response Processing**:
- AI returns Macro, meso and microcycle description
- AI returns workouts with `dayOfWeek` only (1=Monday, 0=Sunday)
- App calculates current week date range (Monday-Sunday)
- App assigns actual dates to all workouts
- Plan saved to Firebase with complete date information
4.1. If user regenerates plan app gets prompt from firebase config (prompts_fitness_plan_regenerate_with_comment) and populates it with (1) Complete user profile, (2) Current date for proper week scheduling, (3) previous fitness plan data and (4, optional) user tracked workouts (if there are any) (⚠️ we need to ensure it's covered)
4.2. App sends populated prompt to LLM and gets a JSON formated responce with workouts assigned to specific weekdays. App parses it to show in UI in Fitness plan section. **AI Response Processing**:
- AI returns Macro, meso and microcycle description
- AI returns workouts with `dayOfWeek` only (1=Monday, 0=Sunday)
- App calculates current week date range (Monday-Sunday)
- App assigns actual dates to all workouts
- Plan saved to Firebase with complete date information

**Important - Smart Date Logic (Applied Consistently Across All Generation):**

The app uses smart date logic for ALL plan generation (initial, gap recovery, next microcycle):

- **Monday to Thursday**: Generate from today to end of current week (Sunday)
  - Example: Generate on Wed Oct 8 → Plan for Oct 8-12 (Wed-Sun, 5 days)
  
- **Friday to Sunday**: Generate from today to end of NEXT week (next Sunday)
  - Example: Generate on Fri Oct 10 → Plan for Oct 10-19 (Fri-next Sun, 10 days)

**Why this logic:**
- Prevents generating plans that start in the past
- Provides adequate planning horizon (at least 5 days)
- Users on weekends get extended period to plan ahead

**Applied to:**
- ✅ Initial plan generation
- ✅ Gap recovery plan generation  
- ✅ Next microcycle generation (when completing week)

**Week Completion Button:**
- Button becomes active on the LAST DAY of the current microcycle
- For standard weeks: Sunday (day 7)
- For extended periods: Could be any day (depends on when plan was generated)
- When user completes, next period uses smart logic based on completion day

### **2. User works out following the plan**
User opens workout cards and tracks which exercises they've done. User can add/delete/edit exercises in workout as well as add/delete workouts in Fitness plan section of the app (✅ is already covered by current codebase)

Whenever user marks workout as done/undone it should be properly represented in the "done workouts" and in progress section of the app (⚠️ we need to ensure it's covered)

All the time on the Fitness plan page should be present a "complete week" button. It's not active until the last day of the planned microcycle (but it shows user an explanation that it will become active once the microcycle comes to an end, so user can generate a tailored fitness plan for the next week). From the last day of the microcycle it becomes active and highlighted so user can press it to complete the week and get next microcycle fitness plan. 

If user opens an app on last day of current microcycle (and any time up to last day of microcycle + 7 days) — app considers it to be a **HAPPY PATH FLOW** and just looks as described above: opens a fitness plan section with highlighted and active "complete week" button.

However, if user had a longer pause and haven't completed the week 8+ days after the last date of microcycle — aoo considers it to be a **GAP/PAUSE PATH FLOW**

**HAPPY PATH FLOW** and **GAP/PAUSE PATH FLOW** will be described below in detail


---

## **HAPPY PATH FLOW**
**Visual State - Days 1-6**:
```
Week: [start date] - [end date] [week title]

┌─────────────────────────────────────────────────────────┐
│          Complete Week 🎯          [DISABLED]          │
└─────────────────────────────────────────────────────────┘

💡 Complete this week on Sunday, [end date] to save your progress

[Workout cards with actual dates: "Monday, Oct 5", "Tuesday, Oct 6"...]

```

**Visual State - starts on the last day of microcycle and continues 7 more days afterwars**:
```
Week: [start date] - [end date] [week title]

┌─────────────────────────────────────────────────────────┐
│    Complete Week & Generate Next 🚀   [ENABLED]        │ ← GREEN + HIGHLIGHTED
└─────────────────────────────────────────────────────────┘

🎯 Week ends today! Complete it now to generate your personalized plan

[Workout cards with actual dates...]

```

**Completion Dialog Flow**:
1. **Dialog Opens**: "Complete Week X: [start date] - [end date] [week title]"
2. **Progress Summary**: Shows completion rate and stats
3. **Completed Workouts List**: Only shows workouts marked as completed with a way to add/edit workouts (the same way this works in fitness plan editing)
4. **Weekly Reflection**: Text area for user notes (optional)
5. **Actions**: "Cancel" | "Complete Week & Generate Next 🚀"
6. **Loading State**: on pressing "Complete Week & Generate Next 🚀" app does next:
6.1. Shows "Generating next week..." with skeleton (as in initial plan generation)
6.2. Gets prompt to generate next week plan from firebase config (prompts_fitness_plan_generate_next_microcycle) and populates it with (1) Complete user profile, (2) Current date for proper week scheduling, (3) previous fitness plan data (macro, meso), (4) Last microcycle planned (from previous plan) and actual (workouts users tracked for this microcycle) and (4) user tracked workouts for the previous time (if there are any)
6.3. App sends populated prompt to LLM and gets a JSON formated responce with workouts assigned to specific weekdays. App parses it to show in UI in Fitness plan section (user can add comment and regenerate plan). User can regenerate it same way as it was described for the initial plan regeneration. Once user approves new plan — app uses it as next week microcycle
7. **Success**: Dialog closes, new week appears with proper dates in fitness plan. **AI Response Processing**:
- AI returns Macro, meso and microcycle description (it can be same, can be different)
- AI returns workouts with `dayOfWeek` only (1=Monday, 0=Sunday)
- App calculates current week date range (Monday-Sunday)
- App assigns actual dates to all workouts
- Plan saved to Firebase with complete date information


### **Micro case: short overdue**

**Trigger**: (Current date) > (week end date) AND (Current date) < (week end date + 7 days)

**Visual State**:
```
Week 1: Oct 5 - 11 - Introduction and Adaptation
[Workout cards...]

┌─────────────────────────────────────────────────────────┐
│       Complete previous week & generate next ⚠️      [ENABLED]          │ ← ORANGE WARNING
└─────────────────────────────────────────────────────────┘

⚠️ This week ended 3 days ago. Complete it now to get back on track
```


## **GAP/PAUSE PATH FLOW**

**Trigger**: 7+ days since end data of current (last generated) microcycle

**Gap Recovery Dialog**:
```
┌─────────────────────────────────────────────────────────┐
│                    Welcome Back! 👋                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Haven't seen you for a while!                 │
│ Ready to get back on track with a fresh fitness plan?  │
│                                                         │
│ Tell us what were you up to during this time? This will help us to tailor fitness plan to you (Optional)       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Text area for gap activities...]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│ Also you can add workouts that we should know about:
[UI to adding/editing workouts, same as in the fitness plan section of the app currently; if last microcycle has any workouts marked as done — they should be shown here]
                                                     │
│ 📋 Review your profile to ensure it's up to date   
[Profile data including goals]  -> user can edit and save it
│                                                         │
│ [Generate Plan 🚀]  │
└─────────────────────────────────────────────────────────┘
```
 
**On pressing [Generate Plan 🚀] app:**
1. Shows "Generating tailored fitness plan..." with skeleton (as in initial plan generation)
2. Gets prompt to generate tailored fitness plan(prompts_fitness_plan) and populates it with (1) Complete user profile, (2) Current date for proper week scheduling, (3) user tracked workouts for the previous time (if there are any), (4) Gap duration and gap activities user entered in dialog described above
6.3. App sends populated prompt to LLM and gets a JSON formated responce with workouts assigned to specific weekdays. App parses it to show in UI in Fitness plan section (user can add comment and regenerate plan). User can regenerate it same way as it was described for the initial plan regeneration. Once user approves new plan — app uses it as next week microcycle
---

## 🤖 **AI GENERATION SPECIFICATIONS**

### **Current Prompts (Simple Single-Step Approach)**

We use **2 prompts** in the current implementation:

#### **Prompt 1: `prompts_fitness_plan_generation`**
**Purpose:** Initial plan generation AND gap recovery plan generation

**When Used:**
- Initial plan generation (after onboarding)
- Gap recovery (user returns after 7+ days)
- Plan regeneration with user comments

**Populated With:**
- `{USER_PROFILE}` - Complete profile data (goals, fitness level, equipment, etc.)
- `{CUSTOM_PROMPT}` - User comments OR gap recovery context (see below)
- `{CURRENT_DATE}` - Current timestamp
- `{WEEK_DATE_RANGE}` - Target week range `{start: "YYYY-MM-DD", end: "YYYY-MM-DD"}`

**Week Date Range Logic:**
- **Mon-Thu**: App calculates current week (Monday to Sunday)
- **Fri-Sun**: App calculates extended period (current Friday to next Sunday)
- App passes calculated dates to AI, AI generates workouts for that period

**Custom Prompt Variations:**

*For initial generation:*
```
{CUSTOM_PROMPT} = "" (empty or user regeneration comments)
```

*For gap recovery:*
```
{CUSTOM_PROMPT} = 
"=== RETURN TO TRAINING CONTEXT ===
The user is returning after a {X}-day training gap.

Activities during gap: {user input or 'none'}
Workouts done during gap: {list of workouts or 'none'}
Last completed week: Week {N} ({dates})

IMPORTANT: Create a 'return to training' plan that:
- Starts fresh (Week 1) with appropriate volume reduction
- Progressively rebuilds to pre-gap levels  
- Takes into account the gap duration and activities
- Uses workout history to understand previous training patterns"
```

**Returns:** Full plan (macrocycle + mesocycles + currentMicrocycle)

#### **Prompt 2: `prompts_fitness_plan_generate_next_microcycle`**
**Purpose:** Generate next week during normal progression

**When Used:**
- User completes a week (happy path)
- Week completion dialog → "Complete Week & Generate Next"

**Populated With:**
- `{USER_PROFILE}`
- `{CURRENT_DATE}`
- `{NEXT_WEEK_DATE_RANGE}` - Calculated next week range
- `{NEXT_WEEK_NUMBER}` - Incremented week number
- `{MACROCYCLE}`, `{MESOCYCLE}` - Current plan structure
- `{PREVIOUS_MICROCYCLE_PLANNED}` - What was planned last week
- `{PREVIOUS_MICROCYCLE_ACTUAL}` - What user actually did
- `{WEEKLY_REFLECTION}` - User's reflection notes
- `{WORKOUT_HISTORY}` - Last 8 weeks of completed workouts

**Returns:** Next microcycle only (within existing macro/meso framework)

---

### **Future Enhancement: Two-Step Generation**

**Note:** The current implementation uses single-step generation (one prompt returns macro + meso + micro). A future enhancement (documented in `enhanced_complete_app_UX_loop.md`) will separate goal setting (macro/meso) from week planning (micro) for better user control and flexibility. This will require additional prompts and UI flows.

**Benefits of future two-step approach:**
- Change goals mid-journey without restarting
- Clearer separation of strategic vs tactical planning
- Better user control over training direction

**Implementation Priority:** Phase 9+ (after MVP complete)

---

## 🎨 **UI SPECIFICATIONS**

### **Date Display Rules**
- **Week Header**: "Week 1: Oct 5 - 11" or "Week 1: Jan 30 - Feb 5" (cross-month)
- **Day Headers**: "Monday, Oct 5", "Tuesday, Oct 6", etc.
- **Dialog Titles**: Same format as week header

### **Button States**
| State | Condition | Style | Text | Enabled |
|-------|-----------|-------|------|---------|
| **Disabled** | Days 1-6 of week | Outline | "Complete Week 🎯" | No |
| **Ready** | Day 7 of week | Primary Green + Highlight | "Complete Week & Generate Next 🚀" | Yes |
| **Overdue** | microcycle end date + up to 7 days | Warning Orange | "Complete Overdue Week ⚠️" | Yes |

### **Loading States**
- **Plan Generation**: Full-screen skeleton with "Generating your personalized plan..."
- **Week Completion**: Button shows "Generating next week..." with spinner
- **Gap Recovery**: "Creating your return-to-training plan..."

---

## ⚠️ **EDGE CASES & ERROR HANDLING**

### **Profile Issues**
- **Incomplete Profile**: Redirect to onboarding, disable generation
- **Missing Equipment**: Show warning, allow generation with bodyweight exercises

### **Date Edge Cases**
- **Month Boundaries**: Handle weeks spanning months correctly
- **Year Boundaries**: Handle New Year transitions
- **Timezone Changes**: Use user's local timezone consistently

### **AI Generation Failures**
- **Network Error**: Show retry button, maintain dialog state
- **Invalid Response**: Log error, show user-friendly message, offer retry
- **Timeout**: 30-second timeout, graceful fallback

### **Data Consistency**
- **Multiple Devices**: Real-time sync prevents conflicts
- **Offline Usage**: Queue operations, sync when online
- **Corrupted Data**: Validate on load, offer regeneration if needed

### **User Behavior Edge Cases**
- **No Completed Workouts**: Allow completion with 0% rate, adjust next week accordingly
- **Very Long Gaps (6+ months)**: Treat as new user, ignore old history
- **Rapid Completions**: Prevent double-submissions with loading states

