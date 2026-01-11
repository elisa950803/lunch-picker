'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loadRuntimeConfig } from '../../src/lib/runtimeConfig';

interface ConfigContextValue {
  apiBaseUrl: string | null;
  loaded: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  apiBaseUrl: null,
  loaded: false,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    loadRuntimeConfig().then((config) => {
      // If config missing or API_BASE_URL empty, set apiBaseUrl = null but loaded = true
      if (config && config.API_BASE_URL && config.API_BASE_URL.trim() !== '') {
        // Normalize: trim and remove trailing slash
        const normalized = config.API_BASE_URL.trim().replace(/\/+$/, '');
        setApiBaseUrl(normalized);
      } else {
        setApiBaseUrl(null);
      }
      setLoaded(true);
    });
  }, []);

  return (
    <ConfigContext.Provider value={{ apiBaseUrl, loaded }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
