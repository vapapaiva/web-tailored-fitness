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
import type { CustomPromptConfig } from '@/types/profile';
import { sanitizeWorkoutForFirebase } from '@/lib/firebaseUtils';
import { calculateInitialWeekRange } from '@/lib/dateUtils';
import { normalizeExercises } from '@/lib/workoutNormalization';

interface AICoachState {
  currentPlan: AIPlan | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  realtimeUnsubscribe: (() => void) | null;
  
  // Prompt Management
  customGoalsPrompt: CustomPromptConfig | null;
  customMicrocyclePrompt: CustomPromptConfig | null;
  loadCustomPrompts: () => Promise<void>;
  saveCustomGoalsPrompt: (prompt: CustomPromptConfig) => Promise<void>;
  saveCustomMicrocyclePrompt: (prompt: CustomPromptConfig) => Promise<void>;
  resetGoalsPromptToDefault: () => Promise<void>;
  resetMicrocyclePromptToDefault: () => Promise<void>;
  
  // Phase 1: Goals Generation
  generateGoals: (request: GoalsGenerationRequest, customPrompt?: CustomPromptConfig) => Promise<void>;
  approveGoals: () => Promise<void>;
  updateGoals: (updates: Partial<Pick<AIPlan, 'macrocycleGoal' | 'mesocycleMilestones'>>) => Promise<void>;
  regenerateGoals: (feedback: string) => Promise<void>;
  dismissRegenerationSuggestion: () => Promise<void>;
  
  // Phase 2: Workout Generation (suggestions-based)
  generateMicrocycle: (request: MicrocycleGenerationRequest) => Promise<void>;
  acceptSuggestedWorkouts: (workoutIndexes: number[]) => Promise<void>;
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
    customGoalsPrompt: null,
    customMicrocyclePrompt: null,

    loadCustomPrompts: async () => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      
      if (!user) return;

