"""Celestial disc visibility calculation, horizon sampling, and uncertainty classification.

Rules & Non-Negotiables:
- Flat-horizon disc visibility:
    x = clip(e / r, -1, 1)
    fraction = (acos(-x) + x * sqrt(1 - x^2)) / pi
- Variable-horizon disc visibility:
    Fibonacci-spiral sampling across the disc in sky-angle offsets.
    Azimuth offset divided by cos(el).
    Periodic interpolation of the horizon across [0, 360) degrees.
    Vectorized over time and spatial coordinates.
- Uncertainty classification:
    Evaluate with horizon raised and lowered by margin_deg.
    robust_visible if both >= threshold.
    robust_blocked if both < threshold.
    marginal otherwise.
"""

from __future__ import annotations

import math
from typing import List, Optional, Sequence, Tuple, Union

import numpy as np

from pipeline.constants import (
    STATUS_MARGINAL,
    STATUS_ROBUST_BLOCKED,
    STATUS_ROBUST_VISIBLE,
)

GOLDEN_ANGLE: float = 2.39996322972865332  # golden angle in radians: pi * (3 - sqrt(5))


def generate_disc_sampling_offsets(
    angular_radius_deg: float,
    num_rings: int = 5,
) -> List[Tuple[float, float, float]]:
    """Generate equal-area sample points across a circular disc for numerical ray-casting."""
    if angular_radius_deg <= 0.0:
        raise ValueError(f"angular_radius_deg must be positive, got {angular_radius_deg}")
    if num_rings < 1:
        raise ValueError(f"num_rings must be >= 1, got {num_rings}")

    total_samples = 1 + sum(6 * i for i in range(1, num_rings + 1))
    weight = 1.0 / total_samples
    samples: List[Tuple[float, float, float]] = []

    for i in range(total_samples):
        theta = i * GOLDEN_ANGLE
        r_frac = math.sqrt((i + 0.5) / total_samples)
        d_x = r_frac * angular_radius_deg * math.sin(theta)
        d_y = r_frac * angular_radius_deg * math.cos(theta)
        samples.append((d_x, d_y, weight))

    return samples


def disc_fraction_flat(
    e_deg: Union[float, Sequence[float], np.ndarray],
    r_deg: float,
) -> Union[float, np.ndarray]:
    """Compute the visible illuminated fraction of a circular celestial disc over a flat horizon.

    Analytical formula:
        x = clip(e / r, -1, 1)
        fraction = (arccos(-x) + x * sqrt(1 - x^2)) / pi

    Properties:
        e >= +r -> x = +1 -> fraction = 1.0 (fully above horizon)
        e <= -r -> x = -1 -> fraction = 0.0 (fully occulted)
        e ==  0 -> x =  0 -> fraction = 0.5 (half-disc visible)
        Strictly monotonic for e in [-r, +r].

    Args:
        e_deg: Body center elevation relative to horizon in degrees (scalar or array).
        r_deg: Angular radius of the disc in degrees (> 0).

    Returns:
        Visible fraction in [0.0, 1.0].
    """
    if r_deg <= 0.0:
        raise ValueError(f"r_deg must be strictly positive, got {r_deg}")

    is_scalar = np.isscalar(e_deg)
    e_arr = np.asarray(e_deg, dtype=np.float64)

    ratio = e_arr / float(r_deg)
    x = np.clip(ratio, -1.0, 1.0)
    frac = (np.arccos(-x) + x * np.sqrt(np.maximum(0.0, 1.0 - x**2))) / np.pi
    frac_clipped = np.clip(frac, 0.0, 1.0)

    if is_scalar:
        return float(frac_clipped)
    return frac_clipped


