'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import Card from '../components/Card';
import Badge from '../components/Badge';
import RestaurantCard from '../components/RestaurantCard';
import RestaurantMiniCard from '../components/RestaurantMiniCard';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';

interface RecommendationResults {
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

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<RecommendationResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllLunch, setShowAllLunch] = useState(false);
  const [showAllDinner, setShowAllDinner] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('recommendationResults');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setResults(data);
      } catch (err) {
        setError('Failed to load results');
      }
    } else {
      setError('No results found. Please start a new search.');
    }
    setLoading(false);
  }, []);

  const formatTemperature = (tempC: number) => {
    const tempF = Math.round((tempC * 9) / 5 + 32);
    return `${tempF}°F`;
  };

  const getWeatherBadge = (weather: {
    isRainy: boolean;
    isCold: boolean;
    isHot: boolean;
    condition: string;
  }) => {
    if (weather.isRainy || weather.condition.toLowerCase().includes('rain') || weather.condition.toLowerCase().includes('drizzle')) {
      return { variant: 'info' as const, emoji: '🌧️', text: 'Rainy' };
    }
    if (weather.isCold) {
      return { variant: 'info' as const, emoji: '❄️', text: 'Cold' };
    }
    if (weather.isHot) {
      return { variant: 'warning' as const, emoji: '☀️', text: 'Hot' };
    }
    return { variant: 'success' as const, emoji: '☀️', text: 'Nice' };
  };

  const generateWelcomeMessage = (context: RecommendationResults['context']): string => {
    const weatherSummary = context.weatherSummary;
    const lunchDistanceInfo = context.lunchDistanceInfo;
    
    // Fallback if info not available
    if (!lunchDistanceInfo) {
      return `It's a lovely day out! 🌤️\nPerfect for an easy walk and something fresh.\nAll picks are 20 minutes away—enjoy the stroll.`;
    }
    
    const { maxWalkMinutes, usedRelaxedTimeLimit, weatherBucket } = lunchDistanceInfo;
    const temperatureC = weatherSummary.temperatureC ?? weatherSummary.tempC;
    const feelsLikeC = weatherSummary.feelsLikeC ?? weatherSummary.tempC;
    const windSpeedMs = weatherSummary.windSpeedMs ?? 0;
    const precipitationMm = weatherSummary.precipitationMm ?? 0;
    const rainMm = weatherSummary.rainMm ?? 0;
    
    let message: string;
    
    // Deterministic variant selection based on weatherBucket and conditions
    if (weatherBucket === 'pleasant') {
      // A) pleasant bucket
      if (temperatureC >= 27) {
        // Hot variant
        if (precipitationMm === 0 && rainMm === 0) {
          message = `It's a hot one today! 🥵\nLet's keep it light, cool, and refreshing.\nAll picks are ${maxWalkMinutes} minutes away—no long walks in the heat.`;
        } else {
          message = `Sunny and warm today! 😎\nGreat weather for something light and refreshing.\nAll picks are ${maxWalkMinutes} minutes away—stay cool.`;
        }
      } else if (feelsLikeC <= 8) {
        // Cold variant
        message = `Brrr… it's cold out there! ❄️\nCalling all warm, cozy comfort food.\nAll picks are ${maxWalkMinutes} minutes away—stay toasty.`;
      } else if (windSpeedMs >= 10) {
        // Windy pleasant variant
        message = `Windy out there today! 🌬️\nLet's not wrestle the gusts—close + cozy wins.\nAll picks are ${maxWalkMinutes} minutes away—easy and breezy.`;
      } else {
        // Warm/Pleasant variant
        message = `It's a lovely day out! 🌤️\nPerfect for an easy walk and something fresh.\nAll picks are ${maxWalkMinutes} minutes away—enjoy the stroll.`;
      }
    } else if (weatherBucket === 'drizzle_or_light_precip') {
      // B) drizzle_or_light_precip bucket
      if (feelsLikeC <= 8 && windSpeedMs >= 10) {
        // Cold + Windy
        message = `Cold and windy—ouch. 🧥\nDefinitely a 'hot food fixes everything' day.\nAll picks are ${maxWalkMinutes} minutes away—because today is not a long-walk day.`;
      } else {
        // Rainy / drizzle
        message = `A little drizzle out there—no worries. 🌧️\nWe leaned warm + indoor-friendly today.\nAll picks are ${maxWalkMinutes} minutes away—keep the umbrella time short.`;
      }
    } else {
      // C) storm_or_extreme bucket
      if (feelsLikeC <= -17.8) {
        // Extreme cold
        message = `Okay… it's REALLY cold out there! 🥶\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
      } else if (feelsLikeC >= 37.8) {
        // Extreme heat
        message = `Okay… this heat is doing the most. 🔥\nWe're keeping it extra close and extra refreshing.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
      } else if (windSpeedMs >= 12) {
        // Storm/Wind
        message = `Okay… this weather is doing the most. 🌪️\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
      } else {
        // Heavy rain/snow
        message = `Okay… this weather is doing the most. ⛈️\nWe're keeping it extra close and extra comforting.\nAll picks are ${maxWalkMinutes} minutes away—minimum suffering, maximum lunch.`;
      }
    }
    
    // Add note about close-by options being limited if applicable
    const lunchWithinLimitCount = lunchDistanceInfo?.lunchWithinLimitCount ?? 0;
    if (lunchWithinLimitCount < 2 || usedRelaxedTimeLimit) {
      // Only add if not already mentioned in the message
      if (!message.includes('close-by') && !message.includes('showing the closest picks')) {
        message += `\nClose-by options are a bit limited today — showing the closest picks first, plus a few extras if you want to explore.`;
      }
    }
    
    return message;
  };

  if (loading) {
    return (
      <AppShell showBackButton>
        <LoadingState />
      </AppShell>
    );
  }

  if (error || !results) {
    return (
      <AppShell showBackButton>
        <EmptyState
          title={error || 'No results found'}
          message="Looks like we couldn't find any recommendations. Let's try a different search!"
          actionLabel="Start New Search"
          actionHref="/"
        />
      </AppShell>
    );
  }

  const { context, lunch, dinner, moreLunchOptions } = results;
  const weatherBadge = getWeatherBadge(context.weatherSummary);

  return (
    <AppShell showBackButton>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Today's Vibe Card */}
        <Card className="p-6 sm:p-8 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Today's vibe
            </h2>
            <p className="text-gray-600 whitespace-pre-line">
              {generateWelcomeMessage(context)}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-orange-200">
            <Badge variant={weatherBadge.variant} size="lg">
              {weatherBadge.emoji} {weatherBadge.text} • {formatTemperature(context.weatherSummary.tempC)}
            </Badge>
            {context.holiday.isHoliday && context.holiday.name && (
              <Badge variant="primary" size="lg">
                🎉 {context.holiday.name}
              </Badge>
            )}
                {context.lunchDistanceInfo && (
              <>
                <Badge variant="default" size="lg">
                  🚶 Max walk: {context.lunchDistanceInfo.maxWalkMinutes} min
                </Badge>
                {context.lunchDistanceInfo.usedRelaxedTimeLimit && (
                  <Badge variant="warning" size="lg">
                    Closest picks (relaxed)
                  </Badge>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Quick Lunch Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Quick Lunch
            </h2>
            <Badge variant="primary" size="md">
              {lunch.length} picks
            </Badge>
          </div>
          <p className="text-gray-600 mb-6">Warm, quick, and close—coming up! ⚡</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(showAllLunch ? lunch : lunch.slice(0, 2)).map((restaurant, index) => (
              <RestaurantCard
                key={restaurant.placeId || index}
                name={restaurant.name}
                why={restaurant.why}
                suggestedDishes={restaurant.suggestedDishes}
                etaMinutes={restaurant.etaMinutes}
                websiteUrl={restaurant.websiteUrl}
                mapsUrl={restaurant.mapsUrl}
                photoUrl={restaurant.photoUrl}
              />
            ))}
          </div>
          {lunch.length > 2 && !showAllLunch && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAllLunch(true)}
                className="px-6 py-3 bg-white border-2 border-orange-500 text-orange-600 font-semibold rounded-full hover:bg-orange-50 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                View All ({lunch.length} options) 🔽
              </button>
            </div>
          )}
          {showAllLunch && lunch.length > 2 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAllLunch(false)}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-all shadow-sm hover:shadow-md"
              >
                Show Less 🔼
              </button>
            </div>
          )}
          
          {/* View More Options Section */}
          {/* Render when showMoreOptionsEnabled is true AND moreLunchOptions has items */}
          {/* Do NOT base it on lunchTopPicks.length < 2 - it should appear whenever there are more candidates */}
          {context.lunchDistanceInfo?.showMoreOptionsEnabled && moreLunchOptions && moreLunchOptions.length > 0 && (
            <div className="mt-8">
              {!showMoreOptions && (
                <div className="text-center">
                  <button
                    onClick={() => setShowMoreOptions(true)}
                    className="px-6 py-3 bg-white border-2 border-orange-500 text-orange-600 font-semibold rounded-full hover:bg-orange-50 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    View more options 🔽
                  </button>
                  <p className="mt-3 text-sm text-gray-600">
                    Want to explore a bit farther? These are also solid options.
                  </p>
                </div>
              )}
              {showMoreOptions && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">More options to explore</h3>
                    <button
                      onClick={() => setShowMoreOptions(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                      Collapse 🔼
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {moreLunchOptions.map((restaurant, index) => (
                      <RestaurantMiniCard
                        key={restaurant.placeId || index}
                        name={restaurant.name}
                        etaMinutes={restaurant.etaMinutes}
                        why={restaurant.why}
                        suggestedDishes={restaurant.suggestedDishes}
                        websiteUrl={restaurant.websiteUrl}
                        mapsUrl={restaurant.mapsUrl}
                        photoUrl={restaurant.photoUrl}
                        placeId={restaurant.placeId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Fancy Dinner Section */}
        {dinner && dinner.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Fancy Dinner
              </h2>
              <Badge variant="primary" size="md">
                {dinner.length} picks
              </Badge>
            </div>
            <p className="text-gray-600 mb-2">Time to unwind and enjoy a proper meal 🍷</p>
            <p className="text-sm text-gray-500 mb-6 italic">Dinner is just a fun extra — feel free to wander a bit 🙂</p>
          {/* Top 2 dinner picks use full RestaurantCard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dinner.slice(0, 2).map((restaurant, index) => (
              <div key={restaurant.placeId || index}>
                <RestaurantCard
                  name={restaurant.name}
                  why={restaurant.why}
                  suggestedDishes={restaurant.suggestedDishes}
                  etaMinutes={restaurant.etaMinutes}
                  websiteUrl={restaurant.websiteUrl}
                  mapsUrl={restaurant.mapsUrl}
                  photoUrl={restaurant.photoUrl}
                />
                {restaurant.reservationTip && (
                  <Card className="mt-3 p-4 bg-blue-50 border-blue-200">
                    <p className="text-sm text-blue-800 flex items-start gap-2">
                      <span>💡</span>
                      <span>{restaurant.reservationTip}</span>
                    </p>
                  </Card>
                )}
              </div>
            ))}
          </div>
          
          {/* View More Options Section for Dinner - uses same format as Lunch */}
          {dinner.length > 2 && (
            <div className="mt-8">
              {!showAllDinner && (
                <div className="text-center">
                  <button
                    onClick={() => setShowAllDinner(true)}
                    className="px-6 py-3 bg-white border-2 border-orange-500 text-orange-600 font-semibold rounded-full hover:bg-orange-50 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    View more options 🔽
                  </button>
                  <p className="mt-3 text-sm text-gray-600">
                    Want to explore a bit farther? These are also solid options.
                  </p>
                </div>
              )}
              {showAllDinner && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">More options to explore</h3>
                    <button
                      onClick={() => setShowAllDinner(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                      Collapse 🔼
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dinner.slice(2).map((restaurant, index) => (
                      <RestaurantMiniCard
                        key={restaurant.placeId || index + 2}
                        name={restaurant.name}
                        etaMinutes={restaurant.etaMinutes}
                        why={restaurant.why}
                        suggestedDishes={restaurant.suggestedDishes}
                        websiteUrl={restaurant.websiteUrl}
                        mapsUrl={restaurant.mapsUrl}
                        photoUrl={restaurant.photoUrl}
                        placeId={restaurant.placeId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
