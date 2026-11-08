"""Spatio-temporal visibility cube generator for lunar surface route planning.

Rules:
- Conforms to schemas/visibility_cube.schema.json.
- Topocentric direction computed per grid cell (tilt ~0.033 deg per km, ~0.10 deg per 3 km; see docs/PHYSICS_NOTES.md).
- Terrain slopes via Horn's (1981) method.
- Deterministic and reproducible.
"""

import math
from typing import Dict, List, Optional, Tuple

import numpy as np

from pipeline.constants import (
    ABCORR_FOR_VALIDATION,
    DEFAULT_MAX_TRAVERSABLE_SLOPE_DEG,
    FRAME_MOON_ME,
    R_EARTH_KM,
    R_MOON_M,
    R_SUN_KM,
)
from pipeline.disc import compute_flat_horizon_disc_fraction
from pipeline.geometry import (
    compute_slope_horn_deg,
    enu_basis,
    get_sun_earth_moon_me_km,
    site_position_moon_me_km,
    topocentric_az_el,
    utc_to_et,
)


def generate_polar_grid_coordinates(
    center_lat_deg: float,
    center_lon_deg: float,
    spacing_m: float,
    nx: int,
    ny: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate 2D arrays of (lat_deg, lon_deg) for a planar tangent grid around center.

    Grid coordinate convention:
        x increases Eastward (columns)
        y increases Northward (rows)

    Args:
        center_lat_deg: Central latitude in degrees.
        center_lon_deg: Central longitude in degrees.
        spacing_m: Grid cell resolution in meters.
        nx: Number of columns along East axis.
        ny: Number of rows along North axis.

    Returns:
        Tuple of (lat_grid_deg, lon_grid_deg) of shape (ny, nx).
    """
    x_coords = (np.arange(nx) - (nx - 1) / 2.0) * spacing_m
    y_coords = (np.arange(ny) - (ny - 1) / 2.0) * spacing_m
    xx, yy = np.meshgrid(x_coords, y_coords)

    # Angular displacement on lunar sphere
    # For south pole region, local cartesian projection
    phi_c = math.radians(center_lat_deg)
    lam_c = math.radians(center_lon_deg)

    # North-East tangent displacement
    # Delta lat = yy / R_MOON_M
    d_lat_rad = yy / R_MOON_M
    lat_rad = phi_c + d_lat_rad
    lat_rad = np.clip(lat_rad, -math.pi / 2.0, math.pi / 2.0)

    # Delta lon = xx / (R_MOON_M * cos(lat))
    cos_lat = np.maximum(0.001, np.cos(lat_rad))
    d_lon_rad = xx / (R_MOON_M * cos_lat)
    lon_rad = lam_c + d_lon_rad

    lat_grid_deg = np.degrees(lat_rad)
    lon_grid_deg = (np.degrees(lon_rad) + 180.0) % 360.0 - 180.0

    return lat_grid_deg, lon_grid_deg


def compute_visibility_cube(
    center_lat_deg: float,
    center_lon_deg: float,
    spacing_m: float,
    nx: int,
    ny: int,
    timestamps: List[str],
    elev_dem_m: np.ndarray,
    horizon_el_grid_deg: Optional[np.ndarray] = None,
    max_slope_deg: float = DEFAULT_MAX_TRAVERSABLE_SLOPE_DEG,
    flags: Optional[List[str]] = None,
) -> Dict:
    """Compute the visibility cube and traversability map across space and time.

    Args:
        center_lat_deg: Center latitude.
        center_lon_deg: Center longitude.
        spacing_m: Cell spacing in meters.
        nx: Grid width (cells).
        ny: Grid height (cells).
        timestamps: List of ISO 8601 UTC time strings.
        elev_dem_m: 2D array of elevations (ny, nx) in meters.
        horizon_el_grid_deg: Optional 2D array of local horizon elevations (ny, nx) or None.
        max_slope_deg: Maximum slope limit for traversability (default 15 deg).
        flags: Provenance/quality flags.

    Returns:
        Dict conforming to schemas/visibility_cube.schema.json.
    """
    if elev_dem_m.shape != (ny, nx):
        raise ValueError(f"elev_dem_m shape {elev_dem_m.shape} != expected ({ny}, {nx})")

    num_t = len(timestamps)
    lat_grid, lon_grid = generate_polar_grid_coordinates(
        center_lat_deg, center_lon_deg, spacing_m, nx, ny
    )

    # 1. Slope computation via Horn method (1981)
    slope_grid_deg = np.zeros((ny, nx), dtype=np.float64)
    # Pad DEM by reflection for boundary slope calculation
    dem_padded = np.pad(elev_dem_m, pad_width=1, mode="edge")

    for r in range(ny):
        for c in range(nx):
            window = dem_padded[r:r+3, c:c+3]
            slope_grid_deg[r, c] = compute_slope_horn_deg(window, spacing_m)

    traversable_grid = slope_grid_deg <= max_slope_deg

    # 2. Spatio-temporal visibility calculation
    sun_frac_cube = np.zeros((num_t, ny, nx), dtype=np.uint8)
    earth_frac_cube = np.zeros((num_t, ny, nx), dtype=np.uint8)

    # Precompute per-cell 3D positions and topocentric ENU bases
    cell_positions = []
    cell_bases = []
    for r in range(ny):
        r_pos = []
        r_bas = []
        for c in range(nx):
            c_lat = float(lat_grid[r, c])
            c_lon = float(lon_grid[r, c])
            c_elev = float(elev_dem_m[r, c])
            r_pos.append(site_position_moon_me_km(c_lat, c_lon, c_elev + 1.0 + R_MOON_M))
            r_bas.append(enu_basis(c_lat, c_lon))
        cell_positions.append(r_pos)
        cell_bases.append(r_bas)

    for t_idx, ts in enumerate(timestamps):
        et = float(utc_to_et(ts))
        sun_center_xyz, earth_center_xyz = get_sun_earth_moon_me_km(
            ts, et, frame=FRAME_MOON_ME, abcorr=ABCORR_FOR_VALIDATION
        )

        for r in range(ny):
            for c in range(nx):
                pos = cell_positions[r][c]
                basis = cell_bases[r][c]
                h_el = float(horizon_el_grid_deg[r, c]) if horizon_el_grid_deg is not None else 0.5

                # Topocentric Sun from cell
                s_az, s_el, s_range = topocentric_az_el(sun_center_xyz, pos, basis)
                s_radius_deg = math.degrees(math.atan2(R_SUN_KM, s_range))
                s_frac = compute_flat_horizon_disc_fraction(s_el - h_el, s_radius_deg)
                sun_frac_cube[t_idx, r, c] = int(round(float(s_frac) * 100))

                # Topocentric Earth from cell
                e_az, e_el, e_range = topocentric_az_el(earth_center_xyz, pos, basis)
                e_radius_deg = math.degrees(math.atan2(R_EARTH_KM, e_range))
                e_frac = compute_flat_horizon_disc_fraction(e_el - h_el, e_radius_deg)
                earth_frac_cube[t_idx, r, c] = int(round(float(e_frac) * 100))

    cube_dict = {
        "grid": {
            "origin": [round(center_lon_deg, 4), round(center_lat_deg, 4)],
            "spacing_m": spacing_m,
            "nx": nx,
            "ny": ny,
        },
        "time_utc": timestamps,
        "sun_frac": sun_frac_cube.tolist(),
        "earth_frac": earth_frac_cube.tolist(),
        "slope_deg": np.round(slope_grid_deg, 2).tolist(),
        "traversable": traversable_grid.tolist(),
        "flags": flags or ["lola_horn_slope", "topocentric_per_cell"],
    }

    return cube_dict
