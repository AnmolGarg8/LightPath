"""Unit tests for pipeline.dsn module."""

import math

import numpy as np

from pipeline.constants import DEFAULT_DSN_MIN_ELEVATION_DEG
from pipeline.dsn import (
    dte_available,
    load_dsn_stations,
    moon_elevation_at_station,
)


def test_load_dsn_stations():
    stations, default_min_el = load_dsn_stations()
    assert len(stations) >= 3
    assert default_min_el == DEFAULT_DSN_MIN_ELEVATION_DEG

    for st in stations:
        assert "id" in st
        assert "name" in st
        assert "lat_deg" in st
        assert "lon_deg" in st
        assert st.get("verified") is False  # Confirms Rule 2 placeholder status


def test_synthetic_stations_sub_moon_vs_antipodal():
    """Synthetic station geometry test:

    A station on Earth directly facing the Moon sees it near zenith (el ~ 90 deg).
    An antipodal station on the opposite side of Earth sees it below horizon (el < -70 deg).
    """
    ts = ["2026-11-01T00:00:00Z"]

    # Calculate sub-Moon geographic coordinate at this timestamp
    from pipeline.ephemeris import greenwich_mean_sidereal_time_deg, utc_iso_to_julian_date
    jd = utc_iso_to_julian_date(ts[0])
    gmst = greenwich_mean_sidereal_time_deg(jd)
    t = (jd - 2451545.0) / 36525.0
    l_moon = math.radians((218.316 + 481267.8813 * t) % 360.0)
    eps_rad = math.radians(23.439 - 0.0130 * t)

    # Moon direction
    moon_x = math.cos(l_moon)
    moon_y = math.sin(l_moon) * math.cos(eps_rad)
    moon_z = math.sin(l_moon) * math.sin(eps_rad)

    sub_moon_lat_deg = math.degrees(math.asin(moon_z))
    sub_moon_ra_deg = math.degrees(math.atan2(moon_y, moon_x)) % 360.0
    sub_moon_lon_deg = (sub_moon_ra_deg - gmst + 180.0) % 360.0 - 180.0

    # 1. Station at sub-Moon point
    sub_station = {
        "id": "sub_moon_st",
        "name": "Sub-Moon Ground Station",
        "lat_deg": sub_moon_lat_deg,
        "lon_deg": sub_moon_lon_deg,
        "height_m": 0.0,
    }

    el_sub = moon_elevation_at_station(sub_station, ts)[0]
    # Should see the Moon near zenith (> 70 deg)
    assert el_sub > 70.0

    # 2. Antipodal station on the far side (opposite hemisphere)
    anti_lon_deg = sub_moon_lon_deg + 180.0 if sub_moon_lon_deg <= 0.0 else sub_moon_lon_deg - 180.0
    anti_station = {
        "id": "antipodal_st",
        "name": "Far Side Ground Station",
        "lat_deg": -sub_moon_lat_deg,
        "lon_deg": anti_lon_deg,
        "height_m": 0.0,
    }

    el_anti = moon_elevation_at_station(anti_station, ts)[0]
    # Far side cannot see the Moon (elevation deeply negative)
    assert el_anti < -70.0


def test_moon_elevation_limb_offset():
    """Verify that limb=True lowers the apparent elevation by the lunar angular radius."""
    station = {"id": "test_st", "name": "Test Station", "lat_deg": 35.0, "lon_deg": -116.0}
    ts = ["2026-11-01T00:00:00Z"]

    el_center = moon_elevation_at_station(station, ts, limb=False)[0]
    el_limb = moon_elevation_at_station(station, ts, limb=True)[0]

    # Limb elevation is lower than center elevation by lunar angular radius (~0.25 to 0.28 deg)
    diff = el_center - el_limb
    assert 0.24 <= diff <= 0.28


def test_dte_available_joint_logic():
    """Verify dte_available satisfies logical AND of site visibility and ground station visibility."""
    times = [f"2026-11-01T{h:02d}:00:00Z" for h in range(4)]
    stations, min_el = load_dsn_stations()

    # Case A: Site sees Earth (frac = 1.0)
    site_series_visible = {
        "time_utc": times,
        "earth": {"frac": [1.0, 1.0, 1.0, 1.0]},
    }
    dte_ok_a, per_st_a = dte_available(site_series_visible, stations, min_station_el_deg=min_el)
    # At least one station in the global DSN network will typically see the Moon
    assert any(dte_ok_a)
    assert len(per_st_a) == len(stations)

    # Case B: Site Earth is blocked by local terrain (frac = 0.0)
    site_series_blocked = {
        "time_utc": times,
        "earth": {"frac": [0.0, 0.0, 0.0, 0.0]},
    }
    dte_ok_b, per_st_b = dte_available(site_series_blocked, stations, min_station_el_deg=min_el)
    # Even if Earth stations see the Moon, if site cannot see Earth, DTE must be False
    assert not np.any(dte_ok_b)
