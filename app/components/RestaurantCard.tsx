'use client';

import Card from './Card';
import Badge from './Badge';

interface RestaurantCardProps {
  name: string;
  why: string[];
  suggestedDishes?: string[]; // Optional for backward compatibility, but no longer displayed
  etaMinutes: number;
  websiteUrl?: string;
  mapsUrl: string;
  photoUrl?: string;
}

export default function RestaurantCard({
  name,
  why,
  suggestedDishes,
  etaMinutes,
  websiteUrl,
  mapsUrl,
  photoUrl,
}: RestaurantCardProps) {
  return (
    <Card hover className="overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {photoUrl && (
            <div className="flex-shrink-0">
              <div className="w-full sm:w-36 h-36 sm:h-36 rounded-2xl overflow-hidden bg-gray-100">
                <img
                  src={photoUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-tight">
              {name}
            </h3>
            <Badge variant="primary" size="sm">
              🚶 ~{etaMinutes} min
            </Badge>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Why this spot:</p>
            <ul className="space-y-1.5">
              {why.map((reason, index) => (
                <li key={index} className="flex items-start gap-2 text-gray-700">
                  <span className="text-orange-500 mt-0.5">✓</span>
                  <span className="text-sm">{reason}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-white border-2 border-orange-500 text-orange-600 font-semibold rounded-full hover:bg-orange-50 transition-all text-center text-sm shadow-sm hover:shadow-md"
            >
              Visit Website
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 px-4 py-3 font-semibold rounded-full transition-all text-center text-sm shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
              websiteUrl
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            📍 Open in Maps
          </a>
        </div>
      </div>
    </Card>
  );
}
