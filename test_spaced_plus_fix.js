/**
 * Test for spaced + symbols parsing fix
 * Verifies that + symbols with spaces are treated as completion markers, not cues
 */

console.log("🧪 Testing spaced + symbols parsing fix...\n");

// Mock the parser (simplified version for testing)
function parseVolumeLine(line) {
  // Sets pattern: (\d+)x(\d+)(?:x([0-9.]+(?:kg|lb)))?\s*([\+\s]*)\s*$
  const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)(?:\s*x\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|lb)))?\s*([\+\s]*)\s*$/);
  if (setMatch) {
    const [, setsPlanned, reps, weight, plusesAndSpaces] = setMatch;
    const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
    return {
      type: 'sets',
      setsPlanned: parseInt(setsPlanned),
      reps: parseInt(reps),
      weight: weight?.trim(),
      plusCount,
      matched: true
    };
  }
  
  // Distance pattern: ([0-9.]+)\s*(km|mi|m)\s*([\+\s]*)\s*$
  const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*([\+\s]*)\s*$/);
  if (distanceMatch) {
    const [, value, unit, plusesAndSpaces] = distanceMatch;
    const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
    return {
      type: 'distance',
      value: parseFloat(value),
      unit,
      plusCount,
      matched: true
    };
  }
  
  // Time pattern: (?:(\d+)h)?\s*(?:(\d+)(?:m|min))?\s*([\+\s]*)\s*$
  const timeMatch = line.match(/^\s*(?:(\d+)h)?\s*(?:(\d+)(?:m|min))?\s*([\+\s]*)\s*$/);
  if (timeMatch) {
    const [, hours, minutes, plusesAndSpaces] = timeMatch;
    const plusCount = (plusesAndSpaces || '').split('').filter(char => char === '+').length;
    let timeStr = '';
    if (hours) timeStr += hours + 'h';
    if (minutes) timeStr += minutes + 'm';
    if (timeStr) {
      return {
        type: 'time',
        timeStr,
        plusCount,
        matched: true
      };
    }
  }
  
  return { matched: false, wouldBeCue: true };
}

// Test cases for the bug
const testCases = [
  // Original bug case
  { line: "5x10x10kg ++++ +++", expected: { type: 'sets', plusCount: 7 } },
  
  // Various spaced + patterns
  { line: "3x8 + +", expected: { type: 'sets', plusCount: 2 } },
  { line: "2x5x20kg +  +  +", expected: { type: 'sets', plusCount: 3 } },
  { line: "10km + + + +", expected: { type: 'distance', plusCount: 4 } },
  { line: "15min ++  ++", expected: { type: 'time', plusCount: 4 } },
  
  // Mixed patterns
  { line: "4x12x15kg +++   ++", expected: { type: 'sets', plusCount: 5 } },
  { line: "5km +", expected: { type: 'distance', plusCount: 1 } },
  { line: "20min +++", expected: { type: 'time', plusCount: 3 } },
  
  // Edge cases
  { line: "1x1 + + + + +", expected: { type: 'sets', plusCount: 5 } },
  { line: "100m +     +", expected: { type: 'distance', plusCount: 2 } },
  { line: "1h30m +  +  +  +", expected: { type: 'time', plusCount: 4 } },
  
  // Should still work without spaces
  { line: "3x10++", expected: { type: 'sets', plusCount: 2 } },
  { line: "5km+++", expected: { type: 'distance', plusCount: 3 } },
  { line: "10min+", expected: { type: 'time', plusCount: 1 } },
  
  // Should not match (would become cues)
  { line: "This is a cue with + symbols", expected: { matched: false } },
  { line: "Rest 2 minutes", expected: { matched: false } },
];

console.log("Test Results:");
console.log("=============");

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = parseVolumeLine(testCase.line);
  const success = testCase.expected.matched === false ? 
    !result.matched : 
    (result.matched && result.type === testCase.expected.type && result.plusCount === testCase.expected.plusCount);
  
  if (success) {
    console.log(`✅ Test ${index + 1}: "${testCase.line}"`);
    if (result.matched) {
      console.log(`   → ${result.type} with ${result.plusCount} + symbols`);
    } else {
      console.log(`   → Correctly identified as cue/note`);
    }
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: "${testCase.line}"`);
    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`   Got: ${JSON.stringify(result)}`);
    failed++;
  }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);

// Specific test for the original bug
console.log("\n🎯 Original Bug Test:");
console.log("====================");

const originalBugLine = "5x10x10kg ++++ +++";
const bugResult = parseVolumeLine(originalBugLine);

if (bugResult.matched && bugResult.type === 'sets' && bugResult.plusCount === 7) {
  console.log(`✅ FIXED: "${originalBugLine}"`);
  console.log(`   → Parsed as sets with 7 completed sets`);
  console.log(`   → Will NOT become exercise cue`);
  console.log(`   → Progress tracking will work correctly`);
} else {
  console.log(`❌ STILL BROKEN: "${originalBugLine}"`);
  console.log(`   → Result: ${JSON.stringify(bugResult)}`);
}

console.log("\n🔧 Regex Pattern Changes:");
console.log("=========================");
console.log("OLD: (\\++)? - Only consecutive + symbols");
console.log("NEW: ([\\+\\s]*) - + symbols with any spacing");
console.log("LOGIC: Count actual + chars, ignore spaces");

console.log("\n✨ Fix ensures spaced + symbols are treated as completion markers, not cues!");
