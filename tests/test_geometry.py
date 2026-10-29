"""Unit tests for pipeline.geometry module."""

import math

import numpy as np
import pytest

from pipeline.constants import R_MOON_M
from pipeline.geometry import (
    compute_elevation_angle_deg,
    compute_slope_horn_deg,
    great_circle_distance_m,
    topocentric_basis_moon_me,
    vector_to_az_el_deg,
)


def test_elevation_angle_exact_curvature():
    # Observer on surface, target on surface at 17374 m (theta = 0.01 rad)
    d = 17374.0
    el_deg = compute_elevation_angle_deg(dist_m=d, elev_m=0.0, observer_height_m=0.0, site_ground_elev_m=0.0)
    theta = d / R_MOON_M
    expected_rad = math.atan2(math.cos(theta) - 1.0, math.sin(theta))
    expected_deg = math.degrees(expected_rad)

    assert math.isclose(el_deg, expected_deg, abs_tol=1e-9)
    # Check it is negative (horizon drops due to curvature)
    assert el_deg < 0.0
    # Small angle approx: -theta / 2
    approx_deg = math.degrees(-theta / 2.0)
    assert math.isclose(el_deg, approx_deg, rel_tol=1e-4)


def test_elevation_angle_observer_height():
    # Elevating the observer lowers the apparent elevation of the ground at distance d
    el_0 = compute_elevation_angle_deg(dist_m=10000.0, elev_m=0.0, observer_height_m=0.0)
    el_mast = compute_elevation_angle_deg(dist_m=10000.0, elev_m=0.0, observer_height_m=5.0)
    assert el_mast < el_0


def test_elevation_angle_vectorized():
    distances = np.array([1000.0, 5000.0, 10000.0])
    elevs = np.array([0.0, 100.0, -50.0])
    results = compute_elevation_angle_deg(distances, elevs, observer_height_m=2.0)
    assert results.shape == (3,)
    for i in range(3):
        scalar = compute_elevation_angle_deg(distances[i], elevs[i], observer_height_m=2.0)
        assert math.isclose(results[i], scalar, abs_tol=1e-9)


def test_topocentric_basis_orthonormality():
    for lat in [-89.5, -45.0, 0.0, 45.0, 89.5]:
        for lon in [0.0, 90.0, 180.0, 270.0]:
            east, north, up = topocentric_basis_moon_me(lat, lon)
            # Unit norm
            assert math.isclose(np.linalg.norm(east), 1.0, abs_tol=1e-9)
            assert math.isclose(np.linalg.norm(north), 1.0, abs_tol=1e-9)
            assert math.isclose(np.linalg.norm(up), 1.0, abs_tol=1e-9)
            # Orthogonal
            assert math.isclose(float(np.dot(east, north)), 0.0, abs_tol=1e-9)
            assert math.isclose(float(np.dot(north, up)), 0.0, abs_tol=1e-9)
            assert math.isclose(float(np.dot(east, up)), 0.0, abs_tol=1e-9)
            # Right-handed: east x north = up
            cross_en = np.cross(east, north)
            assert np.allclose(cross_en, up, atol=1e-9)


def test_vector_to_az_el_cardinal():
    lat, lon = -89.0, 45.0
    east, north, up = topocentric_basis_moon_me(lat, lon)

    # Pointing directly Up
    az, el = vector_to_az_el_deg(up * 100.0, lat, lon)
    assert math.isclose(el, 90.0, abs_tol=1e-6)

    # Pointing North
    az, el = vector_to_az_el_deg(north * 50.0, lat, lon)
    assert math.isclose(az, 0.0, abs_tol=1e-6)
    assert math.isclose(el, 0.0, abs_tol=1e-6)

    # Pointing East
    az, el = vector_to_az_el_deg(east * 50.0, lat, lon)
    assert math.isclose(az, 90.0, abs_tol=1e-6)
    assert math.isclose(el, 0.0, abs_tol=1e-6)

    # Pointing South (-North)
    az, el = vector_to_az_el_deg(-north * 50.0, lat, lon)
    assert math.isclose(az, 180.0, abs_tol=1e-6)
    assert math.isclose(el, 0.0, abs_tol=1e-6)

    # Pointing West (-East)
    az, el = vector_to_az_el_deg(-east * 50.0, lat, lon)
    assert math.isclose(az, 270.0, abs_tol=1e-6)
    assert math.isclose(el, 0.0, abs_tol=1e-6)


def test_great_circle_distance():
    # Pole to equator
    dist = great_circle_distance_m(-90.0, 0.0, 0.0, 0.0)
    expected = R_MOON_M * (math.pi / 2.0)
    assert math.isclose(dist, expected, rel_tol=1e-6)

    # Same point
    assert math.isclose(great_circle_distance_m(-89.0, 10.0, -89.0, 10.0), 0.0, abs_tol=1e-9)


def test_horn_slope():
    # Flat terrain
    flat = np.zeros((3, 3), dtype=np.float64)
    assert math.isclose(compute_slope_horn_deg(flat, 20.0), 0.0, abs_tol=1e-9)

    # Plane tilted at exactly 15 degrees in X
    target_slope_deg = 15.0
    spacing = 40.0
    tan_slope = math.tan(math.radians(target_slope_deg))
    # z = x * tan(slope)
    # x indices: col 0 is -1, col 1 is 0, col 2 is +1
    plane_x = np.array([
        [-spacing * tan_slope, 0.0, spacing * tan_slope],
        [-spacing * tan_slope, 0.0, spacing * tan_slope],
        [-spacing * tan_slope, 0.0, spacing * tan_slope],
    ])
    computed_slope = compute_slope_horn_deg(plane_x, spacing)
    assert math.isclose(computed_slope, target_slope_deg, abs_tol=1e-6)

    # Plane tilted at 20 degrees in Y
    tan_20 = math.tan(math.radians(20.0))
    plane_y = np.array([
        [-spacing * tan_20, -spacing * tan_20, -spacing * tan_20],
        [0.0, 0.0, 0.0],
        [spacing * tan_20, spacing * tan_20, spacing * tan_20],
    ])
    computed_slope_y = compute_slope_horn_deg(plane_y, spacing)
    assert math.isclose(computed_slope_y, 20.0, abs_tol=1e-6)


def test_horn_slope_validation():
    with pytest.raises(ValueError):
        compute_slope_horn_deg(np.zeros((2, 2)), 20.0)
    with pytest.raises(ValueError):
        compute_slope_horn_deg(np.zeros((3, 3)), -10.0)
