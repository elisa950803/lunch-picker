# Food Around Work Recommendation

A Next.js API that provides restaurant recommendations based on location, weather, holidays, and preferences.

## 🌐 GitHub Pages Deployment

This app is deployed to GitHub Pages at: **https://elisa950803.github.io/lunch-picker/**

**Important:** GitHub Pages serves the app from the `gh-pages` branch (containing the built static files), NOT from the `main` branch. The `main` branch contains the source code, while `gh-pages` contains the static build output.

### Updating the Deployment

To update the GitHub Pages site after making changes:

```bash
npm run build    # Build the static site
npm run deploy   # Deploy to gh-pages branch
```

The `gh-pages` branch should NOT be manually edited. It's automatically generated from the `out/` directory after running `npm run build`.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add:
   ```
   # Google Maps API Key (used by server-side API routes)
   GOOGLE_MAPS_API_KEY=your_api_key_here
   
   # Google Maps API Key for client-side (used by Places Autocomplete)
   # Should be restricted by HTTP referrer in Google Cloud Console
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_client_api_key_here
   
   # Optional: Calendarific API Key for holiday information
   CALENDARIFIC_API_KEY=your_api_key_here
   ```
   
   **Security Best Practices:**
   - `GOOGLE_MAPS_API_KEY`: Used server-side only, can be restricted by IP or service account
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Used client-side for Places Autocomplete, **MUST** be restricted by HTTP referrer in Google Cloud Console
     - Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
     - Edit the API key
     - Under "Application restrictions", select "HTTP referrers (web sites)"
     - Add your domain(s): `http://localhost:3000/*`, `https://yourdomain.com/*`
     - Under "API restrictions", select "Restrict key" and choose:
       - Places API (for Autocomplete)
       - Geocoding API (optional, for reverse geocoding)

3. **Build MCP services (if not already built):**
   ```bash
   cd mcp
   npm install
   npm run build
   cd ..
   ```

4. **Run Next.js development server:**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000/api/recommend`

## API Usage

### POST `/api/recommend`

**Request Body:**
```json
{
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",  // Preferred: Google Place ID
  // OR
  "lat": 40.7549,                            // Alternative: Coordinates
  "lng": -73.9840,
  // OR
  "locationText": "Midtown Manhattan",       // Fallback: Text search
  
  "budget": "mid",
  "dietary": ["vegan", "kosher"],
  "cuisine": ["japanese", "thai"],
  "maxLunchMinutes": 35
}
```

**Priority order for location:**
1. `placeId` (most accurate - used when user selects from autocomplete)
2. `lat` + `lng` (coordinates - used for current location)
3. `locationText` (fallback - geocoded server-side)

**Response:**
```json
{
  "context": {
    "resolvedLocation": {
      "lat": 40.7549,
      "lng": -73.9840,
      "address": "Midtown Manhattan, New York, NY, USA",
      "city": "New York",
      "state": "NY",
      "formatted": "Midtown Manhattan, New York, NY, USA"
    },
    "weatherSummary": { "tempC": 20, "condition": "Clear", ... },
    "holiday": { "isHoliday": false },
    "lunchDistanceInfo": { ... }
  },
  "lunch": [...],
  "dinner": [...],
  "moreLunchOptions": [...]  // Optional: shown when close-by options are limited
}
```

## Important Notes

- **The MCP server should NOT be running** when using the Next.js API route
- The API route imports service functions directly from the MCP source code (not via MCP protocol)
- Make sure to run `npm install` in both the root directory and the `mcp` directory
- The MCP server (`mcp/`) is only needed if you want to use it as an MCP protocol server with an MCP client

## Troubleshooting

### "MCP Error: Unexpected token" or JSON parsing errors

If you see MCP errors when trying to use the API, it means the MCP server is running. You need to:

1. **Stop the MCP server** (press Ctrl+C in the terminal where it's running)
2. **Start the Next.js dev server instead:**
   ```bash
   npm run dev
   ```
3. **Then make your curl request:**
   ```bash
   curl -X POST http://localhost:3000/api/recommend \
     -H "Content-Type: application/json" \
     -d '{"locationText":"Midtown Manhattan","budget":"mid","maxLunchMinutes":35}'
   ```

### Import errors

If you get import errors, make sure:
- You've run `npm install` in the root directory
- The MCP services are built: `cd mcp && npm run build && cd ..`
- TypeScript can find the service files (they're imported from `mcp/src/services/`)
