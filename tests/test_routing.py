"""Unit tests for pipeline.cube and pipeline.routing modules."""

import json
from pathlib import Path

import numpy as np
import pytest
from jsonschema import validate

from pipeline.cube import compute_visibility_cube, generate_polar_grid_coordinates
from pipeline.routing import (
    analyze_landing_dispersion,
    compare_nominal_and_conservative_routes,
    compute_departure_window_map,
    export_mission_plan_csv,
    export_mission_plan_ics,
    generate_dispersion_pattern,
    plan_lunar_traverse,
    plan_mission,
)

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


@pytest.fixture
def sample_cube():
    with open(SCHEMAS_DIR / "visibility_cube.schema.json", "r", encoding="utf-8") as f:
        cube_schema = json.load(f)

    nx, ny = 5, 5
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(5)]
    # Gentle sloping terrain (elevations in meters)
    elev = np.zeros((ny, nx), dtype=np.float64)
    for r in range(ny):
        for c in range(nx):
            elev[r, c] = 1000.0 + r * 2.0 + c * 2.0  # gentle ~5% slope (~3 deg)

    cube = compute_visibility_cube(
        center_lat_deg=-89.5,
        center_lon_deg=137.5,
        spacing_m=40.0,
        nx=nx,
        ny=ny,
        timestamps=timestamps,
        elev_dem_m=elev,
        max_slope_deg=15.0,
    )
    validate(instance=cube, schema=cube_schema)
    return cube


def test_polar_grid_coordinates():
    lat_grid, lon_grid = generate_polar_grid_coordinates(-89.5, 0.0, spacing_m=100.0, nx=3, ny=3)
    assert lat_grid.shape == (3, 3)
    assert lon_grid.shape == (3, 3)
    # Center cell is exact
    assert abs(lat_grid[1, 1] - (-89.5)) < 1e-5


def test_plan_traverse_feasible(sample_cube):
    with open(SCHEMAS_DIR / "route_result.schema.json", "r", encoding="utf-8") as f:
        route_schema = json.load(f)

    result = plan_lunar_traverse(
        visibility_cube=sample_cube,
        start_coord=(0, 0),
        end_coord=(3, 3),
        start_time_idx=0,
        speed_m_s=0.10,  # 0.1 m/s
        mode="rover",
        max_slope_deg=15.0,
        min_sun_frac=0.50,
        min_earth_frac=0.50,
    )

    validate(instance=result, schema=route_schema)
    assert result["feasible"] is True
    assert len(result["path"]) >= 2
    assert result["path"][0]["x"] == 0
    assert result["path"][0]["y"] == 0
    assert result["path"][-1]["x"] == 3
    assert result["path"][-1]["y"] == 3
    assert result["metrics"]["total_distance_m"] > 0.0
    assert result["metrics"]["duration_h"] > 0.0


def test_plan_traverse_infeasible_barrier(sample_cube):
    with open(SCHEMAS_DIR / "route_result.schema.json", "r", encoding="utf-8") as f:
        route_schema = json.load(f)

    # Place an impassable cliff (slope = 45 deg, traversable = False) across column 2
    sample_cube_barrier = dict(sample_cube)
    traversable = np.array(sample_cube["traversable"], dtype=bool)
    traversable[:, 2] = False  # Block entire column 2
    sample_cube_barrier["traversable"] = traversable.tolist()

    result = plan_lunar_traverse(
        visibility_cube=sample_cube_barrier,
        start_coord=(0, 0),
        end_coord=(4, 4),
        start_time_idx=0,
        speed_m_s=0.10,
        mode="rover",
        max_slope_deg=15.0,
    )

    validate(instance=result, schema=route_schema)
    assert result["feasible"] is False
    assert len(result["path"]) == 0
    assert "No feasible path found" in result["explanation"]


