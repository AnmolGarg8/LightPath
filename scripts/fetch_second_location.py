#!/usr/bin/env python3
"""Fetch JPL Horizons ephemeris for Second Location (Lat -85.0, Lon 30.0) for 7 days.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 3: test-only marking).
Network allowed host: ssd.jpl.nasa.gov.
"""

import csv
import datetime
import json
import re
import sys
import urllib.parse
import urllib.request
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

BASE_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

SITE_CONFIG = {
    "id": "test_location_2",
    "name": "TEST_LOCATION_2_NOT_A_MISSION_SITE",
    "label": "test-only",
    "lat_deg": -85.0,
    "lon_deg": 30.0,
    "alt_km": 0.0,
    "ground_elev_m": 0.0,
}

START_TIME = "2026-11-01 00:00"
STOP_TIME = "2026-11-08 00:00"  # 7 days
STEP_SIZE = "1 h"

def fetch_horizons_raw(target_code: str, site: dict):
    site_coord_str = f"'{site['lon_deg']},{site['lat_deg']},{site['alt_km']}'"
    params = {
        "format": "json",
        "COMMAND": f"'{target_code}'",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": site_coord_str,
        "START_TIME": f"'{START_TIME}'",
        "STOP_TIME": f"'{STOP_TIME}'",
        "STEP_SIZE": f"'{STEP_SIZE}'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
    }
    query_str = urllib.parse.urlencode(params)
    url = f"{BASE_URL}?{query_str}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPath-ScienceDataAudit/1.0 (NASA Hackathon Lunar Verification)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body_bytes = resp.read()
        resp_data = json.loads(body_bytes.decode("utf-8"))

    raw_result = resp_data.get("result", "")
    return raw_result, params, url

def parse_horizons_table(raw_text: str):
    soe_match = re.search(r'\$\$SOE\s*\n', raw_text)
    eoe_match = re.search(r'\n\s*\$\$EOE', raw_text)
    if not soe_match or not eoe_match:
        raise ValueError("Could not find $$SOE/$$EOE delimiters in Horizons output")

    table_text = raw_text[soe_match.end():eoe_match.start()].strip()
    rows = []
    for line in table_text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 5:
            date_str = parts[0]
            dt = datetime.datetime.strptime(date_str, "%Y-%b-%d %H:%M")
            iso_utc = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            az_deg = float(parts[3])
            el_deg = float(parts[4])
            rows.append({
                "utc": iso_utc,
                "az_deg": az_deg,
                "el_deg": el_deg,
            })
    return rows

def main():
    log_lines = []
    def log(msg=""):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log("=" * 80)
    log(f"TASK S0b - STEP 4: SECOND LOCATION HORIZONS BENCHMARK ({now})")
    log("Site: TEST_LOCATION_2_NOT_A_MISSION_SITE (label: test-only)")
    log("Coordinates: Lat = -85.0°, Lon = 30.0°, Alt = 0.0 km")
    log("Window: 2026-11-01 00:00 to 2026-11-08 00:00 (7 days, 169 hourly steps)")
    log("=" * 80)

    targets = [
        ("sun", "10", "Sun"),
        ("earth", "399", "Earth"),
    ]

    for target_key, target_code, target_label in targets:
        log(f"\n--- Fetching Horizons for {target_label} ({target_code}) ---")
        raw_result, params, full_url = fetch_horizons_raw(target_code, SITE_CONFIG)
        log(f"Received {len(raw_result):,} characters from {BASE_URL}")

        parsed_rows = parse_horizons_table(raw_result)
        log(f"Parsed {len(parsed_rows)} hourly records.")

        # Save fixtures
        base_name = f"horizons_{SITE_CONFIG['id']}_{target_key}"
        raw_file = FIXTURES_DIR / f"{base_name}_raw.txt"
        json_file = FIXTURES_DIR / f"{base_name}.json"
        csv_file = FIXTURES_DIR / f"{base_name}.csv"

        raw_file.write_text(raw_result, encoding="utf-8")
        log(f"Wrote raw text: {raw_file.name}")

        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["utc", "az_deg", "el_deg"])
            writer.writeheader()
            writer.writerows(parsed_rows)
        log(f"Wrote CSV table: {csv_file.name}")

        sidecar = {
            "site": SITE_CONFIG,
            "target": {"name": target_key, "command": target_code},
            "request": {
                "base_url": BASE_URL,
                "parameters": params,
                "full_url": full_url,
            },
            "retrieval_date_utc": now,
            "total_records": len(parsed_rows),
        }
        json_file.write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
        log(f"Wrote metadata sidecar: {json_file.name}")

    # Now run SPICE comparison at Second Location
    log("\n" + "=" * 80)
    log("SPICE VS HORIZONS COMPARISON AT SECOND LOCATION (Lat -85.0°, Lon 30.0°)")
    log("=" * 80)

    load_kernels(META_KERNEL)
    lat = SITE_CONFIG["lat_deg"]
    lon = SITE_CONFIG["lon_deg"]
    elev_m = SITE_CONFIG["ground_elev_m"]

    site_xyz = site_position_moon_me_km(lat, lon, elev_m + R_MOON_M)
    basis = enu_basis(lat, lon)

    for target_key, target_code, target_label in targets:
        csv_file = FIXTURES_DIR / f"horizons_{SITE_CONFIG['id']}_{target_key}.csv"
        times = []
        hz_az = []
        hz_el = []
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                times.append(r["utc"])
                hz_az.append(float(r["az_deg"]))
                hz_el.append(float(r["el_deg"]))
        hz_az = np.array(hz_az)
        hz_el = np.array(hz_el)

        # SPICE run with LT+S (apparent matching Horizons)
        spice_az = []
        spice_el = []
        for ts in times:
            et = spice.str2et(ts)
            pos, _ = spice.spkpos(target_code, et, "MOON_ME", "LT+S", "301")
            az, el, _ = topocentric_az_el(pos, site_xyz, basis)
            spice_az.append(az)
            spice_el.append(el)
        spice_az = np.array(spice_az)
        spice_el = np.array(spice_el)

        d_az = np.abs((spice_az - hz_az + 180.0) % 360.0 - 180.0)
        d_el = np.abs(spice_el - hz_el)

        max_d_az = float(np.max(d_az))
        rms_d_az = float(np.sqrt(np.mean(d_az**2)))
        max_d_el = float(np.max(d_el))
        rms_d_el = float(np.sqrt(np.mean(d_el**2)))

        log(f"Target: {target_label.upper()} ({len(times)} samples, Lat -85.0°, Lon 30.0°)")
        log(f"  Azimuth Error:   Max = {max_d_az:.5f}°, RMS = {rms_d_az:.5f}° -> Status: {'PASS' if max_d_az <= 0.05 else 'FAIL'}")
        log(f"  Elevation Error: Max = {max_d_el:.5f}°, RMS = {rms_d_el:.5f}° -> Status: {'PASS' if max_d_el <= 0.05 else 'FAIL'}")

    unload_kernels()

    log_path = LOGS_DIR / "v3_proof_step4_second_location.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote second location log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
