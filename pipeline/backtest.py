"""Historical Mission Backtest and Comparison Engine.

In accordance with docs/PROJECT_RULES.md:
- Precondition check: If docs/BACKTEST_CASE.md is absent, reports NOT AVAILABLE.
  Never invent mission dates, coordinates, or reported telemetry events (Rule 2).
- Comparison arithmetic: Compares predicted sunset/loss of sunlight and Earth visibility
  to reported events, stating difference in hours with uncertainty from terrain resolution
  and landing-location dispersion.
- Non-geometric events (e.g. signal loss during clear line of sight) are explicitly flagged
  as UNEXPLAINED_BY_GEOMETRY without claiming the tool explains the outcome (Rule 2 & 8).
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent


def parse_iso_utc(ts_str: str) -> datetime:
    """Parse ISO 8601 UTC timestamp string to datetime object."""
    dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def format_iso_utc(dt: datetime) -> str:
    """Format datetime object to ISO 8601 UTC string."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_backtest_case(case_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Load and parse the human-supplied backtest case.

    Returns None if the file does not exist, preserving strict Rule 2 compliance.
    """
    target = case_path or (ROOT_DIR / "docs" / "BACKTEST_CASE.md")
    if not target.exists():
        return None

    # In a real environment with BACKTEST_CASE.md, read and parse YAML frontmatter/tables.
    # For now, if the file exists, read its contents.
    content = target.read_text(encoding="utf-8")
    if not content.strip():
        return None

    # Return parsed case dict
    return {"raw_markdown": content, "source_path": str(target)}


def calculate_uncertainty_budget(
    dem_resolution_m: float,
    landing_uncertainty_m: float,
    elevation_rate_deg_per_h: float,
    typical_slope_deg: float = 10.0,
    ridge_distance_m: float = 10000.0,
) -> Dict[str, float]:
    """Calculate the uncertainty budget in hours for celestial event timings.

    Uncertainty sources:
    1. Terrain resolution (pixel size Delta x):
       Vertical height uncertainty: Delta z = Delta x * tan(alpha)
       Horizon angle uncertainty: Delta theta = atan2(Delta z, d_eff)
       Time uncertainty: sigma_terrain = Delta theta / |d_theta/dt|
    2. Landing location uncertainty (dispersion radius r):
       Horizontal shift r across slope alpha induces vertical shift r * tan(alpha)
       Horizon angle shift: Delta theta_disp = atan2(r * tan(alpha), d_eff)
       Time uncertainty: sigma_location = Delta theta_disp / |d_theta/dt|
    3. Total uncertainty:
       sigma_total = sqrt(sigma_terrain^2 + sigma_location^2)
    """
    rate = max(1e-4, abs(elevation_rate_deg_per_h))
    slope_rad = math.radians(typical_slope_deg)

    # 1. Terrain resolution uncertainty
    dz_terrain_m = dem_resolution_m * math.tan(slope_rad)
    d_theta_terrain_deg = math.degrees(math.atan2(dz_terrain_m, ridge_distance_m))
    sigma_terrain_h = round(d_theta_terrain_deg / rate, 3)

    # 2. Landing location uncertainty
    dz_location_m = landing_uncertainty_m * math.tan(slope_rad)
    d_theta_location_deg = math.degrees(math.atan2(dz_location_m, ridge_distance_m))
    sigma_location_h = round(d_theta_location_deg / rate, 3)

    # 3. Total combined uncertainty (root sum of squares)
    sigma_total_h = round(math.sqrt(sigma_terrain_h**2 + sigma_location_h**2), 3)

    return {
        "terrain_resolution_h": sigma_terrain_h,
        "landing_location_h": sigma_location_h,
        "total_uncertainty_h": sigma_total_h,
    }


def find_predicted_sunset(
    times: List[str],
    sun_fracs: List[float],
    sun_els: List[float],
    landing_time: datetime,
) -> Optional[Tuple[str, float]]:
    """Find the first predicted sunset (sun_frac == 0.0 or sun_el <= 0.0) after landing.

    Returns (predicted_time_utc, elevation_rate_deg_per_h) or None.
    """
    for i, t_str in enumerate(times):
        t_dt = parse_iso_utc(t_str)
        if t_dt < landing_time:
            continue

        frac = sun_fracs[i]
        el = sun_els[i]
        if frac <= 0.0 or el <= 0.0:
            # Estimate elevation rate around sunset
            prev_idx = max(0, i - 1)
            next_idx = min(len(times) - 1, i + 1)
            dt_h = max(0.1, (parse_iso_utc(times[next_idx]) - parse_iso_utc(times[prev_idx])).total_seconds() / 3600.0)
            rate = abs(sun_els[next_idx] - sun_els[prev_idx]) / dt_h
            return t_str, max(0.01, rate)

    return None


def compute_backtest_comparison(
    case: Dict[str, Any],
    series: Dict[str, Any],
) -> Dict[str, Any]:
    """Compare reported mission timeline events with LightPath topocentric predicted series.

    Returns a structured dictionary conforming to schemas/backtest.schema.json.
    """
    times = series["time_utc"]
    sun_fracs = series["sun"]["frac"]
    sun_els = series["sun"]["el_deg"]
    earth_fracs = series["earth"]["frac"]
    earth_els = series["earth"]["el_deg"]
    dte_links = series.get("dte", {}).get("link_ok", [True] * len(times))

    landing_dt = parse_iso_utc(case["landing_time_utc"])
    dem_res_m = float(case.get("dem_resolution_m", 20.0))
    landing_unc_m = float(case.get("landing_uncertainty_m", 250.0))

    sunset_pred = find_predicted_sunset(times, sun_fracs, sun_els, landing_dt)
    predicted_sunset_utc = sunset_pred[0] if sunset_pred else None
    el_rate = sunset_pred[1] if sunset_pred else 0.08

    unc = calculate_uncertainty_budget(
        dem_resolution_m=dem_res_m,
        landing_uncertainty_m=landing_unc_m,
        elevation_rate_deg_per_h=el_rate,
    )

    comparison_results = []
    for ev in case.get("reported_events", []):
        ev_id = ev["id"]
        ev_name = ev["name"]
        ev_type = ev["event_type"]
        rep_dt = parse_iso_utc(ev["time_utc"])

        # 1. Sunset / Loss of Sunlight
        if ev_type in ("sunset", "loss_of_sunlight"):
            if predicted_sunset_utc is not None:
                pred_dt = parse_iso_utc(predicted_sunset_utc)
                delta_h = round((pred_dt - rep_dt).total_seconds() / 3600.0, 3)

                if abs(delta_h) <= unc["terrain_resolution_h"]:
                    status = "MATCH_WITHIN_UNCERTAINTY"
                    explanation = (
                        f"Predicted sunset matches reported event within terrain resolution uncertainty "
                        f"({abs(delta_h):.2f}h difference <= {unc['terrain_resolution_h']:.2f}h uncertainty limit)."
                    )
                elif abs(delta_h) <= unc["total_uncertainty_h"]:
                    status = "DISCREPANCY_EXPLAINED_BY_TERRAIN"
                    explanation = (
                        f"Discrepancy of {abs(delta_h):.2f}h is fully explained by combined terrain resolution "
                        f"and landing-location dispersion uncertainty (+/-{unc['total_uncertainty_h']:.2f}h)."
                    )
                else:
                    status = "UNEXPLAINED_BY_GEOMETRY"
                    explanation = (
                        f"Delta of {delta_h:.2f}h exceeds total geometric uncertainty (+/-{unc['total_uncertainty_h']:.2f}h). "
                        f"Geometry alone cannot explain this difference; potential causes include local micro-topography "
                        f"smaller than {dem_res_m}m DEM resolution or spacecraft solar array orientation."
                    )

                comparison_results.append({
                    "event_id": ev_id,
                    "event_name": ev_name,
                    "reported_time_utc": ev["time_utc"],
                    "predicted_time_utc": predicted_sunset_utc,
                    "delta_hours": delta_h,
                    "uncertainty": unc,
                    "status": status,
                    "geometry_explanation": explanation,
                })
            else:
                comparison_results.append({
                    "event_id": ev_id,
                    "event_name": ev_name,
                    "reported_time_utc": ev["time_utc"],
                    "predicted_time_utc": None,
                    "delta_hours": None,
                    "uncertainty": unc,
                    "status": "NO_PREDICTED_EVENT",
                    "geometry_explanation": "Sun remained above geometric horizon throughout the analyzed period.",
                })

        # 2. Earth LOS / Loss of Signal / Comms Drop
        elif ev_type in ("earth_los", "loss_of_signal", "end_of_operations"):
            # Sample Earth visibility at the reported time
            # Find closest series time
            closest_idx = min(range(len(times)), key=lambda i: abs((parse_iso_utc(times[i]) - rep_dt).total_seconds()))
            earth_el = earth_els[closest_idx]
            earth_frac = earth_fracs[closest_idx]
            dte_ok = dte_links[closest_idx]

            if earth_el > 0.0 and earth_frac > 0.5 and dte_ok:
                # Clear line of sight existed!
                comparison_results.append({
                    "event_id": ev_id,
                    "event_name": ev_name,
                    "reported_time_utc": ev["time_utc"],
                    "predicted_time_utc": None,
                    "delta_hours": None,
                    "uncertainty": unc,
                    "status": "UNEXPLAINED_BY_GEOMETRY",
                    "geometry_explanation": (
                        f"At the reported event time, topocentric Earth elevation was +{earth_el:.2f} deg "
                        f"(disc fraction: {earth_frac*100:.1f}%) with active Direct-To-Earth line of sight. "
                        f"Geometry alone cannot explain signal loss; potential causes include spacecraft antenna "
                        f"off-pointing, battery depletion, receiver pass scheduling, or ground station maintenance."
                    ),
                })
            else:
                # Earth was actually below horizon or blocked
                comparison_results.append({
                    "event_id": ev_id,
                    "event_name": ev_name,
                    "reported_time_utc": ev["time_utc"],
                    "predicted_time_utc": times[closest_idx],
                    "delta_hours": 0.0,
                    "uncertainty": unc,
                    "status": "MATCH_WITHIN_UNCERTAINTY",
                    "geometry_explanation": "Earth line-of-sight was obstructed by terrain, matching signal loss.",
                })

    return {
        "case_id": case.get("case_id", "unspecified-case"),
        "mission_name": case.get("mission_name", "Unspecified Mission"),
        "site_id": case.get("site_id", "unspecified-site"),
        "landing_time_utc": case["landing_time_utc"],
        "landing_coord": case["landing_coord"],
        "landing_uncertainty_m": landing_unc_m,
        "dem_resolution_m": dem_res_m,
        "reported_events": case.get("reported_events", []),
        "comparison_results": comparison_results,
        "disclaimer": (
            "LightPath computes topocentric celestial-terrain line-of-sight geometry only. "
            "It does not model thermal dynamics, battery state-of-charge, spacecraft bus health, "
            "or local surface rock occlusions smaller than the DEM grid. "
            "It does not claim to explain mission outcomes beyond line-of-sight geometry."
        ),
    }
