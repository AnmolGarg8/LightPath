"""Fault injection tests proving V3 tolerance sensitivity.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 1: Correctness before features).
Requires physical SPICE kernels and Horizons fixtures.

Per Task S0c Item 4:
These tests inject deliberate faults and assert that the error strictly EXCEEDS
the tightened 0.01 degree tolerance (proving that V3 fails under any of these faults).
"""

import csv
from pathlib import Path

import numpy as np
import pytest
import spiceypy as spice

from pipeline.constants import (
    ABCORR_FOR_VALIDATION,
    R_MOON_M,
)
from pipeline.geometry import (
    are_kernels_available,
    are_kernels_loaded,
    enu_basis,
    load_kernels,
    site_position_moon_me_km,
    topocentric_az_el,
    topocentric_basis_moon_me,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT_DIR / "tests" / "fixtures"
META_KERNEL = ROOT_DIR / "kernels" / "meta.tm"

TOLERANCE_DEG = 0.01  # Tightened tolerance

@pytest.fixture(autouse=True)
def ensure_spice_kernels():
    if not are_kernels_available(META_KERNEL):
        pytest.skip("Physical SPICE kernels not present on disk. Run scripts/fetch_kernels.py.")
    if not are_kernels_loaded():
        load_kernels(META_KERNEL)

def load_fixture(fixture_name: str):
    csv_path = FIXTURES_DIR / fixture_name
    if not csv_path.exists():
        pytest.skip(f"Fixture {fixture_name} missing.")
    times, az, el = [], [], []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            times.append(row["utc"])
            az.append(float(row["az_deg"]))
            el.append(float(row["el_deg"]))
    return times, np.array(az), np.array(el)

def test_fault_injection_moon_pa_fails_tolerance():
    """Fault (a): MOON_PA instead of MOON_ME.

    The IAU Euler rotation between Principal Axes and Mean Earth frames (~104 arcsec)
    produces ~0.0218 deg elevation offset, which MUST fail the 0.01 deg tolerance.
    """
    times, ref_az, ref_el = load_fixture("horizons_test_location_sun.csv")
    lat_deg, lon_deg = -89.5, 0.0

    site_xyz = site_position_moon_me_km(lat_deg, lon_deg, R_MOON_M)
    basis = topocentric_basis_moon_me(lat_deg, lon_deg)

    errors_az = []
    errors_el = []
    for ts, r_az, r_el in zip(times, ref_az, ref_el):
        et = spice.str2et(ts)
        # INJECT FAULT: "MOON_PA" instead of "MOON_ME"
        pos, _ = spice.spkpos("10", et, "MOON_PA", ABCORR_FOR_VALIDATION, "301")
        az, el, _ = topocentric_az_el(pos, site_xyz, basis)

        d_az = abs((az - r_az + 180.0) % 360.0 - 180.0)
        d_el = abs(el - r_el)
        errors_az.append(d_az)
        errors_el.append(d_el)

    max_err = max(max(errors_az), max(errors_el))
    print(f"\n[Fault MOON_PA] Max error: {max_err:.5f}° (Tolerance: {TOLERANCE_DEG}°)")
    assert max_err > TOLERANCE_DEG, (
        f"Fault MOON_PA was expected to FAIL 0.01° tolerance, but measured {max_err:.5f}° <= {TOLERANCE_DEG}°"
    )

def test_fault_injection_moon_centre_earth_fails_tolerance():
    """Fault (b): Moon-centre direction for Earth (ignoring topocentric parallax).

    The topocentric parallax for Earth is ~0.26 deg, which MUST fail the 0.01 deg tolerance.
    """
    times, ref_az, ref_el = load_fixture("horizons_test_location_earth.csv")
    lat_deg, lon_deg = -89.5, 0.0
    basis = enu_basis(lat_deg, lon_deg)

    errors_el = []
    for ts, r_el in zip(times, ref_el):
        et = spice.str2et(ts)
        pos, _ = spice.spkpos("399", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        # INJECT FAULT: evaluate from Moon center (0, 0, 0) instead of site surface position
        _, el, _ = topocentric_az_el(pos, np.zeros(3), basis)
        errors_el.append(abs(el - r_el))

    max_el_err = max(errors_el)
    print(f"\n[Fault Moon-Centre Earth] Max El error: {max_el_err:.5f}° (Tolerance: {TOLERANCE_DEG}°)")
    assert max_el_err > TOLERANCE_DEG, (
        f"Fault Moon-centre Earth was expected to FAIL 0.01° tolerance, but measured {max_el_err:.5f}° <= {TOLERANCE_DEG}°"
    )

def test_fault_injection_latitude_shift_fails_tolerance():
    """Fault (f): 0.02 degree site latitude shift.

    Tilting the observer's latitude by 0.02 deg directly tilts the local vertical by 0.02 deg,
    producing an exact 0.02 deg elevation error which MUST fail the 0.01 deg tolerance.
    """
    times, ref_az, ref_el = load_fixture("horizons_test_location_sun.csv")
    base_lat_deg, base_lon_deg = -89.5, 0.0
    # INJECT FAULT: +0.02 degrees latitude offset
    shifted_lat_deg = base_lat_deg + 0.02

    site_xyz = site_position_moon_me_km(shifted_lat_deg, base_lon_deg, R_MOON_M)
    basis = topocentric_basis_moon_me(shifted_lat_deg, base_lon_deg)

    errors_el = []
    for ts, r_el in zip(times, ref_el):
        et = spice.str2et(ts)
        pos, _ = spice.spkpos("10", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        _, el, _ = topocentric_az_el(pos, site_xyz, basis)
        errors_el.append(abs(el - r_el))

    max_el_err = max(errors_el)
    print(f"\n[Fault 0.02° Lat Shift] Max El error: {max_el_err:.5f}° (Tolerance: {TOLERANCE_DEG}°)")
    assert max_el_err > TOLERANCE_DEG, (
        f"Fault 0.02° Lat Shift was expected to FAIL 0.01° tolerance, but measured {max_el_err:.5f}° <= {TOLERANCE_DEG}°"
    )
