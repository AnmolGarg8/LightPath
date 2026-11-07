#!/usr/bin/env python3
"""Step 7: Propose, download, and verify NAIF SPICE kernels for LightPath.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/checksums).
Allowed hosts: naif.jpl.nasa.gov
"""

import datetime
import hashlib
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KERNELS_DIR = ROOT / "kernels"
SOURCES_DIR = ROOT / "docs" / "sources"
LOGS_DIR = ROOT / "logs"

KERNELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

PROPOSED_KERNELS = [
    {
        "name": "naif0012.tls",
        "description": "NAIF leapseconds kernel (newest available in generic_kernels/lsk)",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        "local_path": "kernels/naif0012.tls",
        "listing_file": "naif_lsk.html",
    },
    {
        "name": "pck00010.tpc",
        "description": "Planetary physical constants kernel matching DE421",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
        "local_path": "kernels/pck00010.tpc",
        "listing_file": "naif_pck.html",
    },
    {
        "name": "moon_pa_de421_1900-2050.bpc",
        "description": "Lunar orientation binary PCK in DE421 frame (covers 1900-2050)",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc",
        "local_path": "kernels/moon_pa_de421_1900-2050.bpc",
        "listing_file": "naif_pck.html",
    },
    {
        "name": "moon_080317.tf",
        "description": "Lunar frame kernel defining MOON_ME and MOON_PA frames for DE421",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf",
        "local_path": "kernels/moon_080317.tf",
        "listing_file": "naif_fk_satellites.html",
    },
    {
        "name": "de421.bsp",
        "description": "Planetary and lunar ephemeris SPK (DE421 family, 1900-2050)",
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp",
        "local_path": "kernels/de421.bsp",
        "listing_file": "naif_spk_planets_old_versions.html",
    },
]

def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def download_file(url: str, dest_path: Path, log):
    if dest_path.exists() and dest_path.stat().st_size > 0:
        log(f"  {dest_path.name} exists ({dest_path.stat().st_size:,} bytes). Checking remote size...")
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "LightPath/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            expected_size = int(r.getheader("Content-Length", 0))
        if dest_path.stat().st_size == expected_size and expected_size > 0:
            log(f"  Size matches ({expected_size:,} bytes). Skipping download.")
            return dest_path.stat().st_size

    log(f"  Downloading {url} -> {dest_path.name}...")
    req = urllib.request.Request(url, headers={"User-Agent": "LightPath/1.0"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as f:
        total = int(resp.getheader("Content-Length", 0))
        done = 0
        while chunk := resp.read(1024 * 1024):
            f.write(chunk)
            done += len(chunk)
            if total > 5 * 1024 * 1024 and (done % (10 * 1024 * 1024) < len(chunk)):
                log(f"    Progress: {done/(1024*1024):.1f} MB / {total/(1024*1024):.1f} MB")
    elapsed = time.time() - t0
    log(f"  Completed in {elapsed:.1f}s ({dest_path.stat().st_size:,} bytes).")
    return dest_path.stat().st_size

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 7: Propose, Download & Verify SPICE Kernels ({now}) ===\n")

    # 1. Propose and verify against listings
    log("--- Proposed SPICE Kernel Set (Verified against NAIF listings) ---")
    for k in PROPOSED_KERNELS:
        listing_path = SOURCES_DIR / k["listing_file"]
        if not listing_path.exists():
            raise FileNotFoundError(f"Listing file missing: {listing_path}")
        listing_content = listing_path.read_text(encoding="utf-8")
        if k["name"] not in listing_content:
            log(f"CRITICAL ERROR: {k['name']} was NOT found in {listing_path.name}!")
            sys.exit(1)
        log(f"Verified in listing: {k['name']} (Source listing: docs/sources/{k['listing_file']})")
        log(f"  Purpose: {k['description']}")
        log(f"  URL: {k['url']}")

    log("\nAll 5 proposed kernels confirmed in official NAIF listings. Proceeding with download...\n")

    # 2. Download kernels
    kernel_records = []
    for k in PROPOSED_KERNELS:
        dest_path = ROOT / k["local_path"]
        log(f"Processing {k['name']}...")
        size_bytes = download_file(k["url"], dest_path, log)
        sha = compute_sha256(dest_path)
        log(f"  SHA-256: {sha}")
        retrieval_date = datetime.datetime.now(datetime.timezone.utc).isoformat()

        kernel_records.append({
            "name": k["name"],
            "description": k["description"],
            "url": k["url"],
            "sha256": sha,
            "size_bytes": size_bytes,
            "retrieved_on": retrieval_date,
            "local_path": k["local_path"],
            "verified": False  # per Rule 2, requires human verification
        })

    # 3. Write kernels/kernels.json
    kernels_json_path = KERNELS_DIR / "kernels.json"
    kernels_json_path.write_text(json.dumps(kernel_records, indent=2), encoding="utf-8")
    log(f"\nWrote manifest with real checksums to {kernels_json_path.relative_to(ROOT)}")

    # 4. Regenerate kernels/meta.tm via scripts/make_meta_kernel.py
    log("\nRegenerating kernels/meta.tm via scripts/make_meta_kernel.py...")
    res = subprocess.run([sys.executable, str(ROOT / "scripts" / "make_meta_kernel.py")], capture_output=True, text=True)
    log(res.stdout)
    if res.returncode != 0:
        log(f"Error regenerating meta.tm: {res.stderr}")
        sys.exit(1)

    log_path = LOGS_DIR / "step7_fetch_kernels.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
