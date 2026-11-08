"""Space-time route planner and departure window mapper for lunar surface traverse.

Rules:
- Signature feature of LightPath: whether rover or crew can travel from A to B while light and link remain available.
- Conforms to schemas/route_result.schema.json.
- Deterministic A* graph search in space-time (x, y, t).
- Considers mechanical slope traversability (Horn method) and dynamic solar/earth visibility.
- Computes comprehensive departure window maps evaluating feasibility across all time steps.
"""

from __future__ import annotations

import heapq
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


def plan_lunar_traverse(
    visibility_cube: Dict[str, Any],
    start_coord: Tuple[int, int],
    end_coord: Tuple[int, int],
    start_time_idx: int = 0,
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
    dark_budget_h: float = 0.0,
    planner_mode: str = "earliest_arrival",
    conservative: bool = False,
    horizon_margin_deg: float = 0.0,
) -> Dict[str, Any]:
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
        dark_budget_h: Allowable darkness hours along traverse.
        planner_mode: 'earliest_arrival' (default), 'latest_departure', or 'min_darkness'.
        conservative: If True, raise horizon by horizon_margin_deg so marginal cells count as dark.
        horizon_margin_deg: Horizon elevation margin in degrees (e.g. 0.10 deg).

    Returns:
        Dict conforming to schemas/route_result.schema.json.
    """
    grid = visibility_cube["grid"]
    nx, ny = grid["nx"], grid["ny"]
    spacing_m = float(grid["spacing_m"])
    timestamps = visibility_cube["time_utc"]
    num_t = len(timestamps)

    eff_margin = horizon_margin_deg if conservative else 0.0

    params_dict = {
        "start_coord": [start_coord[0], start_coord[1]],
        "end_coord": [end_coord[0], end_coord[1]],
        "start_time_idx": start_time_idx,
        "speed_m_s": speed_m_s,
        "max_slope_deg": max_slope_deg,
        "min_sun_frac": min_sun_frac,
        "min_earth_frac": min_earth_frac,
        "dark_budget_h": dark_budget_h,
        "planner_mode": planner_mode,
        "conservative": conservative,
        "horizon_margin_deg": horizon_margin_deg,
    }

    # Strict input validation
    if speed_m_s <= 0.0:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"speed_m_s must be strictly positive (> 0.0), got {speed_m_s}.",
        )

    # If planner_mode is 'latest_departure', search backward from the end of horizon
    if planner_mode == "latest_departure":
        for dep_t in range(num_t - 1, start_time_idx - 1, -1):
            res = plan_lunar_traverse(
                visibility_cube=visibility_cube,
                start_coord=start_coord,
                end_coord=end_coord,
                start_time_idx=dep_t,
                speed_m_s=speed_m_s,
                mode=mode,
                max_slope_deg=max_slope_deg,
                min_sun_frac=min_sun_frac,
                min_earth_frac=min_earth_frac,
                allow_wait=allow_wait,
                dark_budget_h=dark_budget_h,
                planner_mode="earliest_arrival",
            )
            if res["feasible"]:
                res["params"]["planner_mode"] = "latest_departure"
                res["explanation"] += f" (Latest safe departure identified at step {dep_t} [{timestamps[dep_t]}])."
                return res
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"No safe departure found between step {start_time_idx} and step {num_t - 1}.",
        )

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

    start_sun_frac = sun_frac_cube[start_time_idx, sy, sx] / 100.0
    if (start_sun_frac - eff_margin) < min_sun_frac:
        margin_note = f" (marginal under {eff_margin:.2f}° horizon elevation margin)" if eff_margin > 0.0 else ""
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=f"Start location ({sx}, {sy}) has insufficient solar fraction at departure time {timestamps[start_time_idx]}{margin_note}.",
        )

    # Space-time A* Priority Queue: (priority, g_time_s, x, y, t_idx)
    def heuristic(x: int, y: int) -> float:
        dist_m = math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m)
        return dist_m / speed_m_s

    start_h = heuristic(sx, sy)
    open_heap = [(start_h, 0.0, sx, sy, start_time_idx)]
    came_from: Dict[Tuple[int, int, int], Optional[Tuple[int, int, int]]] = {(sx, sy, start_time_idx): None}
    cost_so_far: Dict[Tuple[int, int, int], float] = {(sx, sy, start_time_idx): 0.0}
    dark_so_far: Dict[Tuple[int, int, int], float] = {(sx, sy, start_time_idx): 0.0}

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

        if g > cost_so_far.get((cx, cy, ct), g) + 1e-9:
            continue

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

            # Prevent diagonal moves through blocked corners (corner-cutting check)
            if dx != 0 and dy != 0:
                if (not traversable_grid[cy, nx_cell] or slope_grid[cy, nx_cell] > max_slope_deg) or \
                   (not traversable_grid[ny_cell, cx] or slope_grid[ny_cell, cx] > max_slope_deg):
                    continue

            # Time calculation: discretise accumulated transit time via ceiling (round-up)
            if move_dist_m == 0.0:
                transit_s = step_dt_s
            else:
                transit_s = move_dist_m / speed_m_s

            new_g = g + transit_s
            dt_steps = math.ceil(round(new_g / step_dt_s, 9)) if new_g > 0.0 else 0
            nt = start_time_idx + dt_steps

            if nt >= num_t:
                continue  # Exceeds simulation horizon

            # Dynamic lighting and link constraints: interval check in conservative mode, arrival step in nominal mode
            if eff_margin > 0.0:
                s_frac = min(sun_frac_cube[t, ny_cell, nx_cell] for t in range(ct, nt + 1)) / 100.0
                e_frac = min(earth_frac_cube[t, ny_cell, nx_cell] for t in range(ct, nt + 1)) / 100.0
            else:
                s_frac = sun_frac_cube[nt, ny_cell, nx_cell] / 100.0
                e_frac = earth_frac_cube[nt, ny_cell, nx_cell] / 100.0

            is_dark = (s_frac - eff_margin) < min_sun_frac
            current_dark_s = dark_so_far.get((cx, cy, ct), 0.0)
            if is_dark:
                if dark_budget_h <= 0.0:
                    continue  # Zero dark budget: no shadow traversal allowed
                if current_dark_s + transit_s > (dark_budget_h * 3600.0 + 1e-6):
                    continue  # Exceeds allowable darkness budget

            if e_frac < min_earth_frac:
                continue

            new_g = g + transit_s
            next_state = (nx_cell, ny_cell, nt)
            new_dark_s = current_dark_s + transit_s if is_dark else current_dark_s

            if next_state not in cost_so_far or new_g < cost_so_far[next_state]:
                cost_so_far[next_state] = new_g
                dark_so_far[next_state] = new_dark_s
                priority = new_g + heuristic(nx_cell, ny_cell)
                heapq.heappush(open_heap, (priority, new_g, nx_cell, ny_cell, nt))
                came_from[next_state] = (cx, cy, ct)

    if goal_node is None:
        return _create_infeasible_result(
            mode=mode,
            params=params_dict,
            explanation=(
                f"No feasible path found from ({sx}, {sy}) to ({gx}, {gy}) starting at {timestamps[start_time_idx]}. "
                f"Terrain slopes exceed {max_slope_deg} deg or moving shadows block the corridor."
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
    total_dark_s = 0.0
    slopes: List[float] = []
    sun_obs: List[float] = []
    earth_obs: List[float] = []

    for i in range(len(path_nodes)):
        px, py, pt = path_nodes[i]
        slopes.append(float(slope_grid[py, px]))
        sf = float(sun_frac_cube[pt, py, px]) / 100.0
        sun_obs.append(sf)
        earth_obs.append(float(earth_frac_cube[pt, py, px]) / 100.0)

        if i > 0:
            ppx, ppy, ppt = path_nodes[i - 1]
            step_d = math.hypot((px - ppx) * spacing_m, (py - ppy) * spacing_m)
            step_s = step_dt_s if step_d == 0.0 else step_d / speed_m_s
            total_dist_m += step_d
            if sf < min_sun_frac:
                total_dark_s += step_s

    total_duration_s = cost_so_far[goal_node]
    duration_h = total_duration_s / 3600.0
    dark_duration_h = round(total_dark_s / 3600.0, 3)

    metrics = {
        "total_distance_m": round(total_dist_m, 1),
        "duration_h": round(duration_h, 2),
        "dark_duration_h": dark_duration_h,
        "average_slope_deg": round(float(np.mean(slopes)), 2) if slopes else 0.0,
        "max_slope_deg": round(float(np.max(slopes)), 2) if slopes else 0.0,
        "min_sun_frac_observed": round(float(np.min(sun_obs)), 3) if sun_obs else 1.0,
        "min_earth_frac_observed": round(float(np.min(earth_obs)), 3) if earth_obs else 1.0,
    }

    explanation = (
        f"Feasible traverse found for {mode}: {len(path_list)} waypoints, "
        f"distance {total_dist_m:.1f} m in {duration_h:.2f} h (darkness: {dark_duration_h} h). "
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
    params: Dict[str, Any],
    explanation: str,
) -> Dict[str, Any]:
    """Helper to return an infeasible result conforming to route_result schema."""
    return {
        "mode": mode,
        "params": params,
        "feasible": False,
        "path": [],
        "metrics": {
            "total_distance_m": 0.0,
            "duration_h": 0.0,
            "dark_duration_h": 0.0,
            "average_slope_deg": 0.0,
            "max_slope_deg": 0.0,
            "min_sun_frac_observed": 0.0,
            "min_earth_frac_observed": 0.0,
        },
        "alternatives": [],
        "explanation": explanation,
    }


def compute_departure_window_map(
    visibility_cube: Dict[str, Any],
    start_coord: Tuple[int, int],
    end_coord: Tuple[int, int],
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
    dark_budget_h: float = 0.0,
    max_departure_idx: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute traverse feasibility, duration, and dark exposure across every departure time.

    Evaluates departure time indices from 0 to num_t - 1 (or max_departure_idx).
    Pre-extracts underlying raster grids once for high performance.
    Identifies:
      - Earliest feasible departure
      - Latest safe departure
      - Departure with lowest dark exposure
      - Plain-language summary explaining feasible windows and blocking causes.

    Returns:
        Dict with keys:
            start_coord, end_coord, total_departures_evaluated, compute_time_s,
            earliest_feasible_idx, latest_safe_idx, lowest_dark_idx,
            earliest_feasible_utc, latest_safe_utc, lowest_dark_utc,
            plain_language_summary, departures
    """
    t_start = time.perf_counter()
    grid = visibility_cube["grid"]
    nx, ny = grid["nx"], grid["ny"]
    spacing_m = float(grid["spacing_m"])
    timestamps = visibility_cube["time_utc"]
    num_t = len(timestamps)

    limit_t = num_t if max_departure_idx is None else min(num_t, max_departure_idx + 1)

    # Time step duration
    if num_t > 1:
        dt0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        dt1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00"))
        step_dt_s = max(1.0, (dt1 - dt0).total_seconds())
    else:
        step_dt_s = 3600.0

    # Pre-convert arrays ONCE for batch speed
    sun_frac_cube = np.array(visibility_cube["sun_frac"], dtype=np.uint8)
    earth_frac_cube = np.array(visibility_cube["earth_frac"], dtype=np.uint8)
    slope_grid = np.array(visibility_cube["slope_deg"], dtype=np.float64)
    traversable_grid = np.array(visibility_cube["traversable"], dtype=bool)

    sx, sy = start_coord
    gx, gy = end_coord

    departures: List[Dict[str, Any]] = []

    def heuristic(x: int, y: int) -> float:
        dist_m = math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m)
        return dist_m / speed_m_s

    moves = [
        (1, 0, spacing_m), (-1, 0, spacing_m), (0, 1, spacing_m), (0, -1, spacing_m),
        (1, 1, spacing_m * math.sqrt(2)), (-1, 1, spacing_m * math.sqrt(2)),
        (1, -1, spacing_m * math.sqrt(2)), (-1, -1, spacing_m * math.sqrt(2)),
    ]
    if allow_wait:
        moves.append((0, 0, 0.0))

    # Fast single departure solve using pre-extracted arrays
    def _solve_departure(dep_t: int) -> Dict[str, Any]:
        dep_utc = timestamps[dep_t]

        # Start slope validation
        if not traversable_grid[sy, sx] or slope_grid[sy, sx] > max_slope_deg:
            return {
                "departure_idx": dep_t,
                "departure_utc": dep_utc,
                "feasible": False,
                "arrival_idx": None,
                "arrival_utc": None,
                "duration_h": 0.0,
                "dark_duration_h": 0.0,
                "infeasible_reason": f"Start slope ({slope_grid[sy, sx]:.1f} deg) exceeds max limit {max_slope_deg} deg",
                "path": [],
            }

        # Start illumination validation
        if (sun_frac_cube[dep_t, sy, sx] / 100.0) < min_sun_frac:
            return {
                "departure_idx": dep_t,
                "departure_utc": dep_utc,
                "feasible": False,
                "arrival_idx": None,
                "arrival_utc": None,
                "duration_h": 0.0,
                "dark_duration_h": 0.0,
                "infeasible_reason": f"Start location in shadow ({sun_frac_cube[dep_t, sy, sx]}% sunlit < {min_sun_frac*100:.0f}%)",
                "path": [],
            }

        open_heap = [(heuristic(sx, sy), 0.0, sx, sy, dep_t)]
        came_from: Dict[Tuple[int, int, int], Optional[Tuple[int, int, int]]] = {(sx, sy, dep_t): None}
        cost_so_far: Dict[Tuple[int, int, int], float] = {(sx, sy, dep_t): 0.0}
        dark_so_far: Dict[Tuple[int, int, int], float] = {(sx, sy, dep_t): 0.0}
        goal_node: Optional[Tuple[int, int, int]] = None
        visited = 0
        max_states = 50000

        while open_heap and visited < max_states:
            visited += 1
            f, g, cx, cy, ct = heapq.heappop(open_heap)

            if g > cost_so_far.get((cx, cy, ct), g) + 1e-9:
                continue

            if (cx, cy) == (gx, gy):
                goal_node = (cx, cy, ct)
                break

            for dx, dy, move_dist_m in moves:
                nx_c = cx + dx
                ny_c = cy + dy

                if not (0 <= nx_c < nx and 0 <= ny_c < ny):
                    continue
                if not traversable_grid[ny_c, nx_c] or slope_grid[ny_c, nx_c] > max_slope_deg:
                    continue

                # Blocked diagonal corner check
                if dx != 0 and dy != 0:
                    if (not traversable_grid[cy, nx_c] or slope_grid[cy, nx_c] > max_slope_deg) or \
                       (not traversable_grid[ny_c, cx] or slope_grid[ny_c, cx] > max_slope_deg):
                        continue

                # Time calculation: discretise accumulated transit time via ceiling (round-up)
                if move_dist_m == 0.0:
                    transit_s = step_dt_s
                else:
                    transit_s = move_dist_m / speed_m_s

                new_g = g + transit_s
                dt_steps = math.ceil(round(new_g / step_dt_s, 9)) if new_g > 0.0 else 0
                nt = dep_t + dt_steps

                if nt >= num_t:
                    continue

                s_frac = sun_frac_cube[nt, ny_c, nx_c] / 100.0
                is_dark = (s_frac < min_sun_frac)
                curr_dark = dark_so_far.get((cx, cy, ct), 0.0)

                if is_dark:
                    if dark_budget_h <= 0.0:
                        continue
                    if curr_dark + transit_s > (dark_budget_h * 3600.0 + 1e-6):
                        continue

                e_frac = earth_frac_cube[nt, ny_c, nx_c] / 100.0
                if e_frac < min_earth_frac:
                    continue

                new_g = g + transit_s
                nst = (nx_c, ny_c, nt)
                new_dark = curr_dark + transit_s if is_dark else curr_dark

                if nst not in cost_so_far or new_g < cost_so_far[nst]:
                    cost_so_far[nst] = new_g
                    dark_so_far[nst] = new_dark
                    heapq.heappush(open_heap, (new_g + heuristic(nx_c, ny_c), new_g, nx_c, ny_c, nt))
                    came_from[nst] = (cx, cy, ct)

        if goal_node is None:
            return {
                "departure_idx": dep_t,
                "departure_utc": dep_utc,
                "feasible": False,
                "arrival_idx": None,
                "arrival_utc": None,
                "duration_h": 0.0,
                "dark_duration_h": 0.0,
                "infeasible_reason": "Moving shadow or steep slopes block traverse corridor before reaching target",
                "path": [],
            }

        # Reconstruct path
        path_nodes: List[Tuple[int, int, int]] = []
        curr: Optional[Tuple[int, int, int]] = goal_node
        while curr is not None:
            path_nodes.append(curr)
            curr = came_from.get(curr)
        path_nodes.reverse()

        total_dark_s = 0.0
        for i in range(1, len(path_nodes)):
            px, py, pt = path_nodes[i]
            ppx, ppy, _ = path_nodes[i - 1]
            step_d = math.hypot((px - ppx) * spacing_m, (py - ppy) * spacing_m)
            step_s = step_dt_s if step_d == 0.0 else step_d / speed_m_s
            if (sun_frac_cube[pt, py, px] / 100.0) < min_sun_frac:
                total_dark_s += step_s

        arrival_idx = goal_node[2]
        duration_h = round(cost_so_far[goal_node] / 3600.0, 2)
        dark_h = round(total_dark_s / 3600.0, 3)

        return {
            "departure_idx": dep_t,
            "departure_utc": dep_utc,
            "feasible": True,
            "arrival_idx": arrival_idx,
            "arrival_utc": timestamps[arrival_idx],
            "duration_h": duration_h,
            "dark_duration_h": dark_h,
            "infeasible_reason": None,
            "path": [{"x": px, "y": py, "t": pt} for px, py, pt in path_nodes],
        }

    for dep_idx in range(limit_t):
        departures.append(_solve_departure(dep_idx))

    t_end = time.perf_counter()
    compute_time_s = round(t_end - t_start, 4)

    # Compute key departure points
    feasible_deps = [d for d in departures if d["feasible"]]

    if not feasible_deps:
        earliest_idx = None
        latest_idx = None
        lowest_dark_idx = None
        summary_sentence = (
            f"No feasible departures found between {timestamps[0]} and {timestamps[limit_t - 1]}. "
            f"Traverse from ({sx}, {sy}) to ({gx}, {gy}) is permanently blocked by terrain slopes "
            f"exceeding {max_slope_deg}° or persistent shadows."
        )
    else:
        earliest_idx = feasible_deps[0]["departure_idx"]
        latest_idx = feasible_deps[-1]["departure_idx"]
        lowest_dark_dep = min(feasible_deps, key=lambda d: (d["dark_duration_h"], d["duration_h"]))
        lowest_dark_idx = lowest_dark_dep["departure_idx"]

        # Determine blocking reason after latest_safe_idx
        if latest_idx < limit_t - 1:
            next_infeasible = departures[latest_idx + 1]
            blocking_cause = next_infeasible.get("infeasible_reason") or "moving shadow on the ridge"
            summary_sentence = (
                f"Leaving between {timestamps[earliest_idx]} (step {earliest_idx}) and "
                f"{timestamps[latest_idx]} (step {latest_idx}) works; "
                f"leaving after {timestamps[latest_idx]} does not because of {blocking_cause.lower()}."
            )
        else:
            summary_sentence = (
                f"Continuous feasible departures available from {timestamps[earliest_idx]} (step {earliest_idx}) "
                f"through end of simulation {timestamps[latest_idx]} (step {latest_idx}). "
                f"Lowest dark exposure is {lowest_dark_dep['dark_duration_h']:.2f} h departing at "
                f"{timestamps[lowest_dark_idx]} (step {lowest_dark_idx})."
            )

    return {
        "start_coord": [sx, sy],
        "end_coord": [gx, gy],
        "total_departures_evaluated": len(departures),
        "compute_time_s": compute_time_s,
        "earliest_feasible_idx": earliest_idx,
        "latest_safe_idx": latest_idx,
        "lowest_dark_idx": lowest_dark_idx,
        "earliest_feasible_utc": timestamps[earliest_idx] if earliest_idx is not None else None,
        "latest_safe_utc": timestamps[latest_idx] if latest_idx is not None else None,
        "lowest_dark_utc": timestamps[lowest_dark_idx] if lowest_dark_idx is not None else None,
        "plain_language_summary": summary_sentence,
        "departures": departures,
    }


