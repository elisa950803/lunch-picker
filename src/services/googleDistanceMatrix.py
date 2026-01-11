"""
Google Distance Matrix API service
Calculates travel times and distances between origins and destinations
API Documentation: https://developers.google.com/maps/documentation/distance-matrix
"""

from typing import TypedDict, List, Union, Optional, Dict, Any
import requests


class Location(TypedDict):
    """Location coordinates"""
    lat: float
    lng: float


class Distance(TypedDict):
    """Distance information"""
    text: str  # Human-readable distance (e.g., "1.2 km")
    value: int  # Distance in meters


class Duration(TypedDict):
    """Duration information"""
    text: str  # Human-readable duration (e.g., "15 mins")
    value: int  # Duration in seconds


class DistanceMatrixElement(TypedDict):
    """Distance matrix element"""
    distance: Distance
    duration: Duration
    status: str  # "OK", "NOT_FOUND", "ZERO_RESULTS", etc.


class DistanceMatrixRow(TypedDict):
    """Distance matrix row"""
    elements: List[DistanceMatrixElement]


class DistanceMatrixResponse(TypedDict):
    """Distance matrix response"""
    originAddresses: List[str]
    destinationAddresses: List[str]
    rows: List[DistanceMatrixRow]


class TravelTimeResult(TypedDict):
    """Travel time result from origin to destination"""
    destination: Union[Location, str]
    distance: Distance
    duration: Duration
    status: str


def get_distance_matrix(
    api_key: str,
    origins: List[Union[Location, str]],
    destinations: List[Union[Location, str]],
    mode: str = 'driving',
    departure_time: Optional[int] = None,
    traffic_model: Optional[str] = None
) -> DistanceMatrixResponse:
    """
    Calculates travel times and distances from origin(s) to destination(s)
    
    Args:
        api_key: Google Maps API key
        origins: List of origin locations (lat/lng objects or place IDs or addresses)
        destinations: List of destination locations (lat/lng objects or place IDs or addresses)
        mode: Travel mode: 'driving', 'walking', 'bicycling', 'transit' (default: 'driving')
        departure_time: Optional departure time (Unix timestamp). Required for transit mode.
        traffic_model: Optional traffic model: 'best_guess', 'pessimistic', 'optimistic' (only for driving)
    
    Returns:
        Distance matrix with travel times and distances
    
    Raises:
        Exception: If API request fails
    """
    if not api_key:
        raise ValueError('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.')

    if not origins or len(origins) == 0:
        raise ValueError('At least one origin is required.')

    if not destinations or len(destinations) == 0:
        raise ValueError('At least one destination is required.')

    # Google Distance Matrix API supports up to 25 origins or 25 destinations per request
    if len(origins) > 25:
        raise ValueError('Maximum 25 origins per request. Please batch your requests.')
    
    if len(destinations) > 25:
        raise ValueError('Maximum 25 destinations per request. Please batch your requests.')

    url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
    
    params = {
        'key': api_key,
        'origins': '|'.join([
            f"{origin['lat']},{origin['lng']}" if isinstance(origin, dict) else origin
            for origin in origins
        ]),
        'destinations': '|'.join([
            f"{dest['lat']},{dest['lng']}" if isinstance(dest, dict) else dest
            for dest in destinations
        ]),
        'mode': mode,
        'units': 'metric',  # Use metric units (km, meters)
    }
    
    if departure_time:
        params['departure_time'] = str(departure_time)
    
    if traffic_model and mode == 'driving':
        params['traffic_model'] = traffic_model

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') == 'REQUEST_DENIED':
            error_msg = data.get('error_message', 'Request denied. Check your API key and permissions.')
            raise ValueError(f'Google Distance Matrix API error: {error_msg}')
        if data.get('status') == 'OVER_QUERY_LIMIT':
            raise ValueError('Google Distance Matrix API error: Over query limit. Please check your billing and quotas.')
        if data.get('status') == 'INVALID_REQUEST':
            error_msg = data.get('error_message', 'Check your parameters.')
            raise ValueError(f'Google Distance Matrix API error: Invalid request - {error_msg}')
        if data.get('status') != 'OK':
            error_msg = data.get('error_message', 'Unknown error')
            raise ValueError(f'Google Distance Matrix API error: {data.get("status")} - {error_msg}')
        
        return normalize_distance_matrix_response(data)
    except requests.RequestException as e:
        raise Exception(f'Failed to get distance matrix: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse distance matrix: {str(e)}')


def get_travel_times_from_origin(
    api_key: str,
    origin: Union[Location, str],
    destinations: List[Union[Location, str]],
    mode: str = 'driving',
    departure_time: Optional[int] = None
) -> List[TravelTimeResult]:
    """
    Gets travel time from a single origin to multiple destinations (common use case for restaurant recommendations)
    
    Args:
        api_key: Google Maps API key
        origin: Origin location (e.g., work location)
        destinations: List of destination locations (e.g., restaurant locations)
        mode: Travel mode (default: 'driving')
        departure_time: Optional departure time for traffic-aware routing
    
    Returns:
        List of travel times and distances from origin to each destination
    
    Raises:
        Exception: If API request fails
    """
    result = get_distance_matrix(api_key, [origin], destinations, mode, departure_time)
    
    if not result.get('rows') or not result['rows'][0].get('elements'):
        return []
    
    return [
        {
            'destination': destinations[i],
            'distance': element['distance'],
            'duration': element['duration'],
            'status': element['status'],
        }
        for i, element in enumerate(result['rows'][0]['elements'])
    ]


def normalize_distance_matrix_response(data: Dict[str, Any]) -> DistanceMatrixResponse:
    """Normalizes Google Distance Matrix API response"""
    rows = []
    for row in data.get('rows', []):
        elements = []
        for element in row.get('elements', []):
            elements.append({
                'distance': {
                    'text': element.get('distance', {}).get('text', ''),
                    'value': element.get('distance', {}).get('value', 0),
                },
                'duration': {
                    'text': element.get('duration', {}).get('text', ''),
                    'value': element.get('duration', {}).get('value', 0),
                },
                'status': element.get('status', 'UNKNOWN'),
            })
        rows.append({'elements': elements})
    
    return {
        'originAddresses': data.get('origin_addresses', []),
        'destinationAddresses': data.get('destination_addresses', []),
        'rows': rows,
    }
