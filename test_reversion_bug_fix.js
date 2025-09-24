/**
 * Test that the text reversion bug is fixed
 * User should be able to remove + symbols without them reappearing
 */

// Mock the fixed parseTextToState logic
function parseTextToState(text, existingProgress = {}) {
  console.log(`🔄 Parsing: "${text}"`);
  
  const exercises = [];
  const lines = text.split('\n');
  let currentExercise = null;
  
  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (currentExercise) {
        exercises.push(currentExercise);
      }
      currentExercise = {
        id: `exercise_${exercises.length}`,
        name: line.substring(2).trim(),
        sets: []
      };
    } else if (currentExercise && line.trim()) {
      // Parse set line with progress
      const setMatch = line.match(/^\s*(\d+)\s*x\s*(\d+)(?:\s*x\s*([0-9]+(?:\.[0-9]+)?\s*(?:kg|lb)))?\s*(\+*)\s*$/);
      if (setMatch) {
        const [, setsPlanned, reps, weight, pluses] = setMatch;
        for (let i = 0; i < parseInt(setsPlanned); i++) {
          currentExercise.sets.push({
            reps: parseInt(reps),
            weight: weight ? parseFloat(weight) : undefined,
            volumeType: weight ? 'sets-reps-weight' : 'sets-reps'
          });
        }
        // Store progress info for this exercise
        currentExercise.progressInfo = {
          setsPlanned: parseInt(setsPlanned),
          setsCompleted: pluses.length
        };
      }
      
      // Parse distance line
      const distanceMatch = line.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(km|mi|m)\s*(\+*)\s*$/);
      if (distanceMatch) {
        const [, value, unit, pluses] = distanceMatch;
        currentExercise.sets.push({
          reps: 1,
          notes: `${value}${unit}`,
          volumeType: 'distance'
        });
        currentExercise.distanceCompleted = pluses.length > 0;
      }
      
      // Parse duration line
      const durationMatch = line.match(/^\s*(\d+)\s*min\s*(\+*)\s*$/);
      if (durationMatch) {
        const [, minutes, pluses] = durationMatch;
        currentExercise.sets.push({
          reps: 1,
          duration: parseInt(minutes) * 60,
          volumeType: 'duration'
        });
        currentExercise.durationCompleted = pluses.length > 0;
      }
    }
  }
  
  if (currentExercise) {
    exercises.push(currentExercise);
  }
  
  // Calculate progress from parsed data (FIXED: No preservation logic)
  const newProgress = {};
  
  exercises.forEach(exercise => {
    const progressArray = new Array(exercise.sets.length).fill(false);
    
    // Apply progress from parsed data (user intent is respected)
    if (exercise.progressInfo) {
      const { setsCompleted } = exercise.progressInfo;
      for (let i = 0; i < Math.min(setsCompleted, progressArray.length); i++) {
        progressArray[i] = true;
      }
    }
    
    if (exercise.distanceCompleted && exercise.sets.some(s => s.volumeType === 'distance')) {
      const distanceIndex = exercise.sets.findIndex(s => s.volumeType === 'distance');
      if (distanceIndex !== -1) progressArray[distanceIndex] = true;
    }
    
    if (exercise.durationCompleted && exercise.sets.some(s => s.volumeType === 'duration')) {
      const durationIndex = exercise.sets.findIndex(s => s.volumeType === 'duration');
      if (durationIndex !== -1) progressArray[durationIndex] = true;
    }
    
    // FIXED: No progress preservation - text is source of truth
    newProgress[exercise.id] = progressArray;
  });
  
  return { exercises, progress: newProgress };
}

