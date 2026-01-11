'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from './components/AppShell';
import Card from './components/Card';
import Badge from './components/Badge';
import LoadingState from './components/LoadingState';
import LocationAutocomplete from './components/LocationAutocomplete';
import { safeGetItem, safeSetItem } from './utils/storage';
import { getRecommendations } from './lib/api';
import { useConfig } from './components/ConfigProvider';

const DIETARY_OPTIONS = [
  'vegan',
  'kosher',
  'halal',
];

const CUISINE_OPTIONS = [
  'healthy',
  'thai',
  'korean',
  'chinese',
  'japanese',
  'spanish',
  'mediterranean',
  'mexican',
  'american',
];

const FORM_STORAGE_KEY = 'recommendationFormData';

interface FormData {
  locationText: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  budget: 'low' | 'mid' | 'high' | '';
  dietary: string[];
  cuisine: string[];
  maxLunchMinutes: number | '';
}

interface SelectedPlace {
  placeId: string;
  locationText: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  formattedAddress?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { apiBaseUrl, loaded: configLoaded } = useConfig();
  const [locationText, setLocationText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [locationError, setLocationError] = useState('');
  const [budget, setBudget] = useState<'low' | 'mid' | 'high' | ''>('');
  const [userTouchedBudget, setUserTouchedBudget] = useState(false);
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [maxLunchMinutes, setMaxLunchMinutes] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<{
    hydrated: boolean;
    googlePlaces: 'loading' | 'loaded' | 'missing' | 'error';
    storage: 'ok' | 'blocked' | 'unknown';
    lastError: string | null;
  }>({
    hydrated: false,
    googlePlaces: 'loading',
    storage: 'unknown',
    lastError: null,
  });

  // Load persisted form data from sessionStorage on mount (only location, not budget)
  // Safari diagnostics and hydration check
  useEffect(() => {
    setDebugInfo(prev => ({ ...prev, hydrated: true }));
    
    // Check storage availability
    try {
      const testKey = '__storage_test__';
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(testKey, 'test');
        window.sessionStorage.removeItem(testKey);
        setDebugInfo(prev => ({ ...prev, storage: 'ok' }));
      } else {
        setDebugInfo(prev => ({ ...prev, storage: 'blocked' }));
      }
    } catch (e) {
      setDebugInfo(prev => ({ ...prev, storage: 'blocked' }));
    }

    // Check Google Places API
    let checkCount = 0;
    const maxChecks = 25; // 5 seconds (25 * 200ms)
    const checkInterval = setInterval(() => {
      checkCount++;
      const googleMaps = (window as any).google;
      if (googleMaps?.maps?.places?.AutocompleteService) {
        setDebugInfo(prev => ({ ...prev, googlePlaces: 'loaded' }));
        clearInterval(checkInterval);
      } else if (checkCount >= maxChecks) {
        setDebugInfo(prev => ({ ...prev, googlePlaces: 'missing' }));
        clearInterval(checkInterval);
      }
    }, 200);

    // Global error handlers (dev only)
    if (process.env.NODE_ENV === 'development') {
      const errorHandler = (event: ErrorEvent) => {
        setDebugInfo(prev => ({ ...prev, lastError: event.message || String(event.error) }));
      };
      const rejectionHandler = (event: PromiseRejectionEvent) => {
        setDebugInfo(prev => ({ ...prev, lastError: String(event.reason) }));
      };
      window.addEventListener('error', errorHandler);
      window.addEventListener('unhandledrejection', rejectionHandler);
      return () => {
        clearInterval(checkInterval);
        window.removeEventListener('error', errorHandler);
        window.removeEventListener('unhandledrejection', rejectionHandler);
      };
    }

    return () => clearInterval(checkInterval);
  }, []);

