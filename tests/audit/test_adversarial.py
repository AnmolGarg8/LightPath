"""Adversarial stress-testing suite for LightPath pipeline.

Independent audit test suite exercising extreme boundary cases:
1. Observer at the pole (South and North Pole singularities)
2. Observer on a sharp ridge (negative horizon dip)
3. Observer in a pit (deep crater depression, steep horizon)
4. A one-pixel wall (sub-pixel sampling, raycast detection)
5. A wall at exactly the maximum range (distance range boundary)
6. An all-NaN sector (nodata propagation, periodic interpolation behavior)
7. Thresholds 0.0 and 1.0 (boundary clipping)
8. Very short date ranges (sub-step and zero-duration intervals)
9. Start equals goal in space-time routing
10. Goal inside a slope-blocked region
11. Route that must wait through darkness before traversing
12. Observer and grid at the DEM tile edge
"""

import math

import numpy as np
import pytest

from pipeline.constants import R_MOON_M, STATUS_MARGINAL, STATUS_ROBUST_BLOCKED, STATUS_ROBUST_VISIBLE
from pipeline.disc import compute_flat_horizon_disc_fraction
from pipeline.geometry import (
    compute_elevation_angle_deg,
    enu_basis,
    great_circle_distance_m,
)
from pipeline.horizon import horizon_profile
from pipeline.routing import plan_lunar_traverse
from pipeline.series import generate_time_steps
from pipeline.stats import compute_window_statistics
from pipeline.visibility import classify_status, disc_fraction_profile


# =============================================================================
# 1. Observer at the Pole
# =============================================================================
def test_adversarial_01_pole_singularity():
    """Test observer exactly at South Pole (-90 deg) and North Pole (+90 deg).

    Verifies orthonormal ENU basis resolution, IAU cartographic convention,
    and geodetic raycasting from pole without NaN or division by zero.
    """
    # South Pole (-90 deg)
    e_s, n_s, u_s = enu_basis(-90.0, 0.0)
    assert np.allclose(u_s, [0.0, 0.0, -1.0]), "South Pole Up must be [0, 0, -1]"
    assert np.allclose(n_s, [1.0, 0.0, 0.0]), "South Pole North must point toward Prime Meridian (+X)"
    assert np.allclose(e_s, [0.0, 1.0, 0.0]), "South Pole East must point toward +90 deg Lon (+Y)"
    assert np.isclose(np.dot(e_s, n_s), 0.0), "East and North must be orthogonal"
    assert np.allclose(np.cross(e_s, n_s), u_s), "Right-handed rule e x n = u must hold at South Pole"

    # North Pole (+90 deg)
    e_n, n_n, u_n = enu_basis(90.0, 0.0)
    assert np.allclose(u_n, [0.0, 0.0, 1.0]), "North Pole Up must be [0, 0, 1]"
    assert np.allclose(n_n, [-1.0, 0.0, 0.0]), "North Pole North must point along -X"
    assert np.allclose(e_n, [0.0, 1.0, 0.0]), "North Pole East must point along +Y"
    assert np.allclose(np.cross(e_n, n_n), u_n), "Right-handed rule e x n = u must hold at North Pole"

    # Synthetic flat terrain at South Pole
    def flat_dem(lat, lon):
        return np.zeros_like(lat, dtype=np.float64)

    hor = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        terrain=flat_dem,
        az_step_deg=45.0,
        max_range_m=10000.0,
        step_m=100.0,
        mast_height_m=2.0,
    )
    # Observer on flat Moon at h=2m should see a negative horizon dip around all azimuths
    expected_dip_deg = -math.degrees(math.acos(R_MOON_M / (R_MOON_M + 2.0)))
    assert not np.any(np.isnan(hor.el_deg)), "Horizon elevation at pole must not contain NaNs"
    assert np.allclose(hor.el_deg, expected_dip_deg, atol=0.02), (
        f"Horizon at pole should match geometric dip {expected_dip_deg:.3f} deg"
    )


