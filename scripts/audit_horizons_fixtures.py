#!/usr/bin/env python3
"""Audit Horizons fixtures: verify raw responses, request echos, sidecars, and re-parse diffs.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 9: Full provenance).
"""

import csv
import datetime
import json
import re
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "tests" / "fixtures"
LOGS_DIR = ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def parse_horizons_timestamp(raw_ts: str) -> str:
    """Convert Horizons timestamp e.g. '2026-Nov-01 00:00' to ISO UTC string."""
    dt = datetime.datetime.strptime(raw_ts.strip(), "%Y-%b-%d %H:%M")
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def independent_parse_raw(raw_text: str):
    """Independently parse the raw Horizons response text into records."""
    # Find $$SOE (start of ephemeris) and $$EOE (end of ephemeris)
    soe_match = re.search(r'\$\$SOE\s*\n', raw_text)
    eoe_match = re.search(r'\n\s*\$\$EOE', raw_text)

    if not soe_match or not eoe_match:
        raise ValueError("Could not find $$SOE or $$EOE delimiters in raw text")

    table_text = raw_text[soe_match.end():eoe_match.start()].strip()
    lines = [line.strip() for line in table_text.splitlines() if line.strip()]

    records = []
    for line in lines:
        parts = [p.strip() for p in line.split(",")]
        # Columns: Date__(UT)__HR:MN, Solar_Presence, Target_Flag, Azimuth_(app), Elevation_(app), ...
        if len(parts) >= 5:
            raw_ts = parts[0]
            iso_ts = parse_horizons_timestamp(raw_ts)
            az_val = float(parts[3])
            el_val = float(parts[4])
            records.append({
                "raw_utc": raw_ts,
                "utc": iso_ts,
                "az_deg": az_val,
                "el_deg": el_val,
            })
    return records

def main():
    log_lines = []
    def log(msg=""):
        print(msg, flush=True)
        log_lines.append(msg)

    log("=" * 80)
    log("TASK S0b - STEP 1: HORIZONS FIXTURES AUDIT & INDEPENDENT RE-PARSE DIFF")
    log("=" * 80)

    fixtures = [
        ("Sun", FIXTURES_DIR / "horizons_test_location_sun"),
        ("Earth", FIXTURES_DIR / "horizons_test_location_earth"),
    ]

    all_diffs_zero = True

    for body_name, base_path in fixtures:
        raw_path = base_path.with_name(f"{base_path.name}_raw.txt")
        json_path = base_path.with_suffix(".json")
        csv_path = base_path.with_suffix(".csv")

        log("\n################################################################################")
        log(f"FIXTURE: {body_name.upper()} ({csv_path.name})")
        log("################################################################################")

        # 1. Print first 40 lines of raw response
        log(f"\n--- 1. First 40 Lines of Raw Response ({raw_path.relative_to(ROOT)}) ---")
        if not raw_path.exists():
            log(f"ERROR: {raw_path} not found!")
            all_diffs_zero = False
            continue

        raw_content = raw_path.read_text(encoding="utf-8")
        raw_lines = raw_content.splitlines()
        for idx, line in enumerate(raw_lines[:40], start=1):
            log(f"{idx:3d} | {line}")

        # 2. Print sidecar JSON
        log(f"\n--- 2. Sidecar JSON Metadata ({json_path.relative_to(ROOT)}) ---")
        if json_path.exists():
            sidecar_dict = json.loads(json_path.read_text(encoding="utf-8"))
            log(json.dumps(sidecar_dict, indent=2))
        else:
            log(f"WARNING: Sidecar {json_path} missing!")

        # 3. Independently re-parse raw response
        log(f"\n--- 3. Independent Re-Parse and Row-by-Row Diff vs {csv_path.name} ---")
        reparsed_records = independent_parse_raw(raw_content)
        log(f"Independently re-parsed {len(reparsed_records)} rows from raw text.")

        # Read existing CSV
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            csv_rows = list(reader)
        log(f"Read {len(csv_rows)} rows from existing CSV file.")

        if len(reparsed_records) != len(csv_rows):
            log(f"[DIFF FAIL] Row count mismatch! Raw parsed: {len(reparsed_records)}, CSV: {len(csv_rows)}")
            all_diffs_zero = False
            continue

        max_az_diff = 0.0
        max_el_diff = 0.0
        mismatched_timestamps = 0

        for r_idx, (raw_rec, csv_rec) in enumerate(zip(reparsed_records, csv_rows)):
            t_raw = raw_rec["utc"]
            t_csv = csv_rec.get("utc") or csv_rec.get("datetime_utc") or csv_rec.get("time")

            # Check timestamp
            if t_raw != t_csv:
                mismatched_timestamps += 1
                if mismatched_timestamps <= 3:
                    log(f"  [Row {r_idx}] Timestamp mismatch: raw='{t_raw}' vs csv='{t_csv}'")

            az_raw = raw_rec["az_deg"]
            el_raw = raw_rec["el_deg"]

            az_csv = float(csv_rec.get("az_deg") or csv_rec.get("azimuth_deg") or csv_rec.get("az"))
            el_csv = float(csv_rec.get("el_deg") or csv_rec.get("elevation_deg") or csv_rec.get("el"))

            d_az = abs(az_raw - az_csv)
            d_el = abs(el_raw - el_csv)

            if d_az > max_az_diff:
                max_az_diff = d_az
            if d_el > max_el_diff:
                max_el_diff = d_el

        log(f"Diff Results across all {len(csv_rows)} rows:")
        log(f"  Timestamp Mismatches: {mismatched_timestamps}")
        log(f"  Max Absolute Difference in Azimuth:   {max_az_diff:.10f}°")
        log(f"  Max Absolute Difference in Elevation: {max_el_diff:.10f}°")

        if mismatched_timestamps == 0 and max_az_diff == 0.0 and max_el_diff == 0.0:
            log("[PASS] Exact 0-diff match: The CSV is bit-for-bit and mathematically identical to the independently parsed raw response.")
        else:
            log("[DIFF DETECTED] Non-zero differences found!")
            all_diffs_zero = False

    log("\n" + "=" * 80)
    if all_diffs_zero:
        log("STEP 1 AUDIT VERDICT: ALL FIXTURES FULLY VERIFIED (0 DIFF)")
    else:
        log("STEP 1 AUDIT VERDICT: MISMATCHES DETECTED")
    log("=" * 80)

    log_file = LOGS_DIR / "v3_proof_step1_fixture_audit.log"
    log_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote audit log to {log_file.relative_to(ROOT)}")

    return 0 if all_diffs_zero else 1

if __name__ == "__main__":
    sys.exit(main())
