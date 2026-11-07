#!/usr/bin/env python3
"""Step 8: Fetch Horizons ephemeris benchmark reference data.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/numbers).
Allowed hosts: ssd-api.jpl.nasa.gov, ssd.jpl.nasa.gov
"""

import csv
import datetime
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "configs" / "terrain_windows.yaml"
FIXTURES_DIR = ROOT / "tests" / "fixtures"
LOGS_DIR = ROOT / "logs"

FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

TARGETS = [
    {"name": "sun", "command": "10"},
    {"name": "earth", "command": "399"},
]

def parse_horizons_csv(raw_text: str):
    """Parse Horizons CSV table between $$SOE and $$EOE."""
    start_idx = raw_text.find("$$SOE")
    end_idx = raw_text.find("$$EOE")
    if start_idx == -1 or end_idx == -1:
        raise ValueError("$$SOE or $$EOE delimiters not found in Horizons response!")

    data_section = raw_text[start_idx + 5 : end_idx].strip()
    rows = []

    # Format of each line:
    # 2026-Nov-01 00:00,*,i, 285.117929,     1.587011,
    for line in data_section.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        raw_date_str = parts[0]
        # Parse date e.g. "2026-Nov-01 00:00" -> ISO UTC
        try:
            dt = datetime.datetime.strptime(raw_date_str, "%Y-%b-%d %H:%M").replace(tzinfo=datetime.timezone.utc)
            iso_utc = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            iso_utc = raw_date_str

        az_deg = float(parts[3])
        el_deg = float(parts[4])
        rows.append({"utc": iso_utc, "az_deg": az_deg, "el_deg": el_deg})

    return rows

def fetch_for_site_and_target(site: dict, target: dict, log):
    site_id = site["id"]
    lat = site["lat_deg"]
    lon = site["lon_deg"]
    target_name = target["name"]
    command = target["command"]

    log(f"Requesting Horizons for Site '{site_id}' ({lat}°, {lon}°) -> Target: {target_name.upper()} (code {command})...")

    # Observer altitude on reference sphere is 0.0 km
    site_coord_str = f"'{lon},{lat},0.0'"
    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": site_coord_str,
        "START_TIME": "'2026-11-01 00:00'",
        "STOP_TIME": "'2026-12-01 00:00'",
        "STEP_SIZE": "'1 h'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
    }

    full_url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    log(f"  URL: {full_url}")

    req = urllib.request.Request(full_url, headers={"User-Agent": "LightPath-DataAcquisition/1.0 (+https://github.com/AnmolGarg8/LightPath)"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        resp_data = json.loads(resp.read().decode("utf-8"))

    raw_result = resp_data.get("result", "")
    log(f"  Received raw response: {len(raw_result):,} characters")

    # Save raw response
    raw_path = FIXTURES_DIR / f"horizons_{site_id}_{target_name}_raw.txt"
    raw_path.write_text(raw_result, encoding="utf-8")
    log(f"  Saved raw response to {raw_path.name}")

    # Parse CSV rows
    rows = parse_horizons_csv(raw_result)
    log(f"  Parsed {len(rows)} ephemeris rows.")

    csv_path = FIXTURES_DIR / f"horizons_{site_id}_{target_name}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["utc", "az_deg", "el_deg"])
        writer.writeheader()
        writer.writerows(rows)
    log(f"  Wrote parsed CSV to {csv_path.name}")

    # Sidecar JSON
    retrieval_date = datetime.datetime.now(datetime.timezone.utc).isoformat()
    sidecar_data = {
        "site": {
            "id": site_id,
            "name": site["name"],
            "lat_deg": lat,
            "lon_deg": lon,
            "alt_km": 0.0,
        },
        "target": {
            "name": target_name,
            "command": command,
        },
        "request": {
            "base_url": BASE_URL,
            "parameters": params,
            "full_url": full_url,
        },
        "retrieval_date_utc": retrieval_date,
        "horizons_metadata": {
            "center_body": "Moon (301)",
            "center_frame": "MEAN_ME (high precision)",
            "center_radii_km": [1737.4, 1737.4, 1737.4],
            "atmospheric_refraction": "NO (AIRLESS)",
            "coordinate_convention": "East-longitude positive, North latitude positive, Geodetic on spherical Moon R=1737.4 km",
            "ephemeris_source": "JPL DE441",
            "table_start_utc": rows[0]["utc"] if rows else None,
            "table_end_utc": rows[-1]["utc"] if rows else None,
            "total_records": len(rows),
        }
    }

    sidecar_path = FIXTURES_DIR / f"horizons_{site_id}_{target_name}.json"
    sidecar_path.write_text(json.dumps(sidecar_data, indent=2), encoding="utf-8")
    log(f"  Wrote JSON sidecar to {sidecar_path.name}\n")

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 8: Fetch Horizons Reference Data ({now}) ===\n")

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    sites = cfg["sites"]
    for site in sites:
        for target in TARGETS:
            fetch_for_site_and_target(site, target, log)
            time.sleep(1.0)  # Gentle on Horizons API

    log_file = LOGS_DIR / "step8_fetch_horizons.log"
    log_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"Wrote log to {log_file.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
