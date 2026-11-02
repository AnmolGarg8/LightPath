import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ReplayView } from '../views/ReplayView';
import {
  calculateUncertaintyBudget,
  compareBacktestEvents,
  DEMO_BACKTEST_FIXTURE,
} from '../utils/backtestComparator';

describe('Historical Mission Backtest & Replay Suite', () => {
  it('shows NOT AVAILABLE when the sourced case file is missing', () => {
    // When no case is supplied (production state where docs/BACKTEST_CASE.md is absent)
    const html = renderToString(React.createElement(ReplayView, { initialCase: null }));

    expect(html).toContain('data-testid="backtest-not-available"');
    expect(html).toContain('NOT AVAILABLE');
    expect(html).toContain('PRECONDITION HALTED');
    expect(html).toContain('docs/BACKTEST_CASE.md');
    expect(html).toContain('Never invent facts, coordinates, mission names, dates, or citations');
  });

  it('performs fixture-based comparison arithmetic for nominal sunset', () => {
    const results = compareBacktestEvents(
      DEMO_BACKTEST_FIXTURE.case,
      DEMO_BACKTEST_FIXTURE.series
    );

    const nominalSunset = results.find((r) => r.event_id === 'ev-sunset-nominal');
    expect(nominalSunset).toBeDefined();
    expect(nominalSunset?.status).toBe('MATCH_WITHIN_UNCERTAINTY');
    expect(nominalSunset?.delta_hours).toBe(0.0);
    expect(nominalSunset?.predicted_time_utc).toBe('2026-11-01T12:00:00Z');
    expect(nominalSunset?.geometry_explanation).toContain('matches reported event');
  });

  it('correctly attributes delayed sunset to terrain resolution uncertainty', () => {
    const results = compareBacktestEvents(
      DEMO_BACKTEST_FIXTURE.case,
      DEMO_BACKTEST_FIXTURE.series
    );

    const delayedSunset = results.find((r) => r.event_id === 'ev-sunset-delayed');
    expect(delayedSunset).toBeDefined();
    expect(delayedSunset?.status).toBe('DISCREPANCY_EXPLAINED_BY_TERRAIN');
    expect(delayedSunset?.delta_hours).toBe(-0.5);
    expect(delayedSunset?.geometry_explanation).toContain(
      'fully explained by combined terrain resolution and landing-location dispersion uncertainty'
    );
  });

  it('identifies premature comms loss as unexplained by geometry alone', () => {
    const results = compareBacktestEvents(
      DEMO_BACKTEST_FIXTURE.case,
      DEMO_BACKTEST_FIXTURE.series
    );

    const commsLoss = results.find((r) => r.event_id === 'ev-comms-premature-loss');
    expect(commsLoss).toBeDefined();
    expect(commsLoss?.status).toBe('UNEXPLAINED_BY_GEOMETRY');
    expect(commsLoss?.delta_hours).toBeNull();
    expect(commsLoss?.geometry_explanation).toContain('+8.50 deg');
    expect(commsLoss?.geometry_explanation).toContain('Geometry alone cannot explain');
  });

  it('computes uncertainty budget from DEM resolution and landing dispersion correctly', () => {
    const unc = calculateUncertaintyBudget(20.0, 250.0, 0.08, 10.0, 10000.0);

    // Analytical independent values:
    // slope = 10 deg, tan(10) ~ 0.17632698
    // dz_dem = 20 * 0.17632698 = 3.5265 m -> atan2(3.5265, 10000) = 0.0202 deg -> 0.0202 / 0.08 = 0.253 h
    // dz_disp = 250 * 0.17632698 = 44.0817 m -> atan2(44.0817, 10000) = 0.2525 deg -> 0.2525 / 0.08 = 3.157 h
    // total = sqrt(0.253^2 + 3.157^2) ~ 3.167 h
    expect(unc.terrain_resolution_h).toBeCloseTo(0.253, 2);
    expect(unc.landing_location_h).toBeCloseTo(3.157, 2);
    expect(unc.total_uncertainty_h).toBeCloseTo(3.167, 2);
    expect(unc.terrain_resolution_h).toBeLessThan(unc.total_uncertainty_h);
  });

  it('renders interactive replay view when case and series are loaded without claiming causality', () => {
    const html = renderToString(
      React.createElement(ReplayView, {
        initialCase: DEMO_BACKTEST_FIXTURE.case,
        initialSeries: DEMO_BACKTEST_FIXTURE.series,
      })
    );

    expect(html).not.toContain('data-testid="backtest-not-available"');
    expect(html).toContain('Synthetic Polar Pathfinder');
    expect(html).toContain('Timeline Comparison');
    expect(html).toContain('Matches Geometry');
    expect(html).toContain('Explained by Terrain');
    expect(html).toContain('Unexplained by Geometry Alone');
    expect(html).toContain('Project Rule 8 &amp; Non-Causality Disclosure');
    expect(html).toContain(
      'The tool makes no claims to explain mission outcomes or system failures beyond line-of-sight geometry'
    );
  });
});
