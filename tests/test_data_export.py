"""Tests for Reusable Data Export, Schema Conformance, and Conservation Parity.

Governed by docs/PROJECT_RULES.md:
- Rule 1 (Correctness): Window durations strictly conserve total series uptime.
- Rule 3 (Real vs Synthetic): Synthetic datasets clearly flagged with is_synthetic.
- Rule 5 (Reference frames): Parquet metadata declares MOON_ME frame.
- Rule 7 (Spherical curvature): Parquet metadata declares exact_spherical_curvature.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pyarrow.parquet as pq
import pyarrow.types as pat
import pytest

from pipeline.export_data import ARROW_SCHEMA, export_all_datasets
from scripts.validate_exported_data import (
    EXPECTED_COLUMNS,
    EXPECTED_METADATA,
    VALID_TARGETS,
    validate_catalog,
    validate_duration_conservation_against_series,
    validate_file_integrity,
    validate_parquet_schema_and_metadata,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "web" / "public" / "data"


def test_data_export_execution():
    """Verify export_all_datasets produces a complete catalog with 14 files."""
    catalog = export_all_datasets()
    assert catalog["total_files"] == 14
    assert len(catalog["files"]) == 14
    assert catalog["license_data"] == "CC-BY-4.0"
    assert catalog["license_code"] == "MIT"


def test_data_catalog_schema_and_integrity():
    """Verify catalog structure and all file SHA-256 hashes and sizes."""
    catalog = validate_catalog()
    assert catalog["version"] == "1.0.0"
    validate_file_integrity(catalog)


def test_parquet_metadata_and_types():
    """Verify Parquet tables embed MOON_ME frame, exact curvature, and schema types."""
    catalog = validate_catalog()
    validate_parquet_schema_and_metadata(catalog)

    # Spot check consolidated file
    table = pq.read_table(DATA_DIR / "all_sites_windows.parquet")
    meta = {k.decode(): v.decode() for k, v in table.schema.metadata.items()}
    assert meta["coordinate_frame"] == "MOON_ME"
    assert meta["elevation_formula"] == "exact_spherical_curvature"
    assert meta["schema_version"] == "1.0.0"
    assert meta["units_duration"] == "hours"


def test_window_duration_conservation_parity():
    """Verify sum of window durations strictly equals raw series active hours across all sites."""
    catalog = validate_catalog()
    validate_duration_conservation_against_series(catalog)


def test_csv_schema_and_rows():
    """Verify CSV header and target values."""
    csv_file = DATA_DIR / "all_sites_windows.csv"
    assert csv_file.exists()
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == EXPECTED_COLUMNS
        rows = list(reader)
        assert len(rows) > 0
        for r in rows:
            assert r["target"] in VALID_TARGETS
            assert float(r["duration_h"]) > 0
            assert r["is_synthetic"] in ("True", "False")
