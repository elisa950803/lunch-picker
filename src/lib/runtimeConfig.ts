/**
 * Runtime configuration loader
 * Loads config.json at runtime (no rebuild needed to change backend URL)
 */

export type RuntimeConfig = {
  API_BASE_URL: string;
};

// Module-level cache (loads once)
let cachedConfig: RuntimeConfig | null = null;
let configLoadPromise: Promise<RuntimeConfig | null> | null = null;

/**
 * Get the base path for the app (e.g., /lunch-picker on GitHub Pages)
 * Derived from <base href> if present, else from URL pathname
 */
function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  
  // Compute repo base path
  // First try <base href>, then fallback to first path segment
  const baseHref = (document.querySelector('base')?.getAttribute('href') ?? '').replace(/\/$/, '');
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const repoBase = baseHref || (pathSegments.length ? '/' + pathSegments[0] : '');
  
  return repoBase;
}

/**
 * Load runtime configuration from config.json
 * Must not throw; returns null on any failure
 * Uses cache: "no-store" to always fetch fresh config
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }
  
  // Return existing promise if already loading
  if (configLoadPromise) {
    return configLoadPromise;
  }
  
  // Start loading
  configLoadPromise = (async () => {
    try {
      const basePath = getBasePath();
      // Ensure no double slashes: basePath is either empty or starts with /, config.json starts with /
      const configUrl = basePath + '/config.json';
      
      // Debug log (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[RuntimeConfig] Fetching config from:', configUrl);
      }
      
      const response = await fetch(configUrl, {
        cache: 'no-store', // Always fetch fresh config
      });
      
      if (!response.ok) {
        console.warn('[RuntimeConfig] Failed to load config.json:', response.status);
        return null;
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn('[RuntimeConfig] config.json is not JSON');
        return null;
      }
      
      const config = await response.json() as RuntimeConfig;
      
      // Validate structure
      if (typeof config.API_BASE_URL === 'string') {
        cachedConfig = config;
        return config;
      }
      
      console.warn('[RuntimeConfig] Invalid config.json structure');
      return null;
    } catch (error) {
      console.warn('[RuntimeConfig] Error loading config.json:', error);
      return null;
    } finally {
      configLoadPromise = null;
    }
  })();
  
  return configLoadPromise;
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLoadPromise = null;
}