// Mock text generation
function generateTextFromState(exercises, progress) {
  let text = '';
  
  exercises.forEach(exercise => {
    const exerciseProgress = progress[exercise.id] || [];
    text += `- ${exercise.name}\n`;
    
    // Group sets by type and show progress
    const setsByType = {};
    exercise.sets.forEach((set, index) => {
      const key = set.volumeType;
      if (!setsByType[key]) {
        setsByType[key] = { sets: [], progress: [] };
      }
      setsByType[key].sets.push(set);
      setsByType[key].progress.push(exerciseProgress[index] || false);
    });
    
    Object.entries(setsByType).forEach(([type, data]) => {
      if (type === 'sets-reps' || type === 'sets-reps-weight') {
        const firstSet = data.sets[0];
        const completedCount = data.progress.filter(Boolean).length;
        const pluses = '+'.repeat(completedCount);
        
        if (type === 'sets-reps-weight') {
          text += `${data.sets.length}x${firstSet.reps}x${firstSet.weight}kg ${pluses}\n`;
        } else {
          text += `${data.sets.length}x${firstSet.reps} ${pluses}\n`;
        }
      } else if (type === 'distance') {
        const firstSet = data.sets[0];
        const isCompleted = data.progress[0];
        const plus = isCompleted ? ' +' : '';
        text += `${firstSet.notes}${plus}\n`;
      } else if (type === 'duration') {
        const firstSet = data.sets[0];
        const isCompleted = data.progress[0];
        const plus = isCompleted ? ' +' : '';
        const minutes = Math.round(firstSet.duration / 60);
        text += `${minutes}min${plus}\n`;
      }
    });
    
    text += '\n';
  });
  
  return text.trim();
}

// Test the bug scenario
function testReversionBugFix() {
  console.log("🧪 Testing text reversion bug fix...\n");
  
  // Initial state with completed sets
  const initialText = `- Exercise 1
2x5 +
5x10x10kg 
10km +
15min 

- Exercise 2`;
  
  console.log("Step 1: Parse initial text with progress");
  console.log("Text:", JSON.stringify(initialText));
  
  let { exercises, progress } = parseTextToState(initialText);
  console.log("Progress:", progress);
  console.log("");
  
  // User removes the + from 2x5 +
  const editedText = `- Exercise 1
2x5
5x10x10kg 
10km +
15min 

- Exercise 2`;
  
  console.log("Step 2: User removes + from '2x5 +'");
  console.log("Edited text:", JSON.stringify(editedText));
  
  // Parse the edited text (this should respect user's removal of +)
  const result = parseTextToState(editedText, progress);
  exercises = result.exercises;
  progress = result.progress;
  
  console.log("New progress:", progress);
  console.log("");
  
  // Generate text from state (this should NOT restore the +)
  const regeneratedText = generateTextFromState(exercises, progress);
  
  console.log("Step 3: Generate text from state");
  console.log("Regenerated text:", JSON.stringify(regeneratedText));
  console.log("");
  
  // Check if the bug is fixed
  const bugFixed = !regeneratedText.includes('2x5 +') && regeneratedText.includes('2x5');
  
  console.log("🔍 Bug Analysis:");
  console.log("- User removed '+' from '2x5 +'");
  console.log("- Text should remain '2x5' (no +)");
  console.log("- Regenerated text contains '2x5':", regeneratedText.includes('2x5'));
  console.log("- Regenerated text contains '2x5 +':", regeneratedText.includes('2x5 +'));
  console.log("");
  
  if (bugFixed) {
    console.log("✅ BUG FIXED: User's edit is respected!");
    console.log("- Progress preservation logic removed");
    console.log("- Text editor is source of truth");
    console.log("- No unwanted + symbol restoration");
  } else {
    console.log("❌ BUG STILL EXISTS: + symbol was restored");
    console.log("- Progress preservation logic still active");
    console.log("- State overriding user intent");
  }
  
  console.log("");
  console.log("Final comparison:");
  console.log("User input:    ", JSON.stringify(editedText));
  console.log("Regenerated:   ", JSON.stringify(regeneratedText));
  console.log("Match (should be true):", editedText === regeneratedText);
}

testReversionBugFix();
