"""Unit tests for pipeline.series module."""

import json
from pathlib import Path

import pytest
from jsonschema import validate

from pipeline.horizon import compute_synthetic_horizon_profile
from pipeline.series import (
    compute_series_and_stats,
    compute_window_stats,
    generate_time_steps,
)

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def test_generate_time_steps():
    steps = generate_time_steps("2026-11-01T00:00:00Z", "2026-11-01T04:00:00Z", step_minutes=60)
    assert len(steps) == 5
    assert steps[0] == "2026-11-01T00:00:00Z"
    assert steps[-1] == "2026-11-01T04:00:00Z"

    with pytest.raises(ValueError):
        generate_time_steps("2026-11-02T00:00:00Z", "2026-11-01T00:00:00Z")


def test_compute_window_stats():
    ts = [f"2026-11-01T{h:02d}:00:00Z" for h in range(10)]
    step_h = 1.0

    # Pattern: [T, T, T, F, F, T, T, F, T, T]
    # Active windows:
    # 1. 0 to 2 (3 hours)
    # 2. 5 to 6 (2 hours)
    # 3. 8 to 9 (2 hours)
    # Outages:
    # 1. 3 to 4 (2 hours)
    # 2. 7 to 7 (1 hour)
    pattern = [True, True, True, False, False, True, True, False, True, True]
    stats = compute_window_stats(pattern, ts, step_h)

    assert stats["uptime_fraction"] == 0.7  # 7 / 10
    assert stats["total_uptime_h"] == 7.0
    assert len(stats["windows"]) == 3
    assert stats["windows"][0]["duration_h"] == 3.0
    assert stats["windows"][0]["start_utc"] == ts[0]
    assert stats["windows"][0]["end_utc"] == ts[2]
    assert stats["longest_window_h"] == 3.0
    assert stats["longest_outage_h"] == 2.0


def test_series_and_stats_schema_validation():
    with open(SCHEMAS_DIR / "series.schema.json", "r", encoding="utf-8") as f:
        series_schema = json.load(f)
    with open(SCHEMAS_DIR / "stats.schema.json", "r", encoding="utf-8") as f:
        stats_schema = json.load(f)

    prof = compute_synthetic_horizon_profile(az_step_deg=2.0, heights_m=[0.0, 2.0, 5.0])
    timestamps = generate_time_steps("2026-11-01T00:00:00Z", "2026-11-02T12:00:00Z", step_minutes=120)

    series_dict, stats_dict = compute_series_and_stats(
        site_lat_deg=-89.5,
        site_lon_deg=137.5,
        site_ground_elev_m=1200.0,
        horizon_profile=prof,
        timestamps=timestamps,
        observer_height_m=2.0,
    )

    # Validate against JSON schemas
    validate(instance=series_dict, schema=series_schema)
    validate(instance=stats_dict, schema=stats_schema)

    # Mathematical consistency checks:
    # Joint active fraction <= Sun active fraction and <= DTE active fraction
    assert stats_dict["joint"]["uptime_fraction"] <= stats_dict["sun"]["uptime_fraction"] + 1e-6
    assert stats_dict["joint"]["uptime_fraction"] <= stats_dict["dte"]["uptime_fraction"] + 1e-6
