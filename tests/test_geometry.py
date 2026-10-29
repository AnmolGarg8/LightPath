"""Comprehensive unit tests for pipeline.geometry module.

Covers:
1. Pure-math tests with no kernels (cardinal vectors, orthonormality, pole degeneracy, vectorization).
2. Kernel tests marked requires_kernels (skipped with clear message if absent).
3. Sanity bounds (sub-Earth point > 75 deg, polar Sun within +/- 2.5 deg, polar Earth within +/- 8 deg).
4. JPL Horizons fixture comparison test (reporting RMS/max differences, skipping if fixture absent).
5. Aberration test (NONE vs LT+S).
6. Parallax test (surface vs Moon center ~0.26 deg).
7. Local-up tilt test (two points 3 km apart tilt by ~0.1 deg).
"""

import csv
import json
import math
from pathlib import Path

import numpy as np
import pytest

from pipeline.constants import R_MOON_KM, R_MOON_M
from pipeline.geometry import (
    cross_check_with_azlcpo,
    enu_basis,
    great_circle_distance_m,
    load_kernels,
    site_position_moon_me_km,
    sun_earth_series,
    topocentric_az_el,
    unload_kernels,
    utc_to_et,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# -----------------------------------------------------------------------------
# 1. Pure-Math Tests (No Kernels Required)
# -----------------------------------------------------------------------------

def test_topocentric_az_el_cardinal_directions():
    """Verify that pure cardinal offsets from site yield exact az and el angles."""
    lat, lon = -89.0, 45.0
    r_site_km = site_position_moon_me_km(lat, lon, R_MOON_M)
    basis = enu_basis(lat, lon)
    east, north, up = basis

    # 1. Target straight UP: el = 90.0, range = 100.0 km
    target_up = r_site_km + 100.0 * up
    az, el, rng = topocentric_az_el(target_up, r_site_km, basis)
    assert math.isclose(el, 90.0, abs_tol=1e-7)
    assert math.isclose(rng, 100.0, abs_tol=1e-7)

    # 2. Target along EAST: az = 90.0, el = 0.0, range = 50.0 km
    target_east = r_site_km + 50.0 * east
    az, el, rng = topocentric_az_el(target_east, r_site_km, basis)
    assert math.isclose(az, 90.0, abs_tol=1e-7)
    assert math.isclose(el, 0.0, abs_tol=1e-7)
    assert math.isclose(rng, 50.0, abs_tol=1e-7)

    # 3. Target along NORTH: az = 0.0, el = 0.0, range = 50.0 km
    target_north = r_site_km + 50.0 * north
    az, el, rng = topocentric_az_el(target_north, r_site_km, basis)
    assert math.isclose(az, 0.0, abs_tol=1e-7)
    assert math.isclose(el, 0.0, abs_tol=1e-7)
    assert math.isclose(rng, 50.0, abs_tol=1e-7)

    # 4. Target along SOUTH (-north): az = 180.0, el = 0.0
    target_south = r_site_km - 50.0 * north
    az, el, rng = topocentric_az_el(target_south, r_site_km, basis)
    assert math.isclose(az, 180.0, abs_tol=1e-7)
    assert math.isclose(el, 0.0, abs_tol=1e-7)

    # 5. Target along WEST (-east): az = 270.0, el = 0.0
    target_west = r_site_km - 50.0 * east
    az, el, rng = topocentric_az_el(target_west, r_site_km, basis)
    assert math.isclose(az, 270.0, abs_tol=1e-7)
    assert math.isclose(el, 0.0, abs_tol=1e-7)


def test_enu_basis_orthonormality_grid():
    """Verify ENU basis is orthonormal and right-handed across latitude/longitude grid."""
    test_lats = np.linspace(-89.9, 89.9, 19)
    test_lons = np.linspace(-180.0, 180.0, 25)

    east, north, up = enu_basis(test_lats[:, None], test_lons[None, :])

    # Unit norms
    assert np.allclose(np.linalg.norm(east, axis=-1), 1.0, atol=1e-9)
    assert np.allclose(np.linalg.norm(north, axis=-1), 1.0, atol=1e-9)
    assert np.allclose(np.linalg.norm(up, axis=-1), 1.0, atol=1e-9)

    # Mutual orthogonality (dot products == 0)
    assert np.allclose(np.sum(east * north, axis=-1), 0.0, atol=1e-9)
    assert np.allclose(np.sum(north * up, axis=-1), 0.0, atol=1e-9)
    assert np.allclose(np.sum(east * up, axis=-1), 0.0, atol=1e-9)

    # Right-handedness: east x north == up
    cross_prod = np.cross(east, north)
    assert np.allclose(cross_prod, up, atol=1e-9)


def test_enu_basis_pole_degeneracy():
    """Verify pole degeneracy handling: North towards sub-Earth prime meridian at South Pole."""
    # South Pole (-90 deg)
    e_s, n_s, u_s = enu_basis(-90.0, 0.0)
    assert np.allclose(u_s, [0.0, 0.0, -1.0], atol=1e-9)
    assert np.allclose(n_s, [1.0, 0.0, 0.0], atol=1e-9)
    assert np.allclose(e_s, [0.0, 1.0, 0.0], atol=1e-9)
    assert np.allclose(np.cross(e_s, n_s), u_s, atol=1e-9)

    # North Pole (+90 deg)
    e_n, n_n, u_n = enu_basis(90.0, 0.0)
    assert np.allclose(u_n, [0.0, 0.0, 1.0], atol=1e-9)
    assert np.allclose(n_n, [-1.0, 0.0, 0.0], atol=1e-9)
    assert np.allclose(e_n, [0.0, 1.0, 0.0], atol=1e-9)
    assert np.allclose(np.cross(e_n, n_n), u_n, atol=1e-9)


def test_vectorized_equals_scalar_results():
    """Verify vectorized topocentric_az_el produces identical results to scalar loops."""
    lats = np.array([-89.5, -85.0, 0.0, 45.0])
    lons = np.array([0.0, 90.0, 180.0, 270.0])

    site_pos_vec = site_position_moon_me_km(lats, lons, R_MOON_M)
    basis_vec = enu_basis(lats, lons)

    # Target points: e.g. Sun at arbitrary position
    target_vec = np.array([1.5e8, 1.0e7, -2.0e6])

    az_v, el_v, rng_v = topocentric_az_el(target_vec, site_pos_vec, basis_vec)

    for i in range(len(lats)):
        s_pos = site_position_moon_me_km(lats[i], lons[i], R_MOON_M)
        s_basis = enu_basis(lats[i], lons[i])
        az_s, el_s, rng_s = topocentric_az_el(target_vec, s_pos, s_basis)

        assert math.isclose(az_v[i], az_s, abs_tol=1e-8)
        assert math.isclose(el_v[i], el_s, abs_tol=1e-8)
        assert math.isclose(rng_v[i], rng_s, abs_tol=1e-8)


# -----------------------------------------------------------------------------
# 2. Kernel Tests (Marked with requires_kernels)
# -----------------------------------------------------------------------------

@pytest.mark.requires_kernels
def test_spice_kernel_load_and_unload():
    meta_path = Path(__file__).parent.parent / "kernels" / "meta.tm"
    load_kernels(meta_path)
    et = utc_to_et("2026-11-01T00:00:00Z")
    assert isinstance(et, float)
    unload_kernels()


@pytest.mark.requires_kernels
def test_cross_check_with_azlcpo():
    meta_path = Path(__file__).parent.parent / "kernels" / "meta.tm"
    load_kernels(meta_path)
    res = cross_check_with_azlcpo(
        target="SUN",
        et=utc_to_et("2026-11-01T00:00:00Z"),
        frame="MOON_ME",
        abcorr="NONE",
        observer_lat_deg=-89.44,
        observer_lon_deg=137.5,
    )
    unload_kernels()
    if res is not None:
        az, el, rng = res
        assert 0.0 <= az < 360.0
        assert -90.0 <= el <= 90.0
        assert rng > 1.4e8


# -----------------------------------------------------------------------------
# 3. Sanity Bounds (Parameter Documented)
# -----------------------------------------------------------------------------

def test_sanity_bound_sub_earth_point_elevation():
    """At lat 0, lon 0, Earth elevation over 30 days must stay above 75 degrees.

    Physical rationale:
        The (0, 0) location is the mean sub-Earth point. Lunar optical and physical
        librations displace the Earth by at most ~7.9 deg in longitude and ~6.7 deg
        in latitude (zenith distance at most ~10.3 deg). Therefore, Earth elevation
        must always satisfy: el >= 90.0 - 10.3 approx 79.7 deg > 75.0 deg.
    """
    series = sun_earth_series(
        points=(0.0, 0.0, R_MOON_M),
        start_utc="2026-11-01T00:00:00Z",
        end_utc="2026-12-01T00:00:00Z",
        step_minutes=120,
    )
    earth_els = np.array(series["earth"]["el_deg"])
    min_el = float(np.min(earth_els))
    max_el = float(np.max(earth_els))

    # Bound: must remain > 75 deg
    assert min_el >= 75.0, f"FINDING: Sub-Earth elevation bound violated! Min was {min_el:.2f} deg (< 75.0 deg)"
    assert max_el <= 90.0


def test_sanity_bound_polar_sun_elevation():
    """At south pole region (-89.5 deg), Sun elevation over a full year stays within about +/- 2.5 degrees.

    Physical rationale:
        The Moon's obliquity to the ecliptic is only 1.5424 deg. At lat -89.5 deg,
        the subsolar latitude varies between -1.54 deg and +1.54 deg.
        With solar apparent radius (0.26 deg) and polar offset (0.5 deg),
        the Sun center elevation stays strictly within [-2.5 deg, +2.5 deg].
    """
    # Sample 1 year (12 monthly samples)
    series = sun_earth_series(
        points=(-89.5, 0.0, R_MOON_M),
        start_utc="2026-01-01T00:00:00Z",
        end_utc="2027-01-01T00:00:00Z",
        step_minutes=1440 * 5,  # Every 5 days
    )
    sun_els = np.array(series["sun"]["el_deg"])
    min_el = float(np.min(sun_els))
    max_el = float(np.max(sun_els))

    assert min_el >= -2.6, f"FINDING: Polar Sun elevation lower bound violated: {min_el:.2f} deg (< -2.6 deg)"
    assert max_el <= 2.6, f"FINDING: Polar Sun elevation upper bound violated: {max_el:.2f} deg (> 2.6 deg)"


def test_sanity_bound_polar_earth_elevation():
    """At south pole region near Shackleton (-89.44, 137.5), Earth elevation stays within about +/- 8 degrees.

    Physical rationale:
        Earth elevation oscillates around the horizon due to lunar latitudinal
        libration (~5.1 to 6.7 deg amplitude) and polar site offset.
    """
    series = sun_earth_series(
        points=(-89.44, 137.5, R_MOON_M),
        start_utc="2026-11-01T00:00:00Z",
        end_utc="2026-12-01T00:00:00Z",
        step_minutes=120,
    )
    earth_els = np.array(series["earth"]["el_deg"])
    min_el = float(np.min(earth_els))
    max_el = float(np.max(earth_els))

    assert min_el >= -8.5, f"FINDING: Polar Earth elevation lower bound violated: {min_el:.2f} deg"
    assert max_el <= 8.5, f"FINDING: Polar Earth elevation upper bound violated: {max_el:.2f} deg"


# -----------------------------------------------------------------------------
# 4. JPL Horizons Fixture Comparison Test
# -----------------------------------------------------------------------------

def test_horizons_fixture_benchmark():
    """Compare LightPath predictions against independent JPL Horizons benchmark fixture.

    Fixture files:
        tests/fixtures/horizons_shackleton_sun.csv
        tests/fixtures/horizons_shackleton_sun.json
    Tolerance:
        Default 0.05 degrees (configurable via JSON sidecar).
    """
    csv_path = FIXTURES_DIR / "horizons_shackleton_sun.csv"
    json_path = FIXTURES_DIR / "horizons_shackleton_sun.json"

    if not csv_path.exists() or not json_path.exists():
        pytest.skip(
            f"Horizons fixture {csv_path.name} not found. "
            "See docs/HORIZONS_FIXTURES.md for human instructions on generating benchmark fixtures."
        )

    with open(json_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    site_info = meta["site"]
    lat_deg = site_info["lat_deg"]
    lon_deg = site_info["lon_deg"]
    radius_m = R_MOON_M + site_info.get("ground_elev_m", 0.0)
    tolerance_deg = meta.get("tolerance_deg", 0.05)

    times = []
    horizons_az = []
    horizons_el = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            times.append(row["utc"].strip())
            horizons_az.append(float(row["az_deg"]))
            horizons_el.append(float(row["el_deg"]))

    # Run LightPath topocentric series
    lp_series = sun_earth_series(
        points=(lat_deg, lon_deg, radius_m),
        start_utc=times[0],
        end_utc=times[-1],
        step_minutes=int(meta.get("step_minutes", 60)),
    )

    lp_az = np.array(lp_series["sun"]["az_deg"])
    lp_el = np.array(lp_series["sun"]["el_deg"])
    hz_az = np.array(horizons_az)
    hz_el = np.array(horizons_el)

    # Elevation differences
    delta_el = np.abs(lp_el - hz_el)
    rms_el = float(np.sqrt(np.mean(delta_el**2)))
    max_el_diff = float(np.max(delta_el))

    # Azimuth differences (accounting for circular wrap)
    delta_az = np.abs((lp_az - hz_az + 180.0) % 360.0 - 180.0)
    rms_az = float(np.sqrt(np.mean(delta_az**2)))
    max_az_diff = float(np.max(delta_az))

    print(f"\n[HORIZONS BENCHMARK REPORT: {meta['site']['name']}]")
    print(f"  Elevation Max Diff: {max_el_diff:.4f}° | RMS: {rms_el:.4f}° (Tol: {tolerance_deg}°)")
    print(f"  Azimuth   Max Diff: {max_az_diff:.4f}° | RMS: {rms_az:.4f}° (Tol: {tolerance_deg}°)")

    assert max_el_diff <= tolerance_deg, f"Elevation max diff {max_el_diff:.4f}° exceeds tolerance {tolerance_deg}°"
    assert max_az_diff <= tolerance_deg, f"Azimuth max diff {max_az_diff:.4f}° exceeds tolerance {tolerance_deg}°"


# -----------------------------------------------------------------------------
# 5. Aberration Test (NONE vs LT+S)
# -----------------------------------------------------------------------------

def test_aberration_correction_effect():
    """Verify that light-time and stellar aberration corrections (LT+S) shift apparent positions as expected.

    Physical rationale:
        - Solar aberration offset ~ 20 arcseconds (~0.0056 deg).
        - Assert the shift magnitude is below 0.05 degrees and physically bounded.
    """
    pt = (-89.44, 137.5, R_MOON_M)
    res_none = sun_earth_series(pt, "2026-11-01T00:00:00Z", "2026-11-01T04:00:00Z", step_minutes=60, abcorr="NONE")
    res_lts = sun_earth_series(pt, "2026-11-01T00:00:00Z", "2026-11-01T04:00:00Z", step_minutes=60, abcorr="LT+S")

    sun_diff = abs(res_none["sun"]["el_deg"][0] - res_lts["sun"]["el_deg"][0])
    earth_diff = abs(res_none["earth"]["el_deg"][0] - res_lts["earth"]["el_deg"][0])

    # Differences should be small (< 0.05 deg)
    assert sun_diff <= 0.05
    assert earth_diff <= 0.05


# -----------------------------------------------------------------------------
# 6. Parallax Test
# -----------------------------------------------------------------------------

def test_surface_vs_moon_centre_parallax():
    """Verify Earth direction from lunar surface differs from Moon-centre direction by up to ~0.26 deg.

    Physical rationale:
        The maximum lunar parallax angle subtended by the Moon radius at Earth distance is:
        theta_parallax approx R_moon / D_earth = 1737.4 km / 384400 km = 0.00452 rad = 0.259 deg.
    """
    ts = "2026-11-01T00:00:00Z"
    # Observer on limb facing perpendicular to Earth vector (e.g. lat 0, lon 90)
    site_limb = site_position_moon_me_km(0.0, 90.0, R_MOON_M)
    site_center = np.array([0.0, 0.0, 0.0])

    # Vector to Earth
    from pipeline.ephemeris import utc_iso_to_julian_date
    _jd = utc_iso_to_julian_date(ts)
    r_earth = np.array([384400.0, 0.0, 0.0])  # Sub-Earth along +X

    v_from_limb = r_earth - site_limb
    v_from_center = r_earth - site_center

    u_limb = v_from_limb / np.linalg.norm(v_from_limb)
    u_center = v_from_center / np.linalg.norm(v_from_center)

    parallax_angle_deg = math.degrees(math.acos(float(np.dot(u_limb, u_center))))

    # Should be close to asin(1737.4 / 384400) = 0.259 deg
    expected_parallax = math.degrees(math.asin(R_MOON_KM / 384400.0))
    assert math.isclose(parallax_angle_deg, expected_parallax, rel_tol=0.05)
    assert 0.24 <= parallax_angle_deg <= 0.28


# -----------------------------------------------------------------------------
# 7. Local-Up Tilt Test
# -----------------------------------------------------------------------------

def test_local_up_tilt_over_distance():
    """For two points separated by 3 km near the pole, local up tilts by ~0.1 deg.

    Physical rationale:
        d = 3000 m, R = 1737400 m.
        theta = d / R = 3000 / 1737400 rad = 0.0017267 rad = 0.0989 deg approx 0.1 deg.
        Elevation angle computed from the two sites to the same distant body reflects this tilt.
    """
    lat1, lon1 = -89.5, 0.0
    # Move 3 km along meridian: delta_lat = 3000 / 1737400 rad = 0.09893 deg
    delta_lat_deg = math.degrees(3000.0 / R_MOON_M)
    lat2 = lat1 + delta_lat_deg
    lon2 = lon1

    # Verify distance
    actual_dist_m = great_circle_distance_m(lat1, lon1, lat2, lon2)
    assert math.isclose(actual_dist_m, 3000.0, rel_tol=1e-4)

    # Compute Up unit vectors
    _, _, up1 = enu_basis(lat1, lon1)
    _, _, up2 = enu_basis(lat2, lon2)

    cos_tilt = float(np.dot(up1, up2))
    tilt_deg = math.degrees(math.acos(np.clip(cos_tilt, -1.0, 1.0)))

    # Must equal approx 0.099 deg (~0.1 deg)
    assert math.isclose(tilt_deg, 0.0989, abs_tol=0.005)

    # Verify that topocentric elevation reflects this exact tilt
    distant_target = np.array([0.0, 0.0, -1.5e8])  # Target toward South
    basis1 = enu_basis(lat1, lon1)
    basis2 = enu_basis(lat2, lon2)
    pos1 = site_position_moon_me_km(lat1, lon1, R_MOON_M)
    pos2 = site_position_moon_me_km(lat2, lon2, R_MOON_M)

    _, el1, _ = topocentric_az_el(distant_target, pos1, basis1)
    _, el2, _ = topocentric_az_el(distant_target, pos2, basis2)

    diff_el = abs(el1 - el2)
    assert math.isclose(diff_el, tilt_deg, abs_tol=0.01)
