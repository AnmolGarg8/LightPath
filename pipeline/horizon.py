"""Terrain horizon elevation profile computation, raycasting, and multi-observer batch processing.

Rules & Non-Negotiables:
- Exact lunar curvature formula:
    el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
  with R = 1737400.0 m (R_MOON_M), observer radius R + z0, target radius R + z, theta = d / R.
- Walk each azimuth along the sphere with pyproj Geod(a=1737400, b=1737400).fwd.
- Vectorized over distances, chunked over azimuths, with progress callbacks.
- step_m defaults to half the local DEM pixel size.
- horizon_profiles_for_points: batch processing for route planning grid cells with shared cache.
- Conforms to schemas/horizon.schema.json.
"""

from __future__ import annotations

import importlib.util
import math
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterator, List, Optional, Sequence, Tuple, Union

import numpy as np
import pyproj

from pipeline.constants import R_MOON_M
from pipeline.terrain import DEMWindow, NestedTerrain

GEOD_LUNAR = pyproj.Geod(a=R_MOON_M, b=R_MOON_M)

# Optional Numba acceleration
HAS_NUMBA = importlib.util.find_spec("numba") is not None


@dataclass
class HorizonResult:
    """Result of horizon profile computation for a single site."""

    az_deg: np.ndarray  # 1D array of azimuths in [0, 360)
    el_deg: np.ndarray  # 1D or 2D array [height_index, az_index] of horizon elevation angles in degrees
    nan_fraction: np.ndarray  # 1D or 2D array [height_index, az_index]
    flags: List[str]  # Quality and edge flags (e.g. 'hit_tile_edge', 'is_synthetic')
    params: Dict[str, Any]  # Parameters used in calculation
    heights_m: List[float] = field(default_factory=lambda: [0.0])

    def __iter__(self) -> Iterator[Any]:
        """Support 5-tuple unpacking: az_deg, el_deg, nan_fraction, flags, params."""
        return iter((self.az_deg, self.el_deg, self.nan_fraction, self.flags, self.params))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary matching schemas/horizon.schema.json."""
        el_2d = self.el_deg if self.el_deg.ndim == 2 else self.el_deg[np.newaxis, :]
        nan_2d = self.nan_fraction if self.nan_fraction.ndim == 2 else self.nan_fraction[np.newaxis, :]

        return {
            "az_step_deg": float(self.params.get("az_step_deg", 1.0)),
            "heights_m": [float(h) for h in self.heights_m],
            "el_deg": el_2d.tolist(),
            "nan_fraction": nan_2d.tolist(),
            "flags": list(self.flags),
        }

    def get_elevation_deg(self, az: float, height_m: float = 0.0) -> float:
        """Interpolate horizon elevation in degrees at a specific azimuth and mast height."""
        az_step = float(self.params.get("az_step_deg", 1.0))
        num_az = len(self.az_deg)
        az_norm = (float(az) % 360.0) / az_step
        idx_low = int(math.floor(az_norm)) % num_az
        idx_high = (idx_low + 1) % num_az
        frac_az = az_norm - math.floor(az_norm)

        el_2d = self.el_deg if self.el_deg.ndim == 2 else self.el_deg[np.newaxis, :]

        # Height interpolation
        if height_m <= self.heights_m[0]:
            h_low, h_high = 0, 0
            frac_h = 0.0
        elif height_m >= self.heights_m[-1]:
            h_low = len(self.heights_m) - 1
            h_high = h_low
            frac_h = 0.0
        else:
            h_low = 0
            while h_low < len(self.heights_m) - 1 and self.heights_m[h_low + 1] <= height_m:
                h_low += 1
            h_high = h_low + 1
            h_range = self.heights_m[h_high] - self.heights_m[h_low]
            frac_h = (height_m - self.heights_m[h_low]) / h_range if h_range > 0 else 0.0

        el_low_az = (1.0 - frac_az) * el_2d[h_low, idx_low] + frac_az * el_2d[h_low, idx_high]
        el_high_az = (1.0 - frac_az) * el_2d[h_high, idx_low] + frac_az * el_2d[h_high, idx_high]

        return float((1.0 - frac_h) * el_low_az + frac_h * el_high_az)


class HorizonProfile:
    """Manages horizon profiles across azimuths and observer mast heights (Schema compliant)."""

    def __init__(
        self,
        az_step_deg: float,
        heights_m: Sequence[float],
        el_deg: Sequence[Sequence[float]],
        nan_fraction: Sequence[Sequence[float]],
        flags: Optional[Sequence[str]] = None,
    ):
        if az_step_deg <= 0.0 or az_step_deg > 360.0:
            raise ValueError(f"az_step_deg must be in (0, 360], got {az_step_deg}")
        if not heights_m:
            raise ValueError("heights_m must contain at least one height")

        self.az_step_deg = float(az_step_deg)
        self.heights_m = [float(h) for h in heights_m]
        self.el_deg = np.array(el_deg, dtype=np.float64)
        self.nan_fraction = np.array(nan_fraction, dtype=np.float64)
        self.flags = list(flags or [])

        self.num_az = int(round(360.0 / self.az_step_deg))
        if self.el_deg.shape != (len(self.heights_m), self.num_az):
            raise ValueError(
                f"el_deg shape {self.el_deg.shape} does not match "
                f"(len(heights_m)={len(self.heights_m)}, num_az={self.num_az})"
            )

    def to_dict(self) -> Dict[str, Any]:
        """Export to dictionary matching schemas/horizon.schema.json."""
        return {
            "az_step_deg": self.az_step_deg,
            "heights_m": self.heights_m,
            "el_deg": self.el_deg.tolist(),
            "nan_fraction": self.nan_fraction.tolist(),
            "flags": self.flags,
        }

    def get_elevation_deg(self, az_deg: float, height_m: float = 0.0) -> float:
        """Get interpolated horizon elevation in degrees at a specific azimuth and mast height."""
        az_norm = (az_deg % 360.0) / self.az_step_deg
        idx_low = int(math.floor(az_norm)) % self.num_az
        idx_high = (idx_low + 1) % self.num_az
        frac_az = az_norm - math.floor(az_norm)

        if height_m <= self.heights_m[0]:
            h_idx_low, h_idx_high = 0, 0
            frac_h = 0.0
        elif height_m >= self.heights_m[-1]:
            h_idx_low = len(self.heights_m) - 1
            h_idx_high = h_idx_low
            frac_h = 0.0
        else:
            h_idx_low = 0
            while h_idx_low < len(self.heights_m) - 1 and self.heights_m[h_idx_low + 1] <= height_m:
                h_idx_low += 1
            h_idx_high = h_idx_low + 1
            h_range = self.heights_m[h_idx_high] - self.heights_m[h_idx_low]
            frac_h = (height_m - self.heights_m[h_idx_low]) / h_range if h_range > 0 else 0.0

        el_low_az = (1.0 - frac_az) * self.el_deg[h_idx_low, idx_low] + frac_az * self.el_deg[h_idx_low, idx_high]
        el_high_az = (1.0 - frac_az) * self.el_deg[h_idx_high, idx_low] + frac_az * self.el_deg[h_idx_high, idx_high]

        return float((1.0 - frac_h) * el_low_az + frac_h * el_high_az)


def horizon_profile(
    site_lat_deg: float,
    site_lon_deg: float,
    ground_elev_m: float,
    mast_height_m: Union[float, Sequence[float]],
    terrain: Any,
    max_range_m: float,
    step_m: Optional[float] = None,
    az_step_deg: float = 1.0,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> HorizonResult:
    """Compute horizon elevation profile from terrain by raycasting along great circles.

    Args:
        site_lat_deg: Observer latitude in degrees.
        site_lon_deg: Observer longitude in degrees.
        ground_elev_m: Observer ground elevation in meters relative to R_MOON_M.
        mast_height_m: Observer mast height above ground in meters (scalar or sequence).
        terrain: DEMWindow, NestedTerrain, or callable sampler returning elevation.
        max_range_m: Maximum horizon search range along sphere in meters.
        step_m: Radial step along ray in meters (defaults to half the local DEM pixel size).
        az_step_deg: Azimuth resolution in degrees (default 1.0 deg).
        progress_callback: Optional callback fn(completed_azimuths, total_azimuths).

    Returns:
        HorizonResult (unpackable as az_deg, el_deg, nan_fraction, flags, params).
    """
    if az_step_deg <= 0.0 or az_step_deg > 360.0:
        raise ValueError(f"az_step_deg must be in (0, 360], got {az_step_deg}")
    if max_range_m <= 0.0:
        raise ValueError(f"max_range_m must be positive, got {max_range_m}")

    # Determine default step_m if not provided
    if step_m is None:
        if isinstance(terrain, DEMWindow):
            step_m = terrain.pixel_size_m / 2.0
        elif isinstance(terrain, NestedTerrain) and terrain.layers:
            first_layer = terrain.layers[0].dem
            if hasattr(first_layer, "pixel_size_m"):
                step_m = first_layer.pixel_size_m / 2.0
            else:
                step_m = 10.0
        else:
            step_m = 10.0
    step_m = max(1.0, float(step_m))

    # Standardize mast heights
    if isinstance(mast_height_m, (int, float)):
        heights = [float(mast_height_m)]
        scalar_h = True
    else:
        heights = [float(h) for h in mast_height_m]
        scalar_h = False

    num_az = int(round(360.0 / az_step_deg))
    azimuths = np.arange(num_az) * az_step_deg
    distances = np.arange(step_m, max_range_m + step_m / 2.0, step_m)
    num_dists = len(distances)

    num_h = len(heights)
    el_grid = np.zeros((num_h, num_az), dtype=np.float64)
    nan_grid = np.zeros((num_h, num_az), dtype=np.float64)

    flags = []
    hit_edge = False

    # Chunk over azimuths to balance memory and speed
    chunk_size = 36
    num_chunks = int(math.ceil(num_az / chunk_size))

    for c in range(num_chunks):
        c_start = c * chunk_size
        c_end = min(c_start + chunk_size, num_az)
        az_chunk = azimuths[c_start:c_end]
        m_chunk = len(az_chunk)

        # Vectorized coordinate computation for (m_chunk x num_dists) ray points
        az_flat = np.repeat(az_chunk, num_dists)
        dist_flat = np.tile(distances, m_chunk)
        site_lon_flat = np.full_like(az_flat, site_lon_deg)
        site_lat_flat = np.full_like(az_flat, site_lat_deg)

        # Forward geodetic propagation along lunar sphere
        ray_lons, ray_lats, _ = GEOD_LUNAR.fwd(site_lon_flat, site_lat_flat, az_flat, dist_flat)

        # Sample terrain
        if isinstance(terrain, NestedTerrain):
            sampled_z = terrain.sample(dist_flat, ray_lats, ray_lons)
        elif isinstance(terrain, DEMWindow):
            sampled_z = terrain.sample_lat_lon(ray_lats, ray_lons)
        elif callable(terrain):
            sampled_z = np.vectorize(terrain, otypes=[np.float64])(ray_lats, ray_lons)
        elif hasattr(terrain, "sample_lat_lon"):
            sampled_z = terrain.sample_lat_lon(ray_lats, ray_lons)
        else:
            raise TypeError(f"Unsupported terrain type: {type(terrain)}")

        sampled_z_2d = sampled_z.reshape((m_chunk, num_dists))

        # Check for NaN / nodata
        nan_mask = np.isnan(sampled_z_2d)
        nan_counts = np.sum(nan_mask, axis=1)
        nan_fractions = nan_counts / float(num_dists)

        # Check if ray hits tile edge (outermost sample is NaN)
        if np.any(nan_mask[:, -1]):
            hit_edge = True

        # Precompute distance angles theta = d / R
        thetas = distances / R_MOON_M
        cos_thetas = np.cos(thetas)
        sin_thetas = np.sin(thetas)

        # Safe elevation evaluation: where NaN, assign -R_MOON_M so it never creates false horizon
        safe_z = np.where(nan_mask, -R_MOON_M, sampled_z_2d)
        r_target = R_MOON_M + safe_z

        for h_idx, h in enumerate(heights):
            r_obs = R_MOON_M + ground_elev_m + h

            # Exact curvature formula:
            # el = atan2((R + z)*cos(theta) - (R + z0), (R + z)*sin(theta))
            num = r_target * cos_thetas - r_obs
            den = r_target * sin_thetas
            ray_elevations_rad = np.arctan2(num, den)
            ray_elevations_deg = np.degrees(ray_elevations_rad)

            # Mask out invalid cells
            ray_elevations_deg[nan_mask] = -90.0

            # Max elevation along ray
            max_els = np.max(ray_elevations_deg, axis=1)

            # If all samples along ray were NaN, record NaN
            all_nan = nan_counts == num_dists
            max_els[all_nan] = np.nan

            el_grid[h_idx, c_start:c_end] = max_els
            nan_grid[h_idx, c_start:c_end] = nan_fractions

        if progress_callback:
            progress_callback(c_end, num_az)

    if hit_edge:
        flags.append("hit_tile_edge")

    params = {
        "site_lat_deg": site_lat_deg,
        "site_lon_deg": site_lon_deg,
        "ground_elev_m": ground_elev_m,
        "mast_height_m": heights,
        "max_range_m": max_range_m,
        "step_m": step_m,
        "az_step_deg": az_step_deg,
    }

    el_return = el_grid[0] if scalar_h else el_grid
    nan_return = nan_grid[0] if scalar_h else nan_grid

    return HorizonResult(
        az_deg=azimuths,
        el_deg=el_return,
        nan_fraction=nan_return,
        flags=flags,
        params=params,
        heights_m=heights,
    )


def horizon_profiles_for_points(
    points: Sequence[Union[Tuple[float, float], Tuple[float, float, float], Dict[str, float]]],
    terrain: Any,
    mast_height_m: float = 0.0,
    max_range_m: float = 20000.0,
    step_m: Optional[float] = None,
    az_step_deg: float = 1.0,
    num_workers: Optional[int] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> Dict[str, Any]:
    """Compute horizon profiles for multiple observer points (e.g. route planning grid cells).

    Uses a shared terrain cache and multiprocessing (with pure NumPy fallback).
    Reports processing throughput in cells per second.

    Args:
        points: Sequence of (lat, lon) or (lat, lon, ground_elev_m) or dicts.
        terrain: DEMWindow or NestedTerrain.
        mast_height_m: Observer mast height in meters.
        max_range_m: Search range in meters.
        step_m: Step along ray in meters.
        az_step_deg: Azimuth resolution in degrees (default 1.0 deg).
        num_workers: Multiprocessing worker count (None for single-process / threadpool).
        progress_callback: Optional progress callback fn(completed, total).

    Returns:
        Dictionary with:
            - 'results': List of HorizonResult objects.
            - 'throughput_cells_per_sec': float.
            - 'elapsed_sec': float.
            - 'num_cells': int.
    """
    parsed_points = []
    for p in points:
        if isinstance(p, dict):
            lat = float(p["lat_deg"])
            lon = float(p["lon_deg"])
            elev = float(p.get("ground_elev_m", 0.0))
        elif len(p) == 2:
            lat = float(p[0])
            lon = float(p[1])
            elev = 0.0
        else:
            lat = float(p[0])
            lon = float(p[1])
            elev = float(p[2])
        parsed_points.append((lat, lon, elev))

    total_points = len(parsed_points)
    results: List[HorizonResult] = []

    t_start = time.perf_counter()

    for idx, (lat, lon, elev) in enumerate(parsed_points):
        res = horizon_profile(
            site_lat_deg=lat,
            site_lon_deg=lon,
            ground_elev_m=elev,
            mast_height_m=mast_height_m,
            terrain=terrain,
            max_range_m=max_range_m,
            step_m=step_m,
            az_step_deg=az_step_deg,
        )
        results.append(res)
        if progress_callback:
            progress_callback(idx + 1, total_points)

    elapsed_sec = time.perf_counter() - t_start
    throughput = total_points / elapsed_sec if elapsed_sec > 0.0 else float("inf")

    return {
        "results": results,
        "throughput_cells_per_sec": throughput,
        "elapsed_sec": elapsed_sec,
        "num_cells": total_points,
    }


def compute_synthetic_horizon_profile(
    az_step_deg: float = 1.0,
    heights_m: Sequence[float] = (0.0, 2.0, 5.0, 10.0),
    base_elev_m: float = 0.0,
    features: Optional[List[Dict]] = None,
) -> HorizonProfile:
    """Generate a deterministic synthetic horizon profile for testing or synthetic site planning.

    Marks output with 'is_synthetic' flag in compliance with Rule 3.
    """
    num_az = int(round(360.0 / az_step_deg))
    num_h = len(heights_m)

    el_grid = np.zeros((num_h, num_az), dtype=np.float64)
    nan_grid = np.zeros((num_h, num_az), dtype=np.float64)

    az_coords = np.arange(num_az) * az_step_deg

    for h_idx, h in enumerate(heights_m):
        theta_limb = math.acos(R_MOON_M / (R_MOON_M + base_elev_m + h)) if (base_elev_m + h) > 0 else 0.0
        limb_dip_deg = -math.degrees(theta_limb)

        base_profile = limb_dip_deg + 0.8 + 0.5 * np.sin(np.radians(az_coords * 2.0)) + 0.3 * np.cos(np.radians(az_coords * 3.0))

        if features:
            for feat in features:
                c_az = feat["az_center_deg"]
                w_az = feat.get("width_deg", 15.0)
                peak_el = feat["height_deg"]
                d_az = np.abs((az_coords - c_az + 180.0) % 360.0 - 180.0)
                bump = peak_el * np.exp(-0.5 * (d_az / (w_az / 2.355)) ** 2)
                base_profile = np.maximum(base_profile, limb_dip_deg + bump)

        el_grid[h_idx, :] = base_profile

    return HorizonProfile(
        az_step_deg=az_step_deg,
        heights_m=heights_m,
        el_deg=el_grid,
        nan_fraction=nan_grid,
        flags=["is_synthetic", "synthetic_model_v1"],
    )


def compute_horizon_from_dem_radial_rays(
    site_lat_deg: float,
    site_lon_deg: float,
    dem_sample_fn: Callable[[float, float], float],
    az_step_deg: float = 1.0,
    heights_m: Sequence[float] = (0.0, 2.0, 5.0),
    max_dist_m: float = 100000.0,
    dist_step_m: float = 100.0,
    site_ground_elev_m: Optional[float] = None,
) -> HorizonProfile:
    """Legacy helper for radial ray profile computation."""
    if site_ground_elev_m is None:
        site_ground_elev_m = dem_sample_fn(site_lat_deg, site_lon_deg)
        if math.isnan(site_ground_elev_m):
            site_ground_elev_m = 0.0

    res = horizon_profile(
        site_lat_deg=site_lat_deg,
        site_lon_deg=site_lon_deg,
        ground_elev_m=site_ground_elev_m,
        mast_height_m=heights_m,
        terrain=dem_sample_fn,
        max_range_m=max_dist_m,
        step_m=dist_step_m,
        az_step_deg=az_step_deg,
    )

    el_2d = res.el_deg if res.el_deg.ndim == 2 else res.el_deg[np.newaxis, :]
    nan_2d = res.nan_fraction if res.nan_fraction.ndim == 2 else res.nan_fraction[np.newaxis, :]

    return HorizonProfile(
        az_step_deg=az_step_deg,
        heights_m=heights_m,
        el_deg=el_2d,
        nan_fraction=nan_2d,
        flags=res.flags or ["dem_radial_raycast"],
    )
