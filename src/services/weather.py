"""
Weather service using Open-Meteo API
No API key required - completely free weather data
API Documentation: https://open-meteo.com/en/docs
"""

from typing import TypedDict
import requests


class WeatherResponse(TypedDict):
    """Normalized weather response format"""
    temperatureC: float
    feelsLikeC: float
    isCold: bool
    isHot: bool
    isRainy: bool
    isWindy: bool


def get_current_weather(latitude: float, longitude: float) -> WeatherResponse:
    """
    Fetches current weather data from Open-Meteo API
    
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
    
    Returns:
        Normalized weather data
    
    Raises:
        Exception: If API request fails
    """
    url = 'https://api.open-meteo.com/v1/forecast'
    
    params = {
        'latitude': latitude,
        'longitude': longitude,
        'current': 'temperature_2m,apparent_temperature,precipitation,rain,wind_speed_10m'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if 'current' not in data:
            raise ValueError('Invalid response format from Open-Meteo API')
        
        return normalize_weather_data(data['current'])
    except requests.RequestException as e:
        raise Exception(f'Failed to fetch weather data: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse weather data: {str(e)}')


def normalize_weather_data(current: dict) -> WeatherResponse:
    """
    Normalizes Open-Meteo API response to our standard format
    
    Args:
        current: Current weather data from Open-Meteo API
    
    Returns:
        Normalized weather response
    """
    temperature_c = current.get('temperature_2m', 0)
    feels_like_c = current.get('apparent_temperature', 0)
    rain = current.get('rain', 0) or 0
    precipitation = current.get('precipitation', 0) or 0
    wind_speed = current.get('wind_speed_10m', 0)
    
    return {
        'temperatureC': temperature_c,
        'feelsLikeC': feels_like_c,
        'isCold': feels_like_c < 8,
        'isHot': temperature_c > 25,
        'isRainy': rain > 0 or precipitation > 0,
        'isWindy': wind_speed > 15
    }