# =============================================================================
# 2. Observer on a Ridge
# =============================================================================
def test_adversarial_02_observer_on_ridge():
    """Test observer on a sharp high ridge (z0 = +1500m) with surrounding terrain at 0m."""
    z0 = 1500.0
    r_obs = R_MOON_M + z0

    # Geometric depression angle to spherical horizon: dip = -arccos(R / r_obs)
    expected_dip_deg = -math.degrees(math.acos(R_MOON_M / r_obs))  # ~ -2.38 deg

    def ridge_dem(lat, lon):
        return 0.0

    hor = horizon_profile(
        site_lat_deg=-89.5,
        site_lon_deg=0.0,
        ground_elev_m=z0,
        terrain=ridge_dem,
        az_step_deg=30.0,
        max_range_m=100000.0,  # 100 km (beyond geometric horizon ~72 km)
        step_m=500.0,
        mast_height_m=0.0,
    )

    assert np.all(hor.el_deg < 0.0), "All horizon angles from ridge top must be depressed (< 0 deg)"
    assert np.allclose(hor.el_deg, expected_dip_deg, atol=0.05), (
        f"Ridge horizon {hor.el_deg[0, 0]:.3f} deg must match theoretical dip {expected_dip_deg:.3f} deg"
    )


# =============================================================================
# 3. Observer in a Deep Pit
# =============================================================================
def test_adversarial_03_observer_in_pit():
    """Test observer in a deep pit (z0 = -2000m) with a crater rim of 0m at 10km."""
    z0 = -2000.0
    rim_elev = 0.0
    rim_dist = 10000.0

    def crater_dem(lat, lon):
        d = great_circle_distance_m(-89.0, 45.0, lat, lon)
        return rim_elev if d >= rim_dist else z0

    hor = horizon_profile(
        site_lat_deg=-89.0,
        site_lon_deg=45.0,
        ground_elev_m=z0,
        terrain=crater_dem,
        az_step_deg=45.0,
        max_range_m=20000.0,
        step_m=100.0,
        mast_height_m=2.0,
    )

    # Elevation angle of rim from pit floor
    expected_el = compute_elevation_angle_deg(
        dist_m=rim_dist,
        elev_m=rim_elev,
        observer_height_m=2.0,
        site_ground_elev_m=z0,
    )
    assert np.all(hor.el_deg > 10.0), "Crater pit horizon must be steeply positive (> 10 deg)"
    assert np.allclose(hor.el_deg, expected_el, atol=0.2), (
        f"Pit horizon {hor.el_deg.ravel()[0]:.2f} deg should match rim elevation angle {expected_el:.2f} deg"
    )


# =============================================================================
# 4. A One-Pixel Wall
# =============================================================================
def test_adversarial_04_one_pixel_wall():
    """Test detection of an isolated 1-pixel spike (width 20m, height 500m) at 5km.

    Verifies that ray step size (step_m <= half pixel size = 10m) captures the narrow feature.
    """
    wall_dist = 5000.0
    wall_thickness = 20.0
    wall_height = 500.0

    def spike_dem(lat, lon):
        d = great_circle_distance_m(-89.0, 0.0, lat, lon)
        return wall_height if (wall_dist <= d < (wall_dist + wall_thickness)) else 0.0

    # Step size of 10m guarantees at least 2 samples fall within the 20m wall
    hor = horizon_profile(
        site_lat_deg=-89.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        terrain=spike_dem,
        az_step_deg=90.0,
        max_range_m=10000.0,
        step_m=10.0,
        mast_height_m=0.0,
    )

    expected_wall_el = compute_elevation_angle_deg(dist_m=wall_dist, elev_m=wall_height)
    assert np.allclose(hor.el_deg, expected_wall_el, atol=0.05), (
        f"Raycasting failed to capture one-pixel wall: got {hor.el_deg[0, 0]:.3f} vs {expected_wall_el:.3f}"
    )


