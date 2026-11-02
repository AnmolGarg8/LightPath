import {
  BacktestCase,
  BacktestComparisonResult,
  BacktestUncertainty,
  Series,
} from '../types';

export function calculateUncertaintyBudget(
  demResolutionM: number,
  landingUncertaintyM: number,
  elevationRateDegPerH: number,
  typicalSlopeDeg = 10.0,
  ridgeDistanceM = 10000.0
): BacktestUncertainty {
  const rate = Math.max(1e-4, Math.abs(elevationRateDegPerH));
  const slopeRad = (typicalSlopeDeg * Math.PI) / 180.0;

  // 1. Terrain resolution uncertainty
  const dzTerrainM = demResolutionM * Math.tan(slopeRad);
  const dThetaTerrainDeg = (Math.atan2(dzTerrainM, ridgeDistanceM) * 180.0) / Math.PI;
  const sigmaTerrainH = Number((dThetaTerrainDeg / rate).toFixed(3));

  // 2. Landing location uncertainty
  const dzLocationM = landingUncertaintyM * Math.tan(slopeRad);
  const dThetaLocationDeg = (Math.atan2(dzLocationM, ridgeDistanceM) * 180.0) / Math.PI;
  const sigmaLocationH = Number((dThetaLocationDeg / rate).toFixed(3));

  // 3. Total combined uncertainty (root sum of squares)
  const sigmaTotalH = Number(
    Math.sqrt(sigmaTerrainH * sigmaTerrainH + sigmaLocationH * sigmaLocationH).toFixed(3)
  );

  return {
    terrain_resolution_h: sigmaTerrainH,
    landing_location_h: sigmaLocationH,
    total_uncertainty_h: sigmaTotalH,
  };
}

export function findPredictedSunset(
  times: string[],
  sunFracs: number[],
  sunEls: number[],
  landingTimeMs: number
): { predictedTimeUtc: string; rateDegPerH: number } | null {
  for (let i = 0; i < times.length; i++) {
    const tMs = new Date(times[i]).getTime();
    if (tMs < landingTimeMs) continue;

    const frac = sunFracs[i];
    const el = sunEls[i];
    if (frac <= 0.0 || el <= 0.0) {
      const prevIdx = Math.max(0, i - 1);
      const nextIdx = Math.min(times.length - 1, i + 1);
      const dtH = Math.max(
        0.1,
        (new Date(times[nextIdx]).getTime() - new Date(times[prevIdx]).getTime()) / 3600000
      );
      const rate = Math.abs(sunEls[nextIdx] - sunEls[prevIdx]) / dtH;
      return {
        predictedTimeUtc: times[i],
        rateDegPerH: Math.max(0.01, rate),
      };
    }
  }
  return null;
}

