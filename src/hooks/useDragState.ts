import { useRef, useCallback } from 'react';

/**
 * Custom hook for managing drag state in drag & drop components
 * Prevents unnecessary re-renders and provides stable drag state management
 */
export function useDragState() {
  const isDraggingRef = useRef(false);
  const parentUpdateBlockedRef = useRef(false);

  const startDrag = useCallback(() => {
    isDraggingRef.current = true;
    parentUpdateBlockedRef.current = true;
  }, []);

  const endDrag = useCallback(() => {
    isDraggingRef.current = false;
    parentUpdateBlockedRef.current = false;
  }, []);

  return {
    isDraggingRef,
    parentUpdateBlockedRef,
    startDrag,
    endDrag
  };
}