def test_plan_traverse_infeasible_shadow(sample_cube):
    # Plunge destination into zero illumination
    sample_cube_shadow = dict(sample_cube)
    sun_frac = np.array(sample_cube["sun_frac"], dtype=np.uint8)
    sun_frac[:, 3, 3] = 0  # Completely dark at destination
    sample_cube_shadow["sun_frac"] = sun_frac.tolist()

    result = plan_lunar_traverse(
        visibility_cube=sample_cube_shadow,
        start_coord=(0, 0),
        end_coord=(3, 3),
        start_time_idx=0,
        min_sun_frac=0.50,
    )

    assert result["feasible"] is False
    assert len(result["path"]) == 0


def test_plan_traverse_forbids_diagonal_blocked_corner():
    """Verify that rover cannot slip diagonally through impassable obstacle corners.

    In a 3x3 grid:
    (0, 0) Start -> (1, 1) Goal
    (1, 0) and (0, 1) are impassable walls (traversable = False).
    A physical rover cannot cut through the zero-width corner between obstacles.
    """
    traversable = np.ones((3, 3), dtype=bool)
    traversable[0, 1] = False  # Wall at East
    traversable[1, 0] = False  # Wall at North

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 10.0, "nx": 3, "ny": 3},
        "time_utc": ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"],
        "sun_frac": np.full((2, 3, 3), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((2, 3, 3), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 3), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    result = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(1, 1),
        start_time_idx=0,
        speed_m_s=0.05,
    )
    assert result["feasible"] is False, "Diagonal move through blocked corners must be forbidden"
    assert len(result["path"]) == 0


def test_plan_traverse_dark_budget():
    """Verify dark budget accounting in space-time routing."""
    sun_frac = np.full((5, 3, 3), 100, dtype=np.uint8)
    # Cell (1, 0) is permanently dark
    sun_frac[:, 0, 1] = 0

    # Block other rows so row 0 is the only corridor between (0, 0) and (2, 0)
    traversable = np.zeros((3, 3), dtype=bool)
    traversable[0, :] = True

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 10.0, "nx": 3, "ny": 3},
        "time_utc": [f"2026-11-01T{h:02d}:00:00Z" for h in range(5)],
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((5, 3, 3), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 3), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    # Case 1: dark_budget_h = 0.0 (no dark allowed) -> infeasible to cross (1, 0)
    res_no_dark = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(2, 0),
        dark_budget_h=0.0,
        speed_m_s=0.01,
    )
    assert res_no_dark["feasible"] is False, "Zero dark budget must reject traverse through shadowed cell"

    # Case 2: dark_budget_h = 2.0 (adequate dark budget) -> feasible
    res_with_dark = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(2, 0),
        dark_budget_h=2.0,
        speed_m_s=0.01,
    )
    assert res_with_dark["feasible"] is True, "Sufficient dark budget must allow traverse through shadowed cell"
    assert len(res_with_dark["path"]) >= 2


