"""Statistical window analysis, event detection, and joint availability summaries for LightPath.

Rules & Non-Negotiables:
- Conforms strictly to schemas/stats.schema.json.
- Deterministic analysis: percentage time above, contiguous windows, longest outages, window counts.
- Joint availability: Sun + Earth line-of-sight, and Sun + Direct-To-Earth link contact.
- Event detection: sunrise, sunset, Earthrise, and Earthset from threshold crossings with times and azimuths.
- Darkness spells: longest continuous duration below solar threshold.
- summarize(series, thresholds) returns contract-compliant dictionary with thresholds always preserved.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence


def _to_dt(ts: str) -> datetime:
    """Parse ISO 8601 UTC timestamp."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)


def _calc_dur_h(start_ts: str, end_ts: str, steps: int, step_h: float) -> float:
    """Calculate duration in hours as end minus start."""
    try:
        t0 = _to_dt(start_ts)
        t1 = _to_dt(end_ts)
        return round(abs((t1 - t0).total_seconds()) / 3600.0, 2)
    except Exception:
        return round(steps * step_h, 2)


def _parse_step_hours(timestamps: Sequence[str]) -> float:
    """Calculate the step duration in hours from ISO 8601 timestamps."""
    if len(timestamps) < 2:
        return 1.0

    t0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00")).astimezone(timezone.utc)
    t1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00")).astimezone(timezone.utc)
    delta_s = abs((t1 - t0).total_seconds())
    return delta_s / 3600.0 if delta_s > 0 else 1.0


def compute_window_statistics(
    is_active_list: Sequence[bool],
    timestamps: Sequence[str],
    step_h: Optional[float] = None,
) -> Dict[str, Any]:
    """Analyze uptime, downtime, contiguous windows, and longest outage from boolean states.

    Every window is defined as [start, end) with end equal to the first sample time
    at which the condition fails (or the end of the analysis range), so duration equals
    end minus start.

    Args:
        is_active_list: Boolean array indicating condition met at each timestep.
        timestamps: ISO UTC strings corresponding to timesteps.
        step_h: Optional step duration in hours (inferred from timestamps if None).

    Returns:
        Dictionary containing:
            - 'uptime_fraction': float in [0.0, 1.0]
            - 'pct_time_above': float in [0.0, 100.0]
            - 'total_uptime_h': float
            - 'windows': list of {'start_utc', 'end_utc', 'duration_h', 'truncated_at_start', 'truncated_at_end'}
            - 'window_count': int
            - 'longest_window_h': float
            - 'longest_outage_h': float
    """
    total_steps = len(is_active_list)
    if total_steps == 0:
        return {
            "uptime_fraction": 0.0,
            "pct_time_above": 0.0,
            "total_uptime_h": 0.0,
            "windows": [],
            "window_count": 0,
            "longest_window_h": 0.0,
            "longest_outage_h": 0.0,
        }

    if step_h is None:
        step_h = _parse_step_hours(timestamps)

    windows: List[Dict[str, Any]] = []
    longest_window_h = 0.0
    longest_outage_h = 0.0

    current_state: Optional[bool] = None
    start_idx = 0

    for i, active in enumerate(is_active_list):
        if current_state is None:
            current_state = active
            start_idx = i
        elif active != current_state:
            # Segment completed: [start_idx, i)
            # End is the first sample time at which the condition fails / switches state
            dur_h = _calc_dur_h(timestamps[start_idx], timestamps[i], i - start_idx, step_h)
            if current_state:
                windows.append({
                    "start_utc": timestamps[start_idx],
                    "end_utc": timestamps[i],
                    "duration_h": dur_h,
                    "truncated_at_start": (start_idx == 0),
                    "truncated_at_end": False,
                })
                longest_window_h = max(longest_window_h, dur_h)
            else:
                longest_outage_h = max(longest_outage_h, dur_h)

            current_state = active
            start_idx = i

    # Final segment: reaches end of analysis range [start_idx, total_steps - 1]
    if current_state is not None:
        # Window end is the end of the analysis range: timestamps[-1]
        steps_final = max(0, total_steps - 1 - start_idx)
        dur_h = _calc_dur_h(timestamps[start_idx], timestamps[-1], steps_final, step_h)
        if current_state:
            windows.append({
                "start_utc": timestamps[start_idx],
                "end_utc": timestamps[-1],
                "duration_h": dur_h,
                "truncated_at_start": (start_idx == 0),
                "truncated_at_end": True,
            })
            longest_window_h = max(longest_window_h, dur_h)
        else:
            longest_outage_h = max(longest_outage_h, dur_h)

    total_uptime_h = round(sum(w["duration_h"] for w in windows), 2)
    total_range_h = _calc_dur_h(timestamps[0], timestamps[-1], total_steps - 1, step_h) if total_steps > 1 else 0.0
    uptime_fraction = round(total_uptime_h / total_range_h, 4) if total_range_h > 0 else 0.0
    pct_time_above = round(uptime_fraction * 100.0, 2)

    return {
        "uptime_fraction": uptime_fraction,
        "pct_time_above": pct_time_above,
        "total_uptime_h": total_uptime_h,
        "windows": windows,
        "window_count": len(windows),
        "longest_window_h": round(longest_window_h, 2),
        "longest_outage_h": round(longest_outage_h, 2),
    }


