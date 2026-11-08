#!/usr/bin/env python3
"""Step 7.4: Prove SPICE kernels work and verify orientation/coverage.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/results).
"""

import datetime
import sys
from pathlib import Path

import numpy as np
import spiceypy

ROOT = Path(__file__).resolve().parent.parent
KERNELS_DIR = ROOT / "kernels"
LOGS_DIR = ROOT / "logs"

LOGS_DIR.mkdir(parents=True, exist_ok=True)

META_KERNEL = KERNELS_DIR / "meta.tm"

def get_spk_coverage(spk_path: Path, body_id: int):
    cover = spiceypy.stypes.SPICEDOUBLE_CELL(2000)
    spiceypy.spkcov(str(spk_path), body_id, cover)
    intervals = []
    count = spiceypy.wncard(cover)
    for i in range(count):
        left, right = spiceypy.wnfetd(cover, i)
        intervals.append((left, right))
    return intervals

def get_pck_coverage(pck_path: Path, body_id: int):
    cover = spiceypy.stypes.SPICEDOUBLE_CELL(2000)
    spiceypy.pckcov(str(pck_path), body_id, cover)
    intervals = []
    count = spiceypy.wncard(cover)
    for i in range(count):
        left, right = spiceypy.wnfetd(cover, i)
        intervals.append((left, right))
    return intervals

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 7.4: Check SPICE Kernels & Prove Math Correctness ({now}) ===\n")

    if not META_KERNEL.exists():
        log(f"ERROR: Meta-kernel {META_KERNEL} does not exist!")
        sys.exit(1)

    log(f"Loading meta-kernel: {META_KERNEL.relative_to(ROOT)}...")
    spiceypy.kclear()
    spiceypy.furnsh(str(META_KERNEL))
    log("  [PASS] Successfully furnished meta-kernel without errors.\n")

    # Check SPK Coverage
    spk_path = KERNELS_DIR / "de421.bsp"
    log(f"--- SPK Coverage Analysis ({spk_path.name}) ---")
    bodies = {
        10: "Sun (10)",
        399: "Earth (399)",
        301: "Moon (301)",
    }

    req_start_et = spiceypy.str2et("2026-11-01T00:00:00")
    req_stop_et = spiceypy.str2et("2027-12-31T23:59:59")

    for bid, bname in bodies.items():
        intervals = get_spk_coverage(spk_path, bid)
        log(f"Body: {bname}")
        for left, right in intervals:
            utc_left = spiceypy.et2utc(left, "ISOC", 3)
            utc_right = spiceypy.et2utc(right, "ISOC", 3)
            covers_req = (left <= req_start_et) and (right >= req_stop_et)
            log(f"  Interval: {utc_left} to {utc_right} -> Covers 2026-11-01 to 2027-12-31: {covers_req}")

    # Check PCK Coverage
    pck_path = KERNELS_DIR / "moon_pa_de421_1900-2050.bpc"
    log(f"\n--- Binary PCK Coverage Analysis ({pck_path.name}) ---")
    pck_intervals = get_pck_coverage(pck_path, 301)
    if not pck_intervals:
        # Try -301 or 31006
        pck_intervals = get_pck_coverage(pck_path, 31006)
    log(f"PCK Object ID 301/31006 coverage intervals: {len(pck_intervals)}")
    for left, right in pck_intervals:
        utc_left = spiceypy.et2utc(left, "ISOC", 3)
        utc_right = spiceypy.et2utc(right, "ISOC", 3)
        covers_req = (left <= req_start_et) and (right >= req_stop_et)
        log(f"  Interval: {utc_left} to {utc_right} -> Covers 2026-11-01 to 2027-12-31: {covers_req}")

    # Test PXFORM from J2000 to MOON_ME at 3 distinct epochs
    log("\n--- J2000 to MOON_ME Coordinate Transformations ---")
    test_dates = [
        "2026-11-01T00:00:00",
        "2027-01-01T12:00:00",
        "2027-12-31T00:00:00",
    ]

    for d_str in test_dates:
        et = spiceypy.str2et(d_str)
        mat = np.array(spiceypy.pxform("J2000", "MOON_ME", et))
        det = np.linalg.det(mat)
        det_err = abs(det - 1.0)
        ortho_err = float(np.max(np.abs(mat @ mat.T - np.eye(3))))

        log(f"Epoch: {d_str} (ET = {et:.3f})")
        log(f"  Rotation Matrix:\n{mat}")
        log(f"  Determinant: {det:.15f} (Error from 1.0: {det_err:.2e})")
        log(f"  Orthogonality Error ||R * R^T - I||_max: {ortho_err:.2e}")

        assert det_err < 1e-12, f"Determinant error {det_err} exceeds 1e-12 tolerance!"
        assert ortho_err < 1e-12, f"Orthogonality error {ortho_err} exceeds 1e-12 tolerance!"
        log("  [PASS] Transformation verified orthogonal with unit determinant.\n")

    spiceypy.kclear()
    log("Kernels unloaded cleanly.")

    log_path = LOGS_DIR / "step7_check_kernels.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"Wrote raw log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
