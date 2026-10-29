"""Spatial scan and terrain-area evaluation using visibility cubes.

Complies with docs/PROJECT_RULES.md:
- Reuses visibility cube (LPVC) data across time and space.
- Strictly adheres to wording rules: "visible" not "powered", "in line of sight" not "connected".
- Accounts for terrain-data uncertainty: differences smaller than the uncertainty
  band are flagged as not statistically meaningful.
- Generates reproducible, deterministic metrics and top-five ranking.
"""

import math
from typing import Any, Dict, List, Optional

import numpy as np


def compute_scan_metric_grid(
    cube_data: Dict[str, Any],
    metric: str = "sun",
    threshold: float = 0.50,
    start_t: int = 0,
    end_t: Optional[int] = None,
    dte_link_ok: Optional[List[bool]] = None,
) -> np.ndarray:
    """Compute the spatial grid of uptime percentages for a given metric over a time window.

    Args:
        cube_data: Dictionary matching schemas/visibility_cube.schema.json,
                   containing sun_frac, earth_frac, slope_deg, time_utc.
        metric: One of 'sun', 'earth', or 'joint_dte'.
        threshold: Fraction in [0.0, 1.0] defining minimum disc fraction.
        start_t: Starting time index (inclusive).
        end_t: Ending time index (exclusive). If None, uses all time steps.
        dte_link_ok: Optional list of booleans of length nt indicating Earth ground
                     station line of sight. If None, defaults to True for all steps.

    Returns:
        2D float64 numpy array of shape (ny, nx) containing percent of time in [0.0, 100.0].
    """
    sun_cube = np.array(cube_data["sun_frac"], dtype=np.float64)  # (nt, ny, nx) in [0, 100]
    earth_cube = np.array(cube_data["earth_frac"], dtype=np.float64)  # (nt, ny, nx) in [0, 100]

    nt, ny, nx = sun_cube.shape
    if end_t is None or end_t > nt:
        end_t = nt
    if start_t < 0 or start_t >= end_t:
        raise ValueError(f"Invalid time window range: [{start_t}, {end_t}) with nt={nt}")

    slice_len = end_t - start_t
    if slice_len <= 0:
        raise ValueError("Time window length must be positive.")

    thresh_val = float(threshold) * 100.0  # Scale to [0, 100]

    sun_slice = sun_cube[start_t:end_t]
    earth_slice = earth_cube[start_t:end_t]

    if metric == "sun":
        # Fraction of time steps where Sun disc fraction >= threshold
        mask = sun_slice >= thresh_val
        grid = (np.sum(mask, axis=0) / float(slice_len)) * 100.0
    elif metric == "earth":
        # Fraction of time steps where Earth disc fraction >= threshold
        mask = earth_slice >= thresh_val
        grid = (np.sum(mask, axis=0) / float(slice_len)) * 100.0
    elif metric == "joint_dte":
        # Fraction of time steps where Sun is visible AND Earth is visible with DSN link ok
        sun_ok = sun_slice >= thresh_val
        earth_ok = earth_slice >= thresh_val

        if dte_link_ok is not None:
            # Broadcast DTE station link availability along time axis
            dte_window = np.array(dte_link_ok[start_t:end_t], dtype=bool)[:, np.newaxis, np.newaxis]
            mask = sun_ok & earth_ok & dte_window
        else:
            mask = sun_ok & earth_ok

        grid = (np.sum(mask, axis=0) / float(slice_len)) * 100.0
    else:
        raise ValueError(f"Unknown metric '{metric}'. Expected 'sun', 'earth', or 'joint_dte'.")

    return np.round(grid, decimals=4)


