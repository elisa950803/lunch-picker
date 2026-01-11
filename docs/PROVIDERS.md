# API Providers and Environment Variables

This document describes the required API keys and environment variables needed for the Food Around Work Recommendation system.

## Required Environment Variables

### Weather API (Open-Meteo)

**Purpose**: Provides weather data to help recommend restaurants based on current weather conditions.

**Service**: [Open-Meteo](https://open-meteo.com/) - Free weather API, no API key required.

**API Usage**: 
- Free to use with no API key required
- No rate limits for non-commercial use
- Used for current weather conditions, which may influence restaurant recommendations (e.g., outdoor seating in good weather)
- API endpoint: `https://api.open-meteo.com/v1/forecast`

**Note**: No environment variable is required for weather data. The service uses Open-Meteo which is completely free and doesn't require authentication.

---

### GOOGLE_MAPS_API_KEY

**Purpose**: Provides location services including:
- **Places API**: Search and discover restaurants near a location
- **Distance Matrix API**: Calculate travel distances and durations between locations
- **Directions API**: Calculate routes and travel times (if needed for recommendations based on proximity)

**How to obtain**:
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (or Places API (New)) - Required for restaurant search and geocoding
   - **Distance Matrix API** - Required for calculating travel times
   - **Geocoding API** (optional, but recommended) - For converting addresses to coordinates
   - Directions API (if needed)
   
   **Important**: If you see "legacy API not enabled" errors, you need to enable the Places API. 
   Visit: https://console.cloud.google.com/google/maps-apis/api-list
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Restrict the API key to only the APIs you're using for better security
6. Copy your API key

**API Usage**:
- Places API: Used to search for restaurants, get details, reviews, and ratings
- Distance Matrix API: Used to calculate travel distances and durations between work location and restaurants
- Directions API: Optional, used if you need to calculate detailed routes
- Pricing: See [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

**Distance Matrix API Details**:
- Calculates travel distances and durations for multiple origins and destinations
- Supports multiple travel modes: driving, walking, bicycling, transit
- Returns distance in meters and duration in seconds, plus human-readable formats
- Essential for ranking restaurants by proximity to work location
- Free tier: $200 credit per month (covers many requests)

**Important**: Make sure to:
- Restrict your API key to specific APIs (Distance Matrix API, Places API)
- Add HTTP referrer restrictions for web apps
- Monitor usage in Google Cloud Console
- Set up billing account (required even for free tier)

**Environment Variable**:
```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

---

### CALENDARIFIC_API_KEY

**Purpose**: Provides holiday information to help adjust restaurant recommendations based on local holidays and special occasions.

**How to obtain**:
1. Visit [Calendarific](https://calendarific.com/)
2. Sign up for a free account
3. Navigate to your dashboard
4. Copy your API key from the API credentials section

**API Usage**:
- Free tier typically includes 1,000 requests/month
- Used to identify public holidays and special dates that may affect restaurant availability or recommendations

**Alternative Implementation**: 
If you prefer not to use Calendarific, you can use the `date-holidays` library (npm: `date-holidays` / Python: `holidays`). This library provides offline holiday data without requiring an API key, but may have less comprehensive coverage for all countries.

**To use date-holidays library instead**:
- **Node.js**: Install `npm install date-holidays`
- **Python**: Install `pip install holidays`
- No API key required, but you'll need to configure it for specific countries/regions

**Environment Variable** (only if using Calendarific API):
```bash
CALENDARIFIC_API_KEY=your_calendarific_api_key_here
```

---

## Setup Instructions

1. Copy the `.env.example` file to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual API keys in the `.env` file:
   ```bash
   GOOGLE_MAPS_API_KEY=your_actual_key_here
   CALENDARIFIC_API_KEY=your_actual_key_here  # Optional if using date-holidays instead
   ```
   
   **Note**: Weather API (Open-Meteo) does not require an API key.

3. Make sure `.env` is added to your `.gitignore` file to avoid committing sensitive keys

4. Load environment variables in your application code (methods vary by language/framework)

## Security Best Practices

- **Never commit** your `.env` file to version control
- Use environment-specific keys for development, staging, and production
- Regularly rotate your API keys
- Monitor API usage to detect any unusual activity
- Restrict API keys with appropriate limitations in each provider's console
- Consider using secrets management services for production deployments

## Troubleshooting

### Invalid API Key Errors
- Verify the key is copied correctly (no extra spaces)
- Check that the API is enabled in the provider's console
- Ensure billing is set up if required (Google Maps requires billing)

### Rate Limit Errors
- Check your usage against the free tier limits
- Implement rate limiting or caching in your application
- Consider upgrading to a paid tier if needed

### API Not Available
- Verify the API service is enabled in the provider's console
- Check for any service outages on the provider's status page
- Ensure your account is in good standing
