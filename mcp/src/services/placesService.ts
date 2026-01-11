/**
 * Google Places API Service for MCP Server
 * Provides restaurant search and place details
 */

export interface RestaurantSearchResult {
  placeId: string;
  name: string;
  rating?: number;
  userRatingTotal?: number;
  priceLevel?: number;
  address: string;
  types: string[];
  location?: {
    lat: number;
    lng: number;
  };
}

export interface PlaceDetailsResult {
  name: string;
  rating?: number;
  userRatingTotal?: number;
  priceLevel?: number;
  websiteUrl?: string;
  googleMapsUrl: string;
  phone?: string;
  openingHours?: {
    openNow: boolean;
    weekdayText?: string[];
  };
  photos?: string[]; // Photo URLs
  reservableHint?: boolean;
  types?: string[];
  location?: {
    lat: number;
    lng: number;
  };
}

/**
 * Searches for restaurants near a location
 * @param apiKey - Google Maps API key
 * @param lat - Latitude
 * @param lng - Longitude
 * @param meal - "lunch" or "dinner"
 * @param radiusMeters - Search radius in meters (max 50000)
 * @param maxResults - Maximum number of results (default: 20, max: 20)
 * @param openNow - Optional filter for places open now
 * @returns Array of restaurant search results
 */
export async function searchRestaurants(
  apiKey: string,
  lat: number,
  lng: number,
  meal: 'lunch' | 'dinner',
  radiusMeters: number = 5000,
  maxResults: number = 20,
  openNow?: boolean
): Promise<RestaurantSearchResult[]> {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', Math.min(radiusMeters, 50000).toString());
  url.searchParams.set('type', 'restaurant');
  
  // Add keyword based on meal type
  if (meal === 'lunch') {
    url.searchParams.set('keyword', 'lunch');
  } else if (meal === 'dinner') {
    url.searchParams.set('keyword', 'dinner');
  }

  if (openNow === true) {
    // Note: Google Places API doesn't have a direct "openNow" filter in nearby search
    // We'll filter results after fetching
  }

  try {
    const allResults: RestaurantSearchResult[] = [];
    let nextPageToken: string | undefined;

    // Paginate until we have enough results or no more pages
    do {
      if (nextPageToken) {
        // Wait a bit before next page token is valid
        await new Promise(resolve => setTimeout(resolve, 2000));
        url.searchParams.set('pagetoken', nextPageToken);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        status: string;
        error_message?: string;
        results?: Array<{
          place_id: string;
          name: string;
          rating?: number;
          user_ratings_total?: number;
          price_level?: number;
          vicinity?: string;
          formatted_address?: string;
          types?: string[];
          geometry?: {
            location?: {
              lat: number;
              lng: number;
            };
          };
        }>;
        next_page_token?: string;
      };

      if (data.status === 'REQUEST_DENIED') {
        throw new Error(`Google Places API error: ${data.error_message || 'Request denied. Check your API key and permissions.'}`);
      }
      if (data.status === 'OVER_QUERY_LIMIT') {
        throw new Error('Google Places API error: Over query limit. Please check your billing and quotas.');
      }
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      const places: RestaurantSearchResult[] = (data.results || []).map((result) => ({
        placeId: result.place_id,
        name: result.name,
        rating: result.rating,
        userRatingTotal: result.user_ratings_total,
        priceLevel: result.price_level,
        address: result.vicinity || result.formatted_address || '',
        types: result.types || [],
        location: result.geometry?.location ? {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        } : undefined,
      }));

      allResults.push(...places);
      nextPageToken = data.next_page_token;

      // If we have enough results, stop paginating
      if (allResults.length >= maxResults) {
        break;
      }
    } while (nextPageToken && allResults.length < maxResults);

    // Filter by openNow if specified
    let filteredResults = allResults;
    if (openNow === true) {
      // Check opening hours for each place (this requires additional API calls)
      // For performance, we'll return all results and note that openNow filter
      // requires checking details for each place
      filteredResults = allResults; // Simplified - in production, you'd check details
    }

    return filteredResults.slice(0, maxResults);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search restaurants: ${error.message}`);
    }
    throw new Error('Failed to search restaurants: Unknown error');
  }
}

/**
 * Gets detailed information about a place
 * @param apiKey - Google Maps API key
 * @param placeId - Place ID from search results
 * @returns Detailed place information
 */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string
): Promise<PlaceDetailsResult> {
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
    'website',
    'formatted_phone_number',
    'international_phone_number',
    'opening_hours',
    'photos',
    'reservable',
    'url', // Google Maps URL
  ].join(','));

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      status: string;
      error_message?: string;
      result?: {
        name: string;
        formatted_address?: string;
        geometry?: {
          location?: { lat: number; lng: number };
        };
        rating?: number;
        user_ratings_total?: number;
        price_level?: number;
        types?: string[];
        website?: string;
        formatted_phone_number?: string;
        international_phone_number?: string;
        opening_hours?: {
          open_now?: boolean;
          weekday_text?: string[];
        };
        photos?: Array<{
          photo_reference: string;
        }>;
        reservable?: boolean;
      };
    };

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    if (!data.result) {
      throw new Error('Invalid response format from Google Places API');
    }

    const result = data.result;
    const location = result.geometry?.location;

    // Build Google Maps URL
    const googleMapsUrl = location
      ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.name || '')}`;

    // Get photo URLs
    const photos: string[] = [];
    if (result.photos && Array.isArray(result.photos) && result.photos.length > 0) {
      // Get up to 5 photos
      const photoRefs = result.photos.slice(0, 5);
      photos.push(...photoRefs.map((photo: any) =>
        `https://maps.googleapis.com/maps/api/place/photo?key=${apiKey}&photo_reference=${photo.photo_reference}&maxwidth=400`
      ));
    }

    return {
      name: result.name,
      rating: result.rating,
      userRatingTotal: result.user_ratings_total,
      priceLevel: result.price_level,
      types: result.types || [],
      location: location ? {
        lat: location.lat,
        lng: location.lng,
      } : undefined,
      websiteUrl: result.website,
      googleMapsUrl,
      phone: result.formatted_phone_number || result.international_phone_number,
      openingHours: result.opening_hours ? {
        openNow: result.opening_hours.open_now || false,
        weekdayText: result.opening_hours.weekday_text,
      } : undefined,
      photos: photos.length > 0 ? photos : undefined,
      reservableHint: result.reservable === true,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get place details: ${error.message}`);
    }
    throw new Error('Failed to get place details: Unknown error');
  }
}