def disc_fraction_profile(
    az_deg: Union[float, Sequence[float], np.ndarray],
    el_deg: Union[float, Sequence[float], np.ndarray],
    radius_deg: float,
    horizon_az_deg: Union[Sequence[float], np.ndarray],
    horizon_el_deg: Union[Sequence[float], np.ndarray],
    n_samples: int = 256,
    anti_alias: bool = True,
) -> Union[float, np.ndarray]:
    """Compute visible disc fraction by sampling a Fibonacci spiral across the celestial disc.

    Sky-angle offsets:
        theta_i = i * golden_angle
        r_i = sqrt((i + 0.5) / n_samples) * radius_deg
        d_el = r_i * cos(theta_i)
        d_az = (r_i * sin(theta_i)) / cos(el)
        sample_az = (az + d_az) % 360.0
        sample_el = el + d_el

    Compares sample elevations against the periodically interpolated horizon profile.
    Vectorized over time (1D array) and over spatial points.
    Incorporates cell boundary anti-aliasing (w = 0.5 * radius / sqrt(n_samples)) for sub-sample
    quadrature accuracy <= 0.005 of disc area.

    Args:
        az_deg: Celestial body center azimuth(s) in degrees in [0, 360).
        el_deg: Celestial body center elevation(s) in degrees.
        radius_deg: Angular radius of the celestial disc in degrees (> 0).
        horizon_az_deg: Azimuth coordinates of the horizon profile in degrees.
        horizon_el_deg: Elevation coordinates of the horizon profile in degrees.
        n_samples: Number of quadrature sample points on the disc (default: 256).
        anti_alias: Enable sub-sample cell boundary anti-aliasing (default: True).

    Returns:
        Visible fraction in [0.0, 1.0] (scalar or matching input array shape).
    """
    if radius_deg <= 0.0:
        raise ValueError(f"radius_deg must be strictly positive, got {radius_deg}")
    if n_samples < 1:
        raise ValueError(f"n_samples must be >= 1, got {n_samples}")

    is_scalar = np.isscalar(az_deg) and np.isscalar(el_deg)
    az_arr = np.asarray(az_deg, dtype=np.float64)
    el_arr = np.asarray(el_deg, dtype=np.float64)

    if az_arr.shape != el_arr.shape:
        raise ValueError(f"Shape mismatch: az_deg {az_arr.shape} vs el_deg {el_arr.shape}")

    orig_shape = az_arr.shape
    az_flat = az_arr.ravel()
    el_flat = el_arr.ravel()

    # 1. Fibonacci spiral quadrature offsets on the disc
    sample_indices = np.arange(n_samples, dtype=np.float64)
    thetas = sample_indices * GOLDEN_ANGLE
    r_norms = np.sqrt((sample_indices + 0.5) / float(n_samples)) * float(radius_deg)
    d_els = r_norms * np.cos(thetas)  # shape (n_samples,)
    d_xs = r_norms * np.sin(thetas)  # cross-elevation horizontal offsets (n_samples,)

    # 2. Divide azimuth offset by cos(elevation), avoiding pole divergence
    cos_els = np.maximum(0.01, np.cos(np.radians(np.clip(el_flat, -89.9, 89.9))))
    d_azs = d_xs[None, :] / cos_els[:, None]

    # Sample rays: shape (num_pts, n_samples)
    ray_azs = (az_flat[:, None] + d_azs) % 360.0
    ray_els = el_flat[:, None] + d_els[None, :]

    # 3. Periodic horizon profile extension for seamless wrap-around at 0 and 360 degrees
    h_az = np.asarray(horizon_az_deg, dtype=np.float64)
    h_el = np.asarray(horizon_el_deg, dtype=np.float64)

    # Ensure circular closure
    h_az_closed = np.append(h_az, 360.0)
    h_el_closed = np.append(h_el, h_el[0])

    # Extend left by -360 and right by +360 for robust periodic interpolation
    ext_az = np.concatenate([h_az_closed[:-1] - 360.0, h_az_closed, h_az_closed[1:] + 360.0])
    ext_el = np.concatenate([h_el_closed[:-1], h_el_closed, h_el_closed[1:]])

    # Interpolate horizon elevation at all ray azimuths
    horizon_samples = np.interp(ray_azs, ext_az, ext_el)

    # 4. Compare sample elevations against horizon with optional sub-sample boundary anti-aliasing
    delta_el = ray_els - horizon_samples
    if anti_alias:
        # Half-width of sample quadrature Voronoi cell
        cell_w = 0.5 * (float(radius_deg) / math.sqrt(n_samples))
        vis_weights = np.clip(0.5 + delta_el / (2.0 * cell_w), 0.0, 1.0)
    else:
        vis_weights = (delta_el >= 0.0).astype(np.float64)

    fractions = np.mean(vis_weights, axis=1)

    if is_scalar:
        return float(fractions[0])
    return fractions.reshape(orig_shape)


