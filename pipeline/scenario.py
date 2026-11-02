"""Scenario Codec and Reproducibility Module.

In accordance with docs/PROJECT_RULES.md:
- Encodes full scenario into address hash using only letters, digits, and hyphens.
- Versioned (v1) with strict validation and friendly error messages for malformed input.
- Exports and imports JSON scenario files with data version hash tracking and mismatch warnings.
- Computes side-by-side scenario parameter and outcome deltas.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
HASH_REGEX = re.compile(r"^[a-zA-Z0-9-]+$")
MAX_HASH_LENGTH = 220


@dataclass
class Scenario:
    version: str = "v1"
    site_id: str = "synthetic-proving-ground"
    start_date: str = "2026-11-01"
    end_date: str = "2026-11-08"
    min_sun_frac: float = 0.50
    min_earth_frac: float = 0.50
    mast_height_m: float = 2.0
    speed_m_s: float = 0.05
    max_slope_deg: float = 15.0
    allow_wait: bool = True
    mode: str = "earliest-arrival"
    conservative: bool = False
    horizon_margin_deg: float = 0.0
    start_coord: Tuple[int, int] = (10, 10)
    goal_coord: Tuple[int, int] = (20, 20)
    data_version_hash: str = "9f8e21a0"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _float_to_slug(val: float) -> str:
    """Format float using only letters, digits, and hyphens (replace dot with hyphen)."""
    # Round to avoid floating point artifacts
    r = round(val, 4)
    s = f"{r:g}"
    return s.replace(".", "-")


def _slug_to_float(slug: str) -> float:
    """Parse float from hyphen-separated decimal string."""
    return float(slug.replace("-", "."))


def _compact_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to YYYYMMDD."""
    return date_str.replace("-", "")


def _expand_date(compact: str) -> str:
    """Convert YYYYMMDD to YYYY-MM-DD."""
    if len(compact) == 8 and compact.isdigit():
        return f"{compact[0:4]}-{compact[4:6]}-{compact[6:8]}"
    return compact


def encode_scenario_hash(scenario: Scenario) -> str:
    """Encode the full scenario into a compact URL hash slug using only letters, digits, and hyphens."""
    sun_pct = int(round(scenario.min_sun_frac * 100))
    earth_pct = int(round(scenario.min_earth_frac * 100))
    wait_flag = 1 if scenario.allow_wait else 0
    cons_flag = 1 if scenario.conservative else 0

    parts = [
        scenario.version,
        "site",
        scenario.site_id,
        "start",
        _compact_date(scenario.start_date),
        "end",
        _compact_date(scenario.end_date),
        "sun",
        str(sun_pct),
        "earth",
        str(earth_pct),
        "mast",
        _float_to_slug(scenario.mast_height_m),
        "speed",
        _float_to_slug(scenario.speed_m_s),
        "slope",
        _float_to_slug(scenario.max_slope_deg),
        "wait",
        str(wait_flag),
        "mode",
        scenario.mode,
        "cons",
        str(cons_flag),
        "margin",
        _float_to_slug(scenario.horizon_margin_deg),
        "sx",
        str(scenario.start_coord[0]),
        "sy",
        str(scenario.start_coord[1]),
        "gx",
        str(scenario.goal_coord[0]),
        "gy",
        str(scenario.goal_coord[1]),
    ]

    slug = "-".join(parts)
    if not HASH_REGEX.match(slug):
        raise ValueError(f"Internal encoding error: generated slug '{slug}' violates letters, digits, and hyphens constraint.")
    return slug


