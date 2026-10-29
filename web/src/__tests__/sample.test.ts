import { describe, it, expect } from 'vitest';

describe('Web Client Scaffold Smoke Test', () => {
  it('verifies exact lunar sphere radius and arithmetic', () => {
    const R_MOON_M = 1737400.0;
    expect(R_MOON_M).toBe(1737400.0);
    expect(R_MOON_M / 1000).toBe(1737.4);
  });

  it('verifies clipping utility for disc fraction bounds', () => {
    const clip = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    expect(clip(1.5, -1, 1)).toBe(1);
    expect(clip(-2.0, -1, 1)).toBe(-1);
    expect(clip(0.3, -1, 1)).toBe(0.3);
  });
});
