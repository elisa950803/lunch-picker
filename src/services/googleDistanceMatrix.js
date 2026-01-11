/**
 * Google Distance Matrix API service
 * Calculates travel times and distances between origins and destinations
 * API Documentation: https://developers.google.com/maps/documentation/distance-matrix
 */

/**
 * @typedef {Object} Location
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 */

/**
 * @typedef {Object} DistanceMatrixElement
 * @property {Object} distance - Distance information
 * @property {string} distance.text - Human-readable distance (e.g., "1.2 km")
 * @property {number} distance.value - Distance in meters
 * @property {Object} duration - Duration information
 * @property {string} duration.text - Human-readable duration (e.g., "15 mins")
 * @property {number} duration.value - Duration in seconds
 * @property {string} status - Status: "OK", "NOT_FOUND", "ZERO_RESULTS", etc.
 */

/**
 * Calculates travel times and distances from origin(s) to destination(s)
 * @param {string} apiKey - Google Maps API key
 * @param {Array<Location|string>} origins - Array of origin locations (lat/lng objects or place IDs or addresses)
 * @param {Array<Location|string>} destinations - Array of destination locations (lat/lng objects or place IDs or addresses)
 * @param {string} [mode='driving'] - Travel mode: 'driving' | 'walking' | 'bicycling' | 'transit'
 * @param {number} [departureTime] - Optional departure time (Unix timestamp). Required for transit mode.
 * @param {string} [trafficModel] - Optional traffic model: 'best_guess' | 'pessimistic' | 'optimistic' (only for driving)
 * @returns {Promise<Object>} Distance matrix with travel times and distances
 */
async function getDistanceMatrix(apiKey, origins, destinations, mode = 'driving', departureTime, trafficModel) {
  if (!apiKey) {
    throw new Error('Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.');
  }

  if (!origins || origins.length === 0) {
    throw new Error('At least one origin is required.');
  }

  if (!destinations || destinations.length === 0) {
    throw new Error('At least one destination is required.');
  }

  // Google Distance Matrix API supports up to 25 origins or 25 destinations per request
  if (origins.length > 25) {
    throw new Error('Maximum 25 origins per request. Please batch your requests.');
  }

  if (destinations.length > 25) {
    throw new Error('Maximum 25 destinations per request. Please batch your requests.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('key', apiKey);
  
  // Format origins
  const originsStr = origins.map(origin => 
    typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`
  ).join('|');
  url.searchParams.set('origins', originsStr);
  
  // Format destinations
  const destinationsStr = destinations.map(dest => 
    typeof dest === 'string' ? dest : `${dest.lat},${dest.lng}`
  ).join('|');
  url.searchParams.set('destinations', destinationsStr);
  
  url.searchParams.set('mode', mode);
  url.searchParams.set('units', 'metric'); // Use metric units (km, meters)
  
  if (departureTime) {
    url.searchParams.set('departure_time', departureTime.toString());
  }
  
  if (trafficModel && mode === 'driving') {
    url.searchParams.set('traffic_model', trafficModel);
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Google Distance Matrix API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status === 'REQUEST_DENIED') {
      throw new Error(
        `Google Distance Matrix API error: ${data.error_message || 'Request denied. Check your API key and permissions.'}`
      );
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error('Google Distance Matrix API error: Over query limit. Please check your billing and quotas.');
    }
    if (data.status === 'INVALID_REQUEST') {
      throw new Error(`Google Distance Matrix API error: Invalid request - ${data.error_message || 'Check your parameters.'}`);
    }
    if (data.status !== 'OK') {
      throw new Error(`Google Distance Matrix API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    return normalizeDistanceMatrixResponse(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get distance matrix: ${error.message}`);
    }
    throw new Error('Failed to get distance matrix: Unknown error');
  }
}

/**
 * Gets travel time from a single origin to multiple destinations (common use case for restaurant recommendations)
 * @param {string} apiKey - Google Maps API key
 * @param {Location|string} origin - Origin location (e.g., work location)
 * @param {Array<Location|string>} destinations - Array of destination locations (e.g., restaurant locations)
 * @param {string} [mode='driving'] - Travel mode (default: 'driving')
 * @param {number} [departureTime] - Optional departure time for traffic-aware routing
 * @returns {Promise<Array>} Array of travel times and distances from origin to each destination
 */
async function getTravelTimesFromOrigin(apiKey, origin, destinations, mode = 'driving', departureTime) {
  const result = await getDistanceMatrix(apiKey, [origin], destinations, mode, departureTime);
  
  if (result.rows.length === 0 || result.rows[0].elements.length === 0) {
    return [];
  }

  return result.rows[0].elements.map((element, index) => ({
    destination: destinations[index],
    distance: element.distance,
    duration: element.duration,
    status: element.status,
  }));
}

/**
 * Normalizes Google Distance Matrix API response
 */
function normalizeDistanceMatrixResponse(data) {
  return {
    originAddresses: data.origin_addresses || [],
    destinationAddresses: data.destination_addresses || [],
    rows: (data.rows || []).map((row) => ({
      elements: (row.elements || []).map((element) => ({
        distance: {
          text: element.distance?.text || '',
          value: element.distance?.value || 0,
        },
        duration: {
          text: element.duration?.text || '',
          value: element.duration?.value || 0,
        },
        status: element.status || 'UNKNOWN',
      })),
    })),
  };
}

module.exports = {
  getDistanceMatrix,
  getTravelTimesFromOrigin,
};