def compute_joint_availability(
    sun_active: Sequence[bool],
    earth_active: Sequence[bool],
    dte_link_ok: Optional[Sequence[bool]] = None,
) -> Dict[str, List[bool]]:
    """Compute joint boolean availability states.

    Returns:
        Dictionary with:
            - 'sun_and_earth': both Sun and Earth line-of-sight active.
            - 'sun_and_dte': Sun line-of-sight active AND DTE link OK.
    """
    sun_and_earth = [s and e for s, e in zip(sun_active, earth_active)]

    if dte_link_ok is not None:
        sun_and_dte = [s and d for s, d in zip(sun_active, dte_link_ok)]
    else:
        sun_and_dte = sun_and_earth

    return {
        "sun_and_earth": sun_and_earth,
        "sun_and_dte": sun_and_dte,
    }


def detect_events(
    series: Dict[str, Any],
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
) -> List[Dict[str, Any]]:
    """Detect sunrise, sunset, Earthrise, and Earthset events from threshold crossings.

    Records event type, exact time_utc, and topocentric azimuth in degrees.

    Args:
        series: Time-series dictionary containing 'time_utc', 'sun', and 'earth'.
        min_sun_frac: Solar visibility fraction threshold (default: 0.50).
        min_earth_frac: Earth visibility fraction threshold (default: 0.50).

    Returns:
        Chronologically sorted list of event dictionaries.
    """
    timestamps = series["time_utc"]
    num_steps = len(timestamps)
    if num_steps < 2:
        return []

    events: List[Dict[str, Any]] = []

    sun_frac = series["sun"]["frac"]
    sun_az = series["sun"]["az_deg"]
    earth_frac = series["earth"]["frac"]
    earth_az = series["earth"]["az_deg"]

    for i in range(1, num_steps):
        # 1. Solar crossings
        prev_sun = sun_frac[i - 1] >= min_sun_frac
        curr_sun = sun_frac[i] >= min_sun_frac

        if not prev_sun and curr_sun:
            events.append({
                "event": "sunrise",
                "time_utc": timestamps[i],
                "az_deg": float(sun_az[i]),
                "step_index": i,
                "fraction": float(sun_frac[i]),
            })
        elif prev_sun and not curr_sun:
            events.append({
                "event": "sunset",
                "time_utc": timestamps[i],
                "az_deg": float(sun_az[i]),
                "step_index": i,
                "fraction": float(sun_frac[i]),
            })

        # 2. Earth crossings
        prev_earth = earth_frac[i - 1] >= min_earth_frac
        curr_earth = earth_frac[i] >= min_earth_frac

        if not prev_earth and curr_earth:
            events.append({
                "event": "earthrise",
                "time_utc": timestamps[i],
                "az_deg": float(earth_az[i]),
                "step_index": i,
                "fraction": float(earth_frac[i]),
            })
        elif prev_earth and not curr_earth:
            events.append({
                "event": "earthset",
                "time_utc": timestamps[i],
                "az_deg": float(earth_az[i]),
                "step_index": i,
                "fraction": float(earth_frac[i]),
            })

    return events


