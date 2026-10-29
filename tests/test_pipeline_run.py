"""Tests for pipeline execution, schema validation, caching, and V6 determinism."""

import gzip
import json
import os
import struct
from pathlib import Path

import jsonschema
import pytest

from pipeline.run import compute_file_sha256, run_pipeline

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIGS_DIR = ROOT_DIR / "configs"
SCHEMAS_DIR = ROOT_DIR / "schemas"
DATA_DIR = ROOT_DIR / "web" / "public" / "data"


def test_real_mode_preflight_refusal():
    """Verify that mode 'real' cleanly refuses to run when kernels or DEMs are missing."""
    config_path = CONFIGS_DIR / "pipeline.yaml"
    with pytest.raises(SystemExit) as exc_info:
        run_pipeline(config_path, mode="real")
    assert exc_info.value.code == 1


def test_synthetic_pipeline_outputs_and_schemas():
    """Verify that synthetic pipeline produces all expected files and validates schemas."""
    config_path = CONFIGS_DIR / "synthetic.yaml"
    # Ensure outputs exist
    run_pipeline(config_path, mode="synthetic", site_id_filter="synthetic-proving-ground")

    # 1. Check index.json
    index_path = DATA_DIR / "index.json"
    assert index_path.exists()
    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)
    with open(SCHEMAS_DIR / "index.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=index_data, schema=json.load(f))
    assert index_data["is_synthetic"] is True

    # 2. Check site full data (sites/synthetic-proving-ground.json)
    site_path = DATA_DIR / "sites" / "synthetic-proving-ground.json"
    assert site_path.exists()
    with open(site_path, "r", encoding="utf-8") as f:
        site_data = json.load(f)
    with open(SCHEMAS_DIR / "site.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=site_data, schema=json.load(f))
    assert site_data["is_synthetic"] is True
    assert "stats" in site_data
    assert "sensitivities" in site_data
    assert len(site_data["sensitivities"]["mast_height"]) > 0

    # 3. Check cube header (cubes/synthetic-proving-ground.json)
    cube_hdr_path = DATA_DIR / "cubes" / "synthetic-proving-ground.json"
    assert cube_hdr_path.exists()
    with open(cube_hdr_path, "r", encoding="utf-8") as f:
        cube_hdr = json.load(f)
    with open(SCHEMAS_DIR / "visibility_cube.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=cube_hdr, schema=json.load(f))
    assert "cell_cap_explanation" in cube_hdr

    # 4. Check manifest.json
    manifest_path = DATA_DIR / "manifest.json"
    assert manifest_path.exists()
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)
    with open(SCHEMAS_DIR / "manifest.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=manifest_data, schema=json.load(f))
    assert manifest_data["is_synthetic"] is True
    assert len(manifest_data["files"]) > 0

    # 5. Check provenance.json and run_info.json
    prov_path = DATA_DIR / "synthetic-proving-ground" / "provenance.json"
    assert prov_path.exists()
    with open(prov_path, "r", encoding="utf-8") as f:
        prov_data = json.load(f)
    with open(SCHEMAS_DIR / "provenance.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=prov_data, schema=json.load(f))

    run_info_path = DATA_DIR / "synthetic-proving-ground" / "run_info.json"
    assert run_info_path.exists()
    with open(run_info_path, "r", encoding="utf-8") as f:
        run_info_data = json.load(f)
    with open(SCHEMAS_DIR / "run_info.schema.json", "r", encoding="utf-8") as f:
        jsonschema.validate(instance=run_info_data, schema=json.load(f))


def test_binary_visibility_cube_structure():
    """Verify compressed binary visibility cube format, magic header, and dimensions."""
    cube_bin_path = DATA_DIR / "cubes" / "synthetic-proving-ground.bin"
    assert cube_bin_path.exists()

    with open(cube_bin_path, "rb") as f:
        decompressed = gzip.decompress(f.read())

    # Header: Magic(4s), version(H), nx(H), ny(H), nt(H) -> 12 bytes
    assert len(decompressed) >= 12
    magic, version, nx, ny, nt = struct.unpack("<4sHHHH", decompressed[:12])

    assert magic == b"LPVC"
    assert version == 1
    assert nx > 0
    assert ny > 0
    assert nt > 0

    # Payload sizes:
    # sun_frac: nt * ny * nx (uint8)
    # earth_frac: nt * ny * nx (uint8)
    # slope: ny * nx (uint8)
    # traversable: ny * nx (uint8)
    expected_payload = (2 * nt * ny * nx) + (2 * ny * nx)
    assert len(decompressed[12:]) == expected_payload


def test_v6_determinism_byte_identical():
    """V6 Determinism: Two repeated synthetic runs must yield byte-identical data files.

    Strict separation requirement: All simulation data files (horizon, series, stats,
    cube header, cube bin, site, index, manifest, provenance) must have IDENTICAL SHA-256 hashes.
    Only run_info.json carries execution-time metadata.
    """
    config_path = CONFIGS_DIR / "synthetic.yaml"

    # Run 1 (forced recompute)
    run_pipeline(config_path, mode="synthetic", site_id_filter="synthetic-proving-ground", force=True)

    # Collect hashes
    hashes_run1 = {}
    for root, _, files in os.walk(DATA_DIR):
        for file in files:
            p = Path(root) / file
            rel = str(p.relative_to(DATA_DIR)).replace("\\", "/")
            if not rel.endswith("run_info.json") and not rel.endswith(".cache_key"):
                hashes_run1[rel] = compute_file_sha256(p)

    # Run 2 (forced recompute)
    run_pipeline(config_path, mode="synthetic", site_id_filter="synthetic-proving-ground", force=True)

    hashes_run2 = {}
    for root, _, files in os.walk(DATA_DIR):
        for file in files:
            p = Path(root) / file
            rel = str(p.relative_to(DATA_DIR)).replace("\\", "/")
            if not rel.endswith("run_info.json") and not rel.endswith(".cache_key"):
                hashes_run2[rel] = compute_file_sha256(p)

    # Assert 100% byte match on all non-run_info files
    assert set(hashes_run1.keys()) == set(hashes_run2.keys())
    for rel_path, hash1 in hashes_run1.items():
        assert hashes_run2[rel_path] == hash1, f"Determinism failure for {rel_path}: {hashes_run2[rel_path]} != {hash1}"



def test_trust_results_json():
    """Verify tests/results.json format for the Trust page."""
    results_path = ROOT_DIR / "tests" / "results.json"
    assert results_path.exists()

    with open(results_path, "r", encoding="utf-8") as f:
        res = json.load(f)

    assert res["status"] in ("passed", "failed")
    assert "counts" in res
    assert res["counts"]["passed"] >= 80
    assert "failures" in res
    assert "timestamp" in res
    assert "checks" in res
    assert len(res["checks"]) >= 5
