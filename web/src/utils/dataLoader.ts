/**
 * LightPath Universal Data Loader
 * 
 * Features:
 * - In-memory LRU-style cache
 * - Schema validation via Zod
 * - Transparent decoding of LPVC binary cubes
 * - React hook with loading, error, and cached states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { validatePayload, DataValidationError } from '../types/schemas';
import { decodeVisibilityCube, DecodedVisibilityCube } from './cubeDecoder';

const memoryCache = new Map<string, unknown>();

/**
 * Clear or invalidate memory cache (useful for tests and forced reload)
 */
export function clearDataCache(): void {
  memoryCache.clear();
}

/**
 * Fetch and validate JSON data from static path
 */
export async function fetchJsonData<T>(url: string, schema: z.ZodSchema<T>, bypassCache = false): Promise<T> {
  const cacheKey = `json:${url}`;
  if (!bypassCache && memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) as T;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from '${url}': HTTP ${response.status} ${response.statusText}`);
  }

  const rawJson = await response.json();
  const validated = validatePayload(schema, rawJson, url);
  memoryCache.set(cacheKey, validated);
  return validated;
}

/**
 * Fetch and decode binary visibility cube
 */
export async function fetchBinaryCube(url: string, bypassCache = false): Promise<DecodedVisibilityCube> {
  const cacheKey = `cube:${url}`;
  if (!bypassCache && memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) as DecodedVisibilityCube;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch binary cube from '${url}': HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const decoded = await decodeVisibilityCube(arrayBuffer);
  memoryCache.set(cacheKey, decoded);
  return decoded;
}

export interface DataLoaderState<T> {
  data: T | null;
  loading: boolean;
  error: Error | DataValidationError | null;
  reload: () => void;
}

/**
 * React hook for loading schema-validated data
 */
export function useDataLoader<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
): DataLoaderState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | DataValidationError | null>(null);
  const [reloadIndex, setReloadIndex] = useState<number>(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => {
    setReloadIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [...deps, reloadIndex]);

  return { data, loading, error, reload };
}
