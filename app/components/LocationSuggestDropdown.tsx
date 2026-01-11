'use client';

import { useEffect, useRef, useState } from 'react';

interface LocationSuggestion {
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

interface LocationSuggestDropdownProps {
  query: string;
  onSelect: (suggestion: LocationSuggestion) => void;
  isOpen: boolean;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

// Google Maps types - using any to avoid conflicts with LocationAutocomplete declarations
// The actual Google Maps API will be available at runtime

export default function LocationSuggestDropdown({
  query,
  onSelect,
  isOpen,
  onClose,
  inputRef,
}: LocationSuggestDropdownProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper function to extract city and state from address components
  const extractCityAndState = (addressComponents: any[]): { city?: string; state?: string } => {
    let city: string | undefined;
    let state: string | undefined;

    for (const component of addressComponents) {
      const types = component.types;
      if (!city && (types.includes('locality') || types.includes('sublocality') || types.includes('administrative_area_level_2'))) {
        city = component.long_name;
      }
      if (!state && types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
    }

    return { city, state };
  };

  // Debounced fetch suggestions using Google Places AutocompleteService
  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1);

    // Check if Google Places AutocompleteService is available
    const googleMaps = (window as any).google;
    if (!googleMaps?.maps?.places?.AutocompleteService) {
      setIsLoading(false);
      setError(null);
      setSuggestions([]);
      return; // Google Maps not loaded yet, will retry when it loads
    }

    // Debounce: wait 300ms before making request
    const timeoutId = setTimeout(() => {
      const autocompleteService = new googleMaps.maps.places.AutocompleteService();
      
      autocompleteService.getPlacePredictions(
        {
          input: query.trim(),
          types: ['geocode'], // Only geocoding results (addresses, not businesses)
          componentRestrictions: { country: 'us' }, // Restrict to US
        },
        (predictions: any[] | null, status: string) => {
          if (status === 'OK' && predictions) {
            // Convert predictions to our format
            // We'll need to get place details to get lat/lng, but for now show predictions
            // The user can select and we'll get details via Geocoder or PlacesService
            const formattedSuggestions: LocationSuggestion[] = predictions.slice(0, 8).map((prediction) => {
              // Extract city/state from structured_formatting if available
              let city: string | undefined;
              let state: string | undefined;
              
              if (prediction.structured_formatting?.secondary_text) {
                const parts = prediction.structured_formatting.secondary_text.split(', ');
                if (parts.length >= 2) {
                  city = parts[0];
                  state = parts[1].trim();
                }
              }

              return {
                label: prediction.description,
                placeId: prediction.place_id,
                lat: 0, // Will be filled when selected
                lng: 0, // Will be filled when selected
                city,
                state,
              };
            });

            setSuggestions(formattedSuggestions);
            setError(null);
          } else if (status === 'ZERO_RESULTS') {
            setSuggestions([]);
            setError(null);
          } else {
            console.error('Google Places AutocompleteService error:', status);
            setError('Autocomplete unavailable — keep typing');
            setSuggestions([]);
          }
          setIsLoading(false);
        }
      );
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, isOpen]);

  // Handle suggestion selection - get place details to get lat/lng
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    if (!suggestion.placeId) {
      // Fallback: use suggestion as-is if no placeId
      onSelect(suggestion);
      return;
    }

    // Get place details to get lat/lng
    const googleMaps = (window as any).google;
    if (!googleMaps?.maps?.Geocoder) {
      // Fallback: use suggestion as-is if Geocoder not available
      onSelect(suggestion);
      return;
    }

    // Use Geocoder to get lat/lng from placeId
    const geocoder = new googleMaps.maps.Geocoder();
    geocoder.geocode({ placeId: suggestion.placeId }, (results: any[] | null, status: string) => {
      if (status === 'OK' && results && results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
        const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

        // Extract city/state from address components
        const { city, state } = extractCityAndState(result.address_components || []);

        onSelect({
          ...suggestion,
          lat,
          lng,
          city: city || suggestion.city,
          state: state || suggestion.state,
        });
      } else {
        // Fallback: use suggestion as-is if geocoding fails
        onSelect(suggestion);
      }
    });
  };

  // Handle keyboard navigation
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[selectedIndex]);
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    input.addEventListener('keydown', handleKeyDown);
    return () => {
      input.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, suggestions, selectedIndex, onSelect, onClose, inputRef]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose, inputRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-[10000] w-full mt-1 bg-white border-2 border-gray-200 rounded-2xl shadow-lg max-h-80 overflow-y-auto"
      style={{ top: '100%' }}
    >
      {isLoading && (
        <div className="p-4 text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
          <span className="ml-2 text-sm">Loading suggestions...</span>
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 text-center text-sm text-gray-600">
          {error}
        </div>
      )}

      {!isLoading && !error && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="p-4 text-center text-sm text-gray-600">
          No matches — keep typing.
        </div>
      )}

      {!isLoading && !error && suggestions.length > 0 && (
        <div className="py-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId || index}
              type="button"
              onClick={() => {
                handleSuggestionSelect(suggestion);
                onClose();
              }}
              className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors ${
                index === selectedIndex ? 'bg-orange-50' : ''
              } ${index < suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="font-medium text-gray-900">{suggestion.label}</div>
              {suggestion.city && suggestion.state && (
                <div className="text-xs text-gray-500 mt-1">
                  {suggestion.city}, {suggestion.state}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
