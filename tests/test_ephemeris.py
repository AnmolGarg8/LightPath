"""Unit tests for pipeline.ephemeris module."""

import math

from pipeline.ephemeris import (
    check_dsn_ground_station_visibility,
    compute_topocentric_earth_state,
    compute_topocentric_sun_state,
    utc_iso_to_julian_date,
)


def test_julian_date_j2000():
    # 2000-01-01T12:00:00Z is exactly JD 2451545.0
    jd = utc_iso_to_julian_date("2000-01-01T12:00:00Z")
    assert math.isclose(jd, 2451545.0, abs_tol=1e-6)

    # 2026-11-01T00:00:00Z
    jd_2026 = utc_iso_to_julian_date("2026-11-01T00:00:00Z")
    assert jd_2026 > 2461000.0


def test_topocentric_sun_state_south_pole():
    # At lunar south pole (e.g. lat -89.5 deg)
    state = compute_topocentric_sun_state(
        iso_utc_str="2026-11-01T00:00:00Z",
        site_lat_deg=-89.5,
        site_lon_deg=0.0,
        site_elev_m=1000.0,
        observer_height_m=2.0,
    )

    # Solar radius should be ~0.267 deg (apparent diameter ~0.53 deg)
    assert 0.25 <= state.radius_deg <= 0.28

    # Sun-Moon distance should be ~1 AU (1.47e8 to 1.52e8 km)
    assert 1.45e8 <= state.dist_km <= 1.53e8

    # Near south pole, elevation stays low to horizon (-2 deg to +2 deg)
    assert -2.5 <= state.el_deg <= 2.5

    # Azimuth in [0, 360)
    assert 0.0 <= state.az_deg < 360.0


def test_topocentric_earth_state():
    state = compute_topocentric_earth_state(
        iso_utc_str="2026-11-01T00:00:00Z",
        site_lat_deg=-89.5,
        site_lon_deg=137.5,
        site_elev_m=1200.0,
        observer_height_m=2.0,
    )

    # Earth distance between 356,000 km and 407,000 km
    assert 350000.0 <= state.dist_km <= 410000.0

    # Earth angular radius ~0.95 deg (apparent diameter ~1.9 deg)
    assert 0.85 <= state.radius_deg <= 1.05

    # Azimuth in [0, 360)
    assert 0.0 <= state.az_deg < 360.0


def test_topocentric_shift_difference():
    # Rule 6 check: Topocentric direction differs between two separated sites
    # Site A and Site B separated by 2 degrees of latitude (~60 km)
    state_a = compute_topocentric_sun_state("2026-11-01T00:00:00Z", -88.0, 0.0)
    state_b = compute_topocentric_sun_state("2026-11-01T00:00:00Z", -90.0, 0.0)

    # Difference in elevation reflects the 2 degree tilt in local up projected along Sun direction
    assert abs(state_a.el_deg - state_b.el_deg) > 1.2


def test_topocentric_earth_direction_differs_from_moon_centre():
    """Verify Rule 6: Earth direction is topocentric (from surface site), never Moon centre.

    At South Pole (lat = -90.0 deg), observer is offset from Moon center by R_moon (~1737.4 km)
    along the local vertical (Moon -Z axis). For Earth distance ~384,400 km, this introduces
    a topocentric parallax shift of ~1737.4 / 384400 rad ~ 0.259 deg in elevation.
    Using Moon center instead of site produces an unacceptable ~0.26 deg error.
    """
    from pipeline.constants import R_MOON_M
    from pipeline.ephemeris import (
        compute_moon_center_to_earth_moon_me_km,
        utc_iso_to_julian_date,
    )
    from pipeline.geometry import vector_to_az_el_deg

    ts = "2026-11-01T00:00:00Z"
    lat_deg, lon_deg = -90.0, 0.0
    state_topo = compute_topocentric_earth_state(ts, lat_deg, lon_deg, site_elev_m=0.0, observer_height_m=0.0)

    # Selenocentric vector from Moon center
    jd = utc_iso_to_julian_date(ts)
    r_center = compute_moon_center_to_earth_moon_me_km(jd)
    az_center, el_center = vector_to_az_el_deg(r_center, lat_deg, lon_deg)

    # Parallax difference in elevation
    el_diff = abs(state_topo.el_deg - el_center)
    expected_parallax_deg = math.degrees((R_MOON_M / 1000.0) / float(state_topo.dist_km))
    assert math.isclose(el_diff, expected_parallax_deg, abs_tol=0.02), (
        f"Topocentric Earth elevation shift {el_diff:.4f} deg differs from expected parallax {expected_parallax_deg:.4f} deg"
    )
    assert el_diff > 0.20, "Topocentric elevation must differ significantly (> 0.20 deg) from Moon center"


def test_dsn_ground_station_visibility():
    station_names, vis = check_dsn_ground_station_visibility("2026-11-01T00:00:00Z", station_mask_el_deg=10.0)
    assert len(station_names) == 3
    assert len(vis) == 3

    # Over 24 hours in 2-hour increments, test DSN handovers
    # Because stations are ~120 deg apart on Earth, at least one station should see the Moon
    # most of the time
    any_visible_count = 0
    for hour in range(0, 24, 2):
        ts = f"2026-11-01T{hour:02d}:00:00Z"
        _, v = check_dsn_ground_station_visibility(ts, station_mask_el_deg=10.0)
        if any(v):
            any_visible_count += 1

    # Over 24 hours, DSN should provide high coverage
    assert any_visible_count >= 10
