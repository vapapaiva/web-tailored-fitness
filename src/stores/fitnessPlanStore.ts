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
import type { FitnessPlan, FitnessPlanResponse, GenerationRequest } from '@/types/fitness';
import { createMutationTracker, addPendingMutation, removePendingMutation, isOwnMutation, type MutationState } from '@/lib/mutationTracker';

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

        // Get fitness plan generation prompt from Firebase Remote Config
        const promptValue = getValue(remoteConfig, 'prompts_fitness_plan_generation');
        const promptString = promptValue.asString();
        
        console.log('Remote Config Prompt source:', promptValue.getSource());
        console.log('Prompt available:', !!promptString);
        
        if (!promptString) {
          throw new Error('Fitness plan generation prompts not configured in Firebase Remote Config. Please set the "prompts_fitness_plan_generation" parameter.');
        }

        const promptConfig = JSON.parse(promptString);

        // Prepare generation request
        const generationRequest: GenerationRequest = {
          userProfile: user.profile,
          customPrompt: customPrompt || '',
          currentDate: new Date().toISOString(),
          // TODO: Add previous progress and current plan when those features are implemented
        };

        // Populate the user prompt template
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(generationRequest.userProfile, null, 2))
          .replace('{CUSTOM_PROMPT}', generationRequest.customPrompt)
          .replace('{CURRENT_DATE}', generationRequest.currentDate);

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

        // Update regeneration count if there's an existing plan
        const currentPlan = get().currentPlan;
        if (currentPlan) {
          planResponse.plan.generationMetadata.regenerationCount = 
            currentPlan.generationMetadata.regenerationCount + 1;
        }

        // Save plan to Firestore
        const planDocRef = doc(db, 'users', user.uid, 'currentPlan', 'plan');
        await setDoc(planDocRef, {
          ...planResponse.plan,
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: planResponse.plan, generating: false });

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
        await updateDoc(planDocRef, {
          ...planUpdate,
          updatedAt: serverTimestamp(),
        });

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
          set({ currentPlan: planData, loading: false });
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
            set({ currentPlan: serverData });
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
          [`currentMicrocycle.workouts`]: updatedWorkouts,
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
          [`currentMicrocycle.workouts`]: updatedWorkouts,
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
