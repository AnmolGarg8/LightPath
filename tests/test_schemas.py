"""Tests for JSON schemas validating the data contract."""

import json
from pathlib import Path

import pytest
from jsonschema import ValidationError, validate

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def load_schema(name: str) -> dict:
    with open(SCHEMAS_DIR / f"{name}.schema.json", "r", encoding="utf-8") as f:
        return json.load(f)


def test_site_schema_valid():
    schema = load_schema("site")
    valid_site = {
        "id": "shackleton-connecting-ridge",
        "name": "Shackleton Connecting Ridge",
        "mission_ids": ["CLPS-IM-2", "PRIME-1"],
        "lat_deg": -89.44,
        "lon_deg": 137.5,
        "ground_elev_m": 1250.0,
        "source_links": ["https://pgda.gsfc.nasa.gov/products/54"],
        "verified": True,
        "is_synthetic": False
    }
    validate(instance=valid_site, schema=schema)


def test_site_schema_invalid():
    schema = load_schema("site")
    invalid_site = {
        "id": "bad site!",
        "name": "Invalid Site",
        # missing required fields
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_site, schema=schema)


def test_run_info_schema():
    schema = load_schema("run_info")
    valid_run_info = {
        "created_utc": "2026-10-29T12:00:00Z",
        "git_commit": "abcdef0123456789",
        "software_versions": {
            "python": "3.14.2",
            "numpy": "2.5.4",
            "lightpath": "0.1.0"
        }
    }
    validate(instance=valid_run_info, schema=schema)


def test_horizon_schema():
    schema = load_schema("horizon")
    valid_horizon = {
        "az_step_deg": 1.0,
        "heights_m": [0.0, 2.0, 5.0],
        "el_deg": [[0.5] * 360, [0.3] * 360, [0.1] * 360],
        "nan_fraction": [[0.0] * 360, [0.0] * 360, [0.0] * 360],
        "flags": ["lola_dem_20m"]
    }
    validate(instance=valid_horizon, schema=schema)


def test_series_schema():
    schema = load_schema("series")
    valid_series = {
        "time_utc": ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"],
        "sun": {
            "az_deg": [120.0, 120.5],
            "el_deg": [1.2, 1.3],
            "radius_deg": [0.26, 0.26],
            "frac": [1.0, 1.0],
            "status": ["robust_visible", "robust_visible"]
        },
        "earth": {
            "az_deg": [340.0, 340.1],
            "el_deg": [3.5, 3.6],
            "radius_deg": [0.95, 0.95],
            "frac": [1.0, 1.0],
            "status": ["robust_visible", "robust_visible"],
            "dist_km": [384400.0, 384410.0]
        },
        "dte": {
            "station_names": ["Goldstone", "Madrid", "Canberra"],
            "station_visible": [[True, False, False], [True, False, False]],
            "link_ok": [True, True]
        }
    }
    validate(instance=valid_series, schema=schema)


def test_stats_schema():
    schema = load_schema("stats")
    valid_stats = {
        "thresholds": {
            "min_sun_frac": 0.5,
            "min_earth_frac": 0.5,
            "ground_station_mask_deg": 10.0
        },
        "sun": {
            "uptime_fraction": 0.75,
            "total_uptime_h": 180.0,
            "windows": [{"start_utc": "2026-11-01T00:00:00Z", "end_utc": "2026-11-08T12:00:00Z", "duration_h": 180.0}],
            "longest_window_h": 180.0,
            "longest_outage_h": 60.0
        },
        "earth": {
            "uptime_fraction": 0.9,
            "total_uptime_h": 216.0,
            "windows": [{"start_utc": "2026-11-01T00:00:00Z", "end_utc": "2026-11-10T00:00:00Z", "duration_h": 216.0}],
            "longest_window_h": 216.0,
            "longest_outage_h": 24.0
        },
        "dte": {
            "uptime_fraction": 0.85,
            "total_uptime_h": 204.0,
            "windows": [{"start_utc": "2026-11-01T00:00:00Z", "end_utc": "2026-11-09T12:00:00Z", "duration_h": 204.0}],
            "longest_window_h": 204.0,
            "longest_outage_h": 36.0
        },
        "joint": {
            "uptime_fraction": 0.70,
            "total_uptime_h": 168.0,
            "windows": [{"start_utc": "2026-11-01T00:00:00Z", "end_utc": "2026-11-08T00:00:00Z", "duration_h": 168.0}],
            "longest_window_h": 168.0,
            "longest_outage_h": 72.0
        }
    }
    validate(instance=valid_stats, schema=schema)


def test_visibility_cube_schema():
    schema = load_schema("visibility_cube")
    valid_cube = {
        "grid": {
            "origin": [137.5, -89.44],
            "spacing_m": 40.0,
            "nx": 3,
            "ny": 3
        },
        "time_utc": ["2026-11-01T00:00:00Z"],
        "sun_frac": [[[100, 100, 100], [100, 50, 0], [0, 0, 0]]],
        "earth_frac": [[[100, 100, 100], [100, 100, 100], [100, 100, 100]]],
        "slope_deg": [[5.0, 6.2, 8.1], [5.5, 7.0, 9.3], [6.0, 8.5, 12.0]],
        "traversable": [[True, True, True], [True, True, True], [True, True, True]],
        "flags": ["nominal"]
    }
    validate(instance=valid_cube, schema=schema)


def test_route_result_schema():
    schema = load_schema("route_result")
    valid_route = {
        "mode": "rover",
        "params": {
            "start_coord": [0, 0],
            "end_coord": [2, 2],
            "start_time_idx": 0,
            "speed_m_s": 0.05,
            "max_slope_deg": 15.0,
            "min_sun_frac": 0.5,
            "min_earth_frac": 0.5
        },
        "feasible": True,
        "path": [{"x": 0, "y": 0, "t": 0}, {"x": 1, "y": 1, "t": 10}, {"x": 2, "y": 2, "t": 20}],
        "metrics": {
            "total_distance_m": 113.1,
            "duration_h": 0.63,
            "average_slope_deg": 6.8,
            "max_slope_deg": 9.3,
            "min_sun_frac_observed": 0.75,
            "min_earth_frac_observed": 1.0
        },
        "alternatives": [],
        "explanation": "Nominal route found meeting continuous light and link criteria."
    }
    validate(instance=valid_route, schema=schema)


def test_provenance_schema():
    schema = load_schema("provenance")
    valid_provenance = {
        "datasets": [
            {
                "name": "LOLA LDEM_80S_120M",
                "version": "v1.2",
                "source_url": "https://pgda.gsfc.nasa.gov/products/54"
            }
        ],
        "kernels": [
            {
                "name": "de421.bsp",
                "checksum": "da39a3ee5e6b4b0d3255bfef95601890afd80709"
            }
        ],
        "parameters": {
            "r_moon_m": 1737400.0,
            "az_step_deg": 0.5
        },
        "tolerances": {
            "disc_quadrature_tol": 1e-4
        },
        "tests_summary": {
            "tests_passed": 24,
            "tests_total": 24,
            "last_verified_utc": "2026-10-29T12:00:00Z"
        }
    }
    validate(instance=valid_provenance, schema=schema)


def test_configs_sites_validation():
    schema = load_schema("site")
    with open(SCHEMAS_DIR.parent / "configs" / "sites.json", "r", encoding="utf-8") as f:
        sites = json.load(f)
    assert len(sites) >= 4
    for site in sites:
        validate(instance=site, schema=schema)


