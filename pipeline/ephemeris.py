"""Ephemeris calculations for Sun, Earth, and DSN ground station visibility in MOON_ME.

Rules:
- Coordinate frame: MOON_ME (Moon Mean Earth / Polar Axis frame).
- Units in names: lat_deg, lon_deg, el_deg, az_deg, radius_deg, dist_km.
- Topocentric directions (from the site or cell, using that point's local up), never Moon centre.
- No machine learning; deterministic and reproducible.
- Ground station positions: DSN Goldstone, Madrid, Canberra (unverified masks in docs/QUESTIONS.md).
"""

import math
from datetime import datetime, timezone
from typing import List, NamedTuple, Tuple

import numpy as np

from pipeline.constants import (
    AU_KM,
    DEFAULT_EARTH_GROUND_STATION_MASK_DEG,
    MOON_EARTH_MEAN_DIST_KM,
    R_EARTH_KM,
    R_SUN_KM,
)
from pipeline.geometry import latlon_to_cartesian_moon_me_m, vector_to_az_el_deg

# Canonical DSN station coordinates (JPL 810-005)
# Verified station locations on Earth (WGS84 lat_deg, lon_deg)
DSN_STATIONS = [
    {"id": "goldstone", "name": "Goldstone (DSS 14/25)", "lat_deg": 35.247, "lon_deg": -116.889},
    {"id": "madrid", "name": "Madrid (DSS 63/65)", "lat_deg": 40.427, "lon_deg": -4.250},
    {"id": "canberra", "name": "Canberra (DSS 43/34)", "lat_deg": -35.401, "lon_deg": 148.981},
]


class CelestialBodyState(NamedTuple):
    az_deg: float
    el_deg: float
    radius_deg: float
    dist_km: float
    vec_moon_me_km: np.ndarray


def utc_iso_to_julian_date(iso_utc_str: str) -> float:
    """Convert an ISO 8601 UTC date string to Julian Date (JD).

    Args:
        iso_utc_str: Date string, e.g. '2026-11-01T00:00:00Z'.

    Returns:
        Julian Date (days since Jan 1, 4713 BC 12:00 UTC).
    """
    clean_str = iso_utc_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(clean_str).astimezone(timezone.utc)

    year = dt.year
    month = dt.month
    day = dt.day + (dt.hour + (dt.minute + (dt.second + dt.microsecond / 1e6) / 60.0) / 60.0) / 24.0

    if month <= 2:
        year -= 1
        month += 12

    a = math.floor(year / 100)
    b = 2 - a + math.floor(a / 4)
    jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5
    return jd


def greenwich_mean_sidereal_time_deg(jd: float) -> float:
    """Compute Greenwich Mean Sidereal Time (GMST) in degrees for Earth orientation.

    Reference:
        IAU 1982 / 2000 GMST formula.

    Args:
        jd: Julian Date.

    Returns:
        GMST in degrees [0, 360).
    """
    t = (jd - 2451545.0) / 36525.0
    # GMST in seconds of time at 0h UT1
    gmst_sec = 24110.54841 + 8640184.812866 * t + 0.093104 * t**2 - 6.2e-6 * t**3
    # Fractional day part
    day_fraction = (jd + 0.5) % 1.0
    gmst_sec += day_fraction * 86400.0 * 1.002737909350795
    gmst_deg = (gmst_sec / 240.0) % 360.0
    return gmst_deg


def compute_moon_center_to_earth_moon_me_km(jd: float) -> np.ndarray:
    """Compute position vector of Earth center from Moon center in MOON_ME frame (km).

    Incorporates dominant lunar librations in longitude and latitude:
    - In MOON_ME, the +X axis points along the mean Earth direction (lon 0, lat 0).
    - Longitudinal libration amplitude ~ 7.9 deg, anomalistic period 27.55455 days.
    - Latitudinal libration amplitude ~ 6.7 deg, draconic period 27.21222 days.
    - Distance variation due to orbital eccentricity e ~ 0.0549.

    Args:
        jd: Julian Date.

    Returns:
        np.ndarray: [x, y, z] vector in km in MOON_ME.
    """
    t = (jd - 2451545.0) / 36525.0  # Julian centuries since J2000.0

    # Mean anomaly of the Moon (deg)
    m_moon = (134.96340251 + 477198.8675055 * t) % 360.0
    # Mean argument of latitude (deg)
    f_moon = (93.2720950 + 483202.0175233 * t) % 360.0
    # Mean elongation of the Moon from the Sun (deg)
    d_elong = (297.8501921 + 445267.1114034 * t) % 360.0

    m_rad = math.radians(m_moon)
    f_rad = math.radians(f_moon)
    d_rad = math.radians(d_elong)

    # Libration in longitude (optical + physical dominant terms)
    # Observer on Moon sees Earth oscillate in lunar sky
    lon_lib_deg = - (6.29 * math.sin(m_rad) - 1.27 * math.sin(m_rad - 2.0 * d_rad) + 0.66 * math.sin(2.0 * d_rad))

    # Libration in latitude
    lat_lib_deg = - (5.13 * math.sin(f_rad) + 0.28 * math.sin(m_rad + f_rad) - 0.28 * math.sin(f_rad - m_rad))

    # Distance to Earth in km
    dist_km = MOON_EARTH_MEAN_DIST_KM * (1.0 - 0.0549 * math.cos(m_rad) - 0.0117 * math.cos(2.0 * d_rad - m_rad))

    lon_lib_rad = math.radians(lon_lib_deg)
    lat_lib_rad = math.radians(lat_lib_deg)

    x = dist_km * math.cos(lat_lib_rad) * math.cos(lon_lib_rad)
    y = dist_km * math.cos(lat_lib_rad) * math.sin(lon_lib_rad)
    z = dist_km * math.sin(lat_lib_rad)

    return np.array([x, y, z], dtype=np.float64)


