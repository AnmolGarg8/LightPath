"""Celestial disc visibility calculation for Sun and Earth discs over lunar horizons.

Maintained for backward compatibility; delegates core math to pipeline.visibility.
"""

from __future__ import annotations

from typing import Callable, List, Tuple

import numpy as np

from pipeline.visibility import (
    classify_status,
    disc_fraction_flat,
    disc_fraction_profile,
)
from pipeline.visibility import (
    generate_disc_sampling_offsets as _gen_offsets,
)

compute_flat_horizon_disc_fraction = disc_fraction_flat


def generate_disc_sampling_offsets(
    angular_radius_deg: float,
    num_rings: int = 5,
) -> List[Tuple[float, float, float]]:
    """Legacy helper for sampling offsets."""
    if angular_radius_deg <= 0.0:
        raise ValueError(f"angular_radius_deg must be positive, got {angular_radius_deg}")
    if num_rings < 1:
        raise ValueError(f"num_rings must be >= 1, got {num_rings}")
    return _gen_offsets(angular_radius_deg, num_rings)


def compute_variable_horizon_disc_fraction(
    body_az_deg: float,
    body_el_deg: float,
    angular_radius_deg: float,
    horizon_el_fn: Callable[[float], float],
    num_samples: int = 37,
) -> float:
    """Legacy wrapper for variable horizon profile evaluation."""
    h_azs = np.arange(0.0, 360.0, 1.0)
    h_els = np.array([horizon_el_fn(az) for az in h_azs], dtype=np.float64)

    return float(
        disc_fraction_profile(
            az_deg=body_az_deg,
            el_deg=body_el_deg,
            radius_deg=angular_radius_deg,
            horizon_az_deg=h_azs,
            horizon_el_deg=h_els,
            n_samples=num_samples,
        )
    )


classify_visibility_status = classify_status
