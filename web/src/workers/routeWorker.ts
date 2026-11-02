/**
 * Web Worker for asynchronous lunar traverse, departure window mapping, and multi-stop mission planning.
 *
 * Runs space-time A* pathfinding, batch departure feasibility, and multi-stop mission analysis off the main UI thread.
 */

import {
  ConservativeComparisonResult,
  DepartureMapResult,
  FixRecommendation,
  LandingDispersionPoint,
  LandingDispersionResult,
  MissionDwell,
  MissionLeg,
  MissionPlanResult,
  MissionStop,
  PlanViolation,
  RouteResult,
  TimelineEvent,
  VisibilityCube,
} from '../types';

export interface RouteWorkerPayload {
  cube: VisibilityCube;
  start: [number, number];
  end: [number, number];
  startTimeIdx?: number;
  speed_m_s?: number;
  max_slope_deg?: number;
  min_sun_frac?: number;
  min_earth_frac?: number;
  planner_mode?: 'earliest_arrival' | 'latest_departure' | 'min_darkness';
  dark_budget_h?: number;
  allow_wait?: boolean;
  max_departure_idx?: number;
  conservative?: boolean;
  horizon_margin_deg?: number;
}

export interface MissionWorkerPayload {
  cube: VisibilityCube;
  start: [number, number];
  startTimeIdx: number;
  stops: MissionStop[];
  speed_m_s?: number;
  max_slope_deg?: number;
  dark_budget_h?: number;
  allow_wait?: boolean;
  mission_name?: string;
}

export interface DispersionWorkerPayload {
  cube: VisibilityCube;
  nominalCoord: [number, number];
  goalCoord: [number, number];
  radius_m?: number;
  num_points?: number;
  startTimeIdx?: number;
  speed_m_s?: number;
  max_slope_deg?: number;
  min_sun_frac?: number;
  min_earth_frac?: number;
  dark_budget_h?: number;
  allow_wait?: boolean;
  conservative?: boolean;
  horizon_margin_deg?: number;
}

export type RouteWorkerRequest =
  | { type: 'SOLVE_ROUTE'; payload: RouteWorkerPayload }
  | { type: 'SOLVE_DEPARTURE_MAP'; payload: RouteWorkerPayload }
  | { type: 'SOLVE_MISSION_PLAN'; payload: MissionWorkerPayload }
  | { type: 'COMPARE_CONSERVATIVE_ROUTE'; payload: RouteWorkerPayload }
  | { type: 'SOLVE_LANDING_DISPERSION'; payload: DispersionWorkerPayload };

export interface RouteWorkerResponse {
  type:
    | 'ROUTE_SUCCESS'
    | 'DEPARTURE_MAP_SUCCESS'
    | 'MISSION_PLAN_SUCCESS'
    | 'CONSERVATIVE_COMPARISON_SUCCESS'
    | 'LANDING_DISPERSION_SUCCESS'
    | 'ROUTE_ERROR';
  result?: RouteResult;
  departureMap?: DepartureMapResult;
  missionPlan?: MissionPlanResult;
  conservativeComparison?: ConservativeComparisonResult;
  landingDispersion?: LandingDispersionResult;
  error?: string;
}

interface PQNode {
  f: number;
  g: number;
  x: number;
  y: number;
  t: number;
}

class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    const item = this.data[idx];
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      const parent = this.data[parentIdx];
      if (this.compare(item, parent) >= 0) break;
      this.data[idx] = parent;
      idx = parentIdx;
    }
    this.data[idx] = item;
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    const item = this.data[idx];
    while (true) {
      const leftIdx = (idx << 1) + 1;
      const rightIdx = leftIdx + 1;
      let swapIdx = -1;

      if (leftIdx < length) {
        if (this.compare(this.data[leftIdx], item) < 0) {
          swapIdx = leftIdx;
        }
      }
      if (rightIdx < length) {
        const compareTarget = swapIdx === -1 ? item : this.data[leftIdx];
        if (this.compare(this.data[rightIdx], compareTarget) < 0) {
          swapIdx = rightIdx;
        }
      }
      if (swapIdx === -1) break;
      this.data[idx] = this.data[swapIdx];
      idx = swapIdx;
    }
    this.data[idx] = item;
  }
}