def compute_darkness_spells(
    series: Dict[str, Any],
    min_sun_frac: float = 0.50,
) -> Dict[str, Any]:
    """Analyze contiguous periods of darkness where solar illumination is below threshold.

    Args:
        series: Time-series dictionary.
        min_sun_frac: Solar visibility threshold.

    Returns:
        Dictionary with:
            - 'longest_darkness_h': float
            - 'total_darkness_h': float
            - 'darkness_spells': list of {'start_utc', 'end_utc', 'duration_h'}
            - 'spell_count': int
    """
    timestamps = series["time_utc"]
    sun_frac = series["sun"]["frac"]
    step_h = _parse_step_hours(timestamps)

    is_dark = [f < min_sun_frac for f in sun_frac]
    darkness_stats = compute_window_statistics(is_dark, timestamps, step_h)

    return {
        "longest_darkness_h": darkness_stats["longest_window_h"],
        "total_darkness_h": darkness_stats["total_uptime_h"],
        "darkness_spells": darkness_stats["windows"],
        "spell_count": darkness_stats["window_count"],
    }


def summarize(
    series: Dict[str, Any],
    thresholds: Dict[str, float],
) -> Dict[str, Any]:
    """Generate the official stats summary conforming strictly to schemas/stats.schema.json.

    Args:
        series: Contract-compliant series dictionary.
        thresholds: Dictionary containing:
            - 'min_sun_frac': float in [0, 1]
            - 'min_earth_frac': float in [0, 1]
            - 'ground_station_mask_deg': float

    Returns:
        Stats dictionary conforming to schemas/stats.schema.json.
    """
    timestamps = series["time_utc"]
    step_h = _parse_step_hours(timestamps)

    min_sun = float(thresholds["min_sun_frac"])
    min_earth = float(thresholds["min_earth_frac"])
    mask_deg = float(thresholds["ground_station_mask_deg"])

    sun_active = [f >= min_sun for f in series["sun"]["frac"]]
    earth_active = [f >= min_earth for f in series["earth"]["frac"]]
    dte_active = list(series["dte"]["link_ok"])
    joint_active = [s and d for s, d in zip(sun_active, dte_active)]

    def _to_contract_category(stats: Dict[str, Any]) -> Dict[str, Any]:
        """Strip helper fields to strictly match schemas/stats.schema.json category_stats."""
        return {
            "uptime_fraction": stats["uptime_fraction"],
            "total_uptime_h": stats["total_uptime_h"],
            "windows": stats["windows"],
            "longest_window_h": stats["longest_window_h"],
            "longest_outage_h": stats["longest_outage_h"],
        }

    res_thresholds = {
        "min_sun_frac": min_sun,
        "min_earth_frac": min_earth,
        "ground_station_mask_deg": mask_deg,
    }
    if "margin_deg" in thresholds:
        res_thresholds["margin_deg"] = float(thresholds["margin_deg"])

    return {
        "thresholds": res_thresholds,
        "sun": _to_contract_category(compute_window_statistics(sun_active, timestamps, step_h)),
        "earth": _to_contract_category(compute_window_statistics(earth_active, timestamps, step_h)),
        "dte": _to_contract_category(compute_window_statistics(dte_active, timestamps, step_h)),
        "joint": _to_contract_category(compute_window_statistics(joint_active, timestamps, step_h)),
    }
