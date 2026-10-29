"""Space-time route planner for lunar surface traverse under illumination and communication constraints.

Rules:
- Signature feature of LightPath: whether rover or crew can travel from A to B while light and link remain available.
- Conforms to schemas/route_result.schema.json.
- Deterministic A* graph search in space-time (x, y, t).
- Considers mechanical slope traversability (Horn method) and dynamic solar/earth visibility.
"""

import heapq
import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np


def plan_lunar_traverse(
    visibility_cube: Dict,
    start_coord: Tuple[int, int],
    end_coord: Tuple[int, int],
    start_time_idx: int = 0,
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
) -> Dict:
    """Find a feasible traverse path in space-time satisfying terrain and visibility constraints.

    Args:
        visibility_cube: Dict conforming to schemas/visibility_cube.schema.json.
        start_coord: (x_start, y_start) grid indices.
        end_coord: (x_end, y_end) grid indices.
        start_time_idx: Initial time index in time_utc.
        speed_m_s: Traverse speed in meters/second (default 0.05 m/s = 180 m/h for rover).
        mode: Traverse mode ('rover', 'crew', 'static_stay').
        max_slope_deg: Maximum allowable slope in degrees.
        min_sun_frac: Minimum required solar fraction [0.0, 1.0].
        min_earth_frac: Minimum required Earth visibility fraction [0.0, 1.0].
        allow_wait: Whether waiting in place is permitted.

    Returns:
        Dict conforming to schemas/route_result.schema.json.
    """
    grid = visibility_cube["grid"]
    nx, ny = grid["nx"], grid["ny"]
    spacing_m = float(grid["spacing_m"])
    timestamps = visibility_cube["time_utc"]
    num_t = len(timestamps)

    # Time step duration in seconds
    if num_t > 1:
        dt0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        dt1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00"))
        step_dt_s = max(1.0, (dt1 - dt0).total_seconds())
    else:
        step_dt_s = 3600.0

    sun_frac_cube = np.array(visibility_cube["sun_frac"], dtype=np.uint8)  # (T, Y, X)
    earth_frac_cube = np.array(visibility_cube["earth_frac"], dtype=np.uint8)
    slope_grid = np.array(visibility_cube["slope_deg"], dtype=np.float64)
    traversable_grid = np.array(visibility_cube["traversable"], dtype=bool)

    sx, sy = start_coord
    gx, gy = end_coord

    params_dict = {
        "start_coord": [sx, sy],
        "end_coord": [gx, gy],
        "start_time_idx": start_time_idx,
        "speed_m_s": speed_m_s,
        "max_slope_deg": max_slope_deg,
        "min_sun_frac": min_sun_frac,
        "min_earth_frac": min_earth_frac,
    }

    # Bounds validation
    for coord, label in [((sx, sy), "start_coord"), ((gx, gy), "end_coord")]:
        cx, cy = coord
        if not (0 <= cx < nx and 0 <= cy < ny):
            return _create_infeasible_result(
                mode=mode,
                params=params_dict,
                explanation=f"{label} {coord} is outside grid boundaries ({nx}x{ny}).",
            )

    if start_time_idx < 0 or start_time_idx >= num_t:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"start_time_idx {start_time_idx} is outside time horizon (0..{num_t-1}).",
        )

    # Check start cell conditions
    if not traversable_grid[sy, sx] or slope_grid[sy, sx] > max_slope_deg:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"Start location ({sx}, {sy}) slope ({slope_grid[sy, sx]:.1f} deg) exceeds max limit {max_slope_deg} deg.",
        )

    if (sun_frac_cube[start_time_idx, sy, sx] / 100.0) < min_sun_frac:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"Start location ({sx}, {sy}) has insufficient solar fraction at initial time.",
        )

    # Space-time A* Priority Queue: (f_score, g_time_s, x, y, t_idx)
    def heuristic(x: int, y: int) -> float:
        dist_m = math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m)
        return dist_m / speed_m_s

    start_h = heuristic(sx, sy)
    open_heap = [(start_h, 0.0, sx, sy, start_time_idx)]
    came_from: Dict[Tuple[int, int, int], Optional[Tuple[int, int, int]]] = {(sx, sy, start_time_idx): None}
    cost_so_far: Dict[Tuple[int, int, int], float] = {(sx, sy, start_time_idx): 0.0}

    # Neighbor motions: 8 directions + stay
    moves = [
        (1, 0, spacing_m), (-1, 0, spacing_m), (0, 1, spacing_m), (0, -1, spacing_m),
        (1, 1, spacing_m * math.sqrt(2)), (-1, 1, spacing_m * math.sqrt(2)),
        (1, -1, spacing_m * math.sqrt(2)), (-1, -1, spacing_m * math.sqrt(2)),
    ]
    if allow_wait:
        moves.append((0, 0, 0.0))

    goal_node: Optional[Tuple[int, int, int]] = None
    visited_states = 0
    max_states = 100000

    while open_heap and visited_states < max_states:
        visited_states += 1
        f, g, cx, cy, ct = heapq.heappop(open_heap)

        if (cx, cy) == (gx, gy):
            goal_node = (cx, cy, ct)
            break

        for dx, dy, move_dist_m in moves:
            nx_cell = cx + dx
            ny_cell = cy + dy

            if not (0 <= nx_cell < nx and 0 <= ny_cell < ny):
                continue

            # Mechanical traversability
            if not traversable_grid[ny_cell, nx_cell] or slope_grid[ny_cell, nx_cell] > max_slope_deg:
                continue

            # Time calculation
            if move_dist_m == 0.0:
                # Wait action advances 1 time step
                transit_s = step_dt_s
                nt = ct + 1
            else:
                transit_s = move_dist_m / speed_m_s
                dt_steps = max(1, int(round(transit_s / step_dt_s)))
                nt = ct + dt_steps

            if nt >= num_t:
                continue  # Exceeds simulation horizon

            # Dynamic lighting and link constraints at target arrival time
            s_frac = sun_frac_cube[nt, ny_cell, nx_cell] / 100.0
            if s_frac < min_sun_frac:
                continue

            e_frac = earth_frac_cube[nt, ny_cell, nx_cell] / 100.0
            if e_frac < min_earth_frac:
                continue

            new_g = g + transit_s
            next_state = (nx_cell, ny_cell, nt)

            if next_state not in cost_so_far or new_g < cost_so_far[next_state]:
                cost_so_far[next_state] = new_g
                priority = new_g + heuristic(nx_cell, ny_cell)
                heapq.heappush(open_heap, (priority, new_g, nx_cell, ny_cell, nt))
                came_from[next_state] = (cx, cy, ct)

    if goal_node is None:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=(
                f"No feasible path found from ({sx}, {sy}) to ({gx}, {gy}). "
                f"Terrain slopes exceed {max_slope_deg} deg or shadowing/occlusion blocks continuous traverse."
            ),
        )

    # Reconstruct path
    path_nodes: List[Tuple[int, int, int]] = []
    curr: Optional[Tuple[int, int, int]] = goal_node
    while curr is not None:
        path_nodes.append(curr)
        curr = came_from.get(curr)
    path_nodes.reverse()

    # Compute metrics
    path_list = [{"x": px, "y": py, "t": pt} for px, py, pt in path_nodes]
    total_dist_m = 0.0
    slopes: List[float] = []
    sun_obs: List[float] = []
    earth_obs: List[float] = []

    for i in range(len(path_nodes)):
        px, py, pt = path_nodes[i]
        slopes.append(float(slope_grid[py, px]))
        sun_obs.append(float(sun_frac_cube[pt, py, px]) / 100.0)
        earth_obs.append(float(earth_frac_cube[pt, py, px]) / 100.0)

        if i > 0:
            ppx, ppy, _ = path_nodes[i - 1]
            step_d = math.hypot((px - ppx) * spacing_m, (py - ppy) * spacing_m)
            total_dist_m += step_d

    total_duration_s = cost_so_far[goal_node]
    duration_h = total_duration_s / 3600.0

    metrics = {
        "total_distance_m": round(total_dist_m, 1),
        "duration_h": round(duration_h, 2),
        "average_slope_deg": round(float(np.mean(slopes)), 2) if slopes else 0.0,
        "max_slope_deg": round(float(np.max(slopes)), 2) if slopes else 0.0,
        "min_sun_frac_observed": round(float(np.min(sun_obs)), 3) if sun_obs else 1.0,
        "min_earth_frac_observed": round(float(np.min(earth_obs)), 3) if earth_obs else 1.0,
    }

    explanation = (
        f"Feasible traverse found for {mode}: {len(path_list)} waypoints, "
        f"distance {total_dist_m:.1f} m in {duration_h:.2f} h. "
        f"Maximum slope encountered is {metrics['max_slope_deg']} deg with minimum illumination "
        f"{metrics['min_sun_frac_observed'] * 100:.0f}%."
    )

    return {
        "mode": mode,
        "params": params_dict,
        "feasible": True,
        "path": path_list,
        "metrics": metrics,
        "alternatives": [],
        "explanation": explanation,
    }


def _create_infeasible_result(
    mode: str,
    params: Dict,
    explanation: str,
) -> Dict:
    """Helper to return an infeasible result conforming to route_result schema."""
    return {
        "mode": mode,
        "params": params,
        "feasible": False,
        "path": [],
        "metrics": {
            "total_distance_m": 0.0,
            "duration_h": 0.0,
            "average_slope_deg": 0.0,
            "max_slope_deg": 0.0,
            "min_sun_frac_observed": 0.0,
            "min_earth_frac_observed": 0.0,
        },
        "alternatives": [],
        "explanation": explanation,
    }
