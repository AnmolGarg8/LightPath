/**
 * Client helper to spawn and interface with the route planning Web Worker.
 */

import {
  ConservativeComparisonResult,
  DepartureMapResult,
  LandingDispersionResult,
  MissionPlanResult,
  MissionStop,
  RouteResult,
  VisibilityCube,
} from '../types';
import { RouteWorkerRequest, RouteWorkerResponse } from './routeWorker';

export function runRouteSolverWorker(
  cube: VisibilityCube,
  start: [number, number],
  end: [number, number],
  options: {
    startTimeIdx?: number;
    speed_m_s?: number;
    max_slope_deg?: number;
    min_sun_frac?: number;
    min_earth_frac?: number;
    planner_mode?: 'earliest_arrival' | 'latest_departure' | 'min_darkness';
    dark_budget_h?: number;
    allow_wait?: boolean;
  } = {}
): Promise<RouteResult> {
  if (typeof Worker === 'undefined') {
    return import('./routeWorker').then(({ solveTraverse }) => {
      return solveTraverse({ cube, start, end, ...options });
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./routeWorker.ts', import.meta.url), {
        type: 'module',
      });

      const request: RouteWorkerRequest = {
        type: 'SOLVE_ROUTE',
        payload: {
          cube,
          start,
          end,
          ...options,
        },
      };

      worker.onmessage = (event: MessageEvent<RouteWorkerResponse>) => {
        const { type, result, error } = event.data;
        worker.terminate();

        if (type === 'ROUTE_SUCCESS' && result) {
          resolve(result);
        } else {
          reject(new Error(error || 'Worker route calculation failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage(request);
    } catch {
      import('./routeWorker').then(({ solveTraverse }) => {
        resolve(solveTraverse({ cube, start, end, ...options }));
      }).catch(reject);
    }
  });
}

export function runDepartureMapWorker(
  cube: VisibilityCube,
  start: [number, number],
  end: [number, number],
  options: {
    speed_m_s?: number;
    max_slope_deg?: number;
    min_sun_frac?: number;
    min_earth_frac?: number;
    planner_mode?: 'earliest_arrival' | 'latest_departure' | 'min_darkness';
    dark_budget_h?: number;
    allow_wait?: boolean;
    max_departure_idx?: number;
  } = {}
): Promise<DepartureMapResult> {
  if (typeof Worker === 'undefined') {
    return import('./routeWorker').then(({ solveDepartureMap }) => {
      return solveDepartureMap({
        cube,
        start,
        end,
        ...options,
      });
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./routeWorker.ts', import.meta.url), {
        type: 'module',
      });

      const request: RouteWorkerRequest = {
        type: 'SOLVE_DEPARTURE_MAP',
        payload: {
          cube,
          start,
          end,
          ...options,
        },
      };

      worker.onmessage = (event: MessageEvent<RouteWorkerResponse>) => {
        const { type, departureMap, error } = event.data;
        worker.terminate();

        if (type === 'DEPARTURE_MAP_SUCCESS' && departureMap) {
          resolve(departureMap);
        } else {
          reject(new Error(error || 'Worker departure map calculation failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage(request);
    } catch {
      import('./routeWorker').then(({ solveDepartureMap }) => {
        resolve(solveDepartureMap({ cube, start, end, ...options }));
      }).catch(reject);
    }
  });
}

export function runMissionPlanWorker(
  cube: VisibilityCube,
  start: [number, number],
  startTimeIdx: number,
  stops: MissionStop[],
  options: {
    speed_m_s?: number;
    max_slope_deg?: number;
    dark_budget_h?: number;
    allow_wait?: boolean;
    mission_name?: string;
  } = {}
): Promise<MissionPlanResult> {
  if (typeof Worker === 'undefined') {
    return import('./routeWorker').then(({ solveMissionPlan }) => {
      return solveMissionPlan({
        cube,
        start,
        startTimeIdx,
        stops,
        ...options,
      });
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./routeWorker.ts', import.meta.url), {
        type: 'module',
      });

      const request: RouteWorkerRequest = {
        type: 'SOLVE_MISSION_PLAN',
        payload: {
          cube,
          start,
          startTimeIdx,
          stops,
          ...options,
        },
      };

      worker.onmessage = (event: MessageEvent<RouteWorkerResponse>) => {
        const { type, missionPlan, error } = event.data;
        worker.terminate();

        if (type === 'MISSION_PLAN_SUCCESS' && missionPlan) {
          resolve(missionPlan);
        } else {
          reject(new Error(error || 'Worker mission plan calculation failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage(request);
    } catch {
      import('./routeWorker').then(({ solveMissionPlan }) => {
        resolve(solveMissionPlan({ cube, start, startTimeIdx, stops, ...options }));
      }).catch(reject);
    }
  });
}

export function runConservativeComparisonWorker(
  cube: VisibilityCube,
  start: [number, number],
  end: [number, number],
  options: {
    startTimeIdx?: number;
    speed_m_s?: number;
    max_slope_deg?: number;
    min_sun_frac?: number;
    min_earth_frac?: number;
    planner_mode?: 'earliest_arrival' | 'latest_departure' | 'min_darkness';
    dark_budget_h?: number;
    allow_wait?: boolean;
    horizon_margin_deg?: number;
  } = {}
): Promise<ConservativeComparisonResult> {
  if (typeof Worker === 'undefined') {
    return import('./routeWorker').then(({ compareConservativeRoutes }) => {
      return compareConservativeRoutes({ cube, start, end, ...options });
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./routeWorker.ts', import.meta.url), {
        type: 'module',
      });

      const request: RouteWorkerRequest = {
        type: 'COMPARE_CONSERVATIVE_ROUTE',
        payload: {
          cube,
          start,
          end,
          ...options,
        },
      };

      worker.onmessage = (event: MessageEvent<RouteWorkerResponse>) => {
        const { type, conservativeComparison, error } = event.data;
        worker.terminate();

        if (type === 'CONSERVATIVE_COMPARISON_SUCCESS' && conservativeComparison) {
          resolve(conservativeComparison);
        } else {
          reject(new Error(error || 'Worker conservative comparison calculation failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage(request);
    } catch {
      import('./routeWorker').then(({ compareConservativeRoutes }) => {
        resolve(compareConservativeRoutes({ cube, start, end, ...options }));
      }).catch(reject);
    }
  });
}

export function runLandingDispersionWorker(
  cube: VisibilityCube,
  nominalCoord: [number, number],
  goalCoord: [number, number],
  options: {
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
  } = {}
): Promise<LandingDispersionResult> {
  if (typeof Worker === 'undefined') {
    return import('./routeWorker').then(({ solveLandingDispersion }) => {
      return solveLandingDispersion({ cube, nominalCoord, goalCoord, ...options });
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./routeWorker.ts', import.meta.url), {
        type: 'module',
      });

      const request: RouteWorkerRequest = {
        type: 'SOLVE_LANDING_DISPERSION',
        payload: {
          cube,
          nominalCoord,
          goalCoord,
          ...options,
        },
      };

      worker.onmessage = (event: MessageEvent<RouteWorkerResponse>) => {
        const { type, landingDispersion, error } = event.data;
        worker.terminate();

        if (type === 'LANDING_DISPERSION_SUCCESS' && landingDispersion) {
          resolve(landingDispersion);
        } else {
          reject(new Error(error || 'Worker landing dispersion calculation failed'));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`Worker error: ${err.message}`));
      };

      worker.postMessage(request);
    } catch {
      import('./routeWorker').then(({ solveLandingDispersion }) => {
        resolve(solveLandingDispersion({ cube, nominalCoord, goalCoord, ...options }));
      }).catch(reject);
    }
  });
}
