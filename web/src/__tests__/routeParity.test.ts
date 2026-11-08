import { describe, it, expect } from 'vitest';
import routeVectorsData from './fixtures/route_vectors.json';
import { solveTraverse, type RouteWorkerPayload } from '../workers/routeWorker';
import type { VisibilityCube } from '../types';

describe('Route Solver Cross-Language Parity (TypeScript vs Python Core)', () => {
  it('validates 200+ shared vectors with 100% agreement between TypeScript and Python', () => {
    const vectors = routeVectorsData.vectors;
    expect(vectors.length).toBeGreaterThanOrEqual(200);

    let matched = 0;
    for (const v of vectors) {
      const cube = v.cube as unknown as VisibilityCube;
      const params = v.params;

      const payload: RouteWorkerPayload = {
        cube,
        start: [params.start[0], params.start[1]],
        end: [params.end[0], params.end[1]],
        startTimeIdx: params.startTimeIdx,
        speed_m_s: params.speed_m_s,
        max_slope_deg: params.max_slope_deg,
        min_sun_frac: params.min_sun_frac,
        min_earth_frac: params.min_earth_frac,
        dark_budget_h: params.dark_budget_h,
        allow_wait: params.allow_wait,
        planner_mode: 'earliest_arrival',
      };

      const res = solveTraverse(payload);

      expect(res.feasible).toBe(v.expected.feasible);

      if (v.expected.feasible) {
        expect(Math.abs(res.metrics.duration_h - v.expected.duration_h)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(res.metrics.total_distance_m - v.expected.total_distance_m)).toBeLessThanOrEqual(0.1);
        expect(res.path).toEqual(v.expected.path);
      }
      matched++;
    }

    expect(matched).toBe(vectors.length);
  });

  describe('Move Step Discretisation Tests (1.0 step, 0.4 steps, 3.2 steps)', () => {
    const baseEpochMs = 1761955200000; // 2026-11-01T00:00:00Z

    // 1. One move takes exactly 1.0 step: spacing 100m, speed 0.1 m/s => tau = 1000s = 1 step
    it('handles moves taking exactly 1.0 step', () => {
      const stepDtS = 1000;
      const timestamps = Array.from({ length: 6 }, (_, i) =>
        new Date(baseEpochMs + i * stepDtS * 1000).toISOString()
      );
      const cube: VisibilityCube = {
        grid: { origin: [0, -89], spacing_m: 100, nx: 4, ny: 1 },
        time_utc: timestamps,
        sun_frac: Array.from({ length: 6 }, () => [[100, 100, 100, 100]]),
        earth_frac: Array.from({ length: 6 }, () => [[100, 100, 100, 100]]),
        slope_deg: [[0, 0, 0, 0]],
        traversable: [[true, true, true, true]],
        flags: [],
      };

      // Traverse 3 moves: (0, 0) -> (3, 0)
      const res = solveTraverse({
        cube,
        start: [0, 0],
        end: [3, 0],
        startTimeIdx: 0,
        speed_m_s: 0.1,
        max_slope_deg: 15,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        allow_wait: false,
        dark_budget_h: 0,
        planner_mode: 'earliest_arrival',
      });

      expect(res.feasible).toBe(true);
      // 3 moves * 1000s = 3000s = 0.833h
      expect(Math.abs(res.metrics.duration_h - 0.83)).toBeLessThanOrEqual(0.01);
      // Discrete steps: t advances [0, 1, 2, 3]
      expect(res.path).toEqual([
        { x: 0, y: 0, t: 0 },
        { x: 1, y: 0, t: 1 },
        { x: 2, y: 0, t: 2 },
        { x: 3, y: 0, t: 3 },
      ]);
    });

    // 2. One move takes 0.4 steps: spacing 40m, speed 0.1 m/s => tau = 400s; step = 1000s
    it('handles sub-step moves taking 0.4 steps without artificial horizon exhaustion', () => {
      const stepDtS = 1000;
      const timestamps = Array.from({ length: 6 }, (_, i) =>
        new Date(baseEpochMs + i * stepDtS * 1000).toISOString()
      );
      const cube: VisibilityCube = {
        grid: { origin: [0, -89], spacing_m: 40, nx: 6, ny: 1 },
        time_utc: timestamps,
        sun_frac: Array.from({ length: 6 }, () => [[100, 100, 100, 100, 100, 100]]),
        earth_frac: Array.from({ length: 6 }, () => [[100, 100, 100, 100, 100, 100]]),
        slope_deg: [[0, 0, 0, 0, 0, 0]],
        traversable: [[true, true, true, true, true, true]],
        flags: [],
      };

      // Traverse 5 moves: (0, 0) -> (5, 0)
      // Move 1: g=400s => ceil(0.4) = 1
      // Move 2: g=800s => ceil(0.8) = 1
      // Move 3: g=1200s => ceil(1.2) = 2
      // Move 4: g=1600s => ceil(1.6) = 2
      // Move 5: g=2000s => ceil(2.0) = 2
      const res = solveTraverse({
        cube,
        start: [0, 0],
        end: [5, 0],
        startTimeIdx: 0,
        speed_m_s: 0.1,
        max_slope_deg: 15,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        allow_wait: false,
        dark_budget_h: 0,
        planner_mode: 'earliest_arrival',
      });

      expect(res.feasible).toBe(true);
      // 5 moves * 400s = 2000s = 0.555h
      expect(Math.abs(res.metrics.duration_h - 0.56)).toBeLessThanOrEqual(0.01);
      // Discrete steps: t advances [0, 1, 1, 2, 2, 2]
      expect(res.path).toEqual([
        { x: 0, y: 0, t: 0 },
        { x: 1, y: 0, t: 1 },
        { x: 2, y: 0, t: 1 },
        { x: 3, y: 0, t: 2 },
        { x: 4, y: 0, t: 2 },
        { x: 5, y: 0, t: 2 },
      ]);
    });

    // 3. One move takes 3.2 steps: spacing 320m, speed 0.1 m/s => tau = 3200s; step = 1000s
    it('handles multi-step moves taking 3.2 steps per move', () => {
      const stepDtS = 1000;
      const timestamps = Array.from({ length: 15 }, (_, i) =>
        new Date(baseEpochMs + i * stepDtS * 1000).toISOString()
      );
      const cube: VisibilityCube = {
        grid: { origin: [0, -89], spacing_m: 320, nx: 4, ny: 1 },
        time_utc: timestamps,
        sun_frac: Array.from({ length: 15 }, () => [[100, 100, 100, 100]]),
        earth_frac: Array.from({ length: 15 }, () => [[100, 100, 100, 100]]),
        slope_deg: [[0, 0, 0, 0]],
        traversable: [[true, true, true, true]],
        flags: [],
      };

      // Traverse 3 moves: (0, 0) -> (3, 0)
      // Move 1: g=3200s => ceil(3.2) = 4
      // Move 2: g=6400s => ceil(6.4) = 7
      // Move 3: g=9600s => ceil(9.6) = 10
      const res = solveTraverse({
        cube,
        start: [0, 0],
        end: [3, 0],
        startTimeIdx: 0,
        speed_m_s: 0.1,
        max_slope_deg: 15,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        allow_wait: false,
        dark_budget_h: 0,
        planner_mode: 'earliest_arrival',
      });

      expect(res.feasible).toBe(true);
      // 3 moves * 3200s = 9600s = 2.666h
      expect(Math.abs(res.metrics.duration_h - 2.67)).toBeLessThanOrEqual(0.01);
      // Discrete steps: t advances [0, 4, 7, 10]
      expect(res.path).toEqual([
        { x: 0, y: 0, t: 0 },
        { x: 1, y: 0, t: 4 },
        { x: 2, y: 0, t: 7 },
        { x: 3, y: 0, t: 10 },
      ]);
    });
  });
});
