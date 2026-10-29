"""Unit and analytical tests for pipeline.visibility module."""

import math

import numpy as np
import pytest

from pipeline.constants import (
    STATUS_MARGINAL,
    STATUS_ROBUST_BLOCKED,
    STATUS_ROBUST_VISIBLE,
)
from pipeline.visibility import (
    classify_status,
    disc_fraction_flat,
    disc_fraction_profile,
    suggest_horizon_margin_deg,
)


def test_disc_fraction_flat_boundary_values():
    """Flat formula boundary conditions:

    x = clip(e / r, -1, 1)
    - x =  0 (e =  0) -> 0.5 (half disc visible)
    - x = +1 (e >= r) -> 1.0 (fully above horizon)
    - x = -1 (e <= -r) -> 0.0 (fully occulted)
    """
    r_sun = 0.267  # Solar radius in degrees
    r_earth = 0.950  # Earth radius in degrees

    for r in [r_sun, r_earth]:
        # Center at horizon -> exactly 0.5
        assert math.isclose(disc_fraction_flat(0.0, r), 0.5, abs_tol=1e-12)

        # Grazing upper / fully visible -> 1.0
        assert math.isclose(disc_fraction_flat(r, r), 1.0, abs_tol=1e-12)
        assert math.isclose(disc_fraction_flat(2.0 * r, r), 1.0, abs_tol=1e-12)

        # Grazing lower / fully occulted -> 0.0
        assert math.isclose(disc_fraction_flat(-r, r), 0.0, abs_tol=1e-12)
        assert math.isclose(disc_fraction_flat(-2.0 * r, r), 0.0, abs_tol=1e-12)


def test_disc_fraction_flat_monotonicity_and_symmetry():
    r = 0.4
    e_vals = np.linspace(-r, r, 100)
    fracs = disc_fraction_flat(e_vals, r)

    # Monotonicity: f(e_1) <= f(e_2)
    assert np.all(np.diff(fracs) >= 0.0)

    # Symmetry identity: f(e) + f(-e) == 1.0
    for e in np.linspace(0.0, r, 20):
        f_pos = disc_fraction_flat(e, r)
        f_neg = disc_fraction_flat(-e, r)
        assert math.isclose(f_pos + f_neg, 1.0, abs_tol=1e-12)


def test_disc_fraction_flat_invalid_radius():
    with pytest.raises(ValueError):
        disc_fraction_flat(0.0, 0.0)
    with pytest.raises(ValueError):
        disc_fraction_flat(0.0, -0.5)


def test_sampling_equals_flat_formula_sun_and_earth():
    """Sampling equals the flat formula for a flat horizon within 0.5 percent (0.005)

    of disc area, for Sun-size and Earth-size radii across a range of relative elevations.
    """
    h_az = np.arange(0, 360, 2.0)
    h_el = np.full_like(h_az, 1.5)  # Flat horizon at 1.5 deg elevation

    test_radii = [0.267, 0.950]  # Sun-size and Earth-size
    test_ratios = [-1.5, -0.8, -0.4, -0.1, 0.0, 0.1, 0.4, 0.8, 1.5]

    for r in test_radii:
        for ratio in test_ratios:
            e = ratio * r
            body_el = 1.5 + e
            analytic = float(disc_fraction_flat(e, r))
            sampled = float(disc_fraction_profile(45.0, body_el, r, h_az, h_el, n_samples=256))
            diff = abs(sampled - analytic)
            assert diff <= 0.005, f"Diff {diff} > 0.005 for r={r}, ratio={ratio}"


