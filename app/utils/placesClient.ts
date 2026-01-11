/**
 * Client-side Google Places API helpers for static hosting
 * Replaces server-side API routes with direct Google Places API calls
 */

// Safe URL helper for Safari
export function safeOriginUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch (e) {
    // Fallback: just return the path if URL construction fails
    return path;
  }
}

// Safe JSON fetching with error handling
export async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got ${contentType}: ${text.slice(0, 120)}`);
  }
  
  return res.json();
}

/**
 * Search restaurants using Google Places API (client-side)
 */
export async function searchRestaurantsClientSide(params: {
  lat: number;
  lng: number;
  radius?: number;
  budget?: 'low' | 'mid' | 'high' | '';
  cuisine?: string[];
  maxWalkMinutes?: number;
}): Promise<any> {
  const googleMaps = (window as any).google;
  if (!googleMaps?.maps?.places?.PlacesService) {
    throw new Error('Google Places API not available');
  }

  const service = new googleMaps.maps.places.PlacesService(document.createElement('div'));
  const radius = params.radius || 5000; // 5km default
  
  // Map budget to price_level
  const priceLevels: (number | null)[] = [];
  if (!params.budget) {
    priceLevels.push(0, 1, 2, 3, 4); // All price levels
  } else if (params.budget === 'low') {
    priceLevels.push(1, 2); // $ and $$
  } else if (params.budget === 'mid') {
    priceLevels.push(2, 3); // $$ and $$$
  } else if (params.budget === 'high') {
    priceLevels.push(3, 4); // $$$ and $$$$
  }

  return new Promise((resolve, reject) => {
    const request: any = {
      location: new googleMaps.maps.LatLng(params.lat, params.lng),
      radius: radius,
      type: 'restaurant',
      keyword: params.cuisine && params.cuisine.length > 0 ? params.cuisine.join(' ') : undefined,
    };

    service.nearbySearch(request, (results: any[] | null, status: any) => {
      const statusStr = typeof status === 'string' ? status : String(status || '');
      const PlacesServiceStatus = googleMaps.maps?.places?.PlacesServiceStatus;
      const isOk = statusStr === 'OK' || (PlacesServiceStatus && status === PlacesServiceStatus.OK);

      if (!isOk || !results) {
        reject(new Error(`Places search failed: ${statusStr}`));
        return;
      }

      // Filter by price level and process results
      const filtered = results
        .filter((place: any) => {
          if (priceLevels.length > 0 && place.price_level !== undefined) {
            return priceLevels.includes(place.price_level);
          }
          return true;
        })
        .map((place: any) => ({
          placeId: place.place_id,
          name: place.name,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          priceLevel: place.price_level,
          types: place.types || [],
          geometry: place.geometry,
        }));

      resolve({
        restaurants: filtered,
        status: statusStr,
      });
    });
  });
}

/**
 * Get place details using Google Places API
 */
export async function getPlaceDetailsClientSide(placeId: string): Promise<any> {
  const googleMaps = (window as any).google;
  if (!googleMaps?.maps?.places?.PlacesService) {
    throw new Error('Google Places API not available');
  }

  const service = new googleMaps.maps.places.PlacesService(document.createElement('div'));

  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId: placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'user_ratings_total',
          'price_level',
          'types',
          'website',
          'photos',
        ],
      },
      (place: any, status: any) => {
        const statusStr = typeof status === 'string' ? status : String(status || '');
        const PlacesServiceStatus = googleMaps.maps?.places?.PlacesServiceStatus;
        const isOk = statusStr === 'OK' || (PlacesServiceStatus && status === PlacesServiceStatus.OK);

        if (!isOk || !place) {
          reject(new Error(`Place details failed: ${statusStr}`));
          return;
        }

        resolve({
          placeId: place.place_id,
          name: place.name,
          formattedAddress: place.formatted_address,
          geometry: place.geometry,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          priceLevel: place.price_level,
          types: place.types || [],
          website: place.website,
          photos: place.photos?.map((photo: any) => photo.getUrl({ maxWidth: 400 })) || [],
        });
      }
    );
  });
}

/**
 * Calculate walking distance using Haversine formula (client-side)
 */
export function calculateWalkingDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceMeters: number; walkMinutes: number } {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;
  
  // Average walking speed: ~5 km/h = ~83 m/min
  const walkMinutes = Math.round(distanceMeters / 83);
  
  return { distanceMeters, walkMinutes };
}