if (typeof self !== 'undefined') {
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
        self.postMessage({ type: 'ROUTE_ERROR', error: msg });
      }
    } else if (type === 'SOLVE_DEPARTURE_MAP') {
      try {
        const departureMap = solveDepartureMap(payload as RouteWorkerPayload);
        const response: RouteWorkerResponse = {
          type: 'DEPARTURE_MAP_SUCCESS',
          departureMap,
        };
        self.postMessage(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ROUTE_ERROR', error: msg });
      }
    } else if (type === 'SOLVE_MISSION_PLAN') {
      try {
        const missionPlan = solveMissionPlan(payload as MissionWorkerPayload);
        const response: RouteWorkerResponse = {
          type: 'MISSION_PLAN_SUCCESS',
          missionPlan,
        };
        self.postMessage(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ROUTE_ERROR', error: msg });
      }
    } else if (type === 'COMPARE_CONSERVATIVE_ROUTE') {
      try {
        const conservativeComparison = compareConservativeRoutes(payload as RouteWorkerPayload);
        const response: RouteWorkerResponse = {
          type: 'CONSERVATIVE_COMPARISON_SUCCESS',
          conservativeComparison,
        };
        self.postMessage(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ROUTE_ERROR', error: msg });
      }
    } else if (type === 'SOLVE_LANDING_DISPERSION') {
      try {
        const landingDispersion = solveLandingDispersion(payload as DispersionWorkerPayload);
        const response: RouteWorkerResponse = {
          type: 'LANDING_DISPERSION_SUCCESS',
          landingDispersion,
        };
        self.postMessage(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        self.postMessage({ type: 'ROUTE_ERROR', error: msg });
      }
    }
  };
}

export function solveTraverse(params: RouteWorkerPayload): RouteResult {
  const {
    cube,
    start,
    end,
    startTimeIdx = 0,
    speed_m_s = 0.05,
    max_slope_deg = 15.0,
    min_sun_frac = 0.5,
    min_earth_frac = 0.5,
    planner_mode = 'earliest_arrival',
    dark_budget_h = 0.0,
    allow_wait = true,
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
    dark_budget_h,
    planner_mode,
  };

  // Speed input validation
  if (speed_m_s <= 0) {
    return createInfeasibleResult(baseParams, 'Rover speed must be strictly positive (speed_m_s > 0).');
  }

  // Bounds validation
  if (sx < 0 || sx >= nx || sy < 0 || sy >= ny || gx < 0 || gx >= nx || gy < 0 || gy >= ny) {
    return createInfeasibleResult(baseParams, 'Start or end coordinates are outside grid boundaries.');
  }

  // If latest_departure mode requested, search backward from horizon
  if (planner_mode === 'latest_departure') {
    for (let depT = numT - 1; depT >= startTimeIdx; depT--) {
      const res = solveTraverse({
        ...params,
        startTimeIdx: depT,
        planner_mode: 'earliest_arrival',
      });
      if (res.feasible) {
        res.params.planner_mode = 'latest_departure';
        res.explanation += ` (Latest safe departure identified at step ${depT} [${cube.time_utc[depT]}]).`;
        return res;
      }
    }
    return createInfeasibleResult(baseParams, `No safe departure found between step ${startTimeIdx} and ${numT - 1}.`);
  }

  if (startTimeIdx < 0 || startTimeIdx >= numT) {
    return createInfeasibleResult(baseParams, `startTimeIdx ${startTimeIdx} is outside time horizon (0..${numT - 1}).`);
  }

  // Start cell checks
  const startTraversable = cube.traversable[sy]?.[sx] ?? false;
  const startSlope = cube.slope_deg[sy]?.[sx] ?? 90;
  if (!startTraversable || startSlope > max_slope_deg) {
    return createInfeasibleResult(baseParams, `Start location (${sx}, ${sy}) slope (${startSlope}°) exceeds max limit ${max_slope_deg}°.`);
  }

  const conservative = params.conservative ?? false;
  const horizonMarginDeg = params.horizon_margin_deg ?? 0.0;
  const effMargin = conservative ? horizonMarginDeg : 0.0;

  const startSunFrac = (cube.sun_frac[startTimeIdx]?.[sy]?.[sx] ?? 0) / 100.0;
  if ((startSunFrac - effMargin) < min_sun_frac) {
    const marginNote = effMargin > 0 ? ` (marginal under ${effMargin.toFixed(2)}° horizon margin)` : '';
    return createInfeasibleResult(baseParams, `Start location (${sx}, ${sy}) in shadow at departure (${(startSunFrac * 100).toFixed(0)}% < ${(min_sun_frac * 100).toFixed(0)}%${marginNote}).`);
  }

  // Time step duration
  let stepDtS = 3600;
  if (numT > 1) {
    const t0 = new Date(cube.time_utc[0]).getTime();
    const t1 = new Date(cube.time_utc[1]).getTime();
    const diffS = Math.abs(t1 - t0) / 1000;
    if (diffS > 0) stepDtS = diffS;
  }

  const heuristic = (x: number, y: number) => {
    return Math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m) / speed_m_s;
  };

  const openHeap = new MinHeap<PQNode>((a, b) => a.f - b.f);
  openHeap.push({ f: heuristic(sx, sy), g: 0, x: sx, y: sy, t: startTimeIdx });
  const costSoFar = new Map<string, number>();
  const darkSoFar = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();

  const startKey = `${sx},${sy},${startTimeIdx}`;
  costSoFar.set(startKey, 0);
  darkSoFar.set(startKey, 0);
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
  ];
  if (allow_wait) {
    moves.push({ dx: 0, dy: 0, d: 0 }); // Wait in place
  }

  let goalNodeKey: string | null = null;
  let iterations = 0;
  const maxIterations = 50000;

  while (openHeap.size > 0 && iterations++ < maxIterations) {
    const curr = openHeap.pop()!;

    if (curr.x === gx && curr.y === gy) {
      goalNodeKey = `${curr.x},${curr.y},${curr.t}`;
      break;
    }

    const currKey = `${curr.x},${curr.y},${curr.t}`;
    const currDark = darkSoFar.get(currKey) ?? 0;

    for (const m of moves) {
      const nxCell = curr.x + m.dx;
      const nyCell = curr.y + m.dy;

      if (nxCell < 0 || nxCell >= nx || nyCell < 0 || nyCell >= ny) continue;

      const slope = cube.slope_deg[nyCell]?.[nxCell] ?? 90;
      const traversable = cube.traversable[nyCell]?.[nxCell] ?? false;
      if (!traversable || slope > max_slope_deg) continue;

      // Prevent cutting through diagonally blocked obstacle corners
      if (m.dx !== 0 && m.dy !== 0) {
        const c1Traversable = cube.traversable[curr.y]?.[nxCell] ?? false;
        const c1Slope = cube.slope_deg[curr.y]?.[nxCell] ?? 90;
        const c2Traversable = cube.traversable[nyCell]?.[curr.x] ?? false;
        const c2Slope = cube.slope_deg[nyCell]?.[curr.x] ?? 90;
        if (!c1Traversable || c1Slope > max_slope_deg || !c2Traversable || c2Slope > max_slope_deg) {
          continue;
        }
      }

      const transit_s = m.d === 0 ? stepDtS : m.d / speed_m_s;
      const dtSteps = m.d === 0 ? 1 : Math.max(1, Math.round(transit_s / stepDtS));
      const nextT = curr.t + dtSteps;

      if (nextT >= numT) continue;

      const sunFrac = (cube.sun_frac[nextT]?.[nyCell]?.[nxCell] ?? 0) / 100.0;
      const isDark = (sunFrac - effMargin) < min_sun_frac;

      if (isDark) {
        if (dark_budget_h <= 0) continue;
        if (currDark + transit_s > dark_budget_h * 3600 + 1e-6) continue;
      }

      const earthFrac = (cube.earth_frac[nextT]?.[nyCell]?.[nxCell] ?? 0) / 100.0;
      if (earthFrac < min_earth_frac) continue;

      const newG = curr.g + transit_s;
      const nextKey = `${nxCell},${nyCell},${nextT}`;
      const newDark = isDark ? currDark + transit_s : currDark;

      if (!costSoFar.has(nextKey) || newG < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, newG);
        darkSoFar.set(nextKey, newDark);
        const priority = newG + heuristic(nxCell, nyCell);
        openHeap.push({ f: priority, g: newG, x: nxCell, y: nyCell, t: nextT });
        cameFrom.set(nextKey, currKey);
      }
    }
  }

  if (!goalNodeKey) {
    return createInfeasibleResult(
      baseParams,
      `No feasible path found from (${sx}, ${sy}) to (${gx}, ${gy}) starting at ${cube.time_utc[startTimeIdx]}. Moving shadow or slope constraints block the corridor.`
    );
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
  let totalDarkS = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot((path[i].x - path[i - 1].x) * spacing_m, (path[i].y - path[i - 1].y) * spacing_m);
    const stepS = d === 0 ? stepDtS : d / speed_m_s;
    totalDist += d;
    const sf = (cube.sun_frac[path[i].t]?.[path[i].y]?.[path[i].x] ?? 0) / 100;
    if (sf < min_sun_frac) {
      totalDarkS += stepS;
    }
  }

  const durationH = (costSoFar.get(goalNodeKey) || 0) / 3600;
  const darkDurationH = Math.round((totalDarkS / 3600) * 1000) / 1000;

  const slopes: number[] = [];
  const sunObs: number[] = [];
  const earthObs: number[] = [];

  for (const wp of path) {
    slopes.push(cube.slope_deg[wp.y]?.[wp.x] ?? 0);
    sunObs.push((cube.sun_frac[wp.t]?.[wp.y]?.[wp.x] ?? 0) / 100);
    earthObs.push((cube.earth_frac[wp.t]?.[wp.y]?.[wp.x] ?? 0) / 100);
  }

  const avgSlope = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;
  const maxSlope = slopes.length ? Math.max(...slopes) : 0;
  const minSun = sunObs.length ? Math.min(...sunObs) : 1.0;
  const minEarth = earthObs.length ? Math.min(...earthObs) : 1.0;

  return {
    mode: 'rover',
    params: baseParams,
    feasible: true,
    path,
    metrics: {
      total_distance_m: Math.round(totalDist * 10) / 10,
      duration_h: Math.round(durationH * 100) / 100,
      dark_duration_h: darkDurationH,
      average_slope_deg: Math.round(avgSlope * 10) / 10,
      max_slope_deg: Math.round(maxSlope * 10) / 10,
      min_sun_frac_observed: Math.round(minSun * 100) / 100,
      min_earth_frac_observed: Math.round(minEarth * 100) / 100,
    },
    alternatives: [],
    explanation: `Worker computed feasible traverse: ${path.length} waypoints, ${totalDist.toFixed(1)} m in ${durationH.toFixed(2)} h (darkness: ${darkDurationH} h).`,
  };
}

