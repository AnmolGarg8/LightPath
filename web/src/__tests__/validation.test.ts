import { describe, it, expect } from 'vitest';
import {
  SiteSummarySchema,
  StatsSchema,
  validatePayload,
  DataValidationError,
} from '../types/schemas';

describe('Zod Runtime Schema Validation & Diagnostics', () => {
  it('validates a correct site summary payload', () => {
    const validSite = {
      id: 'shackleton-ridge',
      name: 'Shackleton Connecting Ridge',
      mission_ids: ['clps-demo'],
      lat_deg: -89.44,
      lon_deg: 137.5,
      ground_elev_m: 1200.0,
      source_links: ['https://example.com'],
      verified: false,
      is_synthetic: true,
    };

    const res = validatePayload(SiteSummarySchema, validSite, 'test-site.json');
    expect(res.id).toBe('shackleton-ridge');
    expect(res.lat_deg).toBe(-89.44);
  });

  it('throws DataValidationError with exact field path on invalid latitude', () => {
    const invalidSite = {
      id: 'bad-site',
      name: 'Bad Lat Site',
      mission_ids: [],
      lat_deg: -120.0, // Invalid: min is -90
      lon_deg: 0.0,
      ground_elev_m: 0.0,
      source_links: [],
      verified: false,
      is_synthetic: true,
    };

    expect(() => validatePayload(SiteSummarySchema, invalidSite, 'sites/bad-site.json')).toThrow(
      DataValidationError
    );

    try {
      validatePayload(SiteSummarySchema, invalidSite, 'sites/bad-site.json');
    } catch (err) {
      const valErr = err as DataValidationError;
      expect(valErr.sourceFile).toBe('sites/bad-site.json');
      expect(valErr.details.length).toBeGreaterThan(0);
      expect(valErr.details[0].fieldPath).toBe('lat_deg');
    }
  });

  it('throws on missing required nested field in stats schema', () => {
    const invalidStats = {
      thresholds: {
        min_sun_frac: 0.5,
        min_earth_frac: 0.5,
        // missing ground_station_mask_deg
      },
      sun: {
        uptime_fraction: 0.8,
        total_uptime_h: 80.0,
        windows: [],
        longest_window_h: 20.0,
        longest_outage_h: 5.0,
      },
    };

    expect(() => validatePayload(StatsSchema, invalidStats, 'stats.json')).toThrow(DataValidationError);

    try {
      validatePayload(StatsSchema, invalidStats, 'stats.json');
    } catch (err) {
      const valErr = err as DataValidationError;
      const paths = valErr.details.map((d) => d.fieldPath);
      expect(paths).toContain('thresholds.ground_station_mask_deg');
    }
  });
});
