# Phase 8 Gap Recovery - Testing Instructions

## 🎯 **What Was Implemented**

### **1. Profile Editing (Component Reuse)**
- ✅ Uses `CollapsibleChoiceField` for single/multiple choice (same as ProfilePage)
- ✅ Shows selected values with "Edit" button to open dialog
- ✅ Clean, collapsed display (not expanded)

### **2. Workout Management**
- ✅ Compact workout cards with name + date
- ✅ Click any card to open editor (no checkboxes shown)
- ✅ Add single workout button
- ✅ Add multiple workouts via text (bulk entry)
- ✅ Delete workouts
- ✅ Workouts sorted by date

### **3. Workout Editor** 
- ✅ Opens `WorkoutExecutionMode` in gap recovery mode
- ✅ No checkboxes or completion tracking
- ✅ Can edit via UI or Text editor
- ✅ All exercises automatically considered complete

### **4. Bulk Text Entry**
- ✅ Parses format: `# Workout Name dd-mm-yyyy`
- ✅ Supports 3 date formats (dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy)
- ✅ Uses existing exercise parser

---

## 🧪 **Testing Steps**

### **STEP 1: Trigger Gap Recovery**

1. **Open Testing Page**: http://localhost:5175/app/testing
2. **Click "👋 Long Gap State"** button
3. **Navigate to Fitness Plan** page
4. **Expected**: Automatically redirected to `/app/gap-recovery`

---

### **STEP 2: Verify Page Layout**

**Check Header:**
- ✅ "Welcome Back! 👋" title
- ✅ Shows "Last active: Week X ended Y days ago (14 days ago)"
- ✅ "Ready to get back on track" message

**Check Sections:**
- ✅ Gap activities text area
- ✅ Workouts section with add buttons
- ✅ Profile section (collapsed, not expanded)
- ✅ Generate button at bottom (sticky)

---

### **STEP 3: Test Profile Editing**

1. **Scroll to "Review your profile" section**
2. **Verify**: All choice fields show selected value with "Edit" button
3. **Click "Edit" on any single/multiple choice field**
4. **Expected**: Dialog opens (same as ProfilePage)
5. **Change a value** and save
6. **Expected**: "Save Changes" button appears in header
7. **Click "Save Changes"**
8. **Expected**: Changes saved, button disappears

---

### **STEP 4: Test Single Workout Add**

1. **Click "Add Workout" button**
2. **Expected**: `WorkoutExecutionMode` dialog opens
3. **Verify**:
   - ✅ No checkboxes visible (exercise level or set level)
   - ✅ No progress bar at top
   - ✅ No "Complete All & Finish" button
   - ✅ Can edit workout name
   - ✅ Can add exercises via UI or Text editor
4. **Add a workout**:
   - Name: "Morning Run"
   - Add exercise: "Running" with "5km"
5. **Click "Close"**
6. **Expected**: Workout appears as compact card with name + date

---

### **STEP 5: Test Workout Editing**

1. **Click on the workout card you just created**
2. **Expected**: Editor opens with existing data
3. **Modify the workout** (change name or add exercise)
4. **Close editor**
5. **Expected**: Changes reflected in the card

---

### **STEP 6: Test Workout Deletion**

1. **Hover over any workout card**
2. **Click trash icon** (top right)
3. **Expected**: Workout removed from list

---

### **STEP 7: Test Bulk Text Entry**

1. **Click "Add Multiple (Text)" button**
2. **Expected**: Dialog opens with format example
3. **Paste this text**:
```
# Gym Session 15-01-2025
-- Bench Press
3 x 10 x 50kg
-- Squats
4 x 8 x 80kg

# Cardio 16.01.2025
-- Running
5km

# Yoga 17/01/2025
-- Stretching
30min
```
4. **Click "Add Workouts"**
5. **Expected**: 
   - Dialog closes
   - 3 new workout cards appear
   - Workouts sorted by date (oldest first)

---

### **STEP 8: Test Date Parsing**

**Verify the 3 workouts added have correct dates:**
- ✅ "Gym Session" shows "15-01-2025"
- ✅ "Cardio" shows "16-01-2025"  
- ✅ "Yoga" shows "17-01-2025"