def test_tilted_horizon_matches_analytic_fraction():
    """A linear tilted horizon cuts a circular disc like a straight knife-edge line.

    The perpendicular distance from the center to the line gives the exact analytic fraction.
    """
    h_az = np.arange(0, 360, 0.5)
    slope_m = 0.05
    center_az = 60.0
    center_el = 2.0

    # Tilted line: H(az) = center_el + slope_m * (az - center_az)
    h_el = center_el + slope_m * (h_az - center_az)
    r = 0.267

    # Center exactly on line -> exactly 0.5
    frac_center = disc_fraction_profile(center_az, center_el, r, h_az, h_el, n_samples=512)
    assert abs(frac_center - 0.5) <= 0.005

    # Center offset perpendicular to slope
    for e in [-0.2, -0.1, 0.0, 0.1, 0.2]:
        e_perp = e / math.sqrt(1.0 + slope_m**2)
        analytic = float(disc_fraction_flat(e_perp, r))
        sampled = float(disc_fraction_profile(center_az, center_el + e, r, h_az, h_el, n_samples=512))
        assert abs(sampled - analytic) <= 0.005


def test_wrap_around_azimuth_0_and_360():
    """Verify that celestial discs straddling the 0 / 360 azimuth boundary wrap seamlessly."""
    h_az = np.arange(0, 360, 1.0)
    h_el = np.full_like(h_az, 1.0)
    r = 0.5

    # Straddling azimuth 0 from the positive side
    frac_east = disc_fraction_profile(0.05, 1.0, r, h_az, h_el, n_samples=256)
    # Straddling azimuth 0 from the negative side (359.95)
    frac_west = disc_fraction_profile(359.95, 1.0, r, h_az, h_el, n_samples=256)
    # Far from wrap boundary (180.0)
    frac_mid = disc_fraction_profile(180.0, 1.0, r, h_az, h_el, n_samples=256)

    assert math.isclose(frac_east, 0.5, abs_tol=0.005)
    assert math.isclose(frac_west, 0.5, abs_tol=0.005)
    assert math.isclose(frac_mid, 0.5, abs_tol=0.005)
    assert math.isclose(frac_east, frac_west, abs_tol=1e-7)


def test_margin_classes():
    """Constructed test cases for each classification status:

    - robust_visible: both optimistic and pessimistic >= threshold.
    - robust_blocked: both optimistic and pessimistic < threshold.
    - marginal: optimistic >= threshold, pessimistic < threshold.
    """
    threshold = 0.50
    margin = 0.10

    # 1. High visibility -> robust_visible
    assert classify_status(0.80, threshold=threshold, margin_deg=margin) == STATUS_ROBUST_VISIBLE

    # 2. Low visibility -> robust_blocked
    assert classify_status(0.20, threshold=threshold, margin_deg=margin) == STATUS_ROBUST_BLOCKED

    # 3. Near threshold -> marginal (pessimistic = 0.45 < 0.5, optimistic = 0.65 >= 0.5)
    assert classify_status(0.55, threshold=threshold, margin_deg=margin) == STATUS_MARGINAL


def test_suggest_horizon_margin_deg():
    # 50 m vs 10 m resolution at 10 km distance with 1 m vertical error
    margin = suggest_horizon_margin_deg(
        resolution_diff_m=40.0,
        distance_m=10000.0,
        vertical_error_m=1.0,
        slope_deg=15.0,
    )
    assert margin > 0.0
    # At 10 km, 10 m error is ~0.06 degrees
    assert 0.01 <= margin <= 0.20

    with pytest.raises(ValueError):
        suggest_horizon_margin_deg(40.0, 0.0)


def test_property_fractions_and_zero_margin_rule():
    """Property tests:

    - Fractions strictly in [0, 1].
    - With zero margin, the status strictly matches the binary fraction threshold rule.
    """
    r = 0.3
    h_az = np.arange(0, 360, 5.0)
    h_el = np.sin(np.radians(h_az))

    for az in np.linspace(0, 360, 10, endpoint=False):
        for el in np.linspace(-2, 3, 10):
            frac = disc_fraction_profile(az, el, r, h_az, h_el, n_samples=64)
            # Property: strictly in [0, 1]
            assert 0.0 <= frac <= 1.0

            # Property: zero margin matches fraction rule
            status = classify_status(frac, threshold=0.50, margin_deg=0.0)
            if frac >= 0.50:
                assert status == STATUS_ROBUST_VISIBLE
            else:
                assert status == STATUS_ROBUST_BLOCKED
