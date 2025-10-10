import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { db, remoteConfig } from '@/lib/firebase';
import { useAuthStore } from './authStore';
import type { FitnessPlan, FitnessPlanResponse, GenerationRequest, CompletedWorkout, GapContext } from '@/types/fitness';
import { createMutationTracker, addPendingMutation, removePendingMutation, isOwnMutation, type MutationState } from '@/lib/mutationTracker';
import { sanitizeWorkoutForFirebase } from '@/lib/firebaseUtils';
import { calculateInitialWeekRange, calculateDateFromDayOfWeek, calculateNextWeekRange, getWeekStartDate, getWeekEndDate } from '@/lib/dateUtils';
import { migratePlanWithDates } from '@/lib/dateMigration';
import { saveWorkoutHistory, extractCompletedWorkouts, getWorkoutHistory } from '@/lib/workoutHistoryService';

interface FitnessPlanState {
  currentPlan: FitnessPlan | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  mutationState: MutationState;
  realtimeUnsubscribe: (() => void) | null;
  
  // Actions
  generatePlan: (customPrompt?: string) => Promise<void>;
  approvePlan: () => Promise<void>;
  updatePlan: (planUpdate: Partial<FitnessPlan>) => Promise<void>;
  updatePlanSilently: (planUpdate: Partial<FitnessPlan>) => Promise<void>;
  updateWorkout: (workoutId: string, updates: Partial<FitnessPlan['currentMicrocycle']['workouts'][0]>, newRank?: string) => Promise<void>;
  moveWorkout: (workoutId: string, fromDay: number, toDay: number, newRank: string) => Promise<void>;
  deletePlan: () => Promise<void>;
  loadPlan: () => Promise<void>;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  updateWorkoutStatus: (workoutId: string, status: 'planned' | 'completed', additionalData?: { actualDuration?: number; notes?: string }) => Promise<void>;
  completeMicrocycle: (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => Promise<void>;
  generateNextMicrocycle: (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => Promise<void>;
  generateGapRecoveryPlan: (gapContext: GapContext) => Promise<void>;
  clearError: () => void;
}

export const useFitnessPlanStore = create<FitnessPlanState>()(
  subscribeWithSelector((set, get) => ({
    currentPlan: null,
    loading: false,
    generating: false,
    error: null,
    mutationState: createMutationTracker(),
    realtimeUnsubscribe: null,

    generatePlan: async (customPrompt?: string) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      if (!user.onboardingCompleted || !user.profile) {
        set({ error: 'Please complete your profile first' });
        return;
      }

      try {
        set({ generating: true, error: null });

        // Ensure Remote Config is fetched and activated
        await fetchAndActivate(remoteConfig);

        // Get OpenAI API key from Firebase Remote Config
        const apiKeyValue = getValue(remoteConfig, 'openai_api_key');
        const apiKey = apiKeyValue.asString();
        
        console.log('Remote Config API Key source:', apiKeyValue.getSource());
        console.log('API Key available:', !!apiKey);
        
        if (!apiKey) {
          throw new Error('OpenAI API key not configured in Firebase Remote Config. Please set the "openai_api_key" parameter.');
        }

        // CRITICAL: Determine which prompt to use based on day of week
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const isMonToThu = dayOfWeek >= 1 && dayOfWeek <= 4;
        
        // Mon-Thu: Generate rest of current week
        // Fri-Sun: Generate till end of next week
        const promptKey = isMonToThu 
          ? 'prompts_fitness_plan_generation' 
          : 'prompts_fitness_plan_generation_rest_of_the_week';
        
        console.log(`[Generation] Day of week: ${dayOfWeek}, Using prompt: ${promptKey}`);

        // Get fitness plan generation prompt from Firebase Remote Config
        let promptValue = getValue(remoteConfig, promptKey);
        let promptString = promptValue.asString();
        
        console.log('Remote Config Prompt source:', promptValue.getSource());
        console.log('Prompt available:', !!promptString);
        
        if (!promptString) {
          // Fallback to default prompt if extended prompt not configured
          console.warn(`Prompt ${promptKey} not found, falling back to default`);
          promptValue = getValue(remoteConfig, 'prompts_fitness_plan_generation');
          promptString = promptValue.asString();
        if (!promptString) {
          throw new Error('Fitness plan generation prompts not configured in Firebase Remote Config. Please set the "prompts_fitness_plan_generation" parameter.');
          }
        }

        const promptConfig = JSON.parse(promptString);

        // Calculate week date range (app does this, not AI)
        const weekDateRange = calculateInitialWeekRange(today);
        console.log('[Generation] Calculated week date range:', weekDateRange);

        // Prepare generation request
        const generationRequest: GenerationRequest = {
          userProfile: user.profile,
          customPrompt: customPrompt || '',
          currentDate: today.toISOString(),
          weekDateRange: weekDateRange, // NEW: Pass date range to AI for context
        };

        // Populate the user prompt template
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(generationRequest.userProfile, null, 2))
          .replace('{CUSTOM_PROMPT}', generationRequest.customPrompt)
          .replace('{CURRENT_DATE}', generationRequest.currentDate)
          .replace('{WEEK_DATE_RANGE}', JSON.stringify(weekDateRange, null, 2))
          .replace('{WORKOUT_HISTORY}', JSON.stringify([], null, 2)); // Empty for initial generation

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: promptConfig.system_prompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('No response from OpenAI');
        }

        // Clean and parse the JSON response (remove markdown formatting if present)
        let cleanContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('Cleaned OpenAI response:', cleanContent.substring(0, 200) + '...');
        
        const planResponse: FitnessPlanResponse = JSON.parse(cleanContent);
        
        if (!planResponse.plan) {
          throw new Error('Invalid plan response structure');
        }

        console.log('[Generation] AI returned plan with', planResponse.plan.currentMicrocycle.workouts.length, 'workouts');

        // CRITICAL: Assign dates to workouts (AI only returns dayOfWeek)
        const microcycleWithDates = {
          ...planResponse.plan.currentMicrocycle,
          dateRange: weekDateRange, // Add date range to microcycle
          workouts: planResponse.plan.currentMicrocycle.workouts.map(workout => {
            const date = calculateDateFromDayOfWeek(workout.dayOfWeek, weekDateRange.start);
            console.log(`[Generation] Assigning date ${date} to workout "${workout.name}" (dayOfWeek: ${workout.dayOfWeek})`);
            return {
              ...workout,
              date
            };
          })
        };

        const planWithDates = {
          ...planResponse.plan,
          currentMicrocycle: microcycleWithDates,
          status: 'approved' as const, // Auto-approve (user can regenerate if needed)
        };

        // Update regeneration count if there's an existing plan
        const currentPlan = get().currentPlan;
        if (currentPlan) {
          planWithDates.generationMetadata.regenerationCount = 
            currentPlan.generationMetadata.regenerationCount + 1;
        }

        console.log('[Generation] Plan created with date range:', weekDateRange);

        // Save plan to Firestore
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await setDoc(planDocRef, sanitizeWorkoutForFirebase({
          ...planWithDates,
          updatedAt: serverTimestamp(),
        }));

        set({ currentPlan: planWithDates, generating: false });

      } catch (error) {
        console.error('Generate plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate plan',
          generating: false 
        });
      }
    },

    approvePlan: async () => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        set({ loading: true, error: null });
        
        const updatedPlan = {
          ...currentPlan,
          status: 'approved' as const,
        };

        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await updateDoc(planDocRef, {
          status: 'approved',
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: updatedPlan, loading: false });

      } catch (error) {
        console.error('Approve plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to approve plan',
          loading: false 
        });
      }
    },

    updatePlan: async (planUpdate: Partial<FitnessPlan>) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        set({ loading: true, error: null });
        
        const updatedPlan = {
          ...currentPlan,
          ...planUpdate,
        };

        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await updateDoc(planDocRef, {
          ...planUpdate,
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: updatedPlan, loading: false });

      } catch (error) {
        console.error('Update plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update plan',
          loading: false 
        });
      }
    },

    updatePlanSilently: async (planUpdate: Partial<FitnessPlan>) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        // Update Firebase without triggering store updates (silent)
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await updateDoc(planDocRef, sanitizeWorkoutForFirebase({
          ...planUpdate,
          updatedAt: serverTimestamp(),
        }));

        // No store update - this prevents double re-renders

      } catch (error) {
        console.error('Silent update plan error:', error);
        // Don't set error state for silent updates to avoid UI disruption
      }
    },

    deletePlan: async () => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) return;

      try {
        set({ loading: true, error: null });
        
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await deleteDoc(planDocRef);

        set({ currentPlan: null, loading: false });

      } catch (error) {
        console.error('Delete plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to delete plan',
          loading: false 
        });
      }
    },

    loadPlan: async () => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) return;

      try {
        set({ loading: true, error: null });
        
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        const planDoc = await getDoc(planDocRef);
        
        if (planDoc.exists()) {
          const planData = planDoc.data() as FitnessPlan;
          
          // Migrate workouts to ensure they have status field
          let migratedPlan = {
            ...planData,
            currentMicrocycle: {
              ...planData.currentMicrocycle,
              workouts: planData.currentMicrocycle.workouts.map(workout => ({
                ...workout,
                status: (workout.status === 'completed' ? 'completed' : 'planned') as 'planned' | 'completed',
              }))
            }
          };

          // CRITICAL: Migrate to add date ranges if missing (backward compatibility)
          migratedPlan = migratePlanWithDates(migratedPlan);
          
          set({ currentPlan: migratedPlan, loading: false });
        } else {
          set({ currentPlan: null, loading: false });
        }

      } catch (error) {
        console.error('Load plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load plan',
          loading: false 
        });
      }
    },

    clearError: () => set({ error: null }),

    startRealtimeSync: () => {
      const { realtimeUnsubscribe } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || realtimeUnsubscribe) return;

      const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
      
      const unsubscribe = onSnapshot(planDocRef, (doc) => {
        const { mutationState } = get();
        
        if (doc.exists()) {
          const serverData = doc.data() as FitnessPlan;
          
          // Check if this is our own mutation (prevent echo re-applies)
          const isOwn = serverData.currentMicrocycle?.workouts?.some(workout => 
            workout.lastMutation && isOwnMutation(mutationState, workout.lastMutation)
          );
          
          if (!isOwn) {
            // This is a change from another device or external source
            // Migrate workouts to ensure they have status field
            const migratedData = {
              ...serverData,
              currentMicrocycle: {
                ...serverData.currentMicrocycle,
                workouts: serverData.currentMicrocycle.workouts.map(workout => ({
                  ...workout,
                  status: (workout.status === 'completed' ? 'completed' : 'planned') as 'planned' | 'completed',
                }))
              }
            };
            set({ currentPlan: migratedData });
          } else {
            // This is our own mutation, clean up pending mutations
            serverData.currentMicrocycle?.workouts?.forEach(workout => {
              if (workout.lastMutation && isOwnMutation(mutationState, workout.lastMutation)) {
                removePendingMutation(mutationState, workout.lastMutation.mutationId);
              }
            });
          }
        } else {
          set({ currentPlan: null });
        }
      }, (error) => {
        console.error('Realtime sync error:', error);
        set({ error: 'Failed to sync with server' });
      });

      set({ realtimeUnsubscribe: unsubscribe });
    },

    stopRealtimeSync: () => {
      const { realtimeUnsubscribe } = get();
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        set({ realtimeUnsubscribe: null });
      }
    },

    updateWorkout: async (workoutId: string, updates: Partial<FitnessPlan['currentMicrocycle']['workouts'][0]>, newRank?: string) => {
      const { currentPlan, mutationState } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        // Generate mutation for tracking
        const mutation = addPendingMutation(mutationState, {
          type: 'workout_update',
          data: { workoutId, updates }
        });

        // 1. IMMEDIATE: Update local state optimistically
        const updatedWorkouts = currentPlan.currentMicrocycle.workouts.map(workout => 
          workout.id === workoutId 
            ? { 
                ...workout, 
                ...updates,
                rank: newRank || workout.rank,
                lastMutation: {
                  clientId: mutationState.clientId,
                  mutationId: mutation.id,
                  timestamp: mutation.timestamp
                }
              }
            : workout
        );

        const updatedPlan = {
          ...currentPlan,
          currentMicrocycle: {
            ...currentPlan.currentMicrocycle,
            workouts: updatedWorkouts,
          },
        };

        set({ currentPlan: updatedPlan });

        // 2. ASYNC: Persist to Firebase with batching
        const batch = writeBatch(db);
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        
        batch.update(planDocRef, {
          [`currentMicrocycle.workouts`]: sanitizeWorkoutForFirebase(updatedWorkouts),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

      } catch (error) {
        console.error('Failed to update workout:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update workout'
        });
      }
    },

    moveWorkout: async (workoutId: string, fromDay: number, toDay: number, newRank: string) => {
      const { currentPlan, mutationState } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        // Generate mutation for tracking
        const mutation = addPendingMutation(mutationState, {
          type: 'workout_move',
          data: { workoutId, fromDay, toDay, newRank }
        });

        // 1. IMMEDIATE: Update local state optimistically
        const updatedWorkouts = currentPlan.currentMicrocycle.workouts.map(workout => 
          workout.id === workoutId 
            ? { 
                ...workout, 
                dayOfWeek: toDay,
                rank: newRank,
                lastMutation: {
                  clientId: mutationState.clientId,
                  mutationId: mutation.id,
                  timestamp: mutation.timestamp
                }
              }
            : workout
        );

        const updatedPlan = {
          ...currentPlan,
          currentMicrocycle: {
            ...currentPlan.currentMicrocycle,
            workouts: updatedWorkouts,
          },
        };

        set({ currentPlan: updatedPlan });

        // 2. ASYNC: Persist to Firebase with batching
        const batch = writeBatch(db);
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        
        batch.update(planDocRef, {
          [`currentMicrocycle.workouts`]: sanitizeWorkoutForFirebase(updatedWorkouts),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

      } catch (error) {
        console.error('Failed to move workout:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to move workout'
        });
      }
    },

    updateWorkoutStatus: async (workoutId: string, status: 'planned' | 'completed', additionalData?: { actualDuration?: number; notes?: string }) => {
      const { currentPlan, mutationState } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        // Generate mutation for tracking
        const mutation = addPendingMutation(mutationState, {
          type: 'workout_status_update',
          data: { workoutId, status, additionalData }
        });

        // 1. IMMEDIATE: Update local state optimistically
        const updatedWorkouts = currentPlan.currentMicrocycle.workouts.map(workout => 
          workout.id === workoutId 
            ? { 
                ...workout, 
                status,
                completedAt: status === 'completed' ? new Date().toISOString() : undefined,
                actualDuration: additionalData?.actualDuration,
                notes: additionalData?.notes,
                lastMutation: {
                  clientId: mutationState.clientId,
                  mutationId: mutation.id,
                  timestamp: mutation.timestamp
                }
              }
            : workout
        );

        const updatedPlan = {
          ...currentPlan,
          currentMicrocycle: {
            ...currentPlan.currentMicrocycle,
            workouts: updatedWorkouts,
          },
        };

        set({ currentPlan: updatedPlan });

        // 2. ASYNC: Persist to Firebase with batching
        const batch = writeBatch(db);
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        
        batch.update(planDocRef, {
          [`currentMicrocycle.workouts`]: sanitizeWorkoutForFirebase(updatedWorkouts),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

      } catch (error) {
        console.error('Failed to update workout status:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update workout status'
        });
      }
    },

    completeMicrocycle: async (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => {
      const { currentPlan, mutationState } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        // Generate mutation for tracking
        addPendingMutation(mutationState, {
          type: 'microcycle_completion',
          data: { completedWorkouts, weeklyNotes }
        });

        // 1. IMMEDIATE: Update local state optimistically
        const updatedMicrocycle = {
          ...currentPlan.currentMicrocycle,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          completedWorkouts,
          weeklyNotes,
        };

        const updatedPlan = {
          ...currentPlan,
          currentMicrocycle: updatedMicrocycle,
        };

        set({ currentPlan: updatedPlan });

        // 2. ASYNC: Persist to Firebase with batching
        const batch = writeBatch(db);
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        
        batch.update(planDocRef, sanitizeWorkoutForFirebase({
          [`currentMicrocycle`]: updatedMicrocycle,
          updatedAt: serverTimestamp(),
        }));

        await batch.commit();

        // 3. Save workout history to Firebase (Phase 6)
        try {
          const completedWorkoutsData = extractCompletedWorkouts(updatedMicrocycle);
          
          await saveWorkoutHistory(
            user.uid,
            updatedMicrocycle,
            weeklyNotes,
            {
              macrocycleId: currentPlan.macrocycle.id,
              mesocycleId: currentPlan.macrocycle.mesocycles[0]?.id || 'unknown',
              microcycleId: updatedMicrocycle.id
            }
          );
          
          console.log('[Week Completion] Workout history saved successfully');
        } catch (historyError) {
          console.error('[Week Completion] Failed to save workout history:', historyError);
          // Don't fail the whole completion if history save fails
        }

        // 4. Generate next microcycle
        console.log('[Week Completion] Week marked as complete. Generating next week...');
        await get().generateNextMicrocycle(completedWorkouts, weeklyNotes);

      } catch (error) {
        console.error('Failed to complete microcycle:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to complete microcycle',
          loading: false
        });
      }
    },

    generateNextMicrocycle: async (completedWorkouts: CompletedWorkout[], weeklyNotes: string) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan || !currentPlan.currentMicrocycle.dateRange) {
        console.error('[Next Week Generation] Missing required data');
        return;
      }

      try {
        set({ generating: true, error: null });
        console.log('[Next Week Generation] Starting generation...');

        // 1. Get user profile
        const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        const userProfile = profileDoc.exists() ? profileDoc.data() : {};

        // 2. Get workout history (last 8 weeks)
        const workoutHistory = await getWorkoutHistory(user.uid, { limit: 8 });
        console.log('[Next Week Generation] Retrieved', workoutHistory.length, 'weeks of history');

        // 3. Calculate next week date range (use smart logic based on today)
        const today = new Date();
        const dayOfWeek = today.getDay();
        console.log('[Next Week Generation] Today is:', today.toISOString().split('T')[0], '(day of week:', dayOfWeek, ')');
        
        // Use same smart logic as initial generation
        const nextWeekDateRange = calculateInitialWeekRange(today);
        console.log('[Next Week Generation] Next period:', nextWeekDateRange, '(Mon-Thu: current week, Fri-Sun: extended)');

        // 4. Get Firebase Remote Config prompt
        await fetchAndActivate(remoteConfig);
        
        const openaiApiKey = getValue(remoteConfig, 'openai_api_key').asString();
        const promptValue = getValue(remoteConfig, 'prompts_fitness_plan_generate_next_microcycle');
        const promptString = promptValue.asString();

        if (!openaiApiKey) {
          throw new Error('OpenAI API key not configured in Firebase Remote Config');
        }

        if (!promptString) {
          throw new Error('prompts_fitness_plan_generate_next_microcycle not configured in Firebase Remote Config. Please add it to continue.');
        }

        const promptConfig = JSON.parse(promptString);

        // 5. Prepare context for AI
        const previousMicrocyclePlanned = {
            week: currentPlan.currentMicrocycle.week,
          focus: currentPlan.currentMicrocycle.focus,
          dateRange: currentPlan.currentMicrocycle.dateRange,
          workouts: currentPlan.currentMicrocycle.workouts.map(w => ({
            id: w.id,
            name: w.name,
            dayOfWeek: w.dayOfWeek,
            exercises: w.exercises.map(e => ({
              name: e.name,
              sets: e.sets
            }))
          }))
        };

        const previousMicrocycleActual = {
          completedWorkouts,
          weeklyReflection: weeklyNotes,
          completionRate: currentPlan.currentMicrocycle.workouts.length > 0 
            ? (completedWorkouts.length / currentPlan.currentMicrocycle.workouts.length) * 100 
            : 0
        };

        // 6. Populate prompt template
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(userProfile, null, 2))
          .replace('{CURRENT_DATE}', new Date().toISOString())
          .replace('{NEXT_WEEK_DATE_RANGE}', JSON.stringify(nextWeekDateRange, null, 2))
          .replace('{NEXT_WEEK_NUMBER}', String(currentPlan.currentMicrocycle.week + 1))
          .replace('{MACROCYCLE}', JSON.stringify(currentPlan.macrocycle, null, 2))
          .replace('{MESOCYCLE}', JSON.stringify(currentPlan.macrocycle.mesocycles[0] || {}, null, 2))
          .replace('{PREVIOUS_MICROCYCLE_PLANNED}', JSON.stringify(previousMicrocyclePlanned, null, 2))
          .replace('{PREVIOUS_MICROCYCLE_ACTUAL}', JSON.stringify(previousMicrocycleActual, null, 2))
          .replace('{WEEKLY_REFLECTION}', weeklyNotes)
          .replace('{WORKOUT_HISTORY}', JSON.stringify(workoutHistory, null, 2));

        console.log('[Next Week Generation] Calling OpenAI API...');

        // 7. Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: promptConfig.system_prompt,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('No content received from OpenAI API');
        }

        console.log('[Next Week Generation] Received response from OpenAI');

        // 8. Clean and parse the JSON response (remove markdown formatting if present)
        let cleanContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('[Next Week Generation] Cleaned response:', cleanContent.substring(0, 200) + '...');
        
        const fitnessPlanResponse: FitnessPlanResponse = JSON.parse(cleanContent);
        
        if (!fitnessPlanResponse.plan || !fitnessPlanResponse.plan.currentMicrocycle) {
          throw new Error('Invalid response format from AI');
        }

        // 9. Assign dates to workouts
        const microcycleWithDates = {
          ...fitnessPlanResponse.plan.currentMicrocycle,
          week: currentPlan.currentMicrocycle.week + 1,
          dateRange: nextWeekDateRange,
            status: 'active' as const,
            completedWorkouts: [],
          workouts: fitnessPlanResponse.plan.currentMicrocycle.workouts.map(workout => {
            const date = calculateDateFromDayOfWeek(workout.dayOfWeek, nextWeekDateRange.start);
            console.log(`[Next Week Generation] Assigning date ${date} to workout "${workout.name}"`);
            return {
              ...workout,
              date,
              status: 'planned' as const
            };
          })
        };

        // 10. Update plan
        const updatedPlan = {
          ...currentPlan,
          currentMicrocycle: microcycleWithDates,
          status: 'approved' as const, // Auto-approve (user can regenerate if needed)
        };

        set({ currentPlan: updatedPlan, generating: false });

        // 11. Persist to Firebase
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await setDoc(planDocRef, sanitizeWorkoutForFirebase({
          ...updatedPlan,
          updatedAt: serverTimestamp(),
        }));

        console.log('[Next Week Generation] Successfully generated week', microcycleWithDates.week);

      } catch (error) {
        console.error('[Next Week Generation] Failed:', error);
        set({ 
          generating: false,
          error: error instanceof Error ? error.message : 'Failed to generate next week'
        });
      }
    },

    generateGapRecoveryPlan: async (gapContext: GapContext) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        console.error('[Gap Recovery] No authenticated user');
        return;
      }

      try {
        set({ generating: true, error: null });
        console.log('[Gap Recovery] Starting gap recovery plan generation');
        console.log('[Gap Recovery] Gap duration:', gapContext.gapDurationDays, 'days');

        // 1. Get user profile
        const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
        const userProfile = profileDoc.exists() ? profileDoc.data() : {};

        // 2. Get workout history (last 20 weeks, then filter client-side for 6 months)
        const allHistory = await getWorkoutHistory(user.uid, { limit: 20 });
        
        // Filter client-side for last 6 months to avoid complex Firebase index
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        const workoutHistory = allHistory.filter(week => {
          const weekEndDate = new Date(week.dateRange.end);
          return weekEndDate >= sixMonthsAgo;
        });
        
        console.log('[Gap Recovery] Retrieved', workoutHistory.length, 'weeks of history (filtered from', allHistory.length, 'total)');

        // 3. Calculate week date range (use same smart logic as initial generation)
        const today = new Date();
        const dayOfWeek = today.getDay();
        console.log('[Gap Recovery] Today is:', today.toISOString().split('T')[0], '(day of week:', dayOfWeek, ')');
        
        // Use smart logic: Mon-Thu = current week, Fri-Sun = extended period
        const weekDateRange = calculateInitialWeekRange(today);
        
        console.log('[Gap Recovery] Week range:', weekDateRange, '(Mon-Thu: current week, Fri-Sun: extended period)');
        console.log('[Gap Recovery] Period length:', Math.ceil((new Date(weekDateRange.end).getTime() - new Date(weekDateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1, 'days');

        // 4. Get Firebase Remote Config (use same prompt as initial generation)
        await fetchAndActivate(remoteConfig);
        const openaiApiKey = getValue(remoteConfig, 'openai_api_key').asString();
        
        const promptKey = 'prompts_fitness_plan_generation';
        console.log('[Gap Recovery] Using prompt:', promptKey);
        
        const promptValue = getValue(remoteConfig, promptKey);
        const promptString = promptValue.asString();

        if (!openaiApiKey) {
          throw new Error('OpenAI API key not configured in Firebase Remote Config');
        }

        if (!promptString) {
          throw new Error(`${promptKey} not configured in Firebase Remote Config`);
        }

        const promptConfig = JSON.parse(promptString);

        // 5. Build comprehensive custom prompt with gap context
        let customPrompt = `\n\n=== RETURN TO TRAINING CONTEXT ===\n`;
        customPrompt += `The user is returning after a ${gapContext.gapDurationDays}-day training gap.\n`;
        
        if (gapContext.gapActivities) {
          customPrompt += `\nActivities during gap: ${gapContext.gapActivities}\n`;
        }
        
        if (gapContext.gapWorkouts && gapContext.gapWorkouts.length > 0) {
          customPrompt += `\nWorkouts done during gap:\n`;
          gapContext.gapWorkouts.forEach(workout => {
            customPrompt += `- ${workout.name} (${workout.completedAt})\n`;
          });
        }
        
        if (gapContext.lastCompletedMicrocycle) {
          const lastWeek = gapContext.lastCompletedMicrocycle;
          customPrompt += `\nLast completed week: Week ${lastWeek.week} (${lastWeek.dateRange.start} to ${lastWeek.dateRange.end})\n`;
          customPrompt += `Workouts completed: ${lastWeek.completedWorkouts.length}\n`;
        }

        customPrompt += `\nIMPORTANT: Create a "return to training" plan that:\n`;
        customPrompt += `- Starts fresh (Week 1) with appropriate volume reduction\n`;
        customPrompt += `- Progressively rebuilds to pre-gap levels\n`;
        customPrompt += `- Takes into account the gap duration and activities\n`;
        customPrompt += `- Uses workout history to understand previous training patterns\n`;

        // 6. Populate prompt template
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(userProfile, null, 2))
          .replace('{CUSTOM_PROMPT}', customPrompt)
          .replace('{CURRENT_DATE}', today.toISOString())
          .replace('{WEEK_DATE_RANGE}', JSON.stringify(weekDateRange, null, 2))
          .replace('{WORKOUT_HISTORY}', JSON.stringify(workoutHistory, null, 2));

        console.log('[Gap Recovery] Calling OpenAI API...');

        // 7. Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: promptConfig.system_prompt,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
          throw new Error('No content received from OpenAI API');
        }

        console.log('[Gap Recovery] Received response from OpenAI');

        // 8. Clean and parse the JSON response (remove markdown formatting if present)
        let cleanContent = content.trim();
        
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const fitnessPlanResponse: FitnessPlanResponse = JSON.parse(cleanContent);
        
        if (!fitnessPlanResponse.plan || !fitnessPlanResponse.plan.currentMicrocycle) {
          throw new Error('Invalid response format from AI');
        }

        // 9. Assign dates to workouts
        const microcycleWithDates = {
          ...fitnessPlanResponse.plan.currentMicrocycle,
          dateRange: weekDateRange,
          status: 'active' as const,
          completedWorkouts: [],
          workouts: fitnessPlanResponse.plan.currentMicrocycle.workouts.map(workout => {
            const date = calculateDateFromDayOfWeek(workout.dayOfWeek, weekDateRange.start);
            console.log(`[Gap Recovery] Assigning date ${date} to workout "${workout.name}"`);
            return {
              ...workout,
              date,
              status: 'planned' as const
            };
          })
        };

        // 10. Create fresh plan (auto-approved)
        const freshPlan: FitnessPlan = {
          ...fitnessPlanResponse.plan,
          currentMicrocycle: microcycleWithDates,
          status: 'approved', // Auto-approve for gap recovery
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set({ currentPlan: freshPlan, generating: false });

        // 11. Persist to Firebase
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await setDoc(planDocRef, sanitizeWorkoutForFirebase({
          ...freshPlan,
          updatedAt: serverTimestamp(),
        }));

        // 12. Optionally save gap record to Firebase
        if (gapContext.lastCompletedMicrocycle) {
          const gapId = `gap_${gapContext.lastCompletedMicrocycle.dateRange.end}_${Date.now()}`;
          const gapDocRef = doc(db, 'users', user.uid, 'trainingGaps', gapId);
          
          await setDoc(gapDocRef, sanitizeWorkoutForFirebase({
            startDate: gapContext.lastCompletedMicrocycle.dateRange.end,
            endDate: today.toISOString(),
            durationDays: gapContext.gapDurationDays,
            activities: gapContext.gapActivities || null,
            workouts: gapContext.gapWorkouts || [],
            resumedAt: serverTimestamp(),
          }));

          console.log('[Gap Recovery] Gap record saved:', gapId);
        }

        console.log('[Gap Recovery] Successfully generated fresh return-to-training plan');
        console.log('[Gap Recovery] New plan week range:', weekDateRange);
        console.log('[Gap Recovery] New plan status:', freshPlan.status);

      } catch (error) {
        console.error('[Gap Recovery] Failed:', error);
        set({ 
          generating: false,
          error: error instanceof Error ? error.message : 'Failed to generate recovery plan'
        });
        throw error; // Re-throw so the page can catch it
      }
    },
  }))
);

/**
 * Helper function to check if user has completed required profile fields
 */
export const checkProfileCompleteness = (userProfile: Record<string, any> | undefined): boolean => {
  if (!userProfile) return false;
  
  const requiredFields = ['age', 'sex', 'height', 'fitnessLevel', 'goals', 'workoutTypes', 'equipment', 'workoutDays', 'workoutDuration'];
  
  return requiredFields.every(field => {
    const value = userProfile[field];
    return value !== undefined && value !== null && value !== '' && 
           (Array.isArray(value) ? value.length > 0 : true);
  });
};
