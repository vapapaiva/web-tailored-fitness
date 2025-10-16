# AI Coach Bug Fixes - October 14, 2025

## ✅ Issue #1: Workout Visibility After Generation

### Problem
Workouts didn't appear immediately after microcycle generation. User had to navigate to Workouts page, then come back to AI Coach to see them.

### Root Cause (The Real Issue!)
**AI Coach page wasn't starting the workouts real-time listener!**

- `workoutsStore` has a real-time Firebase listener via `startRealtimeSync()`
- Workouts page called `startRealtimeSync()` when mounting → workouts loaded
- AI Coach page ONLY started sync for `aiCoachStore`, NOT `workoutsStore`
- When microcycle generated workouts, they were written to Firebase
- But AI Coach had no listener running to receive them!
- Visiting Workouts page started the listener → workouts appeared
- Going back to AI Coach, they were now in the store

**Why the confusion:**
- `workoutsStore.addWorkout()` intentionally doesn't update local state immediately
- It waits for the real-time listener to avoid duplicate entries
- This is correct architecture, but only works if the listener is running!

### Solution (Two-Part Fix)
1. **AICoachPage.tsx**: Start workouts real-time sync when page mounts
   - Added `loadWorkouts()` and `startWorkoutsSync()` in useEffect
   - Now AI Coach page loads and listens to workouts just like Workouts page
   
2. **MicrocycleGenerationFlow.tsx**: Wait for all workouts before showing review
   - Added `useEffect` that watches workouts array
   - Checks if all expected workout IDs are present
   - Transitions to 'review' when complete
   - 5-second timeout fallback

### Files Modified
- `src/pages/AICoachPage.tsx` - **THE KEY FIX** (start workouts sync)
- `src/components/ai-coach/MicrocycleGenerationFlow.tsx` - Wait for sync

### Testing
1. Generate initial microcycle
2. Workouts should appear immediately without navigation
3. Check console logs for diagnostic info

---

## ✅ Issue #2: Date Range Calculation (Oct 13-19 instead of Oct 14-19)

### Problem
When generating microcycle on Tuesday Oct 14, 2025:
- **Expected**: Oct 14-19 (Tuesday to Sunday, 6 days)
- **Actual**: Oct 13-19 (Monday to Sunday, 7 days - includes Monday which is in the past!)

### Root Cause
- `calculateInitialWeekRange()` was calling `getWeekStartDate()` which returns the Monday of the current week
- For Mon-Thu, this returned the full week starting from Monday, not from today
- This could include past dates (like Monday when generating on Tuesday)

### Solution
Fixed `calculateInitialWeekRange()` in `src/lib/dateUtils.ts`:

**Before (Wrong):**
```typescript
if (isMonToThu) {
  // Monday-Thursday: Generate current week (Monday to Sunday)
  const start = getWeekStartDate(d); // ❌ Returns Monday
  const end = getWeekEndDate(d);
  return { start, end };
}
```

**After (Correct):**
```typescript
if (isMonToThu) {
  // Monday-Thursday: Generate from TODAY to end of current week (Sunday)
  const today = formatLocalDate(d); // ✅ Returns today
  const end = getWeekEndDate(d);
  return { start: today, end };
}
```

### Correct Behavior
- **Monday to Thursday**: Generate from TODAY to end of current week (Sunday)
  - Mon Oct 13 → Oct 13-19 (7 days)
  - **Tue Oct 14 → Oct 14-19 (6 days)** ✅ (fixed!)
  - Wed Oct 15 → Oct 15-19 (5 days)
  - Thu Oct 16 → Oct 16-19 (4 days)

- **Friday to Sunday**: Generate from TODAY to end of NEXT week (next Sunday)
  - Fri Oct 17 → Oct 17-26 (10 days)
  - Sat Oct 18 → Oct 18-26 (9 days)
  - Sun Oct 19 → Oct 19-26 (8 days)

### Why This Matters
1. **Prevents past dates**: Plans never include dates that have already passed
2. **Adequate planning**: Always provides at least 4-10 days of planning horizon
3. **User expectation**: When I generate "today", I expect it to start "today", not yesterday

### Files Modified
- `src/lib/dateUtils.ts` - Fixed `calculateInitialWeekRange()`
- `WEEK_COMPLETION_SPEC_V2.md` - Updated spec to clarify correct behavior

### Spec Alignment
- `COMPLETE_APP_LOOP_UX.md` lines 34-48: ✅ Already documented correctly
- `WEEK_COMPLETION_SPEC_V2.md` lines 67-82: ✅ Now updated to match implementation

### Testing
```javascript
// Test on Tuesday Oct 14, 2025
const result = calculateInitialWeekRange(new Date(2025, 9, 14));
// Expected: { start: "2025-10-14", end: "2025-10-19" }
// Verified: ✅ Correct!
```

---

## Impact

Both fixes are **critical** for proper AI Coach functionality:

1. **Workout Visibility**: Users can now see their generated workouts immediately without confusion
2. **Date Accuracy**: Workouts are scheduled correctly without including past dates

## Testing Checklist

- [x] Date calculation fix verified with test script
- [x] Workout visibility logic implemented with reactive useEffect
- [x] No linter errors
- [x] Documentation updated (.cursorrules)
- [x] Spec files updated (WEEK_COMPLETION_SPEC_V2.md)
- [ ] Manual testing: Generate microcycle on different days of week
- [ ] Manual testing: Verify workouts appear immediately without navigation
- [ ] Manual testing: Check that dates align between AI Coach and Workouts pages

## Next Steps

Test the fixes:
1. Clear current microcycle (Testing page)
2. Generate new microcycle on different days (Mon, Tue, Fri, Sun)
3. Verify dates are correct (start from today)
4. Verify workouts appear immediately in preview
5. Check workouts show same dates in Workouts page

