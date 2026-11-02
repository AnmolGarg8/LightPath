import { describe, it, expect } from 'vitest';
import { solveMissionPlan, solveTraverse } from '../workers/routeWorker';
import { generateMissionPlanCsv, generateMissionPlanIcs } from '../utils/missionPlanExporter';
import type { VisibilityCube, MissionStop } from '../types';

describe('Multi-Stop Mission Planner Engine (TypeScript / Worker)', () => {
  const numT = 16;
  const timestamps = Array.from({ length: numT }, (_, i) => `2026-11-01T${String(i).padStart(2, '0')}:00:00Z`);

  const createFlatCube = (): VisibilityCube => {
    const sunGrid = Array.from({ length: 5 }, () => Array(5).fill(100));
    const earthGrid = Array.from({ length: 5 }, () => Array(5).fill(100));
    return {
      grid: { origin: [0, -89], spacing_m: 36, nx: 5, ny: 5 },
      time_utc: timestamps,
      sun_frac: Array.from({ length: numT }, () => sunGrid),
      earth_frac: Array.from({ length: numT }, () => earthGrid),
      slope_deg: Array.from({ length: 5 }, () => Array(5).fill(0)),
      traversable: Array.from({ length: 5 }, () => Array(5).fill(true)),
      flags: [],
    };
  };

  it('correctly solves a hand-made mission plan with known legs, dwells, and timings', () => {
    const cube = createFlatCube();
    const start: [number, number] = [0, 0];
    const speed = 0.01; // 36m / 0.01 m/s = 3600s = 1 hr per cell move

    const stops: MissionStop[] = [
      {
        stop_id: 'stop_1',
        name: 'Station Alpha',
        coord: [2, 0],
        dwell_time_h: 1.0,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        min_earth_duration_h: 1.0,
      },
      {
        stop_id: 'stop_2',
        name: 'Station Beta',
        coord: [4, 0],
        dwell_time_h: 2.0,
        min_sun_frac: 0.5,
        deadline_idx: 12,
      },
    ];

    const plan = solveMissionPlan({
      cube,
      start,
      startTimeIdx: 0,
      stops,
      speed_m_s: speed,
      mission_name: 'Proving Ground Sortie',
    });

    expect(plan.feasible).toBe(true);
    expect(plan.violations.length).toBe(0);
    expect(plan.legs.length).toBe(2);
    expect(plan.dwells.length).toBe(2);
    expect(plan.timeline.length).toBe(4);

    // Timing check
    expect(plan.legs[0].start_time_idx).toBe(0);
    expect(plan.legs[0].end_time_idx).toBe(2);
    expect(plan.dwells[0].start_time_idx).toBe(2);
    expect(plan.dwells[0].end_time_idx).toBe(3);
    expect(plan.dwells[0].earth_satisfied).toBe(true);

    expect(plan.legs[1].start_time_idx).toBe(3);
    expect(plan.legs[1].end_time_idx).toBe(5);
    expect(plan.dwells[1].start_time_idx).toBe(5);
    expect(plan.dwells[1].end_time_idx).toBe(7);
    expect(plan.dwells[1].deadline_satisfied).toBe(true);

    // Distance & durations
    expect(plan.metrics.total_distance_m).toBe(144);
    expect(plan.metrics.transit_duration_h).toBe(4);
    expect(plan.metrics.dwell_duration_h).toBe(3);
    expect(plan.metrics.total_duration_h).toBe(7);
    expect(plan.limits_disclaimer).toContain('Geometric Sun and Earth visibility only');
  });

  it('restores feasibility by recommending stop reordering when deadline is missed', () => {
    const cube = createFlatCube();
    const start: [number, number] = [0, 0];
    const speed = 0.01;

    const stopA: MissionStop = {
      stop_id: 'stop_a',
      name: 'Ridge Peak',
      coord: [2, 0],
      dwell_time_h: 1.0,
      deadline_idx: 4, // tight deadline
    };
    const stopB: MissionStop = {
      stop_id: 'stop_b',
      name: 'Valley Base',
      coord: [0, 2],
      dwell_time_h: 3.0,
      deadline_idx: 12,
    };

    // Sub-optimal ordering: [Stop B, Stop A]
    // Transit to B: 0..2, dwell: 2..5, transit to A: 5..7, dwell at A: 7..8 > 4 deadline!
    const infeasiblePlan = solveMissionPlan({
      cube,
      start,
      startTimeIdx: 0,
      stops: [stopB, stopA],
      speed_m_s: speed,
    });

    expect(infeasiblePlan.feasible).toBe(false);
    expect(infeasiblePlan.violations.some((v) => v.type === 'deadline_missed')).toBe(true);

    // Recommended fix must recommend reordering
    expect(infeasiblePlan.fix_recommendation).not.toBeNull();
    expect(infeasiblePlan.fix_recommendation?.type).toBe('reorder_stops');
    expect(infeasiblePlan.fix_recommendation?.description).toContain('Ridge Peak');

    // Verify that reordered plan [Stop A, Stop B] is feasible
    const reorderedPlan = solveMissionPlan({
      cube,
      start,
      startTimeIdx: 0,
      stops: [stopA, stopB],
      speed_m_s: speed,
    });
    expect(reorderedPlan.feasible).toBe(true);
    expect(reorderedPlan.violations.length).toBe(0);
  });

  it('explains infeasibility and suggests shorter dwell when deadline is exceeded', () => {
    const cube = createFlatCube();
    const start: [number, number] = [0, 0];
    const speed = 0.01;

    const stops: MissionStop[] = [
      {
        stop_id: 'sample_core',
        name: 'Sample Core',
        coord: [2, 0],
        dwell_time_h: 4.0,
        deadline_idx: 4, // arrival at 2 + 4h dwell = 6 > 4!
      },
    ];

    const plan = solveMissionPlan({
      cube,
      start,
      startTimeIdx: 0,
      stops,
      speed_m_s: speed,
    });

    expect(plan.feasible).toBe(false);
    expect(plan.violations[0].type).toBe('deadline_missed');
    expect(plan.violations[0].details).toContain('Sample Core');

    // Fix recommendation should suggest reducing dwell
    const fix = plan.fix_recommendation;
    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('shorter_dwell');
    expect(fix?.stop_name).toBe('Sample Core');
    expect(fix?.delta_h).toBeGreaterThanOrEqual(1.5);
  });

  it('guarantees consistency with single-leg solver when there is one stop and zero dwell', () => {
    const cube = createFlatCube();
    const start: [number, number] = [0, 0];
    const dest: [number, number] = [3, 3];
    const speed = 0.05;

    // Single leg solver
    const single = solveTraverse({
      cube,
      start,
      end: dest,
      startTimeIdx: 0,
      speed_m_s: speed,
    });

    // Mission planner with 1 stop and 0 dwell
    const mission = solveMissionPlan({
      cube,
      start,
      startTimeIdx: 0,
      stops: [{ stop_id: 'tgt', name: 'Target', coord: dest, dwell_time_h: 0 }],
      speed_m_s: speed,
    });

    expect(mission.feasible).toBe(single.feasible);
    expect(mission.legs.length).toBe(1);
    expect(mission.legs[0].distance_m).toBe(single.metrics.total_distance_m);
    expect(mission.legs[0].duration_h).toBe(single.metrics.duration_h);
    expect(mission.legs[0].path).toEqual(single.path);
  });

  it('exports valid CSV and ICS strings with limits notice', () => {
    const cube = createFlatCube();
    const plan = solveMissionPlan({
      cube,
      start: [0, 0],
      startTimeIdx: 0,
      stops: [{ stop_id: 's1', name: 'Science Site', coord: [2, 0], dwell_time_h: 1 }],
      speed_m_s: 0.01,
      mission_name: 'Test Sortie',
    });

    const csv = generateMissionPlanCsv(plan);
    expect(csv).toContain('# LightPath Lunar Mission Plan Export');
    expect(csv).toContain('Geometric Sun and Earth visibility only; no power or link budget.');
    expect(csv).toContain('leg_1,transit');
    expect(csv).toContain('dwell_1,dwell');

    const ics = generateMissionPlanIcs(plan);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('X-LIMITS:Geometric Sun and Earth visibility only; no power or link budget.');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:[LightPath] Transit: Base Lander -> Science Site');
    expect(ics).toContain('SUMMARY:[LightPath] Dwell: Science Site (1.0h)');
  });
});
