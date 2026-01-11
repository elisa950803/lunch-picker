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

  // Debounced fetch suggestions
  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!isOpen || query.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedIndex(-1);

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Debounce: wait 300ms before making request
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/location-suggest?q=${encodeURIComponent(query.trim())}`, {
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) {
          return; // Request was cancelled
        }

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error('Failed to fetch location suggestions:', err);
        setError('Autocomplete unavailable — keep typing');
        setSuggestions([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [query, isOpen]);

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
        onSelect(suggestions[selectedIndex]);
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
                onSelect(suggestion);
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
