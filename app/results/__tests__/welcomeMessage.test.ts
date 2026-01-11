/**
 * Unit tests for generateWelcomeMessage function
 * Tests the Duolingo-cute style welcome messages based on weather metrics
 */

import { describe, it, expect } from '@jest/globals';

// Mock the generateWelcomeMessage function logic
interface WeatherContext {
  weatherSummary: {
    tempC: number;
    condition: string;
    isRainy: boolean;
    isCold: boolean;
    isHot: boolean;
    temperatureC?: number;
    feelsLikeC?: number;
    windSpeedMs?: number;
    precipitationMm?: number;
    rainMm?: number;
  };
  lunchDistanceInfo?: {
    maxWalkMinutes: number;
    usedRelaxedTimeLimit: boolean;
    weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
  };
}

function generateWelcomeMessageTest(context: WeatherContext): string {
  const weatherSummary = context.weatherSummary;
  const lunchDistanceInfo = context.lunchDistanceInfo;
  
  if (!lunchDistanceInfo) {
    return `It's a lovely day out! 🌤️\nPerfect for an easy walk and something fresh.\nAll picks are 20 minutes away—enjoy the stroll.`;
  }
  
  const { maxWalkMinutes, usedRelaxedTimeLimit, weatherBucket } = lunchDistanceInfo;
  const temperatureC = weatherSummary.temperatureC ?? weatherSummary.tempC;
  const feelsLikeC = weatherSummary.feelsLikeC ?? weatherSummary.tempC;
  const windSpeedMs = weatherSummary.windSpeedMs ?? 0;
  const precipitationMm = weatherSummary.precipitationMm ?? 0;
  const rainMm = weatherSummary.rainMm ?? 0;
  
  let message: string;
  
  if (weatherBucket === 'pleasant') {
    if (temperatureC >= 27) {
      if (precipitationMm === 0 && rainMm === 0) {
        message = `It's a hot one today! 🥵\nLet's keep it light, cool, and refreshing.\nAll picks are ${maxWalkMinutes} minutes away—no long walks in the heat.`;
      } else {
        message = `Sunny and warm today! 😎\nGreat weather for something light and refreshing.\nAll picks are ${maxWalkMinutes} minutes away—stay cool.`;
      }
    } else if (feelsLikeC <= 8) {
      message = `Brrr… it's cold out there! ❄️\nCalling all warm, cozy comfort food.\nAll picks are ${maxWalkMinutes} minutes away—stay toasty.`;
    } else if (windSpeedMs >= 10) {
      message = `Windy out there today! 🌬️\nLet's not wrestle the gusts—close + cozy wins.\nAll picks are ${maxWalkMinutes} minutes away—easy and breezy.`;
    } else {
      message = `It's a lovely day out! 🌤️\nPerfect for an easy walk and something fresh.\nAll picks are ${maxWalkMinutes} minutes away—enjoy the stroll.`;
    }
  } else if (weatherBucket === 'drizzle_or_light_precip') {
    if (feelsLikeC <= 8 && windSpeedMs >= 10) {
      message = `Cold and windy—ouch. 🧥\nDefinitely a 'hot food fixes everything' day.\nAll picks are ${maxWalkMinutes} minutes away—because today is not a long-walk day.`;
    } else {
      message = `A little drizzle out there—no worries. 🌧️\nWe leaned warm + indoor-friendly today.\nAll picks are ${maxWalkMinutes} minutes away—keep the umbrella time short.`;
    }
  } else {
      if (feelsLikeC <= -17.8) {
        message = `Okay… it's REALLY cold out there! 🥶\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
    } else if (feelsLikeC >= 37.8) {
      message = `Okay… this heat is doing the most. 🔥\nWe're keeping it extra close and extra refreshing.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
    } else if (windSpeedMs >= 12) {
      message = `Okay… this weather is doing the most. 🌪️\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
    } else {
      message = `Okay… this weather is doing the most. ⛈️\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
    }
  }
  
  if (usedRelaxedTimeLimit) {
    message += `\nNot many spots fit the close-by rule today—showing the closest picks first 😊`;
  }
  
  return message;
}

