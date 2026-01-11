/**
 * Weather service using Open-Meteo API
 * No API key required - completely free weather data
 * API Documentation: https://open-meteo.com/en/docs
 */

/**
 * @typedef {Object} WeatherResponse
 * @property {number} temperatureC - Temperature in Celsius
 * @property {number} feelsLikeC - Apparent temperature (feels like) in Celsius
 * @property {boolean} isCold - Whether it feels cold (feelsLikeC < 8)
 * @property {boolean} isHot - Whether it's hot (temperatureC > 25)
 * @property {boolean} isRainy - Whether it's raining (rain > 0 OR precipitation > 0)
 * @property {boolean} isWindy - Whether it's windy (wind_speed_10m > 15)
 */

/**
 * Fetches current weather data from Open-Meteo API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<WeatherResponse>} Normalized weather data
 * @throws {Error} If API request fails
 */
async function getCurrentWeather(latitude, longitude) {
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

    const data = await response.json();

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
 * @param {Object} current - Current weather data from Open-Meteo
 * @returns {WeatherResponse} Normalized weather response
 */
function normalizeWeatherData(current) {
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

module.exports = {
  getCurrentWeather,
  normalizeWeatherData
};