def plan_mission(
    visibility_cube: Dict[str, Any],
    start_coord: Tuple[int, int],
    start_time_idx: int,
    stops: List[Dict[str, Any]],
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    dark_budget_h: float = 0.0,
    allow_wait: bool = True,
    mission_name: str = "Lunar Surface Sortie",
) -> Dict[str, Any]:
    """Plan a sequential multi-stop lunar surface mission.

    Chains legs between up to five stops, validating dwell duration, solar illumination
    thresholds, Earth communication upload requirements, and stop deadlines.
    Identifies any constraint violations and computes the smallest change that restores feasibility.

    Limits to state in the UI/exports:
        "Geometric Sun and Earth visibility only; no power or link budget."

    Args:
        visibility_cube: Cube dict with grid, time_utc, sun_frac, earth_frac, slope_deg, traversable.
        start_coord: (x0, y0) grid coordinates of initial lander/base.
        start_time_idx: Time index of departure from initial base.
        stops: List of up to 5 stop dicts with keys:
            - stop_id (str, optional)
            - name (str)
            - coord (Tuple[int, int])
            - dwell_time_h (float)
            - min_sun_frac (float, optional: minimum solar fraction during dwell [0..1])
            - min_earth_frac (float, optional: minimum earth contact fraction [0..1])
            - min_earth_duration_h (float, optional: required cumulative hours of earth contact)
            - deadline_idx (int, optional: latest permissible step to finish dwell)
            - deadline_utc (str, optional: latest permissible UTC to finish dwell)
        speed_m_s: Rover transit speed (default 0.05 m/s).
        mode: Traverse mode ('rover', 'crew').
        max_slope_deg: Maximum allowable slope.
        dark_budget_h: Maximum allowable darkness per transit leg.
        allow_wait: Whether waiting in place is allowed.
        mission_name: Human-readable label for the mission plan.

    Returns:
        Dict conforming to schemas/mission_plan.schema.json.
    """
    if len(stops) < 1:
        raise ValueError("Mission plan must contain at least 1 stop.")
    if len(stops) > 5:
        raise ValueError(f"Maximum 5 stops allowed per mission plan, got {len(stops)}.")

    LIMITS_DISCLAIMER = "Geometric Sun and Earth visibility only; no power or link budget."

    timestamps = visibility_cube["time_utc"]
    num_t = len(timestamps)

    if num_t > 1:
        dt0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        dt1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00"))
        step_dt_s = max(1.0, (dt1 - dt0).total_seconds())
    else:
        step_dt_s = 3600.0

    sun_frac_cube = np.array(visibility_cube["sun_frac"], dtype=np.uint8)
    earth_frac_cube = np.array(visibility_cube["earth_frac"], dtype=np.uint8)

    # Initial state
    current_coord = (int(start_coord[0]), int(start_coord[1]))
    current_t = int(start_time_idx)
    prev_name = "Base Lander"

    total_dist_m = 0.0
    total_transit_h = 0.0
    total_dwell_h = 0.0
    total_dark_h = 0.0

    legs: List[Dict[str, Any]] = []
    dwells: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    violations: List[Dict[str, Any]] = []

    all_feasible = True

    for i, stop in enumerate(stops):
        stop_id = str(stop.get("stop_id", f"stop_{i + 1}"))
        stop_name = str(stop.get("name", f"Stop {i + 1}"))
        dest_coord = (int(stop["coord"][0]), int(stop["coord"][1]))
        dwell_h = float(stop.get("dwell_time_h", 0.0))
        min_sun_req = stop.get("min_sun_frac")
        min_earth_req = stop.get("min_earth_frac")
        min_earth_dur_h = float(stop.get("min_earth_duration_h", 0.0))
        deadline_idx = stop.get("deadline_idx")
        deadline_utc = stop.get("deadline_utc")
        if deadline_idx is None and deadline_utc is not None:
            if deadline_utc in timestamps:
                deadline_idx = timestamps.index(deadline_utc)

        # 1. Plan Leg Transit
        if current_t >= num_t:
            all_feasible = False
            v_msg = f"Cannot start leg to '{stop_name}': departure step {current_t} is beyond horizon ({num_t - 1})."
            violations.append({
                "stop_index": i,
                "stop_name": stop_name,
                "type": "deadline_missed",
                "details": v_msg,
            })
            legs.append({
                "leg_index": i + 1,
                "from_name": prev_name,
                "to_name": stop_name,
                "start_coord": list(current_coord),
                "end_coord": list(dest_coord),
                "start_time_idx": current_t,
                "end_time_idx": current_t,
                "start_time_utc": timestamps[-1],
                "end_time_utc": timestamps[-1],
                "feasible": False,
                "duration_h": 0.0,
                "distance_m": 0.0,
                "dark_duration_h": 0.0,
                "path": [],
                "infeasible_reason": v_msg,
            })
            break

        leg_res = plan_lunar_traverse(
            visibility_cube=visibility_cube,
            start_coord=current_coord,
            end_coord=dest_coord,
            start_time_idx=current_t,
            speed_m_s=speed_m_s,
            mode=mode,
            max_slope_deg=max_slope_deg,
            dark_budget_h=dark_budget_h,
            allow_wait=allow_wait,
        )

        if not leg_res["feasible"]:
            all_feasible = False
            v_msg = f"Traverse from '{prev_name}' to '{stop_name}' starting at {timestamps[current_t]} is infeasible: {leg_res['explanation']}"
            violations.append({
                "stop_index": i,
                "stop_name": stop_name,
                "type": "transit_infeasible",
                "details": v_msg,
            })
            legs.append({
                "leg_index": i + 1,
                "from_name": prev_name,
                "to_name": stop_name,
                "start_coord": list(current_coord),
                "end_coord": list(dest_coord),
                "start_time_idx": current_t,
                "end_time_idx": current_t,
                "start_time_utc": timestamps[current_t],
                "end_time_utc": timestamps[current_t],
                "feasible": False,
                "duration_h": 0.0,
                "distance_m": 0.0,
                "dark_duration_h": 0.0,
                "path": [],
                "infeasible_reason": leg_res["explanation"],
            })
            break

        # Feasible Leg
        leg_path = leg_res["path"]
        arrival_t = leg_path[-1]["t"]
        leg_dur_h = float(leg_res["metrics"]["duration_h"])
        leg_dist_m = float(leg_res["metrics"]["total_distance_m"])
        leg_dark_h = float(leg_res["metrics"].get("dark_duration_h", 0.0))

        total_dist_m += leg_dist_m
        total_transit_h += leg_dur_h
        total_dark_h += leg_dark_h

        legs.append({
            "leg_index": i + 1,
            "from_name": prev_name,
            "to_name": stop_name,
            "start_coord": list(current_coord),
            "end_coord": list(dest_coord),
            "start_time_idx": current_t,
            "end_time_idx": arrival_t,
            "start_time_utc": timestamps[current_t],
            "end_time_utc": timestamps[arrival_t],
            "feasible": True,
            "duration_h": leg_dur_h,
            "distance_m": leg_dist_m,
            "dark_duration_h": leg_dark_h,
            "path": leg_path,
            "infeasible_reason": None,
        })

        # Calculate sun/earth lane statistics for transit leg
        leg_sun_vals = [float(sun_frac_cube[p["t"], p["y"], p["x"]]) for p in leg_path]
        leg_earth_vals = [float(earth_frac_cube[p["t"], p["y"], p["x"]]) for p in leg_path]

        timeline.append({
            "event_id": f"leg_{i + 1}",
            "type": "transit",
            "label": f"Transit: {prev_name} -> {stop_name}",
            "start_time_idx": current_t,
            "end_time_idx": arrival_t,
            "start_time_utc": timestamps[current_t],
            "end_time_utc": timestamps[arrival_t],
            "duration_h": leg_dur_h,
            "sun_frac_min": min(leg_sun_vals) if leg_sun_vals else 0.0,
            "sun_frac_avg": round(sum(leg_sun_vals) / len(leg_sun_vals), 1) if leg_sun_vals else 0.0,
            "earth_frac_min": min(leg_earth_vals) if leg_earth_vals else 0.0,
            "earth_frac_avg": round(sum(leg_earth_vals) / len(leg_earth_vals), 1) if leg_earth_vals else 0.0,
            "violations": [],
        })

        # 2. Dwell Phase at Stop i
        if dwell_h > 0.0:
            dwell_steps = max(1, int(round(dwell_h * 3600.0 / step_dt_s)))
        else:
            dwell_steps = 0

        departure_t = arrival_t + dwell_steps
        total_dwell_h += dwell_h

        dwell_violations: List[str] = []
        sun_satisfied = True
        earth_satisfied = True
        deadline_satisfied = True

        if departure_t >= num_t:
            all_feasible = False
            deadline_satisfied = False
            v_msg = f"Dwell at '{stop_name}' extends to step {departure_t}, beyond simulation horizon ({num_t - 1})."
            dwell_violations.append(v_msg)
            violations.append({
                "stop_index": i,
                "stop_name": stop_name,
                "type": "deadline_missed",
                "details": v_msg,
            })

        inspect_end_t = min(num_t - 1, departure_t)
        dwell_range = list(range(arrival_t, inspect_end_t + 1)) if inspect_end_t >= arrival_t else [arrival_t]

        gx, gy = dest_coord
        dwell_sun_vals = [float(sun_frac_cube[t, gy, gx]) for t in dwell_range]
        dwell_earth_vals = [float(earth_frac_cube[t, gy, gx]) for t in dwell_range]

        min_sun_obs = min(dwell_sun_vals) / 100.0 if dwell_sun_vals else 1.0

        # Check Sun requirement during dwell
        if min_sun_req is not None:
            if min_sun_obs < (min_sun_req - 1e-4):
                sun_satisfied = False
                all_feasible = False
                v_msg = (
                    f"Sunlight at '{stop_name}' drops to {min_sun_obs * 100:.0f}% during dwell, "
                    f"violating required minimum of {min_sun_req * 100:.0f}%."
                )
                dwell_violations.append(v_msg)
                violations.append({
                    "stop_index": i,
                    "stop_name": stop_name,
                    "type": "insufficient_sun",
                    "details": v_msg,
                })

        # Check Earth contact upload requirement during dwell
        earth_thresh = min_earth_req if min_earth_req is not None else 0.50
        qualifying_earth_steps = sum(1 for val in dwell_earth_vals if (val / 100.0) >= earth_thresh)
        earth_contact_h = qualifying_earth_steps * (step_dt_s / 3600.0)

        if min_earth_dur_h > 0.0:
            if earth_contact_h < (min_earth_dur_h - 1e-4):
                earth_satisfied = False
                all_feasible = False
                v_msg = (
                    f"Earth link above {earth_thresh * 100:.0f}% at '{stop_name}' is available for only "
                    f"{earth_contact_h:.1f}h during dwell, violating required {min_earth_dur_h:.1f}h upload window."
                )
                dwell_violations.append(v_msg)
                violations.append({
                    "stop_index": i,
                    "stop_name": stop_name,
                    "type": "insufficient_earth_link",
                    "details": v_msg,
                })

        # Check deadline requirement
        if deadline_idx is not None:
            if departure_t > deadline_idx:
                deadline_satisfied = False
                all_feasible = False
                deadline_utc_str = timestamps[min(num_t - 1, deadline_idx)]
                dep_utc_str = timestamps[min(num_t - 1, departure_t)]
                v_msg = (
                    f"Departure from '{stop_name}' at step {departure_t} ({dep_utc_str}) misses "
                    f"the declared deadline of step {deadline_idx} ({deadline_utc_str})."
                )
                dwell_violations.append(v_msg)
                violations.append({
                    "stop_index": i,
                    "stop_name": stop_name,
                    "type": "deadline_missed",
                    "details": v_msg,
                })

        dwells.append({
            "stop_id": stop_id,
            "name": stop_name,
            "coord": list(dest_coord),
            "start_time_idx": arrival_t,
            "end_time_idx": departure_t,
            "start_time_utc": timestamps[min(num_t - 1, arrival_t)],
            "end_time_utc": timestamps[min(num_t - 1, departure_t)],
            "duration_h": round(dwell_h, 2),
            "min_sun_frac_observed": round(min_sun_obs, 2),
            "earth_contact_duration_h": round(earth_contact_h, 2),
            "sun_satisfied": sun_satisfied,
            "earth_satisfied": earth_satisfied,
            "deadline_satisfied": deadline_satisfied,
            "violations": dwell_violations,
        })

        timeline.append({
            "event_id": f"dwell_{i + 1}",
            "type": "dwell",
            "label": f"Dwell: {stop_name} ({dwell_h:.1f}h)",
            "start_time_idx": arrival_t,
            "end_time_idx": departure_t,
            "start_time_utc": timestamps[min(num_t - 1, arrival_t)],
            "end_time_utc": timestamps[min(num_t - 1, departure_t)],
            "duration_h": round(dwell_h, 2),
            "sun_frac_min": min(dwell_sun_vals) if dwell_sun_vals else 100.0,
            "sun_frac_avg": round(sum(dwell_sun_vals) / len(dwell_sun_vals), 1) if dwell_sun_vals else 100.0,
            "earth_frac_min": min(dwell_earth_vals) if dwell_earth_vals else 100.0,
            "earth_frac_avg": round(sum(dwell_earth_vals) / len(dwell_earth_vals), 1) if dwell_earth_vals else 100.0,
            "violations": dwell_violations,
        })

        # Advance current state for next leg
        current_coord = dest_coord
        current_t = departure_t
        prev_name = stop_name

    # 3. Smallest Change Fix Discovery if Infeasible
    fix_rec: Optional[Dict[str, Any]] = None
    if not all_feasible:
        fix_rec = find_smallest_fix(
            visibility_cube=visibility_cube,
            start_coord=start_coord,
            start_time_idx=start_time_idx,
            stops=stops,
            speed_m_s=speed_m_s,
            mode=mode,
            max_slope_deg=max_slope_deg,
            dark_budget_h=dark_budget_h,
            allow_wait=allow_wait,
        )

    total_duration_h = round(total_transit_h + total_dwell_h, 2)

    return {
        "mission_name": mission_name,
        "start_coord": [int(start_coord[0]), int(start_coord[1])],
        "start_time_idx": int(start_time_idx),
        "start_time_utc": timestamps[min(num_t - 1, int(start_time_idx))],
        "feasible": all_feasible,
        "stops": stops,
        "legs": legs,
        "dwells": dwells,
        "timeline": timeline,
        "metrics": {
            "total_distance_m": round(total_dist_m, 1),
            "transit_duration_h": round(total_transit_h, 2),
            "dwell_duration_h": round(total_dwell_h, 2),
            "total_duration_h": total_duration_h,
            "total_dark_duration_h": round(total_dark_h, 2),
            "num_stops": len(stops),
        },
        "violations": violations,
        "fix_recommendation": fix_rec,
        "limits_disclaimer": LIMITS_DISCLAIMER,
    }


