"""NASA Deep Space Network (DSN) ground station visibility and Direct-To-Earth (DTE) link analysis.

Rules:
- Station data loaded from configs/dsn_stations.yaml (human verified, shipped with unverified placeholders).
- Earth body-fixed frame: ITRF93 (or IAU_EARTH).
- Moon elevation at ground station computed with SPICE when kernels loaded, or analytical GMST fallback.
- Minimum usable elevation mask parameterized (default 6.0 deg marked verify).
- dte_available checks joint site Earth visibility AND ground station Moon line-of-sight.
"""

import math
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import spiceypy as spice
import yaml

from pipeline.constants import (
    DEFAULT_DSN_MIN_ELEVATION_DEG,
    DEFAULT_MIN_EARTH_FRAC,
    FRAME_EARTH_IAU,
    FRAME_EARTH_ITRF93,
    R_MOON_KM,
)
from pipeline.ephemeris import (
    greenwich_mean_sidereal_time_deg,
    utc_iso_to_julian_date,
)
from pipeline.geometry import are_kernels_loaded, utc_to_et

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DSN_CONFIG_PATH = ROOT_DIR / "configs" / "dsn_stations.yaml"


def load_dsn_stations(config_path: Union[str, Path] = DEFAULT_DSN_CONFIG_PATH) -> Tuple[List[Dict[str, Any]], float]:
    """Load DSN ground station parameters from YAML configuration.

    Args:
        config_path: Path to dsn_stations.yaml.

    Returns:
        Tuple of (stations_list, default_min_elevation_deg).

    Raises:
        FileNotFoundError: If configuration file is missing.
    """
    path = Path(config_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"DSN station configuration file not found at: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    default_min_el = float(data.get("default_min_elevation_deg", DEFAULT_DSN_MIN_ELEVATION_DEG))
    stations = data.get("stations", [])

    return stations, default_min_el


def station_position_itrf93_km(
    lat_deg: float,
    lon_deg: float,
    height_m: float = 0.0,
) -> np.ndarray:
    """Compute station 3D Cartesian position in Earth body-fixed frame (ITRF93 / WGS84) in km.

    Uses WGS84 ellipsoid reference:
        Semi-major axis a = 6378.137 km
        Flattening f = 1 / 298.257223563

    Args:
        lat_deg: Geodetic latitude in degrees.
        lon_deg: East longitude in degrees.
        height_m: Altitude above reference ellipsoid in meters.

    Returns:
        np.ndarray [X, Y, Z] in km.
    """
    if are_kernels_loaded():
        try:
            # SPICE georec: lon_rad, lat_rad, alt_km, re_km, f
            pos = spice.georec(
                math.radians(lon_deg),
                math.radians(lat_deg),
                height_m / 1000.0,
                6378.137,
                1.0 / 298.257223563,
            )
            return np.array(pos, dtype=np.float64)
        except Exception:
            pass

    # Analytical WGS84 geodetic to Cartesian
    a = 6378.137
    f = 1.0 / 298.257223563
    e2 = 2.0 * f - f**2

    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)
    h_km = height_m / 1000.0

    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    sin_lon = math.sin(lon_rad)
    cos_lon = math.cos(lon_rad)

    n_val = a / math.sqrt(1.0 - e2 * sin_lat**2)

    x = (n_val + h_km) * cos_lat * cos_lon
    y = (n_val + h_km) * cos_lat * sin_lon
    z = (n_val * (1.0 - e2) + h_km) * sin_lat

    return np.array([x, y, z], dtype=np.float64)


