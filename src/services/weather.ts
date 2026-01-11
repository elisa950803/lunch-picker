/**
 * Weather service using Open-Meteo API
 * No API key required - completely free weather data
 * API Documentation: https://open-meteo.com/en/docs
 */

export interface WeatherResponse {
  temperatureC: number;
  feelsLikeC: number;
  isCold: boolean;
  isHot: boolean;
  isRainy: boolean;
  isWindy: boolean;
}

interface OpenMeteoForecastResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    wind_speed_10m: number;
  };
}

/**
 * Fetches current weather data from Open-Meteo API
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Normalized weather data
 * @throws Error if API request fails
 */
export async function getCurrentWeather(
  latitude: number,
  longitude: number
): Promise<WeatherResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,precipitation,rain,wind_speed_10m');

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Open-Meteo API error: ${response.status} ${response.statusText}`
      );
    }

    const data: OpenMeteoForecastResponse = await response.json();

    if (!data.current) {
      throw new Error('Invalid response format from Open-Meteo API');
    }

    return normalizeWeatherData(data.current);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
    throw new Error('Failed to fetch weather data: Unknown error');
  }
}

/**
 * Normalizes Open-Meteo API response to our standard format
 * @param current - Current weather data from Open-Meteo
 * @returns Normalized weather response
 */
function normalizeWeatherData(current: OpenMeteoForecastResponse['current']): WeatherResponse {
  const temperatureC = current.temperature_2m;
  const feelsLikeC = current.apparent_temperature;
  const rain = current.rain ?? 0;
  const precipitation = current.precipitation ?? 0;
  const windSpeed = current.wind_speed_10m;

  return {
    temperatureC,
    feelsLikeC,
    isCold: feelsLikeC < 8,
    isHot: temperatureC > 25,
    isRainy: rain > 0 || precipitation > 0,
    isWindy: windSpeed > 15
  };
}
