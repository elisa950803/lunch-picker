import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// Import directly from MCP source services (Next.js will transpile them)
import { getForecast } from '../../../mcp/src/services/weatherForecast';
import { getHoliday } from '../../../mcp/src/services/holidayService';
import { searchRestaurants, getPlaceDetails, type RestaurantSearchResult } from '../../../mcp/src/services/placesService';
// Import Distance Matrix service
import { getTravelTimesFromOrigin } from '../../../src/services/googleDistanceMatrix';

// Input validation schema
const RecommendRequestSchema = z.object({
  locationText: z.string().optional(),
  placeId: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  budget: z.enum(['low', 'mid', 'high']).optional(),
  dietary: z.array(z.string()).optional(),
  cuisine: z.array(z.string()).optional(),
  maxLunchMinutes: z.number().positive().optional(),
}).refine(
  (data) => (data.lat !== undefined && data.lng !== undefined) || data.placeId !== undefined || data.locationText !== undefined,
  {
    message: 'Either placeId, lat/lng, or locationText must be provided',
  }
);

// Output schema types
interface RecommendationOutput {
  context: {
    resolvedLocation: {
      lat: number;
      lng: number;
      address?: string;
      city?: string;
      state?: string;
      formatted?: string;
    };
    weatherSummary: {
      tempC: number;
      condition: string;
      isRainy: boolean;
      isCold: boolean;
      isHot: boolean;
      // Structured weather fields for welcome message generation
      temperatureC?: number;
      feelsLikeC?: number;
      windSpeedMs?: number;
      precipitationMm?: number;
      rainMm?: number;
    };
    holiday: {
      name?: string;
      isHoliday: boolean;
    };
    lunchDistanceInfo?: {
      maxMinutes: number;
      radiusMeters: number;
      wasAutoSelected: boolean;
      weatherReason: string;
      maxWalkMinutes: number;
      usedRelaxedTimeLimit: boolean;
      weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
      lunchWithinLimitCount: number;
      showMoreOptionsEnabled: boolean;
    };
  };
  lunch: Array<{
    name: string;
    why: string[];
    suggestedDishes: string[];
    etaMinutes: number;
    websiteUrl?: string;
    mapsUrl: string;
    placeId: string;
    photoUrl?: string;
  }>;
  dinner: Array<{
    name: string;
    why: string[];
    suggestedDishes: string[];
    etaMinutes: number;
    websiteUrl?: string;
    mapsUrl: string;
    reservationTip?: string;
    placeId: string;
    photoUrl?: string;
  }>;
  moreLunchOptions?: Array<{
    name: string;
    why: string[];
    suggestedDishes: string[];
    etaMinutes: number;
    websiteUrl?: string;
    mapsUrl: string;
    placeId: string;
    photoUrl?: string;
  }>;
}

/**
 * Extract city and state from Google address_components
 */
function extractCityAndState(addressComponents: Array<{
  long_name: string;
  short_name: string;
  types: string[];
}>): { city?: string; state?: string } {
  let city: string | undefined;
  let state: string | undefined;

  for (const component of addressComponents) {
    const types = component.types;
    
    // Extract city: locality OR sublocality OR administrative_area_level_2
    if (!city) {
      if (types.includes('locality')) {
        city = component.long_name;
      } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        city = component.long_name;
      }
    }
    
    // Extract state: administrative_area_level_1 short_name (e.g., "NY")
    if (!state && types.includes('administrative_area_level_1')) {
      state = component.short_name;
    }
  }

  return { city, state };
}

/**
 * Get place details from placeId using Google Places Details API
 */
async function getPlaceDetailsFromPlaceId(
  placeId: string,
  apiKey: string
): Promise<{ lat: number; lng: number; address?: string; city?: string; state?: string; formatted?: string }> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'geometry,formatted_address,address_components,place_id,name');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Places Details API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    status: string;
    error_message?: string;
    result?: {
      geometry?: {
        location: { lat: number; lng: number };
      };
      formatted_address?: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
      name?: string;
      place_id?: string;
    };
  };

  if (data.status === 'REQUEST_DENIED') {
    const errorMsg = data.error_message || 'Unknown error';
    throw new Error(
      `Places Details API access denied. Please enable Places API in Google Cloud Console.\n` +
      `Error details: ${errorMsg}`
    );
  }

  if (data.status !== 'OK' || !data.result || !data.result.geometry || !data.result.geometry.location) {
    throw new Error(
      `Place details failed: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}. ` +
      `Could not find place with ID: ${placeId}`
    );
  }

  const result = data.result;
  // TypeScript now knows geometry and location exist due to the check above
  const geometry = result.geometry!;
  const location = geometry.location;
  
  const { city, state } = result.address_components 
    ? extractCityAndState(result.address_components)
    : { city: undefined, state: undefined };

  // Validate region (US only)
  if (state && state.length === 2) {
    // Valid US state code (2 letters)
    // Additional check: verify country is US
    const isUS = result.address_components?.some(comp => 
      comp.types.includes('country') && comp.short_name === 'US'
    );
    if (!isUS && result.address_components) {
      throw new Error('Location must be in the United States. Please select a US location.');
    }
  } else if (result.address_components) {
    // Check if country is explicitly not US
    const country = result.address_components.find(comp => comp.types.includes('country'));
    if (country && country.short_name !== 'US') {
      throw new Error('Location must be in the United States. Please select a US location.');
    }
  }

  return {
    lat: location.lat,
    lng: location.lng,
    address: result.formatted_address,
    city,
    state,
    formatted: result.formatted_address,
  };
}

/**
 * Geocode location text to coordinates using Google Places API Text Search
 * Uses the legacy Places API which should already be enabled for restaurant search
 */
async function geocodeLocation(
  locationText: string,
  apiKey: string
): Promise<{ lat: number; lng: number; address?: string; city?: string; state?: string; formatted?: string }> {
  // Use Places API Text Search (legacy) - same API used for restaurant search
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('query', locationText);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Places API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    status: string;
    error_message?: string;
    results?: Array<{
      geometry: {
        location: { lat: number; lng: number };
      };
      formatted_address?: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
      place_id?: string;
    }>;
  };

  if (data.status === 'REQUEST_DENIED') {
    const errorMsg = data.error_message || 'Unknown error';
    throw new Error(
      `Places API access denied. Please enable Places API in Google Cloud Console.\n` +
      `1. Visit: https://console.cloud.google.com/google/maps-apis/api-list\n` +
      `2. Enable "Places API" (or "Places API (New)")\n` +
      `3. Wait a few minutes for changes to propagate\n` +
      `4. Retry your request\n\n` +
      `Error details: ${errorMsg}`
    );
  }

  if (data.status !== 'OK' || !data.results || data.results.length === 0 || !data.results[0].geometry) {
    throw new Error(
      `Geocoding failed: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}. ` +
      `Could not find location: ${locationText}`
    );
  }

  const result = data.results[0];
  
  // TypeScript now knows geometry exists due to the check above
  const geometry = result.geometry!; // Non-null assertion since we checked above
  const location = geometry.location; // This is guaranteed to exist
  
  // Extract city and state if address_components are available
  let city: string | undefined;
  let state: string | undefined;
  
  if (result.address_components) {
    const extracted = extractCityAndState(result.address_components);
    city = extracted.city;
    state = extracted.state;

    // Validate region (US only)
    const country = result.address_components.find(comp => comp.types.includes('country'));
    if (country && country.short_name !== 'US') {
      throw new Error('Location must be in the United States. Please select a US location.');
    }
  }

  return {
    lat: location.lat,
    lng: location.lng,
    address: result.formatted_address,
    city,
    state,
    formatted: result.formatted_address,
  };
}

/**
 * Calculate ETA in minutes from duration seconds
 */
function calculateETAFromDuration(durationSeconds: number): number {
  return Math.round(durationSeconds / 60);
}

/**
 * Filter restaurants by cuisine preferences
 */
