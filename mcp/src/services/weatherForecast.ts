/**
 * Weather Forecast Service using Open-Meteo API
 * Supports both current and future forecasts
 */

export interface ForecastResponse {
  tempC: number;
  feelsLikeC: number;
  precipitationProb: number;
  condition: string;
  isCold: boolean;
  isHot: boolean;
  isRainy: boolean;
  // Structured fields for weather-based routing
  temperatureC: number;
  feelsLikeC_temp: number; // Same as feelsLikeC, for clarity
  precipitationMm: number;
  rainMm: number;
  windSpeedMs: number;
  weatherCode: number;
  weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
  maxWalkMinutes: number;
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    precipitation_probability?: number;
    weather_code?: number;
    precipitation?: number;
    rain?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    weather_code: number[];
    precipitation: number[];
    rain: number[];
    wind_speed_10m?: number[];
  };
}

const WEATHER_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

/**
 * Gets weather forecast for a specific location and time
 * @param lat - Latitude
 * @param lng - Longitude
 * @param whenISO - ISO 8601 date-time string (e.g., "2024-01-15T12:00:00Z")
 * @returns Forecast data
 */
export async function getForecast(
  lat: number,
  lng: number,
  whenISO: string
): Promise<ForecastResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());

  const targetDate = new Date(whenISO);
  const now = new Date();
  const isFuture = targetDate > now;

  // Always request hourly data for flexibility (include wind_speed_10m)
  url.searchParams.set('hourly', 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,precipitation,rain,wind_speed_10m');
  
  if (isFuture) {
    // Set forecast dates
    const startDate = now.toISOString().split('T')[0];
    const endDate = targetDate.toISOString().split('T')[0];
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
  } else {
    // For past/current, get today's data
    const today = now.toISOString().split('T')[0];
    url.searchParams.set('start_date', today);
    url.searchParams.set('end_date', today);
  }
  
  // Also get current data as fallback (include wind_speed_10m)
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,precipitation,rain,wind_speed_10m');

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Open-Meteo API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json() as OpenMeteoForecastResponse;

    // Try to use hourly data if available and target is in the future
    if (data.hourly && data.hourly.time && data.hourly.time.length > 0) {
      // Find the closest hour to target time
      const targetTimeStr = targetDate.toISOString();
      const targetHour = targetTimeStr.substring(0, 13) + ':00'; // Round to nearest hour
      
      let hourIndex = data.hourly.time.findIndex(time => time === targetHour);
      
      // If exact match not found, find the closest one
      if (hourIndex === -1) {
        hourIndex = data.hourly.time.findIndex(time => time.startsWith(targetTimeStr.substring(0, 13)));
      }
      
      // If still not found, use the time closest to target
      if (hourIndex === -1) {
        const targetTimestamp = targetDate.getTime();
        let closestIndex = 0;
        let closestDiff = Infinity;
        
        for (let i = 0; i < data.hourly.time.length; i++) {
          const timeTimestamp = new Date(data.hourly.time[i]).getTime();
          const diff = Math.abs(timeTimestamp - targetTimestamp);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestIndex = i;
          }
        }
        hourIndex = closestIndex;
      }
      
      if (hourIndex >= 0 && hourIndex < data.hourly.temperature_2m.length) {
        return normalizeForecast({
          temperature_2m: data.hourly.temperature_2m[hourIndex],
          apparent_temperature: data.hourly.apparent_temperature[hourIndex],
          precipitation_probability: data.hourly.precipitation_probability?.[hourIndex] || 0,
          weather_code: data.hourly.weather_code[hourIndex],
          precipitation: data.hourly.precipitation?.[hourIndex] || 0,
          rain: data.hourly.rain?.[hourIndex] || 0,
          wind_speed_10m: data.hourly.wind_speed_10m?.[hourIndex] || 0,
        });
      }
    }

    // Fallback to current weather if hourly data not available or target is current/very recent
    if (data.current) {
      return normalizeForecast({
        ...data.current,
        wind_speed_10m: data.current.wind_speed_10m ?? 0,
      });
    }

    throw new Error('Invalid response format from Open-Meteo API: no current or hourly data');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch weather forecast: ${error.message}`);
    }
    throw new Error('Failed to fetch weather forecast: Unknown error');
  }
}

function normalizeForecast(data: {
  temperature_2m: number;
  apparent_temperature: number;
  precipitation_probability?: number;
  weather_code?: number;
  precipitation?: number;
  rain?: number;
  wind_speed_10m?: number;
}): ForecastResponse {
  const tempC = data.temperature_2m;
  const feelsLikeC = data.apparent_temperature;
  const precipitationProb = data.precipitation_probability ?? 0;
  const weatherCode = data.weather_code ?? 0;
  const condition = WEATHER_CONDITIONS[weatherCode] || 'Unknown';
  const rainMm = data.rain ?? 0;
  const precipitationMm = data.precipitation ?? 0;
  const windSpeedMs = data.wind_speed_10m ?? 0;

  // Derive weather bucket and maxWalkMinutes using structured fields
  const { weatherBucket, maxWalkMinutes } = deriveWeatherBucket({
    weatherCode,
    precipitationMm,
    rainMm,
    windSpeedMs,
    apparentTemperatureC: feelsLikeC,
  });

  return {
    tempC,
    feelsLikeC,
    precipitationProb,
    condition,
    isCold: feelsLikeC < 8,
    isHot: tempC > 25,
    isRainy: rainMm > 0 || precipitationMm > 0 || precipitationProb > 50,
    // Structured fields
    temperatureC: tempC,
    feelsLikeC_temp: feelsLikeC,
    precipitationMm,
    rainMm,
    windSpeedMs,
    weatherCode,
    weatherBucket,
    maxWalkMinutes,
  };
}

/**
 * Derive weather bucket and maxWalkMinutes from structured Open-Meteo data
 */
function deriveWeatherBucket(data: {
  weatherCode: number;
  precipitationMm: number;
  rainMm: number;
  windSpeedMs: number;
  apparentTemperatureC: number;
}): { weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant'; maxWalkMinutes: number } {
  const { weatherCode, precipitationMm, rainMm, windSpeedMs, apparentTemperatureC } = data;

  // Temperature thresholds (Celsius)
  const EXTREME_HOT_THRESHOLD = 37.8; // 100°F
  const EXTREME_COLD_THRESHOLD = -17.8; // 0°F

  // Heavy precipitation threshold (mm/hr)
  const HEAVY_PRECIPITATION_THRESHOLD = 3.0;
  // Very windy threshold (m/s)
  const VERY_WINDY_THRESHOLD = 12.0;

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
