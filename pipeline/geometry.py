"""Lunar spherical geometry, topocentric coordinate transformations, and SPICE interfaces.

Rules & Conventions:
- LOLA Moon sphere radius R = 1737400.0 m (R_MOON_M).
- Coordinate Frame: MOON_ME (Moon Mean Earth / Polar Axis frame).
- Units and frames in names: lat_deg, el_deg, dist_m, sun_xyz_moon_me_km, range_km.
- Degrees at module boundaries, radians only inside internal math functions.
- Exact curvature formula for terrain elevation:
    el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
- Topocentric directions (from the site or cell, using that point's local up), never Moon centre.
- Pole degeneracy handled explicitly in ENU basis.
- SPICE integration via SpiceyPy with clean analytical fallbacks when kernels are absent.
"""

import math
from collections.abc import Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple, Union

import numpy as np
import spiceypy as spice

from pipeline.constants import (
    FRAME_MOON_ME,
    R_EARTH_KM,
    R_MOON_M,
    R_SUN_KM,
)

# -----------------------------------------------------------------------------
# 1. SPICE Kernel Management
# -----------------------------------------------------------------------------

def load_kernels(meta_kernel_path: Union[str, Path]) -> None:
    """Load SPICE kernels from a meta-kernel file into the SPICE subsystem.

    Args:
        meta_kernel_path: Path to the meta-kernel (.tm) file.

    Raises:
        FileNotFoundError: If meta_kernel_path does not exist.
        RuntimeError: If SPICE fails to load the specified kernels.
    """
    path = Path(meta_kernel_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"SPICE meta-kernel file not found: {path}")

    try:
        spice.furnsh(str(path))
    except Exception as e:
        raise RuntimeError(f"SpiceyPy failed to load meta-kernel '{path}': {e}") from e


def unload_kernels() -> None:
    """Unload all currently loaded SPICE kernels and clear the kernel pool."""
    spice.kclear()


@contextmanager
def kernel_context(meta_kernel_path: Union[str, Path]) -> Generator[None, None, None]:
    """Context manager for loading and safely unloading SPICE kernels."""
    load_kernels(meta_kernel_path)
    try:
        yield
    finally:
        unload_kernels()


def are_kernels_loaded() -> bool:
    """Check if any SPICE kernels are currently loaded in the kernel pool."""
    try:
        return spice.ktotal("ALL") > 0
    except Exception:
        return False


def get_sun_earth_moon_me_km(
    ts: str,
    et: Optional[float] = None,
    frame: str = FRAME_MOON_ME,
    abcorr: str = "NONE",
) -> Tuple[np.ndarray, np.ndarray]:
    """Get position vectors of Sun and Earth from Moon center in MOON_ME frame (km).

    Uses SPICE when kernels are loaded; falls back to analytical ephemeris otherwise.
    """
    if are_kernels_loaded():
        if et is None:
            et = float(utc_to_et(ts))
        sun_pos, _ = spice.spkpos("SUN", et, frame, abcorr, "MOON")
        earth_pos, _ = spice.spkpos("EARTH", et, frame, abcorr, "MOON")
        return np.array(sun_pos, dtype=np.float64), np.array(earth_pos, dtype=np.float64)
    else:
        from pipeline.ephemeris import (
            compute_moon_center_to_earth_moon_me_km,
            compute_moon_center_to_sun_moon_me_km,
            utc_iso_to_julian_date,
        )
        jd = utc_iso_to_julian_date(ts)
        return compute_moon_center_to_sun_moon_me_km(jd), compute_moon_center_to_earth_moon_me_km(jd)



