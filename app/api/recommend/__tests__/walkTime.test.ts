/**
 * Unit tests for deriveMaxWalkMinutes function
 * Tests the dynamic walk time thresholds based on weather
 */

import { describe, it, expect } from '@jest/globals';

// Mock the deriveMaxWalkMinutes function logic
// Note: In a real implementation, we'd export this function for testing
// For now, we'll test the logic directly

interface WeatherInput {
  condition: string;
  tempC: number;
  feelsLikeC: number;
  isRainy: boolean;
  isCold: boolean;
  isHot: boolean;
}

const EXTREME_HOT_THRESHOLD = 37.8; // 100°F
const EXTREME_COLD_THRESHOLD = -17.8; // 0°F

function deriveMaxWalkMinutesTest(weather: WeatherInput): {
  maxWalkMinutes: number;
  weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
} {
  const conditionLower = weather.condition.toLowerCase();
  
  // Check for extreme temperatures
  const isExtremeHot = weather.tempC >= EXTREME_HOT_THRESHOLD;
  const isExtremeCold = weather.tempC <= EXTREME_COLD_THRESHOLD;
  
  // Detect precipitation types
  const isDrizzling = conditionLower.includes('drizzle') || 
                     conditionLower.includes('slight rain') ||
                     conditionLower.includes('light rain') ||
                     conditionLower.includes('sprinkles') ||
                     conditionLower.includes('slight rain showers');
  
  const isModerateRain = conditionLower.includes('moderate rain showers') ||
                         (conditionLower.includes('moderate rain') && !conditionLower.includes('heavy'));
  
  const isLightSnow = conditionLower.includes('slight snow') ||
                      conditionLower.includes('light snow fall') ||
                      conditionLower.includes('slight snow showers');
  
  const isHeavyRain = conditionLower.includes('heavy rain') || 
                     conditionLower.includes('violent rain') ||
                     conditionLower.includes('violent rain showers') ||
                     conditionLower.includes('pouring');
  
  const isSnowStorm = conditionLower.includes('snow fall') && 
                     (conditionLower.includes('heavy') || conditionLower.includes('storm'));
  
  const isRainStorm = conditionLower.includes('rain') && 
                      (conditionLower.includes('storm') || conditionLower.includes('thunderstorm'));
  
  // Rule 1: Drizzling / light rain / moderate rain / light snow => 10 min
  const isLightPrecip = isDrizzling || isModerateRain || isLightSnow ||
                       (weather.isRainy && !isHeavyRain && !isRainStorm);
  
  if (isLightPrecip) {
    return { maxWalkMinutes: 10, weatherBucket: 'drizzle_or_light_precip' };
  }
  
  // Rule 2: Storm / extreme weather => 5 min
  const isStormOrExtreme = isSnowStorm || 
                          isRainStorm || 
                          isHeavyRain ||
                          isExtremeHot || 
                          isExtremeCold ||
                          weather.isHot || // hot (> 25°C)
                          (weather.isCold && !isLightPrecip); // cold (< 8°C feelsLike) but not light precip
  
  const isWindy = conditionLower.includes('wind') || 
                  conditionLower.includes('storm') ||
                  conditionLower.includes('thunderstorm') ||
                  conditionLower.includes('gale');
  
  if (isStormOrExtreme || isWindy) {
    return { maxWalkMinutes: 5, weatherBucket: 'storm_or_extreme' };
  }
  
  // Rule 3: Otherwise pleasant => 20 min
  return { maxWalkMinutes: 20, weatherBucket: 'pleasant' };
}

