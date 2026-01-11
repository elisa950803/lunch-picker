import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

// In-memory cache for location suggestions (5 minute TTL)
const suggestionCache = new Map<string, { data: any[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LocationSuggestion {
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

/**
 * Extract city and state from Google Places address_components
 */
function extractCityAndState(addressComponents: any[]): { city?: string; state?: string } {
  let city: string | undefined;
  let state: string | undefined;

  for (const component of addressComponents) {
    const types = component.types;
    
    // Extract city (locality, sublocality, or administrative_area_level_2)
    if (!city) {
      if (types.includes('locality')) {
        city = component.long_name;
      } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    }
    
    // Extract state (administrative_area_level_1 short_name)
    if (!state && types.includes('administrative_area_level_1')) {
      state = component.short_name; // e.g., "NY" instead of "New York"
    }
  }

  return { city, state };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Check cache
    const cacheKey = query.toLowerCase().trim();
    const cached = suggestionCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ suggestions: cached.data }, { status: 200 });
    }

    // Use Google Places Text Search API
    // Note: Text Search API does NOT support 'type' parameter (that's only for Nearby Search)
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('query', query.trim());
    url.searchParams.set('region', 'us'); // Restrict to US (optional: biases results to region)

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('Google Places Text Search API error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch location suggestions' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places Text Search API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Failed to fetch location suggestions' },
        { status: 500 }
      );
    }

    // Parse results into our format
    const suggestions: LocationSuggestion[] = (data.results || [])
      .slice(0, 8) // Top 8 suggestions
      .map((result: any) => {
        const location = result.geometry?.location;
        if (!location) {
          return null;
        }

        const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
        const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

        const { city, state } = extractCityAndState(result.address_components || []);

        return {
          label: result.formatted_address || result.name || query,
          placeId: result.place_id,
          lat,
          lng,
          city,
          state,
        };
      })
      .filter((s: LocationSuggestion | null) => s !== null);

    // Cache the results
    suggestionCache.set(cacheKey, {
      data: suggestions,
      expires: Date.now() + CACHE_TTL,
    });

    // Clean up expired cache entries periodically
    if (suggestionCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of suggestionCache.entries()) {
        if (value.expires <= now) {
          suggestionCache.delete(key);
        }
      }
    }

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error) {
    console.error('Location suggest API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