  // Load form data from storage
  useEffect(() => {
    try {
      const stored = safeGetItem('sessionStorage', FORM_STORAGE_KEY);
      if (stored) {
        const formData: FormData = JSON.parse(stored);
        if (formData.locationText) setLocationText(formData.locationText);
        if (formData.placeId && formData.lat && formData.lng) {
          setSelectedPlace({
            placeId: formData.placeId,
            locationText: formData.locationText,
            lat: formData.lat,
            lng: formData.lng,
            city: formData.city,
            state: formData.state,
          });
        }
        // BUGFIX: Never auto-load budget from sessionStorage - always default to "Any budget"
        // Only load dietary/cuisine if explicitly set (not from defaults)
        // Empty arrays are valid, so we check for existence
        if (formData.dietary !== undefined && formData.dietary.length > 0) setDietary(formData.dietary);
        if (formData.cuisine !== undefined && formData.cuisine.length > 0) setCuisine(formData.cuisine);
        if (formData.maxLunchMinutes) setMaxLunchMinutes(formData.maxLunchMinutes);
        // Budget is intentionally NOT loaded - always starts as "Any budget" (empty string)
      }
    } catch (err) {
      console.warn('Failed to load persisted form data:', err);
    }
  }, []);

  // Save form data to sessionStorage whenever it changes (but never restore budget)
  // Budget should always default to "Any budget" (empty string) unless user explicitly changes it
  useEffect(() => {
    const formData: FormData = {
      locationText,
      placeId: selectedPlace?.placeId,
      lat: selectedPlace?.lat,
      lng: selectedPlace?.lng,
      city: selectedPlace?.city,
      state: selectedPlace?.state,
      budget: userTouchedBudget ? budget : '', // Only save budget if user explicitly set it
      dietary,
      cuisine,
      maxLunchMinutes,
    };
    safeSetItem('sessionStorage', FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [locationText, selectedPlace, budget, dietary, cuisine, maxLunchMinutes, userTouchedBudget]);

  const toggleDietary = (option: string) => {
    setDietary((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const toggleCuisine = (option: string) => {
    setCuisine((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const handlePlaceSelected = (place: SelectedPlace) => {
    setSelectedPlace(place);
    setLocationError('');
    setLocationText(place.locationText);
    // BUGFIX: Never change budget when place is selected - budget remains "Any budget" unless user explicitly changes it
    // Assertion: budget should not change after place selection
    if (budget !== '' && !userTouchedBudget) {
      console.warn('Budget unexpectedly changed during place selection. Resetting to "Any budget".');
      setBudget('');
    }
  };

  const handleQuickFillBryantPark = () => {
    // One Bryant Park preset - works without API calls
    const ONE_BRYANT_PARK: SelectedPlace = {
      placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', // Known place ID for One Bryant Park
      locationText: 'One Bryant Park, New York, NY',
      lat: 40.7537,
      lng: -73.9832,
      city: 'New York',
      state: 'NY',
      formattedAddress: 'One Bryant Park, New York, NY 10036, USA',
    };
    
    setLocationError('');
    setIsLoadingLocation(false);
    
    // Clear previous dietary/cuisine selections to avoid defaults
    setDietary([]);
    setCuisine([]);
    
    // BUGFIX: Never change budget when preset button is clicked - always keep "Any budget" (empty string)
    // Budget should remain "Any budget" unless user explicitly changes the dropdown
    // Assertion: budget should not change after preset button click
    if (budget !== '' && !userTouchedBudget) {
      // If budget was somehow set without user interaction, reset it
      setBudget('');
    }
    
    setSelectedPlace(ONE_BRYANT_PARK);
    setLocationText(ONE_BRYANT_PARK.locationText);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Check if Google Maps Geocoder is available
          const googleMaps = (window as any).google;
          if (!googleMaps?.maps?.Geocoder) {
            // Wait a bit for the script to load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!googleMaps?.maps?.Geocoder) {
              // Fallback: use coordinates directly, server will handle geocoding
              const place: SelectedPlace = {
                placeId: '',
                locationText: 'Current Location',
                lat: latitude,
                lng: longitude,
              };
              setSelectedPlace(place);
              setLocationText('Current Location');
              setLocationError('');
              setIsLoadingLocation(false);
              return;
            }
          }

          // Use Google Maps Geocoder service (already loaded via script)
          const Geocoder = googleMaps.maps.Geocoder;
          const geocoder = new Geocoder();
          const latlng = { lat: latitude, lng: longitude };

          geocoder.geocode({ location: latlng }, (results: any[] | null, status: string) => {
            if (status === 'OK' && results && results.length > 0) {
              const result = results[0];
              
              // Extract city and state
              let city: string | undefined;
              let state: string | undefined;
              
              if (result.address_components) {
                for (const component of result.address_components) {
                  const types = component.types;
                  if (!city && (types.includes('locality') || types.includes('sublocality') || types.includes('administrative_area_level_2'))) {
                    city = component.long_name;
                  }
                  if (!state && types.includes('administrative_area_level_1')) {
                    state = component.short_name;
                  }
                }
              }

              const place: SelectedPlace = {
                placeId: result.place_id || '',
                locationText: result.formatted_address || 'Current Location',
                lat: latitude,
                lng: longitude,
                city,
                state,
                formattedAddress: result.formatted_address,
              };

              setSelectedPlace(place);
              setLocationText(place.locationText);
              setLocationError('');
            } else {
              // Fallback: use coordinates directly, server will handle geocoding
              const place: SelectedPlace = {
                placeId: '',
                locationText: 'Current Location',
                lat: latitude,
                lng: longitude,
              };
              setSelectedPlace(place);
              setLocationText('Current Location');
              setLocationError('');
            }
            setIsLoadingLocation(false);
          });
        } catch (err) {
          console.error('Geocoding error:', err);
          // Fallback: use coordinates directly, server will handle geocoding
          const place: SelectedPlace = {
            placeId: '',
            locationText: 'Current Location',
            lat: latitude,
            lng: longitude,
          };
          setSelectedPlace(place);
          setLocationText('Current Location');
          setLocationError('');
          setIsLoadingLocation(false);
        }
      },
      (err) => {
        setLocationError('Unable to get your location. Please enable location services or enter an address manually.');
        setIsLoadingLocation(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLocationError('');

    if (!locationText.trim()) {
      setLocationError('Location is required');
      return;
    }

    // Validate that user selected a suggestion (has placeId or lat/lng)
    // But allow submission if locationText is set and we're waiting for async place lookup
    if (!selectedPlace && locationText.trim() && !isLoadingLocation) {
      setLocationError('Please pick a suggestion so we can locate it accurately.');
      return;
    }

    setIsSubmitting(true);

    try {
      const requestBody: any = {
        budget: budget || undefined,
        dietary: dietary.length > 0 ? dietary : undefined,
        cuisine: cuisine.length > 0 ? cuisine : undefined,
        maxLunchMinutes: typeof maxLunchMinutes === 'number' ? maxLunchMinutes : undefined,
      };

      // Prefer placeId, then lat/lng, then locationText
      if (selectedPlace?.placeId) {
        requestBody.placeId = selectedPlace.placeId;
      } else if (selectedPlace?.lat && selectedPlace?.lng && selectedPlace.lat !== 0 && selectedPlace.lng !== 0) {
        requestBody.lat = selectedPlace.lat;
        requestBody.lng = selectedPlace.lng;
      } else {
        requestBody.locationText = locationText.trim();
      }

      // Use backend API (from config.json)
      if (!apiBaseUrl) {
        throw new Error('Full recommendations require a backend server. Please set API_BASE_URL in config.json. Demo buttons are available for testing.');
      }

      const data = await getRecommendations(requestBody, apiBaseUrl);
      
      // Store results in sessionStorage and navigate
      safeSetItem('sessionStorage', 'recommendationResults', JSON.stringify(data));
      setIsSubmitting(false);
      router.push('/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Safari Diagnostics (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
            <div className="font-semibold mb-1">Safari Diagnostics:</div>
            <div>Hydration: {debugInfo.hydrated ? '✓ ON' : '✗ OFF'}</div>
            <div>Google Places: {debugInfo.googlePlaces}</div>
            <div>Storage: {debugInfo.storage}</div>
            {debugInfo.lastError && (
              <div className="text-red-600 mt-1">Error: {debugInfo.lastError.substring(0, 100)}</div>
            )}
          </div>
        )}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Where are you and what are you craving?
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            Li's got this 🥟
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
                <span className="font-semibold">Oops!</span> {error}
              </div>
            )}

            <div>
              <label htmlFor="locationText" className="block text-sm font-semibold text-gray-700 mb-2">
                Work Location <span className="text-orange-500">*</span>
              </label>
              <LocationAutocomplete
                value={locationText}
                onChange={setLocationText}
                onPlaceSelected={handlePlaceSelected}
                disabled={isSubmitting}
                placeholder="e.g., Bryant Park, NYC"
                error={locationError}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleQuickFillBryantPark}
                  disabled={isSubmitting || isLoadingLocation}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full border border-blue-300 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>🏢</span>
                  <span>{isLoadingLocation ? 'Loading...' : 'One Bryant Park'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isSubmitting || isLoadingLocation}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-full border border-orange-300 hover:border-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>📍</span>
                  <span>{isLoadingLocation ? 'Loading...' : 'Use my current location'}</span>
                </button>
              </div>
              {!locationError && !selectedPlace && (
                <p className="mt-1.5 text-xs text-gray-500">
                  💡 Where do you work? We'll find the best spots nearby!
                </p>
              )}
            </div>

            <div>
              <label htmlFor="budget" className="block text-sm font-semibold text-gray-700 mb-2">
                Budget
              </label>
              <select
                id="budget"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all bg-white cursor-pointer text-gray-700"
                value={budget}
                onChange={(e) => {
                  setBudget(e.target.value as 'low' | 'mid' | 'high' | '');
                  setUserTouchedBudget(true); // Mark that user explicitly changed budget
                }}
                disabled={isSubmitting}
              >
                <option value="">Any budget 💰</option>
                <option value="low">Low ($) - Wallet-friendly</option>
                <option value="mid">Mid ($$) - Nice balance</option>
                <option value="high">High ($$$) - Treat yourself</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Choose your spending comfort zone
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Dietary Preferences
              </label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((option) => {
                  const isSelected = dietary.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleDietary(option)}
                      disabled={isSubmitting}
                      className={`
                        inline-flex items-center px-4 py-2 rounded-full border-2 cursor-pointer transition-all font-medium text-sm
                        ${isSelected
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Select any dietary requirements
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cuisine Preferences
              </label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map((option) => {
                  const isSelected = cuisine.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleCuisine(option)}
                      disabled={isSubmitting}
                      className={`
                        inline-flex items-center px-4 py-2 rounded-full border-2 cursor-pointer transition-all font-medium text-sm
                        ${isSelected
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-orange-300 hover:bg-orange-50'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Pick your favorite flavors (or skip for variety!)
              </p>
            </div>

            <div>
              <label htmlFor="maxLunchMinutes" className="block text-sm font-semibold text-gray-700 mb-2">
                Max Lunch Time (minutes)
              </label>
              <input
                type="number"
                id="maxLunchMinutes"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-base focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                value={maxLunchMinutes}
                onChange={(e) => setMaxLunchMinutes(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                placeholder="Auto-selected based on weather"
                min="1"
                max="120"
                disabled={isSubmitting}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                ⚡ Optional - We'll auto-select based on weather if you skip this (5 min for bad weather, 20 min otherwise)
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || locationText.trim().length === 0}
              className={`
                w-full px-6 py-4 rounded-full font-bold text-lg transition-all shadow-lg transform
                ${locationText.trim().length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                }
              `}
            >
              {locationText.trim().length === 0 ? (
                'Enter location to start 🥟'
              ) : (
                'Pick for me 🍽️'
              )}
            </button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