def decode_scenario_hash(hash_str: str) -> Scenario:
    """Decode a scenario slug from URL hash with friendly errors on malformed links."""
    if not hash_str:
        raise ValueError("Malformed scenario link: Hash string is empty.")

    clean_hash = hash_str.strip().lstrip("#/").replace("scenario/", "")

    if not HASH_REGEX.match(clean_hash):
        raise ValueError(
            "Malformed scenario link: Address hash contains illegal characters. "
            "Only plain letters, digits, and hyphens are permitted."
        )

    tokens = clean_hash.split("-")
    if len(tokens) < 2 or not tokens[0].startswith("v"):
        raise ValueError(f"Malformed scenario link: Missing or invalid version header in '{clean_hash}'. Expected 'v1'.")

    version = tokens[0]
    if version != "v1":
        raise ValueError(f"Malformed scenario link: Unsupported version '{version}'. Expected 'v1'.")

    # Parse key-value tokens
    params: Dict[str, str] = {}
    i = 1
    known_keys = {
        "site", "start", "end", "sun", "earth", "mast", "speed",
        "slope", "wait", "mode", "cons", "margin", "sx", "sy", "gx", "gy"
    }

    current_key: Optional[str] = None
    current_val_parts: List[str] = []

    while i < len(tokens):
        token = tokens[i]
        if token in known_keys:
            if current_key is not None:
                params[current_key] = "-".join(current_val_parts)
            current_key = token
            current_val_parts = []
        else:
            current_val_parts.append(token)
        i += 1

    if current_key is not None:
        params[current_key] = "-".join(current_val_parts)

    required_keys = ["site", "start", "end", "sun", "earth", "mast", "speed", "slope", "sx", "sy", "gx", "gy"]
    for rk in required_keys:
        if rk not in params or not params[rk]:
            raise ValueError(f"Malformed scenario link: Missing required scenario parameter '{rk}'.")

    try:
        sun_pct = float(params["sun"])
        earth_pct = float(params["earth"])
        mast_m = _slug_to_float(params["mast"])
        speed_m_s = _slug_to_float(params["speed"])
        slope_deg = _slug_to_float(params["slope"])
        wait_val = bool(int(params.get("wait", "1")))
        mode_val = params.get("mode", "earliest-arrival")
        cons_val = bool(int(params.get("cons", "0")))
        margin_deg = _slug_to_float(params.get("margin", "0"))
        sx = int(params["sx"])
        sy = int(params["sy"])
        gx = int(params["gx"])
        gy = int(params["gy"])
    except (ValueError, TypeError) as err:
        raise ValueError(f"Malformed scenario link: Numerical parse error in scenario parameters ({err}).") from err

    return Scenario(
        version=version,
        site_id=params["site"],
        start_date=_expand_date(params["start"]),
        end_date=_expand_date(params["end"]),
        min_sun_frac=round(sun_pct / 100.0, 2),
        min_earth_frac=round(earth_pct / 100.0, 2),
        mast_height_m=mast_m,
        speed_m_s=speed_m_s,
        max_slope_deg=slope_deg,
        allow_wait=wait_val,
        mode=mode_val,
        conservative=cons_val,
        horizon_margin_deg=margin_deg,
        start_coord=(sx, sy),
        goal_coord=(gx, gy),
    )


def is_hash_too_long(hash_str: str) -> bool:
    """Check if the encoded scenario hash exceeds URL length recommendation."""
    return len(hash_str) > MAX_HASH_LENGTH


def export_scenario_json(
    scenario: Scenario,
    scenario_name: str = "Lunar Traverse Scenario",
    data_version_hash: str = "9f8e21a0",
    dem_resolution_m: float = 20.0,
) -> Dict[str, Any]:
    """Export scenario as JSON adhering to schemas/scenario.schema.json."""
    return {
      "schema_version": "v1",
      "scenario_id": f"scen-{_compact_date(scenario.start_date)}-{scenario.site_id}",
      "name": scenario_name,
      "created_utc": datetime.now(timezone.utc).isoformat(),
      "data_version_hash": data_version_hash,
      "site_id": scenario.site_id,
      "date_range": {
        "start_utc": f"{scenario.start_date}T00:00:00Z",
        "end_utc": f"{scenario.end_date}T00:00:00Z"
      },
      "thresholds": {
        "min_sun_frac": scenario.min_sun_frac,
        "min_earth_frac": scenario.min_earth_frac
      },
      "mast_height_m": scenario.mast_height_m,
      "route_params": {
        "speed_m_s": scenario.speed_m_s,
        "max_slope_deg": scenario.max_slope_deg,
        "allow_wait": scenario.allow_wait,
        "mode": scenario.mode,
        "conservative": scenario.conservative,
        "horizon_margin_deg": scenario.horizon_margin_deg
      },
      "start_coord": list(scenario.start_coord),
      "goal_coord": list(scenario.goal_coord),
      "provenance": {
        "software_version": "LightPath v0.1.0-deterministic",
        "reference_frame": "MOON_ME",
        "dem_resolution_m": dem_resolution_m,
        "kernel_set": "generic_kernels/de421"
      },
      "metadata": {
        "description": f"Reproducible scenario for {scenario.site_id} from {scenario.start_date} to {scenario.end_date}"
      }
    }


