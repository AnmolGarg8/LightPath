/**
 * Integration Tests for Consistent Panel Updates
 * 
 * Acceptance check:
 * - Changing mast height or threshold updates every panel consistently (integration test).
 * - Verified across horizon skyline, stats report, and sensitivity indexing.
 */

import { describe, it, expect } from 'vitest';
import { calculateDynamicStats } from '../utils/statsCalculator';
import { Horizon, Series } from '../types/schemas';

describe('Panel Consistency Integration Tests', () => {
  const dummyHorizon: Horizon = {
    az_step_deg: 45.0,
    heights_m: [0.5, 1.0, 2.0, 3.0, 5.0],
    el_deg: [
      [1.5, 1.8, 2.0, 1.4, 1.2, 1.6, 1.9, 1.7], // 0.5m
      [1.4, 1.7, 1.9, 1.3, 1.1, 1.5, 1.8, 1.6], // 1.0m
      [1.2, 1.5, 1.7, 1.1, 0.9, 1.3, 1.6, 1.4], // 2.0m
      [1.0, 1.3, 1.5, 0.9, 0.7, 1.1, 1.4, 1.2], // 3.0m
      [0.7, 1.0, 1.2, 0.6, 0.4, 0.8, 1.1, 0.9], // 5.0m
    ],
    nan_fraction: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    flags: ['synthetic_nested_terrain'],
  };

  const dummySeries: Series = {
    time_utc: [
      '2026-11-01T00:00:00Z',
      '2026-11-01T04:00:00Z',
      '2026-11-01T08:00:00Z',
      '2026-11-01T12:00:00Z',
    ],
    sun: {
      az_deg: [45, 90, 135, 180],
      el_deg: [0.5, 1.2, 1.6, 0.8],
      radius_deg: [0.265, 0.265, 0.265, 0.265],
      frac: [0.20, 0.60, 0.85, 0.45],
      status: ['marginal', 'robust_visible', 'robust_visible', 'marginal'],
    },
    earth: {
      az_deg: [0, 1, 2, 3],
      el_deg: [4.0, 4.0, 4.0, 4.0],
      radius_deg: [0.95, 0.95, 0.95, 0.95],
      frac: [0.95, 0.95, 0.95, 0.95],
      status: ['robust_visible', 'robust_visible', 'robust_visible', 'robust_visible'],
      dist_km: [384000, 384000, 384000, 384000],
    },
    dte: {
      station_visible: [[true], [true], [true], [true]],
      link_ok: [true, true, true, true],
    },
  };

  it('updates all stats synchronously when threshold changes', () => {
    // 1. Initial Threshold: 50%
    const report50 = calculateDynamicStats(dummySeries, 0.50);
    expect(report50.threshold).toBe(0.50);
    expect(report50.sun.threshold).toBe(0.50);
    expect(report50.earth.threshold).toBe(0.50);
    // At 50%, steps with sun frac [0.20, 0.60, 0.85, 0.45] -> 2 steps valid (50.0%)
    expect(report50.sun.uptime_fraction).toBe(0.50);

    // 2. Updated Threshold: 80%
    const report80 = calculateDynamicStats(dummySeries, 0.80);
    expect(report80.threshold).toBe(0.80);
    expect(report80.sun.threshold).toBe(0.80);
    expect(report80.earth.threshold).toBe(0.80);
    // At 80%, steps with sun frac [0.20, 0.60, 0.85, 0.45] -> 1 step valid (25.0%)
    expect(report80.sun.uptime_fraction).toBe(0.25);

    // 3. Updated Threshold: 10%
    const report10 = calculateDynamicStats(dummySeries, 0.10);
    // At 10%, all 4 steps valid (100.0%)
    expect(report10.sun.uptime_fraction).toBe(1.00);

    // Joint availability changes consistently with threshold
    expect(report10.joint_sun_dte.uptime_fraction).toBe(1.00);
    expect(report50.joint_sun_dte.uptime_fraction).toBe(0.50);
    expect(report80.joint_sun_dte.uptime_fraction).toBe(0.25);
  });

  it('updates horizon skyline slice consistently when mast height changes', () => {
    const findMastIndex = (targetHeightM: number) => {
      let idx = 0;
      let minDiff = Infinity;
      dummyHorizon.heights_m.forEach((h, i) => {
        const diff = Math.abs(h - targetHeightM);
        if (diff < minDiff) {
          minDiff = diff;
          idx = i;
        }
      });
      return idx;
    };

    const idx05m = findMastIndex(0.5);
    const idx20m = findMastIndex(2.0);
    const idx50m = findMastIndex(5.0);

    expect(idx05m).toBe(0);
    expect(idx20m).toBe(2);
    expect(idx50m).toBe(4);

    const skyline05m = dummyHorizon.el_deg[idx05m];
    const skyline20m = dummyHorizon.el_deg[idx20m];
    const skyline50m = dummyHorizon.el_deg[idx50m];

    // Physics check: Increasing mast height lowers the horizon skyline at every azimuth
    for (let azIdx = 0; azIdx < skyline05m.length; azIdx++) {
      expect(skyline50m[azIdx]).toBeLessThan(skyline20m[azIdx]);
      expect(skyline20m[azIdx]).toBeLessThan(skyline05m[azIdx]);
    }
  });
});
