#!/usr/bin/env python3
"""Check data integrity offline by validating SHA-256 checksums and file sizes.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/checksums).
Runs completely offline with ZERO network calls.
"""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEM_MANIFEST = ROOT / "data" / "dem_manifest.json"
KERNELS_MANIFEST = ROOT / "kernels" / "kernels.json"
META_KERNEL = ROOT / "kernels" / "meta.tm"

def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def verify_manifest(manifest_path: Path, name: str) -> bool:
    print(f"\n--- Verifying {name} Manifest ({manifest_path.relative_to(ROOT)}) ---")
    if not manifest_path.exists():
        print(f"[FAIL] Manifest missing: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    all_passed = True
    for item in entries:
        item_id = item.get("id") or item.get("name") or item.get("file")
        local_path_str = item.get("local_path") or item.get("file")
        if not local_path_str:
            print(f"[SKIP] {item_id}: No local_path or file specified.")
            continue

        file_path = ROOT / local_path_str
        if not file_path.exists():
            print(f"[FAIL] {item_id}: File does not exist at {local_path_str}")
            all_passed = False
            continue

        expected_sha = item.get("sha256")
        expected_size = item.get("size_bytes")

        actual_size = file_path.stat().st_size
        actual_sha = compute_sha256(file_path)

        size_ok = (expected_size is None) or (actual_size == expected_size)
        sha_ok = (expected_sha is None) or (actual_sha.lower() == expected_sha.lower())

        if size_ok and sha_ok:
            print(f"[PASS] {item_id}: Verified {actual_size:,} bytes | SHA-256: {actual_sha}")
        else:
            print(f"[FAIL] {item_id}: Checksum/Size mismatch!")
            if not size_ok:
                print(f"       Expected Size: {expected_size}, Actual: {actual_size}")
            if not sha_ok:
                print(f"       Expected SHA: {expected_sha}")
                print(f"       Actual SHA:   {actual_sha}")
            all_passed = False

    return all_passed

def main():
    print("================================================================================")
    print("LIGHTPATH OFFLINE DATA INTEGRITY AUDIT")
    print("================================================================================")

    kernels_ok = verify_manifest(KERNELS_MANIFEST, "SPICE Kernels")
    dem_ok = verify_manifest(DEM_MANIFEST, "LOLA DEM")

    # SPICE furnsh verification
    spice_ok = True
    if META_KERNEL.exists():
        print("\n--- Verifying SPICE Meta-Kernel Furnish ---")
        try:
            import spiceypy
            spiceypy.kclear()
            spiceypy.furnsh(str(META_KERNEL))
            print(f"[PASS] Successfully furnished {META_KERNEL.relative_to(ROOT)}")
            spiceypy.kclear()
        except Exception as e:
            print(f"[FAIL] SPICE furnsh failed: {e}")
            spice_ok = False

    overall = kernels_ok and dem_ok and spice_ok
    print("\n================================================================================")
    if overall:
        print("[ALL PASS] Offline data integrity checks passed successfully.")
        return 0
    else:
        print("[FAIL] One or more data integrity checks failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