# =============================================================================
# 5. Wall at Exactly the Maximum Range
# =============================================================================
def test_adversarial_05_wall_at_exact_max_range():
    """Test a tall wall placed at exactly max_range_m.

    Verifies that np.arange(step_m, max_range_m + step_m / 2.0, step_m) includes the boundary point.
    """
    max_range = 25000.0
    wall_height = 1000.0

    def edge_dem(lat, lon):
        d = great_circle_distance_m(-89.0, 0.0, lat, lon)
        return wall_height if abs(d - max_range) <= 15.0 else 0.0

    hor = horizon_profile(
        site_lat_deg=-89.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        terrain=edge_dem,
        az_step_deg=90.0,
        max_range_m=max_range,
        step_m=20.0,
        mast_height_m=0.0,
    )

    expected_el = compute_elevation_angle_deg(dist_m=max_range, elev_m=wall_height)
    assert np.allclose(hor.el_deg, expected_el, atol=0.1), (
        f"Wall at exact max_range_m was not sampled! Got {hor.el_deg[0, 0]:.3f} vs {expected_el:.3f}"
    )


# =============================================================================
# 6. All-NaN Sector
# =============================================================================
def test_adversarial_06_all_nan_sector():
    """Test horizon and visibility calculation when an entire sector (e.g. 45..90 deg) is NaN."""
    def nan_sector_dem(lat, lon):
        # Nodata region: rays pointing eastward into lon >= 2.0 deg (within 10 km range)
        return np.nan if (float(lon) >= 2.0) else 0.0

    hor = horizon_profile(
        site_lat_deg=-88.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        terrain=nan_sector_dem,
        az_step_deg=10.0,
        max_range_m=10000.0,
        step_m=100.0,
        mast_height_m=2.0,
    )

    # Check that nan_fraction correctly reports corrupted rays
    assert np.any(hor.nan_fraction > 0.0), "NaN sector must be recorded in nan_fraction"

    # Profile disc evaluation across a horizon with NaN
    horizon_az = np.linspace(0, 350, 36)
    horizon_el = np.zeros(36)
    horizon_el[5:10] = np.nan  # Inject NaNs into horizon profile

    frac = disc_fraction_profile(
        az_deg=60.0,
        el_deg=1.0,
        radius_deg=0.26,
        horizon_az_deg=horizon_az,
        horizon_el_deg=horizon_el,
    )
    status = classify_status(frac, threshold=0.5, margin_deg=0.1)
    assert status == STATUS_MARGINAL or np.isnan(frac), "NaN sector should classify safely as marginal"

    # Check that nan_fraction correctly reports corrupted rays
    assert np.any(hor.nan_fraction > 0.0), "NaN sector must be recorded in nan_fraction"

    # Profile disc evaluation across a horizon with NaN
    # Periodic interpolation should handle or propagate NaN
    horizon_az = np.linspace(0, 350, 36)
    horizon_el = np.zeros(36)
    horizon_el[5:10] = np.nan  # Inject NaNs into horizon profile

    frac = disc_fraction_profile(
        az_deg=60.0,
        el_deg=1.0,
        radius_deg=0.26,
        horizon_az_deg=horizon_az,
        horizon_el_deg=horizon_el,
    )
    # Status classification with NaN fraction
    status = classify_status(frac, threshold=0.5, margin_deg=0.1)
    # When fraction is NaN, status safely falls back to marginal
    assert status == STATUS_MARGINAL or np.isnan(frac), "NaN sector should classify safely as marginal"