def compute_moon_center_to_sun_moon_me_km(jd: float) -> np.ndarray:
    """Compute position vector of Sun from Moon center in MOON_ME frame (km).

    The Sun moves around the lunar equator with period of one synodic month (29.530589 days).
    The lunar equator is tilted by ~1.5424 deg relative to the ecliptic.

    Args:
        jd: Julian Date.

    Returns:
        np.ndarray: [x, y, z] vector in km in MOON_ME.
    """
    t = (jd - 2451545.0) / 36525.0

    # Solar mean anomaly
    m_sun = (357.5291092 + 35999.0502909 * t) % 360.0
    m_sun_rad = math.radians(m_sun)

    # Sun-Earth distance in km (eccentricity ~ 0.0167)
    dist_km = AU_KM * (1.0 - 0.0167 * math.cos(m_sun_rad))

    # Subsolar longitude in MOON_ME (decreases eastward by 360 deg per synodic month)
    # Synodic month = 29.530588861 days
    days_since_j2000 = jd - 2451545.0
    synodic_period_days = 29.530588861
    lon_sun_deg = (180.0 - (days_since_j2000 / synodic_period_days) * 360.0) % 360.0

    # Subsolar latitude: oscillates between +/- 1.5424 deg with period of draconic year
    # Node of the lunar orbit on the ecliptic
    omega_node_deg = (125.04452 - 1934.136261 * t) % 360.0
    subsolar_lat_deg = 1.5424 * math.sin(math.radians(lon_sun_deg - omega_node_deg))

    lat_rad = math.radians(subsolar_lat_deg)
    lon_rad = math.radians(lon_sun_deg)

    x = dist_km * math.cos(lat_rad) * math.cos(lon_rad)
    y = dist_km * math.cos(lat_rad) * math.sin(lon_rad)
    z = dist_km * math.sin(lat_rad)

    return np.array([x, y, z], dtype=np.float64)


def compute_topocentric_sun_state(
    iso_utc_str: str,
    site_lat_deg: float,
    site_lon_deg: float,
    site_elev_m: float = 0.0,
    observer_height_m: float = 0.0,
) -> CelestialBodyState:
    """Compute topocentric Sun state (az_deg, el_deg, radius_deg, dist_km) from a lunar site.

    Complies with Rule 6: Topocentric direction using local up at the site, never Moon centre.

    Args:
        iso_utc_str: UTC time in ISO 8601 string.
        site_lat_deg: Site latitude in degrees.
        site_lon_deg: Site longitude in degrees.
        site_elev_m: Site ground elevation in meters.
        observer_height_m: Observer mast height in meters.

    Returns:
        CelestialBodyState namedtuple.
    """
    jd = utc_iso_to_julian_date(iso_utc_str)
    r_sun_moon_me_km = compute_moon_center_to_sun_moon_me_km(jd)

    # Observer position in MOON_ME in km
    r_obs_m = latlon_to_cartesian_moon_me_m(
        lat_deg=site_lat_deg,
        lon_deg=site_lon_deg,
        elev_m=site_elev_m + observer_height_m,
    )
    r_obs_km = r_obs_m / 1000.0

    # Topocentric vector
    v_topo_km = r_sun_moon_me_km - r_obs_km
    dist_km = float(np.linalg.norm(v_topo_km))

    az_deg, el_deg = vector_to_az_el_deg(v_topo_km, site_lat_deg, site_lon_deg)
    radius_deg = math.degrees(math.asin(R_SUN_KM / dist_km))

    return CelestialBodyState(
        az_deg=az_deg,
        el_deg=el_deg,
        radius_deg=radius_deg,
        dist_km=dist_km,
        vec_moon_me_km=v_topo_km,
    )


