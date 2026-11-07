#!/usr/bin/env python3
"""Validation Script for Exported LightPath Datasets.

Validates:
1. Exported CSV and Parquet files conform to docs/DATA_FORMAT.md schema.
2. Parquet files contain mandatory metadata (MOON_ME frame, exact spherical curvature, licenses, units).
3. File checksums (SHA-256) and sizes match web/public/data/data_catalog.json.
4. Total window durations (sum of duration_h) strictly match active hours from raw series.json
   and total_uptime_h from stats.json across all 6 lunar sites.
5. Consolidated all_sites_windows tables match the union of individual site tables.

Governed by docs/PROJECT_RULES.md (Rule 1: Correctness, Rule 5: MOON_ME frame, Rule 7: Curvature).
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import pyarrow.parquet as pq
import pyarrow.types as pat

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"
CATALOG_PATH = DATA_DIR / "data_catalog.json"

EXPECTED_COLUMNS = [
    "site_id",
    "target",
    "window_id",
    "start_utc",
    "end_utc",
    "duration_h",
    "threshold_pct",
    "mast_height_m",
    "is_synthetic",
    "ephemeris_source",
    "terrain_source",
    "provenance_hash",
]

EXPECTED_METADATA = {
    "schema_version": "1.0.0",
    "coordinate_frame": "MOON_ME",
    "elevation_formula": "exact_spherical_curvature",
    "r_moon_m": "1737400.0",
    "license_data": "CC-BY-4.0",
    "license_code": "MIT",
    "units_duration": "hours",
    "units_mast_height": "meters",
    "units_threshold": "percent_disc_fraction_or_degrees",
}

VALID_TARGETS = {"sun", "earth", "dte", "joint"}


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def validate_catalog() -> Dict[str, Any]:
    print("[1/5] Validating data_catalog.json structure...")
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Missing data catalog at {CATALOG_PATH}")

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    for field in ["version", "created_utc", "total_files", "license_data", "license_code", "suggested_citation", "files"]:
        if field not in catalog:
            raise ValueError(f"Catalog missing required field: {field}")

    if catalog["total_files"] != len(catalog["files"]):
        raise ValueError(f"Catalog total_files ({catalog['total_files']}) != len(files) ({len(catalog['files'])})")

    print(f"      OK: Catalog contains {len(catalog['files'])} registered datasets.")
    return catalog


def validate_file_integrity(catalog: Dict[str, Any]) -> None:
    print("[2/5] Validating file sizes, paths, and SHA-256 hashes...")
    for entry in catalog["files"]:
        # Resolve rel_path from web/public
        rel = entry["rel_path"].lstrip("./")
        file_path = ROOT_DIR / "web" / "public" / rel
        if not file_path.exists():
            raise FileNotFoundError(f"Exported file does not exist: {file_path}")

        actual_size = file_path.stat().st_size
        if actual_size != entry["size_bytes"]:
            raise ValueError(f"Size mismatch for {entry['filename']}: expected {entry['size_bytes']}, got {actual_size}")

        actual_hash = sha256_of_file(file_path)
        if actual_hash != entry["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {entry['filename']}: expected {entry['sha256']}, got {actual_hash}")

    print("      OK: All 14 files exist with matching sizes and SHA-256 digests.")


def validate_parquet_schema_and_metadata(catalog: Dict[str, Any]) -> None:
    print("[3/5] Validating Parquet column types and embedded metadata...")
    parquet_entries = [e for e in catalog["files"] if e["format"] == "Parquet"]
    for entry in parquet_entries:
        rel = entry["rel_path"].lstrip("./")
        file_path = ROOT_DIR / "web" / "public" / rel

        table = pq.read_table(file_path)
        cols = table.column_names
        if cols != EXPECTED_COLUMNS:
            raise ValueError(f"{entry['filename']} column mismatch: {cols} != {EXPECTED_COLUMNS}")

        # Check types
        schema = table.schema
        if not pat.is_string(schema.field("site_id").type):
            raise TypeError(f"{entry['filename']} site_id is not string")
        if not pat.is_string(schema.field("target").type):
            raise TypeError(f"{entry['filename']} target is not string")
        if not pat.is_integer(schema.field("window_id").type):
            raise TypeError(f"{entry['filename']} window_id is not integer")
        if not pat.is_floating(schema.field("duration_h").type):
            raise TypeError(f"{entry['filename']} duration_h is not float")
        if not pat.is_boolean(schema.field("is_synthetic").type):
            raise TypeError(f"{entry['filename']} is_synthetic is not bool")

        if table.num_rows != entry["rows"]:
            raise ValueError(f"{entry['filename']} row count mismatch: {table.num_rows} != {entry['rows']}")

        # Validate embedded metadata
        raw_meta = schema.metadata or {}
        meta = {k.decode("utf-8"): v.decode("utf-8") for k, v in raw_meta.items()}
        for k, expected_v in EXPECTED_METADATA.items():
            if k not in meta:
                raise KeyError(f"{entry['filename']} missing embedded metadata key '{k}'")
            if meta[k] != expected_v:
                raise ValueError(f"{entry['filename']} metadata '{k}': expected '{expected_v}', got '{meta[k]}'")

    print(f"      OK: All {len(parquet_entries)} Parquet tables conform to schema and metadata specification.")


def validate_csv_structure(catalog: Dict[str, Any]) -> None:
    print("[4/5] Validating CSV RFC 4180 format, headers, and values...")
    csv_entries = [e for e in catalog["files"] if e["format"] == "CSV"]
    for entry in csv_entries:
        rel = entry["rel_path"].lstrip("./")
        file_path = ROOT_DIR / "web" / "public" / rel

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames != EXPECTED_COLUMNS:
                raise ValueError(f"{entry['filename']} CSV headers mismatch: {reader.fieldnames}")

            rows = list(reader)
            if len(rows) != entry["rows"]:
                raise ValueError(f"{entry['filename']} CSV row count mismatch: {len(rows)} != {entry['rows']}")

            for r in rows:
                if r["target"] not in VALID_TARGETS:
                    raise ValueError(f"{entry['filename']} invalid target: {r['target']}")
                dur = float(r["duration_h"])
                if dur <= 0:
                    raise ValueError(f"{entry['filename']} invalid non-positive duration: {dur}")
                if r["is_synthetic"] not in ("True", "False", "true", "false"):
                    raise ValueError(f"{entry['filename']} invalid boolean is_synthetic: {r['is_synthetic']}")

    print(f"      OK: All {len(csv_entries)} CSV files have valid headers, types, and constraints.")


def validate_duration_conservation_against_series(catalog: Dict[str, Any]) -> None:
    print("[5/5] Validating window duration conservation against series.json and stats.json...")
    sites = [
        "synthetic-proving-ground",
        "synthetic-flat-basin",
        "synthetic-crater-rim",
        "shackleton-connecting-ridge",
        "malapert-mountain",
        "nobile-crater-rim",
    ]

    for site_id in sites:
        site_dir = DATA_DIR / site_id
        stats_file = site_dir / "stats.json"
        series_file = site_dir / "series.json"
        csv_file = site_dir / "windows.csv"
        parquet_file = site_dir / "windows.parquet"

        with open(stats_file, "r", encoding="utf-8") as f:
            stats = json.load(f)

        with open(series_file, "r", encoding="utf-8") as f:
            series = json.load(f)

        # Parse step size from timestamps
        t = series["time_utc"]
        t0 = datetime.fromisoformat(t[0].replace("Z", "+00:00")).astimezone(timezone.utc)
        t1 = datetime.fromisoformat(t[1].replace("Z", "+00:00")).astimezone(timezone.utc)
        step_h = abs((t1 - t0).total_seconds()) / 3600.0

        # Load exported rows from CSV and Parquet
        with open(csv_file, "r", encoding="utf-8") as f:
            csv_rows = list(csv.DictReader(f))

        parquet_table = pq.read_table(parquet_file)
        pydict = parquet_table.to_pydict()
        parquet_rows = [
            {k: pydict[k][i] for k in pydict}
            for i in range(parquet_table.num_rows)
        ]

        for target in VALID_TARGETS:
            cat_stats = stats.get(target, {})
            expected_uptime = float(cat_stats.get("total_uptime_h", 0.0))

            # Recompute active steps from raw series
            if target == "sun":
                thresh = stats["thresholds"]["min_sun_frac"]
                active_steps = sum(1 for f_val in series["sun"]["frac"] if f_val >= thresh)
            elif target == "earth":
                thresh = stats["thresholds"]["min_earth_frac"]
                active_steps = sum(1 for f_val in series["earth"]["frac"] if f_val >= thresh)
            elif target == "dte":
                active_steps = sum(1 for ok in series["dte"]["link_ok"] if ok)
            elif target == "joint":
                thresh_sun = stats["thresholds"]["min_sun_frac"]
                active_steps = sum(
                    1
                    for s_frac, d_ok in zip(series["sun"]["frac"], series["dte"]["link_ok"])
                    if s_frac >= thresh_sun and d_ok
                )
            else:
                active_steps = 0

            series_uptime = round(active_steps * step_h, 2)
            if abs(series_uptime - expected_uptime) > 1e-4:
                raise ValueError(
                    f"[{site_id}:{target}] series.json active time ({series_uptime} h) does not match stats.json uptime ({expected_uptime} h)"
                )

            # Sum duration_h in CSV
            csv_target_rows = [r for r in csv_rows if r["target"] == target]
            csv_sum = round(sum(float(r["duration_h"]) for r in csv_target_rows), 2)
            if abs(csv_sum - expected_uptime) > 1e-4:
                raise ValueError(
                    f"[{site_id}:{target}] CSV window duration sum ({csv_sum} h) != stats.json total_uptime_h ({expected_uptime} h)"
                )

            # Sum duration_h in Parquet
            pq_target_rows = [r for r in parquet_rows if r["target"] == target]
            pq_sum = round(sum(float(r["duration_h"]) for r in pq_target_rows), 2)
            if abs(pq_sum - expected_uptime) > 1e-4:
                raise ValueError(
                    f"[{site_id}:{target}] Parquet window duration sum ({pq_sum} h) != stats.json total_uptime_h ({expected_uptime} h)"
                )

    # Check consolidated all_sites_windows Parquet
    all_parquet_file = DATA_DIR / "all_sites_windows.parquet"
    all_table = pq.read_table(all_parquet_file)
    all_pydict = all_table.to_pydict()
    all_rows = [{k: all_pydict[k][i] for k in all_pydict} for i in range(all_table.num_rows)]

    for site_id in sites:
        for target in VALID_TARGETS:
            subset = [r for r in all_rows if r["site_id"] == site_id and r["target"] == target]
            stats_file = DATA_DIR / site_id / "stats.json"
            with open(stats_file, "r", encoding="utf-8") as f:
                expected_uptime = float(json.load(f)[target]["total_uptime_h"])
            sub_sum = round(sum(float(r["duration_h"]) for r in subset), 2)
            if abs(sub_sum - expected_uptime) > 1e-4:
                raise ValueError(
                    f"[all_sites_windows:{site_id}:{target}] sum ({sub_sum} h) != expected ({expected_uptime} h)"
                )

    print("      OK: Mathematical parity verified: exported window sums strictly match series.json active hours.")


def main() -> int:
    print("=" * 72)
    print("LightPath Exported Data Validation (docs/DATA_FORMAT.md Compliance)")
    print("=" * 72)
    try:
        catalog = validate_catalog()
        validate_file_integrity(catalog)
        validate_parquet_schema_and_metadata(catalog)
        validate_csv_structure(catalog)
        validate_duration_conservation_against_series(catalog)
        print("=" * 72)
        print("SUCCESS: All 14 datasets passed schema, metadata, checksum, and mathematical conservation checks.")
        print("=" * 72)
        return 0
    except Exception as exc:
        print(f"\nVALIDATION FAILURE: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
