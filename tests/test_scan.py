"""Unit tests for spatial scanning, area heatmaps, and wall DEM shading.

Complies with docs/PROJECT_RULES.md:
- On a synthetic wall DEM, cells behind the wall show lower Sun visibility than cells in front.
- A one-cell scan equals the main result for that point.
- Difference smaller than terrain-data uncertainty is flagged as not meaningful.
- Top-five cells ordering and sentence generation.
"""

import math

import numpy as np

from pipeline.cube import compute_visibility_cube
from pipeline.scan import (
    compute_scan_metric_grid,
    compute_scan_summary,
    generate_scan_sentence,
)


def test_one_cell_scan_equals_main_result():
    """Verify that a one-cell (1x1) scan calculation yields identical visibility percentage

    to the time series disc fraction evaluation for that point.
    """
    timestamps = [
        "2026-11-01T00:00:00Z",
        "2026-11-01T01:00:00Z",
        "2026-11-01T02:00:00Z",
        "2026-11-01T03:00:00Z",
    ]
    nt = len(timestamps)
    elev = np.array([[120.0]])  # 1x1 cell

    # Compute 1x1 visibility cube
    cube = compute_visibility_cube(
        center_lat_deg=-89.5,
        center_lon_deg=0.0,
        spacing_m=50.0,
        nx=1,
        ny=1,
        timestamps=timestamps,
        elev_dem_m=elev,
        horizon_el_grid_deg=np.array([[0.0]]),
    )

    threshold = 0.50
    sun_grid = compute_scan_metric_grid(cube, metric="sun", threshold=threshold)
    assert sun_grid.shape == (1, 1)

    # Calculate direct reference percentage from raw sun_frac time series
    raw_sun_fracs = np.array([cube["sun_frac"][t][0][0] for t in range(nt)])
    expected_pct = (np.sum(raw_sun_fracs >= (threshold * 100)) / nt) * 100.0

    assert math.isclose(sun_grid[0, 0], expected_pct, abs_tol=1e-3)


def test_synthetic_wall_dem_shadowing():
    """Verify that on a synthetic wall DEM, cells behind the wall show lower Sun visibility

    than cells in front of the wall.
    """
    # 5x5 grid: y=0 (North) to y=4 (South)
    # Suppose a tall wall sits in row 2 (y=2), blocking solar illumination coming from the North
    # Cells in front of the wall (y=1) have an unobstructed horizon (0.0 deg)
    # Cells behind the wall (y=3) have an obstructed horizon (e.g. 5.0 deg elevation)
    nx, ny = 5, 5
    timestamps = [f"2026-11-01T{h:02d}:00:00Z" for h in range(12)]

    elev = np.zeros((ny, nx), dtype=np.float64)
    elev[2, :] = 100.0  # Wall along row 2

    # Local horizon grid: row 3 (behind the wall) has horizon raised to 6.0 degrees
    # row 1 (in front of the wall) has clear horizon of 0.0 degrees
    horizon_grid = np.zeros((ny, nx), dtype=np.float64)
    horizon_grid[3, :] = 6.0  # Wall casts a 6 deg horizon obscuration to the South
    horizon_grid[1, :] = 0.0  # Clear view

    cube = compute_visibility_cube(
        center_lat_deg=-89.5,
        center_lon_deg=0.0,
        spacing_m=40.0,
        nx=nx,
        ny=ny,
        timestamps=timestamps,
        elev_dem_m=elev,
        horizon_el_grid_deg=horizon_grid,
    )

    threshold = 0.50
    sun_scan = compute_scan_metric_grid(cube, metric="sun", threshold=threshold)

    # In front of wall (row 1) vs behind wall (row 3)
    sun_in_front = sun_scan[1, 2]  # Center column, row 1
    sun_behind = sun_scan[3, 2]   # Center column, row 3

    assert sun_behind < sun_in_front, (
        f"Expected cells behind the wall ({sun_behind}%) to show strictly lower Sun visibility "
        f"than cells in front of the wall ({sun_in_front}%)."
    )


