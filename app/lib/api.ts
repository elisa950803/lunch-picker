/**
 * API client for backend services
 * Uses runtime config.json for backend URL (no rebuild needed)
 */

/**
 * Safe JSON fetch with hardened error handling
 * Prevents Safari "expected pattern" and Chrome "Unexpected token <" errors
 */
async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  // URL validation: must start with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Invalid URL: must start with http:// or https://`);
  }

  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';

  // Read response text once (can only be consumed once)
  const text = await res.text();
  const preview = text.slice(0, 200);

  // Check if response is ok
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Failed to parse error JSON, use default message
        console.error('[fetchJson] Failed to parse error JSON:', preview);
      }
    } else {
      // Non-JSON error response (likely HTML error page)
      console.error('[fetchJson] Non-JSON error response:', preview);
      errorMessage = `Server returned ${contentType} instead of JSON. ${errorMessage}`;
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errorMessage = `Server returned HTML error page (${res.status}). This usually means the API endpoint doesn't exist or there's a routing issue.`;
      }
    }
    throw new Error(errorMessage);
  }

  // Check content-type includes application/json
  if (!contentType.includes('application/json')) {
    console.error('[fetchJson] Non-JSON response:', {
      contentType,
      preview,
      url,
    });
    
    // Friendly error message for HTML responses
    if (contentType.includes('text/html') || text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`Server returned an HTML page instead of JSON. This usually means the API endpoint is not available or the backend URL is incorrect.`);
    }
    
    throw new Error(`Expected JSON response (application/json), got ${contentType}`);
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    // If JSON parsing fails, log the raw response for debugging
    console.error('[fetchJson] JSON parse error:', {
      error: parseError,
      preview,
      contentType,
      url,
    });
    throw new Error(`Failed to parse JSON response. The server may have returned invalid JSON or HTML.`);
  }
}

export interface LocationSuggestion {
  label: string;
  placeId: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

/**
 * Get location suggestions from backend
 * @param query - Search query
 * @param apiBaseUrl - API base URL (must not be null)
 */
export async function getLocationSuggest(
  query: string,
  apiBaseUrl: string
): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }

  // Validate apiBaseUrl starts with http:// or https://
  if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
    throw new Error(`Invalid API base URL: must start with http:// or https://`);
  }

  // Remove trailing slash if present
  const cleanBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const url = `${cleanBaseUrl}/location-suggest?q=${encodeURIComponent(query.trim())}`;
  const data = await fetchJson(url);
  return data.suggestions || [];
}

export interface RecommendRequest {
  placeId?: string;
  lat?: number;
  lng?: number;
  locationText?: string;
  cuisine?: string[];
  maxLunchMinutes?: number;
}

export interface RecommendResponse {
  context: any;
  lunch: any[];
  dinner: any[];
  moreLunchOptions?: any[];
}

/**
 * Get restaurant recommendations from backend
 * @param request - Recommendation request
 * @param apiBaseUrl - API base URL (must not be null)
 */
export async function getRecommendations(
  request: RecommendRequest,
  apiBaseUrl: string
): Promise<RecommendResponse> {
  if (!apiBaseUrl) {
    throw new Error('API base URL is required');
  }

  // Validate apiBaseUrl starts with http:// or https://
  if (!apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
    throw new Error(`Invalid API base URL: must start with http:// or https://`);
  }

  // Remove trailing slash if present
  const cleanBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const url = `${cleanBaseUrl}/api/recommend`;

  const data = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return data;
}
