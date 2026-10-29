"""Unit and physics verification tests for pipeline.horizon module.

Verification Test Suites:
- V1 Flat: observer height h over flat DEM matches -acos(R / (R + h)) within 0.005 deg.
- V2 Wall: height H at distance D over azimuth range matches exact formula within 0.01 deg.
- Seam test for nested multi-resolution DEM layers.
- Convergence tests (halve radial step, halve azimuth step, double max range).
- Edge cases (NaN holes, tile boundary flags, observer in a pit).
- Batch testing: horizon_profiles_for_points matches horizon_profile for each point.
- Performance: throughput in cells per second.
"""

import json
import math
import tempfile
from pathlib import Path

import numpy as np
import pyproj
from jsonschema import validate

from pipeline.constants import R_MOON_M
from pipeline.geometry import compute_elevation_angle_deg
from pipeline.horizon import (
    HorizonProfile,
    compute_horizon_from_dem_radial_rays,
    compute_synthetic_horizon_profile,
    horizon_profile,
    horizon_profiles_for_points,
)
from pipeline.synthetic import (
    create_flat_dem,
    create_nested_synthetic_layers,
    create_wall_dem,
)
from pipeline.terrain import NestedTerrain, NestedTerrainLayer, open_dem_window

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def test_v1_flat_dem_limb_dip():
    """V1 Flat Test:

    Observer height h over flat DEM (elev = 0 m).
    Every azimuth must equal -acos(R / (R + h)) in degrees within 0.005 degrees.
    Tangent distance d_tangent = R * acos(R / (R + h)) ~ 2636 m for h = 2 m.
    max_range_m = 10000 m exceeds tangent distance.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        flat_path = Path(tmpdir) / "flat_dem.tif"
        create_flat_dem(flat_path, width_m=30000.0, height_m=30000.0, pixel_size_m=50.0, base_elev_m=0.0)
        dem = open_dem_window(flat_path, center_lat_deg=-90.0, center_lon_deg=0.0, half_width_m=12000.0)

        # Case 1: Observer mast height h = 2.0 m
        h_2m = 2.0
        res_2m = horizon_profile(
            site_lat_deg=-90.0,
            site_lon_deg=0.0,
            ground_elev_m=0.0,
            mast_height_m=h_2m,
            terrain=dem,
            max_range_m=10000.0,
            step_m=25.0,
            az_step_deg=5.0,
        )
        expected_dip_2m = -math.degrees(math.acos(R_MOON_M / (R_MOON_M + h_2m)))  # ~ -0.086937 deg
        for el in res_2m.el_deg:
            assert math.isclose(el, expected_dip_2m, abs_tol=0.005)

        # Case 2: Observer ground level h = 0.0 m (should be 0.0 deg)
        res_0m = horizon_profile(
            site_lat_deg=-90.0,
            site_lon_deg=0.0,
            ground_elev_m=0.0,
            mast_height_m=0.0,
            terrain=dem,
            max_range_m=10000.0,
            step_m=25.0,
            az_step_deg=10.0,
        )
        for el in res_0m.el_deg:
            assert math.isclose(el, 0.0, abs_tol=0.005)

        # Case 3: Mast height h = 10.0 m
        h_10m = 10.0
        res_10m = horizon_profile(
            site_lat_deg=-90.0,
            site_lon_deg=0.0,
            ground_elev_m=0.0,
            mast_height_m=h_10m,
            terrain=dem,
            max_range_m=10000.0,
            step_m=25.0,
            az_step_deg=10.0,
        )
        expected_dip_10m = -math.degrees(math.acos(R_MOON_M / (R_MOON_M + h_10m)))
        for el in res_10m.el_deg:
            assert math.isclose(el, expected_dip_10m, abs_tol=0.005)


def test_v2_wall_dem_elevation():
    """V2 Wall Test:

    Height H = 100 m at distance D = 10 km over azimuth range [30 deg, 60 deg].
    Inside azimuth range, elevation must equal exact curvature formula within 0.01 deg (~0.41 deg).
    Outside azimuth range, elevation matches baseline flat limb dip.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        wall_path = Path(tmpdir) / "wall_dem.tif"
        create_wall_dem(
            wall_path,
            distance_m=10000.0,
            height_m=100.0,
            az_start_deg=30.0,
            az_end_deg=60.0,
            thickness_m=100.0,
            width_m=40000.0,
            height_grid_m=40000.0,
            pixel_size_m=25.0,
            site_lat_deg=-89.9,
            site_lon_deg=0.0,
            base_elev_m=0.0,
        )
        dem = open_dem_window(wall_path, center_lat_deg=-89.9, center_lon_deg=0.0, half_width_m=18000.0)

        res = horizon_profile(
            site_lat_deg=-89.9,
            site_lon_deg=0.0,
            ground_elev_m=0.0,
            mast_height_m=0.0,
            terrain=dem,
            max_range_m=15000.0,
            step_m=20.0,
            az_step_deg=2.0,
        )

        expected_wall_el = compute_elevation_angle_deg(
            dist_m=10000.0,
            elev_m=100.0,
            observer_height_m=0.0,
            site_ground_elev_m=0.0,
        )  # ~0.40803 deg (~0.41 deg)

        # Check inside range [35, 55] (comfortably inside wall boundary)
        wall_indices = [i for i, az in enumerate(res.az_deg) if 35.0 <= az <= 55.0]
        for idx in wall_indices:
            assert math.isclose(res.el_deg[idx], expected_wall_el, abs_tol=0.01)

        # Check outside range [120, 240]
        outside_indices = [i for i, az in enumerate(res.az_deg) if 120.0 <= az <= 240.0]
        for idx in outside_indices:
            assert math.isclose(res.el_deg[idx], 0.0, abs_tol=0.01)