def find_smallest_fix(
    visibility_cube: Dict[str, Any],
    start_coord: Tuple[int, int],
    start_time_idx: int,
    stops: List[Dict[str, Any]],
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    dark_budget_h: float = 0.0,
    allow_wait: bool = True,
) -> Optional[Dict[str, Any]]:
    """Determine the smallest actionable change that restores mission feasibility.

    Evaluates:
      1. Stop Reordering: Permutations of visit order (adjacent stop swaps first).
      2. Earlier Departure: Stepping initial departure time backward.
      3. Dwell Shortening: Reducing dwell times at preceding or violating stops.

    Returns:
        Dict with 'type', 'description', and 'suggested_patch', or None if no small fix found.
    """
    timestamps = visibility_cube["time_utc"]
    num_t = len(timestamps)
    if num_t > 1:
        dt0 = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        dt1 = datetime.fromisoformat(timestamps[1].replace("Z", "+00:00"))
        step_dt_s = max(1.0, (dt1 - dt0).total_seconds())
    else:
        step_dt_s = 3600.0

    # Helper function to evaluate feasibility quickly without re-triggering recursive fix searches
    def is_plan_feasible(cand_start_t: int, cand_stops: List[Dict[str, Any]]) -> bool:
        cur_c = start_coord
        cur_t = cand_start_t
        for s in cand_stops:
            if cur_t >= num_t:
                return False
            d_coord = tuple(s["coord"])
            d_h = float(s.get("dwell_time_h", 0.0))
            leg = plan_lunar_traverse(
                visibility_cube=visibility_cube,
                start_coord=cur_c,
                end_coord=d_coord,
                start_time_idx=cur_t,
                speed_m_s=speed_m_s,
                mode=mode,
                max_slope_deg=max_slope_deg,
                dark_budget_h=dark_budget_h,
                allow_wait=allow_wait,
            )
            if not leg["feasible"]:
                return False
            arr_t = leg["path"][-1]["t"]
            dwell_steps = max(1, int(round(d_h * 3600.0 / step_dt_s))) if d_h > 0 else 0
            dep_t = arr_t + dwell_steps
            if dep_t >= num_t:
                return False

            # Check deadline
            d_idx = s.get("deadline_idx")
            if d_idx is not None and dep_t > d_idx:
                return False

            # Check sun
            req_sun = s.get("min_sun_frac")
            if req_sun is not None:
                for step in range(arr_t, dep_t + 1):
                    if (visibility_cube["sun_frac"][step][d_coord[1]][d_coord[0]] / 100.0) < (req_sun - 1e-4):
                        return False

            # Check earth
            req_e_dur = float(s.get("min_earth_duration_h", 0.0))
            if req_e_dur > 0:
                e_thresh = s.get("min_earth_frac", 0.50)
                e_contact_steps = sum(
                    1 for step in range(arr_t, dep_t + 1)
                    if (visibility_cube["earth_frac"][step][d_coord[1]][d_coord[0]] / 100.0) >= e_thresh
                )
                if (e_contact_steps * step_dt_s / 3600.0) < (req_e_dur - 1e-4):
                    return False

            cur_c = d_coord
            cur_t = dep_t
        return True

    # Strategy 1: Reorder stops (try 1 adjacent swap first, then general permutations if small)
    if len(stops) >= 2:
        for j in range(len(stops) - 1):
            reordered = list(stops)
            reordered[j], reordered[j + 1] = reordered[j + 1], reordered[j]
            if is_plan_feasible(start_time_idx, reordered):
                return {
                    "type": "reorder_stops",
                    "description": (
                        f"Reorder stops: swap '{stops[j]['name']}' and '{stops[j + 1]['name']}' "
                        f"(visit '{reordered[j]['name']}' first) to align with terrain and illumination windows."
                    ),
                    "suggested_patch": {
                        "new_stop_order": [s.get("stop_id", f"stop_{idx}") for idx, s in enumerate(reordered)]
                    },
                }

    # Strategy 2: Earlier Departure
    for earlier_t in range(start_time_idx - 1, -1, -1):
        if is_plan_feasible(earlier_t, stops):
            delta_h = (start_time_idx - earlier_t) * (step_dt_s / 3600.0)
            return {
                "type": "earlier_start",
                "delta_h": round(delta_h, 2),
                "description": (
                    f"Start {delta_h:.1f}h earlier at {timestamps[earlier_t]} (step {earlier_t}) "
                    f"to arrive before shadow closure or deadline expiration."
                ),
                "suggested_patch": {"start_time_idx": earlier_t},
            }

    # Strategy 3: Shorter Dwell times
    for j, s in enumerate(stops):
        orig_dwell = float(s.get("dwell_time_h", 0.0))
        if orig_dwell > 0.5:
            # Try reducing by 0.5h, 1.0h, 1.5h, 2.0h, etc.
            for red_h in [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]:
                if orig_dwell - red_h < 0.25:
                    break
                cand_stops = [dict(st) for st in stops]
                cand_stops[j]["dwell_time_h"] = round(orig_dwell - red_h, 2)
                if is_plan_feasible(start_time_idx, cand_stops):
                    return {
                        "type": "shorter_dwell",
                        "stop_index": j,
                        "stop_name": s["name"],
                        "delta_h": red_h,
                        "new_dwell_h": round(orig_dwell - red_h, 2),
                        "description": (
                            f"Reduce dwell at '{s['name']}' from {orig_dwell:.1f}h to {orig_dwell - red_h:.1f}h "
                            f"(reduction: {red_h:.1f}h) to satisfy subsequent leg deadlines."
                        ),
                        "suggested_patch": {
                            "stop_index": j,
                            "new_dwell_time_h": round(orig_dwell - red_h, 2),
                        },
                    }

    return None


