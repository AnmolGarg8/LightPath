import { describe, it, expect } from 'vitest';
import { sliceSeries, calculateDynamicStats } from '../utils/statsCalculator';
import { Series } from '../types/schemas';

describe('Mission headlines slicing test', () => {
  it('computes headline contact hours only from analysis_window (e.g. 96-hour window on a 30-day series) and never exceeds window length', () => {
    // Generate a synthetic 30-day (720 hour) series at 1-hour steps
    const timestamps: string[] = [];
    const sunFrac: number[] = [];
    const earthFrac: number[] = [];
    const dteOk: boolean[] = [];

    const startEpoch = new Date('2026-11-01T00:00:00Z').getTime();
    for (let h = 0; h < 720; h++) {
      const dt = new Date(startEpoch + h * 3600000);
      timestamps.push(dt.toISOString());
      // 100% visible throughout
      sunFrac.push(1.0);
      earthFrac.push(1.0);
      dteOk.push(true);
    }

    const fullSeries: Series = {
      time_utc: timestamps,
      sun: {
        az_deg: new Array(720).fill(0),
        el_deg: new Array(720).fill(1.0),
        radius_deg: new Array(720).fill(0.267),
        frac: sunFrac,
        status: new Array(720).fill('visible'),
      },
      earth: {
        az_deg: new Array(720).fill(0),
        el_deg: new Array(720).fill(5.0),
        radius_deg: new Array(720).fill(0.95),
        frac: earthFrac,
        status: new Array(720).fill('visible'),
        dist_km: new Array(720).fill(384400),
      },
      dte: {
        station_names: ['Goldstone', 'Madrid', 'Canberra'],
        station_visible: new Array(720).fill([true, true, true]),
        link_ok: dteOk,
      },
    };

    // Full series has 720h of contact
    const fullStats = calculateDynamicStats(fullSeries, 0.5);
    expect(fullStats.joint_sun_earth.total_uptime_h).toBe(720);

    // Now slice to a 96-hour window [2026-11-01T00:00:00Z, 2026-11-05T00:00:00Z)
    const windowStart = '2026-11-01T00:00:00Z';
    const windowEnd = '2026-11-05T00:00:00Z';
    const sliced = sliceSeries(fullSeries, windowStart, windowEnd);

    expect(sliced.time_utc.length).toBe(96);
    expect(sliced.time_utc[0]).toBe('2026-11-01T00:00:00.000Z');
    expect(sliced.time_utc[sliced.time_utc.length - 1]).toBe('2026-11-04T23:00:00.000Z');

    const slicedStats = calculateDynamicStats(sliced, 0.5);
    const windowLengthH = (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 3600000;
    expect(windowLengthH).toBe(96);

    // Contact hours strictly equals 96h and does not exceed window length
    expect(slicedStats.joint_sun_earth.total_uptime_h).toBe(96);
    expect(slicedStats.joint_sun_earth.total_uptime_h).toBeLessThanOrEqual(windowLengthH);
  });
});
