/**
 * Google Places API service
 * Provides restaurant search, details, photos, and reviews
 * API Documentation: https://developers.google.com/maps/documentation/places/web-service
 */

/**
 * @typedef {Object} Place
 * @property {string} placeId - Google Place ID
 * @property {string} name - Restaurant name
 * @property {string} address - Formatted address
 * @property {Object} location - Location coordinates
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {number} [rating] - Rating (0-5)
 * @property {number} [userRatingTotal] - Total number of ratings
 * @property {number} [priceLevel] - Price level (0-4)
 * @property {string[]} types - Place types
 * @property {string[]} [photos] - Photo reference IDs
 */

/**
 * @typedef {Object} PlaceDetails
 * @extends Place
 * @property {string} [phoneNumber] - Formatted phone number
 * @property {string} [website] - Website URL
 * @property {Object} [openingHours] - Opening hours information
 * @property {boolean} openingHours.openNow - Whether open now
 * @property {string[]} [openingHours.weekdayText] - Opening hours text
 * @property {Array} [reviews] - Array of reviews
 */

/**
 * @typedef {Object} PlacesSearchResponse
 * @property {Place[]} places - Array of places
 * @property {string} [nextPageToken] - Token for next page of results
 */

/**
 * Searches for restaurants near coordinates using nearby search
 * @param {string} apiKey - Google Maps API key
 * @param {Object} location - Latitude and longitude
 * @param {number} location.lat - Latitude
 * @param {number} location.lng - Longitude
 * @param {number} [radius=5000] - Search radius in meters (max 50000)
 * @param {string} [keyword='restaurant'] - Optional keyword filter
 * @param {string} [nextPageToken] - Optional token for pagination
 * @returns {Promise<PlacesSearchResponse>} Search results with restaurant places
 */
async function searchNearbyRestaurants(apiKey, location, radius = 5000, keyword = 'restaurant', nextPageToken) {
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
 * Searches for restaurants using text search
 * @param {string} apiKey - Google Maps API key
 * @param {string} query - Search query (e.g., "restaurants near [location]")
 * @param {Object} [location] - Optional lat/lng for location biasing
 * @param {number} [radius] - Optional radius in meters
 * @param {string} [nextPageToken] - Optional token for pagination
 * @returns {Promise<PlacesSearchResponse>} Search results with restaurant places
 */
async function searchRestaurants(apiKey, query, location, radius, nextPageToken) {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('query', query);
  url.searchParams.set('type', 'restaurant');
  
  if (location) {
    url.searchParams.set('location', `${location.lat},${location.lng}`);
    if (radius) {
      url.searchParams.set('radius', Math.min(radius, 50000).toString());
    }
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

    return normalizeTextSearchResponse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search restaurants: ${error.message}`);
    }
    throw new Error('Failed to search restaurants: Unknown error');
  }
}

/**
 * Gets detailed information about a place by place ID
 * @param {string} apiKey - Google Maps API key
 * @param {string} placeId - Place ID from search results
 * @returns {Promise<PlaceDetails>} Detailed place information
 */
async function getPlaceDetails(apiKey, placeId) {
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
function normalizeNearbySearchResponse(data) {
  const places = (data.results || []).map((result) => ({
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
    photos: result.photos?.map((photo) => photo.photo_reference) || [],
  }));

  return {
    places,
    nextPageToken: data.next_page_token,
  };
}

/**
 * Normalizes Google Places Text Search API response
 */
function normalizeTextSearchResponse(data) {
  const places = (data.results || []).map((result) => ({
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
    photos: result.photos?.map((photo) => photo.photo_reference) || [],
  }));

  return {
    places,
    nextPageToken: data.next_page_token,
  };
}

/**
 * Normalizes Google Places Details API response
 */
function normalizePlaceDetails(result) {
  const place = {
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
    photos: result.photos?.map((photo) => photo.photo_reference) || [],
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
    place.reviews = result.reviews.map((review) => ({
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
 * @param {string} apiKey - Google Maps API key
 * @param {string} photoReference - Photo reference from place data
 * @param {number} [maxWidth=400] - Maximum width in pixels
 * @returns {string} URL to the photo
 */
function getPhotoUrl(apiKey, photoReference, maxWidth = 400) {
  return `https://maps.googleapis.com/maps/api/place/photo?key=${apiKey}&photo_reference=${photoReference}&maxwidth=${maxWidth}`;
}

module.exports = {
  searchNearbyRestaurants,
  searchRestaurants,
  getPlaceDetails,
  getPhotoUrl,
};
