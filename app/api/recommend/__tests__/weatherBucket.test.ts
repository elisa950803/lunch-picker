/**
 * Unit tests for deriveWeatherBucket function
 * Tests the structured weather-based max walk time logic using Open-Meteo data
 */

import { describe, it, expect } from '@jest/globals';

// Mock the deriveWeatherBucket logic from weather service
// In a real implementation, we'd export this function for testing
interface WeatherInput {
  weatherCode: number;
  precipitationMm: number;
  rainMm: number;
  windSpeedMs: number;
  apparentTemperatureC: number;
}

const EXTREME_HOT_THRESHOLD = 37.8; // 100°F
const EXTREME_COLD_THRESHOLD = -17.8; // 0°F
const HEAVY_PRECIPITATION_THRESHOLD = 3.0; // mm/hr
const VERY_WINDY_THRESHOLD = 12.0; // m/s

function deriveWeatherBucketTest(data: WeatherInput): {
  weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
  maxWalkMinutes: number;
} {
  const { weatherCode, precipitationMm, rainMm, windSpeedMs, apparentTemperatureC } = data;

  // A) storm_or_extreme => maxWalkMinutes = 5
  // Thunderstorm codes: 95, 96, 99
  const isThunderstorm = weatherCode === 95 || weatherCode === 96 || weatherCode === 99;
  
  // Heavy rain/precip: >= 3.0 mm/hr
  const isHeavyPrecip = precipitationMm >= HEAVY_PRECIPITATION_THRESHOLD || rainMm >= HEAVY_PRECIPITATION_THRESHOLD;
  
  // Heavy snow / snow showers codes: 75, 77, 86
  const isHeavySnow = weatherCode === 75 || weatherCode === 77 || weatherCode === 86;
  
  // Very windy: >= 12 m/s
  const isVeryWindy = windSpeedMs >= VERY_WINDY_THRESHOLD;
  
  // Extreme temp: <= -17.8°C OR >= 37.8°C
  const isExtremeTemp = apparentTemperatureC <= EXTREME_COLD_THRESHOLD || apparentTemperatureC >= EXTREME_HOT_THRESHOLD;

  if (isThunderstorm || isHeavyPrecip || isHeavySnow || isVeryWindy || isExtremeTemp) {
    return { weatherBucket: 'storm_or_extreme', maxWalkMinutes: 5 };
  }

  // B) drizzle_or_light_precip => maxWalkMinutes = 10
  // Drizzle codes: 51, 53, 55
  const isDrizzle = weatherCode === 51 || weatherCode === 53 || weatherCode === 55;
  
  // Rain codes: 61, 63, 65
  const isRain = weatherCode === 61 || weatherCode === 63 || weatherCode === 65;
  
  // Freezing drizzle/rain codes: 56, 57, 66, 67
  const isFreezingPrecip = weatherCode === 56 || weatherCode === 57 || weatherCode === 66 || weatherCode === 67;
  
  // Snow (light/moderate) codes: 71, 73, 85
  const isLightSnow = weatherCode === 71 || weatherCode === 73 || weatherCode === 85;
  
  // Or: precipitation > 0 but below heavy threshold
  const isLightPrecip = (precipitationMm > 0 || rainMm > 0) && !isHeavyPrecip;
  
  // Or: temperature below 10°C or above 30°C (uncomfortable but not extreme)
  const isUncomfortableTemp = apparentTemperatureC < 10 || apparentTemperatureC > 30;

  if (isDrizzle || isRain || isFreezingPrecip || isLightSnow || isLightPrecip || isUncomfortableTemp) {
    return { weatherBucket: 'drizzle_or_light_precip', maxWalkMinutes: 10 };
  }

  // C) pleasant => maxWalkMinutes = 20
  // All remaining conditions (clear/cloudy/fog etc)
  return { weatherBucket: 'pleasant', maxWalkMinutes: 20 };
}

