import { useState, useEffect, useRef } from 'react';
import { getPublicEnv } from '@/utils/env';

// Global cache for env variables to ensure consistency across components
const ENV_CACHE = new Map<string, string>();

/**
 * Universal hook for accessing environment variables that works in all components
 * @param key Environment variable name (without NEXT_PUBLIC_ prefix)
 * @param defaultValue Fallback value if not found
 */
export function useEnv(key: string, defaultValue?: string) {
  // Try to use cached value immediately to avoid unnecessary re-renders
  const cachedValue = ENV_CACHE.get(key);

  // For initial state, use cache first, then try direct call, then fallback to default
  const initialValue = cachedValue ||
    (typeof window !== 'undefined' ? getPublicEnv(key, defaultValue) : defaultValue || '');

  const [value, setValue] = useState(initialValue);
  const isHydrated = useRef(false);

  // Set up hydration detection
  useEffect(() => {
    isHydrated.current = true;

    // After hydration, get the actual value and update if needed
    const envValue = getPublicEnv(key, defaultValue);

    // Update cache for future components
    ENV_CACHE.set(key, envValue);

    // Only update state if value is different to avoid unnecessary renders
    if (envValue !== value) {
      setValue(envValue);
    }

    // This should run exactly once per component instance after hydration
  }, [key, defaultValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}
