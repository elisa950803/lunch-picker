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
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [maxLunchMinutes, setMaxLunchMinutes] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
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

  // Load persisted form data from sessionStorage on mount
  // Safari diagnostics and hydration check
  useEffect(() => {
    // Hide in dev mode by default, only show if DEBUG_UI flag is set
    // In production, debug panel is completely removed (not rendered)
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const debugFlag = localStorage.getItem('DEBUG_UI') === '1';
      setShowDebugPanel(debugFlag);
    }
    
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
        // Only load cuisine if explicitly set (not from defaults)
        // Empty arrays are valid, so we check for existence
        if (formData.cuisine !== undefined && formData.cuisine.length > 0) {
          setCuisine(formData.cuisine);
        } else {
          // Default cuisine preferences if none selected
          setCuisine(['healthy', 'chinese', 'mediterranean']);
        }
        if (formData.maxLunchMinutes) setMaxLunchMinutes(formData.maxLunchMinutes);
      } else {
        // No stored data - set default cuisine preferences
        setCuisine(['healthy', 'chinese', 'mediterranean']);
      }
    } catch (err) {
      console.warn('Failed to load persisted form data:', err);
      // On error, set default cuisine preferences
      setCuisine(['healthy', 'chinese', 'mediterranean']);
    }
  }, []);

  // Save form data to sessionStorage whenever it changes
  useEffect(() => {
    const formData: FormData = {
      locationText,
      placeId: selectedPlace?.placeId,
      lat: selectedPlace?.lat,
      lng: selectedPlace?.lng,
      city: selectedPlace?.city,
      state: selectedPlace?.state,
      cuisine,
      maxLunchMinutes,
    };
    safeSetItem('sessionStorage', FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [locationText, selectedPlace, cuisine, maxLunchMinutes]);

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
  };

  const handleQuickFillBryantPark = () => {
    // Bryant Park preset - uses lat/lng directly (no placeId) to avoid validation issues
    // This ensures it always works without requiring dropdown selection
    const ONE_BRYANT_PARK: SelectedPlace = {
      placeId: '', // Empty placeId - use lat/lng directly to bypass placeId validation
      locationText: 'Bryant Park, New York, NY',
      lat: 40.7536,
      lng: -73.9832,
      city: 'New York',
      state: 'NY',
      formattedAddress: 'Bryant Park, New York, NY 10018, USA',
    };
    
    setLocationError('');
    setIsLoadingLocation(false);
    
    // Clear previous cuisine selections to avoid defaults
    setCuisine([]);
    
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
      (err: GeolocationPositionError) => {
        setIsLoadingLocation(false);
        
        // Check if error is permission denied
        if (err.code === 1) { // PERMISSION_DENIED
          // Detect iOS (iPhone/iPad) and browser type
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isChrome = /CriOS|Chrome/.test(navigator.userAgent);
          const isSafari = !isChrome && /Safari/.test(navigator.userAgent);
          
          if (isIOS) {
            // Determine browser name for settings path
            const browserName = isChrome ? 'Chrome' : 'Safari';
            
            // Show alert with iPhone-specific instructions
            alert(
              'Location access is blocked.\n\n' +
              `To enable location services on iPhone:\n\n` +
              '1. Open iPhone Settings\n' +
              `2. Scroll down and tap "${browserName}"\n` +
              '3. Scroll down and tap "Location Services"\n' +
              '4. Make sure "Location Services" is enabled\n' +
              '5. Find this website and set it to "Ask" or "Allow"\n\n' +
              'Alternatively, you can enter an address manually.'
            );
          } else {
            // Show generic permission denied message for non-iOS devices
            alert(
              'Location access is blocked.\n\n' +
              'Please enable location services in your browser settings, ' +
              'or enter an address manually.'
            );
          }
          setLocationError('Location access denied. Please enable location services or enter an address manually.');
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setLocationError('Unable to determine your location. Please enter an address manually.');
        } else if (err.code === 3) { // TIMEOUT
          setLocationError('Location request timed out. Please try again or enter an address manually.');
        } else {
          setLocationError('Unable to get your location. Please enable location services or enter an address manually.');
        }
      }
    );
  };

  // UX Fix #3: Extract submission logic so it can be called from both handleSubmit and handleRetry
  const performSubmission = async () => {
    setSubmitError(null);

    try {
      // Default cuisine preferences if none selected
      const defaultCuisine = ['healthy', 'chinese', 'mediterranean'];
      const cuisineToUse = cuisine.length > 0 ? cuisine : defaultCuisine;

      const requestBody: any = {
        cuisine: cuisineToUse,
        maxLunchMinutes: typeof maxLunchMinutes === 'number' ? maxLunchMinutes : undefined,
      };

      // Prefer placeId, then lat/lng, then locationText (fallback geocoding)
      if (selectedPlace?.placeId) {
        requestBody.placeId = selectedPlace.placeId;
      } else if (selectedPlace?.lat && selectedPlace?.lng && selectedPlace.lat !== 0 && selectedPlace.lng !== 0) {
        requestBody.lat = selectedPlace.lat;
        requestBody.lng = selectedPlace.lng;
      } else {
        // UX Fix #1: Allow submission with just locationText - backend will geocode it
        requestBody.locationText = locationText.trim();
      }

      // Check if apiBaseUrl exists, else show demo mode message
      if (!apiBaseUrl) {
        setSubmitError('Backend server URL is not configured. Please configure the API_BASE_URL in config.json to enable recommendations.');
        return; // Keep isSubmitting true to show error on loading screen
      }

      // Use backend API (from config.json)
      const data = await getRecommendations(requestBody, apiBaseUrl);
      
      // Store results in sessionStorage and navigate
      safeSetItem('sessionStorage', 'recommendationResults', JSON.stringify(data));
      setIsSubmitting(false);
      router.push('/results');
    } catch (err) {
      // UX Fix #1: Handle geocoding errors with friendly messages
      let errorMessage = err instanceof Error ? err.message : 'An error occurred';
      
      // Check if error is about location not in US
      if (errorMessage.includes('Location must be in the United States') || errorMessage.includes('must be in the United States')) {
        errorMessage = 'Location must be in the United States. Please try a US address or select a suggestion from the dropdown.';
      } else if (errorMessage.includes('Could not find location') || errorMessage.includes('Geocoding failed') || errorMessage.includes('ZERO_RESULTS')) {
        errorMessage = "Couldn't locate that address — try selecting a suggestion or adding city/state.";
      }
      
      setSubmitError(errorMessage);
      // UX Fix #3: Keep isSubmitting true to show error on loading screen (don't reset to form)
      // Don't set setIsSubmitting(false) here - let user retry or go back
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLocationError('');
    setSubmitError(null);

    if (!locationText.trim()) {
      setLocationError('Location is required');
      return;
    }

    // UX Fix #1: Allow submission without selectedPlace - backend will geocode locationText
    // Removed validation that required selectedPlace; backend handles geocoding

    setIsSubmitting(true);
    await performSubmission();
  };

  // UX Fix #3: Handler to retry submission (resets error and resubmits)
  const handleRetry = async () => {
    // Ensure isSubmitting is true FIRST to prevent any flicker back to form
    setIsSubmitting(true);
    setSubmitError(null);
    // Resubmit (this will maintain isSubmitting=true throughout)
    await performSubmission();
  };

  // UX Fix #3: Show loading state (with optional error) until success or explicit cancel
  if (isSubmitting) {
    return (
      <AppShell>
        <LoadingState error={submitError || null} onRetry={submitError ? handleRetry : undefined} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Safari Diagnostics: Hidden in dev mode by default (enable with localStorage.DEBUG_UI='1'), removed in production */}
        {process.env.NODE_ENV !== 'production' && showDebugPanel && (
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
                  <span>{isLoadingLocation ? 'Loading...' : 'Bryant Park'}</span>
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
              {configLoaded && (
                <p className="mt-1.5 text-xs text-gray-400">
                  API: {apiBaseUrl || 'Loading...'}
                </p>
              )}
            </div>

            {/* Pick for me button - visible on desktop/tablet, hidden on mobile (sticky bar shows it) */}
            <button
              type="submit"
              disabled={isSubmitting || locationText.trim().length === 0}
              className={`
                w-full px-6 py-4 rounded-full font-bold text-lg transition-all shadow-lg transform
                hidden md:block
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

            {/* Preferences accordion - collapsed by default */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl border-2 border-gray-200 transition-all">
                  <span className="text-sm font-semibold text-gray-700">
                    Preferences (optional)
                  </span>
                  <span className="text-gray-500 transform transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </div>
              </summary>
              <div className="mt-4 space-y-6 pl-0">
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
              </div>
            </details>
          </form>
        </Card>

        {/* Mobile-only sticky bottom CTA bar */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-3 safe-area-inset-bottom">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
            disabled={isSubmitting || locationText.trim().length === 0}
            className={`
              w-full px-6 py-4 rounded-full font-bold text-lg transition-all shadow-lg transform
              ${locationText.trim().length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white active:bg-orange-700'
              }
            `}
          >
            {locationText.trim().length === 0 ? (
              'Enter location to start 🥟'
            ) : (
              'Pick for me 🍽️'
            )}
          </button>
        </div>

        {/* Add padding-bottom on mobile to prevent content from being covered by sticky bar */}
        <div className="h-24 md:h-0"></div>
      </div>
    </AppShell>
  );
}