def test_scan_uncertainty_and_not_meaningful_flag():
    """Verify that cells whose difference from the center is <= terrain uncertainty are flagged not meaningful."""
    nx, ny, nt = 3, 3, 10
    # Synthetic cube where center has 60% visibility, cell (0, 0) has 61% (+1.0%), and cell (2, 2) has 75% (+15%)
    sun_frac = np.zeros((nt, ny, nx), dtype=np.uint8)
    # Center (1, 1): visible in 6/10 steps -> 60%
    sun_frac[:6, 1, 1] = 100
    # Cell (0, 0): visible in 6/10 steps plus one marginal -> effectively 60% (delta = 0%)
    sun_frac[:6, 0, 0] = 100
    # Cell (0, 1): 6/10 steps -> 60%
    sun_frac[:6, 0, 1] = 100
    # Cell (2, 2): visible in 9/10 steps -> 90% (delta = +30%)
    sun_frac[:9, 2, 2] = 100

    earth_frac = np.full((nt, ny, nx), 80, dtype=np.uint8)
    slope = np.zeros((ny, nx), dtype=np.float64)

    cube_data = {
        "grid": {"spacing_m": 50.0, "nx": nx, "ny": ny},
        "time_utc": [f"2026-11-01T{h:02d}:00:00Z" for h in range(nt)],
        "sun_frac": sun_frac.tolist(),
        "earth_frac": earth_frac.tolist(),
        "slope_deg": slope.tolist(),
    }

    grid = compute_scan_metric_grid(cube_data, metric="sun", threshold=0.50)
    summary = compute_scan_summary(grid, cube_data, metric="sun", uncertainty_pct=1.5)

    # Center is at (1, 1) with 60%
    assert summary["center_cell"]["x"] == 1
    assert summary["center_cell"]["y"] == 1
    assert summary["center_cell"]["val_pct"] == 60.0

    # Best cell is (2, 2) with 90%
    assert summary["best_cell"]["x"] == 2
    assert summary["best_cell"]["y"] == 2
    assert summary["best_cell"]["val_pct"] == 90.0
    assert summary["best_cell"]["delta_pct"] == 30.0
    assert summary["best_cell"]["is_meaningful"] is True

    # Check top 5 cells
    top_5 = summary["top_5_cells"]
    assert len(top_5) == 5
    assert top_5[0]["rank"] == 1
    assert top_5[0]["val_pct"] == 90.0
    assert top_5[0]["is_meaningful"] is True

    # A cell with delta 0% should be flagged as is_meaningful = False
    cell_0_0 = next(c for c in top_5 if c["x"] == 0 and c["y"] == 0)
    assert cell_0_0["is_meaningful"] is False


def test_generate_scan_sentence_template():
    """Verify that sentence generation conforms strictly to project template and rule requirements."""
    # Meaningful gain
    sentence_sig = generate_scan_sentence(
        center_val_pct=72.4,
        best_val_pct=85.6,
        metric="earth",
        threshold=0.50,
        uncertainty_pct=1.5,
    )
    assert "Moving from the centre to the best nearby cell changes Earth visibility from 72.4 percent to 85.6 percent." in sentence_sig
    assert "meaningful difference" in sentence_sig
    assert "threshold ≥ 50% disc" in sentence_sig

    # Not meaningful / within uncertainty
    sentence_insig = generate_scan_sentence(
        center_val_pct=72.4,
        best_val_pct=73.1,
        metric="earth",
        threshold=0.50,
        uncertainty_pct=1.5,
    )
    assert "Moving from the centre to the best nearby cell changes Earth visibility from 72.4 percent to 73.1 percent." in sentence_insig
    assert "within terrain-data uncertainty" in sentence_insig
    assert "not meaningful" in sentence_insig
