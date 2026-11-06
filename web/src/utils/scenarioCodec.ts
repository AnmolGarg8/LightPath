import { RouteResult, Scenario, ScenarioComparison, ScenarioFile } from '../types';

export const HASH_REGEX = /^[a-zA-Z0-9-]+$/;
export const MAX_HASH_LENGTH = 220;

function floatToSlug(val: number): string {
  const rounded = Number(val.toFixed(4));
  return String(rounded).replace('.', '-');
}

function slugToFloat(slug: string): number {
  return parseFloat(slug.replace('-', '.'));
}

function compactDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function expandDate(compact: string): string {
  if (compact.length === 8 && /^\d+$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return compact;
}

export function encodeScenarioHash(scenario: Scenario): string {
  const sunPct = Math.round(scenario.min_sun_frac * 100);
  const earthPct = Math.round(scenario.min_earth_frac * 100);
  const waitFlag = scenario.allow_wait ? 1 : 0;
  const consFlag = scenario.conservative ? 1 : 0;

  const parts = [
    scenario.version || 'v1',
    'site',
    scenario.site_id,
    'start',
    compactDate(scenario.start_date),
    'end',
    compactDate(scenario.end_date),
    'sun',
    String(sunPct),
    'earth',
    String(earthPct),
    'mast',
    floatToSlug(scenario.mast_height_m),
    'speed',
    floatToSlug(scenario.speed_m_s),
    'slope',
    floatToSlug(scenario.max_slope_deg),
    'wait',
    String(waitFlag),
    'mode',
    scenario.mode,
    'cons',
    String(consFlag),
    'margin',
    floatToSlug(scenario.horizon_margin_deg),
    'sx',
    String(scenario.start_coord[0]),
    'sy',
    String(scenario.start_coord[1]),
    'gx',
    String(scenario.goal_coord[0]),
    'gy',
    String(scenario.goal_coord[1]),
  ];

  const slug = parts.join('-');
  if (!HASH_REGEX.test(slug)) {
    throw new Error(`Encoding error: generated slug '${slug}' violates letters, digits, and hyphens constraint.`);
  }
  return slug;
}

export function decodeScenarioHash(hashStr: string): { scenario: Scenario | null; error: string | null } {
  if (!hashStr || !hashStr.trim()) {
    return { scenario: null, error: 'Malformed scenario link: Hash string is empty.' };
  }

  const cleanHash = hashStr.trim().replace(/^#\/?/, '').replace(/^scenario\//, '');

  if (!HASH_REGEX.test(cleanHash)) {
    return {
      scenario: null,
      error:
        'Malformed scenario link: Address hash contains illegal characters. Only plain letters, digits, and hyphens are permitted.',
    };
  }

  const tokens = cleanHash.split('-');
  if (tokens.length < 2 || !tokens[0].startsWith('v')) {
    return {
      scenario: null,
      error: `Malformed scenario link: Missing or invalid version prefix in '${cleanHash}'. Expected 'v1'.`,
    };
  }

  const version = tokens[0];
  if (version !== 'v1') {
    return {
      scenario: null,
      error: `Malformed scenario link: Unsupported scenario version '${version}'. Expected 'v1'.`,
    };
  }

  const knownKeys = new Set([
    'site',
    'start',
    'end',
    'sun',
    'earth',
    'mast',
    'speed',
    'slope',
    'wait',
    'mode',
    'cons',
    'margin',
    'sx',
    'sy',
    'gx',
    'gy',
  ]);

  const params: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValParts: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (knownKeys.has(token)) {
      if (currentKey !== null) {
        params[currentKey] = currentValParts.join('-');
      }
      currentKey = token;
      currentValParts = [];
    } else {
      currentValParts.push(token);
    }
  }

  if (currentKey !== null) {
    params[currentKey] = currentValParts.join('-');
  }

  const requiredKeys = ['site', 'start', 'end', 'sun', 'earth', 'mast', 'speed', 'slope', 'sx', 'sy', 'gx', 'gy'];
  for (const rk of requiredKeys) {
    if (!params[rk]) {
      return {
        scenario: null,
        error: `Malformed scenario link: Missing required parameter '${rk}' in scenario URL hash.`,
      };
    }
  }

  try {
    const sunPct = parseFloat(params.sun);
    const earthPct = parseFloat(params.earth);
    const mastM = slugToFloat(params.mast);
    const speedMS = slugToFloat(params.speed);
    const slopeDeg = slugToFloat(params.slope);
    const waitVal = params.wait === '1';
    const modeVal = (params.mode as Scenario['mode']) || 'earliest-arrival';
    const consVal = params.cons === '1';
    const marginDeg = params.margin ? slugToFloat(params.margin) : 0.0;
    const sx = parseInt(params.sx, 10);
    const sy = parseInt(params.sy, 10);
    const gx = parseInt(params.gx, 10);
    const gy = parseInt(params.gy, 10);

    if (isNaN(sunPct) || isNaN(earthPct) || isNaN(mastM) || isNaN(speedMS) || isNaN(slopeDeg) || isNaN(sx) || isNaN(sy) || isNaN(gx) || isNaN(gy)) {
      return {
        scenario: null,
        error: 'Malformed scenario link: One or more numerical parameters could not be parsed.',
      };
    }

    const scenario: Scenario = {
      version,
      site_id: params.site,
      start_date: expandDate(params.start),
      end_date: expandDate(params.end),
      min_sun_frac: Number((sunPct / 100.0).toFixed(2)),
      min_earth_frac: Number((earthPct / 100.0).toFixed(2)),
      mast_height_m: mastM,
      speed_m_s: speedMS,
      max_slope_deg: slopeDeg,
      allow_wait: waitVal,
      mode: modeVal,
      conservative: consVal,
      horizon_margin_deg: marginDeg,
      start_coord: [sx, sy],
      goal_coord: [gx, gy],
    };

    return { scenario, error: null };
  } catch (err) {
    return {
      scenario: null,
      error: `Malformed scenario link: Exception parsing parameters (${err instanceof Error ? err.message : String(err)}).`,
    };
  }
}

export function isHashTooLong(hashStr: string): boolean {
  return hashStr.length > MAX_HASH_LENGTH;
}

export function exportScenarioJson(
  scenario: Scenario,
  currentDataHash = '9f8e21a0',
  scenarioName = 'Exported Lunar Traverse Scenario'
): string {
  const fileData: ScenarioFile = {
    schema_version: 'v1',
    scenario_id: `scen-${compactDate(scenario.start_date)}-${scenario.site_id}`,
    name: scenarioName,
    created_utc: new Date().toISOString(),
    data_version_hash: currentDataHash,
    site_id: scenario.site_id,
    date_range: {
      start_utc: `${scenario.start_date}T00:00:00Z`,
      end_utc: `${scenario.end_date}T00:00:00Z`,
    },
    thresholds: {
      min_sun_frac: scenario.min_sun_frac,
      min_earth_frac: scenario.min_earth_frac,
    },
    mast_height_m: scenario.mast_height_m,
    route_params: {
      speed_m_s: scenario.speed_m_s,
      max_slope_deg: scenario.max_slope_deg,
      allow_wait: scenario.allow_wait,
      mode: scenario.mode,
      conservative: scenario.conservative,
      horizon_margin_deg: scenario.horizon_margin_deg,
    },
    start_coord: scenario.start_coord,
    goal_coord: scenario.goal_coord,
    provenance: {
      software_version: 'LightPath v0.1.0-deterministic',
      reference_frame: 'MOON_ME',
      dem_resolution_m: 20.0,
      kernel_set: 'generic_kernels/de421',
    },
    metadata: {
      description: `Reproducible traverse scenario for ${scenario.site_id} (${scenario.start_date} to ${scenario.end_date})`,
    },
  };

  return JSON.stringify(fileData, null, 2);
}

export function importScenarioJson(
  jsonStr: string,
  currentDataHash = '9f8e21a0'
): { scenario: Scenario | null; warning: string | null; error: string | null } {
  try {
    const data = JSON.parse(jsonStr) as ScenarioFile;

    if (!data.site_id || !data.start_coord || !data.goal_coord || !data.route_params) {
      return {
        scenario: null,
        warning: null,
        error: 'Invalid scenario file: Missing required fields (site_id, start_coord, goal_coord, route_params).',
      };
    }

    let warning: string | null = null;
    if (data.data_version_hash && currentDataHash && data.data_version_hash !== currentDataHash) {
      warning = `Data version mismatch: Scenario was created with data version '${data.data_version_hash}', but current environment is running data version '${currentDataHash}'. Recomputed elevation profiles and traverse durations may differ due to updated DEM or SPICE kernels.`;
    }

    const startDate = (data.date_range?.start_utc || '2026-11-01').split('T')[0];
    const endDate = (data.date_range?.end_utc || '2026-11-08').split('T')[0];

    const scenario: Scenario = {
      version: data.schema_version || 'v1',
      site_id: data.site_id,
      start_date: startDate,
      end_date: endDate,
      min_sun_frac: data.thresholds?.min_sun_frac ?? 0.5,
      min_earth_frac: data.thresholds?.min_earth_frac ?? 0.5,
      mast_height_m: data.mast_height_m ?? 2.0,
      speed_m_s: data.route_params?.speed_m_s ?? 0.05,
      max_slope_deg: data.route_params?.max_slope_deg ?? 15.0,
      allow_wait: data.route_params?.allow_wait ?? true,
      mode: (data.route_params?.mode as Scenario['mode']) || 'earliest-arrival',
      conservative: data.route_params?.conservative ?? false,
      horizon_margin_deg: data.route_params?.horizon_margin_deg ?? 0.0,
      start_coord: data.start_coord,
      goal_coord: data.goal_coord,
      data_version_hash: data.data_version_hash,
    };

    return { scenario, warning, error: null };
  } catch (err) {
    return {
      scenario: null,
      warning: null,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function compareScenarios(
  scenA: Scenario,
  scenB: Scenario,
  resA?: RouteResult | null,
  resB?: RouteResult | null
): ScenarioComparison {
  const differences: string[] = [];

  if (scenA.site_id !== scenB.site_id) {
    differences.push(`Target site changed from '${scenA.site_id}' to '${scenB.site_id}'`);
  }
  if (scenA.start_date !== scenB.start_date || scenA.end_date !== scenB.end_date) {
    differences.push(`Mission window changed (${scenA.start_date}..${scenA.end_date} vs ${scenB.start_date}..${scenB.end_date})`);
  }
  if (scenA.mast_height_m !== scenB.mast_height_m) {
    const deltaM = scenB.mast_height_m - scenA.mast_height_m;
    differences.push(`Mast height delta: ${deltaM > 0 ? '+' : ''}${deltaM.toFixed(1)} m (${scenA.mast_height_m} m vs ${scenB.mast_height_m} m)`);
  }
  if (scenA.speed_m_s !== scenB.speed_m_s) {
    const deltaSpeed = scenB.speed_m_s - scenA.speed_m_s;
    differences.push(`Traverse speed delta: ${deltaSpeed > 0 ? '+' : ''}${deltaSpeed.toFixed(3)} m/s`);
  }
  if (scenA.max_slope_deg !== scenB.max_slope_deg) {
    const deltaSlope = scenB.max_slope_deg - scenA.max_slope_deg;
    differences.push(`Max slope limit delta: ${deltaSlope > 0 ? '+' : ''}${deltaSlope.toFixed(1)} deg`);
  }
  if (scenA.conservative !== scenB.conservative || scenA.horizon_margin_deg !== scenB.horizon_margin_deg) {
    differences.push(`Conservative margin changed from ${scenA.horizon_margin_deg}° to ${scenB.horizon_margin_deg}°`);
  }
  if (
    scenA.start_coord[0] !== scenB.start_coord[0] ||
    scenA.start_coord[1] !== scenB.start_coord[1] ||
    scenA.goal_coord[0] !== scenB.goal_coord[0] ||
    scenA.goal_coord[1] !== scenB.goal_coord[1]
  ) {
    differences.push(
      `Waypoints changed: Start [${scenA.start_coord}]->[${scenB.start_coord}], Goal [${scenA.goal_coord}]->[${scenB.goal_coord}]`
    );
  }

  let deltaDistM: number | undefined;
  let deltaDurH: number | undefined;
  let deltaDarkH: number | undefined;
  let deltaWaitH: number | undefined;
  let summary = 'No calculated routes provided for metric delta comparison.';

  if (resA?.feasible && resB?.feasible) {
    const mA = resA.metrics;
    const mB = resB.metrics;
    deltaDistM = Number((mB.total_distance_m - mA.total_distance_m).toFixed(1));
    deltaDurH = Number((mB.duration_h - mA.duration_h).toFixed(2));
    deltaDarkH = Number(((mB.dark_exposure_h ?? 0) - (mA.dark_exposure_h ?? 0)).toFixed(2));
    deltaWaitH = Number(((mB.wait_duration_h ?? 0) - (mA.wait_duration_h ?? 0)).toFixed(2));

    summary = `Scenario B requires ${deltaDistM > 0 ? '+' : ''}${deltaDistM.toFixed(1)} m distance, ${
      deltaDurH > 0 ? '+' : ''
    }${deltaDurH.toFixed(2)} h duration, and ${deltaWaitH > 0 ? '+' : ''}${deltaWaitH.toFixed(
      2
    )} h waiting relative to Scenario A.`;
  } else if (resA && resB) {
    summary = `Feasibility difference: Scenario A=${resA.feasible ? 'FEASIBLE' : 'INFEASIBLE'}, Scenario B=${
      resB.feasible ? 'FEASIBLE' : 'INFEASIBLE'
    }.`;
  }

  return {
    parameter_differences: differences,
    metric_deltas: {
      delta_distance_m: deltaDistM,
      delta_duration_h: deltaDurH,
      delta_dark_h: deltaDarkH,
      delta_wait_h: deltaWaitH,
      summary,
    },
  };
}

export function buildRouteEvidenceData(
  scenario: Scenario,
  routeResult: RouteResult,
  siteName = 'Shackleton Connecting Ridge',
  siteCoords = { lat_deg: -89.78, lon_deg: 120.0, ground_elev_m: 1850.0 },
  conservativeCaution?: { extra_distance_m: number; extra_duration_h: number },
  departureBounds?: { earliest_utc?: string; latest_safe_utc?: string }
) {
  const provHash = (scenario.data_version_hash || '9F8E21A0').slice(0, 8).toUpperCase();
  const metrics = routeResult.metrics;

  return {
    title: `Lunar Surface Traverse: ${siteName} (${scenario.mode})`,
    short_provenance_hash: provHash,
    timestamp_utc: new Date().toISOString(),
    software_version: 'LightPath v0.1.0-deterministic',
    site_name: siteName,
    site_id: scenario.site_id,
    coordinates: siteCoords,
    assumptions: {
      mast_height_m: scenario.mast_height_m,
      speed_m_s: scenario.speed_m_s,
      max_slope_deg: scenario.max_slope_deg,
      min_sun_frac: scenario.min_sun_frac,
      min_earth_frac: scenario.min_earth_frac,
      conservative_mode: scenario.conservative,
      horizon_margin_deg: scenario.horizon_margin_deg,
      landing_dispersion_m: 250,
    },
    data_and_kernels: {
      dem_dataset: 'LRO LOLA South Pole Elevation Model (20 m/pixel)',
      dem_resolution_m: 20.0,
      kernel_set: 'NAIF Generic Kernels (de421, pck00010.tpc, naif0012.tls)',
      reference_frame: 'MOON_ME',
    },
    outputs: {
      feasible: routeResult.feasible,
      total_distance_m: metrics.total_distance_m,
      duration_h: metrics.duration_h,
      dark_exposure_h: metrics.dark_exposure_h ?? 0.0,
      wait_duration_h: metrics.wait_duration_h ?? 0.0,
      start_time_utc: `${scenario.start_date}T00:00:00Z`,
      arrival_time_utc: `${scenario.start_date}T${Math.floor(metrics.duration_h)
        .toString()
        .padStart(2, '0')}:${Math.floor((metrics.duration_h % 1) * 60)
        .toString()
        .padStart(2, '0')}:00Z`,
    },
    alternatives: {
      conservative_caution_distance_m: conservativeCaution?.extra_distance_m,
      conservative_caution_duration_h: conservativeCaution?.extra_duration_h,
      earliest_departure_utc: departureBounds?.earliest_utc,
      latest_safe_departure_utc: departureBounds?.latest_safe_utc,
    },
    limitations: [
      'Line-of-sight celestial and terrain geometry only; does not model electrical power or RF link budgets.',
      'Does not model rover battery degradation, thermal state, soil slip, or local rocks smaller than DEM cell size.',
      'Preliminary mission planning tool; not certified for flight operations.',
    ],
  };
}

