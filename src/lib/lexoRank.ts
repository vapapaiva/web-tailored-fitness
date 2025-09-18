/**
 * LexoRank implementation for drag & drop ordering
 * Based on the expert's recommendation for proper ranking
 */

const BASE_36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a LexoRank between two ranks
 * @param prevRank - Previous rank (or empty string for first)
 * @param nextRank - Next rank (or empty string for last)
 * @returns New rank between prev and next
 */
export function generateRank(prevRank: string = '', nextRank: string = ''): string {
  // If no previous rank, start with middle of alphabet
  if (!prevRank) {
    return nextRank ? generateRank('', nextRank) : 'M';
  }
  
  // If no next rank, append to previous
  if (!nextRank) {
    return prevRank + 'M';
  }
  
  // Find the difference and generate middle rank
  const prev = prevRank.split('');
  const next = nextRank.split('');
  
  // Pad shorter string with '0'
  const maxLength = Math.max(prev.length, next.length);
  while (prev.length < maxLength) prev.push('0');
  while (next.length < maxLength) next.push('0');
  
  // Find first difference
  for (let i = 0; i < maxLength; i++) {
    const prevChar = prev[i];
    const nextChar = next[i];
    
    if (prevChar !== nextChar) {
      const prevIndex = BASE_36.indexOf(prevChar);
      const nextIndex = BASE_36.indexOf(nextChar);
      
      if (nextIndex - prevIndex > 1) {
        // Can fit between them
        const midIndex = Math.floor((prevIndex + nextIndex) / 2);
        const result = [...prev];
        result[i] = BASE_36[midIndex];
        return result.join('').replace(/0+$/, ''); // Remove trailing zeros
      } else {
        // Need to expand
        const result = [...prev];
        result[i] = BASE_36[prevIndex];
        result.push(BASE_36[Math.floor(BASE_36.length / 2)]);
        return result.join('').replace(/0+$/, '');
      }
    }
  }
  
  // If identical, append middle character
  return prevRank + BASE_36[Math.floor(BASE_36.length / 2)];
}

/**
 * Generate initial rank for new workout
 * @param existingRanks - Array of existing ranks for the day
 * @returns New rank
 */
export function generateInitialRank(existingRanks: string[]): string {
  if (existingRanks.length === 0) {
    return 'M';
  }
  
  const sortedRanks = [...existingRanks].sort();
  return generateRank('', sortedRanks[0]);
}

/**
 * Generate rank for inserting at specific position
 * @param existingRanks - Array of existing ranks for the day
 * @param insertIndex - Index where to insert
 * @returns New rank
 */
export function generateRankAtPosition(existingRanks: string[], insertIndex: number): string {
  const sortedRanks = [...existingRanks].sort();
  
  if (insertIndex === 0) {
    return generateRank('', sortedRanks[0]);
  }
  
  if (insertIndex >= sortedRanks.length) {
    return generateRank(sortedRanks[sortedRanks.length - 1], '');
  }
  
  return generateRank(sortedRanks[insertIndex - 1], sortedRanks[insertIndex]);
}
