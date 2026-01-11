# Google API Services Usage

This directory contains service implementations for Google Places API and Google Distance Matrix API.

## Setup

Make sure you have your Google Maps API key set in your environment variables:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

Or load it from a `.env` file (not committed to version control).

## Google Places API

### TypeScript/JavaScript Example

```typescript
import { searchNearbyRestaurants, getPlaceDetails, getPhotoUrl } from './googlePlaces';

// Search for restaurants near a location
const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
const workLocation = { lat: 37.7749, lng: -122.4194 }; // San Francisco

// Search nearby restaurants
const results = await searchNearbyRestaurants(
  apiKey,
  workLocation,
  5000, // radius in meters
  'restaurant'
);

console.log(`Found ${results.places.length} restaurants`);
results.places.forEach(place => {
  console.log(`${place.name} - ${place.address}`);
  console.log(`Rating: ${place.rating}/5 (${place.userRatingTotal} reviews)`);
  console.log(`Price Level: ${place.priceLevel || 'Not specified'}`);
});

// Get detailed information about a restaurant
if (results.places.length > 0) {
  const details = await getPlaceDetails(apiKey, results.places[0].placeId);
  console.log(`Phone: ${details.phoneNumber}`);
  console.log(`Website: ${details.website}`);
  console.log(`Open Now: ${details.openingHours?.openNow ? 'Yes' : 'No'}`);
  
  // Get photo URL if available
  if (details.photos && details.photos.length > 0) {
    const photoUrl = getPhotoUrl(apiKey, details.photos[0], 400);
    console.log(`Photo: ${photoUrl}`);
  }
}
```

### Python Example

```python
from src.services.googlePlaces import search_nearby_restaurants, get_place_details, get_photo_url
import os

# Get API key from environment
api_key = os.getenv('GOOGLE_MAPS_API_KEY')
work_location = {'lat': 37.7749, 'lng': -122.4194}  # San Francisco

# Search nearby restaurants
results = search_nearby_restaurants(
    api_key,
    work_location,
    radius=5000,  # meters
    keyword='restaurant'
)

print(f"Found {len(results['places'])} restaurants")
for place in results['places']:
    print(f"{place['name']} - {place['address']}")
    print(f"Rating: {place.get('rating', 'N/A')}/5 ({place.get('userRatingTotal', 0)} reviews)")

# Get detailed information
if results['places']:
    details = get_place_details(api_key, results['places'][0]['placeId'])
    print(f"Phone: {details.get('phoneNumber', 'N/A')}")
    print(f"Website: {details.get('website', 'N/A')}")
    if details.get('openingHours'):
        print(f"Open Now: {'Yes' if details['openingHours'].get('openNow') else 'No'}")
```

## Google Distance Matrix API

### TypeScript/JavaScript Example

```typescript
import { getTravelTimesFromOrigin } from './googleDistanceMatrix';

const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
const workLocation = { lat: 37.7749, lng: -122.4194 };

// Restaurant locations from Places API search
const restaurantLocations = [
  { lat: 37.7849, lng: -122.4094 },
  { lat: 37.7649, lng: -122.4294 },
  { lat: 37.7549, lng: -122.4394 },
];

// Get travel times from work to each restaurant
const travelTimes = await getTravelTimesFromOrigin(
  apiKey,
  workLocation,
  restaurantLocations,
  'driving', // or 'walking', 'bicycling', 'transit'
  Math.floor(Date.now() / 1000) // current time for traffic-aware routing
);

travelTimes.forEach((result, index) => {
  if (result.status === 'OK') {
    console.log(`Restaurant ${index + 1}:`);
    console.log(`  Distance: ${result.distance.text}`);
    console.log(`  Duration: ${result.duration.text}`);
  } else {
    console.log(`Restaurant ${index + 1}: ${result.status}`);
  }
});
```

### Python Example

```python
from src.services.googleDistanceMatrix import get_travel_times_from_origin
import os
import time

api_key = os.getenv('GOOGLE_MAPS_API_KEY')
work_location = {'lat': 37.7749, 'lng': -122.4194}

# Restaurant locations
restaurant_locations = [
    {'lat': 37.7849, 'lng': -122.4094},
    {'lat': 37.7649, 'lng': -122.4294},
    {'lat': 37.7549, 'lng': -122.4394},
]

# Get travel times
travel_times = get_travel_times_from_origin(
    api_key,
    work_location,
    restaurant_locations,
    mode='driving',  # or 'walking', 'bicycling', 'transit'
    departure_time=int(time.time())  # current time for traffic-aware routing
)

for i, result in enumerate(travel_times):
    if result['status'] == 'OK':
        print(f"Restaurant {i + 1}:")
        print(f"  Distance: {result['distance']['text']}")
        print(f"  Duration: {result['duration']['text']}")
    else:
        print(f"Restaurant {i + 1}: {result['status']}")
```

## Combined Example: Restaurant Recommendations

Here's how you might combine all the APIs for a restaurant recommendation system:

```typescript
import { searchNearbyRestaurants, getPlaceDetails } from './googlePlaces';
import { getTravelTimesFromOrigin } from './googleDistanceMatrix';
import { getCurrentWeather } from './weather';

async function getRestaurantRecommendations(
  apiKey: string,
  workLocation: { lat: number; lng: number },
  radius: number = 5000
) {
  // 1. Search for nearby restaurants
  const searchResults = await searchNearbyRestaurants(apiKey, workLocation, radius);
  
  // 2. Get travel times from work to each restaurant
  const restaurantLocations = searchResults.places.map(p => p.location);
  const travelTimes = await getTravelTimesFromOrigin(
    apiKey,
    workLocation,
    restaurantLocations,
    'driving'
  );
  
  // 3. Get weather (for outdoor seating recommendations)
  const weather = await getCurrentWeather(workLocation.lat, workLocation.lng);
  
  // 4. Combine and rank results
  const recommendations = searchResults.places.map((place, index) => ({
    ...place,
    travelTime: travelTimes[index],
    isGoodForOutdoor: !weather.isRainy && !weather.isCold && !weather.isHot,
  })).filter(rec => rec.travelTime.status === 'OK')
    .sort((a, b) => {
      // Sort by rating first, then by travel time
      if (b.rating !== a.rating) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return a.travelTime.duration.value - b.travelTime.duration.value;
    });
  
  return recommendations;
}
```

## API Limits

- **Places Nearby Search**: Up to 20 results per request (can paginate with `nextPageToken`)
- **Places Details**: 1 place per request
- **Distance Matrix**: Up to 25 origins × 25 destinations per request

For more information, see the [Google Maps Platform documentation](https://developers.google.com/maps/documentation).
