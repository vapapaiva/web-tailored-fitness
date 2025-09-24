// Simple test to debug the parser
const testText = `- Running
10km +`;

console.log("Testing parser with:", testText);

// Simulate the parsing logic
const lines = testText.split('\n').map(line => line.trim());
console.log("Lines:", lines);

let currentExercise = null;
const exercises = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  console.log(`Processing line ${i}: "${line}"`);
  
  // Check for exercise header
  const headerMatch = line.match(/^-+\s+(.*)$/);
  if (headerMatch) {
    if (currentExercise) {
      exercises.push(currentExercise);
    }
    currentExercise = {
      exercise: headerMatch[1],
      sets: []
    };
    console.log("Found exercise header:", currentExercise.exercise);
    continue;
  }
  
  // Check for distance line
  const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*(\+*)\s*$/);
  if (distanceMatch) {
    const [, value, unit, pluses] = distanceMatch;
    console.log("Distance match:", { value, unit, pluses });
    currentExercise.distance = `${value}${unit}`;
    if (pluses) {
      currentExercise.done = true;
      console.log("Set done = true");
    }
    continue;
  }
}

if (currentExercise) {
  exercises.push(currentExercise);
}

console.log("Final parsed exercises:", JSON.stringify(exercises, null, 2));
