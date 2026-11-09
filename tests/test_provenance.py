"""Unit tests for pipeline.provenance module and scripts/check_provenance.py."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from jsonschema import validate

from pipeline.provenance import (
    create_provenance_record,
    create_run_info,
    validate_provenance_files_exist,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT_DIR / "schemas"
CHECK_SCRIPT = ROOT_DIR / "scripts" / "check_provenance.py"


def test_provenance_schema_compliance():
    with open(SCHEMAS_DIR / "provenance.schema.json", "r", encoding="utf-8") as f:
        prov_schema = json.load(f)

    record = create_provenance_record(
        parameters={"az_step_deg": 1.0, "r_moon_m": 1737400.0},
        tolerances={"disc_tolerance": 1e-4},
    )
    validate(instance=record, schema=prov_schema)


def test_run_info_schema_compliance():
    with open(SCHEMAS_DIR / "run_info.schema.json", "r", encoding="utf-8") as f:
        run_schema = json.load(f)

    info = create_run_info({"numpy": "2.5.4"})
    validate(instance=info, schema=run_schema)


def test_check_provenance_script_passes_on_repo_files():
    """Verify that check_provenance.py succeeds with code 0 on repository data files."""
    proc = subprocess.run(
        [sys.executable, str(CHECK_SCRIPT)],
        capture_output=True,
        text=True,
        cwd=ROOT_DIR,
    )
    assert proc.returncode == 0, f"check_provenance.py failed unexpectedly:\n{proc.stdout}\n{proc.stderr}"
    assert "PASS: All" in proc.stdout
    assert "unverified (Rule 2: human verification required)" in proc.stdout


def test_check_provenance_script_fails_on_missing_source():
    """Verify that check_provenance.py exits with code 1 if an entry lacks source fields."""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        bad_data = [
            {
                "id": "bad-mission",
                "name": "Mission without source",
                "operator": "Mystery Operator",
                # Missing source_label, source_url, retrieved_on, verified, notes
            }
        ]
        json.dump(bad_data, tf)
        bad_path = Path(tf.name)

    try:
        proc = subprocess.run(
            [sys.executable, str(CHECK_SCRIPT), "--file", str(bad_path)],
            capture_output=True,
            text=True,
            cwd=ROOT_DIR,
        )
        assert proc.returncode == 1, "check_provenance.py should fail when source fields are missing"
        assert "FAIL: 5 provenance error(s) detected" in proc.stdout
        assert "Missing required source field 'source_label'" in proc.stdout
    finally:
        bad_path.unlink(missing_ok=True)


def test_provenance_rejects_nonexistent_files():
    """Verify that validate_provenance_files_exist fails if any entry names a non-existent file."""
    # Test dataset with non-existent file
    prov_bad_dataset = {
        "datasets": [{"name": "non_existent_dem.tif", "file_path": "data/raw/non_existent.tif"}],
        "kernels": [],
    }
    with pytest.raises(FileNotFoundError, match="non-existent"):
        validate_provenance_files_exist(prov_bad_dataset)

    # Test kernel with non-existent file
    prov_bad_kernel = {
        "datasets": [],
        "kernels": [{"name": "fake_kernel.bsp", "file_path": "kernels/fake_de440.bsp"}],
    }
    with pytest.raises(FileNotFoundError, match="non-existent"):
        validate_provenance_files_exist(prov_bad_kernel)

    # Test synthetic records pass
    prov_synthetic = create_provenance_record()
    validate_provenance_files_exist(prov_synthetic)


def test_provenance_rejects_checksum_mismatch(tmp_path):
    """Verify that validate_provenance_files_exist fails if an existing file has a corrupted checksum."""
    fake_kernel = tmp_path / "fake_kernel.tls"
    fake_kernel.write_text("KPL/FK\nFAKE", encoding="utf-8")

    prov_corrupted = {
        "datasets": [],
        "kernels": [
            {
                "name": fake_kernel.name,
                "file_path": str(fake_kernel),
                "checksum": "0000000000000000000000000000000000000000000000000000000000000000",
            }
        ],
    }
    with pytest.raises(ValueError, match="checksum mismatch"):
        validate_provenance_files_exist(prov_corrupted, root=tmp_path)


@pytest.mark.requires_kernels
def test_committed_provenance_files_exist_and_hashes_match():
    """Verify that every provenance.json in web/public/data references only existing files with exact SHA-256."""
    data_dir = ROOT_DIR / "web" / "public" / "data"
    prov_files = list(data_dir.rglob("provenance.json"))
    assert len(prov_files) > 0, "No provenance.json files found"

    for pf in prov_files:
        with open(pf, "r", encoding="utf-8") as f:
            prov = json.load(f)
        validate_provenance_files_exist(prov, root=ROOT_DIR)


