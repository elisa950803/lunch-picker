'use client';

import { useEffect, useRef, useState } from 'react';
import LocationSuggestDropdown from './LocationSuggestDropdown';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: {
    placeId: string;
    locationText: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    formattedAddress?: string;
  }) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
}

declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, options?: { types?: string[]; componentRestrictions?: { country: string } }) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => {
              place_id: string;
              formatted_address?: string;
              geometry?: {
                location: {
                  lat: () => number;
                  lng: () => number;
                };
              };
              address_components?: Array<{
                long_name: string;
                short_name: string;
                types: string[];
              }>;
              name?: string;
            };
          };
        };
        Geocoder: new () => {
          geocode: (
            request: { location?: { lat: number; lng: number }; placeId?: string },
            callback: (results: any[] | null, status: string) => void
          ) => void;
        };
      };
    };
  }
}

export default function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  disabled = false,
  placeholder = 'e.g., Bryant Park, NYC',
  error,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null); // Google Maps Autocomplete instance
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false); // Track if script failed to load after timeout
  const [selectedPlace, setSelectedPlace] = useState<{
    city?: string;
    state?: string;
    formattedAddress?: string;
  } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper function to set up place_changed listener
  // This is extracted to avoid recreating it on every render
  // Defined before useEffect that uses it
  const setupPlaceChangedListener = (autocomplete: any) => {
    // Handle place selection
    // Store callbacks in refs to avoid re-initializing autocomplete when callbacks change
    const placeChangedHandler = () => {
      const place = autocomplete.getPlace();

      // Error handling: If place has no geometry/placeId, show friendly error
      if (!place.geometry || !place.geometry.location || !place.place_id) {
        console.warn('Place selected but missing geometry or place_id:', place);
        // Don't clear the input, but show an error state
        // The user can still type and try again
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Extract city and state from address_components
      let extractedCity: string | undefined;
      let extractedState: string | undefined;

      if (place.address_components) {
        for (const component of place.address_components) {
          const types = component.types;
          
          // Extract city (locality, sublocality, or administrative_area_level_2)
          if (!extractedCity) {
            if (types.includes('locality')) {
              extractedCity = component.long_name;
            } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              extractedCity = component.long_name;
            } else if (types.includes('administrative_area_level_2')) {
              extractedCity = component.long_name;
            }
          }
          
          // Extract state (administrative_area_level_1 short_name)
          if (!extractedState && types.includes('administrative_area_level_1')) {
            extractedState = component.short_name; // e.g., "NY" instead of "New York"
          }
        }
      }

      const locationText = place.name || place.formatted_address || (inputRef.current?.value || '');
      
      setSelectedPlace({
        city: extractedCity,
        state: extractedState,
        formattedAddress: place.formatted_address,
      });

      // Use refs to avoid dependency issues
      onPlaceSelectedRef.current({
        placeId: place.place_id,
        locationText,
        lat,
        lng,
        city: extractedCity,
        state: extractedState,
        formattedAddress: place.formatted_address,
      });

      onChangeRef.current(locationText);
    };

    autocomplete.addListener('place_changed', placeChangedHandler);
  };

  // Keep refs updated with latest callbacks to avoid dependency issues
  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onChange, onPlaceSelected]);

  // Check if Google Maps is loaded
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const maxRetries = 40; // 8 seconds max (40 * 200ms)
    
    const checkGoogleMaps = () => {
      const googleMaps = (window as any).google;
      if (googleMaps?.maps?.places?.Autocomplete) {
        setIsGoogleMapsLoaded(true);
        setLoadTimeout(false); // Clear timeout flag if maps loaded successfully
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
        // Places API is enabled, billing is enabled, key referrer restrictions allow localhost during dev
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (checkGoogleMaps()) {
      return;
    }
    
    // Check periodically with longer intervals
    intervalId = setInterval(() => {
      retryCount++;
      if (checkGoogleMaps()) {
        return;
      }
      
      if (retryCount >= maxRetries) {
        // Timeout after 8 seconds
        if (intervalId) clearInterval(intervalId);
        console.warn('Google Maps Places API: Script did not load within 8 seconds. Autocomplete unavailable — you can type manually or use current location.');
        setIsGoogleMapsLoaded(true); // Set as "loaded" to stop showing loading message
        setLoadTimeout(true); // Mark that script failed to load
      }
    }, 200);
    
    // Final timeout safeguard (8 seconds)
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      const googleMaps = (window as any).google;
      if (!googleMaps?.maps?.places) {
        console.warn('Google Maps script failed to load. Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, referrer restrictions, billing, and Places API enablement.');
        setIsGoogleMapsLoaded(true); // Stop loading indicator
        setLoadTimeout(true); // Mark that script failed to load
      }
    }, 8000);
    
    // Cleanup
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Initialize autocomplete when Google Maps is loaded
  useEffect(() => {
    // Wait for input element to be rendered and Google Maps to be loaded
    if (!inputRef.current || disabled || !isGoogleMapsLoaded) {
      return;
    }

    try {
      const googleMaps = (window as any).google;
      if (!googleMaps?.maps?.places?.Autocomplete) {
        // Dev safeguard: log warning if script failed to load
        if (typeof window !== 'undefined') {
          console.warn('Google Maps Places API not available. Ensure:', {
            scriptLoaded: !!googleMaps,
            placesAvailable: !!googleMaps?.maps?.places,
            autocompleteAvailable: !!googleMaps?.maps?.places?.Autocomplete,
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Set' : 'Missing',
            note: 'Check: Places API enabled, billing enabled, key referrer restrictions allow localhost'
          });
        }
        return;
      }

      // Only initialize autocomplete once - if it already exists, don't re-initialize
      // Re-initializing breaks the autocomplete suggestions
      if (autocompleteRef.current) {
        return; // Autocomplete already initialized, don't re-create
      }

      // Ensure input element is actually in the DOM before initializing
      if (!inputRef.current || !document.body.contains(inputRef.current)) {
        // Input not in DOM yet, wait a bit
        const timeoutId = setTimeout(() => {
          if (inputRef.current && document.body.contains(inputRef.current) && !autocompleteRef.current) {
            // Retry initialization after a short delay
            const AutocompleteClass = googleMaps.maps.places.Autocomplete;
            try {
              const autocomplete = new AutocompleteClass(inputRef.current, {
                types: ['geocode'], // Only geocoding results (addresses, not businesses)
                componentRestrictions: { country: 'us' }, // Restrict to US only
              });
              autocompleteRef.current = autocomplete;
              setupPlaceChangedListener(autocomplete);
            } catch (err) {
              console.error('Failed to initialize Google Places Autocomplete (retry):', err);
            }
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }

      // Initialize Google Places Autocomplete
      // Places API enabled, billing is enabled, key referrer restrictions allow localhost during dev
      const AutocompleteClass = googleMaps.maps.places.Autocomplete;
      const autocomplete = new AutocompleteClass(inputRef.current, {
        types: ['geocode'], // Only geocoding results (addresses, not businesses)
        componentRestrictions: { country: 'us' }, // Restrict to US only
      });

      autocompleteRef.current = autocomplete;
      setupPlaceChangedListener(autocomplete);
    } catch (err) {
      console.error('Failed to initialize Google Places Autocomplete:', err);
      // Dev safeguard: log error details
      if (process.env.NODE_ENV === 'development') {
        console.error('Autocomplete initialization error details:', err);
      }
    }

    // Cleanup: Don't destroy autocomplete instance, just stop listening
    // Autocomplete should persist for the lifetime of the component
    return () => {
      // Note: Google Maps Autocomplete doesn't have a removeListener method
      // The autocomplete instance will be cleaned up when the component unmounts
      // We only nullify the ref to prevent re-initialization
    };
    // Only re-initialize if Google Maps loading state or disabled state changes
    // Removed onChange, onPlaceSelected, and value from dependencies to prevent re-initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGoogleMapsLoaded, disabled]);

  // Handle manual input change (user typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    // Clear selected place info when user manually types
    if (newValue !== selectedPlace?.formattedAddress) {
      setSelectedPlace(null);
    }
    // Show dropdown if user has typed 2+ characters and input has focus
    if (newValue.trim().length >= 2 && hasFocus) {
      setShowDropdown(true);
    } else if (newValue.trim().length < 2) {
      setShowDropdown(false);
    }
  };

  // Handle suggestion selection from dropdown
  const handleSuggestionSelect = (suggestion: {
    label: string;
    placeId?: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
  }) => {
    // Update location text
    onChange(suggestion.label);
    
    // Set selected place
    setSelectedPlace({
      city: suggestion.city,
      state: suggestion.state,
      formattedAddress: suggestion.label,
    });

    // Call onPlaceSelected with the suggestion data
    onPlaceSelectedRef.current({
      placeId: suggestion.placeId || '',
      locationText: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
      city: suggestion.city,
      state: suggestion.state,
      formattedAddress: suggestion.label,
    });

    // Close dropdown
    setShowDropdown(false);
  };

  // Handle input focus
  const handleFocus = () => {
    setHasFocus(true);
    // Show dropdown if there's text (2+ chars)
    if (value.trim().length >= 2) {
      setShowDropdown(true);
    }
  };

  // Handle input blur (we delay to allow dropdown clicks)
  const handleBlur = () => {
    // Delay closing to allow dropdown clicks
    setTimeout(() => {
      setHasFocus(false);
      setShowDropdown(false);
    }, 200);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id="locationText"
        name="locationText"
        className={`w-full px-4 py-3 border-2 rounded-2xl text-base focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all ${
          error ? 'border-red-300' : 'border-gray-200'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required
        disabled={disabled}
        autoComplete="off"
      />
      
      {/* In-app dropdown suggestions */}
      <LocationSuggestDropdown
        query={value}
        onSelect={handleSuggestionSelect}
        isOpen={showDropdown && !disabled && value.trim().length >= 2}
        onClose={() => setShowDropdown(false)}
        inputRef={inputRef}
      />
      
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-start gap-1">
          <span>⚠️</span>
          <span>{error}</span>
        </p>
      )}
      
      {selectedPlace && !error && (
        <p className="mt-1.5 text-xs text-green-700 flex items-start gap-1">
          <span>✅</span>
          <span>
            Selected: {selectedPlace.city && selectedPlace.state
              ? `${selectedPlace.city}, ${selectedPlace.state}`
              : selectedPlace.formattedAddress || 'Location confirmed'}
          </span>
        </p>
      )}
      
      {/* Only show hint when: user has typed something AND maps is ready AND no suggestion selected AND no error AND maps didn't timeout */}
      {!selectedPlace && !error && value && isGoogleMapsLoaded && !loadTimeout && (
        <p className="mt-1.5 text-xs text-amber-600 flex items-start gap-1">
          <span>💡</span>
          <span>Please pick a suggestion so we can locate it accurately.</span>
        </p>
      )}
      
      {!isGoogleMapsLoaded && !error && !value && !loadTimeout && (
        <p className="mt-1.5 text-xs text-gray-500">
          Location suggestions loading...
        </p>
      )}
      {loadTimeout && !error && !value && (
        <p className="mt-1.5 text-xs text-amber-600">
          Autocomplete unavailable — you can type manually or use current location.
        </p>
      )}
    </div>
  );
}
