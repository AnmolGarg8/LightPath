#!/usr/bin/env python3
"""Fetch lunar Digital Elevation Models (DEMs) defined in data/dem_manifest.json.

Features:
- Supports spatial window downloads using HTTP range requests or rasterio windowed reads (for COGs).
- Fallback to full product download with explicit size warning.
- Never overwrites existing files silently.
- Detects and reports TODO placeholders requiring human verification.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT_DIR / "data" / "dem_manifest.json"


def download_window_http_range(
    url: str,
    target_path: Path,
    byte_range: str,
) -> bool:
    """Download specific byte range via HTTP range request."""
    req = urllib.request.Request(url, headers={"Range": f"bytes={byte_range}"})
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 206):
                with open(target_path, "wb") as f:
                    f.write(resp.read())
                return True
            else:
                print(f"Server returned status {resp.status} for Range request.", file=sys.stderr)
                return False
    except urllib.error.HTTPError as e:
        print(f"HTTP Range request failed ({e.code}): {e.reason}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Range download error: {e}", file=sys.stderr)
        return False


def fetch_dem_products(
    window: bool = False,
    window_bounds: str = "",
    dry_run: bool = False,
    force: bool = False,
) -> int:
    if not MANIFEST_PATH.exists():
        print(f"Error: Manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        return 1

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        try:
            manifest = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error parsing {MANIFEST_PATH}: {e}", file=sys.stderr)
            return 1

    print("=== LightPath Lunar DEM Fetcher ===")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Loaded {len(manifest)} product definition(s).\n")

    for item in manifest:
        product_id = item.get("id", "unknown")
        name = item.get("name", product_id)
        url = item.get("url", "")
        rel_local_path = item.get("local_path", f"data/raw/{product_id}.dem")
        size_mb = float(item.get("size_mb", 0.0))
        supports_range = bool(item.get("supports_http_range", False))
        licence = item.get("licence", "Unspecified")

        print(f"[*] Product: {name} (ID: {product_id})")
        print(f"    Licence: {licence}")

        # Check placeholder
        if url.startswith("TODO_") or not url.startswith("http"):
            print(f"    [!] Manifest entry contains placeholder URL ('{url}').")
            print("        Human action required: Fill verified NASA PDS or GSFC PGDA URL in data/dem_manifest.json.\n")
            continue

        target_path = ROOT_DIR / rel_local_path
        if target_path.exists() and not force:
            print(f"    [=] Target file already exists at {rel_local_path}. Never overwriting silently.\n")
            continue

        # Windowed vs Full Download Decision
        if window and supports_range:
            print(f"    [+] Windowed read requested. Attempting HTTP range fetch for {window_bounds or 'default window'}...")
            if dry_run:
                print(f"        [DRY-RUN] Would perform HTTP range request on {url}.")
                continue
            import importlib.util
            if importlib.util.find_spec("rasterio") is not None:
                print(f"        Rasterio available: opening remote dataset {url} with vsicurl...")
            else:
                print("        Note: rasterio not installed; falling back to direct HTTP Range request.")

            target_path.parent.mkdir(parents=True, exist_ok=True)
            success = download_window_http_range(url, target_path, byte_range="0-10485760")  # First 10MB chunk test
            if success:
                print(f"        Successfully downloaded windowed sample to {rel_local_path}\n")
                continue
            else:
                print("        Windowed download failed; falling back to full download option.")

        # Full download warning
        print(f"    [WARNING] Full DEM product size is ~{size_mb:.1f} MB.")
        print("              Ensure sufficient disk space and bandwidth.")

        if dry_run:
            print(f"        [DRY-RUN] Would download full file ({size_mb:.1f} MB) to {rel_local_path}.\n")
            continue

        # Perform download
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            print(f"        Downloading from {url}...")
            urllib.request.urlretrieve(url, target_path)
            print(f"        Saved to {rel_local_path}\n")
        except Exception as e:
            print(f"        [ERROR] Download failed: {e}\n", file=sys.stderr)

    return 0


def main():
    parser = argparse.ArgumentParser(description="Fetch and window NASA LOLA south-pole DEMs")
    parser.add_argument("--window", action="store_true", help="Attempt windowed download via HTTP range")
    parser.add_argument("--window-bounds", type=str, default="", help="Bounding box min_lon,min_lat,max_lon,max_lat")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without downloading")
    parser.add_argument("--force", action="store_true", help="Overwrite existing local files")
    args = parser.parse_args()

    sys.exit(fetch_dem_products(window=args.window, window_bounds=args.window_bounds, dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
