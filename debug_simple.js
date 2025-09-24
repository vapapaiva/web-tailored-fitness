// Simple debug test to isolate the issue
console.log("🔍 Debugging the distance completion issue...\n");

// Test the exact condition that's failing
function testCondition() {
  // This is what we get when parsing "10km +"
  const parsedExercise = {
    exercise: "Running",
    sets: [],  // Empty array, not undefined!
    distance: "10km",
    done: true
  };
  
  console.log("Parsed exercise:", JSON.stringify(parsedExercise, null, 2));
  
  // Test the old condition (broken)
  const oldCondition = parsedExercise.done && !parsedExercise.sets;
  console.log("Old condition (!parsedExercise.sets):", !parsedExercise.sets);
  console.log("Old condition result:", oldCondition);
  
  // Test the new condition (should work)
  const newCondition = parsedExercise.done && (!parsedExercise.sets || parsedExercise.sets.length === 0);
  console.log("New condition (!parsedExercise.sets || parsedExercise.sets.length === 0):", (!parsedExercise.sets || parsedExercise.sets.length === 0));
  console.log("New condition result:", newCondition);
  
  console.log("\n=== ANALYSIS ===");
  console.log("parsedExercise.sets:", parsedExercise.sets);
  console.log("typeof parsedExercise.sets:", typeof parsedExercise.sets);
  console.log("Array.isArray(parsedExercise.sets):", Array.isArray(parsedExercise.sets));
  console.log("parsedExercise.sets.length:", parsedExercise.sets.length);
  console.log("!parsedExercise.sets:", !parsedExercise.sets);
  console.log("parsedExercise.sets.length === 0:", parsedExercise.sets.length === 0);
  
  if (newCondition) {
    console.log("\n✅ NEW CONDITION WORKS: Would set progressArray[0] = true");
  } else {
    console.log("\n❌ NEW CONDITION FAILED: Would NOT set progressArray[0] = true");
  }
}

testCondition();
