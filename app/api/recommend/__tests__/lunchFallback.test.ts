/**
 * Unit tests for lunch fallback logic and "View more options" feature
 * Tests ensure we always return at least 2 lunch picks when possible
 */

import { describe, it, expect } from '@jest/globals';

// Mock the lunch fallback logic
interface MockRestaurant {
  placeId: string;
  name: string;
  etaMinutes: number;
}

interface MockLunchFallback {
  withinLimit: MockRestaurant[];
  allCandidates: MockRestaurant[];
  maxWalkMinutes: number;
}

function testLunchFallback(data: MockLunchFallback): {
  lunchPicks: MockRestaurant[];
  usedRelaxedTimeLimit: boolean;
  showMoreOptionsEnabled: boolean;
  moreLunchOptions: MockRestaurant[];
} {
  const { withinLimit, allCandidates, maxWalkMinutes } = data;
  const lunchWithinLimitCount = withinLimit.length;
  const allCandidatesWithETA = allCandidates.filter(r => r.etaMinutes !== undefined);
  
  let lunchCandidatesForRanking: MockRestaurant[];
  let usedRelaxedTimeLimit = false;
  
  if (lunchWithinLimitCount === 0) {
    // If filtered set has 0 items: use relaxed mode ranking and return top 2
    if (allCandidatesWithETA.length >= 2) {
      // Sort by ETA (closest first) for relaxed mode
      lunchCandidatesForRanking = [...allCandidatesWithETA].sort((a, b) => a.etaMinutes - b.etaMinutes);
      usedRelaxedTimeLimit = true;
    } else {
      // Not enough candidates overall, use what we have
      lunchCandidatesForRanking = allCandidatesWithETA;
      usedRelaxedTimeLimit = true;
    }
  } else if (lunchWithinLimitCount === 1) {
    // If filtered set has 1 item: return that 1 item plus 1 more from full set
    if (allCandidatesWithETA.length >= 2) {
      const theOneWithinLimit = withinLimit[0];
      const theRest = allCandidatesWithETA.filter(r => r.placeId !== theOneWithinLimit.placeId);
      
      // Sort the rest by ETA (closest first) for relaxed mode
      const closestFromRest = [...theRest].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
      
      lunchCandidatesForRanking = [theOneWithinLimit, closestFromRest];
      usedRelaxedTimeLimit = true;
    } else {
      // Only 1 candidate total, use it
      lunchCandidatesForRanking = withinLimit;
      usedRelaxedTimeLimit = false;
    }
  } else {
    // If filtered set has >= 2 items: return top 2 from within-limit set
    lunchCandidatesForRanking = withinLimit;
    usedRelaxedTimeLimit = false;
  }
  
  // Get top 2 lunch picks (always at least 2 if possible)
  const topLunch = lunchCandidatesForRanking.slice(0, Math.min(2, lunchCandidatesForRanking.length));
  
  // Determine total viable lunch candidate count (after hard filters)
  const totalLunchCandidateCount = allCandidatesWithETA.length;
  
  // Determine if we should show "more options"
  // Show "View more options" whenever there are MORE viable candidates beyond the top 2
  // This means it appears even when exactly 2 lunch options are shown, if there are more candidates available
  // Edge case: Only show if totalLunchCandidateCount > 2 (otherwise no point showing "more")
  const showMoreOptionsEnabled = totalLunchCandidateCount > topLunch.length;
  
  // Calculate "more lunch options" if enabled
  // This should be populated whenever there are more candidates beyond the top picks
  let moreLunchOptions: MockRestaurant[] = [];
  const MORE_OPTIONS_COUNT = 6;
  
  if (showMoreOptionsEnabled && totalLunchCandidateCount > topLunch.length) {
    // Get top lunch picks' placeIds to exclude duplicates
    const topLunchPlaceIds = new Set(topLunch.map(r => r.placeId));
    
    // Get remaining candidates (sorted by ETA for simplicity - in real code, would use balanced scoring)
    const remainingCandidates = allCandidatesWithETA
      .filter(r => !topLunchPlaceIds.has(r.placeId))
      .sort((a, b) => a.etaMinutes - b.etaMinutes);
    
    moreLunchOptions = remainingCandidates.slice(0, MORE_OPTIONS_COUNT);
    
    // Edge case: Log warning if moreLunchOptions is empty (shouldn't happen if showMoreOptionsEnabled is true)
    if (moreLunchOptions.length === 0) {
      console.warn('showMoreOptionsEnabled is true but moreLunchOptions is empty. This should not happen.');
    }
  } else if (totalLunchCandidateCount <= topLunch.length) {
    // Edge case: totalLunchCandidateCount <= 2 (or exactly topLunch.length)
    // Do NOT show "View more options" - no empty expandable section
    moreLunchOptions = [];
  }
  
  return {
    lunchPicks: topLunch,
    usedRelaxedTimeLimit,
    showMoreOptionsEnabled,
    moreLunchOptions,
  };
}

