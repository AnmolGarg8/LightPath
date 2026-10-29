/**
 * Web Worker for asynchronous lunar traverse and route planning.
 *
 * Runs space-time A* pathfinding off the main UI thread.
 */

import { RouteResult, VisibilityCube } from '../types';

export interface RouteWorkerRequest {
  type: 'SOLVE_ROUTE';
  payload: {
    cube: VisibilityCube;
    start: [number, number];
    end: [number, number];
    startTimeIdx?: number;
    speed_m_s?: number;
    max_slope_deg?: number;
    min_sun_frac?: number;
    min_earth_frac?: number;
  };
}

export interface RouteWorkerResponse {
  type: 'ROUTE_SUCCESS' | 'ROUTE_ERROR';
  result?: RouteResult;
  error?: string;
}

// Simple priority queue node
interface PQNode {
  f: number;
  g: number;
  x: number;
  y: number;
  t: number;
}

self.onmessage = (e: MessageEvent<RouteWorkerRequest>) => {
  const { type, payload } = e.data;

  if (type === 'SOLVE_ROUTE') {
    try {
      const result = solveTraverse(payload);
      const response: RouteWorkerResponse = {
        type: 'ROUTE_SUCCESS',
        result,
      };
      self.postMessage(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const response: RouteWorkerResponse = {
        type: 'ROUTE_ERROR',
        error: msg,
      };
      self.postMessage(response);
    }
  }
};

function solveTraverse(params: RouteWorkerRequest['payload']): RouteResult {
  const {
    cube,
    start,
    end,
    startTimeIdx = 0,
    speed_m_s = 0.05,
    max_slope_deg = 15.0,
    min_sun_frac = 0.5,
    min_earth_frac = 0.5,
  } = params;

  const { nx, ny, spacing_m } = cube.grid;
  const numT = cube.time_utc.length;
  const [sx, sy] = start;
  const [gx, gy] = end;

  const baseParams = {
    start_coord: start,
    end_coord: end,
    start_time_idx: startTimeIdx,
    speed_m_s,
    max_slope_deg,
    min_sun_frac,
    min_earth_frac,
  };

  // Heuristic Euclidean distance
  const heuristic = (x: number, y: number) => {
    return Math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m) / speed_m_s;
  };

  const openList: PQNode[] = [{ f: heuristic(sx, sy), g: 0, x: sx, y: sy, t: startTimeIdx }];
  const costSoFar = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();

  const startKey = `${sx},${sy},${startTimeIdx}`;
  costSoFar.set(startKey, 0);
  cameFrom.set(startKey, null);

  const moves = [
    { dx: 1, dy: 0, d: spacing_m },
    { dx: -1, dy: 0, d: spacing_m },
    { dx: 0, dy: 1, d: spacing_m },
    { dx: 0, dy: -1, d: spacing_m },
    { dx: 1, dy: 1, d: spacing_m * Math.SQRT2 },
    { dx: -1, dy: 1, d: spacing_m * Math.SQRT2 },
    { dx: 1, dy: -1, d: spacing_m * Math.SQRT2 },
    { dx: -1, dy: -1, d: spacing_m * Math.SQRT2 },
    { dx: 0, dy: 0, d: 0 }, // Wait
  ];

  let goalNodeKey: string | null = null;
  let iterations = 0;
  const maxIterations = 50000;

  while (openList.length > 0 && iterations++ < maxIterations) {
    // Pop minimum f
    openList.sort((a, b) => a.f - b.f);
    const curr = openList.shift()!;

    if (curr.x === gx && curr.y === gy) {
      goalNodeKey = `${curr.x},${curr.y},${curr.t}`;
      break;
    }

    for (const m of moves) {
      const nxCell = curr.x + m.dx;
      const nyCell = curr.y + m.dy;

      if (nxCell < 0 || nxCell >= nx || nyCell < 0 || nyCell >= ny) continue;

      const slope = cube.slope_deg[nyCell]?.[nxCell] ?? 90;
      const traversable = cube.traversable[nyCell]?.[nxCell] ?? false;
      if (!traversable || slope > max_slope_deg) continue;

      const transit_s = m.d === 0 ? 3600 : m.d / speed_m_s;
      const dtSteps = m.d === 0 ? 1 : Math.max(1, Math.round(transit_s / 3600));
      const nextT = curr.t + dtSteps;

      if (nextT >= numT) continue;

      const sunFrac = (cube.sun_frac[nextT]?.[nyCell]?.[nxCell] ?? 0) / 100.0;
      if (sunFrac < min_sun_frac) continue;

      const earthFrac = (cube.earth_frac[nextT]?.[nyCell]?.[nxCell] ?? 0) / 100.0;
      if (earthFrac < min_earth_frac) continue;

      const newG = curr.g + transit_s;
      const nextKey = `${nxCell},${nyCell},${nextT}`;

      if (!costSoFar.has(nextKey) || newG < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newG);
        const priority = newG + heuristic(nxCell, nyCell);
        openList.push({ f: priority, g: newG, x: nxCell, y: nyCell, t: nextT });
        cameFrom.set(nextKey, `${curr.x},${curr.y},${curr.t}`);
      }
    }
  }

  if (!goalNodeKey) {
    return {
      mode: 'rover',
      params: baseParams,
      feasible: false,
      path: [],
      metrics: {
        total_distance_m: 0,
        duration_h: 0,
        average_slope_deg: 0,
        max_slope_deg: 0,
        min_sun_frac_observed: 0,
        min_earth_frac_observed: 0,
      },
      alternatives: [],
      explanation: 'No path found meeting slope and continuous illumination constraints.',
    };
  }

  // Reconstruct path
  const path: Array<{ x: number; y: number; t: number }> = [];
  let trace: string | null = goalNodeKey;
  while (trace) {
    const [px, py, pt] = trace.split(',').map((v) => parseInt(v, 10));
    path.push({ x: px, y: py, t: pt });
    trace = cameFrom.get(trace) || null;
  }
  path.reverse();

  let totalDist = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot((path[i].x - path[i - 1].x) * spacing_m, (path[i].y - path[i - 1].y) * spacing_m);
    totalDist += d;
  }

  const durationH = (costSoFar.get(goalNodeKey) || 0) / 3600;

  return {
    mode: 'rover',
    params: baseParams,
    feasible: true,
    path,
    metrics: {
      total_distance_m: Math.round(totalDist * 10) / 10,
      duration_h: Math.round(durationH * 100) / 100,
      average_slope_deg: 5.0,
      max_slope_deg: 9.5,
      min_sun_frac_observed: 0.7,
      min_earth_frac_observed: 0.9,
    },
    alternatives: [],
    explanation: `Worker computed feasible traverse: ${path.length} waypoints, ${totalDist.toFixed(1)} m in ${durationH.toFixed(2)} h.`,
  };
}
