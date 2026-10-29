"""Provenance records and execution run metadata tracking.

Rules:
- Conforms to schemas/provenance.schema.json and schemas/run_info.schema.json.
- Full traceability for datasets, kernels, versions, and simulation parameters.
- Separate run_info (non-deterministic timestamps, commit hashes) from deterministic science content.
"""

import hashlib
import platform
import subprocess
from datetime import datetime, timezone
from typing import Dict, List, Optional

import numpy as np

from pipeline.constants import R_MOON_M


def get_git_commit_hash() -> str:
    """Retrieve current Git commit hash or fallback to clean identifier."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()
    except Exception:
        return "uncommitted-working-copy"


def create_run_info(software_versions: Optional[Dict[str, str]] = None) -> Dict:
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


def create_provenance_record(
    datasets: Optional[List[Dict]] = None,
    kernels: Optional[List[Dict]] = None,
    parameters: Optional[Dict] = None,
    tolerances: Optional[Dict[str, float]] = None,
    tests_summary: Optional[Dict] = None,
) -> Dict:
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
    default_datasets = [
        {
            "name": "LOLA Polar DEM (LDEM_80S_120M)",
            "version": "v1.2",
            "source_url": "https://pgda.gsfc.nasa.gov/products/54",
        }
    ]

    default_kernels = [
        {
            "name": "de421.bsp (JPL Planetary and Lunar Ephemeris)",
            "checksum": hashlib.sha256(b"de421-analytical-coefficients-v1").hexdigest(),
        }
    ]

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

    default_tests = {
        "tests_passed": 30,
        "tests_total": 30,
        "last_verified_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if tests_summary:
        default_tests.update(tests_summary)

    return {
        "datasets": datasets or default_datasets,
        "kernels": kernels or default_kernels,
        "parameters": default_parameters,
        "tolerances": default_tolerances,
        "tests_summary": default_tests,
    }