      try {
        // Custom prompts are already loaded in the user object from authStore
        set({ 
          customGoalsPrompt: user.customGoalsPrompt || null,
          customMicrocyclePrompt: user.customMicrocyclePrompt || null
        });
      } catch (error) {
        console.error('❌ Load custom prompts error:', error);
      }
    },

    saveCustomGoalsPrompt: async (prompt: CustomPromptConfig) => {
      const authStore = useAuthStore.getState();
      const { user, updateProfile } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ loading: true, error: null });
        
        await updateProfile({ customGoalsPrompt: prompt });
        set({ customGoalsPrompt: prompt, loading: false });
        
        console.log('✅ Custom goals prompt saved');
      } catch (error) {
        console.error('❌ Save custom goals prompt error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to save custom prompt',
          loading: false 
        });
      }
    },

    saveCustomMicrocyclePrompt: async (prompt: CustomPromptConfig) => {
      const authStore = useAuthStore.getState();
      const { user, updateProfile } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ loading: true, error: null });
        
        await updateProfile({ customMicrocyclePrompt: prompt });
        set({ customMicrocyclePrompt: prompt, loading: false });
        
        console.log('✅ Custom microcycle prompt saved');
      } catch (error) {
        console.error('❌ Save custom microcycle prompt error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to save custom prompt',
          loading: false 
        });
      }
    },

    resetGoalsPromptToDefault: async () => {
      const authStore = useAuthStore.getState();
      const { user, updateProfile } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ loading: true, error: null });
        
        // Remove custom prompt from user document (will fallback to Remote Config)
        await updateProfile({ customGoalsPrompt: undefined });
        set({ customGoalsPrompt: null, loading: false });
        
        console.log('✅ Goals prompt reset to default');
      } catch (error) {
        console.error('❌ Reset goals prompt error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to reset prompt',
          loading: false 
        });
      }
    },

    resetMicrocyclePromptToDefault: async () => {
      const authStore = useAuthStore.getState();
      const { user, updateProfile } = authStore;
      
      if (!user) {
        set({ error: 'User not authenticated' });
        return;
      }

      try {
        set({ loading: true, error: null });
        
        // Remove custom prompt from user document (will fallback to Remote Config)
        await updateProfile({ customMicrocyclePrompt: undefined });
        set({ customMicrocyclePrompt: null, loading: false });
        
        console.log('✅ Microcycle prompt reset to default');
      } catch (error) {
        console.error('❌ Reset microcycle prompt error:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to reset prompt',
          loading: false 
        });
      }
    },

    generateGoals: async (request: GoalsGenerationRequest, customPrompt?: CustomPromptConfig) => {
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

        // Determine which prompt to use: customPrompt param > state > Remote Config
        let promptConfig: { system_prompt: string; user_prompt_template: string };
        
        if (customPrompt) {
          // Use provided custom prompt
          promptConfig = {
            system_prompt: customPrompt.systemPrompt,
            user_prompt_template: customPrompt.userPromptTemplate
          };
        } else if (get().customGoalsPrompt) {
          // Use custom prompt from state
          const statePrompt = get().customGoalsPrompt!;
          promptConfig = {
            system_prompt: statePrompt.systemPrompt,
            user_prompt_template: statePrompt.userPromptTemplate
          };
        } else {
          // Fallback to Remote Config
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_goals_generation');
        const promptString = promptValue.asString();
        
        if (!promptString) {
          throw new Error('Goals generation prompt (prompts_ai_coach_goals_generation) not configured in Firebase Remote Config');
        }

          promptConfig = JSON.parse(promptString);
        }

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

    // Phase 2: Workout Generation (creates suggestions, not workouts)
    generateMicrocycle: async (request: MicrocycleGenerationRequest) => {
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      const workoutsStore = useWorkoutsStore.getState();
      const { currentPlan } = get();
      
      if (!user || !currentPlan) {
        set({ error: 'User not authenticated or no plan' });
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

        // Determine which prompt to use: custom > Remote Config
        let promptConfig: { system_prompt: string; user_prompt_template: string };
        
        if (get().customMicrocyclePrompt) {
          const statePrompt = get().customMicrocyclePrompt!;
          promptConfig = {
            system_prompt: statePrompt.systemPrompt,
            user_prompt_template: statePrompt.userPromptTemplate
          };
        } else {
          // Fallback to Remote Config
        const promptValue = getValue(remoteConfig, 'prompts_ai_coach_workout_generation');
        const promptString = promptValue.asString();
        
        if (!promptString) {
            throw new Error('Workout generation prompt not configured in Firebase Remote Config');
          }
          
          promptConfig = JSON.parse(promptString);
        }

        // Get planned workouts for the microcycle period (current week + next if applicable)
        const plannedWorkouts = workoutsStore.workouts.filter(w => {
          if (!w.date || w.status === 'completed') return false;
          const workoutDate = new Date(w.date);
          const startDate = new Date(request.weekDateRange.start);
          const endDate = new Date(request.weekDateRange.end);
          return workoutDate >= startDate && workoutDate <= endDate;
        });

        // Prepare data for prompt placeholders
        const plannedWorkoutsStr = plannedWorkouts.length > 0
          ? JSON.stringify(plannedWorkouts.map(w => ({
              name: w.name,
              date: w.date,
              type: w.type,
              focus: w.focus,
              exercises: w.exercises.length,
              source: w.source
            })), null, 2)
          : '[]';

        // Prepare previous microcycle data for prompt (if applicable)
        const previousPlanned = request.previousMicrocycle 
          ? `Week ${request.previousMicrocycle.planned.week} (${request.previousMicrocycle.planned.dateRange.start} to ${request.previousMicrocycle.planned.dateRange.end})\nFocus: ${request.previousMicrocycle.planned.focus}`
          : '';
        
        const previousActual = request.previousMicrocycle
          ? `Completed Workouts: ${request.previousMicrocycle.actual.completedWorkouts.length}\nCompletion Rate: ${Math.round(request.previousMicrocycle.actual.completionRate)}%\nReflection: ${request.previousMicrocycle.actual.weeklyReflection}`
          : '';

        // Add explicit instructions based on current state
        let additionalInstructions = '';
        if (plannedWorkouts.length === 0) {
          additionalInstructions = '\n\n**IMPORTANT**: The user currently has NO workouts planned for this period. You MUST suggest 3-5 appropriate workouts to help them achieve their goals.';
        } else {
          additionalInstructions = `\n\n**NOTE**: The user has ${plannedWorkouts.length} workout(s) already planned. Evaluate if this is sufficient for their goals and availability, or if additional workouts would be beneficial.`;
        }

        // Build user prompt with all placeholders (including PLANNED_WORKOUTS)
        let userPrompt = promptConfig.user_prompt_template
          .replace('{USER_PROFILE}', JSON.stringify(request.userProfile, null, 2))
          .replace('{MACROCYCLE}', JSON.stringify(request.macrocycleGoal, null, 2))
          .replace('{MESOCYCLE}', JSON.stringify(request.mesocycleMilestones[0] || {}, null, 2))
          .replace('{CURRENT_DATE}', request.currentDate)
          .replace('{NEXT_WEEK_NUMBER}', String(request.weekNumber))
          .replace('{WEEK_DATE_RANGE}', JSON.stringify(request.weekDateRange, null, 2))
          .replace('{PREVIOUS_MICROCYCLE_PLANNED}', previousPlanned)
          .replace('{PREVIOUS_MICROCYCLE_ACTUAL}', previousActual)
          .replace('{CUSTOM_PROMPT}', request.customFeedback || '')
          .replace('{PLANNED_WORKOUTS}', plannedWorkoutsStr)
          .replace('{WORKOUT_HISTORY}', JSON.stringify(request.workoutHistory || [], null, 2));
        
        // Append additional instructions
        userPrompt += additionalInstructions;
        
        // Enhance system prompt to ensure new format
        const enhancedSystemPrompt = promptConfig.system_prompt + 
          '\n\nRESPONSE FORMAT: You must respond with JSON containing:\n' +
          '1. "assessment" (string): Your professional assessment of the current plan\n' +
          '2. "suggestedWorkouts" (array): Workouts to add (can be empty if plan is sufficient)\n' +
          'Example: { "assessment": "...", "suggestedWorkouts": [...] }';

        // 📤 LOG: Prompt being sent to AI
        console.log('\n' + '='.repeat(80));
        console.log('🤖 AI CALL: MICROCYCLE GENERATION');
        console.log('='.repeat(80));
        console.log('📋 SYSTEM PROMPT:');
        console.log(enhancedSystemPrompt);
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
              { role: 'system', content: enhancedSystemPrompt },
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
        
        // Handle both NEW and OLD formats
        let assessment = '';
        let suggestedWorkouts = [];
        
        if (aiResponse.assessment !== undefined) {
          // NEW FORMAT: { assessment, suggestedWorkouts }
          assessment = aiResponse.assessment || 'AI Coach has reviewed your plan.';
          suggestedWorkouts = aiResponse.suggestedWorkouts || [];
        } else if (aiResponse.plan?.currentMicrocycle?.workouts) {
          // OLD FORMAT: { plan: { currentMicrocycle: { workouts } } }
          suggestedWorkouts = aiResponse.plan.currentMicrocycle.workouts || [];
          assessment = aiResponse.explanation || `Suggested ${suggestedWorkouts.length} workout(s) for this week.`;
        } else if (aiResponse.workouts) {
          // ALTERNATIVE FORMAT: { workouts: [...] }
          suggestedWorkouts = aiResponse.workouts;
          assessment = aiResponse.explanation || `Suggested ${suggestedWorkouts.length} workout(s) for this week.`;
        }
        
        // If we got workouts but no assessment, generate one
        if (!assessment && suggestedWorkouts.length > 0) {
          assessment = `I've prepared ${suggestedWorkouts.length} workout${suggestedWorkouts.length !== 1 ? 's' : ''} to help you achieve your goals.`;
        } else if (!assessment) {
          assessment = 'Your current plan looks good. No additional workouts needed at this time.';
        }
        
        // Track used dates to handle multiple workouts on same dayOfWeek
        const usedDates = new Set<string>();
        
        // Create suggestion object (don't create workout documents yet)
        const suggestion = {
          assessment,
          suggestedWorkouts: suggestedWorkouts.map((workoutData: {
            name?: string;
            dayOfWeek?: number;
            type?: string;
            focus?: string;
            value?: string;
            exercises?: Array<{
              id?: string;
              name: string;
              category?: string;
              muscleGroups?: string[];
              equipment?: string[];
              instructions?: string;
              sets: Array<{
                reps: number;
                weight?: number;
                duration?: number;
                restTime?: number;
                notes?: string;
                volumeType?: 'sets-reps' | 'sets-reps-weight' | 'duration' | 'distance' | 'completion';
              }>;
            }>;
            estimatedDuration?: number;
            checkIns?: { greenFlags: string[]; redFlags: string[] };
          }) => {
          // Validate and normalize dayOfWeek (AI sometimes returns invalid values)
            let dayOfWeek = workoutData.dayOfWeek ?? 1; // Default to Monday
          
          if (dayOfWeek === 7 || dayOfWeek > 6) {
            dayOfWeek = 0; // Sunday
          }
          if (dayOfWeek < 0) {
            dayOfWeek = 1; // Monday
          }
          
            // Find NEXT unused date with this dayOfWeek
          let date: string | null = null;
          const startDate = new Date(request.weekDateRange.start);
          const endDate = new Date(request.weekDateRange.end);
          
            const tempDate = new Date(startDate);
            while (tempDate <= endDate) {
              if (tempDate.getDay() === dayOfWeek) {
                const year = tempDate.getFullYear();
                const month = String(tempDate.getMonth() + 1).padStart(2, '0');
                const day = String(tempDate.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              
              // Check if this date is already used
              if (!usedDates.has(dateStr)) {
                date = dateStr;
                usedDates.add(dateStr);
                break;
              }
            }
              tempDate.setDate(tempDate.getDate() + 1);
          }
          
          if (!date) {
              console.warn(`⚠️ Could not find unused dayOfWeek=${dayOfWeek} in range, using fallback`);
              date = request.weekDateRange.start; // Fallback to start date
          }
          
            // Normalize exercises and ensure they have IDs + volumeRowIds
            const rawExercises = workoutData.exercises || [];
            const exercisesWithIds = rawExercises.map((ex, idx) => {
              // Group sets by their values to assign consistent volumeRowIds
              const valueGroups: { [key: string]: number[] } = {};
              
              ex.sets.forEach((set, setIdx) => {
                // Create value key for grouping
                const valueKey = JSON.stringify({
                  reps: set.reps,
                  weight: set.weight,
                  duration: set.duration,
                  volumeType: set.volumeType
                });
                
                if (!valueGroups[valueKey]) {
                  valueGroups[valueKey] = [];
                }
                valueGroups[valueKey].push(setIdx);
              });
              
              // Assign volumeRowIds - same ID for sets with same values
              const volumeRowIds: string[] = [];
              Object.values(valueGroups).forEach((indices, groupIdx) => {
                const volumeRowId = `volume_${Date.now()}_${idx}_${groupIdx}`;
                indices.forEach(setIdx => {
                  volumeRowIds[setIdx] = volumeRowId;
                });
              });
              
              return {
                ...ex,
                id: ex.id || `ex_${Date.now()}_${idx}`,
                category: ex.category || 'general',
                muscleGroups: ex.muscleGroups || [],
                equipment: ex.equipment || [],
                instructions: ex.instructions || '',
                sets: ex.sets.map((set, setIdx) => ({
                  ...set,
                  restTime: set.restTime ?? 60, // Default 60 seconds rest
                  volumeRowId: set.volumeRowId || volumeRowIds[setIdx] // Add volumeRowId!
                }))
              };
            });
            const normalizedExercises = normalizeExercises(exercisesWithIds);
            
            // Return workout suggestion (not creating actual workout yet)
            return {
              name: workoutData.name || 'Workout',
            date,
              dayOfWeek,
              type: workoutData.type || 'general',
              focus: workoutData.focus || 'General',
              value: workoutData.value || '',
              exercises: normalizedExercises,
              estimatedDuration: workoutData.estimatedDuration || 60,
              checkIns: workoutData.checkIns || { greenFlags: [], redFlags: [] }
            };
          }),
          generated_at: new Date().toISOString(),
          weekDateRange: request.weekDateRange
        };

        // Store suggestion in AI plan (don't create workouts yet)
        const updatedPlan = {
          ...currentPlan,
          currentSuggestion: suggestion,
          status: 'suggestion-pending' as const,
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

    acceptSuggestedWorkouts: async (workoutIndexes: number[]) => {
      const { currentPlan } = get();
      const authStore = useAuthStore.getState();
      const { user } = authStore;
      const workoutsStore = useWorkoutsStore.getState();
      
      if (!user || !currentPlan || !currentPlan.currentSuggestion) {
        set({ error: 'No suggestion to accept' });
        return;
      }

      try {
        const { currentSuggestion } = currentPlan;
        
        // Create WorkoutDocuments for accepted workouts
        for (const index of workoutIndexes) {
          const suggestion = currentSuggestion.suggestedWorkouts[index];
          if (!suggestion) continue;

          // Store normalized AI suggestion for preservation
          const originalExercises = JSON.parse(JSON.stringify(suggestion.exercises)); // Deep copy
          
          await workoutsStore.addWorkout({
            name: suggestion.name,
            date: suggestion.date,
            dayOfWeek: suggestion.dayOfWeek,
            type: suggestion.type,
            focus: suggestion.focus,
            value: suggestion.value,
            exercises: suggestion.exercises,
            estimatedDuration: suggestion.estimatedDuration,
            checkIns: { greenFlags: [], redFlags: [] },
            source: 'ai-coach',
            status: 'planned',
            aiCoachContext: {
              microcycleId: `micro_${Date.now()}`,
              weekNumber: 1 // TODO: Get actual week number from context
            },
            originalAISuggestion: {
              exercises: originalExercises,
              createdAt: new Date().toISOString()
            },
            hasManualChanges: false
          });
        }
        
        console.log(`✅ Accepted ${workoutIndexes.length} suggested workout(s)`);
      } catch (error) {
        console.error('❌ Accept suggested workouts error:', error);
        set({ error: error instanceof Error ? error.message : 'Failed to accept workouts' });
        throw error;
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
      
      if (!user || !currentPlan) return;

      try {
        set({ generating: true });
        
        // NEW SYSTEM: No workouts to delete - suggestions haven't been accepted yet
        // Just regenerate with context from current suggestion

        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        const userProfile = userData.profile || {};

        // Calculate week date range
        const weekDateRange = currentPlan.currentSuggestion?.weekDateRange || calculateInitialWeekRange(new Date());
        
        // Build custom feedback with current suggestions as context
        let contextualFeedback = feedback;
        if (currentPlan.currentSuggestion) {
          const suggestionContext = `\n\nPrevious suggestions:\n${
            currentPlan.currentSuggestion.suggestedWorkouts
              .map((w, i) => `${i + 1}. ${w.name} (${w.date}) - ${w.exercises.length} exercises`)
              .join('\n')
          }\n\nAI Assessment: ${currentPlan.currentSuggestion.assessment}`;
          contextualFeedback = (feedback || 'Please provide new suggestions') + suggestionContext;
        }

        // Regenerate with feedback
        const request: MicrocycleGenerationRequest = {
          userProfile,
          macrocycleGoal: currentPlan.macrocycleGoal,
          mesocycleMilestones: currentPlan.mesocycleMilestones,
          currentDate: new Date().toISOString(),
          weekNumber: 1, // Always week 1 for suggestions
          weekDateRange,
          customFeedback: contextualFeedback,
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

