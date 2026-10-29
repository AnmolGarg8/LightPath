"""Unit tests for pipeline.cube and pipeline.routing modules."""

import json
from pathlib import Path

import numpy as np
import pytest
from jsonschema import validate

from pipeline.cube import compute_visibility_cube, generate_polar_grid_coordinates
from pipeline.routing import plan_lunar_traverse

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
