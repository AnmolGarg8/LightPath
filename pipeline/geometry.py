"""Lunar spherical geometry and topocentric coordinate transformations.

Rules:
- LOLA Moon sphere radius R = 1737400.0 m (R_MOON_M).
- MOON_ME reference frame.
- Degrees at module boundaries, radians only inside math functions.
- Exact curvature formula for terrain elevation:
    el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
- Topocentric directions (from the site or cell, using that point's local up).
- DEM slope via Horn's method (1981).
"""

import math
from typing import Tuple, Union

import numpy as np

from pipeline.constants import R_MOON_M


def compute_elevation_angle_deg(
    dist_m: Union[float, np.ndarray],
    elev_m: Union[float, np.ndarray],
    observer_height_m: float = 0.0,
    site_ground_elev_m: float = 0.0,
    r_moon_m: float = R_MOON_M,
) -> Union[float, np.ndarray]:
    """Compute topocentric elevation angle of a terrain sample with exact spherical curvature.

    Formula:
        R = r_moon_m
        z0 = site_ground_elev_m + observer_height_m (observer radius R + z0)
        z  = elev_m (terrain sample radius R + z)
        theta = dist_m / R (angular distance along great circle)
        el_rad = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
        el_deg = degrees(el_rad)

    Args:
        dist_m: Arc distance along the lunar sphere surface to the sample, in meters.
        elev_m: Terrain elevation of the sample relative to R_MOON_M, in meters.
        observer_height_m: Observer mast/instrument height above ground, in meters (z_mast).
        site_ground_elev_m: Ground elevation of the observer site relative to R_MOON_M, in meters.
        r_moon_m: Lunar reference sphere radius (default: 1737400.0 m).

    Returns:
        Elevation angle in degrees above local horizontal at the observer location.
    """
    r0 = r_moon_m + site_ground_elev_m + observer_height_m
    r = r_moon_m + elev_m

    # Compute angular distance theta
    theta = dist_m / r_moon_m

    if isinstance(theta, np.ndarray):
        cos_theta = np.cos(theta)
        sin_theta = np.sin(theta)
        # Avoid atan2(0, 0) if dist_m is exactly 0
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
    """Convert lunar latitude, longitude, and elevation to 3D Cartesian coordinates in MOON_ME.

    Args:
        lat_deg: Latitude in degrees [-90, +90].
        lon_deg: East longitude in degrees.
        elev_m: Elevation above lunar reference sphere, in meters.
        r_moon_m: Lunar reference sphere radius in meters.

    Returns:
        np.ndarray: [X, Y, Z] coordinates in meters in MOON_ME frame.
    """
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
    """Compute local topocentric basis unit vectors (East, North, Up) in MOON_ME frame.

    At the south pole (lat = -90), East is along lon + 90 deg and North points towards (lat=0, lon).
    For regular points:
        Up (zenith): [cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat)]
        East: [-sin(lon), cos(lon), 0]
        North: [-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat)]
    Note: East x North = Up (right-handed system).

    Args:
        lat_deg: Latitude in degrees [-90, +90].
        lon_deg: East longitude in degrees.

    Returns:
        Tuple of 3 unit vectors in MOON_ME: (east, north, up).
    """
    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)

    # Zenith / Local Up
    up = np.array([
        math.cos(lat_rad) * math.cos(lon_rad),
        math.cos(lat_rad) * math.sin(lon_rad),
        math.sin(lat_rad)
    ], dtype=np.float64)

    # South Pole singularity handling
    if abs(lat_deg - (-90.0)) < 1e-7:
        # At south pole, Up is [0, 0, -1].
        # Define North towards Prime Meridian (lon=0, lat=0): [1, 0, 0]
        north = np.array([1.0, 0.0, 0.0], dtype=np.float64)
        east = np.cross(north, up)
        east = east / np.linalg.norm(east)
        return east, north, up
    elif abs(lat_deg - 90.0) < 1e-7:
        # North Pole
        up = np.array([0.0, 0.0, 1.0], dtype=np.float64)
        north = np.array([-1.0, 0.0, 0.0], dtype=np.float64)
        east = np.cross(north, up)
        east = east / np.linalg.norm(east)
        return east, north, up

    east = np.array([-math.sin(lon_rad), math.cos(lon_rad), 0.0], dtype=np.float64)
    north = np.array([
        -math.sin(lat_rad) * math.cos(lon_rad),
        -math.sin(lat_rad) * math.sin(lon_rad),
        math.cos(lat_rad)
    ], dtype=np.float64)

    east = east / np.linalg.norm(east)
    north = north / np.linalg.norm(north)
    up = up / np.linalg.norm(up)

    return east, north, up


