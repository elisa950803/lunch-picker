/**
 * Runtime configuration loader
 * Loads config.json at runtime (no rebuild needed to change backend URL)
 */

interface RuntimeConfig {
  API_BASE_URL: string;
}

let cachedConfig: RuntimeConfig | null = null;
let configLoadPromise: Promise<RuntimeConfig | null> | null = null;

/**
 * Get the base path for the app (e.g., /lunch-picker on GitHub Pages)
 */
function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  
  // Try to get from base tag
  const baseTag = document.querySelector('base');
  if (baseTag?.getAttribute('href')) {
    const href = baseTag.getAttribute('href')!;
    return href.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Derive from pathname (take first segment if it looks like a repo name)
  const pathname = window.location.pathname;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && segments[0] !== 'index.html') {
    return '/' + segments[0];
  }
  
  return '';
}

/**
 * Load runtime configuration from config.json
 */
export async function loadConfig(): Promise<RuntimeConfig | null> {
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
        cache: 'no-cache', // Always check for updates
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
 * Get API base URL from config (synchronous, returns cached value or empty string)
 */
export function getApiBaseUrl(): string {
  return cachedConfig?.API_BASE_URL || '';
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLoadPromise = null;
}
