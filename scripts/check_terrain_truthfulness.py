#!/usr/bin/env python3
"""Script to verify terrain truthfulness across all published datasets.

Governed by docs/PROJECT_RULES.md:
- Rule 2: Never invent facts, coordinates, file names, or checksums.
- Rule 3: Never present synthetic data as real data.
- Any site whose terrain was not read from a real LOLA DEM file MUST have
  is_synthetic: true and terrain_source: synthetic.
- If any committed file under web/public/data contains is_synthetic: false
  or terrain_source other than synthetic for an unverified site, this script fails.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import List

import pyarrow.parquet as pq

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"
DEM_MANIFEST_PATH = ROOT_DIR / "data" / "dem_manifest.json"


def check_terrain_truthfulness() -> bool:
    print(f"=== Checking Terrain Truthfulness [{DATA_DIR}] ===")

    # Determine which sites have verified real DEMs present on disk
    real_sites = set()
    if DEM_MANIFEST_PATH.exists():
        try:
            with open(DEM_MANIFEST_PATH, "r", encoding="utf-8") as f:
                dem_manifest = json.load(f)
            entries = dem_manifest.get("files", []) if isinstance(dem_manifest, dict) else dem_manifest
            for entry in entries:
                site_id = entry.get("site_id")
                local_path = ROOT_DIR / entry.get("local_path", entry.get("file", ""))
                if site_id and local_path.exists() and local_path.is_file():
                    real_sites.add(site_id)
                    real_sites.add(site_id.replace("_", "-"))
        except Exception:
            pass

    errors: List[str] = []

    # 1. Check all JSON files under web/public/data
    for json_file in DATA_DIR.rglob("*.json"):
        rel = json_file.relative_to(ROOT_DIR)
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            errors.append(f"Failed to read JSON '{rel}': {e}")
            continue

        def check_obj(obj, path_ctx: str, current_site: str | None = None):
            if isinstance(obj, dict):
                site_ctx = obj.get("id") or obj.get("site_id") or current_site
                if "is_synthetic" in obj:
                    val = obj["is_synthetic"]
                    if val is False and (not site_ctx or site_ctx not in real_sites):
                        errors.append(
                            f"File '{rel}' ({path_ctx}): 'is_synthetic' is false for site '{site_ctx}', "
                            "but no real DEM is present."
                        )
                if "terrain_source" in obj:
                    ts = obj["terrain_source"]
                    if ts != "synthetic" and (not site_ctx or site_ctx not in real_sites):
                        errors.append(
                            f"File '{rel}' ({path_ctx}): 'terrain_source' is '{ts}' for site '{site_ctx}', "
                            "expected 'synthetic' since no real DEM is present."
                        )
                for k, v in obj.items():
                    check_obj(v, f"{path_ctx}.{k}", site_ctx)
            elif isinstance(obj, list):
                for idx, item in enumerate(obj):
                    check_obj(item, f"{path_ctx}[{idx}]", current_site)

        file_site = json_file.parent.name if json_file.parent != DATA_DIR else None
        check_obj(data, str(rel), file_site)

    # 2. Check all CSV files under web/public/data
    for csv_file in DATA_DIR.rglob("*.csv"):
        rel = csv_file.relative_to(ROOT_DIR)
        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row_idx, row in enumerate(reader):
                    site_id = row.get("site_id")
                    if site_id and site_id in real_sites:
                        continue
                    if "is_synthetic" in row and str(row["is_synthetic"]).lower() == "false":
                        errors.append(
                            f"CSV '{rel}' row {row_idx + 1}: is_synthetic is False for site '{site_id}'."
                        )
                    if "terrain_source" in row and row["terrain_source"] != "synthetic":
                        errors.append(
                            f"CSV '{rel}' row {row_idx + 1}: terrain_source is '{row['terrain_source']}' "
                            f"for site '{site_id}', expected 'synthetic'."
                        )
        except Exception as e:
            errors.append(f"Failed to read CSV '{rel}': {e}")

    # 3. Check all Parquet files under web/public/data
    for parquet_file in DATA_DIR.rglob("*.parquet"):
        rel = parquet_file.relative_to(ROOT_DIR)
        try:
            table = pq.read_table(parquet_file)
            pydict = table.to_pydict()
            num_rows = table.num_rows
            site_ids = pydict.get("site_id", ["synthetic-proving-ground"] * num_rows)
            is_synthetics = pydict.get("is_synthetic", [True] * num_rows)
            terrain_sources = pydict.get("terrain_source", ["synthetic"] * num_rows)

            for i in range(num_rows):
                s_id = site_ids[i]
                if s_id in real_sites:
                    continue
                if is_synthetics[i] is False:
                    errors.append(
                        f"Parquet '{rel}' row {i + 1}: is_synthetic is False for site '{s_id}'."
                    )
                if terrain_sources[i] != "synthetic":
                    errors.append(
                        f"Parquet '{rel}' row {i + 1}: terrain_source is '{terrain_sources[i]}' for site '{s_id}'."
                    )
        except Exception as e:
            errors.append(f"Failed to read Parquet '{rel}': {e}")

    if errors:
        print("\nTERRAIN TRUTHFULNESS INTEGRITY FAILURES DETECTED:", file=sys.stderr)
        for err in errors:
            print(f"  [X] {err}", file=sys.stderr)
        return False

    print("PASS: All published datasets strictly adhere to terrain truthfulness requirements.\n")
    return True


if __name__ == "__main__":
    success = check_terrain_truthfulness()
    sys.exit(0 if success else 1)
