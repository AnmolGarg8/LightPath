# ruff: noqa: E402
#!/usr/bin/env python3
"""Libration & Sub-Solar Ephemeris Independent Check Script.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 8: Offline determinism).

Compares SPICE physical ephemerides (using DE421 + MOON_ME) against PyEphem
for 60 days from 2026-11-01T00:00:00Z every 6 hours (241 epochs).
Saves output to logs/check_libration.log.
"""

import datetime
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import ephem
import numpy as np
import spiceypy as spice

from pipeline.constants import ABCORR_FOR_VALIDATION
from pipeline.geometry import are_kernels_loaded, load_kernels

LOGS_DIR = ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)


def main():
    log_lines = []

    def log(msg=""):
        print(msg)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log("=" * 80)
    log(f"LIGHTPATH INDEPENDENT LIBRATION & EPHEMERIS AUDIT ({now})")
    log("SPICE (DE421 / MOON_ME / LT+S) vs PyEphem (XEphem Theory)")
    log("=" * 80 + "\n")

    meta = ROOT / "kernels" / "meta.tm"
    if not are_kernels_loaded():
        load_kernels(meta)
    log(f"Furnished SPICE meta-kernel: {meta}")

    start_dt = datetime.datetime(2026, 11, 1, 0, 0, tzinfo=datetime.timezone.utc)
    n_samples = 60 * 4 + 1  # 241 epochs

    d_e_lat, d_e_lon = [], []
    d_s_lat, d_s_lon = [], []

    for i in range(n_samples):
        cur_dt = start_dt + datetime.timedelta(hours=i * 6)
        t_iso = cur_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        t_ephem = cur_dt.strftime("%Y/%m/%d %H:%M:%S")

        et = spice.str2et(t_iso)

        pos_earth, _ = spice.spkpos("EARTH", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        _, lon_e, lat_e = spice.reclat(pos_earth)

        pos_sun, _ = spice.spkpos("SUN", et, "MOON_ME", ABCORR_FOR_VALIDATION, "301")
        _, lon_s, lat_s = spice.reclat(pos_sun)

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

    log(f"Sampling Period: 60 days (2026-11-01 to 2026-12-31) at 6-hour cadence ({n_samples} samples)\n")
    log("--------------------------------------------------------------------------------")
    log(f"Sub-Earth Latitude  (Libration Lat): Max = {np.max(d_e_lat):.5f}°, RMS = {np.sqrt(np.mean(np.array(d_e_lat)**2)):.5f}°")
    log(f"Sub-Earth Longitude (Libration Lon): Max = {np.max(d_e_lon):.5f}°, RMS = {np.sqrt(np.mean(np.array(d_e_lon)**2)):.5f}°")
    log(f"Sub-Solar Latitude:                  Max = {np.max(d_s_lat):.5f}°, RMS = {np.sqrt(np.mean(np.array(d_s_lat)**2)):.5f}°")
    log(f"Sub-Solar Longitude:                 Max = {np.max(d_s_lon):.5f}°, RMS = {np.sqrt(np.mean(np.array(d_s_lon)**2)):.5f}°")
    log("--------------------------------------------------------------------------------")

    overall_max = max(np.max(d_e_lat), np.max(d_e_lon), np.max(d_s_lat), np.max(d_s_lon))
    log(f"Overall Maximum Difference: {overall_max:.5f}°")
    log(f"Independent Benchmark Tolerance Bound (2x Max): {2 * overall_max:.5f}° (Adoption: <= 0.70°)")
    verdict = "PASS" if overall_max <= 0.70 else "FAIL"
    log(f"Final Benchmark Verdict: {verdict}\n")

    out_file = LOGS_DIR / "check_libration.log"
    out_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"Wrote report to {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
