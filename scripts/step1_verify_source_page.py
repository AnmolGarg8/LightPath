#!/usr/bin/env python3
"""Step 1: Verify the PGDA Product 90 source page.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts, coordinates, file names, checksums or citations).
Allowed hosts: pgda.gsfc.nasa.gov
"""

import datetime
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_SOURCES = ROOT / "docs" / "sources"
LOGS_DIR = ROOT / "logs"

DOCS_SOURCES.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

URL = "https://pgda.gsfc.nasa.gov/products/90"

def main():
    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 1: Verify PGDA Product 90 ({now}) ===")
    log(f"Requesting URL: {URL}")

    req = urllib.request.Request(
        URL,
        headers={"User-Agent": "LightPath-DataAcquisition/1.0 (NASA Space Apps Challenge; +https://github.com/AnmolGarg8/LightPath)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        status = resp.status
        content_length = resp.getheader("Content-Length")
        last_modified = resp.getheader("Last-Modified")
        content_type = resp.getheader("Content-Type")
        raw_bytes = resp.read()

    log(f"HTTP Status: {status}")
    log(f"Content-Type: {content_type}")
    log(f"Content-Length: {content_length} (Actual bytes read: {len(raw_bytes)})")
    log(f"Last-Modified: {last_modified}")

    html_text = raw_bytes.decode("utf-8", errors="replace")

    # Save exact copy to docs/sources/pgda_product_90.txt
    target_txt = DOCS_SOURCES / "pgda_product_90.txt"
    target_txt.write_text(html_text, encoding="utf-8")
    log(f"Saved text copy to {target_txt.relative_to(ROOT)} ({len(html_text)} characters)")

    # Analyze file listings
    # Prompt states:
    # LDEM_80S_20MPP_ADJ.TIF (about 2.6 GB)
    # LDEM_80S_80MPP_ADJ.TIF (about 181 MB)
    # LDEM_80S_40MPP_ADJ.TIF (about 685 MB)
    # LDEM_80S_20MPP_ADJ_ERR.TIF (about 3.7 GB)
    # LDSM_80S_20MPP_ADJ.TIF (about 3.6 GB)
    expected_files = {
        "LDEM_80S_20MPP_ADJ.TIF": "2.6G",
        "LDEM_80S_80MPP_ADJ.TIF": "181M",
        "LDEM_80S_40MPP_ADJ.TIF": "685M",
        "LDEM_80S_20MPP_ADJ_ERR.TIF": "3.7G",
        "LDSM_80S_20MPP_ADJ.TIF": "3.6G",
    }

    log("\n--- Checking File Listings and Sizes on Page ---")
    for filename, exp_size in expected_files.items():
        pattern = re.compile(rf'<a href="([^"]*{re.escape(filename)})"[^>]*>[^<]*</a>\s*-\s*([^<\n]+)')
        m = pattern.search(html_text)
        if m:
            file_url = m.group(1)
            size_on_page = m.group(2).strip()
            log(f"FOUND: {filename}")
            log(f"  URL: {file_url}")
            log(f"  Size on page: {size_on_page} (Expected: about {exp_size})")
        else:
            log(f"WARNING: {filename} was NOT matched by link pattern!")

    # Search for citations and DOIs on the page
    log("\n--- Searching for Citations & DOIs ---")
    doi_matches = set(re.findall(r'10\.\d{4,9}/[-._;()/:A-Za-z0-9]+', html_text))
    log(f"DOIs found on page: {sorted(list(doi_matches))}")

    # Look for Barker citation
    barker_match = re.search(r'Barker.*?2023.*?(?:Planetary Science Journal|PSJ).*?', html_text, re.IGNORECASE)
    if barker_match:
        log(f"Found citation reference: {barker_match.group(0).strip()}")
    else:
        # scan for Barker
        barker_lines = [line.strip() for line in html_text.splitlines() if "Barker" in line]
        log(f"Barker lines: {barker_lines}")

    # Look for license / rights
    license_matches = [line.strip() for line in html_text.splitlines() if any(k in line.lower() for k in ["license", "licence", "rights", "public domain", "terms"])]
    log(f"License / Rights lines: {license_matches[:5]}")

    # Write log file
    log_file = LOGS_DIR / "step1_verify_source_page.log"
    log_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote log to {log_file.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
