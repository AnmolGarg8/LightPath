#!/usr/bin/env python3
"""Automated Mutation Testing Harness for LightPath.

Verifies that the test suite is robust and sensitive by injecting 9 deliberate,
realistic engineering bugs into the codebase and confirming that at least one test
fails for every single mutation.

Mutations tested:
1. remove_curvature: Replaces exact spherical curvature with a flat-Moon approximation.
2. moon_centre_earth_direction: Uses Moon center instead of topocentric site for Earth vector.
3. swap_azimuth_direction: Reverses azimuth angle convention to anticlockwise.
4. apply_dem_scale_twice: Applies GeoTIFF metadata scaling factor twice upon loading.
5. degrees_as_radians: Omits radian conversion in great-circle distance computation.
6. off_by_one_window_detection: Adds +1 off-by-one error in contiguous window duration calculation.
7. ignore_margin: Disregards horizon elevation uncertainty margin in classification.
8. skip_dark_budget: Bypasses solar threshold and dark-budget constraints in route solver.
9. allow_diagonal_blocked_corners: Permits diagonal traverse through impassable orthogonal corners.

In accordance with docs/PROJECT_RULES.md:
- Deterministic, zero artificial passing.
- Every surviving mutation must be reported and killed by adding dedicated tests.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List

ROOT_DIR = Path(__file__).resolve().parent.parent


@dataclass
class Mutation:
    id: str
    name: str
    target_file: Path
    description: str
    target_pattern: str
    mutated_replacement: str
    test_args: List[str]


MUTATIONS: List[Mutation] = [
    Mutation(
        id="M1",
        name="remove_curvature",
        target_file=ROOT_DIR / "pipeline" / "geometry.py",
        description="Replace exact spherical curvature with flat-Moon approximation",
        target_pattern="""    r0 = r_moon_m + site_ground_elev_m + observer_height_m
    r = r_moon_m + elev_m

    theta = dist_m / r_moon_m

    if isinstance(theta, np.ndarray):
        cos_theta = np.cos(theta)
        sin_theta = np.sin(theta)
        delta_y = r * cos_theta - r0
        delta_x = r * sin_theta
        el_rad = np.arctan2(delta_y, delta_x)
        return np.degrees(el_rad)
    else:
        cos_theta = math.cos(theta)
        sin_theta = math.sin(theta)
        if dist_m <= 0.0:
            return 90.0 if r > r0 else (-90.0 if r < r0 else 0.0)
        delta_y = r * cos_theta - r0
        delta_x = r * sin_theta
        return math.degrees(math.atan2(delta_y, delta_x))""",
        mutated_replacement="""    # MUTATION: flat-Moon approximation (no curvature drop)
    dz = elev_m - (site_ground_elev_m + observer_height_m)
    if isinstance(dist_m, np.ndarray):
        return np.degrees(np.arctan2(dz, np.maximum(1e-6, dist_m)))
    return math.degrees(math.atan2(dz, max(1e-6, dist_m)))""",
        test_args=["tests/test_geometry.py", "tests/test_verification.py"],
    ),
    Mutation(
        id="M2",
        name="moon_centre_earth_direction",
        target_file=ROOT_DIR / "pipeline" / "ephemeris.py",
        description="Use Moon center instead of site local position for Earth vector",
        target_pattern="""    # Topocentric vector
    v_topo_km = r_earth_moon_me_km - r_obs_km""",
        mutated_replacement="""    # MUTATION: geocentric/selenocentric instead of topocentric
    v_topo_km = r_earth_moon_me_km""",
        test_args=["tests/test_ephemeris.py"],
    ),
    Mutation(
        id="M3",
        name="swap_azimuth_direction",
        target_file=ROOT_DIR / "pipeline" / "geometry.py",
        description="Swap azimuth convention from clockwise to anticlockwise",
        target_pattern="""    # Azimuth clockwise from North
    az_rad = np.arctan2(e, n)
    az_deg = np.degrees(az_rad) % 360.0""",
        mutated_replacement="""    # MUTATION: anticlockwise azimuth
    az_rad = np.arctan2(-e, n)
    az_deg = np.degrees(az_rad) % 360.0""",
        test_args=["tests/test_geometry.py"],
    ),
    Mutation(
        id="M4",
        name="apply_dem_scale_twice",
        target_file=ROOT_DIR / "pipeline" / "terrain.py",
        description="Apply GeoTIFF metadata scale factor twice when opening DEM",
        target_pattern="""        data = raw_data.astype(np.float64)
        if scale != 1.0 or offset != 0.0:
            data = data * scale + offset""",
        mutated_replacement="""        data = raw_data.astype(np.float64)
        if scale != 1.0 or offset != 0.0:
            # MUTATION: applying scale twice
            data = (data * scale + offset) * scale""",
        test_args=["tests/test_terrain.py"],
    ),
    Mutation(
        id="M5",
        name="degrees_as_radians",
        target_file=ROOT_DIR / "pipeline" / "geometry.py",
        description="Use degrees directly as radians in great-circle distance",
        target_pattern="""    phi1 = math.radians(lat1_deg)
    phi2 = math.radians(lat2_deg)
    dphi = math.radians(lat2_deg - lat1_deg)
    dlambda = math.radians(lon2_deg - lon1_deg)""",
        mutated_replacement="""    # MUTATION: degrees directly used without math.radians
    phi1 = lat1_deg
    phi2 = lat2_deg
    dphi = lat2_deg - lat1_deg
    dlambda = lon2_deg - lon1_deg""",
        test_args=["tests/test_geometry.py", "tests/test_horizon.py"],
    ),
    Mutation(
        id="M6",
        name="off_by_one_window_detection",
        target_file=ROOT_DIR / "pipeline" / "stats.py",
        description="Off-by-one segment length in contiguous window detection",
        target_pattern="""            seg_len = i - start_idx
            dur_h = round(seg_len * step_h, 2)""",
        mutated_replacement="""            # MUTATION: off-by-one in window detection
            seg_len = i - start_idx + 1
            dur_h = round(seg_len * step_h, 2)""",
        test_args=["tests/test_stats.py", "tests/test_series.py"],
    ),
    Mutation(
        id="M7",
        name="ignore_margin",
        target_file=ROOT_DIR / "pipeline" / "visibility.py",
        description="Ignore horizon elevation margin in visibility status classification",
        target_pattern="""    if uncertainty_margin is not None:
        margin_deg = float(uncertainty_margin)""",
        mutated_replacement="""    # MUTATION: ignore margin
    margin_deg = 0.0""",
        test_args=["tests/test_visibility.py"],
    ),
    Mutation(
        id="M8",
        name="skip_dark_budget",
        target_file=ROOT_DIR / "pipeline" / "routing.py",
        description="Skip dark budget / shadow constraint in route solver",
        target_pattern="""            s_frac = sun_frac_cube[nt, ny_cell, nx_cell] / 100.0
            is_dark = (s_frac - eff_margin) < min_sun_frac
            current_dark_s = dark_so_far.get((cx, cy, ct), 0.0)
            if is_dark:
                if dark_budget_h <= 0.0:
                    continue  # Zero dark budget: no shadow traversal allowed
                if current_dark_s + transit_s > (dark_budget_h * 3600.0 + 1e-6):
                    continue  # Exceeds allowable darkness budget""",
        mutated_replacement="""            # MUTATION: skip dark budget completely
            s_frac = sun_frac_cube[nt, ny_cell, nx_cell] / 100.0
            is_dark = False
            current_dark_s = 0.0""",
        test_args=["tests/test_routing.py", "tests/audit/test_adversarial.py"],
    ),
    Mutation(
        id="M9",
        name="allow_diagonal_blocked_corners",
        target_file=ROOT_DIR / "pipeline" / "routing.py",
        description="Allow diagonal moves cutting through impassable obstacle corners",
        target_pattern="""            # Prevent diagonal moves through blocked corners (corner-cutting check)
            if dx != 0 and dy != 0:
                if (not traversable_grid[cy, nx_cell] or slope_grid[cy, nx_cell] > max_slope_deg) or \\
                   (not traversable_grid[ny_cell, cx] or slope_grid[ny_cell, cx] > max_slope_deg):
                    continue""",
        mutated_replacement="""            # MUTATION: allow diagonal moves through blocked corners
            pass""",
        test_args=["tests/test_routing.py", "tests/audit/test_adversarial.py"],
    ),
]