describe('Lunch Fallback Logic', () => {
  describe('When within-limit count = 0', () => {
    it('should return 2 items (if candidates >= 2) and showMoreOptionsEnabled=true', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 8 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 10 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 12 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.lunchPicks[0].etaMinutes).toBe(8); // Closest first
      expect(result.lunchPicks[1].etaMinutes).toBe(10);
      expect(result.usedRelaxedTimeLimit).toBe(true);
      expect(result.showMoreOptionsEnabled).toBe(true);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0);
    });

    it('should return 2 items and moreLunchOptions exists when within-limit count = 0', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 8 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 10 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 12 },
          { placeId: '4', name: 'Restaurant D', etaMinutes: 15 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0);
      expect(result.moreLunchOptions.length).toBeLessThanOrEqual(6);
      
      // Verify no duplicates
      const topLunchPlaceIds = new Set(result.lunchPicks.map(r => r.placeId));
      const moreOptionsPlaceIds = new Set(result.moreLunchOptions.map(r => r.placeId));
      const intersection = [...topLunchPlaceIds].filter(id => moreOptionsPlaceIds.has(id));
      expect(intersection).toHaveLength(0); // No duplicates
    });
  });

  describe('When within-limit count = 1', () => {
    it('should return 2 items (1 within + 1 closest fallback), showMoreOptionsEnabled=true', () => {
      const data: MockLunchFallback = {
        withinLimit: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 4 },
        ],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 4 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 8 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 10 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.lunchPicks[0].placeId).toBe('1'); // The one within limit
      expect(result.lunchPicks[1].etaMinutes).toBe(8); // Closest from the rest
      expect(result.usedRelaxedTimeLimit).toBe(true);
      expect(result.showMoreOptionsEnabled).toBe(true);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0);
    });

    it('should include the within-limit item in top 2 picks', () => {
      const data: MockLunchFallback = {
        withinLimit: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 5 },
        ],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 5 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 8 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 12 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.lunchPicks.some(r => r.placeId === '1')).toBe(true); // Within-limit item included
      expect(result.lunchPicks.some(r => r.placeId === '2')).toBe(true); // Closest fallback included
    });
  });

  describe('When within-limit count >= 2', () => {
    it('should return top 2 within limit, showMoreOptionsEnabled=true when totalCandidates > 2', () => {
      const data: MockLunchFallback = {
        withinLimit: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 5 },
        ],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 5 },
          { placeId: '4', name: 'Restaurant D', etaMinutes: 8 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.lunchPicks[0].placeId).toBe('1');
      expect(result.lunchPicks[1].placeId).toBe('2');
      expect(result.usedRelaxedTimeLimit).toBe(false);
      // NEW BEHAVIOR: showMoreOptionsEnabled should be true because totalCandidates (4) > topLunch.length (2)
      expect(result.showMoreOptionsEnabled).toBe(true);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0); // Should have more options
      
      // Verify no duplicates
      const topLunchPlaceIds = new Set(result.lunchPicks.map(r => r.placeId));
      result.moreLunchOptions.forEach(option => {
        expect(topLunchPlaceIds.has(option.placeId)).toBe(false);
      });
    });

    it('should return top 2 within limit, showMoreOptionsEnabled=false when totalCandidates = 2', () => {
      const data: MockLunchFallback = {
        withinLimit: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
        ],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.usedRelaxedTimeLimit).toBe(false);
      // NEW BEHAVIOR: showMoreOptionsEnabled should be false because totalCandidates (2) = topLunch.length (2)
      expect(result.showMoreOptionsEnabled).toBe(false);
      expect(result.moreLunchOptions).toHaveLength(0); // No more options available
    });
  });

  describe('"View more options" list never duplicates top lunch picks', () => {
    it('should exclude top lunch picks from moreLunchOptions', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 8 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 10 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 12 },
          { placeId: '4', name: 'Restaurant D', etaMinutes: 15 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0);
      
      // Verify no duplicates
      const topLunchPlaceIds = new Set(result.lunchPicks.map(r => r.placeId));
      result.moreLunchOptions.forEach(option => {
        expect(topLunchPlaceIds.has(option.placeId)).toBe(false);
      });
    });

    it('should return at most 6 additional options', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: Array.from({ length: 15 }, (_, i) => ({
          placeId: `place_${i}`,
          name: `Restaurant ${i}`,
          etaMinutes: 8 + i * 2,
        })),
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.moreLunchOptions.length).toBeLessThanOrEqual(6);
    });
  });

  describe('Edge cases', () => {
    it('should handle case with only 1 candidate overall', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 8 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(1);
      expect(result.usedRelaxedTimeLimit).toBe(true);
      // NEW BEHAVIOR: showMoreOptionsEnabled should be false because totalCandidates (1) <= topLunch.length (1)
      expect(result.showMoreOptionsEnabled).toBe(false);
      expect(result.moreLunchOptions).toHaveLength(0); // No more options available
    });

    it('should handle case with exactly 2 candidates', () => {
      const data: MockLunchFallback = {
        withinLimit: [],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 8 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 10 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.usedRelaxedTimeLimit).toBe(true);
      // NEW BEHAVIOR: showMoreOptionsEnabled should be false because totalCandidates (2) = topLunch.length (2)
      expect(result.showMoreOptionsEnabled).toBe(false);
      expect(result.moreLunchOptions).toHaveLength(0); // No more options available (all used)
    });

    it('should show "View more options" when totalCandidates = 3+ even if exactly 2 are shown initially', () => {
      const data: MockLunchFallback = {
        withinLimit: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
        ],
        allCandidates: [
          { placeId: '1', name: 'Restaurant A', etaMinutes: 3 },
          { placeId: '2', name: 'Restaurant B', etaMinutes: 4 },
          { placeId: '3', name: 'Restaurant C', etaMinutes: 6 },
        ],
        maxWalkMinutes: 5,
      };
      
      const result = testLunchFallback(data);
      
      expect(result.lunchPicks).toHaveLength(2);
      expect(result.usedRelaxedTimeLimit).toBe(false);
      // NEW BEHAVIOR: showMoreOptionsEnabled should be true because totalCandidates (3) > topLunch.length (2)
      expect(result.showMoreOptionsEnabled).toBe(true);
      expect(result.moreLunchOptions.length).toBeGreaterThan(0); // Should have 1 more option
      expect(result.moreLunchOptions[0].placeId).toBe('3'); // Should be the 3rd candidate
      
      // Verify no duplicates
      const topLunchPlaceIds = new Set(result.lunchPicks.map(r => r.placeId));
      result.moreLunchOptions.forEach(option => {
        expect(topLunchPlaceIds.has(option.placeId)).toBe(false);
      });
    });
  });
});
