'use client';

import Link from 'next/link';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onBack?: () => void;
}

export default function EmptyState({
  title = "Oops! Something went wrong",
  message = "We couldn't find what you're looking for. Let's try again!",
  actionLabel = "Start New Search",
  actionHref = "/",
  onBack,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="text-6xl">😔</div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 max-w-md">{message}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span>←</span>
            <span>Go Back</span>
          </button>
        )}
        {actionHref && (
          <Link
            href={actionHref}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