export function solveDepartureMap(params: RouteWorkerPayload): DepartureMapResult {
  const tStart = performance.now();
  const { cube, start, end, max_departure_idx } = params;
  const numT = cube.time_utc.length;
  const limitT = max_departure_idx !== undefined ? Math.min(numT, max_departure_idx + 1) : numT;

  const departures = [];

  for (let depT = 0; depT < limitT; depT++) {
    const res = solveTraverse({
      ...params,
      startTimeIdx: depT,
      planner_mode: 'earliest_arrival',
    });

    if (res.feasible) {
      const arrivalIdx = res.path[res.path.length - 1].t;
      departures.push({
        departure_idx: depT,
        departure_utc: cube.time_utc[depT],
        feasible: true,
        arrival_idx: arrivalIdx,
        arrival_utc: cube.time_utc[arrivalIdx],
        duration_h: Number(res.metrics.duration_h),
        dark_duration_h: Number(res.metrics.dark_duration_h ?? 0),
        infeasible_reason: null,
        path: res.path,
      });
    } else {
      departures.push({
        departure_idx: depT,
        departure_utc: cube.time_utc[depT],
        feasible: false,
        arrival_idx: null,
        arrival_utc: null,
        duration_h: 0,
        dark_duration_h: 0,
        infeasible_reason: res.explanation,
        path: [],
      });
    }
  }

  const tEnd = performance.now();
  const computeTimeS = Math.round((tEnd - tStart) / 10) / 100; // in seconds

  const feasibleDeps = departures.filter((d) => d.feasible);

  let earliestIdx: number | null = null;
  let latestIdx: number | null = null;
  let lowestDarkIdx: number | null = null;
  let summarySentence = '';

  if (feasibleDeps.length === 0) {
    summarySentence = `No feasible departures found between ${cube.time_utc[0]} and ${cube.time_utc[limitT - 1]}. Moving shadows or steep slopes block the corridor across the entire window.`;
  } else {
    earliestIdx = feasibleDeps[0].departure_idx;
    latestIdx = feasibleDeps[feasibleDeps.length - 1].departure_idx;

    let bestDark = feasibleDeps[0];
    for (const d of feasibleDeps) {
      if ((d.dark_duration_h ?? 0) < (bestDark.dark_duration_h ?? 0)) {
        bestDark = d;
      }
    }
    lowestDarkIdx = bestDark.departure_idx;

    if (latestIdx < limitT - 1) {
      const nextFail = departures[latestIdx + 1];
      const cause = nextFail.infeasible_reason?.includes('shadow')
        ? 'the moving shadow on the terrain corridor'
        : 'terrain slopes and visibility boundaries';
      summarySentence = `Leaving between ${cube.time_utc[earliestIdx]} (step ${earliestIdx}) and ${cube.time_utc[latestIdx]} (step ${latestIdx}) works; leaving after ${cube.time_utc[latestIdx]} does not because of ${cause}. Lowest dark exposure is ${(bestDark.dark_duration_h ?? 0).toFixed(2)} h at step ${lowestDarkIdx}.`;
    } else {
      summarySentence = `Continuous feasible departures available from ${cube.time_utc[earliestIdx]} (step ${earliestIdx}) to ${cube.time_utc[latestIdx]} (step ${latestIdx}). Lowest dark exposure is ${(bestDark.dark_duration_h ?? 0).toFixed(2)} h at step ${lowestDarkIdx}.`;
    }
  }

  return {
    start_coord: start,
    end_coord: end,
    total_departures_evaluated: departures.length,
    compute_time_s: computeTimeS,
    earliest_feasible_idx: earliestIdx,
    latest_safe_idx: latestIdx,
    lowest_dark_idx: lowestDarkIdx,
    earliest_feasible_utc: earliestIdx !== null ? cube.time_utc[earliestIdx] : null,
    latest_safe_utc: latestIdx !== null ? cube.time_utc[latestIdx] : null,
    lowest_dark_utc: lowestDarkIdx !== null ? cube.time_utc[lowestDarkIdx] : null,
    plain_language_summary: summarySentence,
    departures,
  };
}

