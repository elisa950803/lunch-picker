/**
 * Google Places API service
 * Provides restaurant search, details, photos, and reviews
 * API Documentation: https://developers.google.com/maps/documentation/places/web-service
 */

export interface Place {
  placeId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  userRatingTotal?: number;
  priceLevel?: number; // 0-4, where 0 is free and 4 is very expensive
  types: string[];
  photos?: string[]; // Photo reference IDs
}

export interface PlaceDetails extends Place {
  phoneNumber?: string;
  website?: string;
  openingHours?: {
    openNow: boolean;
    weekdayText?: string[];
  };
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativeTimeDescription: string;
  }>;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
}

export interface PlacesSearchResponse {
  places: Place[];
  nextPageToken?: string;
}

/**
 * Searches for restaurants near a location using Google Places API (Text Search)
 * @param apiKey - Google Maps API key
 * @param query - Search query (e.g., "restaurants near [location]")
 * @param location - Optional lat/lng for location biasing
 * @param radius - Optional radius in meters (max 50000)
 * @param nextPageToken - Optional token for pagination
 * @returns Search results with restaurant places
 */
export async function searchRestaurants(
  apiKey: string,
  query: string,
  location?: { lat: number; lng: number },
  radius?: number,
  nextPageToken?: string
): Promise<PlacesSearchResponse> {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  const url = new URL('https://places.googleapis.com/v1/places:searchText');
  
  const requestBody: any = {
    textQuery: query,
    maxResultCount: 20,
  };

  if (location) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radius || 5000,
      },
    };
  }

  if (nextPageToken) {
    requestBody.pageToken = nextPageToken;
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google Places API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    return normalizePlacesSearchResponse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search restaurants: ${error.message}`);
    }
    throw new Error('Failed to search restaurants: Unknown error');
  }
}

/**
 * Searches for restaurants near coordinates using nearby search (legacy API, more compatible)
 * @param apiKey - Google Maps API key
 * @param location - Latitude and longitude
 * @param radius - Search radius in meters (max 50000, default 5000)
 * @param keyword - Optional keyword filter (e.g., "restaurant")
 * @param nextPageToken - Optional token for pagination
 * @returns Search results with restaurant places
 */
export async function searchNearbyRestaurants(
  apiKey: string,
  location: { lat: number; lng: number },
  radius: number = 5000,
  keyword: string = 'restaurant',
  nextPageToken?: string
): Promise<PlacesSearchResponse> {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location', `${location.lat},${location.lng}`);
  url.searchParams.set('radius', Math.min(radius, 50000).toString());
  url.searchParams.set('type', 'restaurant');
  
  if (keyword) {
    url.searchParams.set('keyword', keyword);
  }
  
  if (nextPageToken) {
    url.searchParams.set('pagetoken', nextPageToken);
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Google Places API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status === 'REQUEST_DENIED') {
      throw new Error(`Google Places API error: ${data.error_message || 'Request denied. Check your API key and permissions.'}`);
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Google Places API error: Over query limit. Please check your billing and quotas.');
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    return normalizeNearbySearchResponse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search nearby restaurants: ${error.message}`);
    }
    throw new Error('Failed to search nearby restaurants: Unknown error');
  }
}

/**
 * Gets detailed information about a place by place ID
 * @param apiKey - Google Maps API key
 * @param placeId - Place ID from search results
 * @returns Detailed place information
 */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<PlaceDetails> {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  if (!placeId) {
    throw new Error('Place ID is required.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', [
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
  ].join(','));

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Google Places API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    if (!data.result) {
      throw new Error('Invalid response format from Google Places API');
    }

    return normalizePlaceDetails(data.result);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get place details: ${error.message}`);
    }
    throw new Error('Failed to get place details: Unknown error');
  }
}

/**
 * Normalizes Google Places Nearby Search API response
 */
function normalizeNearbySearchResponse(data: any): PlacesSearchResponse {
  const places: Place[] = (data.results || []).map((result: any) => ({
    placeId: result.place_id,
    name: result.name,
    address: result.vicinity || result.formatted_address || '',
    location: {
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
    },
    rating: result.rating,
    userRatingTotal: result.user_ratings_total,
    priceLevel: result.price_level,
    types: result.types || [],
    photos: result.photos?.map((photo: any) => photo.photo_reference) || [],
  }));

  return {
    places,
    nextPageToken: data.next_page_token,
  };
}

/**
 * Normalizes Google Places Text Search API response
 */
function normalizePlacesSearchResponse(data: any): PlacesSearchResponse {
  const places: Place[] = (data.places || []).map((place: any) => ({
    placeId: place.id,
    name: place.displayName?.text || place.name || '',
    address: place.formattedAddress || '',
    location: {
      lat: place.location?.latitude || 0,
      lng: place.location?.longitude || 0,
    },
    rating: place.rating,
    userRatingTotal: place.userRatingCount,
    priceLevel: place.priceLevel,
    types: place.types || [],
    photos: place.photos?.map((photo: any) => photo.name) || [],
  }));

  return {
    places,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Normalizes Google Places Details API response
 */
function normalizePlaceDetails(result: any): PlaceDetails {
  const place: PlaceDetails = {
    placeId: result.place_id,
    name: result.name,
    address: result.formatted_address || result.vicinity || '',
    location: {
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
    },
    rating: result.rating,
    userRatingTotal: result.user_ratings_total,
    priceLevel: result.price_level,
    types: result.types || [],
    photos: result.photos?.map((photo: any) => photo.photo_reference) || [],
    phoneNumber: result.formatted_phone_number,
    internationalPhoneNumber: result.international_phone_number,
    website: result.website,
    formattedAddress: result.formatted_address,
  };

  if (result.opening_hours) {
    place.openingHours = {
      openNow: result.opening_hours.open_now || false,
      weekdayText: result.opening_hours.weekday_text,
    };
  }

  if (result.reviews) {
    place.reviews = result.reviews.map((review: any) => ({
      authorName: review.author_name,
      rating: review.rating,
      text: review.text,
      relativeTimeDescription: review.relative_time_description,
    }));
  }

  return place;
}

/**
 * Gets a photo URL from a photo reference
 * @param apiKey - Google Maps API key
 * @param photoReference - Photo reference from place data
 * @param maxWidth - Maximum width in pixels (default 400)
 * @returns URL to the photo
 */
export function getPhotoUrl(
  apiKey: string,
  photoReference: string,
  maxWidth: number = 400
): string {
  return `https://maps.googleapis.com/maps/api/place/photo?key=${apiKey}&photo_reference=${photoReference}&maxwidth=${maxWidth}`;
}
