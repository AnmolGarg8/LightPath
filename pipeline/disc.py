"""Celestial disc visibility calculation for Sun and Earth discs over lunar horizons.

Rules & Formulas:
- Flat-horizon disc visibility:
    x = clip(e / r, -1, 1)
    fraction = (acos(-x) + x * sqrt(1 - x^2)) / pi
  where e is the body center elevation above the horizon, and r is the disc angular radius.
- Variable horizon disc visibility:
    Sample the disc in sky-angle offsets, compare each with the interpolated horizon profile.
- Status values:
    robust_visible, marginal, robust_blocked.
"""

import math
from typing import Callable, List, Tuple, Union

import numpy as np

from pipeline.constants import (
    STATUS_MARGINAL,
    STATUS_ROBUST_BLOCKED,
    STATUS_ROBUST_VISIBLE,
)


def compute_flat_horizon_disc_fraction(
    elevation_above_horizon_deg: Union[float, np.ndarray],
    angular_radius_deg: float,
) -> Union[float, np.ndarray]:
    """Compute the visible illuminated fraction of a circular celestial disc over a flat horizon.

    Analytical formula:
        e: elevation of disc center above horizon
        r: disc angular radius (> 0)
        x = clip(e / r, -1, 1)
        fraction = (arccos(-x) + x * sqrt(1 - x^2)) / pi

    Properties:
        e >= +r -> x = +1 -> fraction = 1.0 (fully above horizon)
        e <= -r -> x = -1 -> fraction = 0.0 (fully occulted)
        e ==  0 -> x =  0 -> fraction = 0.5 (half disc visible)

    Args:
        elevation_above_horizon_deg: Difference between body elevation and horizon elevation in degrees.
        angular_radius_deg: Angular radius of the disc in degrees (> 0).

    Returns:
        Visible fraction in [0.0, 1.0].
    """
    if angular_radius_deg <= 0.0:
        raise ValueError(f"angular_radius_deg must be positive, got {angular_radius_deg}")

    if isinstance(elevation_above_horizon_deg, np.ndarray):
        ratio = elevation_above_horizon_deg / angular_radius_deg
        x = np.clip(ratio, -1.0, 1.0)
        frac = (np.arccos(-x) + x * np.sqrt(np.maximum(0.0, 1.0 - x**2))) / np.pi
        return np.clip(frac, 0.0, 1.0)
    else:
        ratio = elevation_above_horizon_deg / angular_radius_deg
        x = max(-1.0, min(1.0, ratio))
        frac = (math.acos(-x) + x * math.sqrt(max(0.0, 1.0 - x**2))) / math.pi
        return max(0.0, min(1.0, frac))


def generate_disc_sampling_offsets(
    angular_radius_deg: float,
    num_rings: int = 5,
) -> List[Tuple[float, float, float]]:
    """Generate equal-area sample points across a circular disc for numerical ray-casting.

    Args:
        angular_radius_deg: Disc angular radius in degrees.
        num_rings: Number of concentric rings (higher = finer quadrature).

    Returns:
        List of (d_az_deg, d_el_deg, weight) tuples where weights sum to 1.0.
    """
    if angular_radius_deg <= 0.0:
        raise ValueError(f"angular_radius_deg must be positive, got {angular_radius_deg}")
    if num_rings < 1:
        raise ValueError(f"num_rings must be >= 1, got {num_rings}")

    samples: List[Tuple[float, float, float]] = []

    # Center point
    samples.append((0.0, 0.0, 1.0 / (1.0 + 3.0 * num_rings * (num_rings + 1))))

    # Concentric rings with equal radial intervals
    total_samples = 1 + sum(6 * i for i in range(1, num_rings + 1))
    weight = 1.0 / total_samples

    # Equal area sampling using Fibonacci / concentric rings
    samples.clear()
    for i in range(total_samples):
        # Sunflower / Fibonacci spiral on unit disk
        theta = i * 2.399963229728653  # golden angle in radians
        r_frac = math.sqrt((i + 0.5) / total_samples)
        d_x = r_frac * angular_radius_deg * math.cos(theta)
        d_y = r_frac * angular_radius_deg * math.sin(theta)
        samples.append((d_x, d_y, weight))

    return samples


def compute_variable_horizon_disc_fraction(
    body_az_deg: float,
    body_el_deg: float,
    angular_radius_deg: float,
    horizon_el_fn: Callable[[float], float],
    num_samples: int = 37,
) -> float:
    """Compute disc visibility against an arbitrary terrain horizon profile.

    Samples the disc in sky-angle offsets and compares each sample's elevation
    with the terrain horizon elevation at that sample's azimuth.

    Args:
        body_az_deg: Celestial body center azimuth in degrees [0, 360).
        body_el_deg: Celestial body center elevation in degrees [-90, +90].
        angular_radius_deg: Angular radius of the disc in degrees.
        horizon_el_fn: Function mapping azimuth in degrees to terrain horizon elevation in degrees.
        num_samples: Number of sample rays across the disc (default: 37).

    Returns:
        Visible fraction in [0.0, 1.0].
    """
    if angular_radius_deg <= 0.0:
        raise ValueError(f"angular_radius_deg must be positive, got {angular_radius_deg}")

    # Fast rejection check using bounding box
    h_center = horizon_el_fn(body_az_deg % 360.0)
    if body_el_deg - angular_radius_deg > h_center + 15.0:
        # Well above horizon
        return 1.0
    if body_el_deg + angular_radius_deg < h_center - 15.0:
        # Well below horizon
        return 0.0

    # Generate Fibonacci spiral sample points on the disk
    visible_weight = 0.0
    cos_el = max(0.01, math.cos(math.radians(body_el_deg)))

    for i in range(num_samples):
        theta = i * 2.399963229728653  # golden angle
        r_frac = math.sqrt((i + 0.5) / num_samples)
        d_az_proj = (r_frac * angular_radius_deg * math.sin(theta)) / cos_el
        d_el = r_frac * angular_radius_deg * math.cos(theta)

        sample_az = (body_az_deg + d_az_proj) % 360.0
        sample_el = body_el_deg + d_el

        h_el = horizon_el_fn(sample_az)
        if sample_el >= h_el:
            visible_weight += 1.0

    return visible_weight / float(num_samples)


def classify_visibility_status(
    frac: float,
    threshold: float = 0.50,
    uncertainty_margin: float = 0.10,
) -> str:
    """Classify visibility into robust_visible, marginal, or robust_blocked.

    Args:
        frac: Visible disc fraction in [0.0, 1.0].
        threshold: Nominal operational visibility fraction threshold (e.g. 0.50).
        uncertainty_margin: Margin around threshold or boundary (e.g. 0.10).

    Returns:
        One of 'robust_visible', 'marginal', 'robust_blocked'.
    """
    if frac >= threshold + uncertainty_margin:
        return STATUS_ROBUST_VISIBLE
    elif frac <= max(0.0, threshold - uncertainty_margin) or frac <= 0.0:
        return STATUS_ROBUST_BLOCKED
    else:
        return STATUS_MARGINAL