function createInfeasibleResult(params: RouteResult['params'], explanation: string): RouteResult {
  return {
    mode: 'rover',
    params,
    feasible: false,
    path: [],
    metrics: {
      total_distance_m: 0,
      duration_h: 0,
      dark_duration_h: 0,
      average_slope_deg: 0,
      max_slope_deg: 0,
      min_sun_frac_observed: 0,
      min_earth_frac_observed: 0,
    },
    alternatives: [],
    explanation,
  };
}


export function solveMissionPlan(params: MissionWorkerPayload): MissionPlanResult {
  const {
    cube,
    start,
    startTimeIdx,
    stops,
    speed_m_s = 0.05,
    max_slope_deg = 15.0,
    dark_budget_h = 0.0,
    allow_wait = true,
    mission_name = 'Lunar Surface Sortie',
  } = params;

  if (stops.length < 1) {
    throw new Error('Mission plan must contain at least 1 stop.');
  }
  if (stops.length > 5) {
    throw new Error(`Maximum 5 stops allowed per mission plan, got ${stops.length}.`);
  }

  const LIMITS_DISCLAIMER = 'Geometric Sun and Earth visibility only; no power or link budget.';
  const numT = cube.time_utc.length;

  let stepDtS = 3600;
  if (numT > 1) {
    const t0 = new Date(cube.time_utc[0]).getTime();
    const t1 = new Date(cube.time_utc[1]).getTime();
    const diffS = Math.abs(t1 - t0) / 1000;
    if (diffS > 0) stepDtS = diffS;
  }

  let curCoord = start;
  let curT = startTimeIdx;
  let prevName = 'Base Lander';

  let totalDistM = 0;
  let totalTransitH = 0;
  let totalDwellH = 0;
  let totalDarkH = 0;

  const legs: MissionLeg[] = [];
  const dwells: MissionDwell[] = [];
  const timeline: TimelineEvent[] = [];
  const violations: PlanViolation[] = [];

  let allFeasible = true;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const stopId = stop.stop_id || `stop_${i + 1}`;
    const stopName = stop.name || `Stop ${i + 1}`;
    const dwellH = Number(stop.dwell_time_h ?? 0);
    const minSunReq = stop.min_sun_frac;
    const minEarthReq = stop.min_earth_frac;
    const minEarthDurH = Number(stop.min_earth_duration_h ?? 0);

    let deadlineIdx = stop.deadline_idx;
    if (deadlineIdx === undefined && stop.deadline_utc) {
      const idx = cube.time_utc.indexOf(stop.deadline_utc);
      if (idx !== -1) deadlineIdx = idx;
    }

    if (curT >= numT) {
      allFeasible = false;
      const vMsg = `Cannot start leg to '${stopName}': departure step ${curT} is beyond simulation horizon (${numT - 1}).`;
      violations.push({
        stop_index: i,
        stop_name: stopName,
        type: 'deadline_missed',
        details: vMsg,
      });
      legs.push({
        leg_index: i + 1,
        from_name: prevName,
        to_name: stopName,
        start_coord: curCoord,
        end_coord: stop.coord,
        start_time_idx: curT,
        end_time_idx: curT,
        start_time_utc: cube.time_utc[numT - 1],
        end_time_utc: cube.time_utc[numT - 1],
        feasible: false,
        duration_h: 0,
        distance_m: 0,
        path: [],
        infeasible_reason: vMsg,
      });
      break;
    }

    // 1. Solve transit leg
    const legRes = solveTraverse({
      cube,
      start: curCoord,
      end: stop.coord,
      startTimeIdx: curT,
      speed_m_s,
      max_slope_deg,
      dark_budget_h,
      allow_wait,
    });

    if (!legRes.feasible) {
      allFeasible = false;
      const vMsg = `Traverse from '${prevName}' to '${stopName}' starting at ${cube.time_utc[curT]} is infeasible: ${legRes.explanation}`;
      violations.push({
        stop_index: i,
        stop_name: stopName,
        type: 'transit_infeasible',
        details: vMsg,
      });
      legs.push({
        leg_index: i + 1,
        from_name: prevName,
        to_name: stopName,
        start_coord: curCoord,
        end_coord: stop.coord,
        start_time_idx: curT,
        end_time_idx: curT,
        start_time_utc: cube.time_utc[curT],
        end_time_utc: cube.time_utc[curT],
        feasible: false,
        duration_h: 0,
        distance_m: 0,
        path: [],
        infeasible_reason: legRes.explanation,
      });
      break;
    }

    const legPath = legRes.path;
    const arrivalT = legPath[legPath.length - 1].t;
    const legDurH = Number(legRes.metrics.duration_h);
    const legDistM = Number(legRes.metrics.total_distance_m);
    const legDarkH = Number(legRes.metrics.dark_duration_h ?? 0);

    totalDistM += legDistM;
    totalTransitH += legDurH;
    totalDarkH += legDarkH;

    legs.push({
      leg_index: i + 1,
      from_name: prevName,
      to_name: stopName,
      start_coord: curCoord,
      end_coord: stop.coord,
      start_time_idx: curT,
      end_time_idx: arrivalT,
      start_time_utc: cube.time_utc[curT],
      end_time_utc: cube.time_utc[arrivalT],
      feasible: true,
      duration_h: legDurH,
      distance_m: legDistM,
      dark_duration_h: legDarkH,
      path: legPath,
      infeasible_reason: null,
    });

    const legSunVals = legPath.map((p) => (cube.sun_frac[p.t]?.[p.y]?.[p.x] ?? 0));
    const legEarthVals = legPath.map((p) => (cube.earth_frac[p.t]?.[p.y]?.[p.x] ?? 0));

    timeline.push({
      event_id: fLegId(i + 1),
      type: 'transit',
      label: `Transit: ${prevName} -> ${stopName}`,
      start_time_idx: curT,
      end_time_idx: arrivalT,
      start_time_utc: cube.time_utc[curT],
      end_time_utc: cube.time_utc[arrivalT],
      duration_h: legDurH,
      sun_frac_min: legSunVals.length ? Math.min(...legSunVals) : 0,
      sun_frac_avg: legSunVals.length ? Math.round((legSunVals.reduce((a, b) => a + b, 0) / legSunVals.length) * 10) / 10 : 0,
      earth_frac_min: legEarthVals.length ? Math.min(...legEarthVals) : 0,
      earth_frac_avg: legEarthVals.length ? Math.round((legEarthVals.reduce((a, b) => a + b, 0) / legEarthVals.length) * 10) / 10 : 0,
      violations: [],
    });

    // 2. Dwell Phase
    const dwellSteps = dwellH > 0 ? Math.max(1, Math.round((dwellH * 3600) / stepDtS)) : 0;
    const departureT = arrivalT + dwellSteps;
    totalDwellH += dwellH;

    const dwellViolations: string[] = [];
    let sunSatisfied = true;
    let earthSatisfied = true;
    let deadlineSatisfied = true;

    if (departureT >= numT) {
      allFeasible = false;
      deadlineSatisfied = false;
      const vMsg = `Dwell at '${stopName}' extends to step ${departureT}, beyond simulation horizon (${numT - 1}).`;
      dwellViolations.push(vMsg);
      violations.push({
        stop_index: i,
        stop_name: stopName,
        type: 'deadline_missed',
        details: vMsg,
      });
    }

    const inspectEndT = Math.min(numT - 1, departureT);
    const dwellSunVals: number[] = [];
    const dwellEarthVals: number[] = [];
    for (let t = arrivalT; t <= inspectEndT; t++) {
      dwellSunVals.push(cube.sun_frac[t]?.[stop.coord[1]]?.[stop.coord[0]] ?? 0);
      dwellEarthVals.push(cube.earth_frac[t]?.[stop.coord[1]]?.[stop.coord[0]] ?? 0);
    }

    const minSunObs = dwellSunVals.length ? Math.min(...dwellSunVals) / 100 : 1.0;

    // Sun threshold during dwell
    if (minSunReq !== undefined && minSunReq !== null) {
      if (minSunObs < (minSunReq - 1e-4)) {
        sunSatisfied = false;
        allFeasible = false;
        const vMsg = `Sunlight at '${stopName}' drops to ${Math.round(minSunObs * 100)}% during dwell, violating required minimum of ${Math.round(minSunReq * 100)}%.`;
        dwellViolations.push(vMsg);
        violations.push({
          stop_index: i,
          stop_name: stopName,
          type: 'insufficient_sun',
          details: vMsg,
        });
      }
    }

    // Earth upload threshold during dwell
    const earthThresh = minEarthReq ?? 0.5;
    const qualifyingSteps = dwellEarthVals.filter((v) => v / 100 >= earthThresh).length;
    const earthContactH = (qualifyingSteps * stepDtS) / 3600;

    if (minEarthDurH > 0) {
      if (earthContactH < (minEarthDurH - 1e-4)) {
        earthSatisfied = false;
        allFeasible = false;
        const vMsg = `Earth link above ${Math.round(earthThresh * 100)}% at '${stopName}' is available for only ${earthContactH.toFixed(1)}h during dwell, violating required ${minEarthDurH.toFixed(1)}h upload window.`;
        dwellViolations.push(vMsg);
        violations.push({
          stop_index: i,
          stop_name: stopName,
          type: 'insufficient_earth_link',
          details: vMsg,
        });
      }
    }

    // Deadline check
    if (deadlineIdx !== undefined && deadlineIdx !== null) {
      if (departureT > deadlineIdx) {
        deadlineSatisfied = false;
        allFeasible = false;
        const depUtc = cube.time_utc[Math.min(numT - 1, departureT)];
        const deadUtc = cube.time_utc[Math.min(numT - 1, deadlineIdx)];
        const vMsg = `Departure from '${stopName}' at step ${departureT} (${depUtc}) misses declared deadline step ${deadlineIdx} (${deadUtc}).`;
        dwellViolations.push(vMsg);
        violations.push({
          stop_index: i,
          stop_name: stopName,
          type: 'deadline_missed',
          details: vMsg,
        });
      }
    }

    dwells.push({
      stop_id: stopId,
      name: stopName,
      coord: stop.coord,
      start_time_idx: arrivalT,
      end_time_idx: departureT,
      start_time_utc: cube.time_utc[Math.min(numT - 1, arrivalT)],
      end_time_utc: cube.time_utc[Math.min(numT - 1, departureT)],
      duration_h: Math.round(dwellH * 100) / 100,
      min_sun_frac_observed: Math.round(minSunObs * 100) / 100,
      earth_contact_duration_h: Math.round(earthContactH * 100) / 100,
      sun_satisfied: sunSatisfied,
      earth_satisfied: earthSatisfied,
      deadline_satisfied: deadlineSatisfied,
      violations: dwellViolations,
    });

    timeline.push({
      event_id: fDwellId(i + 1),
      type: 'dwell',
      label: `Dwell: ${stopName} (${dwellH.toFixed(1)}h)`,
      start_time_idx: arrivalT,
      end_time_idx: departureT,
      start_time_utc: cube.time_utc[Math.min(numT - 1, arrivalT)],
      end_time_utc: cube.time_utc[Math.min(numT - 1, departureT)],
      duration_h: Math.round(dwellH * 100) / 100,
      sun_frac_min: dwellSunVals.length ? Math.min(...dwellSunVals) : 100,
      sun_frac_avg: dwellSunVals.length ? Math.round((dwellSunVals.reduce((a, b) => a + b, 0) / dwellSunVals.length) * 10) / 10 : 100,
      earth_frac_min: dwellEarthVals.length ? Math.min(...dwellEarthVals) : 100,
      earth_frac_avg: dwellEarthVals.length ? Math.round((dwellEarthVals.reduce((a, b) => a + b, 0) / dwellEarthVals.length) * 10) / 10 : 100,
      violations: dwellViolations,
    });

    curCoord = stop.coord;
    curT = departureT;
    prevName = stopName;
  }

  let fixRec: FixRecommendation | null = null;
  if (!allFeasible) {
    fixRec = findSmallestFix(params);
  }

  const totalDurationH = Math.round((totalTransitH + totalDwellH) * 100) / 100;

  return {
    mission_name,
    start_coord: start,
    start_time_idx: startTimeIdx,
    start_time_utc: cube.time_utc[Math.min(numT - 1, startTimeIdx)],
    feasible: allFeasible,
    stops,
    legs,
    dwells,
    timeline,
    metrics: {
      total_distance_m: Math.round(totalDistM * 10) / 10,
      transit_duration_h: Math.round(totalTransitH * 100) / 100,
      dwell_duration_h: Math.round(totalDwellH * 100) / 100,
      total_duration_h: totalDurationH,
      total_dark_duration_h: Math.round(totalDarkH * 100) / 100,
      num_stops: stops.length,
    },
    violations,
    fix_recommendation: fixRec,
    limits_disclaimer: LIMITS_DISCLAIMER,
  };
}

