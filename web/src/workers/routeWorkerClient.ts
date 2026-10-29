/**
 * Client helper to spawn and interface with the route planning Web Worker.
 */

import { RouteResult, VisibilityCube } from '../types';
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
  } = {}
): Promise<RouteResult> {
  return new Promise((resolve, reject) => {
    // Instantiate Web Worker using Vite worker syntax
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
  });
}
