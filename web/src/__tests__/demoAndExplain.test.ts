/**
 * Unit & Acceptance Tests for Explain Steps and Guided Demo Script
 * 
 * Complies with Prompt 14 acceptance checks:
 * - 8 scripted steps with captions
 * - Total duration ~90 seconds
 * - Mathematical assertions for ridge decision and disc widths
 */

import { describe, it, expect } from 'vitest';
import { DEMO_STEPS } from '../data/demoScript';
import {
  elevationAngleDeg,
  discFractionFlat,
} from '../lib/geometry';

describe('Guided Demo Script (90-Second Walkthrough)', () => {
  it('contains exactly eight scripted steps', () => {
    expect(DEMO_STEPS.length).toBe(8);
  });

  it('completes guided tour in approximately 90 seconds (80s - 100s)', () => {
    const totalDurationSeconds = DEMO_STEPS.reduce((sum, s) => sum + s.durationSeconds, 0);
    expect(totalDurationSeconds).toBeGreaterThanOrEqual(80);
    expect(totalDurationSeconds).toBeLessThanOrEqual(100);
  });

  it('covers all mandatory views in sequence', () => {
    const routes = DEMO_STEPS.map((s) => s.route);
    expect(routes[0]).toBe('#/');
    expect(routes[1]).toContain('#/site/');
    expect(routes[4]).toContain('#/route/');
    expect(routes[6]).toContain('#/evidence/');
    expect(routes[7]).toContain('#/trust');
  });

  it('verifies Step 2 formula: 100m ridge at 10km produces ~0.408° (about 0.41°)', () => {
    const elDeg = elevationAngleDeg(10000.0, 100.0, 0.0);
    expect(Number(elDeg.toFixed(2))).toBe(0.41);
    expect(Math.abs(elDeg - 0.408031)).toBeLessThan(1e-4);
  });

  it('verifies Step 3 disc comparison: Earth disc (1.90°) is ~3.6x wider than Sun disc (0.53°)', () => {
    const sunDiam = 0.534;
    const earthDiam = 1.900;
    const ratio = earthDiam / sunDiam;
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(3.7);

    // If Sun center is at ridge crest, half disc is visible (50%)
    const sunFraction = discFractionFlat(0.0, 0.267);
    expect(Math.abs(sunFraction - 0.50)).toBeLessThan(1e-9);

    // If Earth center is at ridge crest, half disc is visible (50%)
    const earthFraction = discFractionFlat(0.0, 0.950);
    expect(Math.abs(earthFraction - 0.50)).toBeLessThan(1e-9);
  });
});
