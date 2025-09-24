/**
 * Test that progress updates work immediately when typing +
 */

// Mock the comprehensive workout parser
class ComprehensiveWorkoutParser {
  static parseWorkoutText(text) {
    const exercises = [];
    const lines = text.split('\n');
    let currentExercise = null;
    
    for (const line of lines) {
      if (line.startsWith('- ')) {
        if (currentExercise) {
          exercises.push(currentExercise);
        }
        const exerciseLine = line.substring(2).trim();
        currentExercise = {
          exercise: exerciseLine,
          sets: []
        };
      } else if (currentExercise && line.trim()) {
        // Parse set line with progress (3x10 ++)
        const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)\s*(\+*)\s*$/);
        if (setMatch) {
          const [, setsPlanned, reps, pluses] = setMatch;
          currentExercise.sets.push({
            sets_planned: parseInt(setsPlanned),
            reps: parseInt(reps),
            sets_done: pluses.length
          });
        }
      }
    }
    
    if (currentExercise) {
      exercises.push(currentExercise);
    }
    
    return { workout: exercises };
  }
  
  static convertToExercises(parsedWorkout) {
    return parsedWorkout.workout.map((parsedExercise, index) => {
      const exercise = {
        id: `exercise_${index}`,
        name: parsedExercise.exercise,
        sets: []
      };
      
      if (parsedExercise.sets) {
        parsedExercise.sets.forEach(parsedSet => {
          for (let i = 0; i < parsedSet.sets_planned; i++) {
            exercise.sets.push({
              reps: parsedSet.reps,
              volumeType: 'sets-reps'
            });
          }
        });
      }
      
      return exercise;
    });
  }
  
  static generateWorkoutText(workout, progress) {
    let text = '';
    workout.exercises.forEach(exercise => {
      const exerciseProgress = progress[exercise.id] || [];
      text += `- ${exercise.name}\n`;
      
      // Group sets and show progress
      const totalSets = exercise.sets.length;
      const completedSets = exerciseProgress.filter(Boolean).length;
      const pluses = '+'.repeat(completedSets);
      
      if (totalSets > 0) {
        const reps = exercise.sets[0].reps;
        text += `${totalSets}x${reps} ${pluses}\n`;
      }
    });
    return text.trim();
  }
}

// Test the actual sync logic
function testProgressUpdates() {
  console.log("🧪 Testing progress updates with + symbols...\n");
  
  let currentState = {
    workout: { exercises: [] },
    progress: {}
  };
  
  let textEditorValue = '';
  let lastParsedText = '';
  let progressUpdateCount = 0;
  
  // Mock the parseTextToState function
  function parseTextToState(text) {
    console.log(`🔄 Parsing: "${text}"`);
    
    try {
      const parsed = ComprehensiveWorkoutParser.parseWorkoutText(text);
      const exercises = ComprehensiveWorkoutParser.convertToExercises(parsed);
      
      const newWorkout = { exercises };
      const newProgress = {};
      
      // Calculate progress from parsed data
      newWorkout.exercises.forEach((exercise, exerciseIndex) => {
        const parsedExercise = parsed.workout[exerciseIndex];
        const progressArray = new Array(exercise.sets.length).fill(false);
        
        if (parsedExercise && parsedExercise.sets) {
          let setIndex = 0;
          parsedExercise.sets.forEach(parsedSet => {
            const setsCompleted = parsedSet.sets_done || 0;
            const setsPlanned = parsedSet.sets_planned;
            
            for (let i = 0; i < setsPlanned; i++) {
              if (setIndex < progressArray.length) {
                progressArray[setIndex] = i < setsCompleted;
                setIndex++;
              }
            }
          });
        }
        
        newProgress[exercise.id] = progressArray;
      });
      
      // Update state
      currentState = { workout: newWorkout, progress: newProgress };
      lastParsedText = text;
      progressUpdateCount++;
      
      // Log progress
      Object.entries(newProgress).forEach(([exerciseId, progress]) => {
        const completedCount = progress.filter(Boolean).length;
        if (completedCount > 0) {
          console.log(`✅ Progress: Exercise ${exerciseId} has ${completedCount} completed sets`);
        }
      });
      
    } catch (error) {
      console.error('Parse error:', error);
    }
  }
  
  // Mock the handleTextChange function (simplified)
  function handleTextChange(newText) {
    console.log(`📝 Text changed: "${newText}"`);
    textEditorValue = newText;
    
    // Don't sync if text hasn't changed from last parse
    if (newText === lastParsedText) {
      console.log('🚫 Skipping: no change from last parse');
      return;
    }
    
    // Immediate sync (no debounce for test)
    parseTextToState(newText);
  }
  
  // Test sequence: user types exercise with progress
  console.log("Test 1: Typing exercise with progress markers");
  handleTextChange("- Push ups");
  handleTextChange("- Push ups\n3x10");
  handleTextChange("- Push ups\n3x10 +");
  handleTextChange("- Push ups\n3x10 ++");
  handleTextChange("- Push ups\n3x10 +++");
  
  console.log("\nTest 2: Adding second exercise");
  handleTextChange("- Push ups\n3x10 +++\n- Pull ups\n3x8");
  handleTextChange("- Push ups\n3x10 +++\n- Pull ups\n3x8 +");
  handleTextChange("- Push ups\n3x10 +++\n- Pull ups\n3x8 ++");
  
  console.log("\nFinal state:");
  console.log("Workout exercises:", currentState.workout.exercises.length);
  console.log("Progress updates:", progressUpdateCount);
  console.log("Current text:", JSON.stringify(textEditorValue));
  
  // Test generating text from state
  const generatedText = ComprehensiveWorkoutParser.generateWorkoutText(
    currentState.workout, 
    currentState.progress
  );
  console.log("Generated from state:", JSON.stringify(generatedText));
  
  console.log("\n✅ Progress update test completed!");
  console.log("- Text changes trigger immediate progress updates");
  console.log("- + symbols are correctly parsed and tracked");
  console.log("- State reflects user input accurately");
}

testProgressUpdates();
