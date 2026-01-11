'use client';

interface LoadingStateProps {
  error?: string | null;
  onRetry?: () => void;
}

export default function LoadingState({ error, onRetry }: LoadingStateProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="text-6xl">😔</div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-6xl animate-bounce">🥟</div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cooking up ideas...</h2>
        <p className="text-gray-600 mb-4">Finding the perfect spots for you</p>
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></span>
        </div>
      </div>
    </div>
  );
}
