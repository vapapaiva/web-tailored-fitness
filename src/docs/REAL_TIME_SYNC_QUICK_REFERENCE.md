# Real-Time Sync Quick Reference

## 🚀 When to Use This Pattern

**ALWAYS use this pattern for:**
- ✅ User data editing (profiles, workouts, exercises)
- ✅ Drag & drop operations
- ✅ Multi-device synchronization
- ✅ Any feature that updates Firebase data

**DON'T use this pattern for:**
- ❌ UI-only state (modals, toggles, form inputs)
- ❌ Static data (configuration, constants)
- ❌ One-time operations (file uploads, exports)

## 📋 Implementation Checklist

### 1. Store Setup
```typescript
// Add to store interface
interface MyStoreState {
  mutationState: MutationState;
  realtimeUnsubscribe: (() => void) | null;
  startRealtimeSync: () => void;
  stopRealtimeSync: () => void;
  updateItemSilently: (updates: any) => Promise<void>;
}
```

### 2. Real-Time Listener
```typescript
startRealtimeSync: () => {
  const unsubscribe = onSnapshot(docRef, (doc) => {
    const serverData = doc.data();
    
    // Check if this is our own mutation
    const isOwn = serverData.items?.some(item => 
      item.lastMutation && isOwnMutation(mutationState, item.lastMutation)
    );
    
    if (!isOwn) {
      set({ data: serverData });
    }
  });
  
  set({ realtimeUnsubscribe: unsubscribe });
}
```

### 3. Update Function
```typescript
updateItem: async (itemId: string, updates: any) => {
  // 1. IMMEDIATE: Update local state
  const updatedData = currentData.map(item => 
    item.id === itemId ? { ...item, ...updates, lastMutation: {...} } : item
  );
  set({ data: updatedData });

  // 2. ASYNC: Persist to Firebase silently
  await updateItemSilently(updatedData);
}
```

### 4. Component Integration
```typescript
// Start real-time sync on mount
useEffect(() => {
  startRealtimeSync();
  return () => stopRealtimeSync();
}, [startRealtimeSync, stopRealtimeSync]);
```

## 🔧 Required Imports

```typescript
import { onSnapshot } from 'firebase/firestore';
import { createMutationTracker, addPendingMutation, removePendingMutation, isOwnMutation } from '@/lib/mutationTracker';
import { generateRank, generateInitialRank } from '@/lib/lexoRank';
```

## ⚠️ Common Mistakes to Avoid

1. **Don't forget mutation tracking** - Always include `lastMutation` in updates
2. **Don't skip real-time listeners** - Multi-device sync requires `onSnapshot`
3. **Don't use loading states for silent updates** - Causes UI blinking
4. **Don't forget cleanup** - Always unsubscribe from listeners
5. **Don't skip conflict resolution** - Check `isOwnMutation` before applying changes

## 🎯 Pattern Benefits

- ✅ **Instant UI updates** - No waiting for server responses
- ✅ **Multi-device sync** - Changes appear on all devices instantly
- ✅ **No data loss** - All changes are preserved and synced
- ✅ **Professional UX** - Works like Google Docs or Notion
- ✅ **Conflict resolution** - Smart handling of concurrent edits

## 📚 Full Documentation

See `src/docs/NO_BLINKING_UPDATE_PATTERN.md` for complete implementation details and examples.
