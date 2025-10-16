# Firebase Remote Config Setup for AI Coach

## 📋 Overview

The AI Coach system uses Firebase Remote Config to store AI prompts. This allows easy updates to prompts in production without code changes.

---

## 🔑 Required Remote Config Parameters

### 1. **prompts_ai_coach_goals_generation** (REQUIRED - Updated)

**Description**: Prompt for generating macrocycle and mesocycle goals (Phase 1 of AI Coach)

**Value**: Copy contents from `prompts_ai_coach_goals_generation.json`

**IMPORTANT CHANGES:**
- ✅ App now generates IDs, startDate, endDate, generated_at (not AI)
- ✅ AI only provides content: name, value, durationWeeks, successIndicators
- ✅ Simplified prompt for better reliability
- ✅ Handles both new and old response formats for backward compatibility

**How to add/update in Firebase Console**:
1. Go to Firebase Console → Remote Config
2. If parameter exists, click "Edit" | If new, click "Add parameter"
3. Parameter key: `prompts_ai_coach_goals_generation`
4. Data type: JSON
5. Default value: Paste the UPDATED JSON from `prompts_ai_coach_goals_generation.json`
6. Click "Save" then "Publish changes"

**⚠️ If you already uploaded the old version, please UPDATE it with the new simplified version!**

---

### 2. **prompts_fitness_plan_generation** (EXISTING - Reused for workouts)

**Description**: Prompt for generating initial week workouts (used for Week 1 generation)

**Status**: Already exists, but needs to be updated to match new structure

**Value**: Copy contents from `prompts_ai_coach_workout_generation.json` (or update existing)

**Note**: This prompt is reused from the existing fitness plan system. If you want separate prompts, create a new parameter `prompts_ai_coach_workout_generation`.

---

### 3. **openai_api_key** (EXISTING - Required)

**Description**: OpenAI API key for GPT-4

**Status**: Should already exist

**Value**: Your OpenAI API key (sk-...)

---

## 📄 Prompt Files Created

I've created two JSON files in your project root with the prompts:

### **1. `prompts_ai_coach_goals_generation.json`**
- Prompt for Phase 1 (Goals Generation)
- Defines JSON schema for macrocycle + mesocycles
- Template variables:
  - `{USER_PROFILE}` - Full user profile data
  - `{FITNESS_GOAL_INPUT}` - Goal from profile field
  - `{CUSTOM_INPUT}` - User's detailed description
  - `{CURRENT_DATE}` - Current date

### **2. `prompts_ai_coach_workout_generation.json`**
- Prompt for Phase 2 (Workout Generation)
- Defines JSON schema for weekly workouts
- Template variables:
  - `{USER_PROFILE}` - Full user profile
  - `{MACROCYCLE}` - Macrocycle goal
  - `{MESOCYCLE}` - Current mesocycle
  - `{NEXT_WEEK_NUMBER}` - Week number
  - `{WEEK_DATE_RANGE}` - Week start/end dates
  - `{CURRENT_DATE}` - Current date
  - `{PREVIOUS_MICROCYCLE_PLANNED}` - Previous week planned workouts
  - `{PREVIOUS_MICROCYCLE_ACTUAL}` - Previous week actual completion
  - `{WORKOUT_HISTORY}` - Historical workout data
  - `{CUSTOM_PROMPT}` - User feedback for regeneration

---

## 🚀 How to Upload to Firebase

### Step 1: Goals Generation Prompt

```bash
# 1. Go to Firebase Console: https://console.firebase.google.com
# 2. Select your project
# 3. Navigate to: Remote Config (in left sidebar)
# 4. Click "Add parameter"
# 5. Fill in:
#    - Parameter key: prompts_ai_coach_goals_generation
#    - Data type: JSON
#    - Default value: [paste contents from prompts_ai_coach_goals_generation.json]
# 6. Click "Save"
# 7. Click "Publish changes" (top right)
```

### Step 2: Workout Generation Prompt (Optional)

If you want a separate prompt for AI Coach workouts:

```bash
# Same process as above, but:
# - Parameter key: prompts_ai_coach_workout_generation
# - Default value: [paste contents from prompts_ai_coach_workout_generation.json]
```

