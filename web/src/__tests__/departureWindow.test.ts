import { describe, it, expect } from 'vitest';
import { solveDepartureMap, solveTraverse } from '../workers/routeWorker';
import type { VisibilityCube } from '../types';

describe('Departure Window Map Engine (Worker)', () => {
  const numT = 12;
  const timestamps = Array.from({ length: numT }, (_, i) => `2026-11-01T${String(i).padStart(2, '0')}:00:00Z`);

  // 1D corridor of 5 cells (0..4) on row 0.
  // Rows 1 and 2 are blocked.
  // Cell (2, 0) falls into shadow at t >= 4.
  const createSyntheticMovingShadowCube = (): VisibilityCube => {
    const sunFrac: number[][][] = [];
    const earthFrac: number[][][] = [];

    for (let t = 0; t < numT; t++) {
      const sunGrid: number[][] = [
        [100, 100, t >= 4 ? 0 : 100, 100, 100],
        [100, 100, 100, 100, 100],
        [100, 100, 100, 100, 100],
      ];
      const earthGrid: number[][] = [
        [100, 100, 100, 100, 100],
        [100, 100, 100, 100, 100],
        [100, 100, 100, 100, 100],
      ];
      sunFrac.push(sunGrid);
      earthFrac.push(earthGrid);
    }

    const traversable: boolean[][] = [
      [true, true, true, true, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ];

    const slopeDeg: number[][] = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];

    return {
      grid: { origin: [0, -89], spacing_m: 36, nx: 5, ny: 3 },
      time_utc: timestamps,
      sun_frac: sunFrac,
      earth_frac: earthFrac,
      slope_deg: slopeDeg,
      traversable,
      flags: [],
    };
  };

  it('matches brute-force single traverse evaluations across all departure steps', () => {
    const cube = createSyntheticMovingShadowCube();
    const start: [number, number] = [0, 0];
    const end: [number, number] = [4, 0];
    const speed = 0.01; // 36m / 0.01 m/s = 3600s = 1 hr per cell move

    const depMap = solveDepartureMap({
      cube,
      start,
      end,
      startTimeIdx: 0,
      speed_m_s: speed,
      max_slope_deg: 15,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      dark_budget_h: 0,
    });

    expect(depMap.total_departures_evaluated).toBe(numT);
    expect(depMap.departures.length).toBe(numT);

    for (let t = 0; t < numT; t++) {
      const bfRes = solveTraverse({
        cube,
        start,
        end,
        startTimeIdx: t,
        speed_m_s: speed,
        max_slope_deg: 15,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        allow_wait: true,
        dark_budget_h: 0,
        planner_mode: 'earliest_arrival',
      });

      const entry = depMap.departures[t];
      expect(entry.departure_idx).toBe(t);
      expect(entry.feasible).toBe(bfRes.feasible);

      if (bfRes.feasible) {
        expect(entry.arrival_idx).toBe(bfRes.path[bfRes.path.length - 1].t);
        expect(Math.abs((entry.duration_h ?? 0) - bfRes.metrics.duration_h)).toBeLessThan(1e-3);
      } else {
        expect(entry.arrival_idx).toBeNull();
        expect(entry.infeasible_reason).toBeTruthy();
      }
    }

    // Departure 0 and 1 are feasible; departure >= 2 hit shadow at cell (2, 0)
    expect(depMap.earliest_feasible_idx).toBe(0);
    expect(depMap.latest_safe_idx).toBe(1);
    expect(depMap.departures[0].feasible).toBe(true);
    expect(depMap.departures[1].feasible).toBe(true);
    expect(depMap.departures[2].feasible).toBe(false);
  });

  it('correctly reports latest safe departure equal to planner_mode="latest_departure"', () => {
    const cube = createSyntheticMovingShadowCube();
    const start: [number, number] = [0, 0];
    const end: [number, number] = [4, 0];
    const speed = 0.01;

    const depMap = solveDepartureMap({
      cube,
      start,
      end,
      startTimeIdx: 0,
      speed_m_s: speed,
      max_slope_deg: 15,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      dark_budget_h: 0,
    });

    const latestRes = solveTraverse({
      cube,
      start,
      end,
      startTimeIdx: 0,
      speed_m_s: speed,
      max_slope_deg: 15,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      dark_budget_h: 0,
      planner_mode: 'latest_departure',
    });

    expect(latestRes.feasible).toBe(true);
    expect(latestRes.path[0].t).toBe(depMap.latest_safe_idx);
  });

  it('generates factual plain-language summary with feasible windows and blocking cause', () => {
    const cube = createSyntheticMovingShadowCube();
    const start: [number, number] = [0, 0];
    const end: [number, number] = [4, 0];

    const depMap = solveDepartureMap({
      cube,
      start,
      end,
      startTimeIdx: 0,
      speed_m_s: 0.01,
      max_slope_deg: 15,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      dark_budget_h: 0,
    });

    const summary = depMap.plain_language_summary;
    expect(summary).toContain('Leaving between');
    expect(summary).toContain('works; leaving after');
    expect(summary).toContain('does not because of');
    expect(summary.toLowerCase()).toContain('shadow');
  });

  it('evaluates 200 departure times in under 3 seconds', () => {
    const benchT = 200;
    const benchTimestamps = Array.from({ length: benchT }, (_, i) => `2026-11-01T${i}:00:00Z`);
    const sunGrid = Array.from({ length: 5 }, () => Array(5).fill(100));
    const earthGrid = Array.from({ length: 5 }, () => Array(5).fill(100));

    const cube: VisibilityCube = {
      grid: { origin: [0, -89], spacing_m: 20, nx: 5, ny: 5 },
      time_utc: benchTimestamps,
      sun_frac: Array.from({ length: benchT }, () => sunGrid),
      earth_frac: Array.from({ length: benchT }, () => earthGrid),
      slope_deg: Array.from({ length: 5 }, () => Array(5).fill(0)),
      traversable: Array.from({ length: 5 }, () => Array(5).fill(true)),
      flags: [],
    };

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [4, 4],
      startTimeIdx: 0,
      speed_m_s: 0.1,
      max_slope_deg: 15,
      min_sun_frac: 0.5,
      min_earth_frac: 0.5,
      allow_wait: true,
      dark_budget_h: 0,
    });

    expect(depMap.total_departures_evaluated).toBe(benchT);
    // Strict requirement: under 3 seconds
    expect(depMap.compute_time_s).toBeLessThan(3.0);
  });
});
