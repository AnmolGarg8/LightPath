"""Unit tests for pipeline.provenance module and scripts/check_provenance.py."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import validate

from pipeline.provenance import create_provenance_record, create_run_info

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