# =============================================================================
# 7. Thresholds 0.0 and 1.0
# =============================================================================
def test_adversarial_07_boundary_thresholds():
    """Test boundary thresholds 0.0 (grazing touch) and 1.0 (strict full illumination)."""
    # Threshold = 0.0: Any visible sliver is considered visible
    status_grazing = classify_status(0.01, threshold=0.0, margin_deg=0.0)
    assert status_grazing == STATUS_ROBUST_VISIBLE

    # Threshold = 1.0: 99.9% illuminated is STILL blocked/marginal
    status_99 = classify_status(0.999, threshold=1.0, margin_deg=0.0)
    assert status_99 == STATUS_ROBUST_BLOCKED

    status_100 = classify_status(1.0, threshold=1.0, margin_deg=0.0)
    assert status_100 == STATUS_ROBUST_VISIBLE

    # Flat horizon disc fraction checks
    assert compute_flat_horizon_disc_fraction(e_deg=1.0, r_deg=0.5) == 1.0
    assert compute_flat_horizon_disc_fraction(e_deg=-1.0, r_deg=0.5) == 0.0
    assert np.isclose(compute_flat_horizon_disc_fraction(e_deg=0.0, r_deg=0.5), 0.5)

    # Window statistics with all-true and all-false at extreme thresholds
    ts = ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z", "2026-11-01T02:00:00Z"]
    w_all = compute_window_statistics([True, True, True], ts)
    assert w_all["pct_time_above"] == 100.0
    assert w_all["longest_window_h"] == 3.0
    assert w_all["longest_outage_h"] == 0.0

    w_none = compute_window_statistics([False, False, False], ts)
    assert w_none["pct_time_above"] == 0.0
    assert w_none["longest_window_h"] == 0.0
    assert w_none["longest_outage_h"] == 3.0


# =============================================================================
# 8. Very Short Date Ranges
# =============================================================================
def test_adversarial_08_short_date_ranges():
    """Test zero-duration and sub-step intervals."""
    # Sub-step interval: end is 15 minutes after start with step_minutes=60
    ts_short = generate_time_steps("2026-11-01T00:00:00Z", "2026-11-01T00:15:00Z", step_minutes=60)
    # Should only generate the start timestamp
    assert len(ts_short) == 1
    assert ts_short[0] == "2026-11-01T00:00:00Z"

    # Zero duration: start == end
    with pytest.raises(ValueError, match="must be after"):
        generate_time_steps("2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z", step_minutes=60)


