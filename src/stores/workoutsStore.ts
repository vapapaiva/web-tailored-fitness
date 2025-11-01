/**
 * Workouts Store - Standalone workout tracking and management
 * Handles workout CRUD operations, real-time sync, and computed stats
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from './authStore';
import type { 
  WorkoutDocument, 
  WorkoutStats, 
  ExerciseProgress,
  WorkoutStatus,
  WorkoutUpdate 
} from '@/types/workout';
import { sanitizeWorkoutForFirebase } from '@/lib/firebaseUtils';
import { 
  getWeekStartDate, 
  getWeekEndDate, 
  isDateInCurrentWeek,
  isDateInPast,
  getTodayISO
} from '@/lib/dateUtils';
import { createMutationTracker, addPendingMutation, isOwnMutation, type MutationState } from '@/lib/mutationTracker';
import { generateInitialRank } from '@/lib/lexoRank';

interface WorkoutsState {
  workouts: WorkoutDocument[];
  loading: boolean;
  error: string | null;
  mutationState: MutationState;
  realtimeUnsubscribe: (() => void) | null;
  
  // Actions
  loadWorkouts: () => Promise<void>;
  addWorkout: (workout: Partial<WorkoutDocument>) => Promise<string>; // Returns workout ID
  updateWorkout: (id: string, updates: WorkoutUpdate) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  markAsComplete: (id: string, completedAt?: string) => Promise<void>;
  markAsIncomplete: (id: string) => Promise<void>;
  
  // Realtime sync
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  
  // Computed/Filtered getters
  getPlannedWorkouts: () => WorkoutDocument[];
  getCompletedWorkouts: () => WorkoutDocument[];
  getPastWorkouts: () => WorkoutDocument[];
  getCurrentWeekWorkouts: () => WorkoutDocument[];
  getLaterWorkouts: () => WorkoutDocument[];
  getWithoutDateWorkouts: () => WorkoutDocument[];
  
  // Stats
  getWorkoutStats: () => WorkoutStats;
  getExerciseProgress: (exerciseName: string) => ExerciseProgress | null;
  
  clearError: () => void;
}

export const useWorkoutsStore = create<WorkoutsState>()(
  subscribeWithSelector((set, get) => ({
    workouts: [],
    loading: false,
    error: null,
    mutationState: createMutationTracker(),
    realtimeUnsubscribe: null,

    loadWorkouts: async () => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated', loading: false });
        return;
      }

      try {
        set({ loading: true, error: null });
        
        const workoutsRef = collection(db, 'users', user.uid, 'workouts');
        const snapshot = await getDocs(workoutsRef);
        
        const workouts: WorkoutDocument[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as WorkoutDocument;
          workouts.push({ ...data, id: doc.id });
        });
        
        console.log('[WorkoutsStore] Loaded', workouts.length, 'workouts');
        set({ workouts, loading: false });
      } catch (error) {
        console.error('[WorkoutsStore] Load error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load workouts',
          loading: false 
        });
      }
    },

    addWorkout: async (workoutData: Partial<WorkoutDocument>) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const workoutId = `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        // Generate rank for ordering
        const { workouts, mutationState } = get();
        const existingRanks = workouts
          .filter(w => {
            const wDate = w.date || null;
            const newDate = workoutData.date || null;
            return wDate === newDate;
          })
          .map(w => w.rank)
          .filter(Boolean);
        const rank = generateInitialRank(existingRanks);
        
        // Compute dayOfWeek from date if date is provided
        let dayOfWeek: number | undefined;
        if (workoutData.date) {
          const date = new Date(workoutData.date);
          dayOfWeek = date.getDay();
        }
        
        // Generate mutation for tracking
        const mutation = addPendingMutation(mutationState, {
          type: 'workout_create',
          data: { workoutId }
        });
        
        const workout: WorkoutDocument = {
          id: workoutId,
          name: workoutData.name || 'New Workout',
          date: workoutData.date,
          dayOfWeek,
          status: workoutData.status || 'planned',
          type: workoutData.type || 'general',
          focus: workoutData.focus || 'General Training',
          value: workoutData.value || 'Workout session',
          exercises: workoutData.exercises || [],
          checkIns: workoutData.checkIns || {
            greenFlags: [],
            redFlags: []
          },
          estimatedDuration: workoutData.estimatedDuration || 60,
          actualDuration: workoutData.actualDuration,
          notes: workoutData.notes,
          source: workoutData.source || 'manual',
          aiCoachContext: workoutData.aiCoachContext,
          rank,
          createdAt: now,
          updatedAt: now,
          lastMutation: {
            clientId: mutationState.clientId,
            mutationId: mutation.id,
            timestamp: mutation.timestamp
          },
          ...workoutData // Allow overrides
        };

        // 1. IMMEDIATE: Add to local state for instant UI feedback
        set({ workouts: [...workouts, workout] });

        // 2. ASYNC: Save to Firebase
        const workoutRef = doc(db, 'users', user.uid, 'workouts', workoutId);
        await setDoc(workoutRef, sanitizeWorkoutForFirebase(workout));
        
        console.log('[WorkoutsStore] Added workout:', workoutId);
        return workoutId;
      } catch (error) {
        console.error('[WorkoutsStore] Add error:', error);
        throw error;
      }
    },

    updateWorkout: async (id: string, updates: WorkoutUpdate) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const { workouts, mutationState } = get();
        const existingWorkout = workouts.find(w => w.id === id);
        
        if (!existingWorkout) {
          throw new Error('Workout not found');
        }

        // Generate mutation for tracking
        const mutation = addPendingMutation(mutationState, {
          type: 'workout_update',
          data: { workoutId: id, updates }
        });

        // Compute dayOfWeek if date is being updated
        let dayOfWeek = updates.dayOfWeek;
        
        // Check if 'date' key is in updates (allows explicit undefined)
        const isDateBeingUpdated = 'date' in updates;
        const isDayOfWeekBeingUpdated = 'dayOfWeek' in updates;
        
        if (isDateBeingUpdated) {
          if (updates.date) {
            // Date is being SET - calculate dayOfWeek from it
            if (dayOfWeek === undefined) {
              const date = new Date(updates.date);
              dayOfWeek = date.getDay();
            }
          } else {
            // Date is being CLEARED (undefined) - also clear dayOfWeek unless explicitly set
            if (!isDayOfWeekBeingUpdated) {
              dayOfWeek = undefined;
            }
          }
        }

        // 1. IMMEDIATE: Update local state optimistically
        const updatedWorkout: WorkoutDocument = {
          ...existingWorkout,
          ...updates,
          dayOfWeek: isDayOfWeekBeingUpdated || isDateBeingUpdated 
            ? dayOfWeek 
            : existingWorkout.dayOfWeek,
          updatedAt: new Date().toISOString(),
          lastMutation: {
            clientId: mutationState.clientId,
            mutationId: mutation.id,
            timestamp: mutation.timestamp
          }
        };

        set({ 
          workouts: workouts.map(w => w.id === id ? updatedWorkout : w)
        });

        // 2. ASYNC: Persist to Firebase
        const firebaseUpdates: any = {
          updatedAt: serverTimestamp(),
          lastMutation: {
            clientId: mutationState.clientId,
            mutationId: mutation.id,
            timestamp: mutation.timestamp
          }
        };
        
        // Add all updates, handling undefined values with deleteField()
        Object.keys(updates).forEach(key => {
          const value = (updates as any)[key];
          if (value === undefined) {
            // Use deleteField() to actually remove the field from Firestore
            firebaseUpdates[key] = deleteField();
          } else {
            firebaseUpdates[key] = value;
          }
        });
        
        // Handle dayOfWeek for Firebase (when date changes)
        if (isDayOfWeekBeingUpdated || isDateBeingUpdated) {
          if (dayOfWeek === undefined) {
            firebaseUpdates.dayOfWeek = deleteField();
          } else {
            firebaseUpdates.dayOfWeek = dayOfWeek;
          }
        }
        
        console.log('[WorkoutsStore] Firebase updates:', Object.keys(firebaseUpdates).map(k => 
          `${k}: ${firebaseUpdates[k] === deleteField() ? 'DELETE' : firebaseUpdates[k]}`
        ).join(', '));
        
        const workoutRef = doc(db, 'users', user.uid, 'workouts', id);
        await updateDoc(workoutRef, firebaseUpdates);
        
        console.log('[WorkoutsStore] Updated workout:', id);
      } catch (error) {
        console.error('[WorkoutsStore] Update error:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to update workout' });
        throw error;
      }
    },

    deleteWorkout: async (id: string) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        // 1. IMMEDIATE: Update local state optimistically
        set({ 
          workouts: get().workouts.filter(w => w.id !== id)
        });

        // 2. ASYNC: Delete from Firebase
        const workoutRef = doc(db, 'users', user.uid, 'workouts', id);
        await deleteDoc(workoutRef);
        
        console.log('[WorkoutsStore] Deleted workout:', id);
      } catch (error) {
        console.error('[WorkoutsStore] Delete error:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to delete workout' });
        throw error;
      }
    },

    markAsComplete: async (id: string, completedAt?: string) => {
      const { workouts, updateWorkout } = get();
      const workout = workouts.find(w => w.id === id);
      
      if (!workout) {
        throw new Error('Workout not found');
      }
      
      try {
        // Mark all exercises and sets as completed
        const completedExercises = workout.exercises.map(exercise => ({
          ...exercise,
          sets: exercise.sets.map(set => ({
            ...set,
            completed: true
          }))
        }));
        
        // IMPORTANT: Preserve the original date, don't set it to today
        // completedAt is when it was marked complete, date is when it was scheduled
        await updateWorkout(id, {
          status: 'completed',
          completedAt: completedAt || new Date().toISOString(),
          exercises: completedExercises
          // DO NOT update date field - it should stay as originally set
        });
        
        console.log('[WorkoutsStore] Marked workout as complete:', id, 'original date:', workout.date);
      } catch (error) {
        console.error('[WorkoutsStore] Mark complete error:', error);
        throw error;
      }
    },

    markAsIncomplete: async (id: string) => {
      const { workouts, updateWorkout } = get();
      const workout = workouts.find(w => w.id === id);
      
      if (!workout) {
        throw new Error('Workout not found');
      }
      
      try {
        // Reset all exercises and sets to incomplete
        const resetExercises = workout.exercises.map(exercise => ({
          ...exercise,
          sets: exercise.sets.map(set => ({
            ...set,
            completed: false
          }))
        }));
        
        await updateWorkout(id, {
          status: 'planned',
          completedAt: undefined,
          exercises: resetExercises
        });
        
        console.log('[WorkoutsStore] Marked workout as incomplete:', id);
      } catch (error) {
        console.error('[WorkoutsStore] Mark incomplete error:', error);
        throw error;
      }
    },

    startRealtimeSync: () => {
      const { realtimeUnsubscribe } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || realtimeUnsubscribe) return;

      const workoutsRef = collection(db, 'users', user.uid, 'workouts');
      
      const unsubscribe = onSnapshot(workoutsRef, (snapshot) => {
        const { mutationState } = get();
        const workouts: WorkoutDocument[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data() as WorkoutDocument;
          workouts.push({ ...data, id: doc.id });
        });
        
        // Always update, but the mutation tracking prevents duplicate processing
        // The UI will re-render with the server-confirmed data
        console.log('[WorkoutsStore] Real-time update received:', workouts.length, 'workouts');
        set({ workouts });
      }, (error) => {
        console.error('[WorkoutsStore] Realtime sync error:', error);
        set({ error: 'Failed to sync with server' });
      });

      set({ realtimeUnsubscribe: unsubscribe });
      console.log('[WorkoutsStore] Real-time sync started');
    },

    stopRealtimeSync: () => {
      const { realtimeUnsubscribe } = get();
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        set({ realtimeUnsubscribe: null });
        console.log('[WorkoutsStore] Real-time sync stopped');
      }
    },

    getPlannedWorkouts: () => {
      const { workouts } = get();
      return workouts.filter(w => w.status === 'planned' || w.status === 'in-progress');
    },

    getCompletedWorkouts: () => {
      const { workouts } = get();
      const completedWorkouts = workouts
        .filter(w => w.status === 'completed')
        .sort((a, b) => {
          // Sort by date (not completedAt), newest first
          const dateA = a.date || a.completedAt || '';
          const dateB = b.date || b.completedAt || '';
          return dateB.localeCompare(dateA);
        });
      
      console.log('[WorkoutsStore] getCompletedWorkouts:', completedWorkouts.length, 'workouts');
      return completedWorkouts;
    },

    getPastWorkouts: () => {
      const { workouts } = get();
      const currentWeekStart = getWeekStartDate();
      
      return workouts
        .filter(w => {
          // Must have a date, be before current week start, and not be completed
          // This excludes any workout in the current week (including Monday)
          return w.date && w.date < currentWeekStart && w.status !== 'completed';
        })
        .sort((a, b) => (a.date || '').localeCompare(b.date || '')); // oldest first
    },

    getCurrentWeekWorkouts: () => {
      const { workouts } = get();
      
      return workouts
        .filter(w => {
          // Must have a date and be in current week
          return w.date && isDateInCurrentWeek(w.date);
        })
        .sort((a, b) => {
          // Sort by date, then by rank
          const dateCompare = (a.date || '').localeCompare(b.date || '');
          if (dateCompare !== 0) return dateCompare;
          return (a.rank || '').localeCompare(b.rank || '');
        });
    },

    getLaterWorkouts: () => {
      const { workouts } = get();
      const currentWeekEnd = getWeekEndDate();
      
      const laterWorkouts = workouts
        .filter(w => {
          // Must have a date, be after current week, and NOT be completed
          const isLater = w.date && w.date > currentWeekEnd;
          const isNotCompleted = w.status !== 'completed';
          return isLater && isNotCompleted;
        })
        .sort((a, b) => (a.date || '').localeCompare(b.date || '')); // nearest first
      
      console.log('[WorkoutsStore] getLaterWorkouts:', laterWorkouts.length, 'workouts');
      return laterWorkouts;
    },

    getWithoutDateWorkouts: () => {
      const { workouts } = get();
      
      const withoutDateWorkouts = workouts
        .filter(w => {
          const hasNoDate = !w.date;
          const isNotCompleted = w.status !== 'completed';
          return hasNoDate && isNotCompleted;
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); // newest first
      
      console.log('[WorkoutsStore] getWithoutDateWorkouts:', withoutDateWorkouts.length, 'workouts');
      return withoutDateWorkouts;
    },

    getWorkoutStats: (): WorkoutStats => {
      const { workouts } = get();
      const completedWorkouts = workouts.filter(w => w.status === 'completed');
      
      // Initialize stats
      let totalExercises = 0;
      let totalSets = 0;
      let totalReps = 0;
      let totalVolume = 0;
      let totalTime = 0;
      const exerciseTypeBreakdown: Record<string, number> = {};
      const muscleGroupBreakdown: Record<string, number> = {};
      
      // Calculate stats
      completedWorkouts.forEach(workout => {
        totalExercises += workout.exercises.length;
        totalTime += workout.actualDuration || workout.estimatedDuration;
        
        // Exercise type
        exerciseTypeBreakdown[workout.type] = (exerciseTypeBreakdown[workout.type] || 0) + 1;
        
        workout.exercises.forEach(exercise => {
          totalSets += exercise.sets.length;
          
          // Muscle groups
          exercise.muscleGroups.forEach(mg => {
            muscleGroupBreakdown[mg] = (muscleGroupBreakdown[mg] || 0) + 1;
          });
          
          exercise.sets.forEach(set => {
            totalReps += set.reps || 0;
            totalVolume += (set.weight || 0) * (set.reps || 0);
          });
        });
      });
      
      // Calculate weekly breakdown
      const weeklyMap = new Map<string, { planned: number; completed: number }>();
      workouts.forEach(workout => {
        if (!workout.date) return;
        
        const weekStart = getWeekStartDate(new Date(workout.date));
        const key = weekStart;
        
        if (!weeklyMap.has(key)) {
          weeklyMap.set(key, { planned: 0, completed: 0 });
        }
        
        const weekData = weeklyMap.get(key)!;
        if (workout.status === 'completed') {
          weekData.completed++;
        }
        weekData.planned++;
      });
      
      const weeklyBreakdown = Array.from(weeklyMap.entries())
        .map(([weekStart, data]) => ({
          weekStart,
          weekEnd: getWeekEndDate(new Date(weekStart)),
          workoutsPlanned: data.planned,
          workoutsCompleted: data.completed,
          completionRate: data.planned > 0 ? Math.round((data.completed / data.planned) * 100) : 0
        }))
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)); // newest first
      
      return {
        totalWorkouts: completedWorkouts.length,
        totalExercises,
        totalSets,
        totalReps,
        totalVolume,
        totalDistance: 0, // TODO: Calculate from distance-based exercises
        totalDuration: totalTime,
        totalTime,
        averageWorkoutDuration: completedWorkouts.length > 0 
          ? Math.round(totalTime / completedWorkouts.length) 
          : 0,
        exerciseTypeBreakdown,
        muscleGroupBreakdown,
        weeklyBreakdown,
        currentStreak: 0, // TODO: Calculate current streak
        longestStreak: 0  // TODO: Calculate longest streak
      };
    },

    getExerciseProgress: (exerciseName: string): ExerciseProgress | null => {
      const { workouts } = get();
      const completedWorkouts = workouts.filter(w => w.status === 'completed');
      
      const dataPoints: ExerciseProgress['dataPoints'] = [];
      let category = '';
      const muscleGroupsSet = new Set<string>();
      
      completedWorkouts.forEach(workout => {
        workout.exercises.forEach(exercise => {
          if (exercise.name.toLowerCase() === exerciseName.toLowerCase()) {
            if (!category) category = exercise.category;
            exercise.muscleGroups.forEach(mg => muscleGroupsSet.add(mg));
            
            let maxWeight = 0;
            let totalReps = 0;
            let totalVolume = 0;
            
            exercise.sets.forEach(set => {
              totalReps += set.reps || 0;
              const setVolume = (set.weight || 0) * (set.reps || 0);
              totalVolume += setVolume;
              maxWeight = Math.max(maxWeight, set.weight || 0);
            });
            
            dataPoints.push({
              date: workout.date || workout.completedAt || '',
              workoutId: workout.id,
              sets: exercise.sets.length,
              reps: totalReps / exercise.sets.length, // average reps per set
              volume: totalVolume,
              maxWeight: maxWeight > 0 ? maxWeight : undefined,
              totalReps,
              duration: exercise.sets[0]?.duration,
              distance: undefined // TODO: Handle distance-based exercises
            });
          }
        });
      });
      
      if (dataPoints.length === 0) return null;
      
      // Sort by date
      dataPoints.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate personal records
      const personalRecords: ExerciseProgress['personalRecords'] = {};
      
      dataPoints.forEach(point => {
        if (point.maxWeight && (!personalRecords.maxWeight || point.maxWeight > personalRecords.maxWeight.value)) {
          personalRecords.maxWeight = {
            value: point.maxWeight,
            unit: 'kg', // TODO: Get from user preferences
            date: point.date
          };
        }
        
        if (point.totalReps && (!personalRecords.maxReps || point.totalReps > personalRecords.maxReps.value)) {
          personalRecords.maxReps = {
            value: point.totalReps,
            date: point.date
          };
        }
        
        if (point.volume && (!personalRecords.maxVolume || point.volume > personalRecords.maxVolume.value)) {
          personalRecords.maxVolume = {
            value: point.volume,
            date: point.date
          };
        }
      });
      
      return {
        exerciseName,
        category,
        muscleGroups: Array.from(muscleGroupsSet),
        dataPoints,
        totalWorkouts: dataPoints.length,
        firstSeen: dataPoints[0].date,
        lastSeen: dataPoints[dataPoints.length - 1].date,
        personalRecords
      };
    },

    clearError: () => set({ error: null }),
  }))
);

