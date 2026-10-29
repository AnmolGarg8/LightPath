"""Unit tests for pipeline.terrain module."""

import math
import tempfile
from pathlib import Path

import affine
import numpy as np
import pyproj
import pytest

from pipeline.constants import (
    LUNAR_GEOGRAPHIC_CRS,
    LUNAR_SOUTH_POLE_STEREO_CRS,
    R_MOON_M,
)
from pipeline.synthetic import create_flat_dem
from pipeline.terrain import (
    NestedTerrain,
    NestedTerrainLayer,
    open_dem_window,
    sample_bilinear,
    verify_lunar_crs_radius,
)


def test_verify_lunar_crs_radius_valid():
    crs_stereo = pyproj.CRS.from_string(LUNAR_SOUTH_POLE_STEREO_CRS)
    verify_lunar_crs_radius(crs_stereo, expected_r=R_MOON_M)

    crs_geo = pyproj.CRS.from_string(LUNAR_GEOGRAPHIC_CRS)
    verify_lunar_crs_radius(crs_geo, expected_r=R_MOON_M)


def test_verify_lunar_crs_radius_invalid():
    # Earth WGS84 CRS
    crs_earth = pyproj.CRS.from_epsg(4326)
    with pytest.raises(ValueError, match="differs from required lunar sphere radius"):
        verify_lunar_crs_radius(crs_earth, expected_r=R_MOON_M)

    # Moon PA or different radius
    crs_bad_radius = pyproj.CRS.from_string("+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1738000 +units=m +no_defs")
    with pytest.raises(ValueError, match="differs from required lunar sphere radius"):
        verify_lunar_crs_radius(crs_bad_radius, expected_r=R_MOON_M)


def test_dem_window_unpacking_and_properties():
    with tempfile.TemporaryDirectory() as tmpdir:
        dem_path = Path(tmpdir) / "test_flat.tif"
        create_flat_dem(dem_path, width_m=10000.0, height_m=10000.0, pixel_size_m=50.0, base_elev_m=123.4)

        dem_window = open_dem_window(dem_path, center_lat_deg=-90.0, center_lon_deg=0.0, half_width_m=2000.0)

        # Test 5-tuple unpacking
        arr, t, crs, nodata_mask, px_size = dem_window
        assert isinstance(arr, np.ndarray)
        assert isinstance(t, affine.Affine)
        assert isinstance(crs, pyproj.CRS)
        assert isinstance(nodata_mask, np.ndarray)
        assert px_size == 50.0

        # Elevation value
        valid_cells = arr[~nodata_mask]
        assert len(valid_cells) > 0
        assert np.allclose(valid_cells, 123.4)


def test_open_dem_window_file_not_found():
    with pytest.raises(FileNotFoundError):
        open_dem_window("non_existent_dem.tif", center_lat_deg=-90.0, center_lon_deg=0.0, half_width_m=1000.0)


def test_sample_bilinear_analytical_plane():
    # Construct a known bilinear surface: f(x, y) = 100.0 + 2.0*x + 3.0*y + 0.5*x*y
    # on a grid with coordinates 0..9
    nrows, ncols = 10, 10
    cols = np.arange(ncols)
    rows = np.arange(nrows)
    X, Y = np.meshgrid(cols, rows)
    grid = 100.0 + 2.0 * X + 3.0 * Y + 0.5 * X * Y

    # Query arbitrary non-integer points inside grid
    query_x = np.array([1.5, 3.25, 6.75, 8.1])
    query_y = np.array([2.5, 4.5, 7.25, 8.9])

    sampled = sample_bilinear(grid, query_x, query_y)
    expected = 100.0 + 2.0 * query_x + 3.0 * query_y + 0.5 * query_x * query_y

    assert np.allclose(sampled, expected, atol=1e-12)


def test_sample_bilinear_strict_nan_on_nodata():
    grid = np.ones((5, 5), dtype=np.float64) * 50.0
    # Introduce a NaN cell at (2, 2)
    grid[2, 2] = np.nan

    # Query point surrounded by (2, 2) -> (col=2.2, row=2.2)
    sample_near_nan = sample_bilinear(grid, [2.2], [2.2])
    assert np.isnan(sample_near_nan[0])

    # Query point far from NaN cell -> (col=0.5, row=0.5)
    sample_far = sample_bilinear(grid, [0.5], [0.5])
    assert math.isclose(sample_far[0], 50.0, abs_tol=1e-9)


def test_sample_bilinear_out_of_bounds_nan():
    grid = np.ones((10, 10), dtype=np.float64) * 20.0

    # Query out of bounds coordinates
    query_x = np.array([-1.5, 5.0, 15.0, 5.0])
    query_y = np.array([5.0, -2.0, 5.0, 12.0])

    sampled = sample_bilinear(grid, query_x, query_y)
    assert np.all(np.isnan(sampled))


def test_nested_terrain_hierarchy_selection():
    # Layer 1: fine (max_range 5 km, returns 1.0)
    # Layer 2: medium (max_range 30 km, returns 2.0)
    # Layer 3: coarse (max_range 100 km, returns 3.0)
    l1 = NestedTerrainLayer(dem=lambda la, lo: 1.0, max_range_m=5000.0, name="fine")
    l2 = NestedTerrainLayer(dem=lambda la, lo: 2.0, max_range_m=30000.0, name="medium")
    l3 = NestedTerrainLayer(dem=lambda la, lo: 3.0, max_range_m=100000.0, name="coarse")

    nested = NestedTerrain([l1, l2, l3])

    dists = np.array([1000.0, 4999.0, 5001.0, 29999.0, 30001.0, 95000.0, 105000.0])
    lats = np.full_like(dists, -89.9)
    lons = np.zeros_like(dists)

    sampled = nested.sample(dists, lats, lons)

    assert sampled[0] == 1.0
    assert sampled[1] == 1.0
    assert sampled[2] == 2.0
    assert sampled[3] == 2.0
    assert sampled[4] == 3.0
    assert sampled[5] == 3.0
    assert np.isnan(sampled[6])  # Out of range of all layers


def test_nested_terrain_seam_continuity():
    # Test seamless transition across resolution boundaries on a smooth synthetic slope
    def smooth_slope(la, lo):
        # Linear slope based on latitude offset from pole
        return (la - (-90.0)) * 1000.0

    l1 = NestedTerrainLayer(dem=smooth_slope, max_range_m=5000.0, name="fine")
    l2 = NestedTerrainLayer(dem=smooth_slope, max_range_m=30000.0, name="medium")

    nested = NestedTerrain([l1, l2])

    # Sample right across the seam at 5000 m
    dists = np.array([4990.0, 4995.0, 5000.0, 5005.0, 5010.0])
    lats = np.array([-89.90, -89.90, -89.90, -89.90, -89.90])
    lons = np.zeros_like(lats)

    sampled = nested.sample(dists, lats, lons)
    # All points have identical lat/lon, so smooth_slope should give identical elevation
    expected_elev = (-89.90 - (-90.0)) * 1000.0
    assert np.allclose(sampled, expected_elev, atol=1e-10)
