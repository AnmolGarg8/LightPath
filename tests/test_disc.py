"""Unit tests for pipeline.disc module."""

import math

import numpy as np
import pytest

from pipeline.constants import (
    STATUS_MARGINAL,
    STATUS_ROBUST_BLOCKED,
    STATUS_ROBUST_VISIBLE,
)
from pipeline.disc import (
    classify_visibility_status,
    compute_flat_horizon_disc_fraction,
    compute_variable_horizon_disc_fraction,
    generate_disc_sampling_offsets,
)


def test_flat_horizon_disc_fraction_exact_values():
    r = 0.26  # Solar angular radius approx 0.26 deg

    # Fully above horizon
    assert math.isclose(compute_flat_horizon_disc_fraction(r * 1.5, r), 1.0, abs_tol=1e-9)
    assert math.isclose(compute_flat_horizon_disc_fraction(r, r), 1.0, abs_tol=1e-9)

    # Fully below horizon
    assert math.isclose(compute_flat_horizon_disc_fraction(-r * 1.5, r), 0.0, abs_tol=1e-9)
    assert math.isclose(compute_flat_horizon_disc_fraction(-r, r), 0.0, abs_tol=1e-9)

    # Exactly half visible when center is at horizon
    assert math.isclose(compute_flat_horizon_disc_fraction(0.0, r), 0.5, abs_tol=1e-9)


def test_flat_horizon_disc_fraction_symmetry():
    # Mathematical identity: f(e) + f(-e) == 1.0 for all e in [-r, r]
    r = 0.5
    for frac_val in np.linspace(-1.0, 1.0, 21):
        e = frac_val * r
        f_pos = compute_flat_horizon_disc_fraction(e, r)
        f_neg = compute_flat_horizon_disc_fraction(-e, r)
        assert math.isclose(f_pos + f_neg, 1.0, abs_tol=1e-9)


def test_flat_horizon_disc_fraction_monotonicity():
    r = 0.3
    e_vals = np.linspace(-r, r, 50)
    fracs = [compute_flat_horizon_disc_fraction(e, r) for e in e_vals]
    for i in range(len(fracs) - 1):
        assert fracs[i] <= fracs[i + 1]


def test_flat_horizon_vectorized():
    r = 0.25
    e_arr = np.array([-0.3, -0.25, 0.0, 0.25, 0.3])
    res = compute_flat_horizon_disc_fraction(e_arr, r)
    expected = [0.0, 0.0, 0.5, 1.0, 1.0]
    for i in range(5):
        assert math.isclose(res[i], expected[i], abs_tol=1e-7)


def test_invalid_radius():
    with pytest.raises(ValueError):
        compute_flat_horizon_disc_fraction(0.0, -0.1)
    with pytest.raises(ValueError):
        compute_flat_horizon_disc_fraction(0.0, 0.0)


def test_sampling_offsets():
    r = 0.5
    offsets = generate_disc_sampling_offsets(r, num_rings=4)
    # Total weight should equal 1.0
    total_w = sum(w for _, _, w in offsets)
    assert math.isclose(total_w, 1.0, abs_tol=1e-9)
    # All samples within radius
    for dx, dy, _ in offsets:
        assert math.hypot(dx, dy) <= r + 1e-9


def test_variable_horizon_flat_profile_match():
    # Constant horizon at 2.0 degrees
    horizon_el = 2.0

    def horiz_fn(_az: float) -> float:
        return horizon_el

    r = 0.26
    # Body center at 2.0 deg -> flat horizon fraction = 0.5
    frac_sampled = compute_variable_horizon_disc_fraction(
        body_az_deg=90.0,
        body_el_deg=2.0,
        angular_radius_deg=r,
        horizon_el_fn=horiz_fn,
        num_samples=91,
    )
    # Sampling approximation should be very close to 0.5
    assert abs(frac_sampled - 0.5) < 0.05

    # Well above
    frac_high = compute_variable_horizon_disc_fraction(
        body_az_deg=90.0,
        body_el_deg=5.0,
        angular_radius_deg=r,
        horizon_el_fn=horiz_fn,
    )
    assert frac_high == 1.0

    # Well below
    frac_low = compute_variable_horizon_disc_fraction(
        body_az_deg=90.0,
        body_el_deg=-1.0,
        angular_radius_deg=r,
        horizon_el_fn=horiz_fn,
    )
    assert frac_low == 0.0


def test_classify_visibility_status():
    assert classify_visibility_status(1.0, threshold=0.5, uncertainty_margin=0.1) == STATUS_ROBUST_VISIBLE
    assert classify_visibility_status(0.65, threshold=0.5, uncertainty_margin=0.1) == STATUS_ROBUST_VISIBLE
    assert classify_visibility_status(0.55, threshold=0.5, uncertainty_margin=0.1) == STATUS_MARGINAL
    assert classify_visibility_status(0.45, threshold=0.5, uncertainty_margin=0.1) == STATUS_MARGINAL
    assert classify_visibility_status(0.35, threshold=0.5, uncertainty_margin=0.1) == STATUS_ROBUST_BLOCKED
    assert classify_visibility_status(0.0, threshold=0.5, uncertainty_margin=0.1) == STATUS_ROBUST_BLOCKED