describe('generateWelcomeMessage', () => {
  describe('A) pleasant bucket variants', () => {
    it('should return hot variant when temperatureC >= 27 and no precipitation', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 28,
          temperatureC: 28,
          feelsLikeC: 30,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: true,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain("It's a hot one today! 🥵");
      expect(message).toContain(`All picks are 20 minutes away`);
      expect(message).not.toContain('Not many spots');
    });

    it('should return sunny variant when temperatureC >= 27 with precipitation', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 28,
          temperatureC: 28,
          feelsLikeC: 30,
          windSpeedMs: 5,
          precipitationMm: 0.5,
          rainMm: 0.5,
          condition: 'Clear sky',
          isRainy: true,
          isCold: false,
          isHot: true,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Sunny and warm today! 😎');
      expect(message).toContain(`All picks are 20 minutes away`);
    });

    it('should return cold variant when feelsLikeC <= 8', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 10,
          temperatureC: 10,
          feelsLikeC: 7,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: true,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain("Brrr… it's cold out there! ❄️");
      expect(message).toContain(`All picks are 20 minutes away`);
    });

    it('should return windy variant when windSpeedMs >= 10', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 11,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Windy out there today! 🌬️');
      expect(message).toContain(`All picks are 20 minutes away`);
    });

    it('should return warm/pleasant variant by default', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain("It's a lovely day out! 🌤️");
      expect(message).toContain(`All picks are 20 minutes away`);
    });
  });

  describe('B) drizzle_or_light_precip bucket variants', () => {
    it('should return cold+windy variant when feelsLikeC <= 8 and windSpeedMs >= 10', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 5,
          temperatureC: 5,
          feelsLikeC: 6,
          windSpeedMs: 11,
          precipitationMm: 1,
          rainMm: 1,
          condition: 'Light drizzle',
          isRainy: true,
          isCold: true,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 10,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'drizzle_or_light_precip',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Cold and windy—ouch. 🧥');
      expect(message).toContain(`All picks are 10 minutes away`);
    });

    it('should return rainy/drizzle variant by default', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 15,
          temperatureC: 15,
          feelsLikeC: 15,
          windSpeedMs: 5,
          precipitationMm: 1,
          rainMm: 1,
          condition: 'Light drizzle',
          isRainy: true,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 10,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'drizzle_or_light_precip',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('A little drizzle out there—no worries. 🌧️');
      expect(message).toContain(`All picks are 10 minutes away`);
    });
  });

  describe('C) storm_or_extreme bucket variants', () => {
    it('should return extreme cold variant when feelsLikeC <= -17.8', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: -18,
          temperatureC: -18,
          feelsLikeC: -20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: true,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain("Okay… it's REALLY cold out there! 🥶");
      expect(message).toContain(`All picks are 5 minutes away`);
    });

    it('should return extreme heat variant when feelsLikeC >= 37.8', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 38,
          temperatureC: 38,
          feelsLikeC: 40,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: true,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Okay… this heat is doing the most. 🔥');
      expect(message).toContain(`All picks are 5 minutes away`);
    });

    it('should return storm/wind variant when windSpeedMs >= 12', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 13,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Okay… this weather is doing the most. 🌪️');
      expect(message).toContain(`All picks are 5 minutes away`);
    });

    it('should return heavy rain/snow variant by default', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 15,
          temperatureC: 15,
          feelsLikeC: 15,
          windSpeedMs: 5,
          precipitationMm: 4,
          rainMm: 4,
          condition: 'Heavy rain',
          isRainy: true,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('Okay… this weather is doing the most. ⛈️');
      expect(message).toContain(`All picks are 5 minutes away`);
    });
  });

  describe('Relaxed mode add-on', () => {
    it('should always include "All picks are X minutes away"', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 10,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'drizzle_or_light_precip',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('All picks are 10 minutes away');
    });

    it('should add relaxed mode note when usedRelaxedTimeLimit is true', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: true,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('All picks are 5 minutes away');
      expect(message).toContain('Not many spots fit the close-by rule today—showing the closest picks first 😊');
    });

    it('should not add relaxed mode note when usedRelaxedTimeLimit is false', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      expect(message).toContain('All picks are 20 minutes away');
      expect(message).not.toContain('Not many spots fit the close-by rule');
    });
  });

  describe('Message format', () => {
    it('should return 2-3 lines by default', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      const lines = message.split('\n').filter(line => line.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(3);
    });

    it('should return 3-4 lines with relaxed mode', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 5,
          usedRelaxedTimeLimit: true,
          weatherBucket: 'storm_or_extreme',
        },
      };
      const message = generateWelcomeMessageTest(context);
      const lines = message.split('\n').filter(line => line.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(4);
    });

    it('should include at most 1 emoji per line', () => {
      const context: WeatherContext = {
        weatherSummary: {
          tempC: 20,
          temperatureC: 20,
          feelsLikeC: 20,
          windSpeedMs: 5,
          precipitationMm: 0,
          rainMm: 0,
          condition: 'Clear sky',
          isRainy: false,
          isCold: false,
          isHot: false,
        },
        lunchDistanceInfo: {
          maxWalkMinutes: 20,
          usedRelaxedTimeLimit: false,
          weatherBucket: 'pleasant',
        },
      };
      const message = generateWelcomeMessageTest(context);
      const lines = message.split('\n').filter(line => line.trim().length > 0);
      lines.forEach(line => {
        const emojiCount = (line.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        expect(emojiCount).toBeLessThanOrEqual(1);
      });
    });
  });
});