**OR** just update the existing `prompts_fitness_plan_generation` parameter.

---

## 🧪 Testing After Upload

### Test Goals Generation

1. Navigate to AI Coach page (`/app/ai-coach`)
2. Click "Start AI Coach"
3. Fill in fitness goals
4. Click "Generate Goals"
5. Check browser console for:
   - `[AICoach] Starting goals generation`
   - `[AICoach] Calling OpenAI API for goals generation`
   - `[AICoach] Parsing AI response: {...}`
   - `[AICoach] Generated goals successfully`

### If You See Errors

**Error: "Goals generation prompt not configured"**
- Firebase Remote Config parameter not found
- Check parameter name is exactly: `prompts_ai_coach_goals_generation`
- Check you published changes in Firebase Console

**Error: "Failed to parse AI response as JSON"**
- AI returned invalid JSON
- Check console for the actual response
- May need to adjust system prompt to enforce JSON-only output

**Error: "Invalid goals response structure"**
- AI returned JSON but wrong structure
- Check console for what fields were received
- May need to make prompt more explicit about required fields

---

## 📝 Prompt Structure Explained

### Goals Generation Response

```json
{
  "macrocycleGoal": {
    "id": "macro_1697123456789",
    "name": "Build Strength and Muscle",
    "value": "6-month progressive strength program...",
    "durationWeeks": 24,
    "startDate": "2025-10-12",
    "endDate": "2026-04-12",
    "successIndicators": [
      "Increase bench press by 20%",
      "Gain 5kg of lean muscle"
    ],
    "promisedOutcome": "Significantly stronger with visible muscle development"
  },
  "mesocycleMilestones": [
    {
      "id": "meso_1_1697123456789",
      "name": "Foundation Phase",
      "durationWeeks": 4,
      "focus": "Form and Base Strength",
      "value": "Focus on perfecting form...",
      "successIndicators": ["Master compound movements", "Build work capacity"]
    },
    // ... 3-5 more mesocycles
  ],
  "explanation": "Progressive plan starting with foundation...",
  "generated_at": "2025-10-12T19:30:00.000Z"
}
```

### Workout Generation Response

```json
{
  "plan": {
    "currentMicrocycle": {
      "id": "micro_week1_1697123456789",
      "week": 1,
      "focus": "Upper Body Emphasis",
      "value": "Introduction to strength training...",
      "workouts": [
        {
          "id": "workout_1697123456789_abc",
          "name": "Upper Body Strength",
          "type": "strength",
          "dayOfWeek": 1,
          "estimatedDuration": 60,
          "focus": "Chest and Triceps",
          "value": "Compound pressing movements...",
          "exercises": [...],
          "checkIns": { "greenFlags": [], "redFlags": [] }
        }
      ]
    }
  },
  "explanation": "This week focuses on...",
  "generated_at": "2025-10-12T19:30:00.000Z"
}
```

---

## ⚙️ Current Implementation

**What the app currently does**:

1. **Goals Generation**:
   - Tries to load: `prompts_ai_coach_goals_generation`
   - Falls back to: `prompts_fitness_plan_generation` (if not found)
   - Expects response with `macrocycleGoal` and `mesocycleMilestones`

2. **Workout Generation**:
   - Loads: `prompts_fitness_plan_generation` (existing prompt)
   - Expects response with `plan.currentMicrocycle.workouts`

3. **Error Handling**:
   - Comprehensive validation of AI response
   - Detailed console logging
   - User-friendly error messages

---

## 🎯 Next Steps

1. **Upload `prompts_ai_coach_goals_generation` to Firebase** (REQUIRED)
2. **Optional**: Upload `prompts_ai_coach_workout_generation` (or keep using existing)
3. **Test goals generation** with real AI
4. **Iterate on prompts** if AI output doesn't match expectations

---

**Files to upload to Firebase Remote Config:**
- ✅ `prompts_ai_coach_goals_generation.json` → parameter: `prompts_ai_coach_goals_generation`
- ✅ `prompts_ai_coach_workout_generation.json` → parameter: `prompts_ai_coach_workout_generation` (optional)
- ✅ Ensure `openai_api_key` parameter exists with your API key

**Once uploaded, the AI Coach will work end-to-end!** 🚀

