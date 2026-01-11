"""
Calendarific API service
Provides holiday information to help adjust restaurant recommendations
API Documentation: https://calendarific.com/api-documentation
"""

from typing import TypedDict, List, Optional, Union
import requests
from datetime import datetime


class Holiday(TypedDict):
    """Holiday information"""
    name: str
    description: str
    date: dict
    type: str
    locations: List[str]


class HolidaysResponse(TypedDict):
    """Normalized holidays response format"""
    holidays: List[Holiday]
    isHoliday: bool
    holidayNames: List[str]


def get_holidays(
    api_key: str,
    country_code: str,
    year: int,
    month: Optional[int] = None,
    day: Optional[int] = None
) -> HolidaysResponse:
    """
    Gets holidays for a specific country and date/year
    
    Args:
        api_key: Calendarific API key from environment variable
        country_code: ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
        year: Year to get holidays for
        month: Optional month (1-12)
        day: Optional day (1-31)
    
    Returns:
        Holidays data for the specified date/year
    
    Raises:
        Exception: If API request fails or API key is missing
    """
    if not api_key:
        raise ValueError('Calendarific API key is required. Set CALENDARIFIC_API_KEY environment variable.')
    
    if not country_code or not year:
        raise ValueError('Country code and year are required.')
    
    url = 'https://calendarific.com/api/v2/holidays'
    
    params = {
        'api_key': api_key,
        'country': country_code,
        'year': year
    }
    
    if month:
        params['month'] = month
    if day:
        params['day'] = day
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        meta = data.get('meta', {})
        if meta.get('code') != 200:
            error_detail = meta.get('error_detail', 'Unknown error')
            code = meta.get('code', 'Unknown')
            raise ValueError(f'Calendarific API error: {code} - {error_detail}')
        
        return normalize_holidays_data(data)
    except requests.RequestException as e:
        raise Exception(f'Failed to fetch holidays data: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse holidays data: {str(e)}')


def get_today_holidays(api_key: str, country_code: str) -> HolidaysResponse:
    """
    Gets holidays for today's date
    
    Args:
        api_key: Calendarific API key
        country_code: ISO 3166-1 alpha-2 country code
    
    Returns:
        Holidays data for today
    """
    today = datetime.now()
    year = today.year
    month = today.month
    day = today.day
    
    return get_holidays(api_key, country_code, year, month, day)


def is_holiday(
    api_key: str,
    country_code: str,
    year: int,
    month: int,
    day: int
) -> bool:
    """
    Checks if a specific date is a holiday
    
    Args:
        api_key: Calendarific API key
        country_code: ISO 3166-1 alpha-2 country code
        year: Year
        month: Month (1-12)
        day: Day (1-31)
    
    Returns:
        True if the date is a holiday
    """
    result = get_holidays(api_key, country_code, year, month, day)
    return result['isHoliday']


def normalize_holidays_data(data: dict) -> HolidaysResponse:
    """
    Normalizes Calendarific API response to our standard format
    
    Args:
        data: Raw response from Calendarific API
    
    Returns:
        Normalized holidays response
    """
    response_data = data.get('response', {})
    holidays = response_data.get('holidays', [])
    
    holiday_names = [h.get('name', 'Unknown Holiday') for h in holidays]
    
    normalized_holidays = []
    for holiday in holidays:
        locations_str = holiday.get('locations', '')
        locations = locations_str.split(', ') if locations_str else []
        
        normalized_holidays.append({
            'name': holiday.get('name', 'Unknown Holiday'),
            'description': holiday.get('description', ''),
            'date': holiday.get('date', {}),
            'type': holiday.get('type', ['unknown'])[0] if holiday.get('type') else 'unknown',
            'locations': locations
        })
    
    return {
        'holidays': normalized_holidays,
        'isHoliday': len(holidays) > 0,
        'holidayNames': holiday_names
    }
