"""Independent ephemeris regression tests using PyEphem (XEphem astronomical library).

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 8: Offline deterministic tests).

This module compares SPICE physical ephemerides (using loaded kernels: DE421 + MOON_ME)
against an independent third-party astronomical engine (PyEphem, based on XEphem).
Evaluates every 6 hours for 60 days starting at 2026-11-01T00:00:00Z (241 epochs).

Measured Observed Differences (SPICE vs PyEphem):
    - Sub-Earth Latitude (Libration lat):  Max diff = 0.02302 deg, RMS = 0.02174 deg
    - Sub-Earth Longitude (Libration lon): Max diff = 0.01941 deg, RMS = 0.01768 deg
    - Sub-Solar Latitude:                  Max diff = 0.03356 deg, RMS = 0.02139 deg
    - Sub-Solar Longitude:                 Max diff = 0.33439 deg, RMS = 0.14664 deg
    - Overall Maximum Difference:          0.33439 deg

Tolerance Rationale:
    Set to twice the observed maximum (2 * 0.33439 deg = 0.66878 deg ~ 0.70 deg <= 1.0 deg).
    PyEphem uses the simplified XEphem lunar theory (analytical series rather than full JPL
    numerical integration like DE421/DE441). Therefore, PyEphem is not a JPL-grade reference,
    and differences on the order of 0.1 to 0.3 deg in sub-solar longitude are expected due to
    truncated lunar optical and physical libration terms in XEphem.
"""

from __future__ import annotations

import datetime
import math
from pathlib import Path

import ephem
import numpy as np
import pytest
import spiceypy as spice

from pipeline.constants import ABCORR_FOR_VALIDATION
from pipeline.geometry import are_kernels_available, are_kernels_loaded, load_kernels

pytestmark = pytest.mark.requires_kernels

ROOT_DIR = Path(__file__).resolve().parent.parent

# Tolerance set to twice observed max (0.33439 deg * 2 = 0.66878 deg ~ 0.70 deg, <= 1.0 deg)
TOLERANCE_DEG = 0.70


@pytest.fixture(scope="module", autouse=True)
def ensure_spice_kernels():
    meta = ROOT_DIR / "kernels" / "meta.tm"
    if not are_kernels_available(meta):
        pytest.skip("Physical SPICE kernels absent from disk. Run scripts/fetch_kernels.py.")
    if not are_kernels_loaded():
        load_kernels(meta)


def test_spice_vs_ephem_60_days():
    """Verify SPICE libration and sub-solar positions against PyEphem over 60 days.

    Evaluated every 6 hours from 2026-11-01T00:00:00Z to 2026-12-31T00:00:00Z (241 samples).
    """
    start_dt = datetime.datetime(2026, 11, 1, 0, 0, tzinfo=datetime.timezone.utc)
    n_samples = 60 * 4 + 1  # 241 epochs

    d_e_lat, d_e_lon = [], []
    d_s_lat, d_s_lon = [], []

    for i in range(n_samples):
        cur_dt = start_dt + datetime.timedelta(hours=i * 6)
        t_iso = cur_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        t_ephem = cur_dt.strftime("%Y/%m/%d %H:%M:%S")

        et = spice.str2et(t_iso)

        # SPICE topocentric / body-centered positions in MOON_ME frame
        pos_earth, _ = spice.spkpos("EARTH", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        _, lon_e, lat_e = spice.reclat(pos_earth)

        pos_sun, _ = spice.spkpos("SUN", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        _, lon_s, lat_s = spice.reclat(pos_sun)

        # PyEphem calculation
        m = ephem.Moon()
        m.compute(t_ephem)

        spice_e_lat = math.degrees(lat_e)
        spice_e_lon = (math.degrees(lon_e) + 180.0) % 360.0 - 180.0
        spice_s_lat = math.degrees(lat_s)
        spice_s_lon = (math.degrees(lon_s) + 180.0) % 360.0 - 180.0

        eph_e_lat = math.degrees(m.libration_lat)
        eph_e_lon = (math.degrees(m.libration_long) + 180.0) % 360.0 - 180.0
        eph_s_lat = math.degrees(m.subsolar_lat)
        eph_s_lon = (90.0 - math.degrees(m.colong) + 180.0) % 360.0 - 180.0

        err_e_lat = abs(spice_e_lat - eph_e_lat)
        err_e_lon = abs((spice_e_lon - eph_e_lon + 180.0) % 360.0 - 180.0)
        err_s_lat = abs(spice_s_lat - eph_s_lat)
        err_s_lon = abs((spice_s_lon - eph_s_lon + 180.0) % 360.0 - 180.0)

        d_e_lat.append(err_e_lat)
        d_e_lon.append(err_e_lon)
        d_s_lat.append(err_s_lat)
        d_s_lon.append(err_s_lon)

    max_e_lat = float(np.max(d_e_lat))
    max_e_lon = float(np.max(d_e_lon))
    max_s_lat = float(np.max(d_s_lat))
    max_s_lon = float(np.max(d_s_lon))
    overall_max = max(max_e_lat, max_e_lon, max_s_lat, max_s_lon)

    assert max_e_lat <= 0.05, f"Sub-Earth latitude error {max_e_lat:.5f}° exceeds 0.05°"
    assert max_e_lon <= 0.05, f"Sub-Earth longitude error {max_e_lon:.5f}° exceeds 0.05°"
    assert max_s_lat <= 0.10, f"Sub-Solar latitude error {max_s_lat:.5f}° exceeds 0.10°"
    assert max_s_lon <= TOLERANCE_DEG, f"Sub-Solar longitude error {max_s_lon:.5f}° exceeds {TOLERANCE_DEG}°"
    assert overall_max <= TOLERANCE_DEG, f"Overall error {overall_max:.5f}° exceeds tolerance {TOLERANCE_DEG}°"


def test_old_approximate_module_fails_independent_test():
    """Verify that the old analytical ephemeris module fails the independent benchmark.

    The old module (pipeline/ephemeris.py) has an erroneous sub-solar longitude formulation
    with offsets of ~60-62 degrees, completely failing the 0.70 deg tolerance.
    """
    from pipeline.ephemeris import (
        compute_moon_center_to_sun_moon_me_km,
        utc_iso_to_julian_date,
    )

    start_dt = datetime.datetime(2026, 11, 1, 0, 0, tzinfo=datetime.timezone.utc)
    max_approx_err = 0.0

    for i in range(241):
        cur_dt = start_dt + datetime.timedelta(hours=i * 6)
        t_iso = cur_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        jd = utc_iso_to_julian_date(t_iso)

        sun_xyz = compute_moon_center_to_sun_moon_me_km(jd)
        approx_lon = math.degrees(math.atan2(sun_xyz[1], sun_xyz[0]))

        t_ephem = cur_dt.strftime("%Y/%m/%d %H:%M:%S")
        m = ephem.Moon()
        m.compute(t_ephem)
        eph_s_lon = (90.0 - math.degrees(m.colong) + 180.0) % 360.0 - 180.0

        diff = abs((approx_lon - eph_s_lon + 180.0) % 360.0 - 180.0)
        if diff > max_approx_err:
            max_approx_err = diff

    # Assert that the approximate module definitely fails the 0.70 deg tolerance
    assert max_approx_err > 50.0, f"Expected large error >50 deg in approximate module, got {max_approx_err:.2f} deg"
    assert max_approx_err > TOLERANCE_DEG, "Approximate module unexpectedly passed the tolerance!"
