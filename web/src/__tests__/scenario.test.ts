import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  HASH_REGEX,
  decodeScenarioHash,
  encodeScenarioHash,
  exportScenarioJson,
  importScenarioJson,
  isHashTooLong,
  compareScenarios,
  buildRouteEvidenceData,
} from '../utils/scenarioCodec';
import { RouteEvidenceCard } from '../components/RouteEvidenceCard';
import { Scenario, RouteResult } from '../types';

describe('Scenario Reproducibility, Address Hash Codec, and Comparison Suite', () => {
  const sampleScenario: Scenario = {
    version: 'v1',
    site_id: 'synthetic-proving-ground',
    start_date: '2026-11-01',
    end_date: '2026-11-08',
    min_sun_frac: 0.5,
    min_earth_frac: 0.5,
    mast_height_m: 2.0,
    speed_m_s: 0.05,
    max_slope_deg: 15.0,
    allow_wait: true,
    mode: 'earliest-arrival',
    conservative: false,
    horizon_margin_deg: 0.0,
    start_coord: [10, 10],
    goal_coord: [20, 20],
    data_version_hash: '9f8e21a0',
  };

  it('encodes scenario in address hash using ONLY letters, digits, and hyphens', () => {
    const slug = encodeScenarioHash(sampleScenario);

    // Strict character validation per prompt requirement
    expect(slug).toMatch(HASH_REGEX);
    expect(slug).not.toContain('_');
    expect(slug).not.toContain('%');
    expect(slug).not.toContain('&');
    expect(slug).not.toContain('?');
    expect(slug).not.toContain('=');
    expect(slug).not.toContain('/');
    expect(slug.startsWith('v1-site-synthetic-proving-ground')).toBe(true);
  });

  it('round-trip decodes scenario hash faithfully', () => {
    const slug = encodeScenarioHash(sampleScenario);
    const { scenario, error } = decodeScenarioHash(slug);

    expect(error).toBeNull();
    expect(scenario).not.toBeNull();
    expect(scenario?.version).toBe(sampleScenario.version);
    expect(scenario?.site_id).toBe(sampleScenario.site_id);
    expect(scenario?.start_date).toBe(sampleScenario.start_date);
    expect(scenario?.end_date).toBe(sampleScenario.end_date);
    expect(scenario?.mast_height_m).toBe(sampleScenario.mast_height_m);
    expect(scenario?.speed_m_s).toBe(sampleScenario.speed_m_s);
    expect(scenario?.max_slope_deg).toBe(sampleScenario.max_slope_deg);
    expect(scenario?.start_coord).toEqual(sampleScenario.start_coord);
    expect(scenario?.goal_coord).toEqual(sampleScenario.goal_coord);
  });

  it('malformed links return friendly errors', () => {
    // 1. Illegal characters
    const res1 = decodeScenarioHash('v1-site-synthetic_proving_ground');
    expect(res1.scenario).toBeNull();
    expect(res1.error).toContain('contains illegal characters');

    // 2. Unsupported version
    const res2 = decodeScenarioHash('v2-site-synthetic-proving-ground');
    expect(res2.scenario).toBeNull();
    expect(res2.error).toContain('Unsupported scenario version');

    // 3. Corrupted / missing parameters
    const res3 = decodeScenarioHash('v1-site-synthetic-proving-ground-start-20261101');
    expect(res3.scenario).toBeNull();
    expect(res3.error).toContain('Missing required parameter');

    // 4. Empty string
    const res4 = decodeScenarioHash('');
    expect(res4.scenario).toBeNull();
    expect(res4.error).toContain('Hash string is empty');
  });

  it('flags scenario hash when exceeding length budget to offer downloadable file', () => {
    const shortSlug = encodeScenarioHash(sampleScenario);
    expect(isHashTooLong(shortSlug)).toBe(false);

    const longSlug = 'v1-' + 'site-name-'.repeat(25);
    expect(isHashTooLong(longSlug)).toBe(true);
  });

  it('exports and imports scenario JSON and warns when data version differs', () => {
    const jsonStr = exportScenarioJson(sampleScenario, 'dataver123', 'Test Scenario');
    expect(jsonStr).toContain('"data_version_hash": "dataver123"');
    expect(jsonStr).toContain('"site_id": "synthetic-proving-ground"');

    // Import with matching version -> no warning
    const importMatching = importScenarioJson(jsonStr, 'dataver123');
    expect(importMatching.error).toBeNull();
    expect(importMatching.warning).toBeNull();
    expect(importMatching.scenario?.site_id).toBe('synthetic-proving-ground');

    // Import with differing data version -> warning returned
    const importDiffering = importScenarioJson(jsonStr, 'different999');
    expect(importDiffering.error).toBeNull();
    expect(importDiffering.warning).toContain('Data version mismatch');
    expect(importDiffering.warning).toContain('dataver123');
    expect(importDiffering.warning).toContain('different999');
  });

  it('renders Route Evidence Card matching underlying route result and assumptions', () => {
    const mockRoute: RouteResult = {
      feasible: true,
      mode: 'rover',
      params: {
        start_coord: [10, 10],
        end_coord: [20, 20],
        start_time_idx: 0,
        speed_m_s: 0.05,
        max_slope_deg: 15.0,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
      },
      path: [],
      metrics: {
        total_distance_m: 1414.2,
        duration_h: 7.86,
        average_slope_deg: 3.5,
        max_slope_deg: 8.9,
        dark_exposure_h: 0.0,
        wait_duration_h: 1.2,
        min_sun_frac_observed: 0.5,
        min_earth_frac_observed: 0.5,
      },
      alternatives: [],
      explanation: 'Optimal traverse',
    };

    const evidenceData = buildRouteEvidenceData(
      sampleScenario,
      mockRoute,
      'Synthetic Proving Ground',
      { lat_deg: -89.9, lon_deg: 0.0, ground_elev_m: 120.0 },
      { extra_distance_m: 250, extra_duration_h: 1.5 }
    );

    const html = renderToString(React.createElement(RouteEvidenceCard, { data: evidenceData }));

    // Verifies data fidelity: card matches underlying data exactly
    expect(html).toContain('LIGHTPATH — VERIFIED TRAVERSE EVIDENCE CARD');
    expect(html).toContain('1,414.2');
    expect(html).toContain('7.86');
    expect(html).toContain('FEASIBLE');
    expect(html).toContain('0.050');
    expect(html).toContain('15.0');
    expect(html).toContain('LRO LOLA South Pole Elevation Model (20 m/pixel)');
    expect(html).toContain('MOON_ME');
    expect(html).toContain('Extra driving: +250 m');
    expect(html).toContain('Extra waiting: +1.50 h');
    expect(html).toContain('OPERATIONAL LIMITATIONS');
  });

  it('compares two saved scenarios and computes parameter and metric deltas', () => {
    const scenA: Scenario = { ...sampleScenario, mast_height_m: 2.0, conservative: false };
    const scenB: Scenario = { ...sampleScenario, mast_height_m: 4.0, conservative: true, horizon_margin_deg: 0.5 };

    const resA: RouteResult = {
      feasible: true,
      mode: 'rover',
      params: {
        start_coord: [10, 10],
        end_coord: [20, 20],
        start_time_idx: 0,
        speed_m_s: 0.05,
        max_slope_deg: 15.0,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
      },
      path: [],
      metrics: {
        total_distance_m: 1000.0,
        duration_h: 5.5,
        average_slope_deg: 3.2,
        max_slope_deg: 7.5,
        dark_exposure_h: 0.0,
        wait_duration_h: 0.0,
        min_sun_frac_observed: 0.5,
        min_earth_frac_observed: 0.5,
      },
      alternatives: [],
      explanation: '',
    };

    const resB: RouteResult = {
      feasible: true,
      mode: 'rover',
      params: {
        start_coord: [10, 10],
        end_coord: [20, 20],
        start_time_idx: 0,
        speed_m_s: 0.05,
        max_slope_deg: 15.0,
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
      },
      path: [],
      metrics: {
        total_distance_m: 1250.0,
        duration_h: 7.2,
        average_slope_deg: 3.8,
        max_slope_deg: 8.5,
        dark_exposure_h: 0.0,
        wait_duration_h: 1.0,
        min_sun_frac_observed: 0.5,
        min_earth_frac_observed: 0.5,
      },
      alternatives: [],
      explanation: '',
    };

    const comp = compareScenarios(scenA, scenB, resA, resB);

    expect(comp.parameter_differences.some((d) => d.includes('Mast height delta: +2.0 m'))).toBe(true);
    expect(comp.parameter_differences.some((d) => d.includes('Conservative margin changed'))).toBe(true);
    expect(comp.metric_deltas.delta_distance_m).toBe(250.0);
    expect(comp.metric_deltas.delta_duration_h).toBe(1.7);
    expect(comp.metric_deltas.delta_wait_h).toBe(1.0);
    expect(comp.metric_deltas.summary).toContain('+250.0 m');
  });
});
