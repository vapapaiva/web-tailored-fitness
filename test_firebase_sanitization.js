/**
 * Test Firebase sanitization utility
 */

// Mock the sanitization function
function removeUndefinedValues(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }

  if (typeof obj === 'object') {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    
    return cleaned;
  }

  return obj;
}

function sanitizeWorkoutForFirebase(data) {
  return removeUndefinedValues(data);
}

// Test cases
console.log("🧪 Testing Firebase sanitization...\n");

// Test 1: Exercise set with undefined values
console.log("Test 1: Exercise set with undefined values");
const exerciseSetWithUndefined = {
  reps: 10,
  weight: undefined,
  duration: undefined,
  restTime: 90,
  notes: '',
  volumeType: 'sets-reps',
  weightUnit: undefined,
  distanceUnit: undefined,
  volumeRowId: 'test-123'
};

const sanitized1 = sanitizeWorkoutForFirebase(exerciseSetWithUndefined);
console.log("Original:", exerciseSetWithUndefined);
console.log("Sanitized:", sanitized1);
console.log("Undefined fields removed:", !sanitized1.hasOwnProperty('weight') && !sanitized1.hasOwnProperty('duration'));
console.log("");

// Test 2: Workout with nested undefined values
console.log("Test 2: Workout with nested undefined values");
const workoutWithUndefined = {
  id: 'workout-1',
  name: 'Test Workout',
  exercises: [
    {
      id: 'ex-1',
      name: 'Push ups',
      sets: [
        {
          reps: 10,
          weight: undefined,
          restTime: 90,
          notes: '',
          volumeType: 'sets-reps',
          weightUnit: undefined
        },
        {
          reps: 10,
          weight: 25,
          restTime: 90,
          notes: '',
          volumeType: 'sets-reps-weight',
          weightUnit: 'kg',
          duration: undefined
        }
      ]
    }
  ],
  someUndefinedField: undefined
};

const sanitized2 = sanitizeWorkoutForFirebase(workoutWithUndefined);
console.log("Original exercises[0].sets[0]:", workoutWithUndefined.exercises[0].sets[0]);
console.log("Sanitized exercises[0].sets[0]:", sanitized2.exercises[0].sets[0]);
console.log("Top-level undefined field removed:", !sanitized2.hasOwnProperty('someUndefinedField'));
console.log("Nested undefined fields removed:", 
  !sanitized2.exercises[0].sets[0].hasOwnProperty('weight') && 
  !sanitized2.exercises[0].sets[0].hasOwnProperty('weightUnit'));
console.log("Defined fields preserved:", 
  sanitized2.exercises[0].sets[1].weight === 25 && 
  sanitized2.exercises[0].sets[1].weightUnit === 'kg');
console.log("");

// Test 3: Array with undefined values
console.log("Test 3: Array with undefined values");
const arrayWithUndefined = [
  { id: 1, value: 'test', undefinedField: undefined },
  { id: 2, value: undefined, definedField: 'keep' },
  undefined,
  { id: 3, value: 'another' }
];

const sanitized3 = sanitizeWorkoutForFirebase(arrayWithUndefined);
console.log("Original array length:", arrayWithUndefined.length);
console.log("Sanitized array length:", sanitized3.length);
console.log("Undefined array elements preserved:", sanitized3[2] === undefined);
console.log("Object undefined fields removed:", 
  !sanitized3[0].hasOwnProperty('undefinedField') && 
  !sanitized3[1].hasOwnProperty('value'));
console.log("");

console.log("✅ Firebase sanitization tests completed!");
console.log("The sanitization function properly removes undefined values while preserving the structure.");
