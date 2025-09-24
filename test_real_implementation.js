// Test the actual implementation from the real files
const fs = require('fs');
const path = require('path');

// Read the actual parser file
const parserPath = path.join(__dirname, 'src/lib/comprehensiveWorkoutParser.ts');
let parserContent = fs.readFileSync(parserPath, 'utf8');

// Convert TypeScript to JavaScript for testing
parserContent = parserContent
  .replace(/export class/g, 'class')
  .replace(/export interface/g, 'interface')
  .replace(/import.*from.*;\n/g, '')
  .replace(/: [A-Za-z\[\]<>{}|,\s]+/g, '') // Remove type annotations
  .replace(/as [A-Za-z\[\]<>{}|,\s'"]+/g, '') // Remove type assertions
  .replace(/\?\./g, '.') // Remove optional chaining for Node.js compatibility
  .replace(/interface.*\{[\s\S]*?\}/g, '') // Remove interface definitions
  .replace(/private static/g, 'static')
  .replace(/static /g, 'static ');

// Write temporary JS file
fs.writeFileSync('temp_parser.js', parserContent);

// Import the real parser
const { ComprehensiveWorkoutParser } = require('./temp_parser.js');

// Test with the real parser
function testRealImplementation() {
  console.log("🧪 Testing with REAL implementation...\n");
  
  // Test the exact scenario: UI checkbox checked → Text → UI
  console.log("=== REAL IMPLEMENTATION TEST ===");
  
  // Step 1: Start with a distance exercise (UI state)
  const initialExercises = [{
    id: 'exercise_0',
    name: 'Running',
    category: 'Cardio',
    muscleGroups: [],
    equipment: [],
    instructions: '',
    sets: [{
      reps: 1,
      restTime: 90,
      notes: '10km',
      volumeType: 'distance',
      distanceUnit: 'km',
      volumeRowId: 'volume-123'
    }]
  }];
  
  const initialProgress = { 'exercise_0': [true] }; // Checkbox is checked
  
  console.log("Initial UI state:");
  console.log("- Exercise:", JSON.stringify(initialExercises[0], null, 2));
  console.log("- Progress:", JSON.stringify(initialProgress, null, 2));
  
  // Step 2: Generate text from UI (this should work)
  const textFromUI = ComprehensiveWorkoutParser.generateWorkoutText(
    { exercises: initialExercises }, 
    initialProgress
  );
  console.log("\nGenerated text from UI:");
  console.log(JSON.stringify(textFromUI));
  console.log("Text content:\n" + textFromUI);
  
  // Step 3: Parse text back (this is where the bug might be)
  const parsedFromText = ComprehensiveWorkoutParser.parseWorkoutText(textFromUI);
  console.log("\nParsed from text:");
  console.log(JSON.stringify(parsedFromText, null, 2));
  
  // Step 4: Convert to exercises (this should work)
  const exercisesFromText = ComprehensiveWorkoutParser.convertToExercises(parsedFromText, { exercises: initialExercises });
  console.log("\nConverted exercises:");
  console.log(JSON.stringify(exercisesFromText, null, 2));
  
  // Step 5: Calculate progress (this is where my fix should work)
  const newProgress = {};
  
  exercisesFromText.forEach((exercise, exerciseIndex) => {
    const parsedExercise = parsedFromText.workout[exerciseIndex];
    const progressArray = new Array(exercise.sets.length).fill(false);
    
    console.log(`\nProcessing exercise ${exerciseIndex}:`);
    console.log("- Parsed exercise:", JSON.stringify(parsedExercise, null, 2));
    console.log("- Final exercise sets count:", exercise.sets.length);
    console.log("- Progress array length:", progressArray.length);
    
    if (parsedExercise) {
      // Handle set-based completion
      if (parsedExercise.sets && parsedExercise.sets.length > 0) {
        console.log("- Has sets, processing set-based completion");
        let setIndex = 0;
        parsedExercise.sets.forEach(parsedSet => {
          const setsCompleted = parsedSet.sets_done || 0;
          const setsPlanned = parsedSet.sets_planned;
          console.log(`  - Set: ${setsCompleted}/${setsPlanned} completed`);
          
          for (let i = 0; i < setsPlanned; i++) {
            if (setIndex < progressArray.length) {
              progressArray[setIndex] = i < setsCompleted;
              setIndex++;
            }
          }
        });
      }
      
      // Handle simple completion (distance/duration)
      const hasNoSets = !parsedExercise.sets || parsedExercise.sets.length === 0;
      console.log("- parsedExercise.done:", parsedExercise.done);
      console.log("- hasNoSets:", hasNoSets);
      console.log("- parsedExercise.sets:", parsedExercise.sets);
      
      if (parsedExercise.done && hasNoSets) {
        console.log("- Applying simple completion (distance/duration)");
        if (progressArray.length > 0) {
          progressArray[0] = true;
          console.log("- Set progressArray[0] = true");
        }
      } else {
        console.log("- NOT applying simple completion");
        console.log("  - done:", parsedExercise.done);
        console.log("  - hasNoSets:", hasNoSets);
      }
    }
    
    console.log("- Final progress array:", progressArray);
    newProgress[exercise.id] = progressArray;
  });
  
  console.log("\nFinal calculated progress:");
  console.log(JSON.stringify(newProgress, null, 2));
  
  // Step 6: Check round-trip
  const originalChecked = initialProgress['exercise_0'][0];
  const finalChecked = newProgress['exercise_0'][0];
  
  console.log(`\n=== ROUND-TRIP RESULT ===`);
  console.log(`Original checkbox: ${originalChecked}`);
  console.log(`Final checkbox: ${finalChecked}`);
  console.log(`Round-trip successful: ${originalChecked === finalChecked}`);
  
  if (originalChecked !== finalChecked) {
    console.log("\n❌ BUG CONFIRMED: Round-trip failed!");
    console.log("The issue is in the progress calculation logic.");
  } else {
    console.log("\n✅ Round-trip successful!");
  }
}

try {
  testRealImplementation();
} catch (error) {
  console.error("Error running test:", error);
} finally {
  // Clean up
  if (fs.existsSync('temp_parser.js')) {
    fs.unlinkSync('temp_parser.js');
  }
}