def utc_to_et(utc_str: Union[str, Sequence[str]]) -> Union[float, np.ndarray]:
    """Convert UTC ISO-8601 string(s) to Ephemeris Time (ET / TDB seconds past J2000).

    When SPICE leapseconds kernels are loaded, calls `spice.str2et`.
    If no kernels are loaded, uses an analytical conversion based on J2000 Julian Date
    and standard TT-UTC leap seconds offset.

    Args:
        utc_str: Single ISO string or list/array of ISO strings (e.g. '2026-11-01T00:00:00Z').

    Returns:
        float or np.ndarray of ET seconds past J2000.0.
    """
    def _convert_single(s: str) -> float:
        if are_kernels_loaded():
            try:
                return float(spice.str2et(s))
            except Exception:
                pass
        # Analytical fallback: ET = (JD - 2451545.0) * 86400.0 + 69.184
        from pipeline.ephemeris import utc_iso_to_julian_date
        jd = utc_iso_to_julian_date(s)
        # J2000 epoch is JD 2451545.0 (2000-01-01 12:00:00 TT)
        # For 2026, TT - UTC is approx 69.184 seconds (37 leap seconds + 32.184 s)
        et = (jd - 2451545.0) * 86400.0 + 69.184
        return float(et)

    if isinstance(utc_str, str):
        return _convert_single(utc_str)
    else:
        return np.array([_convert_single(s) for s in utc_str], dtype=np.float64)


# -----------------------------------------------------------------------------
# 2. Site Positions and ENU Basis
# -----------------------------------------------------------------------------

def site_position_moon_me_km(
    lat_deg: Union[float, np.ndarray],
    lon_deg: Union[float, np.ndarray],
    radius_m: Union[float, np.ndarray] = R_MOON_M,
) -> np.ndarray:
    """Compute 3D Cartesian coordinates of lunar surface site(s) in MOON_ME frame (km).

    Args:
        lat_deg: Latitude in degrees [-90, +90].
        lon_deg: East longitude in degrees.
        radius_m: Radius from Moon center in meters (default: R_MOON_M = 1737400.0 m).

    Returns:
        np.ndarray: [X, Y, Z] coordinates in kilometers in MOON_ME.
                    Shape is (3,) for scalar inputs, or (..., 3) for array inputs.
    """
    lat_rad = np.radians(lat_deg)
    lon_rad = np.radians(lon_deg)
    r_km = np.asarray(radius_m, dtype=np.float64) / 1000.0

    x = r_km * np.cos(lat_rad) * np.cos(lon_rad)
    y = r_km * np.cos(lat_rad) * np.sin(lon_rad)
    z = r_km * np.sin(lat_rad)

    stacked = np.stack([x, y, z], axis=-1)
    if stacked.ndim == 1:
        return stacked
    return stacked


