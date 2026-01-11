# Food Recommendation MCP Server

An MCP (Model Context Protocol) server that provides tools for weather forecasts, holiday checking, and restaurant search to help with food recommendations around work locations.

## Features

This MCP server exposes 4 tools:

1. **weather.getForecast** - Get weather forecast for a specific location and time
2. **holiday.getHoliday** - Check if a specific date is a holiday in a given country
3. **places.searchRestaurants** - Search for restaurants near a location
4. **places.getPlaceDetails** - Get detailed information about a place

## Prerequisites

- Node.js 18+ and npm
- Google Maps API key (for Places API)
- Optional: Calendarific API key (falls back to date-holidays library if not provided)

## Quick Start

1. Navigate to the MCP directory:
   ```bash
   cd mcp
   ```

2. Install dependencies (this must be done before building):
   ```bash
   npm install
   ```
   
   **Important**: You must run `npm install` first to install all dependencies including TypeScript. The build will fail with "tsc: command not found" if dependencies aren't installed.

3. Build the project:
   ```bash
   npm run build
   ```

4. Run the server:
   ```bash
   npm start
   ```

   **Note**: If you encounter issues with the `@modelcontextprotocol/sdk` package, you may need to check the latest version. The package might be published under a different name or version. Check the [MCP SDK documentation](https://github.com/modelcontextprotocol/servers) for the correct package name.

3. Set up environment variables. Copy the `.env.example` from the project root or create a `.env` file:
   ```bash
   # From project root
   cp ../env.example .env
   ```

   Edit `.env` and ensure you have:
   ```bash
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   CALENDARIFIC_API_KEY=your_calendarific_api_key_here  # Optional
   ```

   **Note**: Weather API uses Open-Meteo which is free and requires no API key.

## Building

Build the TypeScript code:
```bash
npm run build
```

This will compile the TypeScript files to JavaScript in the `dist/` directory.

## Running Locally

### Development Mode (with auto-reload)

Using `tsx` for direct TypeScript execution:
```bash
npm run dev
```

### Production Mode

After building:
```bash
npm start
```

Or run directly with node:
```bash
node dist/index.js
```

### Running as an MCP Server

The server communicates via stdio (standard input/output) following the MCP protocol. To use it with an MCP client:

```bash
# The server will listen on stdin and write to stdout
npm start
```

## API Reference

### 1. weather.getForecast

Get weather forecast for a specific location and time.

**Parameters:**
- `lat` (number): Latitude coordinate
- `lng` (number): Longitude coordinate
- `whenISO` (string): ISO 8601 date-time string (e.g., "2024-01-15T12:00:00Z" or "2024-01-15")

**Returns:**
```json
{
  "tempC": 15.5,
  "feelsLikeC": 14.2,
  "precipitationProb": 30,
  "condition": "Partly cloudy",
  "isCold": false,
  "isHot": false,
  "isRainy": false
}
```

**Example:**
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "whenISO": "2024-01-15T18:00:00Z"
}
```

### 2. holiday.getHoliday

Check if a specific date is a holiday in a given country.

**Parameters:**
- `dateISO` (string): ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T12:00:00Z")
- `countryCode` (string): ISO country code (e.g., "US", "GB", "CA")

**Returns:**
```json
{
  "name": "New Year's Day",
  "isHoliday": true
}
```
or
```json
{
  "isHoliday": false
}
```

**Example:**
```json
{
  "dateISO": "2024-12-25",
  "countryCode": "US"
}
```

**Supported Countries:**
US, GB, CA, AU, DE, FR, IT, ES, JP, CN, KR, IN, BR, MX, and more (via date-holidays library).

### 3. places.searchRestaurants

Search for restaurants near a location.

**Parameters:**
- `lat` (number): Latitude coordinate
- `lng` (number): Longitude coordinate
- `meal` (string): "lunch" or "dinner"
- `radiusMeters` (number, optional): Search radius in meters (max 50000, default 5000)
- `maxResults` (number, optional): Maximum number of results (default 20, max 20)
- `openNow` (boolean, optional): Filter for places open now

**Returns:**
```json
[
  {
    "placeId": "ChIJ...",
    "name": "The Restaurant",
    "rating": 4.5,
    "priceLevel": 2,
    "address": "123 Main St, City, State",
    "types": ["restaurant", "food", "point_of_interest", "establishment"]
  }
]
```

**Example:**
```json
{
  "lat": 37.7749,
  "lng": -122.4194,
  "meal": "dinner",
  "radiusMeters": 3000,
  "maxResults": 10,
  "openNow": true
}
```

### 4. places.getPlaceDetails

Get detailed information about a place by its place ID.

**Parameters:**
- `placeId` (string): Google Places place ID

**Returns:**
```json
{
  "name": "The Restaurant",
  "websiteUrl": "https://example.com",
  "googleMapsUrl": "https://www.google.com/maps/place/?q=place_id:...",
  "phone": "+1 234-567-8900",
  "openingHours": {
    "openNow": true,
    "weekdayText": [
      "Monday: 11:00 AM – 10:00 PM",
      "Tuesday: 11:00 AM – 10:00 PM",
      ...
    ]
  },
  "photos": [
    "https://maps.googleapis.com/maps/api/place/photo?...",
    ...
  ],
  "reservableHint": true
}
```

**Example:**
```json
{
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

## Configuration

### Environment Variables

The server uses the following environment variables:

- `GOOGLE_MAPS_API_KEY` (required): Your Google Maps API key with Places API enabled
- `CALENDARIFIC_API_KEY` (optional): Calendarific API key. If not provided, falls back to the `date-holidays` npm library (no API key required, but supports fewer countries)

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. Enable the **Places API**
4. Create credentials (API Key)
5. Restrict the API key to Places API for security

### Calendarific API (Optional)

1. Visit [Calendarific](https://calendarific.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Add it to your `.env` file

If you don't provide a Calendarific API key, the server will use the `date-holidays` library which:
- Requires no API key
- Supports many countries (US, GB, CA, AU, DE, FR, IT, ES, JP, CN, KR, IN, BR, MX, etc.)
- Has good coverage but may not include all holidays

## Development

### Project Structure

```
mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   └── services/
│       ├── weatherForecast.ts    # Weather forecast service (Open-Meteo)
│       ├── holidayService.ts     # Holiday checking service (date-holidays/Calendarific)
│       └── placesService.ts      # Google Places API service
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled server
- `npm run dev` - Run in development mode with tsx (auto-reload)
- `npm run watch` - Watch for changes and rebuild

### Testing

You can test the server locally using an MCP client. The server communicates via stdio following the MCP protocol.

For manual testing, you can also create a test script:

```typescript
// test.ts
import { getForecast } from './src/services/weatherForecast.js';
import { getHoliday } from './src/services/holidayService.js';
import { searchRestaurants, getPlaceDetails } from './src/services/placesService.js';
import { config } from 'dotenv';

config({ path: '../.env' });

async function test() {
  // Test weather
  const forecast = await getForecast(37.7749, -122.4194, '2024-01-15T18:00:00Z');
  console.log('Forecast:', forecast);

  // Test holiday
  const holiday = await getHoliday('2024-12-25', 'US');
  console.log('Holiday:', holiday);

  // Test restaurants
  const restaurants = await searchRestaurants(
    process.env.GOOGLE_MAPS_API_KEY!,
    37.7749,
    -122.4194,
    'dinner',
    5000,
    5
  );
  console.log('Restaurants:', restaurants);

  // Test place details
  if (restaurants.length > 0) {
    const details = await getPlaceDetails(
      process.env.GOOGLE_MAPS_API_KEY!,
      restaurants[0].placeId
    );
    console.log('Details:', details);
  }
}

test().catch(console.error);
```

## Troubleshooting

### "Google Maps API key is required"

Make sure you have `GOOGLE_MAPS_API_KEY` set in your `.env` file or environment variables.

### "Request denied" from Google Places API

- Verify your API key is correct
- Ensure Places API is enabled in Google Cloud Console
- Check API key restrictions
- Verify billing is set up (required for Google Maps APIs)

### "Over query limit"

- Check your Google Maps API quotas
- Implement rate limiting if needed
- Consider upgrading your quota if needed

### Holiday service not working for a country

- If using Calendarific, verify your API key
- Check if the country code is supported (date-holidays supports: US, GB, CA, AU, DE, FR, IT, ES, JP, CN, KR, IN, BR, MX, etc.)
- Try using the Calendarific API with a valid API key for better country coverage

## License

MIT
