#!/usr/bin/env python3
"""Step 7.1: Fetch NAIF generic_kernels directory listings.

Governed by docs/PROJECT_RULES.md (Rule 2: Never guess filenames).
Allowed hosts: naif.jpl.nasa.gov
"""

import datetime
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES_DIR = ROOT / "docs" / "sources"
LOGS_DIR = ROOT / "logs"

SOURCES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

URLS = {
    "naif_lsk.html": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/",
    "naif_spk_planets.html": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/",
    "naif_pck.html": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/",
    "naif_fk_satellites.html": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/",
}

def fetch(name: str, url: str):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPath-DataAcquisition/1.0 (+https://github.com/AnmolGarg8/LightPath)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8", errors="replace")
        target_path = SOURCES_DIR / name
        target_path.write_text(content, encoding="utf-8")
        return resp.status, len(content), target_path

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 7.1: Fetch NAIF Kernel Directory Listings ({now}) ===\n")

    for name, url in URLS.items():
        log(f"Fetching {url}...")
        status, length, path = fetch(name, url)
        log(f"  Status: {status}, Size: {length:,} characters -> {path.relative_to(ROOT)}")

    # Let's see what subdirectories or lunar folders exist in PCK and FK
    # Parse listings to find lunar kernels
    pck_text = (SOURCES_DIR / "naif_pck.html").read_text(encoding="utf-8")

    # Check for lunar orientation / subdirectories
    subdirs_pck = re.findall(r'href="([^"]*/)"', pck_text)
    log(f"\nPCK Subdirectories found: {subdirs_pck}")
    for s in subdirs_pck:
        if "moon" in s.lower() or "lunar" in s.lower():
            sub_url = f"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/{s}"
            sub_name = f"naif_pck_{s.strip('/')}.html"
            log(f"Fetching lunar PCK subfolder: {sub_url}...")
            st, sz, p = fetch(sub_name, sub_url)
            log(f"  Status: {st}, Size: {sz:,} characters -> {p.relative_to(ROOT)}")

    # Save log
    log_file = LOGS_DIR / "step7_naif_listings.log"
    log_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote log to {log_file.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