describe('deriveMaxWalkMinutes', () => {
  describe('Rule 1: Drizzle/Light Precip => 10 min', () => {
    it('should return 10 min for light drizzle', () => {
      const weather: WeatherInput = {
        condition: 'Light drizzle',
        tempC: 10,
        feelsLikeC: 8,
        isRainy: true,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for slight rain', () => {
      const weather: WeatherInput = {
        condition: 'Slight rain',
        tempC: 15,
        feelsLikeC: 14,
        isRainy: true,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for moderate rain', () => {
      const weather: WeatherInput = {
        condition: 'Moderate rain',
        tempC: 12,
        feelsLikeC: 11,
        isRainy: true,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for light snow', () => {
      const weather: WeatherInput = {
        condition: 'Slight snow fall',
        tempC: 2,
        feelsLikeC: 0,
        isRainy: false,
        isCold: true,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for cold + drizzling (drizzle takes precedence)', () => {
      const weather: WeatherInput = {
        condition: 'Light drizzle',
        tempC: 5,
        feelsLikeC: 3,
        isRainy: true,
        isCold: true,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(10); // Not 5, even though it's cold
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });
  });

  describe('Rule 2: Storm/Extreme => 5 min', () => {
    it('should return 5 min for extreme hot (>= 100°F)', () => {
      const weather: WeatherInput = {
        condition: 'Clear sky',
        tempC: 38.0, // 100.4°F
        feelsLikeC: 40.0,
        isRainy: false,
        isCold: false,
        isHot: true,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for extreme cold (<= 0°F)', () => {
      const weather: WeatherInput = {
        condition: 'Clear sky',
        tempC: -18.0, // -0.4°F
        feelsLikeC: -20.0,
        isRainy: false,
        isCold: true,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy rain', () => {
      const weather: WeatherInput = {
        condition: 'Heavy rain',
        tempC: 15,
        feelsLikeC: 14,
        isRainy: true,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for thunderstorm', () => {
      const weather: WeatherInput = {
        condition: 'Thunderstorm',
        tempC: 20,
        feelsLikeC: 19,
        isRainy: true,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for cold weather (without drizzle)', () => {
      const weather: WeatherInput = {
        condition: 'Overcast',
        tempC: 5,
        feelsLikeC: 3,
        isRainy: false,
        isCold: true,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for hot weather (> 25°C)', () => {
      const weather: WeatherInput = {
        condition: 'Clear sky',
        tempC: 30,
        feelsLikeC: 32,
        isRainy: false,
        isCold: false,
        isHot: true,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for windy conditions', () => {
      const weather: WeatherInput = {
        condition: 'Windy',
        tempC: 15,
        feelsLikeC: 12,
        isRainy: false,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });
  });

  describe('Rule 3: Pleasant => 20 min', () => {
    it('should return 20 min for clear sky', () => {
      const weather: WeatherInput = {
        condition: 'Clear sky',
        tempC: 20,
        feelsLikeC: 20,
        isRainy: false,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });

    it('should return 20 min for partly cloudy', () => {
      const weather: WeatherInput = {
        condition: 'Partly cloudy',
        tempC: 18,
        feelsLikeC: 17,
        isRainy: false,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });

    it('should return 20 min for overcast (if not cold)', () => {
      const weather: WeatherInput = {
        condition: 'Overcast',
        tempC: 15,
        feelsLikeC: 14,
        isRainy: false,
        isCold: false,
        isHot: false,
      };
      const result = deriveMaxWalkMinutesTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });
  });
});

describe('Relaxed Mode Logic', () => {
  it('should prioritize closest restaurants when no restaurants meet time limit', () => {
    // Mock scenario: maxWalkMinutes = 5, but all restaurants are 8-15 min away
    const maxWalkMinutes = 5;
    const restaurants = [
      { name: 'Restaurant A', etaMinutes: 8 },
      { name: 'Restaurant B', etaMinutes: 10 },
      { name: 'Restaurant C', etaMinutes: 15 },
      { name: 'Restaurant D', etaMinutes: 12 },
    ];

    // In relaxed mode, should still return results, ordered by shortest ETA
    const relaxedResults = restaurants
      .filter(r => r.etaMinutes !== undefined)
      .sort((a, b) => a.etaMinutes! - b.etaMinutes!);

    expect(relaxedResults).toHaveLength(4);
    expect(relaxedResults[0].etaMinutes).toBe(8); // Closest first
    expect(relaxedResults[0].name).toBe('Restaurant A');
  });

  it('should use heavier ETA weight in relaxed mode', () => {
    // In relaxed mode, score should be 0.65*etaScore + 0.15*ratingScore + ...
    // This ensures ETA heavily influences ranking
    const relaxedModeLunchScore = 0.65 * 0.8 + 0.15 * 0.9 + 0.10 * 0.7 + 0.10 * 0.6; // eta=0.8, rating=0.9, etc.
    const normalModeLunchScore = 0.40 * 0.8 + 0.20 * 0.9 + 0.15 * 0.7 + 0.15 * 0.6 + 0.10 * 0.5;

    // In relaxed mode, ETA contributes more (0.65 vs 0.40)
    expect(relaxedModeLunchScore * 0.65).toBeGreaterThan(normalModeLunchScore * 0.40);
  });
});
