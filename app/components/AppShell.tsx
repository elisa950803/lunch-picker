'use client';

import Link from 'next/link';

interface AppShellProps {
  children: React.ReactNode;
  showBackButton?: boolean;
}

export default function AppShell({ children, showBackButton = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="text-3xl sm:text-4xl animate-bounce group-hover:animate-none">
                🥟
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                Food Around Work
              </h1>
            </Link>
            {showBackButton && (
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-600 transition-all text-sm font-medium"
              >
                <span>←</span>
                <span className="hidden sm:inline">Back</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
