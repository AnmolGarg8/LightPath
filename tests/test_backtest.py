"""Tests for Historical Mission Backtest and Comparison Engine.

In accordance with docs/PROJECT_RULES.md:
- Uses fixtures to verify comparison arithmetic without network or SPICE dependencies.
- Confirms NOT AVAILABLE status when docs/BACKTEST_CASE.md is absent.
- Validates that non-geometric events (e.g. comms loss during clear LOS) are flagged
  as UNEXPLAINED_BY_GEOMETRY and never claim to explain hardware or flight operations.
"""

import json
import math
from pathlib import Path

import pytest
from jsonschema import validate

from pipeline.backtest import (
    calculate_uncertainty_budget,
    compute_backtest_comparison,
    load_backtest_case,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
FIXTURE_PATH = ROOT_DIR / "tests" / "fixtures" / "backtest_fixture.json"
SCHEMA_PATH = ROOT_DIR / "schemas" / "backtest.schema.json"


def test_backtest_case_missing_returns_none():
    """Verify that when docs/BACKTEST_CASE.md is missing, loader returns None."""
    # Ensure missing case path does not invent data
    res = load_backtest_case(ROOT_DIR / "docs" / "NONEXISTENT_CASE_123.md")
    assert res is None, "Missing case file must return None, never synthetic mission data"

    # Also test default path if docs/BACKTEST_CASE.md is currently absent
    default_path = ROOT_DIR / "docs" / "BACKTEST_CASE.md"
    if not default_path.exists():
        assert load_backtest_case() is None


def test_backtest_uncertainty_budget_independent_derivation():
    """Verify uncertainty budget formulas derived from first principles."""
    dem_res_m = 20.0
    landing_unc_m = 250.0
    rate_deg_per_h = 0.08
    slope_deg = 10.0
    ridge_dist_m = 10000.0

    unc = calculate_uncertainty_budget(
        dem_resolution_m=dem_res_m,
        landing_uncertainty_m=landing_unc_m,
        elevation_rate_deg_per_h=rate_deg_per_h,
        typical_slope_deg=slope_deg,
        ridge_distance_m=ridge_dist_m,
    )

    # Independent calculation
    slope_rad = math.radians(slope_deg)
    dz_dem = dem_res_m * math.tan(slope_rad)
    d_theta_dem = math.degrees(math.atan2(dz_dem, ridge_dist_m))
    expected_sigma_dem = round(d_theta_dem / rate_deg_per_h, 3)

    dz_disp = landing_unc_m * math.tan(slope_rad)
    d_theta_disp = math.degrees(math.atan2(dz_disp, ridge_dist_m))
    expected_sigma_disp = round(d_theta_disp / rate_deg_per_h, 3)

    expected_sigma_total = round(math.sqrt(expected_sigma_dem**2 + expected_sigma_disp**2), 3)

    assert unc["terrain_resolution_h"] == expected_sigma_dem
    assert unc["landing_location_h"] == expected_sigma_disp
    assert unc["total_uncertainty_h"] == expected_sigma_total
    assert unc["terrain_resolution_h"] < unc["total_uncertainty_h"]


def test_backtest_comparison_arithmetic_on_fixture():
    """Verify comparison arithmetic and status classification on controlled fixture."""
    assert FIXTURE_PATH.exists(), f"Fixture {FIXTURE_PATH} missing"
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    case = fixture_data["case"]
    series = fixture_data["series"]
    expected_comparisons = {c["event_id"]: c for c in fixture_data["expected_comparison"]}

    res = compute_backtest_comparison(case, series)
    results_by_id = {r["event_id"]: r for r in res["comparison_results"]}

    # Event 1: Nominal sunset matching predicted time exactly
    ev1 = results_by_id["ev-sunset-nominal"]
    exp1 = expected_comparisons["ev-sunset-nominal"]
    assert ev1["status"] == exp1["expected_status"]
    assert ev1["delta_hours"] == exp1["expected_delta_hours"]
    assert ev1["predicted_time_utc"] == exp1["predicted_time_utc"]

    # Event 2: Sunset with 30-minute discrepancy explainable by terrain
    ev2 = results_by_id["ev-sunset-delayed"]
    exp2 = expected_comparisons["ev-sunset-delayed"]
    assert ev2["status"] == exp2["expected_status"]
    assert ev2["delta_hours"] == exp2["expected_delta_hours"]
    assert ev2["predicted_time_utc"] == exp2["predicted_time_utc"]

    # Event 3: Premature comms loss during clear Earth LOS
    ev3 = results_by_id["ev-comms-premature-loss"]
    exp3 = expected_comparisons["ev-comms-premature-loss"]
    assert ev3["status"] == exp3["expected_status"]
    assert ev3["delta_hours"] is None
    assert "+8.50 deg" in ev3["geometry_explanation"]
    assert "Geometry alone cannot explain" in ev3["geometry_explanation"]


def test_backtest_schema_validation():
    """Verify that the computed backtest dictionary validates against the JSON schema."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)

    res = compute_backtest_comparison(fixture_data["case"], fixture_data["series"])
    validate(instance=res, schema=schema)


def test_backtest_strictly_limits_claims_to_geometry():
    """Verify that output explanations contain mandatory non-causal disclosures."""
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    res = compute_backtest_comparison(fixture_data["case"], fixture_data["series"])

    # Must contain disclaimer
    assert "disclaimer" in res
    assert "does not claim to explain mission outcomes beyond line-of-sight geometry" in res["disclaimer"]

    # Comms anomaly explanation must state geometry alone cannot explain
    comms_res = next(r for r in res["comparison_results"] if r["event_id"] == "ev-comms-premature-loss")
    assert "Geometry alone cannot explain" in comms_res["geometry_explanation"]
