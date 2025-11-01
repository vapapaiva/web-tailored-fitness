/**
 * AI Coach Store - AI-powered fitness planning (decoupled from workout tracking)
 * Handles goals generation, workout generation, and week completion
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { getValue, fetchAndActivate } from 'firebase/remote-config';
import { db, remoteConfig } from '@/lib/firebase';
import { useAuthStore } from './authStore';
import { useWorkoutsStore } from './workoutsStore';
import type { 
  AIPlan, 
  GoalsGenerationRequest,
  GoalsGenerationResponse,
  MicrocycleGenerationRequest
} from '@/types/aiCoach';
import { sanitizeWorkoutForFirebase } from '@/lib/firebaseUtils';
import { calculateInitialWeekRange, calculateDateInRange } from '@/lib/dateUtils';
import { normalizeExercises } from '@/lib/workoutNormalization';

interface AICoachState {
  currentPlan: AIPlan | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  realtimeUnsubscribe: (() => void) | null;
  
  // Phase 1: Goals Generation
  generateGoals: (request: GoalsGenerationRequest) => Promise<void>;
  approveGoals: () => Promise<void>;
  updateGoals: (updates: Partial<Pick<AIPlan, 'macrocycleGoal' | 'mesocycleMilestones'>>) => Promise<void>;
  regenerateGoals: (feedback: string) => Promise<void>;
  dismissRegenerationSuggestion: () => Promise<void>;
  
  // Phase 2: Workout Generation (placeholders for now, implement in Phase C)
  generateMicrocycle: (request: MicrocycleGenerationRequest) => Promise<void>;
  approveMicrocycle: () => Promise<void>;
  regenerateMicrocycle: (feedback: string) => Promise<void>;
  
  // Week Completion (placeholders for now, implement in Phase C)
  completeMicrocycle: (reflection: string) => Promise<void>;
  generateNextMicrocycle: (reflection: string) => Promise<void>;
  
  // Load & Sync
  loadPlan: () => Promise<void>;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  
  clearError: () => void;
}

export const useAICoachStore = create<AICoachState>()(
  subscribeWithSelector((set, get) => ({
    currentPlan: null,
    loading: false,
    generating: false,
    error: null,
    realtimeUnsubscribe: null,

    generateGoals: async (request: GoalsGenerationRequest) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ generating: true, error: null });

        // Fetch Remote Config
        await fetchAndActivate(remoteConfig);

        // Get API key
        const apiKeyValue = getValue(remoteConfig, 'openai_api_key');
        const apiKey = apiKeyValue.asString();
        
        if (!apiKey) {
          throw new Error('OpenAI API key not configured in Firebase Remote Config');
        }

        // Get goals generation prompt
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_goals_generation');
        const promptString = promptValue.asString();
        
        if (!promptString) {
          throw new Error('Goals generation prompt (prompts_ai_coach_goals_generation) not configured in Firebase Remote Config');
        }

        const promptConfig = JSON.parse(promptString);

        // Populate user prompt template
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(request.userProfile, null, 2))
          .replace('{FITNESS_GOAL_INPUT}', request.fitnessGoalInput)
          .replace('{CUSTOM_INPUT}', request.customInput)
          .replace('{CURRENT_DATE}', request.currentDate);

        // 📤 LOG: Prompt being sent to AI
        console.log('\n' + '='.repeat(80));
        console.log('🤖 AI CALL: GOALS GENERATION');
        console.log('='.repeat(80));
        console.log('📋 SYSTEM PROMPT:');
        console.log(promptConfig.system_prompt);
        console.log('\n📝 USER PROMPT (with populated data):');
        console.log(userPrompt);
        console.log('='.repeat(80) + '\n');

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
            max_tokens: 3000,
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

        // 📥 LOG: AI Response
        console.log('\n' + '='.repeat(80));
        console.log('✅ AI RESPONSE: GOALS GENERATION');
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80) + '\n');

        // Clean and parse JSON response
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsedResponse: any;
        try {
          parsedResponse = JSON.parse(cleanContent);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('❌ Content that failed to parse:', cleanContent);
          throw new Error('Failed to parse AI response as JSON');
        }
        
        // Handle two possible response formats:
        // 1. New format: { macrocycleGoal, mesocycleMilestones }
        // 2. Old format: { plan: { macrocycle, mesocycles } } (fallback from old prompt)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let macrocycleData: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mesocyclesData: any[];
        
        if (parsedResponse.macrocycleGoal && parsedResponse.mesocycleMilestones) {
          // New format (correct)
          macrocycleData = parsedResponse.macrocycleGoal;
          mesocyclesData = parsedResponse.mesocycleMilestones;
        } else if (parsedResponse.plan?.macrocycle && parsedResponse.plan?.macrocycle?.mesocycles) {
          // Old format (from existing fitness plan prompt)
          macrocycleData = parsedResponse.plan.macrocycle;
          mesocyclesData = parsedResponse.plan.macrocycle.mesocycles;
        } else {
          throw new Error(`Invalid goals response. Expected macrocycleGoal or plan.macrocycle, got: ${JSON.stringify(Object.keys(parsedResponse))}`);
        }
        
        // Validate macrocycle has required content fields
        if (!macrocycleData.name || !macrocycleData.value) {
          throw new Error('Macrocycle goal is missing required fields (name, value)');
        }
        
        // Validate mesocycles
        if (!Array.isArray(mesocyclesData) || mesocyclesData.length === 0) {
          throw new Error('Mesocycle milestones must be a non-empty array');
        }
        
        // Generate IDs and dates in the app (not from AI)
        const now = new Date();
        const timestamp = Date.now();
        const startDate = now.toISOString().split('T')[0];
        const durationWeeks = macrocycleData.durationWeeks || 24;
        const endDate = new Date(now.getTime() + durationWeeks * 7 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        
        const goalsResponse: GoalsGenerationResponse = {
          macrocycleGoal: {
            id: `macro_${timestamp}`,
            name: macrocycleData.name,
            value: macrocycleData.value,
            durationWeeks,
            startDate,
            endDate,
            successIndicators: macrocycleData.successIndicators || [],
            promisedOutcome: macrocycleData.promisedOutcome || macrocycleData.value
          },
          mesocycleMilestones: mesocyclesData.map((meso, index) => ({
            id: `meso_${index + 1}_${timestamp}`,
            name: meso.name,
            durationWeeks: meso.durationWeeks,
            focus: meso.focus,
            value: meso.value,
            successIndicators: meso.successIndicators || []
          })),
          explanation: parsedResponse.explanation || 'AI-generated fitness goals',
          generated_at: new Date().toISOString()
        };

        // Create AI plan with goals (draft status)
        const newPlan: AIPlan = {
          id: `aiplan_${Date.now()}`,
          userId: user.uid,
          macrocycleGoal: goalsResponse.macrocycleGoal,
          mesocycleMilestones: goalsResponse.mesocycleMilestones,
          completedMicrocycles: [],
          status: 'goals-draft',
          generationMetadata: {
            generatedAt: new Date().toISOString(),
            regenerationCount: 0,
            llmModel: 'gpt-4o'
          },
          userFeedback: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save to Firebase
        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await setDoc(planDocRef, sanitizeWorkoutForFirebase(newPlan));

        set({ currentPlan: newPlan, generating: false });

      } catch (error) {
        console.error('❌ Generate goals error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate goals',
          generating: false 
        });
      }
    },

    approveGoals: async () => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        set({ loading: true, error: null });
        
        const updatedPlan = {
          ...currentPlan,
          status: 'goals-approved' as const,
        };

        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          status: 'goals-approved',
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: updatedPlan, loading: false });

      } catch (error) {
        console.error('❌ Approve goals error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to approve goals',
          loading: false 
        });
      }
    },

    updateGoals: async (updates: Partial<Pick<AIPlan, 'macrocycleGoal' | 'mesocycleMilestones'>>) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        set({ loading: true, error: null });
        
        const updatedPlan = {
          ...currentPlan,
          ...updates,
          goalsLastModified: new Date().toISOString(),
          showRegenerationSuggestion: true, // Show banner to regenerate workouts
        };

        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          ...updates,
          goalsLastModified: serverTimestamp(),
          showRegenerationSuggestion: true,
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: updatedPlan, loading: false });

      } catch (error) {
        console.error('❌ Update goals error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update goals',
          loading: false 
        });
      }
    },

    regenerateGoals: async (feedback: string) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        set({ generating: true, error: null });

        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const userProfile = userData.profile || {};

        // Build request with feedback
        const request: GoalsGenerationRequest = {
          userProfile,
          fitnessGoalInput: userProfile.goals || '',
          customInput: `Previous goals feedback: ${feedback}\n\nPlease regenerate goals taking this feedback into account.`,
          currentDate: new Date().toISOString(),
        };

        // Call generateGoals with feedback
        await get().generateGoals(request);
        
        // Update feedback history
        const updatedFeedback = [...currentPlan.userFeedback, feedback];
        const { currentPlan: regeneratedPlan } = get();
        
        if (regeneratedPlan) {
          const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
          await updateDoc(planDocRef, {
            userFeedback: updatedFeedback,
            'generationMetadata.regenerationCount': currentPlan.generationMetadata.regenerationCount + 1,
          });

          set({ 
            currentPlan: { 
              ...regeneratedPlan, 
              userFeedback: updatedFeedback,
              generationMetadata: {
                ...regeneratedPlan.generationMetadata,
                regenerationCount: currentPlan.generationMetadata.regenerationCount + 1
              }
            } 
          });
        }

      } catch (error) {
        console.error('❌ Regenerate goals error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to regenerate goals',
          generating: false 
        });
      }
    },

    dismissRegenerationSuggestion: async () => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          showRegenerationSuggestion: false,
        });

        set({ 
          currentPlan: { 
            ...currentPlan, 
            showRegenerationSuggestion: false 
          } 
        });

      } catch (error) {
        console.error('❌ Dismiss suggestion error:', error);
      }
    },

    // Phase 2: Workout Generation
    generateMicrocycle: async (request: MicrocycleGenerationRequest) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      const workoutsStore = useWorkoutsStore.getState();
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ generating: true, error: null });

        // Fetch Remote Config
        await fetchAndActivate(remoteConfig);

        const apiKey = getValue(remoteConfig, 'openai_api_key').asString();
        if (!apiKey) {
          throw new Error('OpenAI API key not configured');
        }

        // Get microcycle workout generation prompt
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_workout_generation');
        const promptString = promptValue.asString();
        
        if (!promptString) {
          throw new Error('Workout generation prompt (prompts_ai_coach_workout_generation) not configured in Firebase Remote Config');
        }

        const promptConfig = JSON.parse(promptString);

        // Prepare previous microcycle data for prompt (if applicable)
        const previousPlanned = request.previousMicrocycle 
          ? `Week ${request.previousMicrocycle.planned.week} (${request.previousMicrocycle.planned.dateRange.start} to ${request.previousMicrocycle.planned.dateRange.end})\nFocus: ${request.previousMicrocycle.planned.focus}`
          : '';
        
        const previousActual = request.previousMicrocycle
          ? `Completed Workouts: ${request.previousMicrocycle.actual.completedWorkouts.length}\nCompletion Rate: ${Math.round(request.previousMicrocycle.actual.completionRate)}%\nReflection: ${request.previousMicrocycle.actual.weeklyReflection}`
          : '';

        // Build user prompt with all placeholders
        const userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(request.userProfile, null, 2))
          .replace('{MACROCYCLE}', JSON.stringify(request.macrocycleGoal, null, 2))
          .replace('{MESOCYCLE}', JSON.stringify(request.mesocycleMilestones[0] || {}, null, 2))
          .replace('{CURRENT_DATE}', request.currentDate)
          .replace('{NEXT_WEEK_NUMBER}', String(request.weekNumber))
          .replace('{WEEK_DATE_RANGE}', JSON.stringify(request.weekDateRange, null, 2))
          .replace('{PREVIOUS_MICROCYCLE_PLANNED}', previousPlanned)
          .replace('{PREVIOUS_MICROCYCLE_ACTUAL}', previousActual)
          .replace('{CUSTOM_PROMPT}', request.customFeedback || '')
          .replace('{WORKOUT_HISTORY}', JSON.stringify(request.workoutHistory || [], null, 2));

        // 📤 LOG: Prompt being sent to AI
        console.log('\n' + '='.repeat(80));
        console.log('🤖 AI CALL: MICROCYCLE GENERATION');
        console.log('='.repeat(80));
        console.log('📋 SYSTEM PROMPT:');
        console.log(promptConfig.system_prompt);
        console.log('\n📝 USER PROMPT (with populated data):');
        console.log(userPrompt);
        console.log('='.repeat(80) + '\n');

        // Call OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: promptConfig.system_prompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content;
        if (!content) throw new Error('No response from OpenAI');

        // 📥 LOG: AI Response
        console.log('\n' + '='.repeat(80));
        console.log('✅ AI RESPONSE: MICROCYCLE GENERATION');
        console.log('='.repeat(80));
        console.log(content);
        console.log('='.repeat(80) + '\n');

        // Clean JSON
        content = content.trim();
        if (content.startsWith('```json')) {
          content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (content.startsWith('```')) {
          content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const aiResponse = JSON.parse(content);
        const microcycleData = aiResponse.plan?.currentMicrocycle;
        if (!microcycleData) throw new Error('Invalid AI response');

        // Create workout documents in WorkoutsStore (as drafts)
        const workoutIds: string[] = [];
        
        // Track used dates to handle multiple workouts on same dayOfWeek
        const usedDates = new Set<string>();
        
        for (const workoutData of microcycleData.workouts || []) {
          // Validate and normalize dayOfWeek (AI sometimes returns invalid values)
          let dayOfWeek = workoutData.dayOfWeek;
          
          if (dayOfWeek === 7 || dayOfWeek > 6) {
            dayOfWeek = 0; // Sunday
          }
          if (dayOfWeek < 0) {
            dayOfWeek = 1; // Monday
          }
          
          // CRITICAL: Find NEXT unused date with this dayOfWeek
          let date: string | null = null;
          const startDate = new Date(request.weekDateRange.start);
          const endDate = new Date(request.weekDateRange.end);
          
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            if (currentDate.getDay() === dayOfWeek) {
              const year = currentDate.getFullYear();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const day = String(currentDate.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              
              // Check if this date is already used
              if (!usedDates.has(dateStr)) {
                date = dateStr;
                usedDates.add(dateStr);
                break;
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          if (!date) {
            console.error(`❌ Could not find unused dayOfWeek=${dayOfWeek} in range ${request.weekDateRange.start} to ${request.weekDateRange.end}`);
            continue; // Skip this workout
          }
          
          // Normalize exercises to ensure volumeType is correctly set
          const normalizedExercises = normalizeExercises(workoutData.exercises || []);
          
          // Store normalized AI suggestion for preservation
          const originalExercises = JSON.parse(JSON.stringify(normalizedExercises)); // Deep copy
          
          const workoutId = await workoutsStore.addWorkout({
            ...workoutData,
            exercises: normalizedExercises, // Use normalized exercises
            dayOfWeek, // Use normalized dayOfWeek
            date,
            source: 'ai-coach',
            status: 'planned', // Start as planned so they appear immediately
            aiCoachContext: {
              microcycleId: microcycleData.id || `micro_${Date.now()}`,
              weekNumber: request.weekNumber
            },
            originalAISuggestion: {
              exercises: originalExercises,
              createdAt: new Date().toISOString()
            },
            hasManualChanges: false
          });
          
          workoutIds.push(workoutId);
        }

        // Update AI plan with microcycle reference
        const { currentPlan } = get();
        if (!currentPlan) return;

        const updatedPlan: AIPlan = {
          ...currentPlan,
          currentMicrocycle: {
            id: microcycleData.id || `micro_${Date.now()}`,
            week: request.weekNumber,
            focus: microcycleData.focus,
            value: microcycleData.value,
            dateRange: request.weekDateRange,
            workoutIds,
            status: 'active'
          },
          status: 'active',
        };

        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await setDoc(planDocRef, sanitizeWorkoutForFirebase(updatedPlan));

        set({ currentPlan: updatedPlan, generating: false });

      } catch (error) {
        console.error('❌ Generate microcycle error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate microcycle',
          generating: false 
        });
      }
    },

    approveMicrocycle: async () => {
      // Workouts are already created as 'planned' in generateMicrocycle
      // Just update AI plan status
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan) return;

      try {
        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          status: 'active',
          updatedAt: serverTimestamp(),
        });

        set({ 
          currentPlan: { ...currentPlan, status: 'active' } 
        });

      } catch (error) {
        console.error('❌ Approve microcycle error:', error);
      }
    },

    regenerateMicrocycle: async (feedback: string) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      const workoutsStore = useWorkoutsStore.getState();
      
      if (!user || !currentPlan || !currentPlan.currentMicrocycle) return;

      try {
        set({ generating: true });
        
        // Smart deletion: Preserve workouts that user has started
        for (const workoutId of currentPlan.currentMicrocycle.workoutIds) {
          const workout = workoutsStore.workouts.find(w => w.id === workoutId);
          if (!workout) {
            continue;
          }
          
          // Check if user has made any progress on this workout
          const hasProgress = 
            // User marked at least one set as complete
            workout.exercises.some(ex => ex.sets.some(set => set.completed === true)) ||
            // User manually changed the workout structure
            workout.hasManualChanges === true ||
            // Workout is already completed
            workout.status === 'completed';
          
          if (hasProgress) {
            // PRESERVE: Detach from microcycle but keep the workout
            await workoutsStore.updateWorkout(workoutId, {
              aiCoachContext: undefined // Remove microcycle association
            });
          } else {
            // DELETE: User hasn't touched this workout, safe to delete
            await workoutsStore.deleteWorkout(workoutId);
          }
        }

        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const userProfile = userData.profile || {};

        // Regenerate with feedback
        const request: MicrocycleGenerationRequest = {
          userProfile,
          macrocycleGoal: currentPlan.macrocycleGoal,
          mesocycleMilestones: currentPlan.mesocycleMilestones,
          currentDate: new Date().toISOString(),
          weekNumber: currentPlan.currentMicrocycle.week,
          weekDateRange: currentPlan.currentMicrocycle.dateRange,
          customFeedback: feedback,
        };

        await get().generateMicrocycle(request);

      } catch (error) {
        console.error('❌ Regenerate microcycle error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to regenerate microcycle',
          generating: false 
        });
      }
    },

    completeMicrocycle: async (reflection: string) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || !currentPlan || !currentPlan.currentMicrocycle) return;

      try {
        // Move current microcycle to completed
        const completedMicrocycle = {
          id: currentPlan.currentMicrocycle.id,
          week: currentPlan.currentMicrocycle.week,
          completedAt: new Date().toISOString(),
          workoutIds: currentPlan.currentMicrocycle.workoutIds,
          weeklyReflection: reflection
        };

        const updatedPlan: AIPlan = {
          ...currentPlan,
          currentMicrocycle: undefined,
          status: 'goals-approved', // CRITICAL: Reset to goals-approved so next week can be generated
          completedMicrocycles: [
            ...currentPlan.completedMicrocycles,
            completedMicrocycle
          ]
        };

        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          currentMicrocycle: null,
          status: 'goals-approved', // Reset status for next week generation
          completedMicrocycles: updatedPlan.completedMicrocycles,
          updatedAt: serverTimestamp(),
        });

        set({ currentPlan: updatedPlan });

      } catch (error) {
        console.error('❌ Complete microcycle error:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to complete microcycle' });
      }
    },

    generateNextMicrocycle: async (reflection: string) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      const workoutsStore = useWorkoutsStore.getState();
      
      if (!user || !currentPlan || !currentPlan.currentMicrocycle) return;

      try {
        set({ generating: true });
        
        // Save current microcycle data BEFORE clearing it
        const currentMicrocycleData = currentPlan.currentMicrocycle;
        
        // Get completed workouts from current week
        const completedWorkouts = workoutsStore.workouts.filter(w => 
          currentMicrocycleData.workoutIds.includes(w.id) && 
          w.status === 'completed'
        );

        // Create completed microcycle record
        const completedMicrocycle = {
          id: currentMicrocycleData.id,
          week: currentMicrocycleData.week,
          completedAt: new Date().toISOString(),
          workoutIds: currentMicrocycleData.workoutIds,
          weeklyReflection: reflection
        };

        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const userProfile = userData.profile || {};

        // Calculate next week date range
        const today = new Date();
        const nextWeekRange = calculateInitialWeekRange(today);

        // Generate next microcycle
        const request: MicrocycleGenerationRequest = {
          userProfile,
          macrocycleGoal: currentPlan.macrocycleGoal,
          mesocycleMilestones: currentPlan.mesocycleMilestones,
          currentDate: today.toISOString(),
          weekNumber: currentMicrocycleData.week + 1,
          weekDateRange: nextWeekRange,
          previousMicrocycle: {
            planned: {
              week: currentMicrocycleData.week,
              focus: currentMicrocycleData.focus,
              dateRange: currentMicrocycleData.dateRange,
              workouts: []
            },
            actual: {
              completedWorkouts,
              weeklyReflection: reflection,
              completionRate: completedWorkouts.length / currentMicrocycleData.workoutIds.length * 100
            }
          }
        };

        // Generate new microcycle (this will set currentMicrocycle to new week)
        await get().generateMicrocycle(request);
        
        // AFTER successful generation, save the completion record
        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        await updateDoc(planDocRef, {
          completedMicrocycles: [...currentPlan.completedMicrocycles, completedMicrocycle],
          updatedAt: serverTimestamp(),
        });
        
        // Update local state
        const { currentPlan: updatedPlan } = get();
        if (updatedPlan) {
          set({ 
            currentPlan: {
              ...updatedPlan,
              completedMicrocycles: [...currentPlan.completedMicrocycles, completedMicrocycle]
            }
          });
        }

      } catch (error) {
        console.error('❌ Generate next microcycle error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to generate next microcycle',
          generating: false 
        });
      }
    },

    loadPlan: async () => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) return;

      try {
        set({ loading: true, error: null });
        
        const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
        const planDoc = await getDoc(planDocRef);
        
        if (planDoc.exists()) {
          const planData = planDoc.data() as AIPlan;
          set({ currentPlan: planData, loading: false });
        } else {
          set({ currentPlan: null, loading: false });
        }

      } catch (error) {
        console.error('❌ Load plan error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to load plan',
          loading: false 
        });
      }
    },

    startRealtimeSync: () => {
      const { realtimeUnsubscribe } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user || realtimeUnsubscribe) return;

      const planDocRef = doc(db, 'users', user.uid, 'aiPlan', 'plan');
      
      const unsubscribe = onSnapshot(planDocRef, (doc) => {
        if (doc.exists()) {
          const serverData = doc.data() as AIPlan;
          set({ currentPlan: serverData });
        } else {
          set({ currentPlan: null });
        }
      }, (error) => {
        console.error('❌ Realtime sync error:', error);
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

    clearError: () => set({ error: null }),
  }))
);