def enu_basis(
    lat_deg: Union[float, np.ndarray],
    lon_deg: Union[float, np.ndarray],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute local East, North, Up (ENU) orthonormal basis unit vectors in MOON_ME.

    Vectorized over scalar floats or arbitrary NumPy arrays (e.g. 2D route-planning grids).

    Mathematical Definitions (for regular non-polar points):
        Up (zenith):    u = [cos(phi)*cos(lam), cos(phi)*sin(lam), sin(phi)]
        East:           e = [-sin(lam), cos(lam), 0]
        North:          n = [-sin(phi)*cos(lam), -sin(phi)*sin(lam), cos(phi)]
        Right-handed:   e x n = u

    Pole Degeneracy Handling:
        At the South Pole (phi = -90 deg):
            - Up is [0, 0, -1].
            - Meridians converge; East and North are degenerate.
            - Cartographic convention (IAU/LOLA): Local North is defined pointing
              toward the Prime Meridian (sub-Earth point, +X, lon=0 deg): n = [1, 0, 0].
              East points toward +90 deg East longitude (+Y): e = [0, 1, 0].
              Verification: e x n = [0, 1, 0] x [1, 0, 0] = [0, 0, -1] = u.
        At the North Pole (phi = +90 deg):
            - Up is [0, 0, 1].
            - North is defined pointing along -X: n = [-1, 0, 0].
            - East points along +Y: e = [0, 1, 0].
              Verification: e x n = [0, 1, 0] x [-1, 0, 0] = [0, 0, 1] = u.

    Args:
        lat_deg: Latitude in degrees [-90, +90] (scalar or array).
        lon_deg: East longitude in degrees (scalar or array).

    Returns:
        Tuple[east, north, up] unit vectors in MOON_ME.
        Each vector has shape (3,) for scalar inputs, or (..., 3) matching array inputs.
    """
    is_scalar = np.ndim(lat_deg) == 0 and np.ndim(lon_deg) == 0
    lats = np.atleast_1d(np.asarray(lat_deg, dtype=np.float64))
    lons = np.atleast_1d(np.asarray(lon_deg, dtype=np.float64))

    # Broadcast shapes if necessary
    lats, lons = np.broadcast_arrays(lats, lons)

    lat_rad = np.radians(lats)
    lon_rad = np.radians(lons)

    cos_lat = np.cos(lat_rad)
    sin_lat = np.sin(lat_rad)
    cos_lon = np.cos(lon_rad)
    sin_lon = np.sin(lon_rad)

    # General ENU vectors
    u_x = cos_lat * cos_lon
    u_y = cos_lat * sin_lon
    u_z = sin_lat
    up = np.stack([u_x, u_y, u_z], axis=-1)

    e_x = -sin_lon
    e_y = cos_lon
    e_z = np.zeros_like(lons)
    east = np.stack([e_x, e_y, e_z], axis=-1)

    n_x = -sin_lat * cos_lon
    n_y = -sin_lat * sin_lon
    n_z = cos_lat
    north = np.stack([n_x, n_y, n_z], axis=-1)

    # Handle Pole Degeneracy
    south_pole_mask = np.isclose(lats, -90.0, atol=1e-5)
    if np.any(south_pole_mask):
        up[south_pole_mask] = np.array([0.0, 0.0, -1.0])
        north[south_pole_mask] = np.array([1.0, 0.0, 0.0])
        east[south_pole_mask] = np.array([0.0, 1.0, 0.0])

    north_pole_mask = np.isclose(lats, 90.0, atol=1e-5)
    if np.any(north_pole_mask):
        up[north_pole_mask] = np.array([0.0, 0.0, 1.0])
        north[north_pole_mask] = np.array([-1.0, 0.0, 0.0])
        east[north_pole_mask] = np.array([0.0, 1.0, 0.0])

    # Normalize vectors to ensure strict unit norms
    east /= np.linalg.norm(east, axis=-1, keepdims=True)
    north /= np.linalg.norm(north, axis=-1, keepdims=True)
    up /= np.linalg.norm(up, axis=-1, keepdims=True)

    if is_scalar:
        return east[0], north[0], up[0]
    return east, north, up


# -----------------------------------------------------------------------------
# 3. Topocentric Azimuth, Elevation, and Range
# -----------------------------------------------------------------------------

def topocentric_az_el(
    target_xyz_moon_me_km: np.ndarray,
    site_xyz_moon_me_km: np.ndarray,
    basis: Tuple[np.ndarray, np.ndarray, np.ndarray],
) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray], Union[float, np.ndarray]]:
    """Compute topocentric Azimuth, Elevation, and Range from site(s) to target(s).

    Azimuth convention:
        Clockwise from local North:
        0 deg = North, 90 deg = East, 180 deg = South, 270 deg = West.
    Elevation convention:
        Angle above local tangent horizontal plane in [-90, +90] deg.

    Vectorized over both time steps and spatial grid points.

    Args:
        target_xyz_moon_me_km: Target 3D coordinates in MOON_ME (km), shape (..., 3).
        site_xyz_moon_me_km: Site 3D coordinates in MOON_ME (km), shape (..., 3).
        basis: Local ENU basis (east, north, up), each shape (..., 3).

    Returns:
        Tuple[az_deg, el_deg, range_km]
    """
    east, north, up = basis

    # Vector from site to target
    delta = target_xyz_moon_me_km - site_xyz_moon_me_km

    # Project into ENU coordinates
    e = np.sum(delta * east, axis=-1)
    n = np.sum(delta * north, axis=-1)
    u = np.sum(delta * up, axis=-1)

    # Range
    range_km = np.linalg.norm(delta, axis=-1)

    # Azimuth clockwise from North
    az_rad = np.arctan2(e, n)
    az_deg = np.degrees(az_rad) % 360.0

    # Elevation
    horiz_dist = np.hypot(e, n)
    el_rad = np.arctan2(u, horiz_dist)
    el_deg = np.degrees(el_rad)

    if np.ndim(range_km) == 0:
        return float(az_deg), float(el_deg), float(range_km)
    return az_deg, el_deg, range_km


# -----------------------------------------------------------------------------
# 4. Sun & Earth Topocentric Ephemeris Series
# -----------------------------------------------------------------------------

def sun_earth_series(
    points: Union[Sequence[Tuple[float, float, float]], Dict[str, Any]],
    start_utc: str,
    end_utc: str,
    step_minutes: int = 60,
    frame: str = FRAME_MOON_ME,
    abcorr: str = "NONE",
) -> Dict[str, Any]:
    """Compute topocentric Azimuth, Elevation, Range, and Angular Radius for Sun and Earth.

    Radii:
        - Sun nominal volumetric radius: 695,700 km (IAU 2015 resolution).
        - Earth mean volumetric radius: 6,371 km.
    Aberration Correction:
        - abcorr can be 'NONE', 'LT' (light-time), or 'LT+S' (light-time + stellar aberration).

    Args:
        points: Single tuple (lat_deg, lon_deg, radius_m) or list of tuples.
        start_utc: Start ISO UTC time string.
        end_utc: End ISO UTC time string.
        step_minutes: Time step in minutes.
        frame: Reference frame (default: 'MOON_ME').
        abcorr: Aberration correction flag ('NONE', 'LT', 'LT+S').

    Returns:
        Dictionary containing time_utc, and nested sun/earth states.
    """
    # Normalize points input
    if isinstance(points, tuple) and len(points) == 3:
        pts = [points]
    elif isinstance(points, list):
        pts = points
    elif isinstance(points, dict) and "lat_deg" in points and "lon_deg" in points:
        pts = [(points["lat_deg"], points["lon_deg"], points.get("ground_elev_m", 0.0) + R_MOON_M)]
    else:
        raise ValueError(f"Invalid points format: {points}")

    # Generate time steps
    from pipeline.series import generate_time_steps
    timestamps = generate_time_steps(start_utc, end_utc, step_minutes=step_minutes)
    et_times = utc_to_et(timestamps)
    num_t = len(timestamps)

    # Check SPICE kernels status
    use_spice = are_kernels_loaded()

    # Precompute site positions and ENU bases
    site_positions_km = []
    bases = []
    for lat, lon, r_m in pts:
        pos = site_position_moon_me_km(lat, lon, r_m)
        b = enu_basis(lat, lon)
        site_positions_km.append(pos)
        bases.append(b)

    sun_results: List[Dict[str, List[float]]] = [{"az_deg": [], "el_deg": [], "range_km": [], "radius_deg": []} for _ in pts]
    earth_results: List[Dict[str, List[float]]] = [{"az_deg": [], "el_deg": [], "range_km": [], "radius_deg": []} for _ in pts]

    for t_idx in range(num_t):
        et = float(et_times[t_idx])
        ts = timestamps[t_idx]

        if use_spice:
            # High-precision SPICE ephemerides
            sun_pos_moon, _ = spice.spkpos("SUN", et, frame, abcorr, "MOON")
            earth_pos_moon, _ = spice.spkpos("EARTH", et, frame, abcorr, "MOON")
        else:
            # Deterministic analytical fallback
            from pipeline.ephemeris import (
                compute_moon_center_to_earth_moon_me_km,
                compute_moon_center_to_sun_moon_me_km,
                utc_iso_to_julian_date,
            )
            jd = utc_iso_to_julian_date(ts)
            sun_pos_moon = compute_moon_center_to_sun_moon_me_km(jd)
            earth_pos_moon = compute_moon_center_to_earth_moon_me_km(jd)

        # Compute for each site point
        for p_idx in range(len(pts)):
            site_pos = site_positions_km[p_idx]
            basis = bases[p_idx]

            # Sun
            s_az, s_el, s_range = topocentric_az_el(sun_pos_moon, site_pos, basis)
            s_radius = math.degrees(math.asin(R_SUN_KM / float(s_range)))
            sun_results[p_idx]["az_deg"].append(round(float(s_az), 3))
            sun_results[p_idx]["el_deg"].append(round(float(s_el), 3))
            sun_results[p_idx]["range_km"].append(round(float(s_range), 1))
            sun_results[p_idx]["radius_deg"].append(round(float(s_radius), 4))

            # Earth
            e_az, e_el, e_range = topocentric_az_el(earth_pos_moon, site_pos, basis)
            e_radius = math.degrees(math.asin(R_EARTH_KM / float(e_range)))
            earth_results[p_idx]["az_deg"].append(round(float(e_az), 3))
            earth_results[p_idx]["el_deg"].append(round(float(e_el), 3))
            earth_results[p_idx]["range_km"].append(round(float(e_range), 1))
            earth_results[p_idx]["radius_deg"].append(round(float(e_radius), 4))

    # Single-point convenience unpacking
    if len(pts) == 1:
        return {
            "time_utc": timestamps,
            "et": et_times.tolist() if isinstance(et_times, np.ndarray) else [et_times],
            "sun": sun_results[0],
            "earth": earth_results[0],
            "is_spice": use_spice,
            "abcorr": abcorr,
        }

    return {
        "time_utc": timestamps,
        "et": et_times.tolist() if isinstance(et_times, np.ndarray) else [et_times],
        "points": [{"sun": sun_results[i], "earth": earth_results[i]} for i in range(len(pts))],
        "is_spice": use_spice,
        "abcorr": abcorr,
    }


# -----------------------------------------------------------------------------
# 5. Lunar Eclipse & Earth Shadow Check
# -----------------------------------------------------------------------------

def earth_shadow_on_moon(
    site_pos_moon_me_km: np.ndarray,
    et_or_utc: Union[float, str],
    abcorr: str = "LT+S",
    frame: str = FRAME_MOON_ME,
) -> Dict[str, Any]:
    """Check if the Sun is partly or fully covered by the Earth as seen from a lunar site.

    Methodology:
        From the lunar site, computes the apparent topocentric unit vectors to the Earth
        and the Sun. Evaluates the apparent angular separation theta_sep between celestial centers,
        and compares with the apparent angular radii theta_earth and theta_sun.
        - Total eclipse (umbra): theta_sep <= theta_earth - theta_sun
        - Partial eclipse (penumbra): theta_sep < theta_earth + theta_sun
        - None: theta_sep >= theta_earth + theta_sun

    Args:
        site_pos_moon_me_km: Site 3D position in MOON_ME in km.
        et_or_utc: Ephemeris Time (float) or ISO UTC string.
        abcorr: Aberration correction (default: 'LT+S').
        frame: Reference frame (default: 'MOON_ME').

    Returns:
        Dict with keys:
            is_eclipsed: bool
            eclipse_type: 'none', 'partial', or 'total'
            obscuration_fraction: float in [0.0, 1.0]
            separation_deg: float
            sun_radius_deg: float
            earth_radius_deg: float
    """
    et = float(utc_to_et(et_or_utc) if isinstance(et_or_utc, str) else et_or_utc)

    if are_kernels_loaded():
        sun_pos_moon, _ = spice.spkpos("SUN", et, frame, abcorr, "MOON")
        earth_pos_moon, _ = spice.spkpos("EARTH", et, frame, abcorr, "MOON")
    else:
        # Analytical approximation from JD
        # Convert ET seconds past J2000 back to JD
        from pipeline.ephemeris import (
            compute_moon_center_to_earth_moon_me_km,
            compute_moon_center_to_sun_moon_me_km,
        )
        jd = 2451545.0 + (et - 69.184) / 86400.0
        sun_pos_moon = compute_moon_center_to_sun_moon_me_km(jd)
        earth_pos_moon = compute_moon_center_to_earth_moon_me_km(jd)

    # Topocentric vectors from site
    v_sun = sun_pos_moon - site_pos_moon_me_km
    v_earth = earth_pos_moon - site_pos_moon_me_km

    d_sun = float(np.linalg.norm(v_sun))
    d_earth = float(np.linalg.norm(v_earth))

    u_sun = v_sun / d_sun
    u_earth = v_earth / d_earth

    # Angular separation between Sun and Earth centers
    cos_sep = float(np.clip(np.dot(u_sun, u_earth), -1.0, 1.0))
    sep_deg = math.degrees(math.acos(cos_sep))

    r_sun_deg = math.degrees(math.asin(R_SUN_KM / d_sun))
    r_earth_deg = math.degrees(math.asin(R_EARTH_KM / d_earth))

    # Eclipse classification
    if sep_deg >= (r_earth_deg + r_sun_deg):
        return {
            "is_eclipsed": False,
            "eclipse_type": "none",
            "obscuration_fraction": 0.0,
            "separation_deg": round(sep_deg, 4),
            "sun_radius_deg": round(r_sun_deg, 4),
            "earth_radius_deg": round(r_earth_deg, 4),
        }
    elif sep_deg <= (r_earth_deg - r_sun_deg):
        # Earth completely covers the Sun
        return {
            "is_eclipsed": True,
            "eclipse_type": "total",
            "obscuration_fraction": 1.0,
            "separation_deg": round(sep_deg, 4),
            "sun_radius_deg": round(r_sun_deg, 4),
            "earth_radius_deg": round(r_earth_deg, 4),
        }
    else:
        # Partial eclipse: circle-circle intersection area
        d = sep_deg
        r1 = r_sun_deg
        r2 = r_earth_deg

        # Formula for intersection area of two overlapping discs
        alpha = math.acos(np.clip((d**2 + r1**2 - r2**2) / (2.0 * d * r1), -1.0, 1.0))
        beta = math.acos(np.clip((d**2 + r2**2 - r1**2) / (2.0 * d * r2), -1.0, 1.0))
        area_overlap = (
            r1**2 * alpha + r2**2 * beta - 0.5 * math.sqrt(max(0.0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)))
        )
        sun_area = math.pi * r1**2
        obscuration = max(0.0, min(1.0, area_overlap / sun_area))

        return {
            "is_eclipsed": True,
            "eclipse_type": "partial",
            "obscuration_fraction": round(obscuration, 4),
            "separation_deg": round(sep_deg, 4),
            "sun_radius_deg": round(r_sun_deg, 4),
            "earth_radius_deg": round(r_earth_deg, 4),
        }


# -----------------------------------------------------------------------------
# 6. Optional Cross-Check with SPICE azlcpo
# -----------------------------------------------------------------------------

def cross_check_with_azlcpo(
    target: str,
    et: float,
    frame: str,
    abcorr: str,
    observer_lat_deg: float,
    observer_lon_deg: float,
    observer_radius_m: float = R_MOON_M,
) -> Optional[Tuple[float, float, float]]:
    """Cross-check topocentric Az/El calculation against SPICE azlcpo routine.

    Returns:
        Tuple of (az_deg, el_deg, range_km) from azlcpo if available and kernels loaded,
        or None if azlcpo is unavailable or kernels are not loaded.
    """
    if not hasattr(spice, "azlcpo") or not are_kernels_loaded():
        return None

    try:
        # azlcpo takes obspos in Moon frame
        r_km = observer_radius_m / 1000.0
        phi = math.radians(observer_lat_deg)
        lam = math.radians(observer_lon_deg)
        obspos = np.array([
            r_km * math.cos(phi) * math.cos(lam),
            r_km * math.cos(phi) * math.sin(lam),
            r_km * math.sin(phi),
        ])

        # azlcpo: target, et, abcorr, azccw, elplsz, obspos, obsctr, obsref
        azl_state, _ = spice.azlcpo(
            target=target,
            et=et,
            abcorr=abcorr,
            azccw=False,  # Azimuth clockwise from north
            elplsz=True,  # Elevation positive toward zenith
            obspos=obspos,
            obsctr="MOON",
            obsref=frame,
        )
        range_km = float(azl_state[0])
        az_deg = math.degrees(float(azl_state[1])) % 360.0
        el_deg = math.degrees(float(azl_state[2]))
        return az_deg, el_deg, range_km
    except Exception:
        return None


# -----------------------------------------------------------------------------
# 7. Terrain Curvature & Horn Slope (Existing Core)
# -----------------------------------------------------------------------------

def compute_elevation_angle_deg(
    dist_m: Union[float, np.ndarray],
    elev_m: Union[float, np.ndarray],
    observer_height_m: float = 0.0,
    site_ground_elev_m: float = 0.0,
    r_moon_m: float = R_MOON_M,
) -> Union[float, np.ndarray]:
    """Compute topocentric elevation angle of a terrain sample with exact spherical curvature."""
    r0 = r_moon_m + site_ground_elev_m + observer_height_m
    r = r_moon_m + elev_m

    theta = dist_m / r_moon_m

    if isinstance(theta, np.ndarray):
        cos_theta = np.cos(theta)
        sin_theta = np.sin(theta)
        delta_y = r * cos_theta - r0
        delta_x = r * sin_theta
        el_rad = np.arctan2(delta_y, delta_x)
        return np.degrees(el_rad)
    else:
        cos_theta = math.cos(theta)
        sin_theta = math.sin(theta)
        if dist_m <= 0.0:
            return 90.0 if r > r0 else (-90.0 if r < r0 else 0.0)
        delta_y = r * cos_theta - r0
        delta_x = r * sin_theta
        return math.degrees(math.atan2(delta_y, delta_x))


def latlon_to_cartesian_moon_me_m(
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,
    r_moon_m: float = R_MOON_M,
) -> np.ndarray:
    """Convert lunar latitude, longitude, and elevation to 3D Cartesian coordinates in meters in MOON_ME."""
    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)
    r = r_moon_m + elev_m

    x = r * math.cos(lat_rad) * math.cos(lon_rad)
    y = r * math.cos(lat_rad) * math.sin(lon_rad)
    z = r * math.sin(lat_rad)
    return np.array([x, y, z], dtype=np.float64)


def topocentric_basis_moon_me(
    lat_deg: float,
    lon_deg: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compatibility wrapper returning (east, north, up) basis for a single point."""
    e, n, u = enu_basis(lat_deg, lon_deg)
    return np.asarray(e), np.asarray(n), np.asarray(u)


def vector_to_az_el_deg(
    vec_moon_me: np.ndarray,
    lat_deg: float,
    lon_deg: float,
) -> Tuple[float, float]:
    """Convert a target vector in MOON_ME from observer to local topocentric Azimuth and Elevation in degrees."""
    east, north, up = enu_basis(lat_deg, lon_deg)
    e = float(np.dot(vec_moon_me, east))
    n = float(np.dot(vec_moon_me, north))
    u = float(np.dot(vec_moon_me, up))

    az_rad = math.atan2(e, n)
    az_deg = math.degrees(az_rad) % 360.0

    horiz_dist = math.hypot(e, n)
    el_rad = math.atan2(u, horiz_dist)
    el_deg = math.degrees(el_rad)

    return az_deg, el_deg


def great_circle_distance_m(
    lat1_deg: float,
    lon1_deg: float,
    lat2_deg: float,
    lon2_deg: float,
    r_moon_m: float = R_MOON_M,
) -> float:
    """Compute great-circle distance between two points on the Moon using the Haversine formula."""
    phi1 = math.radians(lat1_deg)
    phi2 = math.radians(lat2_deg)
    dphi = math.radians(lat2_deg - lat1_deg)
    dlambda = math.radians(lon2_deg - lon1_deg)

    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r_moon_m * c


def compute_slope_horn_deg(
    dem_window_3x3_m: np.ndarray,
    cell_spacing_m: float,
) -> float:
    """Compute surface slope in degrees using Horn's (1981) method."""
    if dem_window_3x3_m.shape != (3, 3):
        raise ValueError(f"dem_window_3x3_m must be shape (3, 3), got {dem_window_3x3_m.shape}")
    if cell_spacing_m <= 0:
        raise ValueError(f"cell_spacing_m must be positive, got {cell_spacing_m}")

    z = dem_window_3x3_m
    z_nw, z_n, z_ne = z[0, 0], z[0, 1], z[0, 2]
    z_w, _z_c, z_e = z[1, 0], z[1, 1], z[1, 2]
    z_sw, z_s, z_se = z[2, 0], z[2, 1], z[2, 2]

    dz_dx = ((z_ne + 2.0 * z_e + z_se) - (z_nw + 2.0 * z_w + z_sw)) / (8.0 * cell_spacing_m)
    dz_dy = ((z_nw + 2.0 * z_n + z_ne) - (z_sw + 2.0 * z_s + z_se)) / (8.0 * cell_spacing_m)

    grad_mag = math.hypot(dz_dx, dz_dy)
    slope_rad = math.atan(grad_mag)
    return math.degrees(slope_rad)
