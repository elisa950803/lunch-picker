import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Food Around Work',
  description: 'Find great lunch and dinner recommendations near your workplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  return (
    <html lang="en">
      <body>
        {googleMapsApiKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
            strategy="afterInteractive"
            onLoad={() => {
              // Script loaded successfully
              if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
                console.log('Google Maps Places API loaded successfully');
              }
            }}
            onError={(e) => {
              console.error('Google Maps Places API script failed to load:', e);
            }}
          />
        )}
        {children}
      </body>
    </html>
  );
}