def station_enu_basis_itrf93(
    lat_deg: float,
    lon_deg: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute local East, North, Up unit vectors at an Earth station in body-fixed frame."""
    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)

    up = np.array([
        math.cos(lat_rad) * math.cos(lon_rad),
        math.cos(lat_rad) * math.sin(lon_rad),
        math.sin(lat_rad),
    ], dtype=np.float64)

    east = np.array([
        -math.sin(lon_rad),
        math.cos(lon_rad),
        0.0,
    ], dtype=np.float64)

    north = np.array([
        -math.sin(lat_rad) * math.cos(lon_rad),
        -math.sin(lat_rad) * math.sin(lon_rad),
        math.cos(lat_rad),
    ], dtype=np.float64)

    east /= np.linalg.norm(east)
    north /= np.linalg.norm(north)
    up /= np.linalg.norm(up)

    return east, north, up


def moon_elevation_at_station(
    station: Dict[str, Any],
    utc_times: Sequence[str],
    limb: bool = False,
    min_elevation_deg: Optional[float] = None,
    earth_frame: str = FRAME_EARTH_ITRF93,
) -> np.ndarray:
    """Calculate the topocentric elevation of the Moon above a DSN ground station horizon.

    When SPICE kernels are loaded:
        Uses SPICE spkpos in Earth body-fixed frame (ITRF93 or IAU_EARTH).
    When SPICE kernels are absent:
        Uses deterministic GMST rotation and lunar ephemeris.

    Args:
        station: Dict containing lat_deg, lon_deg, and optional height_m.
        utc_times: Sequence of ISO 8601 UTC date strings.
        limb: If True, returns elevation of Moon lower limb instead of Moon center.
        min_elevation_deg: Optional minimum cutoff; if provided, masks elevations below it.
        earth_frame: Earth body-fixed frame name (default: 'ITRF93').

    Returns:
        np.ndarray of elevation angles in degrees for each timestamp.
    """
    lat_deg = float(station["lat_deg"])
    lon_deg = float(station["lon_deg"])
    height_m = float(station.get("height_m", 0.0))

    r_st = station_position_itrf93_km(lat_deg, lon_deg, height_m)
    east, north, up = station_enu_basis_itrf93(lat_deg, lon_deg)

    elevations = []
    use_spice = are_kernels_loaded()

    for ts in utc_times:
        if use_spice:
            et = float(utc_to_et(ts))
            try:
                # Try requested frame, fallback to IAU_EARTH if ITRF93 not in kernel
                frame_to_use = earth_frame
                try:
                    moon_pos_earth, _ = spice.spkpos("MOON", et, frame_to_use, "LT+S", "EARTH")
                except Exception:
                    frame_to_use = FRAME_EARTH_IAU
                    moon_pos_earth, _ = spice.spkpos("MOON", et, frame_to_use, "LT+S", "EARTH")

                v_topo = moon_pos_earth - r_st
                dist_km = float(np.linalg.norm(v_topo))

                e = float(np.dot(v_topo, east))
                n = float(np.dot(v_topo, north))
                u = float(np.dot(v_topo, up))

                el_rad = math.atan2(u, math.hypot(e, n))
                el_deg = math.degrees(el_rad)

                if limb:
                    # Subtract apparent angular radius of the Moon (~0.26 deg)
                    moon_radius_deg = math.degrees(math.asin(R_MOON_KM / dist_km))
                    el_deg -= moon_radius_deg

                elevations.append(el_deg)
                continue
            except Exception:
                pass

        # Analytical fallback via GMST
        jd = utc_iso_to_julian_date(ts)
        gmst = greenwich_mean_sidereal_time_deg(jd)
        t = (jd - 2451545.0) / 36525.0

        # Lunar geocentric position
        l_moon = math.radians((218.316 + 481267.8813 * t) % 360.0)
        eps_rad = math.radians(23.439 - 0.0130 * t)
        v_moon_geo = np.array([
            math.cos(l_moon),
            math.sin(l_moon) * math.cos(eps_rad),
            math.sin(l_moon) * math.sin(eps_rad),
        ], dtype=np.float64)
        v_moon_geo /= np.linalg.norm(v_moon_geo)

        # Station local Up in equatorial inertial frame
        lon_rot_rad = math.radians((lon_deg + gmst) % 360.0)
        lat_rad = math.radians(lat_deg)
        u_st = np.array([
            math.cos(lat_rad) * math.cos(lon_rot_rad),
            math.cos(lat_rad) * math.sin(lon_rot_rad),
            math.sin(lat_rad),
        ], dtype=np.float64)

        cos_zenith = float(np.clip(np.dot(u_st, v_moon_geo), -1.0, 1.0))
        el_deg = 90.0 - math.degrees(math.acos(cos_zenith))

        if limb:
            el_deg -= 0.26  # Mean lunar angular radius

        elevations.append(el_deg)

    res = np.array(elevations, dtype=np.float64)
    return res


def dte_available(
    site_series: Dict[str, Any],
    stations: List[Dict[str, Any]],
    min_station_el_deg: float = DEFAULT_DSN_MIN_ELEVATION_DEG,
    earth_frac_threshold: float = DEFAULT_MIN_EARTH_FRAC,
) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
    """Determine Direct-To-Earth (DTE) communication contact availability.

    Contact is possible when:
        1. The lunar site has line-of-sight to the Earth above terrain horizon
           (earth_frac >= earth_frac_threshold).
        2. AND at least one ground station on Earth has the Moon above its
           minimum elevation cutoff mask (min_station_el_deg).

    Args:
        site_series: Time-series dictionary containing 'time_utc' and 'earth'['frac'].
        stations: List of station configuration dictionaries.
        min_station_el_deg: Ground station minimum elevation cutoff (default: 6.0 deg).
        earth_frac_threshold: Minimum lunar site Earth visible fraction (default: 0.50).

    Returns:
        Tuple:
            dte_active: 1D boolean array indicating joint link availability at each timestep.
            per_station_flags: Dict mapping station_id to 1D boolean visibility array.
    """
    times = site_series["time_utc"]
    earth_fracs = np.array(site_series["earth"]["frac"], dtype=np.float64)

    # Condition 1: Lunar site sees Earth
    site_sees_earth = earth_fracs >= earth_frac_threshold

    per_station_flags: Dict[str, np.ndarray] = {}
    any_station_sees_moon = np.zeros(len(times), dtype=bool)

    for st in stations:
        st_id = st.get("id", st.get("name", "unknown"))
        st_min_el = float(st.get("min_elevation_deg", min_station_el_deg))

        st_elevations = moon_elevation_at_station(
            station=st,
            utc_times=times,
            limb=False,
            min_elevation_deg=st_min_el,
        )
        is_visible = st_elevations >= st_min_el
        per_station_flags[st_id] = is_visible
        any_station_sees_moon = any_station_sees_moon | is_visible

    # Joint link condition
    dte_active = site_sees_earth & any_station_sees_moon

    return dte_active, per_station_flags
