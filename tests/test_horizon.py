"""Unit tests for pipeline.horizon module."""

import json
import math
from pathlib import Path

import numpy as np
import pytest
from jsonschema import validate

from pipeline.constants import R_MOON_M
from pipeline.geometry import compute_elevation_angle_deg
from pipeline.horizon import (
    HorizonProfile,
    compute_horizon_from_dem_radial_rays,
    compute_synthetic_horizon_profile,
)

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


def test_horizon_profile_validation():
    # Invalid az_step
    with pytest.raises(ValueError):
        HorizonProfile(az_step_deg=0.0, heights_m=[0.0], el_deg=[[0.0]], nan_fraction=[[0.0]])
    with pytest.raises(ValueError):
        HorizonProfile(az_step_deg=1.0, heights_m=[], el_deg=[[]], nan_fraction=[[]])
    # Shape mismatch
    with pytest.raises(ValueError):
        HorizonProfile(az_step_deg=1.0, heights_m=[0.0, 2.0], el_deg=[[0.0] * 360], nan_fraction=[[0.0] * 360])


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
    # Set known values: at az=0: 1.0 deg; at az=10: 2.0 deg
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

    # Exact points
    assert math.isclose(prof.get_elevation_deg(0.0, 0.0), 1.0, abs_tol=1e-7)
    assert math.isclose(prof.get_elevation_deg(10.0, 0.0), 2.0, abs_tol=1e-7)
    # Midpoint in az
    assert math.isclose(prof.get_elevation_deg(5.0, 0.0), 1.5, abs_tol=1e-7)
    # Midpoint in height at az=0
    assert math.isclose(prof.get_elevation_deg(0.0, 5.0), 0.75, abs_tol=1e-7)
    # Bilinear center (az=5, h=5): (1.5 + 1.0) / 2 = 1.25
    assert math.isclose(prof.get_elevation_deg(5.0, 5.0), 1.25, abs_tol=1e-7)


def test_mast_height_sensitivity():
    # Increasing mast height should never increase the elevation angle of a fixed terrain feature
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
    # Define an artificial DEM with a single ridge at distance 10 km to the North (az = 0)
    ridge_dist_m = 10000.0
    ridge_elev_m = 500.0
    site_lat = -89.5
    site_lon = 0.0

    def mock_dem(lat_deg: float, lon_deg: float) -> float:
        # Check distance from site
        d = R_MOON_M * math.radians(abs(lat_deg - site_lat))
        # If near 10 km north
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

    # Check that at az=0 (North), the ridge is detected
    el_north = prof.get_elevation_deg(0.0, height_m=0.0)
    expected_el = compute_elevation_angle_deg(
        dist_m=ridge_dist_m,
        elev_m=ridge_elev_m,
        observer_height_m=0.0,
        site_ground_elev_m=0.0,
    )
    assert math.isclose(el_north, expected_el, abs_tol=0.05)