def import_scenario_json(
    data: Dict[str, Any],
    current_data_version_hash: str = "9f8e21a0",
) -> Tuple[Scenario, Optional[str]]:
    """Import scenario from parsed JSON and check data version hash."""
    file_version_hash = data.get("data_version_hash", "")
    warning: Optional[str] = None
    if file_version_hash and current_data_version_hash and file_version_hash != current_data_version_hash:
        warning = (
            f"Data version mismatch: Scenario was created with data version '{file_version_hash}', "
            f"but current environment is running data version '{current_data_version_hash}'. "
            f"Calculated elevation profiles and traverse durations may differ due to updated DEM or SPICE kernels."
        )

    date_range = data.get("date_range", {})
    start_str = date_range.get("start_utc", "2026-11-01").split("T")[0]
    end_str = date_range.get("end_utc", "2026-11-08").split("T")[0]
    thresh = data.get("thresholds", {})
    r_params = data.get("route_params", {})

    scenario = Scenario(
        version=data.get("schema_version", "v1"),
        site_id=data.get("site_id", "synthetic-proving-ground"),
        start_date=start_str,
        end_date=end_str,
        min_sun_frac=float(thresh.get("min_sun_frac", 0.50)),
        min_earth_frac=float(thresh.get("min_earth_frac", 0.50)),
        mast_height_m=float(data.get("mast_height_m", 2.0)),
        speed_m_s=float(r_params.get("speed_m_s", 0.05)),
        max_slope_deg=float(r_params.get("max_slope_deg", 15.0)),
        allow_wait=bool(r_params.get("allow_wait", True)),
        mode=r_params.get("mode", "earliest-arrival"),
        conservative=bool(r_params.get("conservative", False)),
        horizon_margin_deg=float(r_params.get("horizon_margin_deg", 0.0)),
        start_coord=tuple(data.get("start_coord", [10, 10])),  # type: ignore
        goal_coord=tuple(data.get("goal_coord", [20, 20])),    # type: ignore
        data_version_hash=file_version_hash,
    )
    return scenario, warning


def compare_scenarios(
    scen_a: Scenario,
    scen_b: Scenario,
    res_a: Optional[Dict[str, Any]] = None,
    res_b: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Compare two saved scenarios side by side, reporting parameter and metric differences."""
    differences = []

    if scen_a.site_id != scen_b.site_id:
        differences.append(f"Site changed from '{scen_a.site_id}' to '{scen_b.site_id}'")
    if (scen_a.start_date, scen_a.end_date) != (scen_b.start_date, scen_b.end_date):
        differences.append(f"Date window changed ({scen_a.start_date}..{scen_a.end_date} vs {scen_b.start_date}..{scen_b.end_date})")
    if scen_a.mast_height_m != scen_b.mast_height_m:
        differences.append(f"Mast height delta: {scen_b.mast_height_m - scen_a.mast_height_m:+.1f} m ({scen_a.mast_height_m} m vs {scen_b.mast_height_m} m)")
    if scen_a.speed_m_s != scen_b.speed_m_s:
        differences.append(f"Traverse speed delta: {scen_b.speed_m_s - scen_a.speed_m_s:+.3f} m/s")
    if scen_a.max_slope_deg != scen_b.max_slope_deg:
        differences.append(f"Max slope limit delta: {scen_b.max_slope_deg - scen_a.max_slope_deg:+.1f} deg")
    if (scen_a.conservative, scen_a.horizon_margin_deg) != (scen_b.conservative, scen_b.horizon_margin_deg):
        differences.append(f"Conservative margin changed from {scen_a.horizon_margin_deg} deg to {scen_b.horizon_margin_deg} deg")
    if (scen_a.start_coord, scen_a.goal_coord) != (scen_b.start_coord, scen_b.goal_coord):
        differences.append(f"Waypoints changed: Start {scen_a.start_coord}->{scen_b.start_coord}, Goal {scen_a.goal_coord}->{scen_b.goal_coord}")

    metric_deltas: Dict[str, Any] = {}
    if res_a and res_b and res_a.get("feasible") and res_b.get("feasible"):
        m_a = res_a["metrics"]
        m_b = res_b["metrics"]
        delta_dist_m = round(m_b["total_distance_m"] - m_a["total_distance_m"], 1)
        delta_dur_h = round(m_b["duration_h"] - m_a["duration_h"], 2)
        delta_dark_h = round(m_b.get("dark_exposure_h", 0.0) - m_a.get("dark_exposure_h", 0.0), 2)
        delta_wait_h = round(m_b.get("wait_duration_h", 0.0) - m_a.get("wait_duration_h", 0.0), 2)

        metric_deltas = {
            "delta_distance_m": delta_dist_m,
            "delta_duration_h": delta_dur_h,
            "delta_dark_h": delta_dark_h,
            "delta_wait_h": delta_wait_h,
            "summary": (
                f"Scenario B requires {delta_dist_m:+.1f} m distance, {delta_dur_h:+.2f} h transit duration, "
                f"and {delta_wait_h:+.2f} h waiting relative to Scenario A."
            ),
        }
    elif res_a and res_b:
        feas_a = res_a.get("feasible", False)
        feas_b = res_b.get("feasible", False)
        metric_deltas = {
            "feasibility_a": feas_a,
            "feasibility_b": feas_b,
            "summary": f"Feasibility divergence: Scenario A={feas_a}, Scenario B={feas_b}.",
        }

    return {
        "parameter_differences": differences,
        "metric_deltas": metric_deltas,
    }