def compute_scan_summary(
    grid: np.ndarray,
    cube_data: Dict[str, Any],
    metric: str = "earth",
    threshold: float = 0.50,
    uncertainty_pct: float = 1.5,
    window_hours: Optional[float] = None,
) -> Dict[str, Any]:
    """Compute center comparison, best cell, top-five cells, and templated summary sentence.

    Args:
        grid: 2D numpy array of shape (ny, nx) with metric values in [0.0, 100.0].
        cube_data: Dictionary matching schemas/visibility_cube.schema.json.
        metric: 'sun', 'earth', or 'joint_dte'.
        threshold: Active threshold fraction in [0.0, 1.0].
        uncertainty_pct: Terrain-data uncertainty band (default 1.5%).
        window_hours: Total hours of the scanned window.

    Returns:
        Structured dictionary conforming to scan output contract.
    """
    ny, nx = grid.shape
    center_y = ny // 2
    center_x = nx // 2
    center_val = float(grid[center_y, center_x])

    grid_meta = cube_data.get("grid", {})
    spacing_m = float(grid_meta.get("spacing_m", 40.0))
    slope_grid = np.array(cube_data.get("slope_deg", np.zeros((ny, nx))), dtype=np.float64)

    # Find the best nearby cell (highest value, then minimum slope, then minimum distance to center)
    best_y = center_y
    best_x = center_x
    best_val = center_val

    all_cells: List[Dict[str, Any]] = []

    for r in range(ny):
        for c in range(nx):
            val = float(grid[r, c])
            delta = val - center_val
            dx = (c - center_x) * spacing_m
            dy = (r - center_y) * spacing_m
            dist = math.hypot(dx, dy)
            is_meaningful = abs(delta) > uncertainty_pct
            slope = float(slope_grid[r, c]) if slope_grid.shape == (ny, nx) else 0.0

            cell_info = {
                "x": c,
                "y": r,
                "val_pct": round(val, 2),
                "delta_from_center_pct": round(delta, 2),
                "is_meaningful": is_meaningful,
                "offset_dx_m": round(dx, 1),
                "offset_dy_m": round(dy, 1),
                "distance_from_center_m": round(dist, 1),
                "slope_deg": round(slope, 1),
            }
            all_cells.append(cell_info)

            # Update best candidate
            if (val > best_val) or (
                math.isclose(val, best_val, abs_tol=1e-5)
                and (dist < math.hypot((best_x - center_x) * spacing_m, (best_y - center_y) * spacing_m))
            ):
                best_val = val
                best_y = r
                best_x = c

    # Sort descending by metric value, breaking ties by lowest slope, then lowest distance
    sorted_cells = sorted(
        all_cells,
        key=lambda c: (-c["val_pct"], c["slope_deg"], c["distance_from_center_m"]),
    )

    # Assign top 5 ranks
    top_5 = []
    for rank, cell in enumerate(sorted_cells[:5], start=1):
        ranked_cell = dict(cell)
        ranked_cell["rank"] = rank
        top_5.append(ranked_cell)

    # Generate authoritative sentence from template
    sentence = generate_scan_sentence(
        center_val_pct=center_val,
        best_val_pct=best_val,
        metric=metric,
        threshold=threshold,
        uncertainty_pct=uncertainty_pct,
        window_hours=window_hours,
    )

    return {
        "metric": metric,
        "threshold": threshold,
        "uncertainty_pct": uncertainty_pct,
        "center_cell": {
            "x": center_x,
            "y": center_y,
            "val_pct": round(center_val, 2),
        },
        "best_cell": {
            "x": best_x,
            "y": best_y,
            "val_pct": round(best_val, 2),
            "delta_pct": round(best_val - center_val, 2),
            "is_meaningful": abs(best_val - center_val) > uncertainty_pct,
        },
        "sentence": sentence,
        "top_5_cells": top_5,
    }


def generate_scan_sentence(
    center_val_pct: float,
    best_val_pct: float,
    metric: str = "earth",
    threshold: float = 0.50,
    uncertainty_pct: float = 1.5,
    window_hours: Optional[float] = None,
) -> str:
    """Generate the exact prompt-specified sentence from data:

    'moving from the centre to the best nearby cell changes Earth visibility from X percent to Y percent.'

    Rules:
    - Strictly 'visible' / 'in line of sight', never 'power' / 'connected'.
    - Numbers extracted strictly from data.
    """
    metric_labels = {
        "sun": "Sun visibility",
        "earth": "Earth visibility",
        "joint_dte": "Sun plus direct-to-Earth contact",
    }
    label = metric_labels.get(metric, f"{metric} visibility")

    # Format numbers cleanly
    x_str = f"{center_val_pct:.1f}"
    y_str = f"{best_val_pct:.1f}"

    delta = best_val_pct - center_val_pct

    base_sentence = f"Moving from the centre to the best nearby cell changes {label} from {x_str} percent to {y_str} percent."

    if abs(delta) <= uncertainty_pct:
        return f"{base_sentence} (Difference of {delta:+.1f}% is within terrain-data uncertainty of ±{uncertainty_pct:.1f}%; not meaningful)."

    return f"{base_sentence} (A meaningful difference of {delta:+.1f}%; threshold ≥ {int(round(threshold*100))}% disc)."
