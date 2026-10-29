"""Unit tests for pipeline.stats module."""

import json
from pathlib import Path

from jsonschema import validate

from pipeline.stats import (
    compute_darkness_spells,
    compute_joint_availability,
    compute_window_statistics,
    detect_events,
    summarize,
)

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def test_window_detection_hand_made_series():
    """Test window detection against all edge case topologies:

    - Adjacent windows separated by outages.
    - Single-sample windows.
    - Series that start visible.
    - Series that end visible.
    - Empty series.
    - Fully active and fully inactive series.
    """
    ts = [f"2026-11-01T{h:02d}:00:00Z" for h in range(10)]
    step_h = 1.0

    # 1. Empty series
    empty_res = compute_window_statistics([], [])
    assert empty_res["uptime_fraction"] == 0.0
    assert empty_res["pct_time_above"] == 0.0
    assert empty_res["window_count"] == 0
    assert len(empty_res["windows"]) == 0
    assert empty_res["longest_outage_h"] == 0.0

    # 2. All true series (fully active)
    all_true = [True] * 5
    res_all_t = compute_window_statistics(all_true, ts[:5], step_h=step_h)
    assert res_all_t["uptime_fraction"] == 1.0
    assert res_all_t["pct_time_above"] == 100.0
    assert res_all_t["window_count"] == 1
    assert res_all_t["windows"][0]["start_utc"] == ts[0]
    assert res_all_t["windows"][0]["end_utc"] == ts[4]
    assert res_all_t["windows"][0]["duration_h"] == 5.0
    assert res_all_t["longest_window_h"] == 5.0
    assert res_all_t["longest_outage_h"] == 0.0

    # 3. All false series (fully inactive)
    all_false = [False] * 5
    res_all_f = compute_window_statistics(all_false, ts[:5], step_h=step_h)
    assert res_all_f["uptime_fraction"] == 0.0
    assert res_all_f["window_count"] == 0
    assert len(res_all_f["windows"]) == 0
    assert res_all_f["longest_window_h"] == 0.0
    assert res_all_f["longest_outage_h"] == 5.0

    # 4. Starts visible: [T, T, F, F, F]
    starts_vis = [True, True, False, False, False]
    res_starts = compute_window_statistics(starts_vis, ts[:5], step_h=step_h)
    assert res_starts["window_count"] == 1
    assert res_starts["windows"][0]["start_utc"] == ts[0]
    assert res_starts["windows"][0]["end_utc"] == ts[1]
    assert res_starts["windows"][0]["duration_h"] == 2.0
    assert res_starts["longest_outage_h"] == 3.0

    # 5. Ends visible: [F, F, F, T, T]
    ends_vis = [False, False, False, True, True]
    res_ends = compute_window_statistics(ends_vis, ts[:5], step_h=step_h)
    assert res_ends["window_count"] == 1
    assert res_ends["windows"][0]["start_utc"] == ts[3]
    assert res_ends["windows"][0]["end_utc"] == ts[4]
    assert res_ends["windows"][0]["duration_h"] == 2.0
    assert res_ends["longest_outage_h"] == 3.0

    # 6. Single-sample window: [F, T, F, F, F]
    single_win = [False, True, False, False, False]
    res_single = compute_window_statistics(single_win, ts[:5], step_h=step_h)
    assert res_single["window_count"] == 1
    assert res_single["windows"][0]["start_utc"] == ts[1]
    assert res_single["windows"][0]["end_utc"] == ts[1]
    assert res_single["windows"][0]["duration_h"] == 1.0
    assert res_single["longest_window_h"] == 1.0
    assert res_single["longest_outage_h"] == 3.0

    # 7. Adjacent windows separated by outages: [T, T, F, T, T, T, F, T]
    adj_series = [True, True, False, True, True, True, False, True]
    res_adj = compute_window_statistics(adj_series, ts[:8], step_h=step_h)
    assert res_adj["window_count"] == 3
    assert res_adj["windows"][0]["duration_h"] == 2.0
    assert res_adj["windows"][1]["duration_h"] == 3.0
    assert res_adj["windows"][2]["duration_h"] == 1.0
    assert res_adj["longest_window_h"] == 3.0
    assert res_adj["longest_outage_h"] == 1.0


def test_joint_availability():
    sun = [True, True, False, False, True]
    earth = [True, False, True, False, True]
    dte = [True, True, False, False, False]

    joint = compute_joint_availability(sun, earth, dte)
    # sun and earth
    assert joint["sun_and_earth"] == [True, False, False, False, True]
    # sun and dte
    assert joint["sun_and_dte"] == [True, True, False, False, False]