def export_mission_plan_csv(plan: Dict[str, Any]) -> str:
    """Export mission timeline and stops to a structured, audit-ready CSV string."""
    lines = [
        "# LightPath Lunar Mission Plan Export",
        f"# Mission: {plan.get('mission_name', 'Lunar Sortie')}",
        f"# Feasible: {plan.get('feasible', False)}",
        f"# Total Duration: {plan['metrics']['total_duration_h']} h | Total Distance: {plan['metrics']['total_distance_m']} m",
        f"# Limits: {plan.get('limits_disclaimer', 'Geometric Sun and Earth visibility only; no power or link budget.')}",
        "Event_ID,Type,Label,Start_Step,End_Step,Start_UTC,End_UTC,Duration_h,Min_Sun_Pct,Avg_Sun_Pct,Min_Earth_Pct,Avg_Earth_Pct,Violations",
    ]

    for ev in plan.get("timeline", []):
        v_str = "; ".join(ev.get("violations", [])) if ev.get("violations") else "None"
        v_escaped = f'"{v_str}"' if "," in v_str or ";" in v_str else v_str
        lines.append(
            f"{ev['event_id']},{ev['type']},{ev['label']},"
            f"{ev['start_time_idx']},{ev['end_time_idx']},"
            f"{ev['start_time_utc']},{ev['end_time_utc']},"
            f"{ev['duration_h']},{ev.get('sun_frac_min', 0.0)},{ev.get('sun_frac_avg', 0.0)},"
            f"{ev.get('earth_frac_min', 0.0)},{ev.get('earth_frac_avg', 0.0)},{v_escaped}"
        )

    return "\n".join(lines) + "\n"