function filterByCuisine<T extends { types: string[] }>(
  restaurants: T[],
  cuisinePreferences?: string[]
): T[] {
  if (!cuisinePreferences || cuisinePreferences.length === 0) {
    return restaurants;
  }

  // Map user-friendly cuisine names to Google Places API types
  const cuisineTypeMap: Record<string, string[]> = {
    'healthy': ['health_food', 'vegetarian_restaurant', 'vegan_restaurant', 'salad', 'juice_bar', 'organic'],
    'thai': ['thai_restaurant'],
    'korean': ['korean_restaurant'],
    'chinese': ['chinese_restaurant', 'szechuan'],
    'spanish': ['spanish_restaurant', 'tapas'],
    'mediterranean': ['mediterranean_restaurant', 'greek_restaurant', 'middle_eastern_restaurant'],
    'mexican': ['mexican_restaurant', 'taco', 'burrito'],
    'american': ['american_restaurant', 'burger', 'steakhouse', 'bbq', 'barbecue'],
  };

  const matchingTypes = new Set<string>();
  for (const cuisine of cuisinePreferences) {
    const normalizedCuisine = cuisine.toLowerCase().trim();
    const types = cuisineTypeMap[normalizedCuisine] || [normalizedCuisine + '_restaurant'];
    types.forEach(type => matchingTypes.add(type));
  }

  return restaurants.filter(restaurant => {
    const restaurantTypes = (restaurant.types || []).map(t => t.toLowerCase());
    return restaurantTypes.some(type => {
      // Check if any restaurant type matches any of our target cuisine types
      // Check both with and without underscores
      return Array.from(matchingTypes).some(matchType => {
        const normalizedMatch = matchType.toLowerCase();
        const normalizedMatchNoUnderscore = normalizedMatch.replace(/_/g, ' ');
        const typeNoUnderscore = type.replace(/_/g, ' ');
        
        // Direct match (with or without underscores)
        if (type === normalizedMatch || typeNoUnderscore === normalizedMatchNoUnderscore) {
          return true;
        }
        // Partial match (contains)
        if (type.includes(normalizedMatch) || normalizedMatch.includes(type) ||
            typeNoUnderscore.includes(normalizedMatchNoUnderscore) || 
            normalizedMatchNoUnderscore.includes(typeNoUnderscore)) {
          return true;
        }
        return false;
      });
    });
  });
}

/**
 * Filter restaurants by dietary preferences
 * Note: Google Places API doesn't have direct dietary filters, so this is best-effort based on types
 */
function filterByDietary(
  restaurants: RestaurantSearchResult[],
  dietaryPreferences?: string[]
): RestaurantSearchResult[] {
  if (!dietaryPreferences || dietaryPreferences.length === 0) {
    return restaurants;
  }

  // Map dietary preferences to filters
  const dietaryFilters = dietaryPreferences.map(d => d.toLowerCase().trim());
  
  return restaurants.filter(restaurant => {
    const restaurantTypes = (restaurant.types || []).map(t => t.toLowerCase());
    const restaurantName = (restaurant.name || '').toLowerCase();

    // Vegan: Filter out meat-heavy types and prefer vegan-marked restaurants
    if (dietaryFilters.includes('vegan')) {
      const meatTypes = ['steakhouse', 'steak', 'bbq', 'barbecue', 'meat', 'burger'];
      if (meatTypes.some(type => restaurantTypes.some(rt => rt.includes(type)))) {
        // If it's a meat-heavy place, check if it's explicitly vegan
        if (!restaurantTypes.some(rt => rt.includes('vegetarian') || rt.includes('vegan'))) {
          return false;
        }
      }
      // Prefer restaurants explicitly marked as vegan/vegetarian
      if (restaurantTypes.some(rt => rt.includes('vegan') || rt.includes('vegetarian'))) {
        return true;
      }
      // Filter out places with meat-related names
      const meatKeywords = ['steak', 'bbq', 'barbecue', 'burger', 'meat', 'pork', 'bacon', 'chicken', 'beef'];
      if (meatKeywords.some(keyword => restaurantName.includes(keyword))) {
        return false;
      }
    }

    // Halal: Filter out pork and alcohol-heavy places, prefer halal-marked restaurants
    if (dietaryFilters.includes('halal')) {
      // Exclude pork-related places
      if (restaurantTypes.some(rt => rt.includes('pork') || rt.includes('bacon'))) {
        return false;
      }
      if (restaurantName.includes('pork') || restaurantName.includes('bacon')) {
        return false;
      }
      // Prefer halal-marked restaurants
      if (restaurantTypes.some(rt => rt.includes('halal')) || restaurantName.includes('halal')) {
        return true;
      }
      // Note: Google Places API doesn't have reliable halal tags, so we can't perfectly filter
      // This is best-effort filtering
    }

    // Kosher: Filter out pork and shellfish, prefer kosher-marked restaurants
    if (dietaryFilters.includes('kosher')) {
      // Exclude pork-related places
      if (restaurantTypes.some(rt => rt.includes('pork') || rt.includes('bacon'))) {
        return false;
      }
      if (restaurantName.includes('pork') || restaurantName.includes('bacon')) {
        return false;
      }
      // Exclude shellfish/seafood (if mixing with meat)
      if (restaurantTypes.some(rt => rt.includes('shellfish') || rt.includes('seafood'))) {
        // Some kosher places serve seafood, but we'll be conservative
        // In practice, you'd need more sophisticated filtering
      }
      // Prefer kosher-marked restaurants
      if (restaurantTypes.some(rt => rt.includes('kosher')) || restaurantName.includes('kosher')) {
        return true;
      }
      // Note: Google Places API doesn't have reliable kosher tags, so this is best-effort
    }

    return true; // Include the restaurant if no dietary restrictions apply or can't be determined
  });
}

/**
 * Filter restaurants by budget preference
 */
function filterByBudget<T extends { priceLevel?: number }>(
  restaurants: T[],
  budget?: 'low' | 'mid' | 'high'
): T[] {
  if (!budget) {
    return restaurants;
  }

  return restaurants.filter(restaurant => {
    if (restaurant.priceLevel === undefined) {
      // If price level is unknown, include it (don't exclude)
      return true;
    }

    // Google Places price_level: 0 = free, 1 = $, 2 = $$, 3 = $$$, 4 = $$$$
    if (budget === 'low') {
      return restaurant.priceLevel <= 1; // $ or free
    } else if (budget === 'mid') {
      return restaurant.priceLevel >= 1 && restaurant.priceLevel <= 3; // $ to $$$
    } else if (budget === 'high') {
      return restaurant.priceLevel >= 3; // $$$ or $$$$
    }

    return true;
  });
}

// Configuration constants for hard filters
const MIN_RATING = 4.0;
const MIN_USER_RATINGS_TOTAL = 20;

// Note: deriveMaxWalkMinutes is now handled by the weather service itself
// The ForecastResponse interface now includes weatherBucket and maxWalkMinutes

/**
 * Hard filters: Apply strict filters that must pass
 */
