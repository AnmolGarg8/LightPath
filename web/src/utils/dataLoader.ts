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
import { validatePayload, DataValidationError, IndexSchema, IndexData } from '../types/schemas';
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

/**
 * Single source of truth helper to load index.json catalog.
 */
export async function getSiteCatalog(): Promise<IndexData> {
  return fetchJsonData('./data/index.json', IndexSchema);
}

/**
 * Hook to access the site catalog, demo site ID, and secondary site ID.
 * Follows Rule 1: index.json is the single source of truth.
 */
export function useSiteCatalog(): {
  catalog: IndexData | null;
  demoSiteId: string;
  secondSiteId: string;
  loading: boolean;
} {
  const [catalog, setCatalog] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    getSiteCatalog()
      .then((data) => {
        if (active) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const demoSite = catalog?.sites.find((s) => s.is_demo_site) || catalog?.sites[0];
  const demoSiteId = demoSite?.id || 'synthetic-proving-ground';
  const secondSite = catalog?.sites.find((s) => s.id !== demoSiteId) || catalog?.sites[1];
  const secondSiteId = secondSite?.id || demoSiteId;

  return { catalog, demoSiteId, secondSiteId, loading };
}