def export_mission_plan_ics(plan: Dict[str, Any]) -> str:
    """Export mission timeline to RFC 5545 iCalendar (.ics) format."""
    now_utc = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LightPath//NASA Space Apps Lunar Mission Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:LightPath - {plan.get('mission_name', 'Lunar Sortie')}",
        "X-LIMITS:Geometric Sun and Earth visibility only; no power or link budget.",
    ]

    def iso_to_ics(iso_str: str) -> str:
        clean = iso_str.replace("-", "").replace(":", "")
        if "T" in clean:
            return clean if clean.endswith("Z") else clean + "Z"
        return clean + "T000000Z"

    for ev in plan.get("timeline", []):
        dtstart = iso_to_ics(ev["start_time_utc"])
        dtend = iso_to_ics(ev["end_time_utc"])
        # Handle zero-duration events
        if dtstart == dtend:
            dtend_parts = datetime.fromisoformat(ev["end_time_utc"].replace("Z", "+00:00"))
            dtend = (dtend_parts.replace(minute=dtend_parts.minute + 1)).strftime("%Y%m%dT%H%M%SZ")

        uid = f"{ev['event_id']}-{dtstart}@lightpath.lunar"
        summary = f"[LightPath] {ev['label']}"
        desc = (
            f"Event: {ev['label']}\\n"
            f"Duration: {ev['duration_h']} h\\n"
            f"Sun Illumination: min {ev.get('sun_frac_min', 0.0)}%, avg {ev.get('sun_frac_avg', 0.0)}%\\n"
            f"Earth Contact: min {ev.get('earth_frac_min', 0.0)}%, avg {ev.get('earth_frac_avg', 0.0)}%\\n"
            f"NOTE: Geometric Sun and Earth visibility only; no power or link budget."
        )
        if ev.get("violations"):
            desc += f"\\nVIOLATIONS: {'; '.join(ev['violations'])}"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_utc}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{desc}",
            f"STATUS:{'CONFIRMED' if not ev.get('violations') else 'TENTATIVE'}",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def compare_nominal_and_conservative_routes(
    visibility_cube: Dict[str, Any],
    start_coord: Tuple[int, int],
    end_coord: Tuple[int, int],
    start_time_idx: int = 0,
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
    dark_budget_h: float = 0.0,
    horizon_margin_deg: float = 0.10,
) -> Dict[str, Any]:
    """Compare a nominal route with a conservative route computed with raised horizon margin.

    Args:
        visibility_cube: Dict conforming to schemas/visibility_cube.schema.json.
        start_coord: (x_start, y_start) grid indices.
        end_coord: (x_end, y_end) grid indices.
        start_time_idx: Initial time index in time_utc.
        speed_m_s: Traverse speed in meters/second.
        mode: Traverse mode ('rover', 'crew', 'static_stay').
        max_slope_deg: Maximum allowable slope in degrees.
        min_sun_frac: Minimum required solar fraction [0.0, 1.0].
        min_earth_frac: Minimum required Earth visibility fraction [0.0, 1.0].
        allow_wait: Whether waiting in place is permitted.
        dark_budget_h: Allowable darkness hours along traverse.
        horizon_margin_deg: Horizon elevation margin in degrees (default 0.10 deg).

    Returns:
        Dict with 'nominal', 'conservative', and 'cost_of_caution'.
    """
    nominal = plan_lunar_traverse(
        visibility_cube=visibility_cube,
        start_coord=start_coord,
        end_coord=end_coord,
        start_time_idx=start_time_idx,
        speed_m_s=speed_m_s,
        mode=mode,
        max_slope_deg=max_slope_deg,
        min_sun_frac=min_sun_frac,
        min_earth_frac=min_earth_frac,
        allow_wait=allow_wait,
        dark_budget_h=dark_budget_h,
        conservative=False,
        horizon_margin_deg=0.0,
    )

    conservative = plan_lunar_traverse(
        visibility_cube=visibility_cube,
        start_coord=start_coord,
        end_coord=end_coord,
        start_time_idx=start_time_idx,
        speed_m_s=speed_m_s,
        mode=mode,
        max_slope_deg=max_slope_deg,
        min_sun_frac=min_sun_frac,
        min_earth_frac=min_earth_frac,
        allow_wait=allow_wait,
        dark_budget_h=dark_budget_h,
        conservative=True,
        horizon_margin_deg=horizon_margin_deg,
    )

    if nominal["feasible"] and conservative["feasible"]:
        extra_dist = round(conservative["metrics"]["total_distance_m"] - nominal["metrics"]["total_distance_m"], 1)
        extra_dur = round(conservative["metrics"]["duration_h"] - nominal["metrics"]["duration_h"], 2)
        extra_wait = round(conservative["metrics"].get("wait_duration_h", 0.0) - nominal["metrics"].get("wait_duration_h", 0.0), 2)
        caution_text = (
            f"Caution requires +{extra_dist:.1f} m extra distance and +{extra_dur:.2f} h extra duration "
            f"(+{extra_wait:.2f} h waiting in sunlight) under {horizon_margin_deg:.2f}° horizon elevation margin."
        )
    elif nominal["feasible"] and not conservative["feasible"]:
        extra_dist = 0.0
        extra_dur = 0.0
        extra_wait = 0.0
        caution_text = (
            f"Conservative route is blocked under {horizon_margin_deg:.2f}° horizon elevation margin "
            f"(marginal cells count as dark). Nominal route is viable ({nominal['metrics']['duration_h']:.2f} h) but lacks margin against DEM error."
        )
    elif not nominal["feasible"] and not conservative["feasible"]:
        extra_dist = 0.0
        extra_dur = 0.0
        extra_wait = 0.0
        caution_text = "Both nominal and conservative routes are infeasible at chosen departure."
    else:
        extra_dist = 0.0
        extra_dur = 0.0
        extra_wait = 0.0
        caution_text = "Nominal route infeasible."

    return {
        "nominal": nominal,
        "conservative": conservative,
        "cost_of_caution": {
            "extra_distance_m": extra_dist,
            "extra_duration_h": extra_dur,
            "extra_wait_h": extra_wait,
            "horizon_margin_deg": horizon_margin_deg,
            "explanation": caution_text,
        },
    }


