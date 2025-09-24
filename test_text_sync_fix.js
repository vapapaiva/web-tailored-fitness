/**
 * Test script to verify text sync fix for progress tracking
 */

// Mock the ComprehensiveWorkoutParser
class ComprehensiveWorkoutParser {
  static parseWorkoutText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const exercises = [];
    let currentExercise = null;
    
    for (const line of lines) {
      if (line.startsWith('- ')) {
        if (currentExercise) {
          exercises.push(currentExercise);
        }
        currentExercise = {
          exercise: line.substring(2).trim(),
          sets: []
        };
      } else if (currentExercise) {
        // Check for set line with progress (3x10x25kg ++)
        const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)(?:\s*x\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|lb)))?\s*(\++)?\s*$/);
        if (setMatch) {
          const [, setsPlanned, reps, weight, pluses] = setMatch;
          currentExercise.sets.push({
            sets_planned: parseInt(setsPlanned),
            reps: parseInt(reps),
            weight: weight?.trim(),
            sets_done: pluses ? pluses.length : 0
          });
        }
        
        // Check for distance line (10km +)
        const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*(\+*)\s*$/);
        if (distanceMatch) {
          const [, value, unit, pluses] = distanceMatch;
          currentExercise.distance = `${value}${unit}`;
          currentExercise.distanceDone = pluses.length > 0;
        }
        
        // Check for time line (15m +)
        const timeMatch = line.match(/^\s*(?:(\d+)h)?\s*(?:(\d+)(?:m|min))?\s*(\+*)\s*$/);
        if (timeMatch) {
          const [, hours, minutes, pluses] = timeMatch;
          let timeStr = '';
          if (hours) timeStr += hours + 'h';
          if (minutes) timeStr += minutes + 'm';
          if (timeStr) {
            currentExercise.time = timeStr;
            currentExercise.timeDone = pluses.length > 0;
          }
        }
      }
    }
    
    if (currentExercise) {
      exercises.push(currentExercise);
    }
    
    return { workout: exercises };
  }
  
  static convertToExercises(parsedWorkout, existingWorkout) {
    return parsedWorkout.workout.map((parsedExercise, index) => {
      const exercise = {
        id: `exercise_${index}`,
        name: parsedExercise.exercise,
        category: 'General',
        muscleGroups: [],
        equipment: [],
        instructions: '',
        sets: []
      };
      
      // Convert sets
      if (parsedExercise.sets) {
        parsedExercise.sets.forEach(parsedSet => {
          for (let i = 0; i < parsedSet.sets_planned; i++) {
            exercise.sets.push({
              reps: parsedSet.reps,
              restTime: 90,
              notes: '',
              volumeType: parsedSet.weight ? 'sets-reps-weight' : 'sets-reps',
              weight: parsedSet.weight ? parseFloat(parsedSet.weight) : undefined,
              weightUnit: parsedSet.weight?.includes('kg') ? 'kg' : 'lb'
            });
          }
        });
      }
      
      // Handle distance
      if (parsedExercise.distance) {
        exercise.sets.push({
          reps: 1,
          restTime: 90,
          notes: parsedExercise.distance,
          volumeType: 'distance',
          distanceUnit: parsedExercise.distance.includes('km') ? 'km' : 'mi'
        });
      }
      
      // Handle time
      if (parsedExercise.time) {
        exercise.sets.push({
          reps: 1,
          restTime: 90,
          notes: parsedExercise.time,
          volumeType: 'duration',
          duration: parsedExercise.time.includes('m') ? parseInt(parsedExercise.time) * 60 : 0
        });
      }
      
      return exercise;
    });
  }
}

// Test the progress calculation logic
function calculateProgressFromParsed(parsed, finalExercises, existingProgress = {}) {
  const newProgress = {};
  
  finalExercises.forEach((exercise, exerciseIndex) => {
    const parsedExercise = parsed.workout[exerciseIndex];
    const existingProg = existingProgress[exercise.id] || [];
    const progressArray = new Array(exercise.sets.length).fill(false);
    
    if (parsedExercise) {
      // Handle set-based completion (3x10x25kg ++)
      if (parsedExercise.sets && parsedExercise.sets.length > 0) {
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
      
      // Handle distance/duration completion
      exercise.sets.forEach((set, setIndex) => {
        if (set.volumeType === 'distance' && parsedExercise.distanceDone) {
          if (setIndex < progressArray.length) {
            progressArray[setIndex] = true;
          }
        } else if (set.volumeType === 'duration' && parsedExercise.timeDone) {
          if (setIndex < progressArray.length) {
            progressArray[setIndex] = true;
          }
        }
      });
    }
    
    newProgress[exercise.id] = progressArray;
  });
  
  return newProgress;
}

// Test cases
function runTests() {
  console.log("🧪 Testing text sync progress calculation...\n");
  
  // Test 1: Sets with progress
  console.log("Test 1: Sets with progress");
  const text1 = `- Push ups
3x10 ++
- Pull ups  
3x8x25kg +++`;
  
  const parsed1 = ComprehensiveWorkoutParser.parseWorkoutText(text1);
  const exercises1 = ComprehensiveWorkoutParser.convertToExercises(parsed1);
  const progress1 = calculateProgressFromParsed(parsed1, exercises1);
  
  console.log("Parsed exercises:", exercises1.map(ex => ({ name: ex.name, sets: ex.sets.length })));
  console.log("Calculated progress:", progress1);
  console.log("Expected: Push ups [true, true, false], Pull ups [true, true, true]");
  console.log("Actual:  ", Object.values(progress1).map(p => p.toString()));
  console.log("");
  
  // Test 2: Distance with progress
  console.log("Test 2: Distance with progress");
  const text2 = `- Running
10km +
- Walking
5km`;
  
  const parsed2 = ComprehensiveWorkoutParser.parseWorkoutText(text2);
  const exercises2 = ComprehensiveWorkoutParser.convertToExercises(parsed2);
  const progress2 = calculateProgressFromParsed(parsed2, exercises2);
  
  console.log("Parsed exercises:", exercises2.map(ex => ({ name: ex.name, sets: ex.sets.length })));
  console.log("Calculated progress:", progress2);
  console.log("Expected: Running [true], Walking [false]");
  console.log("Actual:  ", Object.values(progress2).map(p => p.toString()));
  console.log("");
  
  // Test 3: Duration with progress
  console.log("Test 3: Duration with progress");
  const text3 = `- Plank
60s +
- Rest
5m`;
  
  const parsed3 = ComprehensiveWorkoutParser.parseWorkoutText(text3);
  const exercises3 = ComprehensiveWorkoutParser.convertToExercises(parsed3);
  const progress3 = calculateProgressFromParsed(parsed3, exercises3);
  
  console.log("Parsed exercises:", exercises3.map(ex => ({ name: ex.name, sets: ex.sets.length })));
  console.log("Calculated progress:", progress3);
  console.log("Expected: Plank [true], Rest [false]");
  console.log("Actual:  ", Object.values(progress3).map(p => p.toString()));
  console.log("");
  
  console.log("✅ All tests completed!");
}

runTests();
