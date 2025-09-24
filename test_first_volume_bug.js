/**
 * Test to reproduce the first volume addition bug
 * Scenario: Exercise with completion set → add volume → should not show 1x1
 */

console.log("🧪 Testing first volume addition bug...\n");

// Mock the current (broken) behavior
function mockAddVolumeRow(exercise) {
  const volumeRowId = `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newSets = Array.from({ length: 3 }, () => ({
    reps: 10,
    restTime: 90,
    notes: '',
    volumeType: 'sets-reps',
    volumeRowId
  }));

  // CURRENT (BROKEN) BEHAVIOR: Keeps all existing sets
  return {
    ...exercise,
    sets: [...exercise.sets, ...newSets] // ← BUG: Keeps completion set!
  };
}

// Mock text generation (current behavior)
function mockGroupSetsByType(sets) {
  const groups = {};
  
  sets.forEach((set, index) => {
    let key = '';
    if (set.volumeType === 'sets-reps-weight') {
      key = `${set.reps}x${set.weight || 0}${set.weightUnit || 'kg'}`;
    } else if (set.volumeType === 'duration') {
      key = `${Math.round((set.duration || 0) / 60)}min`;
    } else if (set.volumeType === 'distance') {
      const distance = parseFloat(set.notes?.replace(/[^\d.]/g, '') || '0');
      const unit = set.distanceUnit || 'km';
      key = `${distance}${unit}`;
    } else {
      // ← BUG: This includes completion sets!
      key = `${set.reps}`;
    }
    
    if (!groups[key]) {
      groups[key] = { sets: [], completedCount: 0 };
    }
    groups[key].sets.push(set);
  });
  
  return groups;
}

function mockGenerateWorkoutText(exercise) {
  const hasOnlyCompletionSets = exercise.sets.every(set => set.volumeType === 'completion');
  
  let text = `- ${exercise.name}\n`;
  
  if (!hasOnlyCompletionSets) {
    const groupedSets = mockGroupSetsByType(exercise.sets);
    
    Object.entries(groupedSets).forEach(([key, group]) => {
      const totalSets = group.sets.length;
      const firstSet = group.sets[0];
      
      if (firstSet?.volumeType === 'distance' || firstSet?.volumeType === 'duration') {
        text += `${key}\n`;
      } else {
        text += `${totalSets}x${key}\n`;
      }
    });
  }
  
  return text.trim();
}

// Test the bug scenario
console.log("Step 1: Exercise with completion set only");
let exercise = {
  id: 'test',
  name: 'Exercise 2',
  sets: [
    { reps: 1, volumeType: 'completion', volumeRowId: 'completion-id' }
  ]
};

console.log("Sets:", exercise.sets.map(s => ({ volumeType: s.volumeType, reps: s.reps })));

console.log("\nStep 2: User adds first volume row");
exercise = mockAddVolumeRow(exercise);
console.log("Sets after adding volume:", exercise.sets.map(s => ({ volumeType: s.volumeType, reps: s.reps })));

console.log("\nStep 3: Generate text");
const generatedText = mockGenerateWorkoutText(exercise);
console.log("Generated text:");
console.log(`"${generatedText}"`);

console.log("\n🐛 PROBLEM IDENTIFIED:");
console.log("1. addVolumeRow keeps the completion set");
console.log("2. groupSetsByType doesn't filter completion sets");
console.log("3. Text shows both '1x1' (completion) and '3x10' (new volume)");

console.log("\n🔧 FIXES NEEDED:");
console.log("1. addVolumeRow should replace completion sets, not append");
console.log("2. OR groupSetsByType should filter out completion sets");
console.log("3. Text should only show '3x10'");

// Test the fix
console.log("\n✅ TESTING FIXES:");

// Fix 1: Filter completion sets in groupSetsByType
function fixedGroupSetsByType(sets) {
  const groups = {};
  
  sets.forEach((set, index) => {
    // FIXED: Skip completion sets
    if (set.volumeType === 'completion') {
      return;
    }
    
    let key = '';
    if (set.volumeType === 'sets-reps-weight') {
      key = `${set.reps}x${set.weight || 0}${set.weightUnit || 'kg'}`;
    } else if (set.volumeType === 'duration') {
      key = `${Math.round((set.duration || 0) / 60)}min`;
    } else if (set.volumeType === 'distance') {
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

function fixedGenerateWorkoutText(exercise) {
  const hasOnlyCompletionSets = exercise.sets.every(set => set.volumeType === 'completion');
  
  let text = `- ${exercise.name}\n`;
  
  if (!hasOnlyCompletionSets) {
    const groupedSets = fixedGroupSetsByType(exercise.sets); // FIXED: Use filtered version
    
    Object.entries(groupedSets).forEach(([key, group]) => {
      const totalSets = group.sets.length;
      const firstSet = group.sets[0];
      
      if (firstSet?.volumeType === 'distance' || firstSet?.volumeType === 'duration') {
        text += `${key}\n`;
      } else {
        text += `${totalSets}x${key}\n`;
      }
    });
  }
  
  return text.trim();
}

const fixedText = fixedGenerateWorkoutText(exercise);
console.log("Fixed text:");
console.log(`"${fixedText}"`);

if (fixedText === "- Exercise 2\n3x10") {
  console.log("✅ FIXED: Shows only '3x10' (no '1x1')");
} else {
  console.log(`❌ STILL BROKEN: Expected '- Exercise 2\\n3x10', got '${fixedText}'`);
}
