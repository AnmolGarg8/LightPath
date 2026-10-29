import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { fetchJsonData, clearDataCache } from '../utils/dataLoader';

describe('Data Loader with Caching and Validation', () => {
  beforeEach(() => {
    clearDataCache();
    vi.restoreAllMocks();
  });

  const MockItemSchema = z.object({
    id: z.string(),
    count: z.number(),
  });

  it('fetches, validates, and caches JSON data', async () => {
    const mockData = { id: 'test-1', count: 42 };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    // Call 1: triggers fetch
    const res1 = await fetchJsonData('/api/item', MockItemSchema);
    expect(res1.id).toBe('test-1');
    expect(res1.count).toBe(42);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call 2: served from cache
    const res2 = await fetchJsonData('/api/item', MockItemSchema);
    expect(res2.id).toBe('test-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1!
  });

  it('bypasses cache when clearDataCache is called', async () => {
    const mockData = { id: 'test-2', count: 100 };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await fetchJsonData('/api/item2', MockItemSchema);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    clearDataCache();

    await fetchJsonData('/api/item2', MockItemSchema);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws descriptive error on HTTP failure', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(fetchJsonData('/api/missing', MockItemSchema)).rejects.toThrow(
      /HTTP 404 Not Found/
    );
  });

  it('throws DataValidationError when JSON does not match schema', async () => {
    const invalidData = { id: 'test-3', count: 'not-a-number' };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => invalidData,
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(fetchJsonData('/api/bad-shape', MockItemSchema)).rejects.toThrow(
      /Schema Validation Failure/
    );
  });
});