def test_nested_terrain_seams():
    """Seam test for nested multi-resolution DEM layers.

    Ensures no artificial step in the horizon elevation across layer boundaries
    on a smooth synthetic surface.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        infos = create_nested_synthetic_layers(tmpdir, feature_type="flat", base_elev_m=50.0)
        layers = []
        for info in infos:
            dem_win = open_dem_window(
                info["path"],
                center_lat_deg=-90.0,
                center_lon_deg=0.0,
                half_width_m=info["max_range_m"] * 1.2,
            )
            layers.append(NestedTerrainLayer(dem=dem_win, max_range_m=info["max_range_m"], name=info["name"]))

        nested = NestedTerrain(layers)

        res = horizon_profile(
            site_lat_deg=-90.0,
            site_lon_deg=0.0,
            ground_elev_m=50.0,
            mast_height_m=2.0,
            terrain=nested,
            max_range_m=35000.0,
            step_m=50.0,
            az_step_deg=5.0,
        )

        expected_limb = -math.degrees(math.acos((R_MOON_M + 50.0) / (R_MOON_M + 50.0 + 2.0)))
        # Verify no step across all 72 azimuths
        for el in res.el_deg:
            assert math.isclose(el, expected_limb, abs_tol=0.005)


def test_convergence_halve_radial_step():
    """Convergence Test: Halving radial step_m converges to the exact horizon."""
    # Radial feature: ridge at 8 km with 200 m height
    def synthetic_ridge(lat, lon):
        # Distance from South Pole
        d = R_MOON_M * math.radians(abs(lat - (-90.0)))
        if abs(d - 8000.0) < 50.0:
            return 200.0
        return 0.0

    res_coarse = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        mast_height_m=0.0,
        terrain=synthetic_ridge,
        max_range_m=12000.0,
        step_m=40.0,
        az_step_deg=10.0,
    )

    res_fine = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        mast_height_m=0.0,
        terrain=synthetic_ridge,
        max_range_m=12000.0,
        step_m=20.0,
        az_step_deg=10.0,
    )

    # Difference between coarse and fine steps is well bounded (< 0.01 deg)
    diff = np.max(np.abs(res_coarse.el_deg - res_fine.el_deg))
    assert diff < 0.01


def test_convergence_halve_azimuth_step():
    """Convergence Test: Halving azimuth step refines interpolated profile."""
    prof_coarse = compute_synthetic_horizon_profile(
        az_step_deg=2.0,
        heights_m=[2.0],
        features=[{"az_center_deg": 45.0, "width_deg": 10.0, "height_deg": 2.0}],
    )
    prof_fine = compute_synthetic_horizon_profile(
        az_step_deg=1.0,
        heights_m=[2.0],
        features=[{"az_center_deg": 45.0, "width_deg": 10.0, "height_deg": 2.0}],
    )

    # Compare interpolated values at fine increments
    test_azs = np.linspace(0.0, 360.0, 360, endpoint=False)
    diffs = [
        abs(prof_coarse.get_elevation_deg(az, 2.0) - prof_fine.get_elevation_deg(az, 2.0))
        for az in test_azs
    ]
    assert max(diffs) < 0.1


def test_convergence_double_search_range():
    """Convergence Test: Doubling range beyond all terrain features leaves horizon unchanged."""
    def localized_terrain(lat, lon):
        d = R_MOON_M * math.radians(abs(lat - (-90.0)))
        if abs(d - 5000.0) < 50.0:
            return 300.0
        return 0.0

    res_10km = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        mast_height_m=0.0,
        terrain=localized_terrain,
        max_range_m=10000.0,
        step_m=25.0,
        az_step_deg=15.0,
    )
    res_20km = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=0.0,
        mast_height_m=0.0,
        terrain=localized_terrain,
        max_range_m=20000.0,
        step_m=25.0,
        az_step_deg=15.0,
    )

    assert np.allclose(res_10km.el_deg, res_20km.el_deg, atol=1e-7)


def test_edge_cases_nan_holes():
    """Edge Case: NaN holes in DEM are properly tracked in nan_fraction."""
    def dem_with_nan_hole(lat, lon):
        d = R_MOON_M * math.radians(abs(lat - (-90.0)))
        # Hole between 2000 m and 3000 m to the North
        if 2000.0 <= d <= 3000.0:
            return np.nan
        return 100.0

    res = horizon_profile(
        site_lat_deg=-90.0,
        site_lon_deg=0.0,
        ground_elev_m=100.0,
        mast_height_m=0.0,
        terrain=dem_with_nan_hole,
        max_range_m=5000.0,
        step_m=25.0,
        az_step_deg=10.0,
    )

    # 1000 m hole over 5000 m total range -> nan_fraction ~ 0.20
    assert np.all(res.nan_fraction > 0.15)
    assert np.all(res.nan_fraction < 0.25)
    # Valid elevation is still computed from non-NaN samples
    assert not np.any(np.isnan(res.el_deg))


def test_edge_cases_tile_boundary_flag():
    """Edge Case: Ray extending beyond DEM tile boundaries sets 'hit_tile_edge' flag."""
    with tempfile.TemporaryDirectory() as tmpdir:
        flat_path = Path(tmpdir) / "small_flat.tif"
        # Small tile: 4 km half-width
        create_flat_dem(flat_path, width_m=8000.0, height_m=8000.0, pixel_size_m=50.0, base_elev_m=0.0)
        dem = open_dem_window(flat_path, center_lat_deg=-90.0, center_lon_deg=0.0, half_width_m=4000.0)

        # Query with max_range_m = 10 km (well beyond tile edge)
        res = horizon_profile(
            site_lat_deg=-90.0,
            site_lon_deg=0.0,
            ground_elev_m=0.0,
            mast_height_m=2.0,
            terrain=dem,
            max_range_m=10000.0,
            step_m=50.0,
            az_step_deg=15.0,
        )

        assert "hit_tile_edge" in res.flags


def test_edge_cases_observer_in_pit():
    """Edge Case: Observer in a deep depression / crater bowl observes high positive horizon."""
    # Pit with floor at -500 m and surrounding rim at +100 m located 2 km away
    geod = pyproj.Geod(a=R_MOON_M, b=R_MOON_M)

    def crater_pit(lat, lon):
        _, _, d = geod.inv(0.0, -89.9, lon, lat)
        if d >= 2000.0:
            return 100.0
        return -500.0

    res = horizon_profile(
        site_lat_deg=-89.9,
        site_lon_deg=0.0,
        ground_elev_m=-500.0,
        mast_height_m=2.0,
        terrain=crater_pit,
        max_range_m=5000.0,
        step_m=25.0,
        az_step_deg=10.0,
    )

    # Elevation to rim (dz = 598 m over 2000 m on Moon sphere) is ~16.5 degrees
    for el in res.el_deg:
        assert math.isclose(el, 16.5, abs_tol=0.3)


def test_batch_horizon_profiles_for_points():
    """Batch Test: horizon_profiles_for_points matches horizon_profile for every point."""
    with tempfile.TemporaryDirectory() as tmpdir:
        flat_path = Path(tmpdir) / "batch_flat.tif"
        create_flat_dem(flat_path, width_m=30000.0, height_m=30000.0, pixel_size_m=50.0, base_elev_m=0.0)
        dem = open_dem_window(flat_path, center_lat_deg=-90.0, center_lon_deg=0.0, half_width_m=12000.0)

        points = [
            (-89.95, 0.0, 0.0),
            (-89.96, 45.0, 0.0),
            (-89.97, 90.0, 0.0),
            (-89.98, 180.0, 0.0),
        ]

        batch_out = horizon_profiles_for_points(
            points,
            terrain=dem,
            mast_height_m=2.0,
            max_range_m=5000.0,
            step_m=25.0,
            az_step_deg=5.0,
        )

        assert batch_out["num_cells"] == 4
        assert "throughput_cells_per_sec" in batch_out
        assert batch_out["throughput_cells_per_sec"] > 0.0

        for i, pt in enumerate(points):
            single_res = horizon_profile(
                site_lat_deg=pt[0],
                site_lon_deg=pt[1],
                ground_elev_m=pt[2],
                mast_height_m=2.0,
                terrain=dem,
                max_range_m=5000.0,
                step_m=25.0,
                az_step_deg=5.0,
            )
            assert np.array_equal(batch_out["results"][i].el_deg, single_res.el_deg)
            assert np.array_equal(batch_out["results"][i].az_deg, single_res.az_deg)
            assert np.array_equal(batch_out["results"][i].nan_fraction, single_res.nan_fraction)


def test_horizon_profile_schema_compliance():
    with open(SCHEMAS_DIR / "horizon.schema.json", "r", encoding="utf-8") as f:
        schema = json.load(f)

    prof = compute_synthetic_horizon_profile(az_step_deg=2.0, heights_m=[0.0, 2.0, 5.0])
    data = prof.to_dict()
    validate(instance=data, schema=schema)


def test_horizon_interpolation():
    az_step = 10.0
    num_az = 36
    heights = [0.0, 10.0]
    el = np.zeros((2, num_az))
    el[0, 0] = 1.0
    el[0, 1] = 2.0
    el[1, 0] = 0.5
    el[1, 1] = 1.5

    prof = HorizonProfile(
        az_step_deg=az_step,
        heights_m=heights,
        el_deg=el,
        nan_fraction=np.zeros((2, num_az)),
    )

    assert math.isclose(prof.get_elevation_deg(0.0, 0.0), 1.0, abs_tol=1e-7)
    assert math.isclose(prof.get_elevation_deg(10.0, 0.0), 2.0, abs_tol=1e-7)
    assert math.isclose(prof.get_elevation_deg(5.0, 0.0), 1.5, abs_tol=1e-7)
    assert math.isclose(prof.get_elevation_deg(0.0, 5.0), 0.75, abs_tol=1e-7)
    assert math.isclose(prof.get_elevation_deg(5.0, 5.0), 1.25, abs_tol=1e-7)


def test_mast_height_sensitivity():
    prof = compute_synthetic_horizon_profile(
        az_step_deg=1.0,
        heights_m=[0.0, 2.0, 5.0, 10.0],
        base_elev_m=1000.0,
        features=[{"az_center_deg": 90.0, "width_deg": 10.0, "height_deg": 3.0}],
    )
    for az in range(0, 360, 15):
        el_0 = prof.get_elevation_deg(float(az), height_m=0.0)
        el_2 = prof.get_elevation_deg(float(az), height_m=2.0)
        el_10 = prof.get_elevation_deg(float(az), height_m=10.0)
        assert el_2 <= el_0 + 1e-7
        assert el_10 <= el_2 + 1e-7


def test_compute_horizon_from_dem_radial_rays():
    ridge_dist_m = 10000.0
    ridge_elev_m = 500.0
    site_lat = -89.5
    site_lon = 0.0

    def mock_dem(lat_deg: float, lon_deg: float) -> float:
        d = R_MOON_M * math.radians(abs(lat_deg - site_lat))
        if lat_deg > site_lat and abs(d - ridge_dist_m) < 150.0:
            return ridge_elev_m
        return 0.0

    prof = compute_horizon_from_dem_radial_rays(
        site_lat_deg=site_lat,
        site_lon_deg=site_lon,
        dem_sample_fn=mock_dem,
        az_step_deg=5.0,
        heights_m=[0.0, 2.0],
        max_dist_m=20000.0,
        dist_step_m=100.0,
        site_ground_elev_m=0.0,
    )

    el_north = prof.get_elevation_deg(0.0, height_m=0.0)
    expected_el = compute_elevation_angle_deg(
        dist_m=ridge_dist_m,
        elev_m=ridge_elev_m,
        observer_height_m=0.0,
        site_ground_elev_m=0.0,
    )
    assert math.isclose(el_north, expected_el, abs_tol=0.05)
