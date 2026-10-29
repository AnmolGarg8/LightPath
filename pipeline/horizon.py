"""Terrain horizon elevation profile computation and interpolation.

Rules:
- Exact curvature formula:
    el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
- R = 1737400.0 m (R_MOON_M).
- Horizon at an azimuth = maximum elevation angle along that great-circle path.
- Handles observer mast height sensitivity.
- Conforms to schemas/horizon.schema.json.
"""

import math
from typing import Callable, Dict, List, Optional, Sequence

import numpy as np

from pipeline.constants import R_MOON_M
from pipeline.geometry import compute_elevation_angle_deg


class HorizonProfile:
    """Manages horizon profiles across azimuths and observer mast heights."""

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

    def to_dict(self) -> Dict:
        """Export to dictionary matching schemas/horizon.schema.json."""
        return {
            "az_step_deg": self.az_step_deg,
            "heights_m": self.heights_m,
            "el_deg": self.el_deg.tolist(),
            "nan_fraction": self.nan_fraction.tolist(),
            "flags": self.flags,
        }

    def get_elevation_deg(self, az_deg: float, height_m: float = 0.0) -> float:
        """Get interpolated horizon elevation in degrees at a specific azimuth and mast height.

        Args:
            az_deg: Azimuth in degrees [0, 360).
            height_m: Observer mast height above ground in meters.

        Returns:
            Horizon elevation in degrees.
        """
        # Normalize azimuth
        az_norm = (az_deg % 360.0) / self.az_step_deg
        idx_low = int(math.floor(az_norm)) % self.num_az
        idx_high = (idx_low + 1) % self.num_az
        frac_az = az_norm - math.floor(az_norm)

        # Height interpolation
        if height_m <= self.heights_m[0]:
            h_idx_low, h_idx_high = 0, 0
            frac_h = 0.0
        elif height_m >= self.heights_m[-1]:
            h_idx_low = len(self.heights_m) - 1
            h_idx_high = h_idx_low
            frac_h = 0.0
        else:
            # Linear interpolation between heights
            h_idx_low = 0
            while h_idx_low < len(self.heights_m) - 1 and self.heights_m[h_idx_low + 1] <= height_m:
                h_idx_low += 1
            h_idx_high = h_idx_low + 1
            h_range = self.heights_m[h_idx_high] - self.heights_m[h_idx_low]
            frac_h = (height_m - self.heights_m[h_idx_low]) / h_range if h_range > 0 else 0.0

        # Bilinear interpolation
        el_low_az = (1.0 - frac_az) * self.el_deg[h_idx_low, idx_low] + frac_az * self.el_deg[h_idx_low, idx_high]
        el_high_az = (1.0 - frac_az) * self.el_deg[h_idx_high, idx_low] + frac_az * self.el_deg[h_idx_high, idx_high]

        return float((1.0 - frac_h) * el_low_az + frac_h * el_high_az)