def test_departure_window_map_synthetic_moving_shadow_matches_brute_force():
    """Verify departure window map against brute-force solver on synthetic moving shadow.

    Scenario: A 1D corridor along row 0 with 5 cells (0..4).
    Cell (2, 0) is a ridge where shadow falls at step t >= 4.
    Departures that reach cell 2 at or after t=4 must fail.
    Every departure is cross-checked against independent plan_lunar_traverse calls.
    """
    num_t = 12
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    sun_frac = np.full((num_t, 3, 5), 100, dtype=np.uint8)

    # Shadow falls on cell (2, 0) at t >= 4
    for t in range(4, num_t):
        sun_frac[t, 0, 2] = 0

    # Only row 0 is traversable
    traversable = np.zeros((3, 5), dtype=bool)
    traversable[0, :] = True

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 5, "ny": 3},
        "time_utc": timestamps,
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((num_t, 3, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 5), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    speed_m_s = 0.01  # 36m / 0.01 m/s = 3600s = exactly 1 hour (1 dt step) per move
    start_coord = (0, 0)
    end_coord = (4, 0)

    # 1. Compute batch departure window map
    dep_map = compute_departure_window_map(
        visibility_cube=cube,
        start_coord=start_coord,
        end_coord=end_coord,
        speed_m_s=speed_m_s,
        dark_budget_h=0.0,
    )

    assert dep_map["total_departures_evaluated"] == num_t
    assert len(dep_map["departures"]) == num_t

    # 2. Brute-force check: solve each departure independently with plan_lunar_traverse
    feasible_count = 0
    infeasible_count = 0

    for t in range(num_t):
        bf_res = plan_lunar_traverse(
            visibility_cube=cube,
            start_coord=start_coord,
            end_coord=end_coord,
            start_time_idx=t,
            speed_m_s=speed_m_s,
            dark_budget_h=0.0,
        )
        map_entry = dep_map["departures"][t]

        assert map_entry["departure_idx"] == t
        assert map_entry["feasible"] == bf_res["feasible"], (
            f"Departure mismatch at step {t}: map feasible={map_entry['feasible']} vs bf={bf_res['feasible']}"
        )

        if bf_res["feasible"]:
            feasible_count += 1
            assert map_entry["arrival_idx"] == bf_res["path"][-1]["t"]
            assert abs(map_entry["duration_h"] - bf_res["metrics"]["duration_h"]) < 1e-4
            assert map_entry["path"] == bf_res["path"]
        else:
            infeasible_count += 1
            assert map_entry["arrival_idx"] is None
            assert map_entry["infeasible_reason"] is not None

    # Both feasible departures (t=0, t=1) and infeasible departures (t >= 2) must exist
    assert feasible_count > 0, "Must have feasible departures"
    assert infeasible_count > 0, "Must have infeasible departures (hatched gaps)"
    assert dep_map["earliest_feasible_idx"] == 0
    assert dep_map["latest_safe_idx"] == 1


def test_latest_safe_departure_matches_latest_departure_mode():
    """Verify that latest_safe_idx from departure window map equals planner_mode='latest_departure'."""
    num_t = 10
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    sun_frac = np.full((num_t, 3, 5), 100, dtype=np.uint8)

    # Shadow on ridge (2, 0) at t >= 5
    for t in range(5, num_t):
        sun_frac[t, 0, 2] = 0

    traversable = np.zeros((3, 5), dtype=bool)
    traversable[0, :] = True

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 5, "ny": 3},
        "time_utc": timestamps,
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((num_t, 3, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 5), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    speed_m_s = 0.01  # 1 step per cell
    start_coord = (0, 0)
    end_coord = (4, 0)

    # Map solver
    dep_map = compute_departure_window_map(
        visibility_cube=cube,
        start_coord=start_coord,
        end_coord=end_coord,
        speed_m_s=speed_m_s,
        dark_budget_h=0.0,
    )

    # Latest departure mode solver
    latest_mode_res = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=start_coord,
        end_coord=end_coord,
        start_time_idx=0,
        speed_m_s=speed_m_s,
        planner_mode="latest_departure",
        dark_budget_h=0.0,
    )

    assert latest_mode_res["feasible"] is True
    assert dep_map["latest_safe_idx"] is not None
    # The starting time index of the latest_departure path must equal latest_safe_idx
    assert latest_mode_res["path"][0]["t"] == dep_map["latest_safe_idx"]


def test_departure_window_map_200_departures_benchmark():
    """Verify that 200 departure times compute in under 3.0 seconds."""
    num_t = 200
    timestamps = [f"2026-11-01T{h // 24:02d}:{(h % 24):02d}:00Z" for h in range(num_t)]

    # 5x5 terrain, all traversable and sunlit
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 20.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    dep_map = compute_departure_window_map(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(4, 4),
        speed_m_s=0.10,
    )

    assert dep_map["total_departures_evaluated"] == 200
    assert len(dep_map["departures"]) == 200
    # Strict speed limit: must be well under 3.0 seconds
    assert dep_map["compute_time_s"] < 3.0, (
        f"Compute time {dep_map['compute_time_s']}s exceeds 3.0s requirement for 200 departures"
    )