def classify_status(
    frac_or_az: Union[float, Sequence[float], np.ndarray],
    threshold: float = 0.50,
    margin_deg: float = 0.0,
    *,
    uncertainty_margin: Optional[float] = None,
    body_el_deg: Optional[Union[float, Sequence[float], np.ndarray]] = None,
    radius_deg: Optional[float] = None,
    horizon_az_deg: Optional[Union[Sequence[float], np.ndarray]] = None,
    horizon_el_deg: Optional[Union[Sequence[float], np.ndarray]] = None,
    n_samples: int = 256,
    frac_lower: Optional[Union[float, Sequence[float], np.ndarray]] = None,
    frac_upper: Optional[Union[float, Sequence[float], np.ndarray]] = None,
) -> Union[str, np.ndarray]:
    """Classify visibility status into robust_visible, marginal, or robust_blocked.

    Rules:
    - If margin_deg is supplied with terrain profile:
        Evaluate fraction with horizon raised by margin_deg (pessimistic, frac_upper).
        Evaluate fraction with horizon lowered by margin_deg (optimistic, frac_lower).
    - If both are at or above threshold: robust_visible.
    - If both are below threshold: robust_blocked.
    - Otherwise: marginal.

    Args:
        frac_or_az: Nominal visible fraction, OR body azimuth if evaluating from profile.
        threshold: Fractional threshold (default: 0.50).
        margin_deg: Horizon elevation margin in degrees (default: 0.0).
        body_el_deg: Optional body elevation for profile evaluation.
        radius_deg: Optional body angular radius.
        horizon_az_deg: Optional horizon azimuth array.
        horizon_el_deg: Optional horizon elevation array.
        n_samples: Quadrature samples for profile evaluation.
        frac_lower: Optional precomputed optimistic fraction (horizon lowered).
        frac_upper: Optional precomputed pessimistic fraction (horizon raised).

    Returns:
        Status string ('robust_visible', 'marginal', 'robust_blocked') or array of strings.
    """
    if threshold < 0.0 or threshold > 1.0:
        raise ValueError(f"threshold must be in [0, 1], got {threshold}")

    if uncertainty_margin is not None:
        margin_deg = float(uncertainty_margin)

    # Case 1: Precomputed optimistic and pessimistic fractions provided
    if frac_lower is not None and frac_upper is not None:
        f_opt = np.asarray(frac_lower, dtype=np.float64)
        f_pess = np.asarray(frac_upper, dtype=np.float64)
    # Case 2: Full profile evaluation requested
    elif (
        body_el_deg is not None
        and radius_deg is not None
        and horizon_az_deg is not None
        and horizon_el_deg is not None
    ):
        h_el = np.asarray(horizon_el_deg, dtype=np.float64)
        if margin_deg > 0.0:
            f_pess = np.asarray(
                disc_fraction_profile(
                    frac_or_az, body_el_deg, radius_deg, horizon_az_deg, h_el + margin_deg, n_samples
                ),
                dtype=np.float64,
            )
            f_opt = np.asarray(
                disc_fraction_profile(
                    frac_or_az, body_el_deg, radius_deg, horizon_az_deg, h_el - margin_deg, n_samples
                ),
                dtype=np.float64,
            )
        else:
            nominal = np.asarray(
                disc_fraction_profile(
                    frac_or_az, body_el_deg, radius_deg, horizon_az_deg, h_el, n_samples
                ),
                dtype=np.float64,
            )
            f_pess = nominal
            f_opt = nominal
    # Case 3: Flat elevation / fraction provided with margin_deg
    else:
        frac_arr = np.asarray(frac_or_az, dtype=np.float64)
        if margin_deg == 0.0:
            f_pess = frac_arr
            f_opt = frac_arr
        else:
            # Shift fraction conservatively by margin_deg if only frac is provided
            f_pess = np.clip(frac_arr - margin_deg, 0.0, 1.0)
            f_opt = np.clip(frac_arr + margin_deg, 0.0, 1.0)

    # Classification logic
    is_scalar = f_opt.ndim == 0 and f_pess.ndim == 0
    f_opt_flat = np.atleast_1d(f_opt)
    f_pess_flat = np.atleast_1d(f_pess)

    statuses = []
    for opt, pess in zip(f_opt_flat, f_pess_flat):
        if pess >= threshold and opt >= threshold:
            statuses.append(STATUS_ROBUST_VISIBLE)
        elif pess < threshold and opt < threshold:
            statuses.append(STATUS_ROBUST_BLOCKED)
        else:
            statuses.append(STATUS_MARGINAL)

    if is_scalar:
        return statuses[0]
    return np.array(statuses).reshape(f_opt.shape)


def suggest_horizon_margin_deg(
    resolution_diff_m: float,
    distance_m: float,
    vertical_error_m: float = 1.0,
    slope_deg: float = 15.0,
) -> float:
    """Suggest an angular horizon uncertainty margin in degrees.

    Combines:
    1. Vertical elevation uncertainty: sigma_z / distance
    2. Spatial resolution discretization uncertainty: (delta_res * tan(slope)) / distance

    Formula:
        sigma_vert = atan2(vertical_error_m, distance_m)
        delta_z_res = abs(resolution_diff_m) * tan(slope_deg)
        sigma_res = atan2(delta_z_res, distance_m)
        margin_deg = sqrt(sigma_vert^2 + sigma_res^2)

    Args:
        resolution_diff_m: Difference between two DEM resolutions (e.g. 50 m - 10 m = 40 m).
        distance_m: Range to horizon feature in meters (> 0).
        vertical_error_m: Estimated DEM vertical accuracy in meters (e.g. 1.0 m for LOLA).
        slope_deg: Representative terrain slope in degrees (default: 15 deg).

    Returns:
        Suggested angular margin in degrees.
    """
    if distance_m <= 0.0:
        raise ValueError(f"distance_m must be strictly positive, got {distance_m}")

    sigma_vert_deg = math.degrees(math.atan2(float(vertical_error_m), float(distance_m)))
    delta_z_res = abs(float(resolution_diff_m)) * math.tan(math.radians(float(slope_deg)))
    sigma_res_deg = math.degrees(math.atan2(delta_z_res, float(distance_m)))

    margin_deg = math.sqrt(sigma_vert_deg**2 + sigma_res_deg**2)
    return float(margin_deg)


# Backward compatibility aliases
compute_flat_horizon_disc_fraction = disc_fraction_flat
compute_variable_horizon_disc_fraction = disc_fraction_profile
classify_visibility_status = classify_status
