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
  
  // Debug: Log API key availability (length only, not the key itself)
  if (typeof window === 'undefined') {
    // Server-side render
    const keyLength = googleMapsApiKey ? googleMapsApiKey.length : 0;
    if (keyLength === 0) {
      console.warn('[Google Maps] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set at build time. Script will not load.');
    } else {
      console.log(`[Google Maps] API key found (length: ${keyLength}). Script will load.`);
    }
  }
  
  return (
    <html lang="en">
      <body>
        {googleMapsApiKey ? (
          <Script
            id="google-maps-script"
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
            strategy="afterInteractive"
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