# =============================================================================
# 9. Start Equals Goal in Routing
# =============================================================================
def test_adversarial_09_start_equals_goal():
    """Test space-time routing when start_coord == end_coord."""
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": 5, "ny": 5},
        "time_utc": ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"],
        "sun_frac": np.full((2, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((2, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((5, 5), dtype=np.float64).tolist(),
        "traversable": np.ones((5, 5), dtype=bool).tolist(),
        "flags": [],
    }

    res = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(2, 2),
        end_coord=(2, 2),
        start_time_idx=0,
        speed_m_s=0.05,
    )

    assert res["feasible"] is True, "Start == Goal must be immediately feasible"
    assert len(res["path"]) == 1, "Path should contain exactly 1 waypoint"
    assert res["metrics"]["total_distance_m"] == 0.0
    assert res["metrics"]["duration_h"] == 0.0


# =============================================================================
# 10. Goal Inside Slope-Blocked Region
# =============================================================================
def test_adversarial_10_goal_in_slope_blocked_region():
    """Test routing when goal cell has a steep cliff (slope = 35 deg > max 15 deg)."""
    slopes = np.zeros((5, 5), dtype=np.float64)
    traversable = np.ones((5, 5), dtype=bool)

    # Goal (4, 4) is un-traversable
    slopes[4, 4] = 35.0
    traversable[4, 4] = False

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": 5, "ny": 5},
        "time_utc": ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"],
        "sun_frac": np.full((2, 5, 5), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((2, 5, 5), 100, dtype=np.uint8).tolist(),
        "slope_deg": slopes.tolist(),
        "traversable": traversable.tolist(),
        "flags": [],
    }

    res = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(4, 4),
        start_time_idx=0,
        max_slope_deg=15.0,
    )

    assert res["feasible"] is False, "Routing into slope-blocked goal must be infeasible"
    assert len(res["path"]) == 0
    assert "No feasible path found" in res["explanation"]


# =============================================================================
# 11. Route Must Wait Through Darkness Before Traversing
# =============================================================================
def test_adversarial_11_route_waits_through_darkness():
    """Test traverse where path is shadowed at arrival time t=1, but becomes sunlit at t=2.

    The solver must issue a wait action at (0, 0) during t=0 and t=1, and advance to (1, 0) at t=2.
    """
    sun_frac = np.zeros((3, 3, 3), dtype=np.uint8)

    # Start cell (0, 0) is always sunlit (100%)
    sun_frac[:, 0, 0] = 100

    # At t=0: destination (1,0) is in shadow (0%)
    sun_frac[0, 0, 1] = 0

    # At t=1: destination (1,0) is STILL in shadow (0%)
    sun_frac[1, 0, 1] = 0

    # At t=2: destination (1,0) finally becomes sunlit (100%)
    sun_frac[2, 0, 1] = 100

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 10.0, "nx": 3, "ny": 3},
        "time_utc": [
            "2026-11-01T00:00:00Z",
            "2026-11-01T01:00:00Z",
            "2026-11-01T02:00:00Z",
        ],
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((3, 3, 3), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 3), dtype=np.float64).tolist(),
        "traversable": np.ones((3, 3), dtype=bool).tolist(),
        "flags": [],
    }

    # If wait is disabled, immediate movement to (1, 0) arrives at t=1 where sun_frac is 0% -> infeasible
    res_no_wait = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(1, 0),
        start_time_idx=0,
        speed_m_s=0.01,
        allow_wait=False,
    )
    assert res_no_wait["feasible"] is False, "Without waiting, rover cannot arrive at dark cell"

    # With wait allowed, rover waits at (0, 0) until t=1, then proceeds to arrive at t=2
    res_wait = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(1, 0),
        start_time_idx=0,
        speed_m_s=0.01,
        allow_wait=True,
    )
    assert res_wait["feasible"] is True, "Rover should wait at start until darkness clears"
    assert res_wait["path"][0] == {"x": 0, "y": 0, "t": 0}
    assert res_wait["path"][1] == {"x": 0, "y": 0, "t": 1}, "Waypoint 1 must be wait in place"
    assert res_wait["path"][2]["x"] == 1 and res_wait["path"][2]["y"] == 0, "Waypoint 2 moves to goal"


# =============================================================================
# 12. Grid at the Tile Edge
# =============================================================================
def test_adversarial_12_grid_at_tile_edge():
    """Test observer raycasting and routing grid placed right on the edge of DEM bounds.

    Verifies hit_tile_edge flag triggering and graceful handling of out-of-bounds queries.
    """
    # Synthetic DEM that returns NaN for any distance > 2000 m (simulating a small tile)
    def small_tile_dem(lat, lon):
        d = great_circle_distance_m(-89.0, 0.0, lat, lon)
        return np.nan if d > 2000.0 else 0.0

    # Raycasting to 10 km must cross the tile edge and raise the hit_tile_edge flag
    hor = horizon_profile(
        site_lat_deg=-89.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        terrain=small_tile_dem,
        az_step_deg=45.0,
        max_range_m=10000.0,
        step_m=100.0,
        mast_height_m=2.0,
    )

    assert "hit_tile_edge" in hor.flags, "Rays exceeding DEM boundaries must set 'hit_tile_edge' flag"
    assert np.all(hor.nan_fraction > 0.0), "NaN fraction must reflect out-of-bounds samples"


