'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loadConfig, getApiBaseUrl } from '../../lib/runtimeConfig';

interface ConfigContextValue {
  apiBaseUrl: string;
  loaded: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  apiBaseUrl: '',
  loaded: false,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    loadConfig().then((config) => {
      if (config) {
        setApiBaseUrl(config.API_BASE_URL || '');
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