def test_event_detection_hand_made_series():
    """Verify sunrise, sunset, Earthrise, and Earthset event detection from threshold crossings."""
    ts = [
        "2026-11-01T00:00:00Z",
        "2026-11-01T01:00:00Z",
        "2026-11-01T02:00:00Z",
        "2026-11-01T03:00:00Z",
        "2026-11-01T04:00:00Z",
    ]
    # Sun: rises at step 1, sets at step 3
    sun_frac = [0.1, 0.8, 0.9, 0.2, 0.0]
    sun_az = [45.0, 48.0, 52.0, 55.0, 58.0]

    # Earth: sets at step 2, rises at step 4
    earth_frac = [0.9, 0.7, 0.3, 0.1, 0.6]
    earth_az = [180.0, 181.0, 182.0, 183.0, 184.0]

    series = {
        "time_utc": ts,
        "sun": {"frac": sun_frac, "az_deg": sun_az},
        "earth": {"frac": earth_frac, "az_deg": earth_az},
    }

    events = detect_events(series, min_sun_frac=0.5, min_earth_frac=0.5)

    event_types = [e["event"] for e in events]
    assert "sunrise" in event_types
    assert "sunset" in event_types
    assert "earthrise" in event_types
    assert "earthset" in event_types

    # Sunrise at step 1
    sr = next(e for e in events if e["event"] == "sunrise")
    assert sr["time_utc"] == ts[1]
    assert sr["az_deg"] == 48.0

    # Sunset at step 3
    ss = next(e for e in events if e["event"] == "sunset")
    assert ss["time_utc"] == ts[3]
    assert ss["az_deg"] == 55.0

    # Earthset at step 2
    es = next(e for e in events if e["event"] == "earthset")
    assert es["time_utc"] == ts[2]
    assert es["az_deg"] == 182.0

    # Earthrise at step 4
    er = next(e for e in events if e["event"] == "earthrise")
    assert er["time_utc"] == ts[4]
    assert er["az_deg"] == 184.0


def test_darkness_spells():
    ts = [f"2026-11-01T{h:02d}:00:00Z" for h in range(6)]
    # Solar fraction: [T, F, F, T, F, F] -> darkness spells at [1..2] (2h) and [4..5] (2h)
    sun_frac = [0.8, 0.1, 0.2, 0.9, 0.0, 0.1]
    series = {
        "time_utc": ts,
        "sun": {"frac": sun_frac},
    }

    darkness = compute_darkness_spells(series, min_sun_frac=0.5)
    assert darkness["longest_darkness_h"] == 2.0
    assert darkness["total_darkness_h"] == 4.0
    assert darkness["spell_count"] == 2


def test_summarize_schema_compliance():
    with open(SCHEMAS_DIR / "stats.schema.json", "r", encoding="utf-8") as f:
        schema = json.load(f)

    ts = [
        "2026-11-01T00:00:00Z",
        "2026-11-01T01:00:00Z",
        "2026-11-01T02:00:00Z",
        "2026-11-01T03:00:00Z",
    ]
    series = {
        "time_utc": ts,
        "sun": {
            "az_deg": [10.0, 15.0, 20.0, 25.0],
            "el_deg": [1.0, 1.2, 1.1, 0.9],
            "radius_deg": [0.267, 0.267, 0.267, 0.267],
            "frac": [0.8, 0.9, 0.7, 0.3],
            "status": ["robust_visible", "robust_visible", "robust_visible", "robust_blocked"],
        },
        "earth": {
            "az_deg": [180.0, 180.1, 180.2, 180.3],
            "el_deg": [5.0, 5.1, 5.0, 4.9],
            "radius_deg": [0.95, 0.95, 0.95, 0.95],
            "frac": [1.0, 1.0, 1.0, 1.0],
            "status": ["robust_visible", "robust_visible", "robust_visible", "robust_visible"],
            "dist_km": [384400.0, 384400.0, 384400.0, 384400.0],
        },
        "dte": {
            "station_names": ["Goldstone", "Madrid", "Canberra"],
            "station_visible": [[True, False, False], [True, False, False], [False, True, False], [False, False, True]],
            "link_ok": [True, True, True, True],
        },
    }

    thresholds = {
        "min_sun_frac": 0.50,
        "min_earth_frac": 0.50,
        "ground_station_mask_deg": 10.0,
    }

    stats = summarize(series, thresholds)
    validate(instance=stats, schema=schema)
    assert stats["thresholds"] == thresholds
    assert "sun" in stats
    assert "earth" in stats
    assert "dte" in stats
    assert "joint" in stats
