"""Tests for Scenario Reproducibility, Address Hash Codec, and Comparison Suite.

In accordance with docs/PROJECT_RULES.md:
- Strictly verifies that URL hash slugs contain only letters, digits, and hyphens.
- Confirms friendly errors on malformed links without unhandled exceptions.
- Validates scenario JSON schema compliance and data version hash mismatch detection.
- Tests side-by-side scenario comparison logic.
"""

import json
from pathlib import Path

import pytest
from jsonschema import validate

from pipeline.scenario import (
    HASH_REGEX,
    Scenario,
    compare_scenarios,
    decode_scenario_hash,
    encode_scenario_hash,
    export_scenario_json,
    import_scenario_json,
    is_hash_too_long,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT_DIR / "schemas" / "scenario.schema.json"


def test_scenario_round_trip_encode_decode():
    """Verify round-trip encoding and decoding preserves all scenario parameters."""
    original = Scenario(
        version="v1",
        site_id="synthetic-proving-ground",
        start_date="2026-11-01",
        end_date="2026-11-08",
        min_sun_frac=0.50,
        min_earth_frac=0.60,
        mast_height_m=2.5,
        speed_m_s=0.08,
        max_slope_deg=12.5,
        allow_wait=True,
        mode="earliest-arrival",
        conservative=True,
        horizon_margin_deg=0.5,
        start_coord=(12, 14),
        goal_coord=(25, 28),
    )

    slug = encode_scenario_hash(original)

    # 1. Assert strict character constraint: only letters, digits, and hyphens!
    assert HASH_REGEX.match(slug) is not None, f"Hash '{slug}' violates letters, digits, hyphens rule"
    assert "_" not in slug
    assert "%" not in slug
    assert "/" not in slug
    assert "?" not in slug

    # 2. Decode back
    decoded = decode_scenario_hash(slug)

    # 3. Assert full round-trip parity
    assert decoded.version == original.version
    assert decoded.site_id == original.site_id
    assert decoded.start_date == original.start_date
    assert decoded.end_date == original.end_date
    assert decoded.min_sun_frac == original.min_sun_frac
    assert decoded.min_earth_frac == original.min_earth_frac
    assert decoded.mast_height_m == original.mast_height_m
    assert decoded.speed_m_s == original.speed_m_s
    assert decoded.max_slope_deg == original.max_slope_deg
    assert decoded.allow_wait == original.allow_wait
    assert decoded.mode == original.mode
    assert decoded.conservative == original.conservative
    assert decoded.horizon_margin_deg == original.horizon_margin_deg
    assert decoded.start_coord == original.start_coord
    assert decoded.goal_coord == original.goal_coord


def test_scenario_malformed_links_friendly_error():
    """Verify that malformed or corrupted hashes raise descriptive, friendly errors."""
    # 1. Illegal characters
    with pytest.raises(ValueError, match="contains illegal characters"):
        decode_scenario_hash("v1-site-synthetic_proving_ground")  # underscore is forbidden

    with pytest.raises(ValueError, match="contains illegal characters"):
        decode_scenario_hash("v1-site-synthetic%20ground")

    # 2. Unsupported version
    with pytest.raises(ValueError, match="Unsupported version 'v9'"):
        decode_scenario_hash("v9-site-synthetic-proving-ground-start-20261101")

    # 3. Missing required parameters
    with pytest.raises(ValueError, match="Missing required scenario parameter 'speed'"):
        decode_scenario_hash("v1-site-synthetic-proving-ground-start-20261101-end-20261108-sun-50-earth-50-mast-2-slope-15-sx-10-sy-10-gx-20-gy-20")

    # 4. Numerical parse errors
    with pytest.raises(ValueError, match="Numerical parse error"):
        decode_scenario_hash("v1-site-synthetic-proving-ground-start-20261101-end-20261108-sun-abc-earth-50-mast-2-speed-0-05-slope-15-sx-10-sy-10-gx-20-gy-20")

    # 5. Empty hash
    with pytest.raises(ValueError, match="Hash string is empty"):
        decode_scenario_hash("")


def test_scenario_length_budget_check():
    """Verify hash length budget detector."""
    short_slug = "v1-site-synthetic-proving-ground-start-20261101-end-20261108"
    assert is_hash_too_long(short_slug) is False

    long_slug = "v1-" + ("extra-long-slug-" * 20)
    assert is_hash_too_long(long_slug) is True


def test_scenario_json_export_and_schema_validation():
    """Verify scenario JSON export complies with schemas/scenario.schema.json."""
    scenario = Scenario(
        site_id="synthetic-proving-ground",
        start_date="2026-11-01",
        end_date="2026-11-08",
        start_coord=(5, 5),
        goal_coord=(15, 15),
    )

    data = export_scenario_json(
        scenario,
        scenario_name="Proving Ground Survey",
        data_version_hash="a1b2c3d4",
        dem_resolution_m=20.0,
    )

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # Validate schema
    validate(instance=data, schema=schema)

    # Round trip import
    imported, warning = import_scenario_json(data, current_data_version_hash="a1b2c3d4")
    assert warning is None
    assert imported.site_id == scenario.site_id
    assert imported.start_coord == (5, 5)
    assert imported.goal_coord == (15, 15)


def test_scenario_data_version_mismatch_warning():
    """Verify warning is returned when imported scenario data version differs."""
    scenario = Scenario(site_id="synthetic-proving-ground")
    data = export_scenario_json(scenario, data_version_hash="oldhash123")

    imported, warning = import_scenario_json(data, current_data_version_hash="newhash456")
    assert warning is not None
    assert "Data version mismatch" in warning
    assert "oldhash123" in warning
    assert "newhash456" in warning


def test_scenario_side_by_side_comparison():
    """Verify comparison of two saved scenarios."""
    scen_a = Scenario(
        site_id="synthetic-proving-ground",
        mast_height_m=2.0,
        conservative=False,
        horizon_margin_deg=0.0,
        speed_m_s=0.05,
    )
    scen_b = Scenario(
        site_id="synthetic-proving-ground",
        mast_height_m=4.0,
        conservative=True,
        horizon_margin_deg=0.5,
        speed_m_s=0.05,
    )

    res_a = {
        "feasible": True,
        "metrics": {
            "total_distance_m": 1200.0,
            "duration_h": 6.67,
            "dark_exposure_h": 0.0,
            "wait_duration_h": 0.0,
        },
    }
    res_b = {
        "feasible": True,
        "metrics": {
            "total_distance_m": 1450.0,
            "duration_h": 9.50,
            "dark_exposure_h": 0.0,
            "wait_duration_h": 1.44,
        },
    }

    comp = compare_scenarios(scen_a, scen_b, res_a, res_b)
    diffs = comp["parameter_differences"]
    assert any("Mast height delta: +2.0 m" in d for d in diffs)
    assert any("Conservative margin changed" in d for d in diffs)

    deltas = comp["metric_deltas"]
    assert deltas["delta_distance_m"] == 250.0
    assert deltas["delta_duration_h"] == 2.83
    assert deltas["delta_wait_h"] == 1.44
    assert "+250.0 m" in deltas["summary"]
