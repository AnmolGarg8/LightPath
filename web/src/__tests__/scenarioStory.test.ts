import { describe, it, expect } from 'vitest';
import { generateScenarioStory, classifyInfeasibleCause } from '../utils/scenarioStory';
import { solveTraverse, solveDepartureMap } from '../workers/routeWorker';
import type { VisibilityCube } from '../types';

describe('Scenario Story and Relaxation Banner Cause Diagnostic Suite', () => {
  const timestamps = [
    '2026-11-01T00:00:00Z',
    '2026-11-01T01:00:00Z',
    '2026-11-01T02:00:00Z',
    '2026-11-01T03:00:00Z',
    '2026-11-01T04:00:00Z',
    '2026-11-01T05:00:00Z',
  ];
  const numT = timestamps.length;
  const nx = 5;
  const ny = 5;

  const createBaseCube = (): VisibilityCube => {
    return {
      grid: { origin: [0, -89.5], spacing_m: 50, nx, ny },
      time_utc: timestamps,
      sun_frac: Array.from({ length: numT }, () => Array.from({ length: ny }, () => Array(nx).fill(100))),
      earth_frac: Array.from({ length: numT }, () => Array.from({ length: ny }, () => Array(nx).fill(100))),
      slope_deg: Array.from({ length: ny }, () => Array(nx).fill(2.0)),
      traversable: Array.from({ length: ny }, () => Array(nx).fill(true)),
      flags: [],
    };
  };

  // Case 1: Start in Shadow
  it('identifies and names "start in shadow" when start cell is dark at departure', () => {
    const cube = createBaseCube();
    // Start cell [0, 0] at T=0 is in deep shadow (0% sunlit)
    cube.sun_frac[0][0][0] = 0;
    // At T=2, start cell becomes sunlit (alternative window opens)
    cube.sun_frac[2][0][0] = 100;

    const route = solveTraverse({
      cube,
      start: [0, 0],
      end: [2, 0],
      startTimeIdx: 0,
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
    });

    expect(route.feasible).toBe(false);
    expect(route.explanation).toContain('start in shadow');

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [2, 0],
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
    });

    const story = generateScenarioStory({
      departureMap: depMap,
      activeRoute: route,
      selectedDepIdx: 0,
      startPoint: [0, 0],
      endPoint: [2, 0],
      speedMs: 0.1,
      maxSlopeDeg: 15.0,
      darkBudgetH: 0.0,
      timeStep: 0,
      cube,
    });

    expect(story.feasible).toBe(false);
    expect(story.cause).toBe('start in shadow');
    expect(story.caption).toContain('start in shadow');
    expect(story.relaxationBanner).not.toBeNull();
    expect(story.relaxationBanner?.infeasibleSentence).toContain('start in shadow');
    expect(story.relaxationBanner?.suggestedRelaxationSentence).toContain('rotates into solar illumination');
    expect(story.explanation).toContain('start in shadow');
  });

  // Case 2: Goal in Shadow
  it('identifies and names "goal in shadow" when destination remains dark across arrival window', () => {
    const cube = createBaseCube();
    // Goal cell [4, 0] is permanently shadowed (0% sunlit across all time steps)
    for (let t = 0; t < numT; t++) {
      cube.sun_frac[t][0][4] = 0;
    }

    const route = solveTraverse({
      cube,
      start: [0, 0],
      end: [4, 0],
      startTimeIdx: 0,
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
    });

    expect(route.feasible).toBe(false);
    expect(route.explanation).toContain('goal in shadow');

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [4, 0],
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
    });

    const story = generateScenarioStory({
      departureMap: depMap,
      activeRoute: route,
      selectedDepIdx: 0,
      startPoint: [0, 0],
      endPoint: [4, 0],
      speedMs: 0.1,
      maxSlopeDeg: 15.0,
      darkBudgetH: 0.0,
      timeStep: 0,
      cube,
    });

    expect(story.feasible).toBe(false);
    expect(story.cause).toBe('goal in shadow');
    expect(story.caption).toContain('goal in shadow');
    expect(story.relaxationBanner).not.toBeNull();
    expect(story.relaxationBanner?.infeasibleSentence).toContain('goal in shadow');
    expect(story.relaxationBanner?.suggestedRelaxationSentence).toContain('remains in shadow');
    expect(story.explanation).toContain('goal in shadow');
  });

  // Case 3: Corridor Shadow
  it('identifies and names "corridor shadow" when moving shadow cuts off traverse corridor', () => {
    const cube = createBaseCube();
    // Intermediate column x=2 has shadow band across all y
    for (let t = 0; t < numT; t++) {
      for (let y = 0; y < ny; y++) {
        cube.sun_frac[t][y][2] = 0;
      }
    }
    // Goal [4, 0] is sunlit at all times; start [0, 0] is sunlit at all times
    // Slopes are 2 degrees everywhere (flat)
    // Zero dark budget forces failure when attempting to traverse across shadowed column x=2
    const route = solveTraverse({
      cube,
      start: [0, 0],
      end: [4, 0],
      startTimeIdx: 0,
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
      dark_budget_h: 0.0,
    });

    expect(route.feasible).toBe(false);
    expect(route.explanation).toContain('corridor shadow');

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [4, 0],
      speed_m_s: 0.1,
      min_sun_frac: 0.5,
      dark_budget_h: 0.0,
    });

    const story = generateScenarioStory({
      departureMap: depMap,
      activeRoute: route,
      selectedDepIdx: 0,
      startPoint: [0, 0],
      endPoint: [4, 0],
      speedMs: 0.1,
      maxSlopeDeg: 15.0,
      darkBudgetH: 0.0,
      timeStep: 0,
      cube,
    });

    expect(story.feasible).toBe(false);
    expect(story.cause).toBe('corridor shadow');
    expect(story.caption).toContain('corridor shadow');
    expect(story.relaxationBanner).not.toBeNull();
    expect(story.relaxationBanner?.infeasibleSentence).toContain('corridor shadow');
    expect(story.explanation).toContain('corridor shadow');
  });

  // Case 4: Slope Barrier
  it('identifies and names "slope barrier" when steep wall blocks all spatial corridors', () => {
    const cube = createBaseCube();
    // Complete vertical wall of 45 degree slopes across column x=2
    for (let y = 0; y < ny; y++) {
      cube.slope_deg[y][2] = 45.0;
    }

    const route = solveTraverse({
      cube,
      start: [0, 0],
      end: [4, 0],
      startTimeIdx: 0,
      speed_m_s: 0.1,
      max_slope_deg: 15.0,
    });

    expect(route.feasible).toBe(false);
    expect(route.explanation).toContain('slope barrier');

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [4, 0],
      speed_m_s: 0.1,
      max_slope_deg: 15.0,
    });

    const story = generateScenarioStory({
      departureMap: depMap,
      activeRoute: route,
      selectedDepIdx: 0,
      startPoint: [0, 0],
      endPoint: [4, 0],
      speedMs: 0.1,
      maxSlopeDeg: 15.0,
      darkBudgetH: 0.0,
      timeStep: 0,
      cube,
    });

    expect(story.feasible).toBe(false);
    expect(story.cause).toBe('slope barrier');
    expect(story.caption).toContain('slope barrier');
    expect(story.relaxationBanner).not.toBeNull();
    expect(story.relaxationBanner?.infeasibleSentence).toContain('slope barrier');
    expect(story.relaxationBanner?.suggestedRelaxationSentence).toContain('slope threshold');
    expect(story.explanation).toContain('slope barrier');
  });

  // Case 5: Deadline
  it('identifies and names "deadline" when time remaining is insufficient for transit distance', () => {
    const cube = createBaseCube();
    // Traverse distance: 4 cells * 50 m = 200 m
    // Speed: 0.005 m/s -> transit time = 40,000 s = 11.1 hours
    // Departing at T=4 with only 1 hour (3600 s) remaining in time horizon
    const route = solveTraverse({
      cube,
      start: [0, 0],
      end: [4, 0],
      startTimeIdx: 4,
      speed_m_s: 0.005,
    });

    expect(route.feasible).toBe(false);
    expect(route.explanation).toContain('deadline');

    const depMap = solveDepartureMap({
      cube,
      start: [0, 0],
      end: [4, 0],
      speed_m_s: 0.005,
    });

    const story = generateScenarioStory({
      departureMap: depMap,
      activeRoute: route,
      selectedDepIdx: 4,
      startPoint: [0, 0],
      endPoint: [4, 0],
      speedMs: 0.005,
      maxSlopeDeg: 15.0,
      darkBudgetH: 0.0,
      timeStep: 4,
      cube,
    });

    expect(story.feasible).toBe(false);
    expect(story.cause).toBe('deadline');
    expect(story.caption).toContain('deadline');
    expect(story.relaxationBanner).not.toBeNull();
    expect(story.relaxationBanner?.infeasibleSentence).toContain('deadline');
    expect(story.relaxationBanner?.suggestedRelaxationSentence).toContain('planning horizon');
    expect(story.explanation).toContain('deadline');
  });

  it('correctly classifies arbitrary reason strings with classifyInfeasibleCause', () => {
    expect(classifyInfeasibleCause('Start location in shadow at departure')).toBe('start in shadow');
    expect(classifyInfeasibleCause('destination remains in shadow')).toBe('goal in shadow');
    expect(classifyInfeasibleCause('terrain slopes exceed limit')).toBe('slope barrier');
    expect(classifyInfeasibleCause('remaining time window before horizon exhausted')).toBe('deadline');
    expect(classifyInfeasibleCause('moving lunar shadow cut off corridor')).toBe('corridor shadow');
  });
});