def test_departure_window_map_plain_language_summary():
    """Verify factual, plain-language summary sentence generation from computed data."""
    num_t = 8
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    sun_frac = np.full((num_t, 2, 4), 100, dtype=np.uint8)

    # Shadow falls at step 3 on column 1
    for t in range(3, num_t):
        sun_frac[t, 0, 1] = 0

    traversable = np.zeros((2, 4), dtype=bool)
    traversable[0, :] = True

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 4, "ny": 2},
        "time_utc": timestamps,
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((num_t, 2, 4), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((2, 4), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    dep_map = compute_departure_window_map(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(3, 0),
        speed_m_s=0.01,
        dark_budget_h=0.0,
    )

    summary = dep_map["plain_language_summary"]
    assert "Leaving between" in summary
    assert "works; leaving after" in summary
    assert "does not because of" in summary
    assert "shadow" in summary.lower()





def test_mission_planner_hand_made_known_outcome():
    """Verify multi-stop mission plan on a known synthetic scenario.

    2 stops with known dwell and distance:
    - Base (0, 0) -> Stop 1 (2, 0): dist=72m, 2 steps (t=0..2)
    - Dwell at Stop 1: 1.0h, 1 step (t=2..3), earth upload >= 1.0h
    - Stop 1 (2, 0) -> Stop 2 (4, 0): dist=72m, 2 steps (t=3..5)
    - Dwell at Stop 2: 2.0h, 2 steps (t=5..7), deadline step 10
    Validates against schemas/mission_plan.schema.json.
    """
    with open(SCHEMAS_DIR / "mission_plan.schema.json", "r", encoding="utf-8") as f:
        plan_schema = json.load(f)

    num_t = 12
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    stops = [
        {
            "stop_id": "station_alpha",
            "name": "Station Alpha",
            "coord": [2, 0],
            "dwell_time_h": 1.0,
            "min_sun_frac": 0.50,
            "min_earth_frac": 0.50,
            "min_earth_duration_h": 1.0,
        },
        {
            "stop_id": "station_beta",
            "name": "Station Beta",
            "coord": [4, 0],
            "dwell_time_h": 2.0,
            "min_sun_frac": 0.50,
            "deadline_idx": 10,
        },
    ]

    plan = plan_mission(
        visibility_cube=cube,
        start_coord=(0, 0),
        start_time_idx=0,
        stops=stops,
        speed_m_s=0.01,  # 36m / 0.01 = 3600s = 1 step per cell
    )

    validate(instance=plan, schema=plan_schema)
    assert plan["feasible"] is True
    assert len(plan["violations"]) == 0
    assert len(plan["legs"]) == 2
    assert len(plan["dwells"]) == 2
    assert len(plan["timeline"]) == 4  # Leg 1, Dwell 1, Leg 2, Dwell 2

    # Verify exact timing
    assert plan["legs"][0]["start_time_idx"] == 0
    assert plan["legs"][0]["end_time_idx"] == 2
    assert plan["dwells"][0]["start_time_idx"] == 2
    assert plan["dwells"][0]["end_time_idx"] == 3
    assert plan["dwells"][0]["earth_satisfied"] is True

    assert plan["legs"][1]["start_time_idx"] == 3
    assert plan["legs"][1]["end_time_idx"] == 5
    assert plan["dwells"][1]["start_time_idx"] == 5
    assert plan["dwells"][1]["end_time_idx"] == 7
    assert plan["dwells"][1]["deadline_satisfied"] is True

    # Total metrics
    assert plan["metrics"]["total_distance_m"] == 144.0
    assert plan["metrics"]["transit_duration_h"] == 4.0
    assert plan["metrics"]["dwell_duration_h"] == 3.0
    assert plan["metrics"]["total_duration_h"] == 7.0
    assert plan["limits_disclaimer"] == "Geometric Sun and Earth visibility only; no power or link budget."


def test_mission_planner_reordering_makes_plan_feasible():
    """Verify that stop reordering restores plan feasibility when a deadline is missed."""
    num_t = 14
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    # Stop A has an early deadline (step 4). Stop B has a late deadline (step 12).
    stop_a = {
        "stop_id": "stop_a",
        "name": "Solar Ridge",
        "coord": [2, 0],
        "dwell_time_h": 1.0,
        "deadline_idx": 4,
    }
    stop_b = {
        "stop_id": "stop_b",
        "name": "Boulder Field",
        "coord": [0, 2],
        "dwell_time_h": 3.0,
        "deadline_idx": 12,
    }

    # Case 1: Inverted order [Stop B, Stop A]
    # Visiting B first takes: transit (0..2), dwell (2..5), transit B->A (5..7), dwell at A (7..8) -> MISSES deadline 4!
    bad_plan = plan_mission(
        visibility_cube=cube,
        start_coord=(0, 0),
        start_time_idx=0,
        stops=[stop_b, stop_a],
        speed_m_s=0.01,
    )
    assert bad_plan["feasible"] is False
    assert len(bad_plan["violations"]) > 0
    assert bad_plan["violations"][0]["type"] == "deadline_missed"
    assert "Solar Ridge" in bad_plan["violations"][0]["details"]

    # Smallest fix recommendation must suggest reordering stops
    rec = bad_plan["fix_recommendation"]
    assert rec is not None
    assert rec["type"] == "reorder_stops"
    assert "Solar Ridge" in rec["description"]

    # Case 2: Correct order [Stop A, Stop B]
    # Visiting A first: transit (0..2), dwell (2..3 <= 4 deadline PASS), transit A->B (3..5), dwell (5..8 <= 12 PASS)
    good_plan = plan_mission(
        visibility_cube=cube,
        start_coord=(0, 0),
        start_time_idx=0,
        stops=[stop_a, stop_b],
        speed_m_s=0.01,
    )
    assert good_plan["feasible"] is True
    assert len(good_plan["violations"]) == 0


def test_mission_planner_infeasible_explanation_and_smallest_fix():
    """Verify detailed infeasibility explanation and dwell-shortening fix."""
    num_t = 12
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    stops = [
        {
            "stop_id": "drilling_site",
            "name": "Drilling Site",
            "coord": [2, 0],
            "dwell_time_h": 4.0,  # 4 hours dwell
            "deadline_idx": 4,  # Must depart by step 4 (t=0..2 transit + 4h dwell = 6 > 4)
        },
    ]

    # Transit (0..2) -> dwell 4h (2..6) > deadline 4
    plan = plan_mission(
        visibility_cube=cube,
        start_coord=(0, 0),
        start_time_idx=0,
        stops=stops,
        speed_m_s=0.01,
    )

    assert plan["feasible"] is False
    assert any(v["type"] == "deadline_missed" for v in plan["violations"])
    assert "Drilling Site" in plan["violations"][0]["details"]

    # Smallest fix should recommend shortening dwell at Drilling Site
    rec = plan["fix_recommendation"]
    assert rec is not None
    assert rec["type"] == "shorter_dwell"
    assert rec["stop_name"] == "Drilling Site"
    assert rec["delta_h"] in [1.5, 2.0]
    assert rec["new_dwell_h"] <= 2.5


def test_mission_planner_consistency_with_single_leg_solver():
    """Verify that a single-stop plan with 0 dwell is strictly consistent with plan_lunar_traverse."""
    num_t = 10
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 25.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    start = (0, 0)
    dest = (3, 3)

    # 1. Single leg traverse
    single_res = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=start,
        end_coord=dest,
        start_time_idx=0,
        speed_m_s=0.05,
    )

    # 2. Multi-stop mission plan with 1 stop and 0.0 dwell
    mission_res = plan_mission(
        visibility_cube=cube,
        start_coord=start,
        start_time_idx=0,
        stops=[{"stop_id": "target", "name": "Target Point", "coord": list(dest), "dwell_time_h": 0.0}],
        speed_m_s=0.05,
    )

    assert mission_res["feasible"] == single_res["feasible"]
    assert len(mission_res["legs"]) == 1
    leg = mission_res["legs"][0]

    assert leg["path"] == single_res["path"]
    assert abs(leg["duration_h"] - single_res["metrics"]["duration_h"]) < 1e-4
    assert abs(leg["distance_m"] - single_res["metrics"]["total_distance_m"]) < 1e-4


def test_mission_plan_csv_and_ics_exports():
    """Verify CSV and ICS export strings contain proper format, headers, and disclaimers."""
    num_t = 8
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 36.0, "nx": 3, "ny": 3},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, 3, 3), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, 3, 3), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 3), dtype=np.float64).tolist(),
        "traversable": np.ones((3, 3), dtype=bool).tolist(),
        "flags": [],
    }

    plan = plan_mission(
        visibility_cube=cube,
        start_coord=(0, 0),
        start_time_idx=0,
        stops=[{"name": "Crater Peak", "coord": [2, 0], "dwell_time_h": 1.0}],
        speed_m_s=0.01,
        mission_name="Apollo-Heritage Sortie",
    )

    # 1. CSV Export Check
    csv_text = export_mission_plan_csv(plan)
    assert "# LightPath Lunar Mission Plan Export" in csv_text
    assert "Apollo-Heritage Sortie" in csv_text
    assert "Geometric Sun and Earth visibility only; no power or link budget." in csv_text
    assert "Event_ID,Type,Label" in csv_text
    assert "leg_1,transit" in csv_text
    assert "dwell_1,dwell" in csv_text

    # 2. ICS Export Check
    ics_text = export_mission_plan_ics(plan)
    assert "BEGIN:VCALENDAR" in ics_text
    assert "END:VCALENDAR" in ics_text
    assert "PRODID:-//LightPath//NASA Space Apps Lunar Mission Planner//EN" in ics_text
    assert "BEGIN:VEVENT" in ics_text
    assert "SUMMARY:[LightPath] Transit: Base Lander -> Crater Peak" in ics_text
    assert "SUMMARY:[LightPath] Dwell: Crater Peak (1.0h)" in ics_text
    assert "Geometric Sun and Earth visibility only; no power or link budget." in ics_text


