#!/usr/bin/env python3
"""Verification Script for Data Catalog Integrity.

Verifies:
1. data_catalog.json references existing files on disk.
2. File sizes in catalog exactly match physical byte counts on disk.
3. Cryptographic SHA-256 digests in catalog exactly match file contents on disk.
4. Row counts match physical rows in CSV and Parquet files.
5. Total registered file count matches catalog['total_files'].

Governed by docs/PROJECT_RULES.md (Rule 1: Correctness before features; Rule 2: Never invent facts/hashes).
"""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict

import pyarrow.parquet as pq

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"
CATALOG_PATH = DATA_DIR / "data_catalog.json"


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def check_catalog(catalog_path: Path = CATALOG_PATH) -> bool:
    print(f"=== Checking Data Catalog Integrity [{catalog_path}] ===")
    if not catalog_path.exists():
        print(f"ERROR: Data catalog file missing at: {catalog_path}", file=sys.stderr)
        return False

    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog: Dict[str, Any] = json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to parse catalog JSON: {e}", file=sys.stderr)
        return False

    files = catalog.get("files", [])
    total_files = catalog.get("total_files", 0)
    if total_files != len(files):
        print(
            f"ERROR: Catalog total_files ({total_files}) does not match len(files) ({len(files)})",
            file=sys.stderr,
        )
        return False

    errors = []

    for entry in files:
        rel_path = entry.get("rel_path", "").lstrip("./")
        # Relative to web/public or repo root
        file_path = ROOT_DIR / "web" / "public" / rel_path
        if not file_path.exists():
            # Try direct relative to repo root
            file_path = ROOT_DIR / rel_path
        if not file_path.exists():
            errors.append(f"Missing physical file for entry '{entry.get('filename')}': {file_path}")
            continue

        # 1. Size check
        actual_size = file_path.stat().st_size
        expected_size = entry.get("size_bytes")
        if actual_size != expected_size:
            errors.append(
                f"Size mismatch for '{entry.get('filename')}': expected {expected_size} bytes, got {actual_size} bytes"
            )

        # 2. SHA-256 check
        actual_sha = compute_sha256(file_path)
        expected_sha = entry.get("sha256")
        if actual_sha.lower() != str(expected_sha).lower():
            errors.append(
                f"SHA-256 mismatch for '{entry.get('filename')}':\n"
                f"  Expected: {expected_sha}\n"
                f"  Actual:   {actual_sha}"
            )

        # 3. Row count check
        fmt = entry.get("format", "").upper()
        expected_rows = entry.get("rows")
        if fmt == "CSV":
            try:
                with open(file_path, "r", encoding="utf-8") as cf:
                    reader = csv.reader(cf)
                    next(reader, None)
                    actual_rows = sum(1 for _ in reader)
                if expected_rows is not None and actual_rows != expected_rows:
                    errors.append(
                        f"CSV row count mismatch for '{entry.get('filename')}': expected {expected_rows}, got {actual_rows}"
                    )
            except Exception as e:
                errors.append(f"Failed to read CSV '{file_path}': {e}")
        elif fmt == "PARQUET":
            try:
                table = pq.read_table(file_path)
                actual_rows = table.num_rows
                if expected_rows is not None and actual_rows != expected_rows:
                    errors.append(
                        f"Parquet row count mismatch for '{entry.get('filename')}': expected {expected_rows}, got {actual_rows}"
                    )
            except Exception as e:
                errors.append(f"Failed to read Parquet '{file_path}': {e}")

    if errors:
        print("\nDATA CATALOG INTEGRITY FAILURES DETECTED:", file=sys.stderr)
        for err in errors:
            print(f"  [X] {err}", file=sys.stderr)
        return False

    print(f"PASS: All {len(files)} catalog files verified against disk with matching sizes, checksums, and row counts.\n")
    return True


if __name__ == "__main__":
    success = check_catalog()
    sys.exit(0 if success else 1)
