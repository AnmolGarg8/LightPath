"""Verification vectors generator and cross-language mathematical parity tests.

Generates tests/vectors.json to ensure that the TypeScript web/src/lib/geometry.ts
engine is mathematically identical to the Python core pipeline.
If TypeScript and Python disagree on any vector, the build fails.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List

from pipeline.constants import R_MOON_M
from pipeline.visibility import disc_fraction_flat

ROOT_DIR = Path(__file__).resolve().parent.parent
VECTORS_FILE = ROOT_DIR / "tests" / "vectors.json"
WEB_FIXTURES_DIR = ROOT_DIR / "web" / "src" / "__tests__" / "fixtures"


def spherical_elevation_deg(
    dist_m: float,
    feature_height_m: float,
    observer_height_m: float = 0.0,
    r_moon_m: float = R_MOON_M,
) -> float:
    """Exact spherical elevation formula:

    el = atan2((R + z)*cos(theta) - (R + z0), (R + z)*sin(theta))
    """
    if dist_m == 0.0:
        return 90.0 if feature_height_m >= observer_height_m else -90.0
    theta = dist_m / r_moon_m
    r_target = r_moon_m + feature_height_m
    r_obs = r_moon_m + observer_height_m
    num = r_target * math.cos(theta) - r_obs
    den = r_target * math.sin(theta)
    return math.degrees(math.atan2(num, den))


def horizon_dip_deg(observer_height_m: float, r_moon_m: float = R_MOON_M) -> float:
    """Dip of the horizon on a smooth sphere: -acos(R / (R + h))."""
    if observer_height_m <= 0.0:
        return 0.0
    cos_val = r_moon_m / (r_moon_m + observer_height_m)
    return -math.degrees(math.acos(max(-1.0, min(1.0, cos_val))))


def generate_vectors() -> Dict[str, Any]:
    """Generate comprehensive reference test vectors across realistic ranges."""
    # 1. Elevation vectors across distance (1 to 50 km) and heights (0 to 500 m)
    elev_vectors: List[Dict[str, float]] = []
    distances_m = [1000.0, 5000.0, 10000.0, 20000.0, 35000.0, 50000.0]
    heights_m = [0.0, 50.0, 100.0, 200.0, 350.0, 500.0]
    observer_heights_m = [0.0, 2.0, 5.0]

    for d in distances_m:
        for z in heights_m:
            for z0 in observer_heights_m:
                el = spherical_elevation_deg(d, z, z0)
                elev_vectors.append({
                    "dist_m": d,
                    "feature_height_m": z,
                    "observer_height_m": z0,
                    "expected_el_deg": el,
                })

    # 2. Disc fraction vectors across offsets
    disc_vectors: List[Dict[str, float]] = []
    radii_deg = [0.267, 0.950]  # Sun ~0.267 deg radius, Earth ~0.950 deg radius
    ratios = [-2.0, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 2.0]

    for r in radii_deg:
        for ratio in ratios:
            e = ratio * r
            frac = float(disc_fraction_flat(e, r))
            disc_vectors.append({
                "e_deg": e,
                "r_deg": r,
                "expected_fraction": frac,
            })

    # 3. Horizon dip vectors
    dip_vectors: List[Dict[str, float]] = []
    mast_heights = [0.0, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0]
    for h in mast_heights:
        dip = horizon_dip_deg(h)
        dip_vectors.append({
            "observer_height_m": h,
            "expected_dip_deg": dip,
        })

    return {
        "metadata": {
            "description": "Shared mathematical verification vectors between Python and TypeScript",
            "r_moon_m": R_MOON_M,
        },
        "elevation_vectors": elev_vectors,
        "disc_vectors": disc_vectors,
        "dip_vectors": dip_vectors,
    }


def test_generate_and_verify_vectors():
    """Verify vectors and write to both tests/vectors.json and web fixtures."""
    data = generate_vectors()

    # Verify key Prompt 14 default: 100m height at 10km gives ~0.408 deg (~0.41 deg)
    vector_10km_100m = next(
        v for v in data["elevation_vectors"]
        if v["dist_m"] == 10000.0 and v["feature_height_m"] == 100.0 and v["observer_height_m"] == 0.0
    )
    assert math.isclose(vector_10km_100m["expected_el_deg"], 0.408031, abs_tol=1e-4)

    # Verify h=2m dip is -0.086937 deg
    vector_dip_2m = next(v for v in data["dip_vectors"] if v["observer_height_m"] == 2.0)
    assert math.isclose(vector_dip_2m["expected_dip_deg"], -0.086937, abs_tol=1e-4)

    # Save to tests/vectors.json
    VECTORS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(VECTORS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    # Also save to web fixtures directory for Vitest consumption
    WEB_FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    with open(WEB_FIXTURES_DIR / "vectors.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    assert VECTORS_FILE.exists()
    assert (WEB_FIXTURES_DIR / "vectors.json").exists()


if __name__ == "__main__":
    test_generate_and_verify_vectors()
    print(f"Generated {VECTORS_FILE}")
