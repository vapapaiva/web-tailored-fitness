// Comprehensive tests for text ↔ UI synchronization
// This will help us debug the distance/duration completion issue

// Mock the parser logic
class TestParser {
  static parseWorkoutText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const exercises = [];
    let currentExercise = null;
    
    for (const line of lines) {
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
        continue;
      }
      
      if (currentExercise) {
        // Check for set line (3x10x25kg ++)
        const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)(?:\s*x\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|lb)))?\s*(\++)?\s*$/);
        if (setMatch) {
          const [, setsPlanned, reps, weight, pluses] = setMatch;
          currentExercise.sets.push({
            sets_planned: parseInt(setsPlanned),
            reps: parseInt(reps),
            weight: weight ? weight.trim() : undefined,
            sets_done: pluses ? pluses.length : undefined
          });
          continue;
        }
        
        // Check for distance line (10km +)
        const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*(\+*)\s*$/);
        if (distanceMatch) {
          const [, value, unit, pluses] = distanceMatch;
          currentExercise.distance = `${value}${unit}`;
          if (pluses) {
            currentExercise.done = true;
          }
          continue;
        }
        
        // Check for time line (15min +)
        const timeMatch = line.match(/^\s*(?:(\d+)h)?\s*(?:(\d+)(?:m|min))?\s*(\+*)\s*$/);
        if (timeMatch) {
          const [, hours, minutes, pluses] = timeMatch;
          let timeStr = '';
          if (hours) timeStr += hours + 'h';
          if (minutes) timeStr += minutes + 'm';
          if (timeStr) {
            currentExercise.time = timeStr;
            if (pluses) {
              currentExercise.done = true;
            }
          }
          continue;
        }
      }
    }
    
    if (currentExercise) {
      exercises.push(currentExercise);
    }
    
    return { workout: exercises };
  }
  
  static convertToExercises(parsed) {
    return parsed.workout.map((parsedExercise, index) => {
      const exercise = {
        id: `exercise_${index}`,
        name: parsedExercise.exercise,
        sets: []
      };
      
      // Convert sets
      if (parsedExercise.sets) {
        parsedExercise.sets.forEach(parsedSet => {
          for (let i = 0; i < parsedSet.sets_planned; i++) {
            exercise.sets.push({
              reps: parsedSet.reps,
              volumeType: parsedSet.weight ? 'sets-reps-weight' : 'sets-reps',
              weight: parsedSet.weight ? parseFloat(parsedSet.weight) : undefined
            });
          }
        });
      }
      
      // Handle distance
      if (parsedExercise.distance) {
        const distanceMatch = parsedExercise.distance.match(/([0-9]+(?:\.[0-9]+)?)(km|mi|m)/);
        if (distanceMatch) {
          exercise.sets.push({
            reps: 1,
            notes: parsedExercise.distance,
            volumeType: 'distance',
            distanceUnit: distanceMatch[2]
          });
        }
      }
      
      // Handle time
      if (parsedExercise.time) {
        exercise.sets.push({
          reps: 1,
          notes: parsedExercise.time,
          volumeType: 'duration',
          duration: this.parseTimeToSeconds(parsedExercise.time)
        });
      }
      
      return exercise;
    });
  }
  
  static parseTimeToSeconds(timeStr) {
    let totalSeconds = 0;
    const hoursMatch = timeStr.match(/(\d+)h/);
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    const minutesMatch = timeStr.match(/(\d+)m/);
    if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
    return totalSeconds;
  }
  
  static generateWorkoutText(workout, progress) {
    let text = '';
    
    workout.exercises.forEach(exercise => {
      const exerciseProgress = progress[exercise.id] || [];
      text += `- ${exercise.name}\n`;
      
      // Group sets by type for better display
      const groupedSets = this.groupSetsByType(exercise.sets, exerciseProgress);
      
      Object.entries(groupedSets).forEach(([key, group]) => {
        const completedCount = group.completedCount;
        const totalSets = group.sets.length;
        const pluses = '+'.repeat(completedCount);
        
        // For distance and duration, don't prefix with sets count
        const firstSet = group.sets[0];
        if (firstSet?.volumeType === 'distance' || firstSet?.volumeType === 'duration') {
          text += `${key} ${pluses}\n`;
        } else {
          text += `${totalSets}x${key} ${pluses}\n`;
        }
      });
      
      text += '\n';
    });
    
    return text.trim();
  }
  
  static groupSetsByType(sets, progress) {
    const groups = {};
    
    sets.forEach((set, index) => {
      let key = '';
      if (set.volumeType === 'sets-reps-weight') {
        key = `${set.reps}x${set.weight || 0}kg`;
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
      if (progress[index]) {
        groups[key].completedCount++;
      }
    });
    
    return groups;
  }
}