def run_single_mutation(mutation: Mutation, python_exe: str) -> bool:
    """Apply mutation, run tests, restore file, and return True if KILLED, False if SURVIVED."""
    target_path = mutation.target_file
    if not target_path.exists():
        raise FileNotFoundError(f"Target file {target_path} not found")

    original_content = target_path.read_text(encoding="utf-8")

    if mutation.target_pattern not in original_content:
        print(f"  [ERROR] Pattern for mutation {mutation.name} not found in {target_path.name}")
        return False

    mutated_content = original_content.replace(mutation.target_pattern, mutation.mutated_replacement, 1)

    try:
        # Apply mutation
        target_path.write_text(mutated_content, encoding="utf-8")

        # Run pytest with mutation flag so conftest won't overwrite production results.json
        import os
        sub_env = os.environ.copy()
        sub_env["LIGHTPATH_MUTATION_CHECK"] = "1"
        cmd = [python_exe, "-m", "pytest", "-q", "--tb=no"] + mutation.test_args
        res = subprocess.run(
            cmd,
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            env=sub_env,
        )

        # If tests failed (exit code != 0), the mutation was successfully caught (KILLED)
        if res.returncode != 0:
            return True
        else:
            return False

    finally:
        # Always restore original file
        target_path.write_text(original_content, encoding="utf-8")


def main() -> int:
    print("=" * 80)
    print("LightPath Mutation Test Harness (scripts/mutation_check.py)")
    print("=" * 80)

    venv_py = ROOT_DIR / ".venv" / "Scripts" / "python.exe"
    python_exe = str(venv_py) if venv_py.exists() else sys.executable
    print(f"Using Python: {python_exe}")
    print(f"Testing {len(MUTATIONS)} deliberate mutations against the test suite...\n")

    results = []
    survived_count = 0
    killed_count = 0

    for m in MUTATIONS:
        print(f"Running {m.id}: {m.name}...")
        killed = run_single_mutation(m, python_exe)
        status = "KILLED (PASS)" if killed else "SURVIVED (FAIL)"
        if killed:
            killed_count += 1
            print(f"  -> {status}: caught by test suite")
        else:
            survived_count += 1
            print(f"  -> {status}: NO test failed!")
        results.append((m, killed))

    print("\n" + "=" * 80)
    print("Mutation Testing Summary")
    print("=" * 80)
    print(f"{'ID':<4} | {'Mutation Name':<30} | {'Status':<16} | {'Target Module'}")
    print("-" * 80)
    for m, killed in results:
        status_str = "KILLED" if killed else "SURVIVED"
        print(f"{m.id:<4} | {m.name:<30} | {status_str:<16} | {m.target_file.name}")
    print("-" * 80)
    print(f"Total: {len(MUTATIONS)} mutations | Killed: {killed_count} | Survived: {survived_count}\n")

    if survived_count > 0:
        print(f"[ALERT] {survived_count} mutation(s) survived! Add targeted tests to kill them.")
        return 1
    else:
        print("[SUCCESS] All mutations successfully killed! Test suite is mathematically robust.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
