"""Time-series generation and window statistics for LightPath.

Rules:
- Conforms to schemas/series.schema.json and schemas/stats.schema.json.
- Deterministic, topocentric, exact curvature.
- Status values: robust_visible, marginal, robust_blocked.
- Window analysis for Sun, Earth, DTE, and Joint Light & Link.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from pipeline.constants import (
    DEFAULT_EARTH_GROUND_STATION_MASK_DEG,
    DEFAULT_MIN_EARTH_FRAC,
    DEFAULT_MIN_SUN_FRAC,
)
from pipeline.disc import (
    classify_visibility_status,
    compute_flat_horizon_disc_fraction,
    compute_variable_horizon_disc_fraction,
)
from pipeline.ephemeris import (
    check_dsn_ground_station_visibility,
    compute_topocentric_earth_state,
    compute_topocentric_sun_state,
)
from pipeline.horizon import HorizonProfile


def generate_time_steps(
    start_utc_iso: str,
    end_utc_iso: str,
    step_minutes: int = 60,
) -> List[str]:
    """Generate a list of ISO 8601 UTC timestamp strings.

    Args:
        start_utc_iso: Start timestamp, e.g. '2026-11-01T00:00:00Z'.
        end_utc_iso: End timestamp, e.g. '2026-11-15T00:00:00Z'.
        step_minutes: Interval in minutes (default 60).

    Returns:
        List of formatted ISO strings.
    """
    dt_start = datetime.fromisoformat(start_utc_iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    dt_end = datetime.fromisoformat(end_utc_iso.replace("Z", "+00:00")).astimezone(timezone.utc)

    if dt_end <= dt_start:
        raise ValueError(f"end_utc_iso ({end_utc_iso}) must be after start_utc_iso ({start_utc_iso})")
    if step_minutes <= 0:
        raise ValueError(f"step_minutes must be > 0, got {step_minutes}")

    delta = timedelta(minutes=step_minutes)
    current = dt_start
    timestamps: List[str] = []

    while current <= dt_end:
        timestamps.append(current.strftime("%Y-%m-%dT%H:%M:%SZ"))
        current += delta

    return timestamps


def compute_series_and_stats(
    site_lat_deg: float,
    site_lon_deg: float,
    site_ground_elev_m: float,
    horizon_profile: HorizonProfile,
    timestamps: List[str],
    observer_height_m: float = 2.0,
    min_sun_frac: float = DEFAULT_MIN_SUN_FRAC,
    min_earth_frac: float = DEFAULT_MIN_EARTH_FRAC,
    ground_station_mask_deg: float = DEFAULT_EARTH_GROUND_STATION_MASK_DEG,
    use_variable_horizon_disc: bool = True,
) -> Tuple[Dict, Dict]:
    """Compute the time series and statistics for a lunar site.

    Returns:
        Tuple[series_dict, stats_dict] conforming to schemas/series.schema.json
        and schemas/stats.schema.json.
    """
    num_steps = len(timestamps)
    if num_steps == 0:
        raise ValueError("timestamps list cannot be empty")

    sun_az = []
    sun_el = []
    sun_radius = []
    sun_frac = []
    sun_status = []

    earth_az = []
    earth_el = []
    earth_radius = []
    earth_frac = []
    earth_status = []
    earth_dist = []

    station_names = []
    station_visible_list = []
    link_ok_list = []

    for idx, ts in enumerate(timestamps):
        # 1. Topocentric Sun
        sun_state = compute_topocentric_sun_state(
            iso_utc_str=ts,
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elev_m=site_ground_elev_m,
            observer_height_m=observer_height_m,
        )
        sun_az.append(round(sun_state.az_deg, 3))
        sun_el.append(round(sun_state.el_deg, 3))
        sun_radius.append(round(sun_state.radius_deg, 4))

        # Horizon at Sun azimuth
        if use_variable_horizon_disc:
            def sun_horiz_fn(az: float) -> float:
                return horizon_profile.get_elevation_deg(az, height_m=observer_height_m)

            s_frac = compute_variable_horizon_disc_fraction(
                body_az_deg=sun_state.az_deg,
                body_el_deg=sun_state.el_deg,
                angular_radius_deg=sun_state.radius_deg,
                horizon_el_fn=sun_horiz_fn,
            )
        else:
            h_sun = horizon_profile.get_elevation_deg(sun_state.az_deg, height_m=observer_height_m)
            s_frac = float(compute_flat_horizon_disc_fraction(sun_state.el_deg - h_sun, sun_state.radius_deg))

        sun_frac.append(round(s_frac, 4))
        sun_status.append(classify_visibility_status(s_frac, threshold=min_sun_frac))

        # 2. Topocentric Earth
        earth_state = compute_topocentric_earth_state(
            iso_utc_str=ts,
            site_lat_deg=site_lat_deg,
            site_lon_deg=site_lon_deg,
            site_elev_m=site_ground_elev_m,
            observer_height_m=observer_height_m,
        )
        earth_az.append(round(earth_state.az_deg, 3))
        earth_el.append(round(earth_state.el_deg, 3))
        earth_radius.append(round(earth_state.radius_deg, 4))
        earth_dist.append(round(earth_state.dist_km, 1))

        # Horizon at Earth azimuth
        if use_variable_horizon_disc:
            def earth_horiz_fn(az: float) -> float:
                return horizon_profile.get_elevation_deg(az, height_m=observer_height_m)

            e_frac = compute_variable_horizon_disc_fraction(
                body_az_deg=earth_state.az_deg,
                body_el_deg=earth_state.el_deg,
                angular_radius_deg=earth_state.radius_deg,
                horizon_el_fn=earth_horiz_fn,
            )
        else:
            h_earth = horizon_profile.get_elevation_deg(earth_state.az_deg, height_m=observer_height_m)
            e_frac = float(compute_flat_horizon_disc_fraction(earth_state.el_deg - h_earth, earth_state.radius_deg))

        earth_frac.append(round(e_frac, 4))
        earth_status.append(classify_visibility_status(e_frac, threshold=min_earth_frac))

        # 3. Direct-To-Earth (DTE) Ground Stations
        st_names, st_vis = check_dsn_ground_station_visibility(
            iso_utc_str=ts,
            station_mask_el_deg=ground_station_mask_deg,
        )
        if idx == 0:
            station_names = st_names
        station_visible_list.append(st_vis)

        # Link is OK if Earth terrain fraction >= threshold AND at least one Earth station sees Moon
        link_ok = (e_frac >= min_earth_frac) and any(st_vis)
        link_ok_list.append(link_ok)

    series_dict = {
        "time_utc": timestamps,
        "sun": {
            "az_deg": sun_az,
            "el_deg": sun_el,
            "radius_deg": sun_radius,
            "frac": sun_frac,
            "status": sun_status,
        },
        "earth": {
            "az_deg": earth_az,
            "el_deg": earth_el,
            "radius_deg": earth_radius,
            "frac": earth_frac,
            "status": earth_status,
            "dist_km": earth_dist,
        },
        "dte": {
            "station_names": station_names,
            "station_visible": station_visible_list,
            "link_ok": link_ok_list,
        },
    }

    # Step duration in hours
    if len(timestamps) > 1:
        dt0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        dt1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00"))
        step_h = (dt1 - dt0).total_seconds() / 3600.0
    else:
        step_h = 1.0

    # Boolean arrays for statistics
    sun_active = [f >= min_sun_frac for f in sun_frac]
    earth_active = [f >= min_earth_frac for f in earth_frac]
    dte_active = link_ok_list
    joint_active = [s and d for s, d in zip(sun_active, dte_active)]

    stats_dict = {
        "thresholds": {
            "min_sun_frac": min_sun_frac,
            "min_earth_frac": min_earth_frac,
            "ground_station_mask_deg": ground_station_mask_deg,
        },
        "sun": compute_window_stats(sun_active, timestamps, step_h),
        "earth": compute_window_stats(earth_active, timestamps, step_h),
        "dte": compute_window_stats(dte_active, timestamps, step_h),
        "joint": compute_window_stats(joint_active, timestamps, step_h),
    }

    return series_dict, stats_dict


def compute_window_stats(
    is_active_list: List[bool],
    timestamps: List[str],
    step_h: float,
) -> Dict:
    """Analyze uptime, downtime, contiguous windows, and longest outage from boolean states.

    Args:
        is_active_list: Boolean array indicating condition met at each timestep.
        timestamps: ISO UTC strings corresponding to timesteps.
        step_h: Duration of each step in hours.

    Returns:
        Dict matching category_stats in schemas/stats.schema.json.
    """
    total_steps = len(is_active_list)
    active_count = sum(1 for a in is_active_list if a)
    total_uptime_h = round(active_count * step_h, 2)
    uptime_fraction = round(active_count / total_steps, 4) if total_steps > 0 else 0.0

    windows: List[Dict] = []
    longest_window_h = 0.0
    longest_outage_h = 0.0

    current_state: Optional[bool] = None
    start_idx = 0

    for i, active in enumerate(is_active_list):
        if current_state is None:
            current_state = active
            start_idx = i
        elif active != current_state:
            # End of previous segment
            seg_len = i - start_idx
            dur_h = round(seg_len * step_h, 2)
            if current_state:
                windows.append({
                    "start_utc": timestamps[start_idx],
                    "end_utc": timestamps[i - 1],
                    "duration_h": dur_h,
                })
                longest_window_h = max(longest_window_h, dur_h)
            else:
                longest_outage_h = max(longest_outage_h, dur_h)

            current_state = active
            start_idx = i

    # Handle final segment
    if current_state is not None:
        seg_len = total_steps - start_idx
        dur_h = round(seg_len * step_h, 2)
        if current_state:
            windows.append({
                "start_utc": timestamps[start_idx],
                "end_utc": timestamps[-1],
                "duration_h": dur_h,
            })
            longest_window_h = max(longest_window_h, dur_h)
        else:
            longest_outage_h = max(longest_outage_h, dur_h)

    return {
        "uptime_fraction": uptime_fraction,
        "total_uptime_h": total_uptime_h,
        "windows": windows,
        "longest_window_h": round(longest_window_h, 2),
        "longest_outage_h": round(longest_outage_h, 2),
    }