def compute_synthetic_horizon_profile(
    az_step_deg: float = 1.0,
    heights_m: Sequence[float] = (0.0, 2.0, 5.0, 10.0),
    base_elev_m: float = 0.0,
    features: Optional[List[Dict]] = None,
) -> HorizonProfile:
    """Generate a deterministic synthetic horizon profile for testing or synthetic site planning.

    Marks output with 'is_synthetic' flag in compliance with Rule 3.

    Args:
        az_step_deg: Azimuth step in degrees (e.g. 1.0 deg -> 360 bins).
        heights_m: Observer mast heights in meters.
        base_elev_m: Site ground elevation in meters.
        features: Optional list of terrain features, e.g.
            [{'az_center_deg': 45.0, 'width_deg': 20.0, 'height_deg': 2.5}]

    Returns:
        HorizonProfile instance.
    """
    num_az = int(round(360.0 / az_step_deg))
    num_h = len(heights_m)

    el_grid = np.zeros((num_h, num_az), dtype=np.float64)
    nan_grid = np.zeros((num_h, num_az), dtype=np.float64)

    az_coords = np.arange(num_az) * az_step_deg

    # Base lunar limb drop: for a flat sphere at R_MOON_M, observer at height h sees horizon at:
    # el = -acos(R / (R + h))
    for h_idx, h in enumerate(heights_m):
        theta_limb = math.acos(R_MOON_M / (R_MOON_M + base_elev_m + h)) if (base_elev_m + h) > 0 else 0.0
        limb_dip_deg = -math.degrees(theta_limb)

        # Baseline horizon with gentle undulating hills (0.5 deg to 1.5 deg typical lunar crater rim profile)
        base_profile = limb_dip_deg + 0.8 + 0.5 * np.sin(np.radians(az_coords * 2.0)) + 0.3 * np.cos(np.radians(az_coords * 3.0))

        # Add explicit topographic features (crater rims / massifs)
        if features:
            for feat in features:
                c_az = feat["az_center_deg"]
                w_az = feat.get("width_deg", 15.0)
                peak_el = feat["height_deg"]
                d_az = np.abs((az_coords - c_az + 180.0) % 360.0 - 180.0)
                bump = peak_el * np.exp(-0.5 * (d_az / (w_az / 2.355))**2)
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
    """Compute horizon elevation profile from terrain elevation samples along radial rays.

    Uses exact curvature formula:
        el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))

    Args:
        site_lat_deg: Site latitude in degrees.
        site_lon_deg: Site longitude in degrees.
        dem_sample_fn: Callable(lat_deg, lon_deg) returning elevation in meters (or np.nan if nodata).
        az_step_deg: Azimuth resolution in degrees.
        heights_m: Sequence of observer heights in meters.
        max_dist_m: Maximum horizon search distance along great-circle in meters (default 100 km).
        dist_step_m: Step distance along each ray in meters.
        site_ground_elev_m: Site ground elevation in meters (if None, sampled at site).

    Returns:
        HorizonProfile instance.
    """
    if site_ground_elev_m is None:
        site_ground_elev_m = dem_sample_fn(site_lat_deg, site_lon_deg)
        if math.isnan(site_ground_elev_m):
            site_ground_elev_m = 0.0

    num_az = int(round(360.0 / az_step_deg))
    num_h = len(heights_m)
    distances = np.arange(dist_step_m, max_dist_m + dist_step_m, dist_step_m)
    num_steps = len(distances)

    el_grid = np.zeros((num_h, num_az), dtype=np.float64)
    nan_grid = np.zeros((num_h, num_az), dtype=np.float64)

    phi1 = math.radians(site_lat_deg)
    lam1 = math.radians(site_lon_deg)

    for az_idx in range(num_az):
        az_deg = az_idx * az_step_deg
        az_rad = math.radians(az_deg)

        # Great circle ray points:
        # phi2 = asin(sin(phi1)*cos(d/R) + cos(phi1)*sin(d/R)*cos(az))
        # lam2 = lam1 + atan2(sin(az)*sin(d/R)*cos(phi1), cos(d/R) - sin(phi1)*sin(phi2))
        thetas = distances / R_MOON_M
        sin_thetas = np.sin(thetas)
        cos_thetas = np.cos(thetas)

        sin_phi2 = math.sin(phi1) * cos_thetas + math.cos(phi1) * sin_thetas * math.cos(az_rad)
        sin_phi2 = np.clip(sin_phi2, -1.0, 1.0)
        phi2 = np.arcsin(sin_phi2)

        y_lam = math.sin(az_rad) * sin_thetas * math.cos(phi1)
        x_lam = cos_thetas - math.sin(phi1) * sin_phi2
        lam2 = lam1 + np.arctan2(y_lam, x_lam)

        lats_deg = np.degrees(phi2)
        lons_deg = np.degrees(lam2)

        # Sample DEM
        elevs = np.zeros(num_steps, dtype=np.float64)
        nan_count = 0
        for s in range(num_steps):
            z_val = dem_sample_fn(float(lats_deg[s]), float(lons_deg[s]))
            if math.isnan(z_val):
                nan_count += 1
                elevs[s] = site_ground_elev_m  # Safe fallback for ray evaluation
            else:
                elevs[s] = z_val

        nan_fraction = nan_count / float(num_steps)

        # Compute horizon for each mast height
        for h_idx, h in enumerate(heights_m):
            ray_elevations = compute_elevation_angle_deg(
                dist_m=distances,
                elev_m=elevs,
                observer_height_m=h,
                site_ground_elev_m=site_ground_elev_m,
            )
            max_el = float(np.max(ray_elevations))
            el_grid[h_idx, az_idx] = max_el
            nan_grid[h_idx, az_idx] = nan_fraction

    return HorizonProfile(
        az_step_deg=az_step_deg,
        heights_m=heights_m,
        el_deg=el_grid,
        nan_fraction=nan_grid,
        flags=["dem_radial_raycast"],
    )
