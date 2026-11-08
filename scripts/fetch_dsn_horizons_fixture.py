#!/usr/bin/env python3
"""Fetch JPL Horizons ground-station fixture for Goldstone DSS 14 (Moon observation).

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/numbers; Rule 8: Offline tests).
Allowed host: ssd.jpl.nasa.gov
"""

import csv
import datetime
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "tests" / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Station: Goldstone DSS 14
# Lat: 35.247 deg, Lon: -116.889 deg, Alt: 1.0 km
STATION_COORD = "-116.889,35.247,1.0"
START_TIME = "2026-11-01 00:00"
STOP_TIME = "2026-11-08 00:00"
STEP_SIZE = "1h"


def parse_horizons_data(raw_text: str):
    start_idx = raw_text.find("$$SOE")
    end_idx = raw_text.find("$$EOE")
    if start_idx == -1 or end_idx == -1:
        raise ValueError("$$SOE or $$EOE delimiters not found in Horizons response!")

    data_section = raw_text[start_idx + 5 : end_idx].strip()
    rows = []

    for line in data_section.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        raw_date_str = parts[0]
        try:
            dt = datetime.datetime.strptime(raw_date_str, "%Y-%b-%d %H:%M").replace(
                tzinfo=datetime.timezone.utc
            )
            iso_utc = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            iso_utc = raw_date_str

        az_deg = float(parts[3])
        el_deg = float(parts[4])
        rows.append({"utc": iso_utc, "az_deg": az_deg, "el_deg": el_deg})

    return rows


def main():
    params = {
        "format": "json",
        "COMMAND": "301",
        "CENTER": "coord@399",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": STATION_COORD,
        "START_TIME": START_TIME,
        "STOP_TIME": STOP_TIME,
        "STEP_SIZE": STEP_SIZE,
        "QUANTITIES": "4",
        "CSV_FORMAT": "YES",
        "ANG_FORMAT": "DEG",
        "ELEV_CUT": "-90",
        "REF_SYSTEM": "ICRF",
        "EXTRA_PREC": "YES",
    }

    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    print(f"Fetching from JPL Horizons: {url} ...")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPath-Auditor/1.0 (NASA Space Apps Challenge; Reproducible)"},
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        http_code = resp.status
        content_length = resp.headers.get("Content-Length")
        data = json.loads(resp.read().decode("utf-8"))

    raw_result = data.get("result", "")
    parsed_rows = parse_horizons_data(raw_result)

    # Write raw response
    raw_path = FIXTURES_DIR / "horizons_dsn_goldstone_moon_raw.txt"
    raw_path.write_text(raw_result, encoding="utf-8")
    print(f"Saved raw response to {raw_path} ({len(raw_result)} chars)")

    # Write CSV
    csv_path = FIXTURES_DIR / "horizons_dsn_goldstone_moon.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["utc", "az_deg", "el_deg"])
        writer.writeheader()
        writer.writerows(parsed_rows)
    print(f"Saved {len(parsed_rows)} rows to {csv_path}")

    # Write sidecar JSON
    sidecar = {
        "query_url": url,
        "http_status": http_code,
        "content_length": content_length,
        "fetched_on": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "target": "301 (Moon)",
        "center": f"coord@399 ({STATION_COORD})",
        "station": "Goldstone DSS 14",
        "period": f"{START_TIME} to {STOP_TIME}",
        "step_size": STEP_SIZE,
        "quantities": "4 (Apparent AZ & EL)",
        "num_records": len(parsed_rows),
    }
    json_path = FIXTURES_DIR / "horizons_dsn_goldstone_moon.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)
    print(f"Saved sidecar metadata to {json_path}")


if __name__ == "__main__":
    main()
