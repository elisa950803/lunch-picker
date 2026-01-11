"""
Google Places API service
Provides restaurant search, details, photos, and reviews
API Documentation: https://developers.google.com/maps/documentation/places/web-service
"""

from typing import TypedDict, List, Optional, Dict, Any
import requests


class Location(TypedDict):
    """Location coordinates"""
    lat: float
    lng: float


class Place(TypedDict, total=False):
    """Place information"""
    placeId: str
    name: str
    address: str
    location: Location
    rating: float
    userRatingTotal: int
    priceLevel: int  # 0-4, where 0 is free and 4 is very expensive
    types: List[str]
    photos: List[str]  # Photo reference IDs


class OpeningHours(TypedDict, total=False):
    """Opening hours information"""
    openNow: bool
    weekdayText: List[str]


class Review(TypedDict):
    """Review information"""
    authorName: str
    rating: int
    text: str
    relativeTimeDescription: str


class PlaceDetails(Place, total=False):
    """Detailed place information"""
    phoneNumber: str
    internationalPhoneNumber: str
    website: str
    openingHours: OpeningHours
    reviews: List[Review]
    formattedAddress: str


class PlacesSearchResponse(TypedDict, total=False):
    """Places search response"""
    places: List[Place]
    nextPageToken: Optional[str]


def search_nearby_restaurants(
    api_key: str,
    location: Location,
    radius: int = 5000,
    keyword: str = 'restaurant',
    next_page_token: Optional[str] = None
) -> PlacesSearchResponse:
    """
    Searches for restaurants near coordinates using nearby search
    
    Args:
        api_key: Google Maps API key
        location: Latitude and longitude
        radius: Search radius in meters (max 50000, default 5000)
        keyword: Optional keyword filter
        next_page_token: Optional token for pagination
    
    Returns:
        Search results with restaurant places
    
    Raises:
        Exception: If API request fails
    """
    if not api_key:
        raise ValueError('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.')

    url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
    
    params = {
        'key': api_key,
        'location': f"{location['lat']},{location['lng']}",
        'radius': str(min(radius, 50000)),
        'type': 'restaurant',
    }
    
    if keyword:
        params['keyword'] = keyword
    
    if next_page_token:
        params['pagetoken'] = next_page_token

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') == 'REQUEST_DENIED':
            error_msg = data.get('error_message', 'Request denied. Check your API key and permissions.')
            raise ValueError(f'Google Places API error: {error_msg}')
        if data.get('status') == 'OVER_QUERY_LIMIT':
            raise ValueError('Google Places API error: Over query limit. Please check your billing and quotas.')
        if data.get('status') not in ('OK', 'ZERO_RESULTS'):
            error_msg = data.get('error_message', 'Unknown error')
            raise ValueError(f'Google Places API error: {data.get("status")} - {error_msg}')
        
        return normalize_nearby_search_response(data)
    except requests.RequestException as e:
        raise Exception(f'Failed to search nearby restaurants: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse search results: {str(e)}')


def search_restaurants(
    api_key: str,
    query: str,
    location: Optional[Location] = None,
    radius: Optional[int] = None,
    next_page_token: Optional[str] = None
) -> PlacesSearchResponse:
    """
    Searches for restaurants using text search
    
    Args:
        api_key: Google Maps API key
        query: Search query (e.g., "restaurants near [location]")
        location: Optional lat/lng for location biasing
        radius: Optional radius in meters
        next_page_token: Optional token for pagination
    
    Returns:
        Search results with restaurant places
    
    Raises:
        Exception: If API request fails
    """
    if not api_key:
        raise ValueError('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.')

    url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
    
    params = {
        'key': api_key,
        'query': query,
        'type': 'restaurant',
    }
    
    if location:
        params['location'] = f"{location['lat']},{location['lng']}"
        if radius:
            params['radius'] = str(min(radius, 50000))
    
    if next_page_token:
        params['pagetoken'] = next_page_token

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') == 'REQUEST_DENIED':
            error_msg = data.get('error_message', 'Request denied. Check your API key and permissions.')
            raise ValueError(f'Google Places API error: {error_msg}')
        if data.get('status') == 'OVER_QUERY_LIMIT':
            raise ValueError('Google Places API error: Over query limit. Please check your billing and quotas.')
        if data.get('status') not in ('OK', 'ZERO_RESULTS'):
            error_msg = data.get('error_message', 'Unknown error')
            raise ValueError(f'Google Places API error: {data.get("status")} - {error_msg}')
        
        return normalize_text_search_response(data)
    except requests.RequestException as e:
        raise Exception(f'Failed to search restaurants: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse search results: {str(e)}')


