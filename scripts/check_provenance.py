#!/usr/bin/env python3
"""Provenance and Data Source Verification Script.

Governed by docs/PROJECT_RULES.md (Rule 1, Rule 2, Rule 3).

Enforces:
1. Every mission, site, and ground station entry MUST have all 5 required source fields:
   - source_label (non-empty string)
   - source_url (string)
   - retrieved_on (string date or placeholder)
   - verified (boolean, true only when confirmed by a human)
   - notes (string)
2. Fails the build (exit code 1) if any displayed entry is missing any required source field.
3. Warns prominently about entries that are unverified (verified == False).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent

REQUIRED_SOURCE_FIELDS = [
    "source_label",
    "source_url",
    "retrieved_on",
    "verified",
    "notes",
]

DEFAULT_FILES_TO_CHECK = [
    ROOT_DIR / "data" / "missions.json",
    ROOT_DIR / "configs" / "pipeline.yaml",
    ROOT_DIR / "configs" / "synthetic.yaml",
    ROOT_DIR / "configs" / "dsn_stations.yaml",
    ROOT_DIR / "web" / "public" / "data" / "index.json",
    ROOT_DIR / "web" / "public" / "data" / "sites.json",
]


def check_entry(entry: Dict[str, Any], entry_type: str, file_path: Path) -> Tuple[List[str], bool]:
    """Check an individual entry for required source fields and verification status.

    Returns:
        (errors, is_unverified)
    """
    errors: List[str] = []
    entry_id = entry.get("id") or entry.get("name") or "unknown_id"

    for field in REQUIRED_SOURCE_FIELDS:
        if field not in entry:
            errors.append(f"Missing required source field '{field}' in {entry_type} '{entry_id}' ({file_path.name})")
        elif field == "source_label" and not str(entry[field]).strip():
            errors.append(f"Empty 'source_label' in {entry_type} '{entry_id}' ({file_path.name})")
        elif field == "verified" and not isinstance(entry[field], bool):
            errors.append(f"'verified' must be a boolean in {entry_type} '{entry_id}' ({file_path.name})")

    is_unverified = not entry.get("verified", False)
    return errors, is_unverified


def check_file(file_path: Path) -> Tuple[int, int, List[str], List[str]]:
    """Check a JSON or YAML file for entries and validate their provenance fields.

    Returns:
        (entries_count, unverified_count, errors, warnings)
    """
    if not file_path.exists():
        return 0, 0, [f"File not found: {file_path}"], []

    errors: List[str] = []
    warnings: List[str] = []
    entries_count = 0
    unverified_count = 0

    suffix = file_path.suffix.lower()
    try:
        if suffix in (".yaml", ".yml"):
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        elif suffix == ".json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            return 0, 0, [f"Unsupported file format: {file_path}"], []
    except Exception as exc:
        return 0, 0, [f"Failed to parse {file_path}: {exc}"], []

    # Extract entries based on file structure
    entries_to_check: List[Tuple[Dict[str, Any], str]] = []

    if isinstance(data, list):
        # Array of items (e.g. data/missions.json or sites.json)
        for item in data:
            if isinstance(item, dict):
                item_type = "mission" if "operator" in item else "site"
                entries_to_check.append((item, item_type))
    elif isinstance(data, dict):
        if "stations" in data and isinstance(data["stations"], list):
            for station in data["stations"]:
                if isinstance(station, dict):
                    entries_to_check.append((station, "ground_station"))
        if "sites" in data and isinstance(data["sites"], list):
            for site in data["sites"]:
                if isinstance(site, dict):
                    entries_to_check.append((site, "site"))
        if "missions" in data and isinstance(data["missions"], list):
            for mission in data["missions"]:
                if isinstance(mission, dict):
                    entries_to_check.append((mission, "mission"))

    for entry, entry_type in entries_to_check:
        entries_count += 1
        entry_errors, is_unverified = check_entry(entry, entry_type, file_path)
        if entry_errors:
            errors.extend(entry_errors)
        if is_unverified:
            unverified_count += 1
            entry_id = entry.get("id") or entry.get("name") or "unknown"
            warnings.append(f"[UNVERIFIED] {entry_type.upper()} '{entry_id}' in {file_path.name} is marked verified=false")

    return entries_count, unverified_count, errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Check provenance fields for missions, sites, and ground stations.")
    parser.add_argument(
        "--file",
        type=Path,
        help="Optional single file to check (defaults to all standard repository data files)",
    )
    args = parser.parse_args()

    files = [args.file] if args.file else DEFAULT_FILES_TO_CHECK

    print("=== LightPath Provenance & Data Traceability Auditor ===")
    total_entries = 0
    total_unverified = 0
    all_errors: List[str] = []
    all_warnings: List[str] = []

    for f in files:
        if not f.exists():
            all_errors.append(f"Required data file does not exist: {f}")
            continue
        count, unverified, errors, warnings = check_file(f)
        total_entries += count
        total_unverified += unverified
        all_errors.extend(errors)
        all_warnings.extend(warnings)
        print(f"Checked {f.name}: {count} entries ({unverified} unverified, {len(errors)} missing source fields)")

    print("-" * 60)
    for warn in all_warnings:
        print(f"  WARNING: {warn}")

    if all_errors:
        print("-" * 60)
        print(f"FAIL: {len(all_errors)} provenance error(s) detected:")
        for err in all_errors:
            print(f"  ERROR: {err}")
        print("\nBUILD FAILED: Displayed entries must include all 5 required source fields:")
        print("  - source_label, source_url, retrieved_on, verified, notes")
        return 1

    print("-" * 60)
    print(f"PASS: All {total_entries} entries across {len(files)} files are fully sourced.")
    print(f"Notice: {total_unverified} entries are currently unverified (Rule 2: human verification required).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
