/**
 * Unit Tests for Dynamic Threshold Handling and Window Extraction
 * 
 * Acceptance check:
 * - Tests for threshold handling (updating stats dynamically).
 * - Correct calculation of continuous windows, longest outage, and crossings.
 */

import { describe, it, expect } from 'vitest';
import { calculateDynamicStats } from '../utils/statsCalculator';
import { Series } from '../types/schemas';

describe('Threshold Handling & Dynamic Statistics', () => {
  const dummySeries: Series = {
    time_utc: [
      '2026-11-01T00:00:00Z',
      '2026-11-01T04:00:00Z',
      '2026-11-01T08:00:00Z',
      '2026-11-01T12:00:00Z',
      '2026-11-01T16:00:00Z',
      '2026-11-01T20:00:00Z',
    ],
    sun: {
      az_deg: [0, 60, 120, 180, 240, 300],
      el_deg: [-0.5, 0.2, 0.8, 1.2, 0.1, -0.4],
      radius_deg: [0.265, 0.265, 0.265, 0.265, 0.265, 0.265],
      frac: [0.0, 0.35, 0.75, 0.90, 0.40, 0.05],
      status: ['robust_blocked', 'marginal', 'robust_visible', 'robust_visible', 'marginal', 'robust_blocked'],
    },
    earth: {
      az_deg: [45, 46, 47, 48, 49, 50],
      el_deg: [3.5, 3.6, 3.7, 3.8, 3.9, 4.0],
      radius_deg: [0.95, 0.95, 0.95, 0.95, 0.95, 0.95],
      frac: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      status: ['robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible'],
      dist_km: [384000, 384000, 384000, 384000, 384000, 384000],
    },
    dte: {
      station_visible: [[true], [true], [true], [true], [true], [true]],
      link_ok: [true, true, true, true, true, true],
    },
  };

  it('correctly adapts uptime fraction across different threshold presets', () => {
    // Threshold 10% (grazing): indices 1, 2, 3, 4 are >= 0.10 -> 4/6 = 66.67%
    const statsGrazing = calculateDynamicStats(dummySeries, 0.10);
    expect(statsGrazing.sun.uptime_fraction).toBeCloseTo(4 / 6, 2);

    // Threshold 50% (half-disc): indices 2, 3 are >= 0.50 -> 2/6 = 33.33%
    const statsHalf = calculateDynamicStats(dummySeries, 0.50);
    expect(statsHalf.sun.uptime_fraction).toBeCloseTo(2 / 6, 2);

    // Threshold 80% (robust): index 3 is >= 0.80 -> 1/6 = 16.67%
    const statsRobust = calculateDynamicStats(dummySeries, 0.80);
    expect(statsRobust.sun.uptime_fraction).toBeCloseTo(1 / 6, 2);
  });

  it('accurately identifies longest outage duration in hours', () => {
    // At threshold 50%, indices [0, 1] are below (8h), indices [4, 5] are below (8h)
    const statsHalf = calculateDynamicStats(dummySeries, 0.50);
    expect(statsHalf.sun.longest_outage_h).toBe(8.0);
    expect(statsHalf.sun.longest_window_h).toBe(8.0);
  });

  it('detects sunrise and sunset events crossing the threshold', () => {
    const stats = calculateDynamicStats(dummySeries, 0.50);
    const sunEvents = stats.events.filter((e) => e.type === 'sunrise' || e.type === 'sunset');

    // Index 1 (0.35) -> Index 2 (0.75): crosses 0.50 from below -> Sunrise
    // Index 3 (0.90) -> Index 4 (0.40): crosses 0.50 from above -> Sunset
    expect(sunEvents.length).toBe(2);
    expect(sunEvents[0].type).toBe('sunrise');
    expect(sunEvents[0].index).toBe(2);
    expect(sunEvents[1].type).toBe('sunset');
    expect(sunEvents[1].index).toBe(4);
  });
});
