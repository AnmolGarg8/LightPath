import { describe, it, expect } from 'vitest';
import { VisibilityCube } from '../types';
import {
  compareConservativeRoutes,
  solveLandingDispersion,
} from '../workers/routeWorker';

describe('Terrain Uncertainty & Landing Dispersion Robustness', () => {
  // Helper to construct synthetic cube
  function makeSyntheticCube(
    nx = 15,
    ny = 15,
    numT = 15,
    wallColumn: number | null = null,
    spacingM = 50.0
  ): VisibilityCube {
    const time_utc = Array.from({ length: numT }, (_, i) => `2026-11-01T0${i}:00:00Z`);
    const traversable: boolean[][] = [];
    const slope_deg: number[][] = [];
    const sun_frac: number[][][] = [];
    const earth_frac: number[][][] = [];

    for (let y = 0; y < ny; y++) {
      traversable[y] = [];
      slope_deg[y] = [];
      for (let x = 0; x < nx; x++) {
        if (wallColumn !== null && x <= wallColumn) {
          traversable[y][x] = false; // wall
          slope_deg[y][x] = 25.0;
        } else {
          traversable[y][x] = true;
          slope_deg[y][x] = 2.0;
        }
      }
    }

    for (let t = 0; t < numT; t++) {
      sun_frac[t] = [];
      earth_frac[t] = [];
      for (let y = 0; y < ny; y++) {
        sun_frac[t][y] = [];
        earth_frac[t][y] = [];
        for (let x = 0; x < nx; x++) {
          sun_frac[t][y][x] = 100;
          earth_frac[t][y][x] = 100;
        }
      }
    }

    return {
      grid: { origin: [0.0, -89.0], spacing_m: spacingM, nx, ny },
      time_utc,
      sun_frac,
      earth_frac,
      slope_deg,
      traversable,
      flags: ['synthetic_testing'],
    };
  }

  it('Requirement 1: with zero margin the conservative route equals the nominal route', () => {
    const cube = makeSyntheticCube(8, 8, 10);
    const start: [number, number] = [1, 1];
    const end: [number, number] = [5, 5];

    const comp = compareConservativeRoutes({
      cube,
      start,
      end,
      startTimeIdx: 0,
      speed_m_s: 0.05,
      horizon_margin_deg: 0.0,
    });

    expect(comp.nominal.feasible).toBe(true);
    expect(comp.conservative.feasible).toBe(true);
    expect(comp.nominal.path).toEqual(comp.conservative.path);
    expect(comp.nominal.metrics.total_distance_m).toBe(comp.conservative.metrics.total_distance_m);
    expect(comp.nominal.metrics.duration_h).toBe(comp.conservative.metrics.duration_h);
    expect(comp.cost_of_caution.extra_distance_m).toBe(0);
    expect(comp.cost_of_caution.extra_duration_h).toBe(0);
  });

  it('Requirement 1: conservative mode marks marginal cells as dark and reports cost of caution', () => {
    const cube = makeSyntheticCube(6, 6, 8);
    // Make start cell marginally illuminated: 55%
    // Threshold is 50%. With margin 0.10 deg, effective fraction is 55% - 10% = 45% < 50%
    cube.sun_frac[0][1][1] = 55;

    const comp = compareConservativeRoutes({
      cube,
      start: [1, 1],
      end: [4, 4],
      startTimeIdx: 0,
      speed_m_s: 0.05,
      min_sun_frac: 0.50,
      dark_budget_h: 0.0,
      horizon_margin_deg: 0.10,
    });

    expect(comp.nominal.feasible).toBe(true);
    expect(comp.conservative.feasible).toBe(false);
    expect(comp.cost_of_caution.explanation).toContain('Conservative route is blocked under 0.10° horizon elevation margin');
  });

  it('Requirement 2: landing dispersion on uniform synthetic terrain gives 100 percent', () => {
    const cube = makeSyntheticCube(15, 15, 15, null, 50.0);
    const nominalStart: [number, number] = [7, 7];
    const goal: [number, number] = [12, 12];

    const res = solveLandingDispersion({
      cube,
      nominalCoord: nominalStart,
      goalCoord: goal,
      radius_m: 250.0,
      num_points: 25,
      startTimeIdx: 0,
      speed_m_s: 0.05,
    });

    expect(res.num_points).toBe(25);
    expect(res.success_count).toBe(25);
    expect(res.failure_count).toBe(0);
    expect(res.success_rate).toBe(1.0);
    expect(res.solve_time_ms).toBeGreaterThanOrEqual(0);
    expect(res.plain_language_summary).toContain('All 25 of 25 landing points allow the trip within the window');
    expect(res.min_arrival_h).not.toBeNull();
    expect(res.max_arrival_h).not.toBeNull();
    expect(res.min_arrival_h!).toBeLessThanOrEqual(res.max_arrival_h!);
  });

  it('Requirement 2: a wall splitting the disc gives the expected share (~48%)', () => {
    // 20x20 grid, spacing 50m. Nominal at (10, 10).
    // Wall at x <= 10. Unblocked at x > 10.
    const cube = makeSyntheticCube(20, 20, 15, 10, 50.0);
    const nominalStart: [number, number] = [10, 10];
    const goal: [number, number] = [18, 10];

    const res = solveLandingDispersion({
      cube,
      nominalCoord: nominalStart,
      goalCoord: goal,
      radius_m: 250.0,
      num_points: 25,
      startTimeIdx: 0,
      speed_m_s: 0.05,
    });

    // In 25-point symmetric pattern:
    // Center point (0, 0) is at x=10 (wall -> blocked)
    // Ring 1 (8 points): 4 points at x > 10, 4 at x < 10
    // Ring 2 (16 points): 8 points at x > 10, 8 at x < 10
    // Exactly 4 + 8 = 12 points succeed, 1 + 4 + 8 = 13 fail.
    expect(res.success_count).toBe(12);
    expect(res.failure_count).toBe(13);
    expect(res.success_rate).toBe(12 / 25);
    expect(res.plain_language_summary).toContain('12 of 25 landing points allow the trip within the window');
  });

  it('Requirement 2: landing dispersion is deterministic', () => {
    const cube = makeSyntheticCube(12, 12, 12, null, 50.0);
    const res1 = solveLandingDispersion({
      cube,
      nominalCoord: [6, 6],
      goalCoord: [10, 10],
      radius_m: 250.0,
      num_points: 25,
    });
    const res2 = solveLandingDispersion({
      cube,
      nominalCoord: [6, 6],
      goalCoord: [10, 10],
      radius_m: 250.0,
      num_points: 25,
    });

    expect(res1.success_count).toBe(res2.success_count);
    expect(res1.success_rate).toBe(res2.success_rate);
    expect(res1.plain_language_summary).toBe(res2.plain_language_summary);
    expect(res1.points.map((p) => p.coord)).toEqual(res2.points.map((p) => p.coord));
    expect(res1.points.map((p) => p.feasible)).toEqual(res2.points.map((p) => p.feasible));
  });

  it('Performance: reports the time for 25 solves in the worker', () => {
    const cube = makeSyntheticCube(15, 15, 15, null, 50.0);
    const res = solveLandingDispersion({
      cube,
      nominalCoord: [7, 7],
      goalCoord: [12, 12],
      radius_m: 250.0,
      num_points: 25,
    });

    // Verify time is tracked and well under reasonable worker threshold
    expect(res.solve_time_ms).toBeGreaterThanOrEqual(0);
    expect(res.solve_time_ms).toBeLessThan(3000); // under 3 seconds
  });
});
