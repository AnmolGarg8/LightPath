#!/usr/bin/env python3
"""Run sensitivity fault injection tests on SPICE ephemeris against JPL Horizons.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 9: Full provenance).

Injects 6 deliberate faults one at a time and measures the resulting error:
  (a) MOON_PA instead of MOON_ME
  (b) Moon-centre direction instead of topocentric
  (c) Aberration LT+S instead of NONE
  (d) Time shifted by +60 seconds
  (e) Site longitude +0.01 degrees
  (f) Site latitude +0.01 degrees
"""

import csv
import datetime
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import spiceypy as spice  # noqa: E402

from pipeline.constants import R_MOON_M  # noqa: E402
from pipeline.geometry import (  # noqa: E402
    enu_basis,
    load_kernels,
    site_position_moon_me_km,
    topocentric_az_el,
    unload_kernels,
)

FIXTURES_DIR = ROOT / "tests" / "fixtures"
META_KERNEL = ROOT / "kernels" / "meta.tm"
LOGS_DIR = ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def load_horizons_csv(csv_path: Path):
    times, azs, els = [], [], []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            times.append(row["utc"])
            azs.append(float(row["az_deg"]))
            els.append(float(row["el_deg"]))
    return times, np.array(azs), np.array(els)

def evaluate_run(target_name: str, times: list, hz_az: np.ndarray, hz_el: np.ndarray,
                 frame="MOON_ME", use_moon_center=False, abcorr="NONE",
                 time_offset_s=0.0, lat_offset_deg=0.0, lon_offset_deg=0.0,
                 base_lat=-89.5, base_lon=0.0, base_elev=-720.33):
    """Compute topocentric state under specified parameters and compare to Horizons."""
    lat = base_lat + lat_offset_deg
    lon = base_lon + lon_offset_deg
    elev = base_elev

    site_pos_km = site_position_moon_me_km(lat, lon, elev + R_MOON_M)
    basis = enu_basis(lat, lon)

    lp_az = []
    lp_el = []

    for ts in times:
        et = spice.str2et(ts) + time_offset_s
        target_pos_moon, _ = spice.spkpos(target_name.upper(), et, frame, abcorr, "MOON")

        if use_moon_center:
            # Moon-centre direction evaluated in the site's topocentric ENU basis
            az, el, _ = topocentric_az_el(target_pos_moon, np.zeros(3), basis)
        else:
            az, el, _ = topocentric_az_el(target_pos_moon, site_pos_km, basis)

        lp_az.append(az)
        lp_el.append(el)

    lp_az = np.array(lp_az)
    lp_el = np.array(lp_el)

    # Angular differences
    d_el = np.abs(lp_el - hz_el)
    d_az = np.abs((lp_az - hz_az + 180.0) % 360.0 - 180.0)

    max_d_az = float(np.max(d_az))
    rms_d_az = float(np.sqrt(np.mean(d_az**2)))
    max_d_el = float(np.max(d_el))
    rms_d_el = float(np.sqrt(np.mean(d_el**2)))

    return {
        "max_d_az": max_d_az,
        "rms_d_az": rms_d_az,
        "max_d_el": max_d_el,
        "rms_d_el": rms_d_el,
    }

def main():
    log_lines = []
    def log(msg=""):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log("=" * 80)
    log(f"TASK S0b - STEP 3: SPICE VS HORIZONS SENSITIVITY AUDIT ({now})")
    log("=" * 80)

    load_kernels(META_KERNEL)

    sun_times, sun_hz_az, sun_hz_el = load_horizons_csv(FIXTURES_DIR / "horizons_test_location_sun.csv")
    earth_times, earth_hz_az, earth_hz_el = load_horizons_csv(FIXTURES_DIR / "horizons_test_location_earth.csv")

    scenarios = [
        ("Baseline (Clean)", {}),
        ("(a) Frame MOON_PA instead of MOON_ME", {"frame": "MOON_PA"}),
        ("(b) Moon-centre direction instead of topocentric", {"use_moon_center": True}),
        ("(c) Aberration LT+S instead of NONE", {"abcorr": "LT+S"}),
        ("(d) Time shifted by +60 seconds", {"time_offset_s": 60.0}),
        ("(e) Site longitude +0.01 degrees", {"lon_offset_deg": 0.01}),
        ("(f) Site latitude +0.01 degrees", {"lat_offset_deg": 0.01}),
    ]

    results_table = []

    for name, kwargs in scenarios:
        log(f"\n--- Testing Scenario: {name} ---")
        sun_res = evaluate_run("SUN", sun_times, sun_hz_az, sun_hz_el, **kwargs)
        earth_res = evaluate_run("EARTH", earth_times, earth_hz_az, earth_hz_el, **kwargs)

        log(f"  Sun:   Max Az Err = {sun_res['max_d_az']:.5f}°, Max El Err = {sun_res['max_d_el']:.5f}°")
        log(f"  Earth: Max Az Err = {earth_res['max_d_az']:.5f}°, Max El Err = {earth_res['max_d_el']:.5f}°")

        results_table.append({
            "name": name,
            "sun_az_max": sun_res['max_d_az'],
            "sun_el_max": sun_res['max_d_el'],
            "earth_az_max": earth_res['max_d_az'],
            "earth_el_max": earth_res['max_d_el'],
        })

    log("\n" + "=" * 80)
    log("SUMMARY SENSITIVITY TABLE (721 hourly epochs, Nov 2026)")
    log("=" * 80)
    header = f"{'Fault Scenario':<48} | {'Sun Az':<10} | {'Sun El':<10} | {'Earth Az':<10} | {'Earth El':<10} | {'Status (>0.05°)'}"
    log(header)
    log("-" * len(header))

    for r in results_table:
        max_err = max(r["sun_az_max"], r["sun_el_max"], r["earth_az_max"], r["earth_el_max"])
        exceeds = "EXCEEDS TOLERANCE" if max_err > 0.05 else ("PASS (Baseline)" if "Baseline" in r["name"] else "BELOW 0.05°")
        line = (f"{r['name']:<48} | {r['sun_az_max']:<10.5f}°| {r['sun_el_max']:<10.5f}°| "
                f"{r['earth_az_max']:<10.5f}°| {r['earth_el_max']:<10.5f}°| {exceeds}")
        log(line)

    unload_kernels()

    log_path = LOGS_DIR / "v3_proof_step3_sensitivity.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote sensitivity log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