function fLegId(idx: number): string {
  return `leg_${idx}`;
}

function fDwellId(idx: number): string {
  return `dwell_${idx}`;
}

export function findSmallestFix(params: MissionWorkerPayload): FixRecommendation | null {
  const { cube, start, startTimeIdx, stops, speed_m_s = 0.05, max_slope_deg = 15.0, dark_budget_h = 0.0, allow_wait = true } = params;
  const numT = cube.time_utc.length;

  let stepDtS = 3600;
  if (numT > 1) {
    const t0 = new Date(cube.time_utc[0]).getTime();
    const t1 = new Date(cube.time_utc[1]).getTime();
    const diff = Math.abs(t1 - t0) / 1000;
    if (diff > 0) stepDtS = diff;
  }

  const checkFeasible = (candStartT: number, candStops: MissionStop[]): boolean => {
    let c = start;
    let t = candStartT;

    for (const s of candStops) {
      if (t >= numT) return false;
      const leg = solveTraverse({
        cube,
        start: c,
        end: s.coord,
        startTimeIdx: t,
        speed_m_s,
        max_slope_deg,
        dark_budget_h,
        allow_wait,
      });
      if (!leg.feasible) return false;

      const arrT = leg.path[leg.path.length - 1].t;
      const dwellSteps = s.dwell_time_h > 0 ? Math.max(1, Math.round((s.dwell_time_h * 3600) / stepDtS)) : 0;
      const depT = arrT + dwellSteps;
      if (depT >= numT) return false;

      if (s.deadline_idx !== undefined && depT > s.deadline_idx) return false;

      if (s.min_sun_frac !== undefined && s.min_sun_frac !== null) {
        for (let step = arrT; step <= depT; step++) {
          if ((cube.sun_frac[step]?.[s.coord[1]]?.[s.coord[0]] ?? 0) / 100 < s.min_sun_frac - 1e-4) {
            return false;
          }
        }
      }

      if ((s.min_earth_duration_h ?? 0) > 0) {
        const thresh = s.min_earth_frac ?? 0.5;
        let count = 0;
        for (let step = arrT; step <= depT; step++) {
          if ((cube.earth_frac[step]?.[s.coord[1]]?.[s.coord[0]] ?? 0) / 100 >= thresh) {
            count++;
          }
        }
        if ((count * stepDtS) / 3600 < (s.min_earth_duration_h! - 1e-4)) return false;
      }

      c = s.coord;
      t = depT;
    }
    return true;
  };

  // Strategy 1: Reorder stops
  if (stops.length >= 2) {
    for (let j = 0; j < stops.length - 1; j++) {
      const reordered = [...stops];
      const tmp = reordered[j];
      reordered[j] = reordered[j + 1];
      reordered[j + 1] = tmp;

      if (checkFeasible(startTimeIdx, reordered)) {
        return {
          type: 'reorder_stops',
          description: `Reorder stops: swap '${stops[j].name}' and '${stops[j + 1].name}' (visit '${reordered[j].name}' first) to align with terrain and illumination windows.`,
          suggested_patch: {
            new_stop_order: reordered.map((s) => s.stop_id),
          },
        };
      }
    }
  }

  // Strategy 2: Earlier Departure
  for (let earlierT = startTimeIdx - 1; earlierT >= 0; earlierT--) {
    if (checkFeasible(earlierT, stops)) {
      const deltaH = Math.round(((startTimeIdx - earlierT) * stepDtS) / 36) / 100;
      return {
        type: 'earlier_start',
        delta_h: deltaH,
        description: `Start ${deltaH.toFixed(1)}h earlier at ${cube.time_utc[earlierT]} (step ${earlierT}) to arrive before shadow closure or deadline expiration.`,
        suggested_patch: { startTimeIdx: earlierT },
      };
    }
  }

  // Strategy 3: Shorter Dwell
  for (let j = 0; j < stops.length; j++) {
    const origDwell = Number(stops[j].dwell_time_h ?? 0);
    if (origDwell > 0.5) {
      for (const redH of [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]) {
        if (origDwell - redH < 0.25) break;
        const candStops = stops.map((st, idx) =>
          idx === j ? { ...st, dwell_time_h: Math.round((origDwell - redH) * 100) / 100 } : st
        );
        if (checkFeasible(startTimeIdx, candStops)) {
          return {
            type: 'shorter_dwell',
            stop_index: j,
            stop_name: stops[j].name,
            delta_h: redH,
            new_dwell_h: Math.round((origDwell - redH) * 100) / 100,
            description: `Reduce dwell at '${stops[j].name}' from ${origDwell.toFixed(1)}h to ${(origDwell - redH).toFixed(1)}h (reduction: ${redH.toFixed(1)}h) to satisfy subsequent leg deadlines.`,
            suggested_patch: {
              stop_index: j,
              new_dwell_time_h: Math.round((origDwell - redH) * 100) / 100,
            },
          };
        }
      }
    }
  }

  return null;
}

