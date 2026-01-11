'use client';

import Card from './Card';

interface RestaurantMiniCardProps {
  name: string;
  etaMinutes: number;
  why?: string[]; // 1 short bullet is enough
  suggestedDishes?: string[];
  websiteUrl?: string;
  mapsUrl: string;
  priceLevel?: number;
  rating?: number;
  photoUrl?: string;
  placeId?: string;
}

export default function RestaurantMiniCard({
  name,
  etaMinutes,
  why,
  suggestedDishes,
  websiteUrl,
  mapsUrl,
  photoUrl,
}: RestaurantMiniCardProps) {
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      {photoUrl && (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-40 object-cover rounded-lg mb-3"
        />
      )}
      <h4 className="font-semibold text-gray-900 mb-2">{name}</h4>
      <p className="text-sm text-gray-600 mb-2">
        🚶 {etaMinutes} min walk
      </p>
      {why && why.length > 0 && (
        <p className="text-sm text-gray-700 mb-3">
          {why[0]}
        </p>
      )}
      <div className="flex gap-2">
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full hover:bg-gray-200 transition-all"
          >
            Website
          </a>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-full hover:bg-orange-600 transition-all"
        >
          Open in Maps
        </a>
      </div>
    </Card>
  );
}