export function compareBacktestEvents(
  caseData: BacktestCase,
  series: Series
): BacktestComparisonResult[] {
  const times = series.time_utc;
  const sunFracs = series.sun.frac;
  const sunEls = series.sun.el_deg;
  const earthFracs = series.earth.frac;
  const earthEls = series.earth.el_deg;
  const dteLinks = series.dte?.link_ok ?? times.map(() => true);

  const landingMs = new Date(caseData.landing_time_utc).getTime();
  const demResM = caseData.dem_resolution_m ?? 20.0;
  const landingUncM = caseData.landing_uncertainty_m ?? 250.0;

  const sunsetPred = findPredictedSunset(times, sunFracs, sunEls, landingMs);
  const predictedSunsetUtc = sunsetPred ? sunsetPred.predictedTimeUtc : null;
  const elRate = sunsetPred ? sunsetPred.rateDegPerH : 0.08;

  const unc = calculateUncertaintyBudget(demResM, landingUncM, elRate);
  const results: BacktestComparisonResult[] = [];

  for (const ev of caseData.reported_events) {
    const repMs = new Date(ev.time_utc).getTime();

    if (ev.event_type === 'sunset' || ev.event_type === 'loss_of_sunlight') {
      if (predictedSunsetUtc) {
        const predMs = new Date(predictedSunsetUtc).getTime();
        const deltaH = Number(((predMs - repMs) / 3600000).toFixed(3));

        let status: BacktestComparisonResult['status'];
        let explanation: string;

        if (Math.abs(deltaH) <= unc.terrain_resolution_h) {
          status = 'MATCH_WITHIN_UNCERTAINTY';
          explanation = `Predicted sunset matches reported event within terrain resolution uncertainty (${Math.abs(
            deltaH
          ).toFixed(2)}h difference <= ${unc.terrain_resolution_h.toFixed(2)}h uncertainty limit).`;
        } else if (Math.abs(deltaH) <= unc.total_uncertainty_h) {
          status = 'DISCREPANCY_EXPLAINED_BY_TERRAIN';
          explanation = `Discrepancy of ${Math.abs(
            deltaH
          ).toFixed(2)}h is fully explained by combined terrain resolution and landing-location dispersion uncertainty (+/-${unc.total_uncertainty_h.toFixed(
            2
          )}h).`;
        } else {
          status = 'UNEXPLAINED_BY_GEOMETRY';
          explanation = `Delta of ${deltaH.toFixed(
            2
          )}h exceeds total geometric uncertainty (+/-${unc.total_uncertainty_h.toFixed(
            2
          )}h). Geometry alone cannot explain this difference; potential causes include local micro-topography smaller than ${demResM}m DEM resolution or spacecraft solar array orientation.`;
        }

        results.push({
          event_id: ev.id,
          event_name: ev.name,
          reported_time_utc: ev.time_utc,
          predicted_time_utc: predictedSunsetUtc,
          delta_hours: deltaH,
          uncertainty: unc,
          status,
          geometry_explanation: explanation,
        });
      } else {
        results.push({
          event_id: ev.id,
          event_name: ev.name,
          reported_time_utc: ev.time_utc,
          predicted_time_utc: null,
          delta_hours: null,
          uncertainty: unc,
          status: 'NO_PREDICTED_EVENT',
          geometry_explanation:
            'Sun remained above geometric horizon throughout the analyzed period.',
        });
      }
    } else {
      // Earth LOS / Loss of Signal / End of Operations
      // Find closest series time
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < times.length; i++) {
        const diff = Math.abs(new Date(times[i]).getTime() - repMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }

      const earthEl = earthEls[closestIdx] ?? 0.0;
      const earthFrac = earthFracs[closestIdx] ?? 1.0;
      const dteOk = dteLinks[closestIdx] ?? true;

      if (earthEl > 0.0 && earthFrac > 0.5 && dteOk) {
        results.push({
          event_id: ev.id,
          event_name: ev.name,
          reported_time_utc: ev.time_utc,
          predicted_time_utc: null,
          delta_hours: null,
          uncertainty: unc,
          status: 'UNEXPLAINED_BY_GEOMETRY',
          geometry_explanation: `At the reported event time, topocentric Earth elevation was +${earthEl.toFixed(
            2
          )} deg (disc fraction: ${(earthFrac * 100).toFixed(
            1
          )}%) with active Direct-To-Earth line of sight. Geometry alone cannot explain signal loss; potential causes include spacecraft antenna off-pointing, battery depletion, receiver pass scheduling, or ground station maintenance.`,
        });
      } else {
        results.push({
          event_id: ev.id,
          event_name: ev.name,
          reported_time_utc: ev.time_utc,
          predicted_time_utc: times[closestIdx],
          delta_hours: 0.0,
          uncertainty: unc,
          status: 'MATCH_WITHIN_UNCERTAINTY',
          geometry_explanation:
            'Earth line-of-sight was obstructed by terrain, matching signal loss.',
        });
      }
    }
  }

  return results;
}

