/**
 * Strict TypeScript types conforming to schemas/*.schema.json.
 */

export interface Site {
  id: string;
  name: string;
  mission_ids: string[];
  lat_deg: number;
  lon_deg: number;
  ground_elev_m: number;
  source_links: string[];
  verified: boolean;
  is_synthetic: boolean;
}

export interface Horizon {
  az_step_deg: number;
  heights_m: number[];
  el_deg: number[][];
  nan_fraction: number[][];
  flags: string[];
}

export interface Series {
  time_utc: string[];
  sun: {
    az_deg: number[];
    el_deg: number[];
    radius_deg: number[];
    frac: number[];
    status: ('robust_visible' | 'marginal' | 'robust_blocked')[];
  };
  earth: {
    az_deg: number[];
    el_deg: number[];
    radius_deg: number[];
    frac: number[];
    status: ('robust_visible' | 'marginal' | 'robust_blocked')[];
    dist_km: number[];
  };
  dte: {
    station_names?: string[];
    station_visible: boolean[][];
    link_ok: boolean[];
  };
}

export interface CategoryStats {
  uptime_fraction: number;
  total_uptime_h: number;
  windows: Array<{
    start_utc: string;
    end_utc: string;
    duration_h: number;
  }>;
  longest_window_h: number;
  longest_outage_h: number;
}

export interface Stats {
  thresholds: {
    min_sun_frac: number;
    min_earth_frac: number;
    ground_station_mask_deg: number;
  };
  sun: CategoryStats;
  earth: CategoryStats;
  dte: CategoryStats;
  joint: CategoryStats;
}

export interface VisibilityCube {
  grid: {
    origin: [number, number];
    spacing_m: number;
    nx: number;
    ny: number;
  };
  time_utc: string[];
  sun_frac: number[][][]; // [t][y][x] uint8 0-100
  earth_frac: number[][][];
  slope_deg: number[][];
  traversable: boolean[][];
  flags: string[];
}

export interface RouteResult {
  mode: 'rover' | 'crew' | 'static_stay';
  params: {
    start_coord: [number, number];
    end_coord: [number, number];
    start_time_idx: number;
    speed_m_s: number;
    max_slope_deg: number;
    min_sun_frac: number;
    min_earth_frac: number;
    [key: string]: unknown;
  };
  feasible: boolean;
  path: Array<{
    x: number;
    y: number;
    t: number;
    [key: string]: unknown;
  }>;
  metrics: {
    total_distance_m: number;
    duration_h: number;
    average_slope_deg: number;
    max_slope_deg: number;
    min_sun_frac_observed: number;
    min_earth_frac_observed: number;
    [key: string]: unknown;
  };
  alternatives: unknown[];
  explanation: string;
}

export interface Provenance {
  datasets: Array<{
    name: string;
    version: string;
    source_url: string;
    [key: string]: unknown;
  }>;
  kernels: Array<{
    name: string;
    checksum: string;
    [key: string]: unknown;
  }>;
  parameters: Record<string, unknown>;
  tolerances: Record<string, number>;
  tests_summary: {
    tests_passed: number;
    tests_total: number;
    last_verified_utc: string;
    [key: string]: unknown;
  };
}

export interface RunInfo {
  created_utc: string;
  git_commit: string;
  software_versions: Record<string, string>;
}
