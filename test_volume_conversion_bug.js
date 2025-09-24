/**
 * Test to reproduce the volume type conversion bug
 * Scenario: Exercise with no volume → add volume → change to distance → check text output
 */

console.log("🧪 Testing volume type conversion bug...\n");

// Mock the types and functions we need
function mockExerciseSet(props) {
  return {
    reps: 1,
    restTime: 60,
    notes: '',
    volumeType: 'completion',
    volumeRowId: 'test-id',
    ...props
  };
}

function mockExercise(name, sets = []) {
  return {
    id: 'test-exercise',
    name,
    sets,
    instructions: ''
  };
}

// Simulate the bug scenario step by step
console.log("Step 1: Exercise with no volume (completion set only)");
let exercise = mockExercise("Running", [
  mockExerciseSet({ volumeType: 'completion' })
]);
console.log("Sets:", exercise.sets.map(s => ({ volumeType: s.volumeType, reps: s.reps, notes: s.notes })));

console.log("\nStep 2: User changes volume type to 'distance'");
// This simulates what updateVolumeRow does when changing type to distance
const updatedSet = {
  reps: 1, // This stays from the old set
  restTime: 60,
  notes: `${0}km`, // BUG: defaults to 0 instead of 10
  volumeType: 'distance',
  volumeRowId: 'test-id',
  distanceUnit: 'km'
};

exercise.sets[0] = updatedSet;
console.log("Updated set:", { volumeType: updatedSet.volumeType, reps: updatedSet.reps, notes: updatedSet.notes });

console.log("\nStep 3: Text generation logic");
// This simulates groupSetsByType
function simulateGroupSetsByType(sets) {
  const groups = {};
  
  sets.forEach((set, index) => {
    let key = '';
    if (set.volumeType === 'distance') {
      const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
      const unit = set.distanceUnit || 'km';
      key = `${distance}${unit}`;
    } else {
      key = `${set.reps}`;
    }
    
    if (!groups[key]) {
      groups[key] = { sets: [], completedCount: 0 };
    }
    groups[key].sets.push(set);
  });
  
  return groups;
}

const groups = simulateGroupSetsByType(exercise.sets);
console.log("Grouped sets:", Object.keys(groups));

// This simulates the text generation
function simulateTextGeneration(groups) {
  let text = '';
  Object.entries(groups).forEach(([key, group]) => {
    const totalSets = group.sets.length;
    const firstSet = group.sets[0];
    
    if (firstSet?.volumeType === 'distance') {
      text += `${key}\n`; // Should be "0km" (BUG!)
    } else {
      text += `${totalSets}x${key}\n`; // This might also appear
    }
  });
  return text;
}

const generatedText = simulateTextGeneration(groups);
console.log("Generated text:");
console.log(generatedText);

console.log("\n🐛 BUGS IDENTIFIED:");
console.log("1. Distance defaults to 0km instead of 10km");
console.log("2. Old reps field (1) might still be present");
console.log("3. Text shows '0km' instead of '10km'");

console.log("\n🔧 EXPECTED BEHAVIOR:");
console.log("- Distance should default to 10km");
console.log("- Text should show '10km'");
console.log("- No '1x1' should appear");

// Test what the fix should produce
console.log("\n✅ AFTER FIX:");
const fixedSet = {
  reps: 1,
  restTime: 60,
  notes: `10km`, // FIXED: defaults to 10km
  volumeType: 'distance',
  volumeRowId: 'test-id',
  distanceUnit: 'km'
};

const fixedGroups = simulateGroupSetsByType([fixedSet]);
const fixedText = simulateTextGeneration(fixedGroups);
console.log("Fixed text:");
console.log(fixedText);
