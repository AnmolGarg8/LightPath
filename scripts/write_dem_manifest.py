#!/usr/bin/env python3
"""Generate data/dem_manifest.json from real downloaded files.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/hashes).
"""

import hashlib
import json
from pathlib import Path

import rasterio

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
MANIFEST_PATH = ROOT / "data" / "dem_manifest.json"

CITATION = "Barker et al. (2023), Planetary Science Journal 4:183, doi:10.3847/PSJ/acf3e1"
DATA_DOI = "10.60903/gsfcpgda-lola-spole"
PROJECTION = "South Polar Stereographic (IAU:30135, sphere R=1737400 m)"

def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def get_raster_metadata(path: Path):
    with rasterio.open(path) as src:
        bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]
        pixel_size = [src.res[0], src.res[1]]
        rows = src.height
        cols = src.width
    return bounds, pixel_size, rows, cols

def main():
    records = []

    # 1. Far layer: LDEM_80S_80MPP_ADJ.TIF
    far_path = RAW_DIR / "LDEM_80S_80MPP_ADJ.TIF"
    if far_path.exists():
        bounds, pixel_size, rows, cols = get_raster_metadata(far_path)
        records.append({
            "file": "data/raw/LDEM_80S_80MPP_ADJ.TIF",
            "description": "LOLA South Pole DEM (80°S to 90°S, 80 m/pixel, co-registered and adjusted), far layer full raster",
            "source_url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
            "sha256": compute_sha256(far_path),
            "size_bytes": far_path.stat().st_size,
            "format": "GeoTIFF",
            "projection": PROJECTION,
            "bounds": bounds,
            "pixel_size_m": pixel_size,
            "rows": rows,
            "cols": cols,
            "citation": CITATION,
            "data_doi": DATA_DOI,
        })

    # 2. Near layer: near_test_location.tif
    near_path = RAW_DIR / "near_test_location.tif"
    if near_path.exists():
        bounds, pixel_size, rows, cols = get_raster_metadata(near_path)
        records.append({
            "file": "data/raw/near_test_location.tif",
            "description": "LOLA South Pole DEM (20 m/pixel, co-registered and adjusted), near layer cropped window (80 km x 80 km) for test location",
            "source_url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
            "parent_file": "LDEM_80S_20MPP_ADJ.TIF",
            "site_id": "test_location",
            "crop_window": {
                "col_off": 13200,
                "row_off": 12442,
                "width": 4000,
                "height": 4000,
            },
            "sha256": compute_sha256(near_path),
            "size_bytes": near_path.stat().st_size,
            "format": "GeoTIFF",
            "projection": PROJECTION,
            "bounds": bounds,
            "pixel_size_m": pixel_size,
            "rows": rows,
            "cols": cols,
            "citation": CITATION,
            "data_doi": DATA_DOI,
        })

    # 3. Near layer error: err_test_location.tif
    err_path = RAW_DIR / "err_test_location.tif"
    if err_path.exists():
        bounds, pixel_size, rows, cols = get_raster_metadata(err_path)
        records.append({
            "file": "data/raw/err_test_location.tif",
            "description": "LOLA South Pole surface height error raster (20 m/pixel, 1-sigma uncertainty), near layer cropped window (80 km x 80 km) for test location",
            "source_url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ_ERR.TIF",
            "parent_file": "LDEM_80S_20MPP_ADJ_ERR.TIF",
            "site_id": "test_location",
            "crop_window": {
                "col_off": 13200,
                "row_off": 12442,
                "width": 4000,
                "height": 4000,
            },
            "sha256": compute_sha256(err_path),
            "size_bytes": err_path.stat().st_size,
            "format": "GeoTIFF",
            "projection": PROJECTION,
            "bounds": bounds,
            "pixel_size_m": pixel_size,
            "rows": rows,
            "cols": cols,
            "citation": CITATION,
            "data_doi": DATA_DOI,
        })

    MANIFEST_PATH.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} verified records to {MANIFEST_PATH.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