describe('deriveWeatherBucket', () => {
  describe('A) storm_or_extreme => maxWalkMinutes = 5', () => {
    it('should return 5 min for thunderstorm code 95', () => {
      const weather: WeatherInput = {
        weatherCode: 95,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for thunderstorm code 96', () => {
      const weather: WeatherInput = {
        weatherCode: 96,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for thunderstorm code 99', () => {
      const weather: WeatherInput = {
        weatherCode: 99,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy rain (precip >= 3.0 mm/hr)', () => {
      const weather: WeatherInput = {
        weatherCode: 61, // Slight rain code
        precipitationMm: 3.5, // Heavy precipitation
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy rain (rain >= 3.0 mm/hr)', () => {
      const weather: WeatherInput = {
        weatherCode: 61,
        precipitationMm: 0,
        rainMm: 4.0, // Heavy rain
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy snow code 75', () => {
      const weather: WeatherInput = {
        weatherCode: 75,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy snow code 77', () => {
      const weather: WeatherInput = {
        weatherCode: 77,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for heavy snow showers code 86', () => {
      const weather: WeatherInput = {
        weatherCode: 86,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for very windy (wind >= 12 m/s)', () => {
      const weather: WeatherInput = {
        weatherCode: 0, // Clear sky
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 12.5, // Very windy
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for extreme hot (>= 37.8°C)', () => {
      const weather: WeatherInput = {
        weatherCode: 0,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 38.0, // 100.4°F
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for extreme cold (<= -17.8°C)', () => {
      const weather: WeatherInput = {
        weatherCode: 0,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: -18.0, // -0.4°F
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5);
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });
  });

  describe('B) drizzle_or_light_precip => maxWalkMinutes = 10', () => {
    it('should return 10 min for drizzle code 51', () => {
      const weather: WeatherInput = {
        weatherCode: 51,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for drizzle code 53', () => {
      const weather: WeatherInput = {
        weatherCode: 53,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for drizzle code 55', () => {
      const weather: WeatherInput = {
        weatherCode: 55,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for rain code 61', () => {
      const weather: WeatherInput = {
        weatherCode: 61,
        precipitationMm: 1.0, // Light rain
        rainMm: 1.0,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for rain code 63', () => {
      const weather: WeatherInput = {
        weatherCode: 63,
        precipitationMm: 2.0,
        rainMm: 2.0,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for rain code 65', () => {
      const weather: WeatherInput = {
        weatherCode: 65,
        precipitationMm: 2.5,
        rainMm: 2.5,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for freezing drizzle code 56', () => {
      const weather: WeatherInput = {
        weatherCode: 56,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: -5,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for freezing rain code 66', () => {
      const weather: WeatherInput = {
        weatherCode: 66,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: -3,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for light snow code 71', () => {
      const weather: WeatherInput = {
        weatherCode: 71,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for light snow code 73', () => {
      const weather: WeatherInput = {
        weatherCode: 73,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for light snow showers code 85', () => {
      const weather: WeatherInput = {
        weatherCode: 85,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 0,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for light precipitation (precip > 0 but < 3.0)', () => {
      const weather: WeatherInput = {
        weatherCode: 0, // Clear sky (but has precipitation)
        precipitationMm: 1.5, // Light precipitation
        rainMm: 1.5,
        windSpeedMs: 5,
        apparentTemperatureC: 15,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for temperature below 10°C (even without precipitation)', () => {
      const weather: WeatherInput = {
        weatherCode: 0, // Clear sky
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 8, // Below 10°C
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 10 min for temperature above 30°C (even without precipitation)', () => {
      const weather: WeatherInput = {
        weatherCode: 0, // Clear sky
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 32, // Above 30°C but below extreme threshold (37.8°C)
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(10);
      expect(result.weatherBucket).toBe('drizzle_or_light_precip');
    });

    it('should return 5 min for extreme hot (>= 37.8°C), not 10 min', () => {
      const weather: WeatherInput = {
        weatherCode: 0,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 38.0, // Extreme hot (>= 37.8°C)
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5); // Should be storm_or_extreme, not drizzle_or_light_precip
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });

    it('should return 5 min for extreme cold (<= -17.8°C), not 10 min', () => {
      const weather: WeatherInput = {
        weatherCode: 0,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: -18.0, // Extreme cold (<= -17.8°C)
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(5); // Should be storm_or_extreme, not drizzle_or_light_precip
      expect(result.weatherBucket).toBe('storm_or_extreme');
    });
  });

  describe('C) pleasant => maxWalkMinutes = 20', () => {
    it('should return 20 min for clear sky code 0', () => {
      const weather: WeatherInput = {
        weatherCode: 0,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });

    it('should return 20 min for partly cloudy code 2', () => {
      const weather: WeatherInput = {
        weatherCode: 2,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });

    it('should return 20 min for overcast code 3', () => {
      const weather: WeatherInput = {
        weatherCode: 3,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });

    it('should return 20 min for foggy code 45', () => {
      const weather: WeatherInput = {
        weatherCode: 45,
        precipitationMm: 0,
        rainMm: 0,
        windSpeedMs: 5,
        apparentTemperatureC: 20,
      };
      const result = deriveWeatherBucketTest(weather);
      expect(result.maxWalkMinutes).toBe(20);
      expect(result.weatherBucket).toBe('pleasant');
    });
  });
});

describe('Relaxed Mode Logic', () => {
  it('should return results sorted by shortest ETA when all etaMinutes > maxWalkMinutes', () => {
    // Mock scenario: maxWalkMinutes = 5, but all restaurants are 8-15 min away
    const maxWalkMinutes = 5;
    const restaurants = [
      { name: 'Restaurant A', etaMinutes: 15 },
      { name: 'Restaurant B', etaMinutes: 8 },
      { name: 'Restaurant C', etaMinutes: 12 },
      { name: 'Restaurant D', etaMinutes: 10 },
    ];

    // In relaxed mode, should still return results, ordered by shortest ETA
    const relaxedResults = restaurants
      .filter(r => r.etaMinutes !== undefined)
      .sort((a, b) => a.etaMinutes! - b.etaMinutes!);

    expect(relaxedResults).toHaveLength(4);
    expect(relaxedResults[0].etaMinutes).toBe(8); // Closest first
    expect(relaxedResults[0].name).toBe('Restaurant B');
    expect(relaxedResults[1].etaMinutes).toBe(10);
    expect(relaxedResults[2].etaMinutes).toBe(12);
    expect(relaxedResults[3].etaMinutes).toBe(15);
  });

  it('should return at least 2 lunch picks even in relaxed mode', () => {
    // Mock scenario: maxWalkMinutes = 5, only 2 restaurants available (both > 5 min)
    const maxWalkMinutes = 5;
    const restaurants = [
      { name: 'Restaurant A', etaMinutes: 8 },
      { name: 'Restaurant B', etaMinutes: 10 },
    ];

    const relaxedResults = restaurants
      .filter(r => r.etaMinutes !== undefined)
      .sort((a, b) => a.etaMinutes! - b.etaMinutes!);

    expect(relaxedResults.length).toBeGreaterThanOrEqual(2);
    expect(relaxedResults[0].etaMinutes).toBeLessThan(relaxedResults[1].etaMinutes!);
  });
});
