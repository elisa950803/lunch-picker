/**
 * API client for backend services
 * Uses runtime config.json for backend URL (no rebuild needed)
 */

import { getApiBaseUrl } from '../../lib/runtimeConfig';

/**
 * Safe URL construction for Safari compatibility
 */
function buildUrl(path: string, params?: Record<string, string>, apiBaseUrl?: string): string {
  const baseUrl = apiBaseUrl || getApiBaseUrl();
  
  if (!baseUrl) {
    throw new Error('API_BASE_URL is not set in config.json');
  }

  // Validate URL starts with http:// or https://
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error(`Invalid API_BASE_URL: must start with http:// or https://`);
  }

  try {
    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  } catch (error) {
    throw new Error(`Failed to build URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Safe JSON fetch with error handling
 */
async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Failed to parse error JSON, use default message
      }
    } else {
      const text = await res.text();
      errorMessage = `${errorMessage} - ${text.slice(0, 120)}`;
    }
    throw new Error(errorMessage);
  }

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON response, got ${contentType}: ${text.slice(0, 120)}`);
  }

  return res.json();
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
 */
export async function getLocationSuggest(query: string, apiBaseUrl?: string): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const url = buildUrl('/location-suggest', { q: query.trim() }, apiBaseUrl);
  const data = await fetchJson(url);
  return data.suggestions || [];
}

export interface RecommendRequest {
  placeId?: string;
  lat?: number;
  lng?: number;
  locationText?: string;
  budget?: 'low' | 'mid' | 'high';
  dietary?: string[];
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
 */
export async function getRecommendations(request: RecommendRequest, apiBaseUrl?: string): Promise<RecommendResponse> {
  const url = buildUrl('/api/recommend', undefined, apiBaseUrl);
  const data = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return data;
}