def generate_dispersion_pattern(
    nominal_coord: Tuple[int, int],
    radius_m: float = 250.0,
    spacing_m: float = 50.0,
    num_points: int = 25,
) -> List[Dict[str, Any]]:
    """Generate deterministic sample points inside a landing dispersion radius.

    For N=25 (default standard):
      - 1 nominal point at center (0, 0)
      - Ring 1: 8 points at r1 = radius_m * sqrt(1/3), offset angles (k + 0.5) * (2*pi/8)
      - Ring 2: 16 points at r2 = radius_m, offset angles (k + 0.5) * (2*pi/16)
      This guarantees area-balanced, symmetric coverage of the disc.

    Args:
        nominal_coord: (x_nominal, y_nominal) central landing coordinate.
        radius_m: Dispersion radius in meters (parameter and assumption, default 250m).
        spacing_m: Raster grid spacing in meters per cell.
        num_points: Number of points inside the dispersion radius (default 25).

    Returns:
        List of dicts with point_id, offset_m, dist_from_center_m, and coord.
    """
    if radius_m <= 0.0:
        raise ValueError(f"radius_m must be strictly positive, got {radius_m}")
    if num_points < 1:
        raise ValueError(f"num_points must be >= 1, got {num_points}")
    if spacing_m <= 0.0:
        raise ValueError(f"spacing_m must be strictly positive, got {spacing_m}")

    points: List[Dict[str, Any]] = []

    if num_points == 25:
        # Point 0: Center
        points.append({
            "point_id": 0,
            "offset_m": [0.0, 0.0],
            "dist_from_center_m": 0.0,
            "coord": [int(nominal_coord[0]), int(nominal_coord[1])],
        })

        # Ring 1: 8 points at r1 = radius_m * sqrt(1/3)
        r1 = radius_m * math.sqrt(1.0 / 3.0)
        for k in range(8):
            theta = (k + 0.5) * (2.0 * math.pi / 8.0)
            dx = r1 * math.cos(theta)
            dy = r1 * math.sin(theta)
            cx = int(round(nominal_coord[0] + dx / spacing_m))
            cy = int(round(nominal_coord[1] + dy / spacing_m))
            points.append({
                "point_id": len(points),
                "offset_m": [round(dx, 2), round(dy, 2)],
                "dist_from_center_m": round(r1, 2),
                "coord": [cx, cy],
            })

        # Ring 2: 16 points at r2 = radius_m
        r2 = radius_m
        for k in range(16):
            theta = (k + 0.5) * (2.0 * math.pi / 16.0)
            dx = r2 * math.cos(theta)
            dy = r2 * math.sin(theta)
            cx = int(round(nominal_coord[0] + dx / spacing_m))
            cy = int(round(nominal_coord[1] + dy / spacing_m))
            points.append({
                "point_id": len(points),
                "offset_m": [round(dx, 2), round(dy, 2)],
                "dist_from_center_m": round(r2, 2),
                "coord": [cx, cy],
            })
    else:
        # Point 0: Center
        points.append({
            "point_id": 0,
            "offset_m": [0.0, 0.0],
            "dist_from_center_m": 0.0,
            "coord": [int(nominal_coord[0]), int(nominal_coord[1])],
        })
        golden_angle = math.pi * (3.0 - math.sqrt(5.0))
        for i in range(1, num_points):
            r = radius_m * math.sqrt(i / float(num_points - 1))
            theta = i * golden_angle
            dx = r * math.cos(theta)
            dy = r * math.sin(theta)
            cx = int(round(nominal_coord[0] + dx / spacing_m))
            cy = int(round(nominal_coord[1] + dy / spacing_m))
            points.append({
                "point_id": len(points),
                "offset_m": [round(dx, 2), round(dy, 2)],
                "dist_from_center_m": round(r, 2),
                "coord": [cx, cy],
            })

    return points