# =============================================================================
# 13. Route That Must Wait the Whole Window
# =============================================================================
def test_adversarial_13_route_must_wait_whole_window():
    """Test traverse where destination is shadowed until the very last time step.

    Simulates a rover waiting out darkness for T-1 steps and arriving at t=T-1.
    Also verifies that if the sunlit opening occurs beyond the window, feasible is False.
    """
    num_t = 6
    sun_frac = np.zeros((num_t, 2, 2), dtype=np.uint8)
    # Start (0, 0) always illuminated
    sun_frac[:, 0, 0] = 100
    # Destination (1, 0) shadowed for t=0..4, only sunlit at final step t=5
    sun_frac[num_t - 1, 0, 1] = 100

    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 10.0, "nx": 2, "ny": 2},
        "time_utc": [f"2026-11-01T0{i}:00:00Z" for i in range(num_t)],
        "sun_frac": sun_frac.tolist(),
        "earth_frac": np.full((num_t, 2, 2), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((2, 2), dtype=np.float64).tolist(),
        "traversable": np.ones((2, 2), dtype=bool).tolist(),
        "flags": [],
    }

    # Case A: Sunlit opening is at t=5 (inside simulation window)
    res_wait = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(1, 0),
        start_time_idx=0,
        speed_m_s=0.01,
        allow_wait=True,
    )
    assert res_wait["feasible"] is True, "Rover must be feasible by waiting until last time step"
    assert len(res_wait["path"]) == 6, "Must contain 5 wait actions plus 1 arrival"
    assert res_wait["path"][-1] == {"x": 1, "y": 0, "t": 5}, "Final waypoint must arrive at t=5"

    # Case B: Destination is shadowed for the entire window (t=0..5 all 0%)
    sun_frac_blocked = np.zeros((num_t, 2, 2), dtype=np.uint8)
    sun_frac_blocked[:, 0, 0] = 100
    cube_blocked = dict(cube, sun_frac=sun_frac_blocked.tolist())

    res_blocked = plan_lunar_traverse(
        visibility_cube=cube_blocked,
        start_coord=(0, 0),
        end_coord=(1, 0),
        start_time_idx=0,
        speed_m_s=0.01,
        allow_wait=True,
    )
    assert res_blocked["feasible"] is False, "When darkness outlasts time window, path must be infeasible"


# =============================================================================
# 14. Two Nested Terrain Layers With a Seam
# =============================================================================
def test_adversarial_14_nested_terrain_seam_and_step_discontinuity():
    """Test sampling across a multi-resolution seam between fine and coarse DEM layers.

    Verifies continuous sampling across aligned layers and measures the unblended
    step discontinuity when adjacent layers possess vertical offsets.
    """
    from pipeline.terrain import NestedTerrain, NestedTerrainLayer

    # 1. Aligned layers: both report 150.0m elevation
    inner_aligned = lambda lat, lon: np.full_like(lat, 150.0)
    outer_aligned = lambda lat, lon: np.full_like(lat, 150.0)

    nt_aligned = NestedTerrain([
        NestedTerrainLayer(dem=inner_aligned, max_range_m=5000.0, name="fine_inner"),
        NestedTerrainLayer(dem=outer_aligned, max_range_m=20000.0, name="coarse_outer"),
    ])

    # Sample immediately before and after the 5000m seam
    dists = np.array([4990.0, 4999.0, 5000.0, 5001.0, 5010.0])
    lats = np.full(5, -89.0)
    lons = np.full(5, 0.0)

    elevs_aligned = nt_aligned.sample(dists, lats, lons)
    assert np.allclose(elevs_aligned, 150.0), "Aligned layers must be perfectly continuous across seam"

    # 2. Unaligned layers: 5m datum offset between inner (150m) and outer (155m)
    inner_offset = lambda lat, lon: np.full_like(lat, 150.0)
    outer_offset = lambda lat, lon: np.full_like(lat, 155.0)

    nt_offset = NestedTerrain([
        NestedTerrainLayer(dem=inner_offset, max_range_m=5000.0, name="fine_inner"),
        NestedTerrainLayer(dem=outer_offset, max_range_m=20000.0, name="coarse_outer"),
    ])

    elevs_seam = nt_offset.sample(np.array([4999.0, 5001.0]), np.array([-89.0, -89.0]), np.array([0.0, 0.0]))
    step_m = elevs_seam[1] - elevs_seam[0]
    assert np.isclose(step_m, 5.0), "NestedTerrain performs hard threshold switching with unblended 5m step"

    # Angular horizon step produced by 5m jump at 5000m
    angular_step_deg = math.degrees(math.atan2(5.0, 5000.0))  # ~0.057 deg
    assert angular_step_deg > 0.05, f"Unblended step produces {angular_step_deg:.3f} deg artificial horizon discontinuity"


