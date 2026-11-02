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
  source_label?: string;
  source_url?: string;
  retrieved_on?: string;
  notes?: string;
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
    wait_duration_h?: number;
    dark_exposure_h?: number;
    [key: string]: unknown;
  };
  alternatives: unknown[];
  explanation: string;
}

export interface DepartureEntry {
  departure_idx: number;
  departure_utc: string;
  feasible: boolean;
  arrival_idx?: number | null;
  arrival_utc?: string | null;
  duration_h?: number;
  dark_duration_h?: number;
  infeasible_reason?: string | null;
  path?: Array<{ x: number; y: number; t: number }>;
}

export interface DepartureMapResult {
  start_coord: [number, number];
  end_coord: [number, number];
  total_departures_evaluated: number;
  compute_time_s: number;
  earliest_feasible_idx: number | null;
  latest_safe_idx: number | null;
  lowest_dark_idx: number | null;
  earliest_feasible_utc: string | null;
  latest_safe_utc: string | null;
  lowest_dark_utc: string | null;
  plain_language_summary: string;
  departures: DepartureEntry[];
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


// Multi-Stop Mission Planner Types
export interface MissionStop {
  stop_id: string;
  name: string;
  coord: [number, number];
  dwell_time_h: number;
  min_sun_frac?: number;
  min_earth_frac?: number;
  min_earth_duration_h?: number;
  deadline_idx?: number;
  deadline_utc?: string;
}

export interface MissionLeg {
  leg_index: number;
  from_name: string;
  to_name: string;
  start_coord: [number, number];
  end_coord: [number, number];
  start_time_idx: number;
  end_time_idx: number;
  start_time_utc: string;
  end_time_utc: string;
  feasible: boolean;
  duration_h: number;
  distance_m: number;
  dark_duration_h?: number;
  path: Array<{ x: number; y: number; t: number }>;
  infeasible_reason: string | null;
}

export interface MissionDwell {
  stop_id: string;
  name: string;
  coord: [number, number];
  start_time_idx: number;
  end_time_idx: number;
  start_time_utc: string;
  end_time_utc: string;
  duration_h: number;
  min_sun_frac_observed: number;
  earth_contact_duration_h: number;
  sun_satisfied: boolean;
  earth_satisfied: boolean;
  deadline_satisfied: boolean;
  violations: string[];
}

export interface TimelineEvent {
  event_id: string;
  type: 'transit' | 'dwell' | 'wait';
  label: string;
  start_time_idx: number;
  end_time_idx: number;
  start_time_utc: string;
  end_time_utc: string;
  duration_h: number;
  sun_frac_min?: number;
  sun_frac_avg?: number;
  earth_frac_min?: number;
  earth_frac_avg?: number;
  violations: string[];
}

export interface PlanViolation {
  stop_index: number;
  stop_name: string;
  type: 'transit_infeasible' | 'insufficient_sun' | 'insufficient_earth_link' | 'deadline_missed';
  details: string;
}

export interface FixRecommendation {
  type: 'earlier_start' | 'shorter_dwell' | 'reorder_stops';
  description: string;
  delta_h?: number;
  stop_index?: number;
  stop_name?: string;
  new_dwell_h?: number;
  suggested_patch?: Record<string, unknown>;
}

export interface MissionPlanResult {
  mission_name: string;
  start_coord: [number, number];
  start_time_idx: number;
  start_time_utc: string;
  feasible: boolean;
  stops: MissionStop[];
  legs: MissionLeg[];
  dwells: MissionDwell[];
  timeline: TimelineEvent[];
  metrics: {
    total_distance_m: number;
    transit_duration_h: number;
    dwell_duration_h: number;
    total_duration_h: number;
    total_dark_duration_h: number;
    num_stops: number;
  };
  violations: PlanViolation[];
  fix_recommendation: FixRecommendation | null;
  limits_disclaimer: string;
}

export interface CostOfCaution {
  extra_distance_m: number;
  extra_duration_h: number;
  extra_wait_h: number;
  horizon_margin_deg: number;
  explanation: string;
}

export interface ConservativeComparisonResult {
  nominal: RouteResult;
  conservative: RouteResult;
  cost_of_caution: CostOfCaution;
}

export interface LandingDispersionPoint {
  point_id: number;
  offset_m: [number, number];
  dist_from_center_m: number;
  coord: [number, number];
  feasible: boolean;
  explanation: string;
  arrival_h: number | null;
  duration_h: number | null;
  dark_exposure_h: number | null;
  total_distance_m: number | null;
}

export interface LandingDispersionResult {
  nominal_coord: [number, number];
  goal_coord: [number, number];
  radius_m: number;
  num_points: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  min_arrival_h: number | null;
  max_arrival_h: number | null;
  nominal_arrival_h: number | null;
  min_dark_exposure_h: number | null;
  max_dark_exposure_h: number | null;
  solve_time_ms: number;
  plain_language_summary: string;
  assumption_note: string;
  points: LandingDispersionPoint[];
}

export type BacktestEventType =
  | 'sunset'
  | 'loss_of_sunlight'
  | 'earth_los'
  | 'loss_of_signal'
  | 'end_of_operations';

export type BacktestMatchStatus =
  | 'MATCH_WITHIN_UNCERTAINTY'
  | 'DISCREPANCY_EXPLAINED_BY_TERRAIN'
  | 'UNEXPLAINED_BY_GEOMETRY'
  | 'NO_PREDICTED_EVENT';

export interface ReportedEvent {
  id: string;
  name: string;
  event_type: BacktestEventType;
  time_utc: string;
  description: string;
  source_label: string;
  source_url: string;
  verified: boolean;
}

export interface BacktestUncertainty {
  terrain_resolution_h: number;
  landing_location_h: number;
  total_uncertainty_h: number;
}

export interface BacktestComparisonResult {
  event_id: string;
  event_name: string;
  reported_time_utc: string;
  predicted_time_utc: string | null;
  delta_hours: number | null;
  uncertainty: BacktestUncertainty;
  status: BacktestMatchStatus;
  geometry_explanation: string;
}

export interface BacktestCase {
  case_id: string;
  mission_name: string;
  site_id: string;
  landing_time_utc: string;
  landing_coord: {
    lat_deg: number;
    lon_deg: number;
    elev_m?: number;
  };
  landing_uncertainty_m: number;
  dem_resolution_m: number;
  reported_events: ReportedEvent[];
  disclaimer: string;
}

export interface BacktestAnalysis {
  case: BacktestCase;
  comparison_results: BacktestComparisonResult[];
  disclaimer: string;
  is_available: boolean;
}

export interface Scenario {
  version: string;
  site_id: string;
  start_date: string;
  end_date: string;
  min_sun_frac: number;
  min_earth_frac: number;
  mast_height_m: number;
  speed_m_s: number;
  max_slope_deg: number;
  allow_wait: boolean;
  mode: 'earliest-arrival' | 'min-dark' | 'latest-safe-departure';
  conservative: boolean;
  horizon_margin_deg: number;
  start_coord: [number, number];
  goal_coord: [number, number];
  data_version_hash?: string;
}

export interface ScenarioFile {
  schema_version: string;
  scenario_id: string;
  name: string;
  created_utc: string;
  data_version_hash: string;
  site_id: string;
  date_range: {
    start_utc: string;
    end_utc: string;
  };
  thresholds: {
    min_sun_frac: number;
    min_earth_frac: number;
  };
  mast_height_m: number;
  route_params: {
    speed_m_s: number;
    max_slope_deg: number;
    allow_wait: boolean;
    mode: string;
    conservative?: boolean;
    horizon_margin_deg?: number;
  };
  start_coord: [number, number];
  goal_coord: [number, number];
  provenance: {
    software_version: string;
    reference_frame: 'MOON_ME';
    dem_resolution_m?: number;
    kernel_set?: string;
  };
  metadata?: {
    description?: string;
    author?: string;
  };
}

export interface ScenarioComparison {
  parameter_differences: string[];
  metric_deltas: {
    delta_distance_m?: number;
    delta_duration_h?: number;
    delta_dark_h?: number;
    delta_wait_h?: number;
    summary: string;
  };
}

export interface RouteEvidenceData {
  title: string;
  short_provenance_hash: string;
  timestamp_utc: string;
  software_version: string;
  site_name: string;
  site_id: string;
  coordinates: {
    lat_deg: number;
    lon_deg: number;
    ground_elev_m: number;
  };
  assumptions: {
    mast_height_m: number;
    speed_m_s: number;
    max_slope_deg: number;
    min_sun_frac: number;
    min_earth_frac: number;
    conservative_mode: boolean;
    horizon_margin_deg: number;
    landing_dispersion_m: number;
  };
  data_and_kernels: {
    dem_dataset: string;
    dem_resolution_m: number;
    kernel_set: string;
    reference_frame: string;
  };
  outputs: {
    feasible: boolean;
    total_distance_m: number;
    duration_h: number;
    dark_exposure_h: number;
    wait_duration_h: number;
    start_time_utc: string;
    arrival_time_utc: string;
  };
  alternatives: {
    conservative_caution_distance_m?: number;
    conservative_caution_duration_h?: number;
    earliest_departure_utc?: string;
    latest_safe_departure_utc?: string;
  };
  limitations: string[];
}