def get_place_details(api_key: str, place_id: str) -> PlaceDetails:
    """
    Gets detailed information about a place by place ID
    
    Args:
        api_key: Google Maps API key
        place_id: Place ID from search results
    
    Returns:
        Detailed place information
    
    Raises:
        Exception: If API request fails
    """
    if not api_key:
        raise ValueError('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.')

    if not place_id:
        raise ValueError('Place ID is required.')

    url = 'https://maps.googleapis.com/maps/api/place/details/json'
    
    params = {
        'key': api_key,
        'place_id': place_id,
        'fields': ','.join([
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'rating',
            'user_ratings_total',
            'price_level',
            'types',
            'photos',
            'formatted_phone_number',
            'international_phone_number',
            'website',
            'opening_hours',
            'reviews'
        ]),
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 'OK':
            error_msg = data.get('error_message', 'Unknown error')
            raise ValueError(f'Google Places API error: {data.get("status")} - {error_msg}')
        
        if 'result' not in data:
            raise ValueError('Invalid response format from Google Places API')
        
        return normalize_place_details(data['result'])
    except requests.RequestException as e:
        raise Exception(f'Failed to get place details: {str(e)}')
    except (KeyError, ValueError) as e:
        raise Exception(f'Failed to parse place details: {str(e)}')


def normalize_nearby_search_response(data: Dict[str, Any]) -> PlacesSearchResponse:
    """Normalizes Google Places Nearby Search API response"""
    places = []
    for result in data.get('results', []):
        geometry = result.get('geometry', {})
        location_data = geometry.get('location', {})
        
        place: Place = {
            'placeId': result.get('place_id', ''),
            'name': result.get('name', ''),
            'address': result.get('vicinity') or result.get('formatted_address', ''),
            'location': {
                'lat': location_data.get('lat', 0),
                'lng': location_data.get('lng', 0),
            },
            'rating': result.get('rating'),
            'userRatingTotal': result.get('user_ratings_total'),
            'priceLevel': result.get('price_level'),
            'types': result.get('types', []),
            'photos': [photo.get('photo_reference') for photo in result.get('photos', []) if photo.get('photo_reference')],
        }
        places.append(place)
    
    return {
        'places': places,
        'nextPageToken': data.get('next_page_token'),
    }


def normalize_text_search_response(data: Dict[str, Any]) -> PlacesSearchResponse:
    """Normalizes Google Places Text Search API response"""
    places = []
    for result in data.get('results', []):
        geometry = result.get('geometry', {})
        location_data = geometry.get('location', {})
        
        place: Place = {
            'placeId': result.get('place_id', ''),
            'name': result.get('name', ''),
            'address': result.get('formatted_address') or result.get('vicinity', ''),
            'location': {
                'lat': location_data.get('lat', 0),
                'lng': location_data.get('lng', 0),
            },
            'rating': result.get('rating'),
            'userRatingTotal': result.get('user_ratings_total'),
            'priceLevel': result.get('price_level'),
            'types': result.get('types', []),
            'photos': [photo.get('photo_reference') for photo in result.get('photos', []) if photo.get('photo_reference')],
        }
        places.append(place)
    
    return {
        'places': places,
        'nextPageToken': data.get('next_page_token'),
    }


def normalize_place_details(result: Dict[str, Any]) -> PlaceDetails:
    """Normalizes Google Places Details API response"""
    geometry = result.get('geometry', {})
    location_data = geometry.get('location', {})
    
    place: PlaceDetails = {
        'placeId': result.get('place_id', ''),
        'name': result.get('name', ''),
        'address': result.get('formatted_address') or result.get('vicinity', ''),
        'location': {
            'lat': location_data.get('lat', 0),
            'lng': location_data.get('lng', 0),
        },
        'rating': result.get('rating'),
        'userRatingTotal': result.get('user_ratings_total'),
        'priceLevel': result.get('price_level'),
        'types': result.get('types', []),
        'photos': [photo.get('photo_reference') for photo in result.get('photos', []) if photo.get('photo_reference')],
        'phoneNumber': result.get('formatted_phone_number'),
        'internationalPhoneNumber': result.get('international_phone_number'),
        'website': result.get('website'),
        'formattedAddress': result.get('formatted_address'),
    }
    
    if result.get('opening_hours'):
        opening_hours = result['opening_hours']
        place['openingHours'] = {
            'openNow': opening_hours.get('open_now', False),
            'weekdayText': opening_hours.get('weekday_text'),
        }
    
    if result.get('reviews'):
        place['reviews'] = [
            {
                'authorName': review.get('author_name', ''),
                'rating': review.get('rating', 0),
                'text': review.get('text', ''),
                'relativeTimeDescription': review.get('relative_time_description', ''),
            }
            for review in result['reviews']
        ]
    
    return place


def get_photo_url(api_key: str, photo_reference: str, max_width: int = 400) -> str:
    """
    Gets a photo URL from a photo reference
    
    Args:
        api_key: Google Maps API key
        photo_reference: Photo reference from place data
        max_width: Maximum width in pixels (default 400)
    
    Returns:
        URL to the photo
    """
    return f'https://maps.googleapis.com/maps/api/place/photo?key={api_key}&photo_reference={photo_reference}&maxwidth={max_width}'