function applyHardFilters<T extends { 
    rating?: number;
  userRatingTotal?: number; 
    types: string[];
  openingHours?: { openNow: boolean };
}>(
  restaurants: T[],
  openNow?: boolean
): T[] {
  const irrelevantTypes = new Set([
    'gas_station',
    'convenience_store',
    'atm',
    'bank',
    'store',
    'shopping_mall',
    'supermarket',
    'grocery_or_supermarket',
    'liquor_store',
    'drugstore',
  ]);

  return restaurants.filter(restaurant => {
    // Filter out irrelevant types
    const hasIrrelevantType = restaurant.types.some(type => 
      irrelevantTypes.has(type.toLowerCase())
    );
    if (hasIrrelevantType) {
      return false;
    }

    // Must have rating >= 4.0 if rating is available
    if (restaurant.rating !== undefined && restaurant.rating < MIN_RATING) {
      return false;
    }

    // Must have at least 20 reviews if available
    if (restaurant.userRatingTotal !== undefined && restaurant.userRatingTotal < MIN_USER_RATINGS_TOTAL) {
      return false;
    }

    // Must be open if openNow data is available and filtering is requested
    if (openNow && restaurant.openingHours !== undefined) {
      if (!restaurant.openingHours.openNow) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Scoring signal interfaces
 */
interface ScoringSignals {
  etaScore: number; // 0-1, higher is better (shorter walk)
  ratingScore: number; // 0-1, higher is better
  popularityScore: number; // 0-1, higher is better
  priceFitScore: number; // 0-1, higher is better match with budget
  mealTypeScore: number; // 0-1, higher is better match with meal type
  weatherMatchScore: number; // 0-1, higher is better match with weather
  topSignals: Array<{ name: string; value: string; score: number }>; // Top 2-3 signals for "why"
}

// Extended restaurant interface with details needed for ranking
interface RestaurantWithDetails extends RestaurantSearchResult {
  etaMinutes?: number;
  openingHours?: { openNow: boolean };
  signals?: ScoringSignals; // Scoring signals for this restaurant
}

/**
 * Calculate ETA score (0-1, higher = closer/shorter walk)
 * @param relaxedMode - If true, use a gentler curve that still rewards shorter times even beyond maxMinutes
 */
function calculateETAScore(etaMinutes: number | undefined, maxMinutes: number, relaxedMode: boolean = false): number {
  if (etaMinutes === undefined) {
    return 0.5; // Neutral score if ETA unknown
  }
  // Normalize: 0 min = 1.0, maxMinutes = 0.0, beyond max = 0.0
  if (etaMinutes <= 0) return 1.0;
  
  if (relaxedMode) {
    // In relaxed mode, use a gentler curve that still rewards shorter times
    // Even restaurants beyond maxMinutes get some score, but much lower
    if (etaMinutes <= maxMinutes) {
      return 1.0 - (etaMinutes / maxMinutes) * 0.8; // Scale down slightly for within limit
    } else {
      // Beyond limit: penalize heavily but still give some score
      // Use exponential decay: score decreases rapidly as time increases
      const overage = etaMinutes - maxMinutes;
      return Math.max(0.1, 0.2 * Math.exp(-overage / maxMinutes)); // Decay exponentially
    }
  } else {
    // Normal mode: strict cutoff at maxMinutes
    if (etaMinutes >= maxMinutes) return 0.0;
    return 1.0 - (etaMinutes / maxMinutes);
  }
}

/**
 * Calculate Bayesian-adjusted rating score
 */
function calculateRatingScore(
  rating: number | undefined,
  userRatingTotal: number | undefined,
  avgRating: number,
  m: number = 150
): number {
  if (rating === undefined || userRatingTotal === undefined) {
    return 0.5; // Neutral score if unknown
  }

  const v = userRatingTotal;
  const R = rating;
  const C = avgRating;

  // Bayesian adjustment: (v/(v+m))*R + (m/(v+m))*C
  const adjustedRating = (v / (v + m)) * R + (m / (v + m)) * C;

  // Normalize to 0-1: assume rating range is 0-5, so 5.0 = 1.0, 0.0 = 0.0
  return Math.min(1.0, adjustedRating / 5.0);
}

/**
 * Calculate popularity score (log-normalized)
 */
function calculatePopularityScore(
  userRatingTotal: number | undefined,
  maxReviews: number
): number {
  if (userRatingTotal === undefined || maxReviews === 0) {
    return 0.5; // Neutral score if unknown
  }

  // Log transform: log(1 + reviews) normalized to 0-1
  const logValue = Math.log1p(userRatingTotal);
  const maxLogValue = Math.log1p(maxReviews);
  return maxLogValue > 0 ? Math.min(1.0, logValue / maxLogValue) : 0.5;
}

/**
 * Calculate price fit score based on budget
 */
function calculatePriceFitScore(
  priceLevel: number | undefined,
  budget?: 'low' | 'mid' | 'high'
): number {
  if (priceLevel === undefined) {
    return 0.5; // Neutral if unknown
  }

  if (!budget) {
    return 0.5; // Neutral if no budget preference
  }

  // Price level: 0=free, 1=$, 2=$$, 3=$$$, 4=$$$$
  if (budget === 'low') {
    if (priceLevel === 0 || priceLevel === 1) return 1.0;
    if (priceLevel === 2) return 0.5;
    return 0.0; // 3 or 4
  } else if (budget === 'mid') {
    if (priceLevel === 2) return 1.0;
    if (priceLevel === 1 || priceLevel === 3) return 0.7;
    return 0.3; // 0 or 4
  } else if (budget === 'high') {
    if (priceLevel === 4) return 1.0;
    if (priceLevel === 3) return 0.8;
    if (priceLevel === 2) return 0.4;
    return 0.0; // 0 or 1
  }

  return 0.5;
}

/**
 * Calculate meal type score
 */
function calculateMealTypeScore(
  types: string[],
  meal: 'lunch' | 'dinner'
): number {
  const typesLower = types.map(t => t.toLowerCase());

  if (meal === 'lunch') {
    // Boost: cafe, bakery, meal_takeaway, sandwich, salad, fast_food
    const boostTypes = ['cafe', 'bakery', 'meal_takeaway', 'sandwich', 'salad', 'fast_food', 'deli', 'pizza'];
    const hasBoost = boostTypes.some(t => typesLower.includes(t));
    if (hasBoost) return 1.0;

    // Penalize: fine_dining, steak_house, bar, night_club
    const penaltyTypes = ['fine_dining', 'steak_house', 'steakhouse', 'bar', 'night_club', 'nightclub', 'cocktail_bar'];
    const hasPenalty = penaltyTypes.some(t => typesLower.includes(t));
    if (hasPenalty) return 0.2;

    // Neutral: regular restaurant types
    if (typesLower.includes('restaurant')) return 0.6;
    return 0.5;
  } else {
    // dinner
    // Boost: fine_dining, wine_bar, steak_house, tapas, italian, sushi
    const boostTypes = ['fine_dining', 'wine_bar', 'winebar', 'steak_house', 'steakhouse', 'tapas', 'italian_restaurant', 'sushi_restaurant', 'sushi'];
    const hasBoost = boostTypes.some(t => typesLower.includes(t));
    if (hasBoost) return 1.0;

    // Penalize: fast_food
    const penaltyTypes = ['fast_food'];
    const hasPenalty = penaltyTypes.some(t => typesLower.includes(t));
    if (hasPenalty) return 0.2;

    // Neutral: regular restaurant types
    if (typesLower.includes('restaurant')) return 0.7;
    return 0.5;
  }
}

/**
 * Calculate weather match score
 */
function calculateWeatherMatchScore(
  types: string[],
  weather: { isCold: boolean; isRainy: boolean; isHot: boolean }
): number {
  const typesLower = types.map(t => t.toLowerCase());
  
  if (weather.isCold || weather.isRainy) {
    // Boost: soup, noodle, hot cuisines (ramen, pho, hot_pot, soup)
    const warmTypes = ['soup', 'ramen', 'pho', 'hot_pot', 'hotpot', 'noodle', 'soup_restaurant'];
    const hasWarm = warmTypes.some(t => typesLower.includes(t));
    if (hasWarm) return 1.0;

    // Boost indoor sit-down places
    const indoorTypes = ['restaurant', 'cafe', 'diner'];
    const hasIndoor = indoorTypes.some(t => typesLower.includes(t));
    if (hasIndoor) return 0.7;

    return 0.5;
  }

  if (weather.isHot) {
    // Boost: lighter cuisines (salad, poke, sushi, juice)
    const lightTypes = ['salad', 'poke', 'sushi', 'juice_bar', 'juicebar', 'health_food'];
    const hasLight = lightTypes.some(t => typesLower.includes(t));
    if (hasLight) return 1.0;

    return 0.5;
  }

  return 0.5; // Neutral for nice weather
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Check if restaurant matches cuisine preferences
 * Uses the same logic as filterByCuisine for consistency
 */
function matchesCuisine(restaurantTypes: string[], cuisinePreferences?: string[]): boolean {
  if (!cuisinePreferences || cuisinePreferences.length === 0) {
    return false;
  }

  const cuisineTypeMap: Record<string, string[]> = {
    'healthy': ['health_food', 'vegetarian_restaurant', 'vegan_restaurant', 'salad', 'juice_bar', 'organic'],
    'thai': ['thai_restaurant'],
    'korean': ['korean_restaurant'],
    'chinese': ['chinese_restaurant', 'szechuan'],
    'spanish': ['spanish_restaurant', 'tapas'],
    'mediterranean': ['mediterranean_restaurant', 'greek_restaurant', 'middle_eastern_restaurant'],
    'mexican': ['mexican_restaurant', 'taco', 'burrito'],
    'american': ['american_restaurant', 'burger', 'steakhouse', 'bbq', 'barbecue'],
  };

  const matchingTypes = new Set<string>();
  for (const cuisine of cuisinePreferences) {
    const normalizedCuisine = cuisine.toLowerCase().trim();
    const types = cuisineTypeMap[normalizedCuisine] || [normalizedCuisine + '_restaurant'];
    types.forEach(type => matchingTypes.add(type));
  }

  const restaurantTypesLower = restaurantTypes.map(t => t.toLowerCase());
  return restaurantTypesLower.some(type => {
    // Check if any restaurant type matches any of our target cuisine types
    // Check both with and without underscores
    return Array.from(matchingTypes).some(matchType => {
      const normalizedMatch = matchType.toLowerCase();
      const normalizedMatchNoUnderscore = normalizedMatch.replace(/_/g, ' ');
      const typeNoUnderscore = type.replace(/_/g, ' ');
      
      // Direct match (with or without underscores)
      if (type === normalizedMatch || typeNoUnderscore === normalizedMatchNoUnderscore) {
        return true;
      }
      // Partial match (contains)
      if (type.includes(normalizedMatch) || normalizedMatch.includes(type) ||
          typeNoUnderscore.includes(normalizedMatchNoUnderscore) || 
          normalizedMatchNoUnderscore.includes(typeNoUnderscore)) {
        return true;
      }
      return false;
    });
  });
}

/**
 * Calculate all scoring signals for a restaurant
 */
function calculateScoringSignals(
  restaurant: RestaurantWithDetails,
  candidates: RestaurantWithDetails[],
  meal: 'lunch' | 'dinner',
  weather: { isRainy: boolean; isCold: boolean; isHot: boolean },
  maxMinutes: number,
  budget?: 'low' | 'mid' | 'high',
  relaxedMode: boolean = false
): ScoringSignals {
  // Calculate average rating of all candidates for Bayesian adjustment
  const ratings = candidates
    .filter(r => r.rating !== undefined)
    .map(r => r.rating!);
  const avgRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
    : 4.0; // Default to 4.0 if no ratings

  // Find max reviews for normalization
  const maxReviews = Math.max(
    ...candidates
      .filter(r => r.userRatingTotal !== undefined)
      .map(r => r.userRatingTotal!),
    1 // Avoid division by zero
  );

  // Calculate individual signals
  const etaScore = calculateETAScore(restaurant.etaMinutes, maxMinutes, relaxedMode);
  const ratingScore = calculateRatingScore(
    restaurant.rating,
    restaurant.userRatingTotal,
    avgRating
  );
  const popularityScore = calculatePopularityScore(
    restaurant.userRatingTotal,
    maxReviews
  );
  const priceFitScore = calculatePriceFitScore(restaurant.priceLevel, budget);
  const mealTypeScore = calculateMealTypeScore(restaurant.types, meal);
  const weatherMatchScore = calculateWeatherMatchScore(restaurant.types, weather);

  // Collect top 2-3 signals for "why" generation
  const signals = [
    { name: 'eta', value: `${restaurant.etaMinutes || '?'}-min walk`, score: etaScore },
    { name: 'rating', value: restaurant.rating && restaurant.userRatingTotal 
      ? `${restaurant.rating.toFixed(1)} rating with ${restaurant.userRatingTotal.toLocaleString()} reviews`
      : 'Well-rated', score: ratingScore },
    { name: 'popularity', value: restaurant.userRatingTotal 
      ? `${restaurant.userRatingTotal.toLocaleString()} reviews`
      : 'Popular', score: popularityScore },
    { name: 'price', value: budget ? `Budget-friendly` : 'Good value', score: priceFitScore },
    { name: 'mealType', value: meal === 'lunch' ? 'Great for lunch' : 'Perfect for dinner', score: mealTypeScore },
    { name: 'weather', value: weather.isCold || weather.isRainy 
      ? 'Great for rainy day'
      : weather.isHot 
        ? 'Refreshing'
        : 'Perfect weather match', score: weatherMatchScore },
  ];

  // Sort by score and take top 2-3
  const topSignals = signals
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    etaScore,
    ratingScore,
    popularityScore,
    priceFitScore,
    mealTypeScore,
    weatherMatchScore,
    topSignals,
  };
}

/**
 * Calculate final weighted score for lunch (0-100)
 * @param signals - Scoring signals
 * @param relaxedMode - If true, use relaxed weights that heavily favor ETA/distance
 */
function calculateLunchScore(signals: ScoringSignals, relaxedMode: boolean = false): number {
  let score: number;
  
  if (relaxedMode) {
    // Relaxed mode: heavily prioritize closeness (ETA/distance)
    score = 
      0.65 * signals.etaScore +
      0.15 * signals.ratingScore +
      0.10 * signals.popularityScore +
      0.10 * signals.mealTypeScore;
  } else {
    // Normal mode: balanced weights
    score = 
      0.40 * signals.etaScore +
      0.20 * signals.ratingScore +
      0.15 * signals.popularityScore +
      0.15 * signals.mealTypeScore +
      0.10 * signals.priceFitScore;
  }

  return Math.round(score * 100); // Scale to 0-100
}

/**
 * Calculate final weighted score for dinner (0-100)
 */
function calculateDinnerScore(signals: ScoringSignals): number {
  const score = 
    0.15 * signals.etaScore +
    0.30 * signals.ratingScore +
    0.20 * signals.popularityScore +
    0.20 * signals.mealTypeScore +
    0.15 * signals.weatherMatchScore;

  return Math.round(score * 100); // Scale to 0-100
}

/**
 * Hybrid ranking system for restaurants
 * @param relaxedMode - If true, use relaxed scoring that heavily favors ETA/distance
 */
function rankRestaurants(
  restaurants: RestaurantWithDetails[],
  candidates: RestaurantWithDetails[], // All candidates for normalization
  meal: 'lunch' | 'dinner',
  weather: { isRainy: boolean; isCold: boolean; isHot: boolean },
  maxMinutes: number,
  budget?: 'low' | 'mid' | 'high',
  relaxedMode: boolean = false
): Array<RestaurantWithDetails & { score: number; signals: ScoringSignals }> {
  return restaurants
    .map(restaurant => {
      const signals = calculateScoringSignals(
        restaurant,
        candidates,
        meal,
        weather,
        maxMinutes,
        budget,
        relaxedMode
      );
      const score = meal === 'lunch' 
        ? calculateLunchScore(signals, relaxedMode)
        : calculateDinnerScore(signals);

      return { ...restaurant, score, signals };
    })
    .sort((a, b) => {
      // In relaxed mode, if scores are close, prioritize shorter ETA
      if (relaxedMode && Math.abs(a.score - b.score) < 5) {
        const etaA = a.etaMinutes ?? Infinity;
        const etaB = b.etaMinutes ?? Infinity;
        if (etaA !== etaB) {
          return etaA - etaB; // Shorter ETA first
        }
      }
      return b.score - a.score; // Higher score first
    });
}


/**
 * Generate "why" reasons from scoring signals
 */
function generateWhyReasonsFromSignals(
  signals: ScoringSignals,
  etaMinutes?: number
): string[] {
  const reasons: string[] = [];

  // Use top 2-3 signals from scoring
  for (const signal of signals.topSignals.slice(0, 3)) {
    if (signal.name === 'eta' && etaMinutes !== undefined) {
      reasons.push(`${etaMinutes}-min walk`);
    } else if (signal.name === 'rating') {
      reasons.push(signal.value);
    } else if (signal.name === 'popularity') {
      reasons.push(signal.value);
    } else if (signal.name === 'price') {
      reasons.push(signal.value);
    } else if (signal.name === 'mealType') {
      reasons.push(signal.value);
    } else if (signal.name === 'weather') {
      reasons.push(signal.value);
    }
  }

  // Ensure at least 2 reasons
  if (reasons.length === 0) {
    if (etaMinutes !== undefined) {
      reasons.push(`${etaMinutes}-min walk`);
    }
    reasons.push('Great option');
  } else if (reasons.length === 1) {
    if (etaMinutes === undefined || !reasons[0].includes('walk')) {
      reasons.push('Well-located');
  } else {
      reasons.push('Highly rated');
    }
  }

  return reasons.slice(0, 3); // Return top 3
}

/**
 * Generate suggested dishes based on restaurant types
 */
function generateSuggestedDishes(types: string[]): string[] {
  const dishes: string[] = [];
  const typeToDishes: Record<string, string[]> = {
    pizza: ['Margherita Pizza', 'Pepperoni Pizza'],
    italian: ['Pasta Carbonara', 'Margherita Pizza'],
    chinese: ['Kung Pao Chicken', 'Mapo Tofu'],
    japanese: ['Ramen', 'Sushi Platter'],
    mexican: ['Tacos', 'Burrito'],
    indian: ['Butter Chicken', 'Biryani'],
    thai: ['Pad Thai', 'Green Curry'],
    steakhouse: ['Ribeye Steak', 'Filet Mignon'],
    seafood: ['Grilled Salmon', 'Lobster'],
    cafe: ['Avocado Toast', 'Caesar Salad'],
    fast_food: ['Burger', 'Fries'],
  };

  for (const type of types) {
    const typeKey = type.replace('_', '').toLowerCase();
    if (typeToDishes[typeKey] && dishes.length < 3) {
      dishes.push(...typeToDishes[typeKey].slice(0, 2));
    }
  }

  // Default dishes if none found
  if (dishes.length === 0) {
    dishes.push('Chef Special', 'House Favorite');
  }

  return dishes.slice(0, 3);
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'This is a POST-only API endpoint',
      usage: 'Use POST method with JSON body',
      example: {
        locationText: 'Midtown Manhattan',
        budget: 'mid',
        dietary: ['vegetarian'],
        cuisine: ['italian'],
        maxLunchMinutes: 35,
      },
      ui: 'Visit http://localhost:3000/ to use the web interface',
    },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RecommendRequestSchema.parse(body);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_MAPS_API_KEY environment variable is required' },
        { status: 500 }
      );
    }

    // 1. Resolve location
    // Priority: placeId > lat/lng > locationText (fallback)
    let location: { lat: number; lng: number; address?: string; city?: string; state?: string; formatted?: string };
    
    if (validated.placeId) {
      // If placeId is provided, use Places Details API to get full location info
      location = await getPlaceDetailsFromPlaceId(validated.placeId, apiKey);
    } else if (validated.lat !== undefined && validated.lng !== undefined) {
      // If lat/lng provided, use directly (may need reverse geocoding for city/state, but skip for now)
      location = { lat: validated.lat, lng: validated.lng };
      
      // Optional: Reverse geocode to get city/state if not provided
      // For now, we'll skip this to avoid extra API calls
    } else if (validated.locationText) {
      // Fallback: geocode locationText
      location = await geocodeLocation(validated.locationText, apiKey);
    } else {
      return NextResponse.json(
        { error: 'Either placeId, lat/lng, or locationText must be provided' },
        { status: 400 }
      );
    }

    // 2. Call MCP tools
    const now = new Date();
    const nowISO = now.toISOString();
    const lunchTime = new Date(now);
    lunchTime.setHours(12, 0, 0, 0); // 12 PM
    const lunchTimeISO = lunchTime.toISOString();

    // Get weather for now and lunch time
    const [weatherNow, weatherLunch] = await Promise.all([
      getForecast(location.lat, location.lng, nowISO),
      getForecast(location.lat, location.lng, lunchTimeISO),
    ]);

    // Get holiday for today (US)
    const todayISO = now.toISOString().split('T')[0];
    const holiday = await getHoliday(todayISO, 'US', process.env.CALENDARIFIC_API_KEY).catch((error) => {
      console.warn('Failed to get holiday, defaulting to no holiday:', error);
      return { isHoliday: false };
    });

    // Auto-determine lunch distance based on weather if not provided by user
    // The weather service now returns weatherBucket and maxWalkMinutes in the response
    let lunchRadiusMeters: number;
    let lunchMaxMinutes: number;
    let weatherBucket: 'storm_or_extreme' | 'drizzle_or_light_precip' | 'pleasant';
    let weatherReason: string;
    
    if (validated.maxLunchMinutes) {
      // User override takes precedence
      lunchMaxMinutes = validated.maxLunchMinutes;
      lunchRadiusMeters = validated.maxLunchMinutes * 80; // meters
      // Use weather bucket from API for context, but use user value
      weatherBucket = weatherLunch.weatherBucket;
      weatherReason = `User specified: ${validated.maxLunchMinutes} min walk`;
    } else {
      // Use weather bucket and maxWalkMinutes from weather service (already derived)
      lunchMaxMinutes = weatherLunch.maxWalkMinutes;
      weatherBucket = weatherLunch.weatherBucket;
      lunchRadiusMeters = lunchMaxMinutes * 80; // Average walking speed: ~80 meters/minute
      
      // Generate weather reason based on bucket
      if (weatherBucket === 'storm_or_extreme') {
        weatherReason = `Extreme weather - staying close (${lunchMaxMinutes} min walk)`;
      } else if (weatherBucket === 'drizzle_or_light_precip') {
        weatherReason = `Drizzling/Light precipitation - moderate distance (${lunchMaxMinutes} min walk)`;
      } else {
        weatherReason = `Pleasant weather - can go further (${lunchMaxMinutes} min walk)`;
      }
      
      console.log('Weather-based max walk time:', {
        condition: weatherLunch.condition,
        tempC: weatherLunch.tempC,
        feelsLikeC: weatherLunch.feelsLikeC,
        weatherCode: weatherLunch.weatherCode,
        precipitationMm: weatherLunch.precipitationMm,
        rainMm: weatherLunch.rainMm,
        windSpeedMs: weatherLunch.windSpeedMs,
        maxWalkMinutes: lunchMaxMinutes,
        weatherBucket,
        weatherReason
      });
    }

    // Helper function to search with cuisine-specific keywords using Text Search API
    const searchWithCuisineText = async (
      apiKey: string,
      location: { lat: number; lng: number; address?: string },
      radiusMeters: number,
      cuisine: string[]
    ): Promise<RestaurantSearchResult[]> => {
      // Use Text Search API with cuisine-specific query for better results
      const allResults: RestaurantSearchResult[] = [];
      const seenIds = new Set<string>();
      
      // Search for each cuisine type separately and combine results
      for (const cuisineType of cuisine) {
        try {
          // Use Text Search API with cuisine-specific query
          // Format: "japanese restaurant" near location
          // Special handling for "healthy" to get better results
          let query = `${cuisineType} restaurant`;
          if (cuisineType.toLowerCase() === 'healthy') {
            // Try multiple queries for healthy: "healthy food", "health food restaurant", "organic restaurant"
            query = 'healthy food restaurant';
          }
          const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
          url.searchParams.set('key', apiKey);
          url.searchParams.set('query', query);
          url.searchParams.set('type', 'restaurant');
          url.searchParams.set('location', `${location.lat},${location.lng}`);
          url.searchParams.set('radius', Math.min(radiusMeters, 50000).toString());
          
          const response = await fetch(url.toString());
          if (!response.ok) {
            console.warn(`Text Search API error for ${cuisineType}: ${response.status}`);
            continue;
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
          };
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            for (const result of data.results) {
              if (!seenIds.has(result.place_id)) {
                // Filter by distance if geometry is available
                if (result.geometry?.location) {
                  const distance = calculateDistance(
                    location.lat,
                    location.lng,
                    result.geometry.location.lat,
                    result.geometry.location.lng
                  );
                  // Only include if within radius (radius is just a bias in Text Search, so we filter manually)
                  if (distance > radiusMeters) {
                    continue; // Skip restaurants outside radius
                  }
                }
                
                seenIds.add(result.place_id);
                allResults.push({
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
                });
              }
            }
          } else if (data.status !== 'ZERO_RESULTS') {
            console.warn(`Text Search API returned status ${data.status} for ${cuisineType}: ${data.error_message || ''}`);
          }
        } catch (err) {
          console.warn(`Failed to search for ${cuisineType} restaurants:`, err);
        }
      }
      
      return allResults.slice(0, 40); // Limit to 40 results
    };

    // Search restaurants for lunch and dinner
    // If cuisine filter is applied, use Text Search with cuisine keywords for better results
    const hasCuisineFilter = validated.cuisine && validated.cuisine.length > 0;
    let lunchRestaurants: RestaurantSearchResult[];
    let dinnerRestaurants: RestaurantSearchResult[];
    
    if (hasCuisineFilter) {
      // Use Text Search API with cuisine-specific queries
      [lunchRestaurants, dinnerRestaurants] = await Promise.all([
        searchWithCuisineText(apiKey, location, lunchRadiusMeters, validated.cuisine!),
        searchWithCuisineText(apiKey, location, 5000, validated.cuisine!),
      ]);
    } else {
      // Use regular Nearby Search when no cuisine filter
      [lunchRestaurants, dinnerRestaurants] = await Promise.all([
        searchRestaurants(apiKey, location.lat, location.lng, 'lunch', lunchRadiusMeters, 20),
      searchRestaurants(apiKey, location.lat, location.lng, 'dinner', 5000, 20),
    ]);
    }

    // 2.5. Filter by cuisine, budget, and dietary preferences
    // Even with Text Search, we should still filter to ensure matches
    // Also check restaurant names for cuisine keywords as additional validation
    let filteredLunch = filterByCuisine(lunchRestaurants, validated.cuisine);
    let filteredDinner = filterByCuisine(dinnerRestaurants, validated.cuisine);
    
    // Additional filtering by restaurant name if cuisine filter is applied (as backup validation)
    // Text Search should already return cuisine-specific restaurants, but double-check
    if (hasCuisineFilter) {
      const cuisineKeywords = validated.cuisine!.map(c => c.toLowerCase());
      filteredLunch = filteredLunch.filter(r => {
        const nameLower = r.name.toLowerCase();
        const matchesName = cuisineKeywords.some(keyword => nameLower.includes(keyword));
        const matchesType = matchesCuisine(r.types, validated.cuisine);
        // Require EITHER name match OR type match (Text Search should help with name matches)
        return matchesName || matchesType;
      });
      filteredDinner = filteredDinner.filter(r => {
        const nameLower = r.name.toLowerCase();
        const matchesName = cuisineKeywords.some(keyword => nameLower.includes(keyword));
        const matchesType = matchesCuisine(r.types, validated.cuisine);
        // Require EITHER name match OR type match
        return matchesName || matchesType;
      });
    }
    
    // Filter by budget BEFORE ranking (so we actually filter out non-matching restaurants)
    filteredLunch = filterByBudget(filteredLunch, validated.budget);
    filteredDinner = filterByBudget(filteredDinner, validated.budget);
    
    filteredLunch = filterByDietary(filteredLunch, validated.dietary);
    filteredDinner = filterByDietary(filteredDinner, validated.dietary);

    // If still not enough results after Text Search, expand radius
    if (filteredLunch.length < 2 && hasCuisineFilter) {
      const expandedLunch = await searchWithCuisineText(apiKey, location, lunchRadiusMeters * 3, validated.cuisine!);
      const expandedFilteredByCuisine = filterByCuisine(expandedLunch, validated.cuisine);
      const expandedFilteredByName = expandedFilteredByCuisine.filter(r => {
        const nameLower = r.name.toLowerCase();
        const cuisineKeywords = validated.cuisine!.map(c => c.toLowerCase());
        return cuisineKeywords.some(keyword => nameLower.includes(keyword)) || 
               matchesCuisine(r.types, validated.cuisine);
      });
      const expandedFiltered = filterByDietary(expandedFilteredByName, validated.dietary);
      // Combine with existing filtered results, avoiding duplicates
      const existingIds = new Set(filteredLunch.map(r => r.placeId));
      const newResults = expandedFiltered.filter(r => !existingIds.has(r.placeId));
      filteredLunch = [...filteredLunch, ...newResults];
    }
    
    if (filteredDinner.length < 2 && hasCuisineFilter) {
      const expandedDinner = await searchWithCuisineText(apiKey, location, 10000, validated.cuisine!);
      const expandedFilteredByCuisine = filterByCuisine(expandedDinner, validated.cuisine);
      const expandedFilteredByName = expandedFilteredByCuisine.filter(r => {
        const nameLower = r.name.toLowerCase();
        const cuisineKeywords = validated.cuisine!.map(c => c.toLowerCase());
        return cuisineKeywords.some(keyword => nameLower.includes(keyword)) || 
               matchesCuisine(r.types, validated.cuisine);
      });
      const expandedFiltered = filterByDietary(expandedFilteredByName, validated.dietary);
      // Combine with existing filtered results, avoiding duplicates
      const existingIds = new Set(filteredDinner.map(r => r.placeId));
      const newResults = expandedFiltered.filter(r => !existingIds.has(r.placeId));
      filteredDinner = [...filteredDinner, ...newResults];
    }

    // 3. Get place details for all filtered candidates (to get openNow, userRatingTotal, etc.)
    // This must happen BEFORE hard filters and ranking
    const maxCandidatesForDetails = 40; // Get details for more candidates than we need, then filter
    const candidatesForLunchDetails = filteredLunch.slice(0, maxCandidatesForDetails);
    const candidatesForDinnerDetails = filteredDinner.slice(0, maxCandidatesForDetails);
    
    const [allLunchDetails, allDinnerDetails] = await Promise.all([
      Promise.all(candidatesForLunchDetails.map(r => getPlaceDetails(apiKey, r.placeId))),
      Promise.all(candidatesForDinnerDetails.map(r => getPlaceDetails(apiKey, r.placeId))),
    ]);

    // Merge restaurant search results with place details to create RestaurantWithDetails
    const lunchWithDetails: RestaurantWithDetails[] = candidatesForLunchDetails.map((restaurant, idx) => ({
      ...restaurant,
      rating: allLunchDetails[idx]?.rating ?? restaurant.rating,
      userRatingTotal: allLunchDetails[idx]?.userRatingTotal ?? restaurant.userRatingTotal,
      priceLevel: allLunchDetails[idx]?.priceLevel ?? restaurant.priceLevel,
      types: allLunchDetails[idx]?.types ?? restaurant.types,
      openingHours: allLunchDetails[idx]?.openingHours,
      location: restaurant.location ?? allLunchDetails[idx]?.location,
    }));

    const dinnerWithDetails: RestaurantWithDetails[] = candidatesForDinnerDetails.map((restaurant, idx) => ({
      ...restaurant,
      rating: allDinnerDetails[idx]?.rating ?? restaurant.rating,
      userRatingTotal: allDinnerDetails[idx]?.userRatingTotal ?? restaurant.userRatingTotal,
      priceLevel: allDinnerDetails[idx]?.priceLevel ?? restaurant.priceLevel,
      types: allDinnerDetails[idx]?.types ?? restaurant.types,
      openingHours: allDinnerDetails[idx]?.openingHours,
      location: restaurant.location ?? allDinnerDetails[idx]?.location,
    }));

    // 4. Apply hard filters (must have rating >= 4.0, reviews >= 20, exclude irrelevant types, open if data available)
    // Note: We check openNow only if openingHours data is available
    const filteredByHardLunch = applyHardFilters(lunchWithDetails, true); // true = filter by openNow if available
    const filteredByHardDinner = applyHardFilters(dinnerWithDetails, true);

    // If we still don't have enough results after hard filters, relax openNow requirement
    let hardFilteredLunch = filteredByHardLunch;
    let hardFilteredDinner = filteredByHardDinner;
    
    if (hardFilteredLunch.length < 2) {
      hardFilteredLunch = applyHardFilters(lunchWithDetails, false); // Don't filter by openNow
    }
    if (hardFilteredDinner.length < 2) {
      hardFilteredDinner = applyHardFilters(dinnerWithDetails, false);
    }

    // If still not enough, return error
    if (hardFilteredLunch.length === 0 || hardFilteredDinner.length === 0) {
      if (hasCuisineFilter) {
      return NextResponse.json(
          { 
            error: `No ${validated.cuisine!.join(' or ')} restaurants found that meet quality criteria (rating >= ${MIN_RATING}, at least ${MIN_USER_RATINGS_TOTAL} reviews). Please try a different location, remove the cuisine filter, or increase the search radius.` 
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `No restaurants found that meet quality criteria (rating >= ${MIN_RATING}, at least ${MIN_USER_RATINGS_TOTAL} reviews). Please try a different location or increase the search radius.` },
        { status: 404 }
      );
    }

    // 5. Calculate ETAs for all candidates using Distance Matrix API
    const lunchPlaceIds = hardFilteredLunch.map(r => `place_id:${r.placeId}`);
    const dinnerPlaceIds = hardFilteredDinner.map(r => `place_id:${r.placeId}`);

    // 6. Get travel times using Distance Matrix API for accurate ETAs
    let lunchTravelTimes: Array<{ status: string; duration: { value: number } }> = [];
    let dinnerTravelTimes: Array<{ status: string; duration: { value: number } }> = [];
    
    try {
      const results = await Promise.all([
        getTravelTimesFromOrigin(apiKey, location, lunchPlaceIds, 'walking').catch((err) => {
          console.warn('Failed to get lunch travel times:', err);
          return [];
        }),
        getTravelTimesFromOrigin(apiKey, location, dinnerPlaceIds, 'driving').catch((err) => {
          console.warn('Failed to get dinner travel times:', err);
          return [];
        }),
      ]);
      lunchTravelTimes = results[0];
      dinnerTravelTimes = results[1];
    } catch (error) {
      console.warn('Error getting travel times, using fallback estimates:', error);
      // Continue with fallback estimates
    }

    // 7. Add ETAs to restaurants (calculate from distance if travel time unavailable)
    const lunchWithETAs: RestaurantWithDetails[] = hardFilteredLunch.map((restaurant, idx) => {
      let etaMinutes: number | undefined;
      if (lunchTravelTimes[idx] && lunchTravelTimes[idx].status === 'OK') {
        etaMinutes = calculateETAFromDuration(lunchTravelTimes[idx].duration.value);
      } else if (restaurant.location && location) {
        // Fallback: estimate from straight-line distance
        const distanceMeters = calculateDistance(
          location.lat,
          location.lng,
          restaurant.location.lat,
          restaurant.location.lng
        );
        etaMinutes = Math.round(distanceMeters / 80); // 80 meters per minute walking
      }
      return { ...restaurant, etaMinutes };
    });

    const dinnerWithETAs: RestaurantWithDetails[] = hardFilteredDinner.map((restaurant, idx) => {
      let etaMinutes: number | undefined;
      if (dinnerTravelTimes[idx] && dinnerTravelTimes[idx].status === 'OK') {
        etaMinutes = calculateETAFromDuration(dinnerTravelTimes[idx].duration.value);
      } else if (restaurant.location && location) {
        // Fallback: estimate from straight-line distance
        const distanceMeters = calculateDistance(
          location.lat,
          location.lng,
          restaurant.location.lat,
          restaurant.location.lng
        );
        etaMinutes = Math.round(distanceMeters / 1333); // ~1333 meters per minute driving (80 km/h average)
      }
      return { ...restaurant, etaMinutes };
    });

    // 8. Filter restaurants by lunchMaxMinutes threshold BEFORE ranking
    // First pass: filter candidates by etaMinutes <= maxWalkMinutes
    const lunchWithinTimeLimit = lunchWithETAs.filter(restaurant => {
      if (restaurant.etaMinutes === undefined) {
        // If ETA is unknown, exclude it (we can't verify it's within limit)
        return false;
      }
      // Only include restaurants within the lunchMaxMinutes threshold
      return restaurant.etaMinutes <= lunchMaxMinutes;
    });

    const lunchWithinLimitCount = lunchWithinTimeLimit.length;
    const allCandidatesWithETA = lunchWithETAs.filter(r => r.etaMinutes !== undefined);

    console.log('Lunch ETA filtering:', {
      lunchMaxMinutes,
      totalRestaurants: lunchWithETAs.length,
      withinTimeLimit: lunchWithinLimitCount,
      restaurantsWithETAs: allCandidatesWithETA.map(r => ({
        name: r.name,
        etaMinutes: r.etaMinutes
      }))
    });

    // Always return at least 2 lunch options if we have 2+ candidates overall
    let lunchCandidatesForRanking: RestaurantWithDetails[];
    let usedRelaxedTimeLimit = false;
    
    if (lunchWithinLimitCount === 0) {
      // If filtered set has 0 items: use relaxed mode ranking and return top 2
      if (allCandidatesWithETA.length >= 2) {
        console.log(`No restaurants within ${lunchMaxMinutes} min walk. Using relaxed mode with ETA-heavy ranking.`);
        lunchCandidatesForRanking = allCandidatesWithETA;
        usedRelaxedTimeLimit = true;
      } else {
        // Not enough candidates overall, use what we have
        lunchCandidatesForRanking = allCandidatesWithETA;
        usedRelaxedTimeLimit = true;
      }
    } else if (lunchWithinLimitCount === 1) {
      // If filtered set has 1 item: return that 1 item plus 1 more from full set
      if (allCandidatesWithETA.length >= 2) {
        // Use the 1 within-limit item, plus rank the rest to get 1 more closest
        const theOneWithinLimit = lunchWithinTimeLimit[0];
        const theRest = allCandidatesWithETA.filter(r => r.placeId !== theOneWithinLimit.placeId);
        
        // Rank the rest by closeness-heavy score (relaxed mode)
        const rankedRest = rankRestaurants(
          theRest,
          allCandidatesWithETA, // All candidates for normalization
          'lunch',
          weatherLunch,
          lunchMaxMinutes,
          validated.budget,
          true // Use relaxed mode to prioritize closeness
        );
        
        lunchCandidatesForRanking = [theOneWithinLimit, ...rankedRest.slice(0, 1)];
        usedRelaxedTimeLimit = true;
      } else {
        // Only 1 candidate total, use it
        lunchCandidatesForRanking = lunchWithinTimeLimit;
        usedRelaxedTimeLimit = false;
      }
    } else {
      // If filtered set has >= 2 items: return top 2 from within-limit set
      lunchCandidatesForRanking = lunchWithinTimeLimit;
      usedRelaxedTimeLimit = false;
    }

    // Apply hybrid ranking system with appropriate mode
    const rankedLunch = rankRestaurants(
      lunchCandidatesForRanking,
      lunchCandidatesForRanking, // All candidates for normalization
      'lunch',
      weatherLunch,
      lunchMaxMinutes,
      validated.budget,
      usedRelaxedTimeLimit // Pass relaxed mode flag
    );

    const rankedDinner = rankRestaurants(
      dinnerWithETAs,
      dinnerWithETAs, // All candidates for normalization
      'dinner',
      weatherNow,
      30, // Dinner doesn't have a strict maxMinutes, use 30 as default
      validated.budget,
      false // Dinner never uses relaxed mode
    );

    // Get top 2 lunch picks (always at least 2 if possible)
    const topLunch = rankedLunch.slice(0, Math.min(2, rankedLunch.length));
    const topDinner = rankedDinner.slice(0, Math.min(15, rankedDinner.length));
    
    // Determine total viable lunch candidate count (after hard filters)
    // This represents all candidates that passed filters (open, rating, review count, etc.)
    const totalLunchCandidateCount = allCandidatesWithETA.length;
    
    // Determine if we should show "more options"
    // Show "View more options" whenever there are MORE viable candidates beyond the top 2
    // This means it appears even when exactly 2 lunch options are shown, if there are more candidates available
    // Edge case: Only show if totalLunchCandidateCount > 2 (otherwise no point showing "more")
    const showMoreOptionsEnabled = totalLunchCandidateCount > topLunch.length;
    
    // Calculate "more lunch options" if enabled
    // This should be populated whenever there are more candidates beyond the top picks
    let moreLunchOptions: Array<RestaurantWithDetails & { score: number; signals: ScoringSignals }> = [];
    const MORE_OPTIONS_COUNT = 6; // Default: 6 additional options (4-8 range, default 6)
    
    if (showMoreOptionsEnabled && totalLunchCandidateCount > topLunch.length) {
      // Get top lunch picks' placeIds to exclude duplicates
      const topLunchPlaceIds = new Set(topLunch.map(r => r.placeId));
      
      // Get remaining candidates (exclude the top picks)
      const remainingCandidates = allCandidatesWithETA.filter(r => !topLunchPlaceIds.has(r.placeId));
      
      if (remainingCandidates.length > 0) {
        // Rank remaining candidates with balanced score (quality + popularity + mealType + some ETA)
        // Use normal mode (not relaxed) for balanced scoring - prioritize quality over pure distance
        const rankedRemaining = rankRestaurants(
          remainingCandidates,
          allCandidatesWithETA, // All candidates for normalization
          'lunch',
          weatherLunch,
          lunchMaxMinutes,
          validated.budget,
          false // Normal mode for balanced scoring (not purely distance-based)
        );
        
        // Take top N options (4-6), ensuring no duplicates from top picks
        moreLunchOptions = rankedRemaining.slice(0, MORE_OPTIONS_COUNT);
        
        // Edge case: Log warning if moreLunchOptions is empty (shouldn't happen if showMoreOptionsEnabled is true)
        if (moreLunchOptions.length === 0) {
          console.warn('showMoreOptionsEnabled is true but moreLunchOptions is empty. This should not happen.');
        }
      } else {
        // Edge case: No remaining candidates (shouldn't happen if showMoreOptionsEnabled is true)
        console.warn('showMoreOptionsEnabled is true but no remaining candidates found. This should not happen.');
      }
    } else if (totalLunchCandidateCount <= topLunch.length) {
      // Edge case: totalLunchCandidateCount <= 2 (or exactly topLunch.length)
      // Do NOT show "View more options" - no empty expandable section
      // showMoreOptionsEnabled should already be false, but ensure moreLunchOptions is empty
      moreLunchOptions = [];
    }

    // Ensure we have at least 1 lunch result (we always try to return 2, but minimum 1)
    if (topLunch.length === 0) {
      if (hasCuisineFilter) {
        return NextResponse.json(
          { 
            error: `No ${validated.cuisine!.join(' or ')} restaurants found that meet quality criteria. Please try a different location, remove the cuisine filter, or increase the search radius.` 
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'No restaurants found that meet quality criteria. Please try a different location or increase the search radius.' },
        { status: 404 }
      );
    }

    // Dinner is optional - don't require it
    if (topDinner.length === 0 && hasCuisineFilter) {
      return NextResponse.json(
        { 
          error: `No ${validated.cuisine!.join(' or ')} restaurants found for dinner that meet quality criteria. Please try a different location, remove the cuisine filter, or increase the search radius.` 
        },
        { status: 404 }
      );
    }

    // 9. Get place details again for final output (photos, website, etc.)
    // We already have some details, but get full details for final output
    const [finalLunchDetails, finalDinnerDetails, finalMoreLunchDetails] = await Promise.all([
      Promise.all(topLunch.map(r => getPlaceDetails(apiKey, r.placeId))),
      topDinner.length > 0 ? Promise.all(topDinner.map(r => getPlaceDetails(apiKey, r.placeId))) : Promise.resolve([]),
      moreLunchOptions.length > 0 ? Promise.all(moreLunchOptions.map(r => getPlaceDetails(apiKey, r.placeId))) : Promise.resolve([]),
    ]);

    // 4. Build output
    const output: RecommendationOutput = {
      context: {
        resolvedLocation: {
          lat: location.lat,
          lng: location.lng,
          address: location.address || location.formatted,
          city: location.city,
          state: location.state,
          formatted: location.formatted || location.address,
        },
        weatherSummary: {
          tempC: weatherNow.tempC,
          condition: weatherNow.condition,
          isRainy: weatherNow.isRainy,
          isCold: weatherNow.isCold,
          isHot: weatherNow.isHot,
          // Structured weather fields
          temperatureC: weatherNow.temperatureC,
          feelsLikeC: weatherNow.feelsLikeC_temp,
          windSpeedMs: weatherNow.windSpeedMs,
          precipitationMm: weatherNow.precipitationMm,
          rainMm: weatherNow.rainMm,
        },
        holiday,
        lunchDistanceInfo: {
          maxMinutes: lunchMaxMinutes,
          radiusMeters: lunchRadiusMeters,
          wasAutoSelected: !validated.maxLunchMinutes,
          weatherReason: weatherReason,
          maxWalkMinutes: lunchMaxMinutes,
          usedRelaxedTimeLimit: usedRelaxedTimeLimit,
          weatherBucket: weatherBucket,
          lunchWithinLimitCount: lunchWithinLimitCount,
          showMoreOptionsEnabled: showMoreOptionsEnabled,
        },
      },
      lunch: topLunch.map((restaurant, idx) => {
        const details = finalLunchDetails[idx];
        const etaMinutes = restaurant.etaMinutes ?? 10; // Use calculated ETA or fallback
        
        return {
          name: restaurant.name,
          why: generateWhyReasonsFromSignals(
            restaurant.signals!,
            etaMinutes
          ),
          suggestedDishes: generateSuggestedDishes(restaurant.types),
          etaMinutes,
          websiteUrl: details.websiteUrl,
          mapsUrl: details.googleMapsUrl,
          placeId: restaurant.placeId,
          photoUrl: details.photos && details.photos.length > 0 ? details.photos[0] : undefined,
        };
      }),
      dinner: topDinner.map((restaurant, idx) => {
        const details = finalDinnerDetails[idx];
        const etaMinutes = restaurant.etaMinutes ?? 15; // Use calculated ETA or fallback
        
        return {
          name: restaurant.name,
          why: generateWhyReasonsFromSignals(
            restaurant.signals!,
            etaMinutes
          ),
          suggestedDishes: generateSuggestedDishes(restaurant.types),
          etaMinutes,
          websiteUrl: details.websiteUrl,
          mapsUrl: details.googleMapsUrl,
          reservationTip: details.reservableHint ? 'Reservations recommended' : undefined,
          placeId: restaurant.placeId,
          photoUrl: details.photos && details.photos.length > 0 ? details.photos[0] : undefined,
        };
      }),
      ...(moreLunchOptions.length > 0 && showMoreOptionsEnabled ? {
        moreLunchOptions: moreLunchOptions.map((restaurant, idx) => {
          const details = finalMoreLunchDetails[idx];
          const etaMinutes = restaurant.etaMinutes ?? 15; // Use calculated ETA or fallback
          
          return {
            name: restaurant.name,
            why: generateWhyReasonsFromSignals(
              restaurant.signals!,
              etaMinutes
            ),
            suggestedDishes: generateSuggestedDishes(restaurant.types),
            etaMinutes,
            websiteUrl: details?.websiteUrl,
            mapsUrl: details?.googleMapsUrl || `https://www.google.com/maps/place/?q=place_id:${restaurant.placeId}`,
            placeId: restaurant.placeId,
            photoUrl: details?.photos && details.photos.length > 0 ? details.photos[0] : undefined,
          };
        })
      } : {}),
    };

    return NextResponse.json(output);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Recommendation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