export function generateMissionPlanCsv(plan: MissionPlanResult): string {
  const lines = [
    '# LightPath Lunar Mission Plan Export',
    `# Mission: ${plan.mission_name || 'Lunar Sortie'}`,
    `# Feasible: ${plan.feasible}`,
    `# Total Duration: ${plan.metrics.total_duration_h} h | Total Distance: ${plan.metrics.total_distance_m} m`,
    `# Limits: ${plan.limits_disclaimer || 'Geometric Sun and Earth visibility only; no power or link budget.'}`,
    'Event_ID,Type,Label,Start_Step,End_Step,Start_UTC,End_UTC,Duration_h,Min_Sun_Pct,Avg_Sun_Pct,Min_Earth_Pct,Avg_Earth_Pct,Violations',
  ];

  for (const ev of plan.timeline) {
    const vStr = ev.violations.length > 0 ? ev.violations.join('; ') : 'None';
    const vEsc = vStr.includes(',') || vStr.includes(';') ? `"${vStr}"` : vStr;
    lines.push(
      `${ev.event_id},${ev.type},${ev.label},${ev.start_time_idx},${ev.end_time_idx},${ev.start_time_utc},${ev.end_time_utc},${ev.duration_h},${ev.sun_frac_min ?? 0},${ev.sun_frac_avg ?? 0},${ev.earth_frac_min ?? 0},${ev.earth_frac_avg ?? 0},${vEsc}`
    );
  }

  return lines.join('\n') + '\n';
}