All 3 date formats (dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy) should parse correctly.

---

### **STEP 9: Test Gap Activities**

1. **Scroll to "What were you up to" section**
2. **Type**: "On vacation in Hawaii, didn't have gym access"
3. **Leave text there** (will be sent to AI)

---

### **STEP 10: Test Generate Plan**

1. **Ensure profile has NO unsaved changes**
2. **Scroll to bottom**
3. **Click "Generate Fresh Plan 🚀"**
4. **Expected**:
   - Button shows loading: "Creating your return-to-training plan..."
   - AI generates plan
   - Automatically redirected to `/app/fitness-plan`
   - New Week 1 appears (auto-approved, no draft)

---

### **STEP 11: Verify Firebase Data**

1. **Open Firebase Console** → Firestore
2. **Navigate to**: `users/{yourUserId}/trainingGaps/`
3. **Expected**: New document with:
   - `startDate`: Your last week's end date
   - `endDate`: Today
   - `durationDays`: 14
   - `activities`: "On vacation in Hawaii..." (your text)
   - `workouts`: Array of all workouts you added
   - `resumedAt`: Timestamp

---

## ✅ **Success Criteria**

### **Profile Section:**
- [ ] Choice fields collapsed by default (not expanded)
- [ ] Click "Edit" opens dialog (same as ProfilePage)
- [ ] Can save changes
- [ ] Generate button disabled until profile saved

### **Workout Section:**
- [ ] Compact cards with name + date only
- [ ] Click card opens editor
- [ ] Editor has NO checkboxes
- [ ] Can add via "Add Workout" button
- [ ] Can add multiple via text
- [ ] Can delete workouts
- [ ] Workouts sorted by date (oldest first)

### **Bulk Text Entry:**
- [ ] Parses `# Workout Name dd-mm-yyyy` format
- [ ] Supports dd-mm-yyyy format
- [ ] Supports dd.mm.yyyy format  
- [ ] Supports dd/mm/yyyy format
- [ ] Exercises parse correctly
- [ ] All exercises marked as complete

### **Plan Generation:**
- [ ] AI receives gap context (activities + workouts)
- [ ] New plan generates successfully
- [ ] Plan is auto-approved (no draft state)
- [ ] Redirects to fitness plan page
- [ ] Gap record saved to Firebase

---

## 🐛 **Common Issues & Fixes**

### **Issue: Profile fields are expanded**
**Expected**: Collapsed with "Edit" button
**Fix**: Verify `CollapsibleChoiceField` is used for single/multiple choice fields

### **Issue: Checkboxes appear in workout editor**
**Expected**: No checkboxes in gap recovery mode
**Fix**: Verify `isGapRecovery={true}` prop is passed to `WorkoutExecutionMode`

### **Issue: Date parsing fails**
**Expected**: Supports dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy
**Fix**: Check `gapWorkoutParser.ts` date regex

### **Issue: Generate button stays disabled**
**Expected**: Enabled after profile saved
**Fix**: Click "Save Changes" button in profile section

---

## 📝 **Test Different Scenarios**

### **Scenario A: No Workouts**
- Don't add any workouts
- Just add gap activities text
- Generate plan
- Should work fine

### **Scenario B: Only Bulk Entry**
- Don't use "Add Workout"
- Only use bulk text entry
- Add 5+ workouts
- Verify all parse correctly

### **Scenario C: Mix of Single + Bulk**
- Add 2 workouts via "Add Workout"
- Add 3 via bulk text
- Edit one manually
- Delete one
- Generate plan

### **Scenario D: Profile Changes**
- Change fitness level
- Change goals
- Change equipment
- Save changes
- Generate plan
- Verify AI uses new profile

---

## 🎉 **Success!**

If all tests pass:
- ✅ Profile editing works (collapsed, dialog-based)
- ✅ Workout management works (add/edit/delete)
- ✅ Bulk text entry parses correctly
- ✅ Workout editor has no checkboxes
- ✅ Plan generation includes gap context
- ✅ Gap record saved to Firebase

**Phase 8 is complete! Ready to move to next phase.**


