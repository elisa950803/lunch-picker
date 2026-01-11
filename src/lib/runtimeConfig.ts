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
 * Derived from <base href> if present, else empty string
 */
function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  
  // Prefer <base href="..."> if present
  const baseTag = document.querySelector('base');
  if (baseTag?.getAttribute('href')) {
    const href = baseTag.getAttribute('href')!;
    return href.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Else empty string (no basePath)
  return '';
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
      const configUrl = `${basePath}/config.json`;
      
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