export const DEMO_BACKTEST_FIXTURE: { case: BacktestCase; series: Series } = {
  case: {
    case_id: 'fixture-south-pole-lander',
    mission_name: 'Synthetic Polar Pathfinder (Verification Fixture)',
    site_id: 'synthetic-proving-ground',
    landing_time_utc: '2026-11-01T00:00:00Z',
    landing_coord: {
      lat_deg: -89.9,
      lon_deg: 0.0,
      elev_m: 0.0,
    },
    landing_uncertainty_m: 250.0,
    dem_resolution_m: 20.0,
    reported_events: [
      {
        id: 'ev-sunset-nominal',
        name: 'Reported Sunset / Loss of Solar Generation',
        event_type: 'sunset',
        time_utc: '2026-11-01T12:00:00Z',
        description: 'Solar arrays dropped below operating threshold at local sunset',
        source_label: 'Mission Operations Report [Controlled Test Fixture]',
        source_url: 'https://example.org/polar-pathfinder/sunset',
        verified: true,
      },
      {
        id: 'ev-sunset-delayed',
        name: 'Reported Secondary Array Cutoff',
        event_type: 'loss_of_sunlight',
        time_utc: '2026-11-01T12:30:00Z',
        description: 'Auxiliary cell shadow cutoff observed 30 min after predicted horizon dip',
        source_label: 'Telemetry Log Section 4.2 [Controlled Test Fixture]',
        source_url: 'https://example.org/polar-pathfinder/aux',
        verified: true,
      },
      {
        id: 'ev-comms-premature-loss',
        name: 'Loss of High-Gain Earth Signal',
        event_type: 'loss_of_signal',
        time_utc: '2026-11-01T06:00:00Z',
        description:
          'High-gain link dropped unexpectedly while Earth was 8.5 degrees above the ridge',
        source_label: 'Flight Anomaly Report [Controlled Test Fixture]',
        source_url: 'https://example.org/polar-pathfinder/comms-anomaly',
        verified: true,
      },
    ],
    disclaimer:
      'LightPath computes geometric line-of-sight visibility only. It does not model thermal dynamics, battery state-of-charge, or hardware subsystem anomalies.',
  },
  series: {
    time_utc: [
      '2026-11-01T00:00:00Z',
      '2026-11-01T01:00:00Z',
      '2026-11-01T02:00:00Z',
      '2026-11-01T03:00:00Z',
      '2026-11-01T04:00:00Z',
      '2026-11-01T05:00:00Z',
      '2026-11-01T06:00:00Z',
      '2026-11-01T07:00:00Z',
      '2026-11-01T08:00:00Z',
      '2026-11-01T09:00:00Z',
      '2026-11-01T10:00:00Z',
      '2026-11-01T11:00:00Z',
      '2026-11-01T12:00:00Z',
      '2026-11-01T13:00:00Z',
      '2026-11-01T14:00:00Z',
      '2026-11-01T15:00:00Z',
      '2026-11-01T16:00:00Z',
      '2026-11-01T17:00:00Z',
      '2026-11-01T18:00:00Z',
    ],
    sun: {
      az_deg: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360],
      el_deg: [
        1.0, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28, 0.2, 0.1, 0.0, -0.09, -0.18, -0.27,
        -0.36, -0.45, -0.54,
      ],
      radius_deg: [0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26],
      frac: [
        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0,
      ],
      status: [
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
        'robust_visible', 'marginal', 'robust_blocked', 'robust_blocked', 'robust_blocked',
        'robust_blocked', 'robust_blocked', 'robust_blocked', 'robust_blocked',
      ],
    },
    earth: {
      az_deg: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
      el_deg: [
        8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5,
        8.5,
      ],
      radius_deg: [0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95],
      frac: [
        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        1.0,
      ],
      dist_km: [384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400, 384400],
      status: [
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
        'robust_visible', 'robust_visible', 'robust_visible', 'robust_visible',
      ],
    },
    dte: {
      station_visible: [
        [true], [true], [true], [true], [true], [true], [true], [true], [true], [true], [true], [true], [true], [true], [true],
        [true], [true], [true], [true],
      ],
      link_ok: [
        true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
        true, true, true, true,
      ],
    },
  },
};
