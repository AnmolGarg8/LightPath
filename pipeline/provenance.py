"""Provenance records and execution run metadata tracking.

Rules:
- Conforms to schemas/provenance.schema.json and schemas/run_info.schema.json.
- Full traceability for datasets, kernels, versions, and simulation parameters (Rule 9).
- Rule 2: Never invent facts, coordinates, dataset values, or kernel checksums.
- Provenance must be built ONLY from files that actually exist. If no real file exists,
  records 'none (synthetic)'.
- Separate run_info (non-deterministic timestamps, commit hashes) from deterministic science content.
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from pipeline.constants import R_MOON_M

ROOT_DIR = Path(__file__).resolve().parent.parent


def get_git_commit_hash() -> str:
    """Retrieve current Git commit hash or fallback to clean identifier."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=ROOT_DIR,
        )
        return res.stdout.strip()
    except Exception:
        return "uncommitted-working-copy"


def compute_file_sha256(path: Path) -> str:
    """Compute cryptographic SHA-256 digest of a physical file."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def create_run_info(software_versions: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Create run_info record conforming to schemas/run_info.schema.json.

    Args:
        software_versions: Optional dictionary of dependency versions.

    Returns:
        Dict matching run_info schema.
    """
    versions = {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "lightpath": "0.1.0",
    }
    if software_versions:
        versions.update(software_versions)

    return {
        "created_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "git_commit": get_git_commit_hash(),
        "software_versions": versions,
    }


def build_dataset_provenance(
    layer_paths: Optional[List[Path]] = None,
    is_synthetic: bool = False,
    generator_info: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Build dataset provenance only from files that actually exist.

    If no real file exists on disk, returns an honest 'none (synthetic)' record.
    """
    records: List[Dict[str, Any]] = []
    if layer_paths:
        for p in layer_paths:
            path_obj = Path(p)
            if not path_obj.is_absolute():
                path_obj = ROOT_DIR / path_obj
            if path_obj.exists() and path_obj.is_file():
                stat = path_obj.stat()
                rel_path = str(path_obj.relative_to(ROOT_DIR)).replace("\\", "/")
                records.append({
                    "name": path_obj.name,
                    "version": "1.0",
                    "source_url": rel_path,
                    "file_path": rel_path,
                    "size_bytes": stat.st_size,
                    "sha256": compute_file_sha256(path_obj),
                })

    if not records:
        records.append({
            "name": "none (synthetic)",
            "version": "none (synthetic)",
            "source_url": "none (synthetic)",
            "generator": (generator_info or {}).get("name", "pipeline.synthetic"),
            "parameters": (generator_info or {}).get("parameters", {}),
            "code_version": "0.1.0",
        })

    return records


def build_kernel_provenance(kernel_paths: Optional[List[Path]] = None) -> List[Dict[str, Any]]:
    """Build kernel provenance only from files that actually exist.

    If no real file exists on disk, returns an honest 'none (synthetic)' record.
    """
    records: List[Dict[str, Any]] = []
    if kernel_paths:
        for p in kernel_paths:
            path_obj = Path(p)
            if not path_obj.is_absolute():
                path_obj = ROOT_DIR / path_obj
            if path_obj.exists() and path_obj.is_file():
                stat = path_obj.stat()
                rel_path = str(path_obj.relative_to(ROOT_DIR)).replace("\\", "/")
                records.append({
                    "name": path_obj.name,
                    "checksum": compute_file_sha256(path_obj),
                    "file_path": rel_path,
                    "size_bytes": stat.st_size,
                })

    if not records:
        records.append({
            "name": "none (synthetic)",
            "checksum": "none (synthetic)",
            "ephemeris_source": "analytic_approximation",
        })

    return records


def validate_provenance_files_exist(prov: Dict[str, Any], root: Optional[Path] = None) -> None:
    """Validation test: fails if any provenance entry names a file that does not exist on disk."""
    base_dir = root or ROOT_DIR

    for d in prov.get("datasets", []):
        name = d.get("name", "")
        file_path = d.get("file_path")
        if file_path:
            p = base_dir / file_path if not Path(file_path).is_absolute() else Path(file_path)
            if not p.exists():
                raise FileNotFoundError(f"Provenance dataset entry names non-existent file_path: {file_path}")
        elif name != "none (synthetic)" and name.endswith((".tif", ".tiff", ".img", ".dem")):
            p = base_dir / name if not Path(name).is_absolute() else Path(name)
            if not p.exists():
                raise FileNotFoundError(f"Provenance dataset entry names non-existent file: {name}")

    for k in prov.get("kernels", []):
        name = k.get("name", "")
        file_path = k.get("file_path")
        if file_path:
            p = base_dir / file_path if not Path(file_path).is_absolute() else Path(file_path)
            if not p.exists():
                raise FileNotFoundError(f"Provenance kernel entry names non-existent file_path: {file_path}")
        elif name != "none (synthetic)" and name.endswith((".bsp", ".tls", ".tpc", ".bpc", ".tf")):
            p = base_dir / name if not Path(name).is_absolute() else Path(name)
            if not p.exists():
                raise FileNotFoundError(f"Provenance kernel entry names non-existent file: {name}")


def create_provenance_record(
    datasets: Optional[List[Dict[str, Any]]] = None,
    kernels: Optional[List[Dict[str, Any]]] = None,
    parameters: Optional[Dict[str, Any]] = None,
    tolerances: Optional[Dict[str, float]] = None,
    tests_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create provenance record conforming to schemas/provenance.schema.json.

    Args:
        datasets: List of dataset provenance objects {name, version, source_url}.
        kernels: List of kernel/ephemeris records {name, checksum}.
        parameters: Deterministic simulation parameters.
        tolerances: Numerical integration tolerances.
        tests_summary: Test verification summary {tests_passed, tests_total, last_verified_utc}.

    Returns:
        Dict matching provenance schema.
    """
    if not datasets:
        datasets = build_dataset_provenance()

    if not kernels:
        kernels = build_kernel_provenance()

    default_parameters = {
        "r_moon_m": R_MOON_M,
        "coordinate_frame": "MOON_ME",
        "elevation_formula": "exact_spherical_curvature",
    }
    if parameters:
        default_parameters.update(parameters)

    default_tolerances = {
        "az_step_deg": 1.0,
        "disc_quadrature_samples": 37.0,
    }
    if tolerances:
        default_tolerances.update(tolerances)

    if not tests_summary:
        results_file = ROOT_DIR / "tests" / "results.json"
        if results_file.exists():
            try:
                with open(results_file, "r", encoding="utf-8") as f:
                    res_data = json.load(f)
                tests_summary = {
                    "tests_passed": res_data.get("counts", {}).get("passed", 0),
                    "tests_total": res_data.get("counts", {}).get("total", 0),
                    "last_verified_utc": res_data.get("timestamp", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
                }
            except Exception:
                tests_summary = {
                    "tests_passed": 0,
                    "tests_total": 0,
                    "last_verified_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
        else:
            tests_summary = {
                "tests_passed": 0,
                "tests_total": 0,
                "last_verified_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

    prov_record = {
        "datasets": datasets,
        "kernels": kernels,
        "parameters": default_parameters,
        "tolerances": default_tolerances,
        "tests_summary": tests_summary,
    }

    # Verify no non-existent files are claimed
    validate_provenance_files_exist(prov_record)

    return prov_record
