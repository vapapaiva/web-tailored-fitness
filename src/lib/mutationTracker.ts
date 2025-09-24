/**
 * Mutation tracking for optimistic updates and conflict resolution
 * Based on expert's recommendation for handling concurrent edits
 */

export interface PendingMutation {
  id: string;
  clientId: string;
  timestamp: number;
  type: 'workout_update' | 'workout_move' | 'workout_create' | 'workout_delete' | 'workout_status_update' | 'microcycle_completion';
  data: any;
}

export interface MutationState {
  pendingMutations: Map<string, PendingMutation>;
  lastAppliedServerVersion: number;
  clientId: string;
}

/**
 * Generate a unique client ID
 */
export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique mutation ID
 */
export function generateMutationId(): string {
  return `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new mutation tracker
 */
export function createMutationTracker(): MutationState {
  return {
    pendingMutations: new Map(),
    lastAppliedServerVersion: 0,
    clientId: generateClientId(),
  };
}

/**
 * Add a pending mutation
 */
export function addPendingMutation(
  state: MutationState,
  mutation: Omit<PendingMutation, 'id' | 'clientId' | 'timestamp'>
): PendingMutation {
  const fullMutation: PendingMutation = {
    ...mutation,
    id: generateMutationId(),
    clientId: state.clientId,
    timestamp: Date.now(),
  };
  
  state.pendingMutations.set(fullMutation.id, fullMutation);
  return fullMutation;
}

/**
 * Remove a completed mutation
 */
export function removePendingMutation(state: MutationState, mutationId: string): void {
  state.pendingMutations.delete(mutationId);
}

/**
 * Check if a server update is from our own mutation
 */
export function isOwnMutation(
  state: MutationState,
  serverMutation: { clientId?: string; mutationId?: string }
): boolean {
  if (!serverMutation.clientId || !serverMutation.mutationId) {
    return false;
  }
  
  return (
    serverMutation.clientId === state.clientId &&
    state.pendingMutations.has(serverMutation.mutationId)
  );
}

/**
 * Get all pending mutations for a specific workout
 */
export function getPendingMutationsForWorkout(
  state: MutationState,
  workoutId: string
): PendingMutation[] {
  return Array.from(state.pendingMutations.values()).filter(
    mutation => mutation.data.workoutId === workoutId
  );
}