// Mock the progress calculation logic from WorkoutExecutionMode
function calculateProgressFromParsed(parsed, finalExercises, existingProgress = {}) {
  const newProgress = {};
  
  finalExercises.forEach((exercise, exerciseIndex) => {
    const parsedExercise = parsed.workout[exerciseIndex];
    const existingProg = existingProgress[exercise.id] || [];
    const progressArray = new Array(exercise.sets.length).fill(false);
    
    if (parsedExercise) {
      // Handle set-based completion (3x10x25kg ++)
      if (parsedExercise.sets) {
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
      
      // Handle simple completion (10km +, 15min +)
      if (parsedExercise.done && (!parsedExercise.sets || parsedExercise.sets.length === 0)) {
        // Mark the first set as completed for distance/duration exercises
        if (progressArray.length > 0) {
          progressArray[0] = true;
        }
      }
    }
    
    newProgress[exercise.id] = progressArray;
  });
  
  return newProgress;
}

// Test cases
function runTests() {
  console.log("🧪 Running comprehensive sync tests...\n");
  
  // Test 1: Distance exercise with completion
  console.log("Test 1: Distance exercise with completion");
  const distanceText = `- Running
10km +`;
  
  console.log("Input text:", JSON.stringify(distanceText));
  
  const parsed1 = TestParser.parseWorkoutText(distanceText);
  console.log("Parsed:", JSON.stringify(parsed1, null, 2));
  
  const exercises1 = TestParser.convertToExercises(parsed1);
  console.log("Converted exercises:", JSON.stringify(exercises1, null, 2));
  
  const progress1 = calculateProgressFromParsed(parsed1, exercises1);
  console.log("Calculated progress:", JSON.stringify(progress1, null, 2));
  
  const regeneratedText1 = TestParser.generateWorkoutText({ exercises: exercises1 }, progress1);
  console.log("Regenerated text:", JSON.stringify(regeneratedText1));
  console.log("Round-trip successful:", distanceText.trim() === regeneratedText1.trim());
  console.log("---\n");
  
  // Test 2: Duration exercise with completion
  console.log("Test 2: Duration exercise with completion");
  const durationText = `- Plank
15min +`;
  
  console.log("Input text:", JSON.stringify(durationText));
  
  const parsed2 = TestParser.parseWorkoutText(durationText);
  console.log("Parsed:", JSON.stringify(parsed2, null, 2));
  
  const exercises2 = TestParser.convertToExercises(parsed2);
  console.log("Converted exercises:", JSON.stringify(exercises2, null, 2));
  
  const progress2 = calculateProgressFromParsed(parsed2, exercises2);
  console.log("Calculated progress:", JSON.stringify(progress2, null, 2));
  
  const regeneratedText2 = TestParser.generateWorkoutText({ exercises: exercises2 }, progress2);
  console.log("Regenerated text:", JSON.stringify(regeneratedText2));
  console.log("Round-trip successful:", durationText.trim() === regeneratedText2.trim());
  console.log("---\n");
  
  // Test 3: Sets exercise with partial completion
  console.log("Test 3: Sets exercise with partial completion");
  const setsText = `- Push ups
3x10 ++`;
  
  console.log("Input text:", JSON.stringify(setsText));
  
  const parsed3 = TestParser.parseWorkoutText(setsText);
  console.log("Parsed:", JSON.stringify(parsed3, null, 2));
  
  const exercises3 = TestParser.convertToExercises(parsed3);
  console.log("Converted exercises:", JSON.stringify(exercises3, null, 2));
  
  const progress3 = calculateProgressFromParsed(parsed3, exercises3);
  console.log("Calculated progress:", JSON.stringify(progress3, null, 2));
  
  const regeneratedText3 = TestParser.generateWorkoutText({ exercises: exercises3 }, progress3);
  console.log("Regenerated text:", JSON.stringify(regeneratedText3));
  console.log("Round-trip successful:", setsText.trim() === regeneratedText3.trim());
  console.log("---\n");
  
  // Test 4: UI → Text → UI simulation
  console.log("Test 4: UI → Text → UI simulation");
  
  // Start with a distance exercise (unchecked)
  const initialExercises = [{
    id: 'exercise_0',
    name: 'Running',
    sets: [{
      reps: 1,
      notes: '10km',
      volumeType: 'distance',
      distanceUnit: 'km'
    }]
  }];
  
  const initialProgress = { 'exercise_0': [false] };
  console.log("Initial state - exercises:", JSON.stringify(initialExercises, null, 2));
  console.log("Initial state - progress:", JSON.stringify(initialProgress, null, 2));
  
  // Step 1: User checks the checkbox (UI change)
  const uiProgress = { 'exercise_0': [true] };
  console.log("After UI check - progress:", JSON.stringify(uiProgress, null, 2));
  
  // Step 2: Generate text from UI state
  const textFromUI = TestParser.generateWorkoutText({ exercises: initialExercises }, uiProgress);
  console.log("Generated text from UI:", JSON.stringify(textFromUI));
  
  // Step 3: Parse text back to UI state
  const parsedFromText = TestParser.parseWorkoutText(textFromUI);
  console.log("Parsed from text:", JSON.stringify(parsedFromText, null, 2));
  
  const exercisesFromText = TestParser.convertToExercises(parsedFromText);
  console.log("Exercises from text:", JSON.stringify(exercisesFromText, null, 2));
  
  const progressFromText = calculateProgressFromParsed(parsedFromText, exercisesFromText);
  console.log("Progress from text:", JSON.stringify(progressFromText, null, 2));
  
  // Step 4: Check if round-trip preserved the checkbox state
  const originalChecked = uiProgress['exercise_0'][0];
  const finalChecked = progressFromText['exercise_0'][0];
  console.log(`Round-trip checkbox state: ${originalChecked} → ${finalChecked}`);
  console.log("Round-trip successful:", originalChecked === finalChecked);
}

runTests();
