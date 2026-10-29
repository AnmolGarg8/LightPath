"""Unit tests for pipeline.provenance module."""

import json
from pathlib import Path

from jsonschema import validate

from pipeline.provenance import create_provenance_record, create_run_info

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"


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