export function generateMissionPlanIcs(plan: MissionPlanResult): string {
  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LightPath//NASA Space Apps Lunar Mission Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:LightPath - ${plan.mission_name || 'Lunar Sortie'}`,
    'X-LIMITS:Geometric Sun and Earth visibility only; no power or link budget.',
  ];

  const toIcsDate = (iso: string): string => {
    return iso.replace(/[-:]/g, '').split('.')[0] + (iso.endsWith('Z') ? '' : 'Z');
  };

  for (const ev of plan.timeline) {
    const dtstart = toIcsDate(ev.start_time_utc);
    let dtend = toIcsDate(ev.end_time_utc);
    if (dtstart === dtend) {
      const d = new Date(ev.end_time_utc);
      d.setMinutes(d.getMinutes() + 1);
      dtend = toIcsDate(d.toISOString());
    }

    const uid = `${ev.event_id}-${dtstart}@lightpath.lunar`;
    const summary = `[LightPath] ${ev.label}`;
    const desc =
      `Event: ${ev.label}\\n` +
      `Duration: ${ev.duration_h} h\\n` +
      `Sun Illumination: min ${ev.sun_frac_min ?? 0}%, avg ${ev.sun_frac_avg ?? 0}%\\n` +
      `Earth Contact: min ${ev.earth_frac_min ?? 0}%, avg ${ev.earth_frac_avg ?? 0}%\\n` +
      `NOTE: Geometric Sun and Earth visibility only; no power or link budget.` +
      (ev.violations.length > 0 ? `\\nVIOLATIONS: ${ev.violations.join('; ')}` : '');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `STATUS:${ev.violations.length === 0 ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function compareConservativeRoutes(payload: RouteWorkerPayload): ConservativeComparisonResult {
  const marginDeg = payload.horizon_margin_deg ?? 0.10;
  const nominal = solveTraverse({ ...payload, conservative: false, horizon_margin_deg: 0.0 });
  const conservative = solveTraverse({ ...payload, conservative: true, horizon_margin_deg: marginDeg });

  let extraDist = 0;
  let extraDur = 0;
  let extraWait = 0;
  let explanation = '';

  if (nominal.feasible && conservative.feasible) {
    extraDist = Math.round((conservative.metrics.total_distance_m - nominal.metrics.total_distance_m) * 10) / 10;
    extraDur = Math.round((conservative.metrics.duration_h - nominal.metrics.duration_h) * 100) / 100;
    extraWait = Math.round(((conservative.metrics.wait_duration_h ?? 0) - (nominal.metrics.wait_duration_h ?? 0)) * 100) / 100;
    explanation = `Caution requires +${extraDist.toFixed(1)} m extra distance and +${extraDur.toFixed(2)} h extra duration (+${extraWait.toFixed(2)} h waiting in sunlight) under ${marginDeg.toFixed(2)}° horizon elevation margin.`;
  } else if (nominal.feasible && !conservative.feasible) {
    explanation = `Conservative route is blocked under ${marginDeg.toFixed(2)}° horizon elevation margin (marginal cells count as dark). Nominal route is viable (${nominal.metrics.duration_h.toFixed(2)} h) but lacks margin against DEM error.`;
  } else if (!nominal.feasible && !conservative.feasible) {
    explanation = 'Both nominal and conservative routes are infeasible at this departure.';
  } else {
    explanation = 'Nominal route infeasible.';
  }

  return {
    nominal,
    conservative,
    cost_of_caution: {
      extra_distance_m: extraDist,
      extra_duration_h: extraDur,
      extra_wait_h: extraWait,
      horizon_margin_deg: marginDeg,
      explanation,
    },
  };
}

export function generateDispersionPattern(
  nominalCoord: [number, number],
  radiusM: number,
  spacingM: number,
  numPoints: number = 25
): Array<{ point_id: number; offset_m: [number, number]; dist_from_center_m: number; coord: [number, number] }> {
  const points: Array<{ point_id: number; offset_m: [number, number]; dist_from_center_m: number; coord: [number, number] }> = [];

  if (numPoints === 25) {
    // Center point
    points.push({
      point_id: 0,
      offset_m: [0, 0],
      dist_from_center_m: 0,
      coord: [Math.round(nominalCoord[0]), Math.round(nominalCoord[1])],
    });

    // Ring 1: 8 points at r1 = radiusM * sqrt(1/3)
    const r1 = radiusM * Math.sqrt(1 / 3);
    for (let k = 0; k < 8; k++) {
      const theta = (k + 0.5) * ((2 * Math.PI) / 8);
      const dx = r1 * Math.cos(theta);
      const dy = r1 * Math.sin(theta);
      const cx = Math.round(nominalCoord[0] + dx / spacingM);
      const cy = Math.round(nominalCoord[1] + dy / spacingM);
      points.push({
        point_id: points.length,
        offset_m: [Math.round(dx * 100) / 100, Math.round(dy * 100) / 100],
        dist_from_center_m: Math.round(r1 * 100) / 100,
        coord: [cx, cy],
      });
    }

    // Ring 2: 16 points at r2 = radiusM
    const r2 = radiusM;
    for (let k = 0; k < 16; k++) {
      const theta = (k + 0.5) * ((2 * Math.PI) / 16);
      const dx = r2 * Math.cos(theta);
      const dy = r2 * Math.sin(theta);
      const cx = Math.round(nominalCoord[0] + dx / spacingM);
      const cy = Math.round(nominalCoord[1] + dy / spacingM);
      points.push({
        point_id: points.length,
        offset_m: [Math.round(dx * 100) / 100, Math.round(dy * 100) / 100],
        dist_from_center_m: Math.round(r2 * 100) / 100,
        coord: [cx, cy],
      });
    }
  } else {
    points.push({
      point_id: 0,
      offset_m: [0, 0],
      dist_from_center_m: 0,
      coord: [Math.round(nominalCoord[0]), Math.round(nominalCoord[1])],
    });
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 1; i < numPoints; i++) {
      const r = radiusM * Math.sqrt(i / (numPoints - 1));
      const theta = i * goldenAngle;
      const dx = r * Math.cos(theta);
      const dy = r * Math.sin(theta);
      const cx = Math.round(nominalCoord[0] + dx / spacingM);
      const cy = Math.round(nominalCoord[1] + dy / spacingM);
      points.push({
        point_id: points.length,
        offset_m: [Math.round(dx * 100) / 100, Math.round(dy * 100) / 100],
        dist_from_center_m: Math.round(r * 100) / 100,
        coord: [cx, cy],
      });
    }
  }

  return points;
}

export function solveLandingDispersion(payload: DispersionWorkerPayload): LandingDispersionResult {
  const t0 = performance.now();
  const radiusM = payload.radius_m ?? 250;
  const numPoints = payload.num_points ?? 25;
  const spacingM = payload.cube.grid.spacing_m;
  const nx = payload.cube.grid.nx;
  const ny = payload.cube.grid.ny;

  const pattern = generateDispersionPattern(payload.nominalCoord, radiusM, spacingM, numPoints);

  const evaluated: LandingDispersionPoint[] = [];
  let shadowFailures = 0;
  let slopeFailures = 0;
  let corridorFailures = 0;

  for (const pt of pattern) {
    const clampedX = Math.max(0, Math.min(nx - 1, pt.coord[0]));
    const clampedY = Math.max(0, Math.min(ny - 1, pt.coord[1]));

    const route = solveTraverse({
      cube: payload.cube,
      start: [clampedX, clampedY],
      end: payload.goalCoord,
      startTimeIdx: payload.startTimeIdx ?? 0,
      speed_m_s: payload.speed_m_s ?? 0.05,
      max_slope_deg: payload.max_slope_deg ?? 15,
      min_sun_frac: payload.min_sun_frac ?? 0.5,
      min_earth_frac: payload.min_earth_frac ?? 0.5,
      dark_budget_h: payload.dark_budget_h ?? 0,
      allow_wait: payload.allow_wait ?? true,
      conservative: payload.conservative ?? false,
      horizon_margin_deg: payload.horizon_margin_deg ?? 0,
    });

    if (route.feasible) {
      evaluated.push({
        point_id: pt.point_id,
        offset_m: pt.offset_m,
        dist_from_center_m: pt.dist_from_center_m,
        coord: [clampedX, clampedY],
        feasible: true,
        explanation: route.explanation,
        arrival_h: Math.round(route.metrics.duration_h * 100) / 100,
        duration_h: Math.round(route.metrics.duration_h * 100) / 100,
        dark_exposure_h: Math.round((route.metrics.dark_exposure_h ?? 0) * 100) / 100,
        total_distance_m: Math.round(route.metrics.total_distance_m * 10) / 10,
      });
    } else {
      const expl = route.explanation;
      if (expl.includes('solar fraction') || expl.includes('shadow')) {
        shadowFailures++;
      } else if (expl.includes('slope')) {
        slopeFailures++;
      } else {
        corridorFailures++;
      }

      evaluated.push({
        point_id: pt.point_id,
        offset_m: pt.offset_m,
        dist_from_center_m: pt.dist_from_center_m,
        coord: [clampedX, clampedY],
        feasible: false,
        explanation: expl,
        arrival_h: null,
        duration_h: null,
        dark_exposure_h: null,
        total_distance_m: null,
      });
    }
  }

  const solveTimeMs = Math.round((performance.now() - t0) * 100) / 100;
  const successCount = evaluated.filter((p) => p.feasible).length;
  const failureCount = numPoints - successCount;
  const successRate = Math.round((successCount / numPoints) * 10000) / 10000;

  const feasiblePts = evaluated.filter((p) => p.feasible && p.arrival_h !== null);
  const minArrivalH = feasiblePts.length > 0 ? Math.min(...feasiblePts.map((p) => p.arrival_h!)) : null;
  const maxArrivalH = feasiblePts.length > 0 ? Math.max(...feasiblePts.map((p) => p.arrival_h!)) : null;
  const nominalArrivalH = evaluated[0]?.feasible ? evaluated[0].arrival_h : null;
  const minDark = feasiblePts.length > 0 ? Math.min(...feasiblePts.map((p) => p.dark_exposure_h ?? 0)) : null;
  const maxDark = feasiblePts.length > 0 ? Math.max(...feasiblePts.map((p) => p.dark_exposure_h ?? 0)) : null;

  let summary = '';
  if (failureCount === 0) {
    summary = `All ${numPoints} of ${numPoints} landing points allow the trip within the window.`;
  } else if (successCount === 0) {
    const reason =
      shadowFailures >= Math.max(slopeFailures, corridorFailures)
        ? 'the landing dispersion ellipse is in deep shadow at departure'
        : slopeFailures >= Math.max(shadowFailures, corridorFailures)
        ? 'the landing points sit on steep crater walls exceeding the slope limit'
        : 'advancing shadow fronts completely obstruct all traverse corridors';
    summary = `0 of ${numPoints} landing points allow the trip within the window; ${reason}.`;
  } else {
    const reason =
      shadowFailures >= Math.max(slopeFailures, corridorFailures)
        ? 'the failures are on the shadowed side of the ridge'
        : slopeFailures >= Math.max(shadowFailures, corridorFailures)
        ? 'the failures are located on steep slopes exceeding the mechanical limit'
        : 'the failures encounter advancing shadows closing the traverse corridor';
    summary = `${successCount} of ${numPoints} landing points allow the trip within the window; ${reason}.`;
  }

  const assumptionNote = `Dispersion radius (${radiusM.toFixed(0)}m) and sample count (${numPoints}) are operational parameters and engineering assumptions.`;

  return {
    nominal_coord: payload.nominalCoord,
    goal_coord: payload.goalCoord,
    radius_m: radiusM,
    num_points: numPoints,
    success_count: successCount,
    failure_count: failureCount,
    success_rate: successRate,
    min_arrival_h: minArrivalH,
    max_arrival_h: maxArrivalH,
    nominal_arrival_h: nominalArrivalH,
    min_dark_exposure_h: minDark,
    max_dark_exposure_h: maxDark,
    solve_time_ms: solveTimeMs,
    plain_language_summary: summary,
    assumption_note: assumptionNote,
    points: evaluated,
  };
}