def analyze_landing_dispersion(
    visibility_cube: Dict[str, Any],
    nominal_coord: Tuple[int, int],
    goal_coord: Tuple[int, int],
    radius_m: float = 250.0,
    num_points: int = 25,
    start_time_idx: int = 0,
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
    dark_budget_h: float = 0.0,
    conservative: bool = False,
    horizon_margin_deg: float = 0.0,
) -> Dict[str, Any]:
    """Evaluate rover traverse feasibility and performance across a landing dispersion pattern.

    Args:
        visibility_cube: Dict conforming to schemas/visibility_cube.schema.json.
        nominal_coord: (x_nominal, y_nominal) nominal landing point.
        goal_coord: (x_goal, y_goal) traverse target.
        radius_m: Landing dispersion radius in meters (parameter and assumption, default 250m).
        num_points: Number of points inside radius (default 25).
        start_time_idx: Initial time index in time_utc.
        speed_m_s: Speed in m/s.
        mode: Rover mode.
        max_slope_deg: Maximum traversable slope in degrees.
        min_sun_frac: Solar threshold.
        min_earth_frac: Earth threshold.
        allow_wait: Whether waiting is allowed.
        dark_budget_h: Allowable darkness hours.
        conservative: If True, raise horizon by horizon_margin_deg.
        horizon_margin_deg: Horizon margin in degrees.

    Returns:
        Dict conforming to schemas/landing_dispersion.schema.json.
    """
    t_start = time.perf_counter()
    spacing_m = float(visibility_cube["grid"]["spacing_m"])
    nx = int(visibility_cube["grid"]["nx"])
    ny = int(visibility_cube["grid"]["ny"])

    disp_pattern = generate_dispersion_pattern(
        nominal_coord=nominal_coord,
        radius_m=radius_m,
        spacing_m=spacing_m,
        num_points=num_points,
    )

    evaluated_points = []
    shadow_start_failures = 0
    slope_start_failures = 0
    corridor_failures = 0

    for pt in disp_pattern:
        cx, cy = pt["coord"]
        clamped_x = max(0, min(nx - 1, cx))
        clamped_y = max(0, min(ny - 1, cy))
        route = plan_lunar_traverse(
            visibility_cube=visibility_cube,
            start_coord=(clamped_x, clamped_y),
            end_coord=goal_coord,
            start_time_idx=start_time_idx,
            speed_m_s=speed_m_s,
            mode=mode,
            max_slope_deg=max_slope_deg,
            min_sun_frac=min_sun_frac,
            min_earth_frac=min_earth_frac,
            allow_wait=allow_wait,
            dark_budget_h=dark_budget_h,
            conservative=conservative,
            horizon_margin_deg=horizon_margin_deg,
        )

        if route["feasible"]:
            evaluated_points.append({
                "point_id": pt["point_id"],
                "offset_m": pt["offset_m"],
                "dist_from_center_m": pt["dist_from_center_m"],
                "coord": [clamped_x, clamped_y],
                "feasible": True,
                "explanation": route["explanation"],
                "arrival_h": round(route["metrics"]["duration_h"], 2),
                "duration_h": round(route["metrics"]["duration_h"], 2),
                "dark_exposure_h": round(route["metrics"].get("dark_exposure_h", 0.0), 2),
                "total_distance_m": round(route["metrics"]["total_distance_m"], 1),
            })
        else:
            expl = route["explanation"]
            if "solar fraction" in expl or "shadow" in expl:
                shadow_start_failures += 1
            elif "slope" in expl:
                slope_start_failures += 1
            else:
                corridor_failures += 1

            evaluated_points.append({
                "point_id": pt["point_id"],
                "offset_m": pt["offset_m"],
                "dist_from_center_m": pt["dist_from_center_m"],
                "coord": [clamped_x, clamped_y],
                "feasible": False,
                "explanation": expl,
                "arrival_h": None,
                "duration_h": None,
                "dark_exposure_h": None,
                "total_distance_m": None,
            })

    solve_time_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    success_count = sum(1 for p in evaluated_points if p["feasible"])
    failure_count = num_points - success_count
    success_rate = round(success_count / float(num_points), 4)

    feasible_pts = [p for p in evaluated_points if p["feasible"]]
    min_arr = min((p["arrival_h"] for p in feasible_pts), default=None)
    max_arr = max((p["arrival_h"] for p in feasible_pts), default=None)
    nom_arr = evaluated_points[0]["arrival_h"] if evaluated_points[0]["feasible"] else None
    min_dark = min((p["dark_exposure_h"] for p in feasible_pts), default=None)
    max_dark = max((p["dark_exposure_h"] for p in feasible_pts), default=None)

    # Synthesize plain-language summary
    if failure_count == 0:
        summary = f"All {num_points} of {num_points} landing points allow the trip within the window."
    elif success_count == 0:
        if shadow_start_failures >= max(slope_start_failures, corridor_failures):
            reason = "the landing dispersion ellipse is in deep shadow at departure"
        elif slope_start_failures >= max(shadow_start_failures, corridor_failures):
            reason = "the landing points sit on steep crater walls exceeding the slope limit"
        else:
            reason = "advancing shadow fronts completely obstruct all traverse corridors"
        summary = f"0 of {num_points} landing points allow the trip within the window; {reason}."
    else:
        if shadow_start_failures >= max(slope_start_failures, corridor_failures):
            reason = "the failures are on the shadowed side of the ridge"
        elif slope_start_failures >= max(shadow_start_failures, corridor_failures):
            reason = "the failures are located on steep slopes exceeding the mechanical limit"
        else:
            reason = "the failures encounter advancing shadows closing the traverse corridor"
        summary = f"{success_count} of {num_points} landing points allow the trip within the window; {reason}."

    assumption_note = (
        f"Dispersion radius ({radius_m:.0f}m) and sample count ({num_points}) "
        f"are operational parameters and engineering assumptions."
    )

    return {
        "nominal_coord": [int(nominal_coord[0]), int(nominal_coord[1])],
        "goal_coord": [int(goal_coord[0]), int(goal_coord[1])],
        "radius_m": float(radius_m),
        "num_points": int(num_points),
        "success_count": success_count,
        "failure_count": failure_count,
        "success_rate": success_rate,
        "min_arrival_h": min_arr,
        "max_arrival_h": max_arr,
        "nominal_arrival_h": nom_arr,
        "min_dark_exposure_h": min_dark,
        "max_dark_exposure_h": max_dark,
        "solve_time_ms": solve_time_ms,
        "plain_language_summary": summary,
        "assumption_note": assumption_note,
        "points": evaluated_points,
    }