def compute_topocentric_earth_state(
    iso_utc_str: str,
    site_lat_deg: float,
    site_lon_deg: float,
    site_elev_m: float = 0.0,
    observer_height_m: float = 0.0,
) -> CelestialBodyState:
    """Compute topocentric Earth state (az_deg, el_deg, radius_deg, dist_km) from a lunar site.

    Complies with Rule 6: Topocentric direction using local up at the site, never Moon centre.

    Args:
        iso_utc_str: UTC time in ISO 8601 string.
        site_lat_deg: Site latitude in degrees.
        site_lon_deg: Site longitude in degrees.
        site_elev_m: Site ground elevation in meters.
        observer_height_m: Observer mast height in meters.

    Returns:
        CelestialBodyState namedtuple.
    """
    jd = utc_iso_to_julian_date(iso_utc_str)
    r_earth_moon_me_km = compute_moon_center_to_earth_moon_me_km(jd)

    # Observer position in MOON_ME in km
    r_obs_m = latlon_to_cartesian_moon_me_m(
        lat_deg=site_lat_deg,
        lon_deg=site_lon_deg,
        elev_m=site_elev_m + observer_height_m,
    )
    r_obs_km = r_obs_m / 1000.0

    # Topocentric vector
    v_topo_km = r_earth_moon_me_km - r_obs_km
    dist_km = float(np.linalg.norm(v_topo_km))

    az_deg, el_deg = vector_to_az_el_deg(v_topo_km, site_lat_deg, site_lon_deg)
    radius_deg = math.degrees(math.asin(R_EARTH_KM / dist_km))

    return CelestialBodyState(
        az_deg=az_deg,
        el_deg=el_deg,
        radius_deg=radius_deg,
        dist_km=dist_km,
        vec_moon_me_km=v_topo_km,
    )


def check_dsn_ground_station_visibility(
    iso_utc_str: str,
    station_mask_el_deg: float = DEFAULT_EARTH_GROUND_STATION_MASK_DEG,
) -> Tuple[List[str], List[bool]]:
    """Determine which DSN Earth stations have line-of-sight to the Moon.

    For each station (Goldstone, Madrid, Canberra):
    - Calculates Earth rotation at time t (GMST).
    - Station geocentric unit vector: [cos(lat)*cos(lon+GMST), cos(lat)*sin(lon+GMST), sin(lat)].
    - Vector to Moon: opposite of Earth position in inertial/Earth frame.
    - Angle between station up and Moon direction yields elevation at the ground station.

    Args:
        iso_utc_str: UTC timestamp.
        station_mask_el_deg: Ground station minimum elevation mask in degrees (default 10.0 deg).

    Returns:
        Tuple:
            station_names: List of station names.
            station_visible: List of booleans (True if Moon elevation >= station_mask_el_deg).
    """
    jd = utc_iso_to_julian_date(iso_utc_str)
    gmst_deg = greenwich_mean_sidereal_time_deg(jd)

    # Vector from Earth center to Moon center
    # In approximate geocentric equatorial frame:
    # Earth-Moon direction has declination and RA derived from Moon orbit
    t = (jd - 2451545.0) / 36525.0
    l_moon = math.radians((218.316 + 481267.8813 * t) % 360.0)
    eps_rad = math.radians(23.439 - 0.0130 * t)  # Obliquity of ecliptic

    # Lunar position in geocentric equatorial unit vector
    moon_x = math.cos(l_moon)
    moon_y = math.sin(l_moon) * math.cos(eps_rad)
    moon_z = math.sin(l_moon) * math.sin(eps_rad)
    v_moon_geo = np.array([moon_x, moon_y, moon_z], dtype=np.float64)
    v_moon_geo /= np.linalg.norm(v_moon_geo)

    station_names = []
    station_visible = []

    for st in DSN_STATIONS:
        station_names.append(st["name"])
        lat_rad = math.radians(st["lat_deg"])
        # Greenwich Meridian angle + station longitude
        lon_total_deg = (st["lon_deg"] + gmst_deg) % 360.0
        lon_total_rad = math.radians(lon_total_deg)

        # Station local Up vector in geocentric equatorial frame
        u_st = np.array([
            math.cos(lat_rad) * math.cos(lon_total_rad),
            math.cos(lat_rad) * math.sin(lon_total_rad),
            math.sin(lat_rad)
        ], dtype=np.float64)

        # Cosine of zenith angle of the Moon from the station
        cos_zenith = float(np.dot(u_st, v_moon_geo))
        cos_zenith = max(-1.0, min(1.0, cos_zenith))
        zenith_deg = math.degrees(math.acos(cos_zenith))
        station_el_deg = 90.0 - zenith_deg

        is_vis = station_el_deg >= station_mask_el_deg
        station_visible.append(bool(is_vis))

    return station_names, station_visible