def vector_to_az_el_deg(
    vec_moon_me: np.ndarray,
    lat_deg: float,
    lon_deg: float,
) -> Tuple[float, float]:
    """Convert a target vector in MOON_ME from observer to local topocentric Azimuth and Elevation in degrees.

    Azimuth is defined clockwise from local North:
        0 deg = North
        90 deg = East
        180 deg = South
        270 deg = West
    Elevation is the angle above the local tangent plane (degrees):
        +90 deg = Zenith (straight up)
          0 deg = Horizon plane
        -90 deg = Nadir (straight down)

    Args:
        vec_moon_me: 3D vector from observer to celestial target in MOON_ME.
        lat_deg: Observer latitude in degrees.
        lon_deg: Observer longitude in degrees.

    Returns:
        Tuple[az_deg, el_deg]:
            az_deg in [0, 360)
            el_deg in [-90, +90]
    """
    east, north, up = topocentric_basis_moon_me(lat_deg, lon_deg)

    e = float(np.dot(vec_moon_me, east))
    n = float(np.dot(vec_moon_me, north))
    u = float(np.dot(vec_moon_me, up))

    # Azimuth clockwise from North (0 = North, 90 = East)
    az_rad = math.atan2(e, n)
    az_deg = math.degrees(az_rad) % 360.0

    # Elevation
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
    """Compute great-circle distance between two points on the Moon using the Haversine formula.

    Args:
        lat1_deg: Point 1 latitude in degrees.
        lon1_deg: Point 1 longitude in degrees.
        lat2_deg: Point 2 latitude in degrees.
        lon2_deg: Point 2 longitude in degrees.
        r_moon_m: Moon radius in meters.

    Returns:
        Great-circle distance in meters.
    """
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
    """Compute surface slope in degrees using Horn's (1981) 8-neighbor weighted finite difference method.

    Reference:
        Horn, B. K. P. (1981). Hill shading and the reflectance map.
        Proceedings of the IEEE, 69(1), 14-47.

    Layout:
        [[z_nw, z_n, z_ne],
         [z_w,  z_c, z_e ],
         [z_sw, z_s, z_se]]

    Formulas:
        dz_dx = ((z_ne + 2*z_e + z_se) - (z_nw + 2*z_w + z_sw)) / (8 * cell_spacing_m)
        dz_dy = ((z_nw + 2*z_n + z_ne) - (z_sw + 2*z_s + z_se)) / (8 * cell_spacing_m)
        slope_rad = atan(sqrt(dz_dx^2 + dz_dy^2))

    Args:
        dem_window_3x3_m: 3x3 2D array of elevations in meters.
        cell_spacing_m: Grid spacing in meters (> 0).

    Returns:
        Slope in degrees [0, 90).
    """
    if dem_window_3x3_m.shape != (3, 3):
        raise ValueError(f"dem_window_3x3_m must be shape (3, 3), got {dem_window_3x3_m.shape}")
    if cell_spacing_m <= 0:
        raise ValueError(f"cell_spacing_m must be positive, got {cell_spacing_m}")

    z = dem_window_3x3_m
    z_nw, z_n, z_ne = z[0, 0], z[0, 1], z[0, 2]
    z_w,  _z_c, z_e = z[1, 0], z[1, 1], z[1, 2]
    z_sw, z_s, z_se = z[2, 0], z[2, 1], z[2, 2]

    dz_dx = ((z_ne + 2.0 * z_e + z_se) - (z_nw + 2.0 * z_w + z_sw)) / (8.0 * cell_spacing_m)
    dz_dy = ((z_nw + 2.0 * z_n + z_ne) - (z_sw + 2.0 * z_s + z_se)) / (8.0 * cell_spacing_m)

    grad_mag = math.hypot(dz_dx, dz_dy)
    slope_rad = math.atan(grad_mag)
    return math.degrees(slope_rad)