def test_conservative_route_zero_margin_equals_nominal(sample_cube):
    """Test that with zero margin (horizon_margin_deg=0.0), conservative route equals nominal route."""
    start = (1, 1)
    end = (3, 3)

    comp = compare_nominal_and_conservative_routes(
        visibility_cube=sample_cube,
        start_coord=start,
        end_coord=end,
        start_time_idx=0,
        speed_m_s=0.05,
        horizon_margin_deg=0.0,
    )

    nom = comp["nominal"]
    cons = comp["conservative"]

    assert nom["feasible"] is True
    assert cons["feasible"] is True
    assert nom["path"] == cons["path"]
    assert nom["metrics"]["total_distance_m"] == cons["metrics"]["total_distance_m"]
    assert nom["metrics"]["duration_h"] == cons["metrics"]["duration_h"]
    assert comp["cost_of_caution"]["extra_distance_m"] == 0.0
    assert comp["cost_of_caution"]["extra_duration_h"] == 0.0


def test_conservative_route_cost_of_caution():
    """Verify that conservative route detours around marginal lighting, incurring caution cost."""
    # 5x5 grid:
    # Direct route through row 1 has marginal solar fraction (55%), threshold is 50%
    # With margin 0.10 deg, f_pess = 0.55 - 0.10 = 0.45 < 0.50 (marginal -> dark)
    # Row 2 has full solar fraction (100%)
    num_t = 6
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    sun_frac = np.full((num_t, 5, 5), 100, dtype=np.uint8)
    # Make direct corridor (y=1) marginal: 55%
    sun_frac[:, 1, :] = 55

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 20.0, "nx": 5, "ny": 5},
        "time_utc": timestamps,
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((num_t, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    # Start at (0, 1), Goal at (4, 1)
    # In nominal mode (margin=0), (0, 1)->(4, 1) goes straight along y=1 (distance = 80m)
    # In conservative mode (margin=0.10), y=1 is dark (0.55 - 0.10 = 0.45 < 0.50)
    # Since start (0, 1) itself is in y=1, start is marginal -> infeasible with zero dark budget
    comp = compare_nominal_and_conservative_routes(
        visibility_cube=cube,
        start_coord=(0, 1),
        end_coord=(4, 1),
        start_time_idx=0,
        speed_m_s=0.05,
        min_sun_frac=0.50,
        dark_budget_h=0.0,
        horizon_margin_deg=0.10,
    )
    assert comp["nominal"]["feasible"] is True
    assert comp["conservative"]["feasible"] is False
    assert "Conservative route is blocked under 0.10° horizon elevation margin" in comp["cost_of_caution"]["explanation"]


def test_landing_dispersion_uniform_terrain_gives_100_percent():
    """Verify that on uniform synthetic terrain, 25/25 landing points succeed (100% success rate)."""
    num_t = 15
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    nx, ny = 15, 15
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": nx, "ny": ny},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((ny, nx), dtype=np.float64).tolist(),
        "traversable": np.ones((ny, nx), dtype=bool).tolist(),
        "flags": [],
    }

    res = analyze_landing_dispersion(
        visibility_cube=cube,
        nominal_coord=(7, 7),
        goal_coord=(12, 12),
        radius_m=250.0,
        num_points=25,
        start_time_idx=0,
        speed_m_s=0.05,
    )

    assert res["success_count"] == 25
    assert res["failure_count"] == 0
    assert res["success_rate"] == 1.0
    assert len(res["points"]) == 25
    assert res["solve_time_ms"] > 0.0
    assert "All 25 of 25 landing points allow the trip within the window." in res["plain_language_summary"]
    assert res["min_arrival_h"] is not None
    assert res["max_arrival_h"] is not None
    assert res["min_arrival_h"] <= res["max_arrival_h"]


def test_landing_dispersion_wall_splitting_disc_gives_expected_share():
    """Verify that a wall splitting the dispersion disc in half gives the expected ~50% share."""
    num_t = 15
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    nx, ny = 20, 20
    traversable = np.ones((ny, nx), dtype=bool)
    # Center is at (10, 10), spacing is 50m, radius 250m spans x in [5, 15]
    # Place wall at x <= 10 (impassable cliff / ridge)
    # The left half of the disc (x <= 10) is blocked; the right half (x > 10) is traversable
    traversable[:, :11] = False  # Columns 0..10 are wall

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": nx, "ny": ny},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((ny, nx), dtype=np.float64).tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    res = analyze_landing_dispersion(
        visibility_cube=cube,
        nominal_coord=(10, 10),
        goal_coord=(18, 10),
        radius_m=250.0,
        num_points=25,
        start_time_idx=0,
        speed_m_s=0.05,
    )

    # In our 25-point symmetric pattern:
    # Center point (0, 0) is at x=10 (wall -> fails)
    # Ring 1 has 4 points at x > 10 and 4 at x < 10
    # Ring 2 has 8 points at x > 10 and 8 at x < 10
    # Exactly 4 + 8 = 12 points are at x > 10 (unblocked side)
    # Exactly 1 + 4 + 8 = 13 points are at x <= 10 (blocked wall side)
    assert res["success_count"] == 12
    assert res["failure_count"] == 13
    assert res["success_rate"] == 12 / 25  # 0.48
    assert "12 of 25 landing points allow the trip within the window" in res["plain_language_summary"]


def test_landing_dispersion_is_deterministic():
    """Verify that landing dispersion yields identical results across repeated calls."""
    num_t = 12
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(num_t)]
    nx, ny = 12, 12
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": nx, "ny": ny},
        "time_utc": timestamps,
        "sun_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((num_t, ny, nx), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((ny, nx), dtype=np.float64).tolist(),
        "traversable": np.ones((ny, nx), dtype=bool).tolist(),
        "flags": [],
    }

    res1 = analyze_landing_dispersion(cube, (6, 6), (10, 10), radius_m=250.0, num_points=25)
    res2 = analyze_landing_dispersion(cube, (6, 6), (10, 10), radius_m=250.0, num_points=25)

    assert res1["success_count"] == res2["success_count"]
    assert res1["success_rate"] == res2["success_rate"]
    assert res1["plain_language_summary"] == res2["plain_language_summary"]
    for p1, p2 in zip(res1["points"], res2["points"]):
        assert p1["coord"] == p2["coord"]
        assert p1["feasible"] == p2["feasible"]
        assert p1["arrival_h"] == p2["arrival_h"]