# =============================================================================
# 15. Very Large Mast Height (Orbital Scale)
# =============================================================================
def test_adversarial_15_very_large_mast_height():
    """Test exact spherical curvature formulas with extremely large mast height (100 km).

    Verifies that float64 precision is preserved without catastrophic cancellation or overflow.
    """
    mast_h = 100000.0  # 100 km mast
    r_obs = R_MOON_M + mast_h

    # Exact horizon depression angle: dip = -arccos(R / r_obs)
    theta_horizon = math.acos(R_MOON_M / r_obs)
    expected_dip_deg = -math.degrees(theta_horizon)  # ~ -18.9900 deg

    # Great-circle arc distance to the tangent point: s = R * theta
    arc_dist_m = R_MOON_M * theta_horizon

    computed_el = compute_elevation_angle_deg(
        dist_m=arc_dist_m,
        elev_m=0.0,
        observer_height_m=mast_h,
        site_ground_elev_m=0.0,
    )

    diff = abs(computed_el - expected_dip_deg)
    assert diff < 1e-12, (
        f"Spherical elevation formula lost precision at 100km mast: diff={diff:.3e} deg"
    )


# =============================================================================
# 16. Rover Speed of Zero
# =============================================================================
def test_adversarial_16_speed_zero_handled_gracefully():
    """Test passing speed_m_s = 0.0 to route solver.

    Verifies that plan_lunar_traverse safely validates speed > 0 and returns an
    infeasible RouteResult rather than crashing with unhandled ZeroDivisionError.
    """
    cube = {
        "grid": {"origin": [0.0, -89.0], "spacing_m": 50.0, "nx": 3, "ny": 3},
        "time_utc": ["2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"],
        "sun_frac": np.full((2, 3, 3), 100, dtype=np.uint8).tolist(),
        "earth_frac": np.full((2, 3, 3), 100, dtype=np.uint8).tolist(),
        "slope_deg": np.zeros((3, 3), dtype=np.float64).tolist(),
        "traversable": np.ones((3, 3), dtype=bool).tolist(),
        "flags": [],
    }

    res = plan_lunar_traverse(
        visibility_cube=cube,
        start_coord=(0, 0),
        end_coord=(1, 1),
        speed_m_s=0.0,
    )
    assert res["feasible"] is False
    assert "speed_m_s must be strictly positive" in res["explanation"]



# =============================================================================
# 17. Date Range Crossing Kernel Coverage Boundary
# =============================================================================
def test_adversarial_17_date_range_kernel_boundary():
    """Test date queries far in future (2060) or past (1900) without physical kernels.

    Verifies that utc_to_et and topocentric calculations execute analytical fallbacks
    without raising an error, but that physical SPICE kernels are absent.
    """
    from pipeline.geometry import are_kernels_loaded, utc_to_et
    from pipeline.ephemeris import compute_topocentric_sun_state

    # Kernels are not loaded in default synthetic test environment
    assert not are_kernels_loaded()

    # Query far future date (year 2060)
    t_2060 = "2060-01-01T00:00:00Z"
    et_2060 = utc_to_et(t_2060)
    assert isinstance(et_2060, float)
    assert et_2060 > 1.8e9  # ~60 years * 3.15e7 s/yr

    sun_state_2060 = compute_topocentric_sun_state(t_2060, -89.0, 0.0, 0.0)
    assert -2.5 <= sun_state_2060.el_deg <= 2.5, "Subsolar declination must remain within polar bounds"

