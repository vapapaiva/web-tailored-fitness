/**
 * Test script to verify exercise completion functionality
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
          this.processExerciseHeader(currentExercise);
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
      this.processExerciseHeader(currentExercise);
      exercises.push(currentExercise);
    }
    
    return { workout: exercises };
  }
  
  static processExerciseHeader(exercise) {
    const rawHeader = exercise.exercise;
    
    // Check if exercise has volume (sets, distance, or time)
    const hasVolume = (exercise.sets && exercise.sets.length > 0) || 
                      exercise.distance || 
                      exercise.time;
    
    if (rawHeader.endsWith('+')) {
      exercise.exercise = rawHeader.replace(/\+\s*$/, '').trim();
      
      if (hasVolume) {
        // Has volume: + after exercise name marks all volume as done
        exercise.exerciseLevelDone = true;
      } else {
        // No volume: + after exercise name marks exercise as done
        exercise.done = true;
      }
    }
  }
  
  static convertToExercises(parsedWorkout) {
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
      
      // Ensure all exercises have at least one set for progress tracking
      if (exercise.sets.length === 0) {
        exercise.sets.push({
          reps: 1,
          restTime: 0,
          notes: '',
          volumeType: 'completion'
        });
      }
      
      return exercise;
    });
  }
  
  static generateWorkoutText(workout, progress) {
    let text = '';
    
    workout.exercises.forEach(exercise => {
      const exerciseProgress = progress[exercise.id] || [];
      
      // Check if this is a completion-only exercise (no real volume)
      const hasOnlyCompletionSets = exercise.sets.every(set => set.volumeType === 'completion');
      const isCompletionExerciseCompleted = hasOnlyCompletionSets && exerciseProgress.some(Boolean);
      
      // Generate exercise name with completion marker if needed
      if (isCompletionExerciseCompleted) {
        text += `- ${exercise.name} +\n`;
      } else {
        text += `- ${exercise.name}\n`;
      }
      
      // Only show volume for exercises that have real volume (not just completion sets)
      if (!hasOnlyCompletionSets) {
        // Simple volume display for testing
        exercise.sets.forEach((set, index) => {
          if (set.volumeType !== 'completion') {
            const isCompleted = exerciseProgress[index] ? '+' : '';
            if (set.volumeType === 'sets-reps-weight') {
              text += `1x${set.reps}x${set.weight}${set.weightUnit} ${isCompleted}\n`;
            } else if (set.volumeType === 'distance') {
              text += `${set.notes} ${isCompleted}\n`;
            } else if (set.volumeType === 'duration') {
              text += `${Math.round(set.duration/60)}m ${isCompleted}\n`;
            } else {
              text += `1x${set.reps} ${isCompleted}\n`;
            }
          }
        });
      }
      
      text += '\n';
    });
    
    return text.trim();
  }
}

// Test the new functionality
function runTests() {
  console.log("🧪 Testing exercise completion functionality...\n");
  
  // Test 1: Exercise without volume, marked as done
  console.log("Test 1: Exercise without volume, marked as done");
  const text1 = `- Warm up +`;
  
  const parsed1 = ComprehensiveWorkoutParser.parseWorkoutText(text1);
  const exercises1 = ComprehensiveWorkoutParser.convertToExercises(parsed1);
  
  console.log("Parsed exercise:", parsed1.workout[0]);
  console.log("Converted exercise:", {
    name: exercises1[0].name,
    sets: exercises1[0].sets.map(s => ({ volumeType: s.volumeType, reps: s.reps }))
  });
  console.log("Expected: done=true, has completion set");
  console.log("");
  
  // Test 2: Exercise with volume, exercise-level completion
  console.log("Test 2: Exercise with volume, exercise-level completion");
  const text2 = `- Push ups +
3x10`;
  
  const parsed2 = ComprehensiveWorkoutParser.parseWorkoutText(text2);
  const exercises2 = ComprehensiveWorkoutParser.convertToExercises(parsed2);
  
  console.log("Parsed exercise:", parsed2.workout[0]);
  console.log("Converted exercise:", {
    name: exercises2[0].name,
    sets: exercises2[0].sets.map(s => ({ volumeType: s.volumeType, reps: s.reps }))
  });
  console.log("Expected: exerciseLevelDone=true, has 3 sets");
  console.log("");
  
  // Test 3: Text generation for completion-only exercise
  console.log("Test 3: Text generation for completion-only exercise");
  const workout3 = {
    exercises: [{
      id: 'ex1',
      name: 'Warm up',
      sets: [{ reps: 1, volumeType: 'completion' }]
    }]
  };
  const progress3 = { ex1: [true] }; // Completed
  
  const generatedText3 = ComprehensiveWorkoutParser.generateWorkoutText(workout3, progress3);
  console.log("Generated text:", JSON.stringify(generatedText3));
  console.log("Expected: '- Warm up +'");
  console.log("");
  
  // Test 4: Text generation for exercise with volume
  console.log("Test 4: Text generation for exercise with volume");
  const workout4 = {
    exercises: [{
      id: 'ex1',
      name: 'Push ups',
      sets: [
        { reps: 10, volumeType: 'sets-reps' },
        { reps: 10, volumeType: 'sets-reps' },
        { reps: 10, volumeType: 'sets-reps' }
      ]
    }]
  };
  const progress4 = { ex1: [true, true, false] }; // 2 of 3 completed
  
  const generatedText4 = ComprehensiveWorkoutParser.generateWorkoutText(workout4, progress4);
  console.log("Generated text:", JSON.stringify(generatedText4));
  console.log("Expected: Shows individual set completion, not exercise-level +");
  console.log("");
  
  console.log("✅ All tests completed!");
}

runTests();
