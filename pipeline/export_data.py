"""LightPath Data Export Module.

Exports per-site window tables (Sun, Earth, DTE, joint) as CSV and Parquet with:
- Strict schema conforming to docs/DATA_FORMAT.md
- Units and thresholds in column names and embedded Parquet metadata
- Traced provenance hash per row
- Consolidated multi-site datasets and data catalog for web app downloads.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List

import pyarrow as pa
import pyarrow.parquet as pq


ARROW_SCHEMA = pa.schema(
    [
        ("site_id", pa.string()),
        ("target", pa.string()),
        ("window_id", pa.int32()),
        ("start_utc", pa.string()),
        ("end_utc", pa.string()),
        ("duration_h", pa.float64()),
        ("threshold_pct", pa.float64()),
        ("mast_height_m", pa.float64()),
        ("is_synthetic", pa.bool_()),
        ("provenance_hash", pa.string()),
    ],
    metadata={
        b"schema_version": b"1.0.0",
        b"coordinate_frame": b"MOON_ME",
        b"elevation_formula": b"exact_spherical_curvature",
        b"r_moon_m": b"1737400.0",
        b"license_data": b"CC-BY-4.0",
        b"license_code": b"MIT",
        b"units_duration": b"hours",
        b"units_mast_height": b"meters",
        b"units_threshold": b"percent_disc_fraction_or_degrees",
    },
)


def compute_provenance_hash(prov_path: Path) -> str:
    """Compute short deterministic 8-char SHA-256 hash of provenance.json."""
    if not prov_path.exists():
        return "unproven"
    try:
        content = prov_path.read_bytes()
        return hashlib.sha256(content).hexdigest()[:8]
    except Exception:
        return "unproven"


def export_site_windows(
    site_dir: Path,
) -> List[Dict[str, Any]]:
    """Read site stats, series, and provenance and generate structured window rows."""
    stats_path = site_dir / "stats.json"
    site_path = site_dir / "site.json"
    prov_path = site_dir / "provenance.json"

    if not stats_path.exists() or not site_path.exists():
        return []

    with open(stats_path, "r", encoding="utf-8") as f:
        stats = json.load(f)

    with open(site_path, "r", encoding="utf-8") as f:
        site_info = json.load(f)

    prov_hash = compute_provenance_hash(prov_path)
    site_id = site_info.get("id", site_dir.name)
    is_synthetic = bool(site_info.get("is_synthetic", False))

    thresholds = stats.get("thresholds", {})
    min_sun_pct = float(thresholds.get("min_sun_frac", 0.5)) * 100.0
    min_earth_pct = float(thresholds.get("min_earth_frac", 0.5)) * 100.0
    gs_mask_deg = float(thresholds.get("ground_station_mask_deg", 10.0))

    # Read observer height from provenance or default to 2.0m
    mast_height_m = 2.0
    if prov_path.exists():
        try:
            with open(prov_path, "r", encoding="utf-8") as f:
                prov = json.load(f)
            mast_height_m = float(prov.get("parameters", {}).get("observer_height_m", 2.0))
        except Exception:
            pass

    target_configs = {
        "sun": min_sun_pct,
        "earth": min_earth_pct,
        "dte": gs_mask_deg,
        "joint": min_sun_pct,
    }

    rows: List[Dict[str, Any]] = []

    for target, thresh in target_configs.items():
        category = stats.get(target, {})
        windows = category.get("windows", [])
        for w_idx, win in enumerate(windows):
            rows.append(
                {
                    "site_id": site_id,
                    "target": target,
                    "window_id": w_idx,
                    "start_utc": win["start_utc"],
                    "end_utc": win["end_utc"],
                    "duration_h": float(win["duration_h"]),
                    "threshold_pct": thresh,
                    "mast_height_m": mast_height_m,
                    "is_synthetic": is_synthetic,
                    "provenance_hash": prov_hash,
                }
            )

    return rows


def write_csv(dest_path: Path, rows: List[Dict[str, Any]]) -> None:
    """Write rows to RFC 4180 compliant CSV."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "site_id",
        "target",
        "window_id",
        "start_utc",
        "end_utc",
        "duration_h",
        "threshold_pct",
        "mast_height_m",
        "is_synthetic",
        "provenance_hash",
    ]
    with open(dest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_parquet(dest_path: Path, rows: List[Dict[str, Any]]) -> None:
    """Write rows to Snappy-compressed Parquet with embedded schema metadata."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    pydict = {
        "site_id": [r["site_id"] for r in rows],
        "target": [r["target"] for r in rows],
        "window_id": [r["window_id"] for r in rows],
        "start_utc": [r["start_utc"] for r in rows],
        "end_utc": [r["end_utc"] for r in rows],
        "duration_h": [r["duration_h"] for r in rows],
        "threshold_pct": [r["threshold_pct"] for r in rows],
        "mast_height_m": [r["mast_height_m"] for r in rows],
        "is_synthetic": [r["is_synthetic"] for r in rows],
        "provenance_hash": [r["provenance_hash"] for r in rows],
    }
    table = pa.Table.from_pydict(pydict, schema=ARROW_SCHEMA)
    pq.write_table(table, dest_path, compression="snappy")


def file_sha256(path: Path) -> str:
    """Calculate file SHA-256 checksum."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def export_all_datasets(
    processed_dir: Path = Path("data/processed"),
    web_public_dir: Path = Path("web/public/data"),
) -> Dict[str, Any]:
    """Execute complete export across all sites, syncing processed and web directories."""
    all_rows: List[Dict[str, Any]] = []
    catalog_files: List[Dict[str, Any]] = []

    # 1. Discover all site folders
    sites = [
        "synthetic-proving-ground",
        "synthetic-flat-basin",
        "synthetic-crater-rim",
        "shackleton-connecting-ridge",
        "malapert-mountain",
        "nobile-crater-rim",
    ]

    for site_id in sites:
        site_proc_dir = web_public_dir / site_id
        if not site_proc_dir.exists():
            site_proc_dir = processed_dir / site_id
        if not site_proc_dir.exists():
            continue

        site_rows = export_site_windows(site_proc_dir)
        if not site_rows:
            continue

        all_rows.extend(site_rows)

        # Write per-site CSV & Parquet to both data/processed and web/public/data
        for base in [processed_dir, web_public_dir]:
            target_site_dir = base / site_id
            csv_path = target_site_dir / "windows.csv"
            parquet_path = target_site_dir / "windows.parquet"

            write_csv(csv_path, site_rows)
            write_parquet(parquet_path, site_rows)

        # Catalog entry for web downloads
        web_csv = web_public_dir / site_id / "windows.csv"
        web_parquet = web_public_dir / site_id / "windows.parquet"

        catalog_files.append(
            {
                "site_id": site_id,
                "filename": f"{site_id}_windows.csv",
                "rel_path": f"./data/{site_id}/windows.csv",
                "format": "CSV",
                "size_bytes": web_csv.stat().st_size,
                "sha256": file_sha256(web_csv),
                "rows": len(site_rows),
                "license": "CC-BY-4.0",
                "description": f"Contiguous Sun, Earth, DTE, and Joint visibility windows for {site_id} (CSV).",
            }
        )
        catalog_files.append(
            {
                "site_id": site_id,
                "filename": f"{site_id}_windows.parquet",
                "rel_path": f"./data/{site_id}/windows.parquet",
                "format": "Parquet",
                "size_bytes": web_parquet.stat().st_size,
                "sha256": file_sha256(web_parquet),
                "rows": len(site_rows),
                "license": "CC-BY-4.0",
                "description": f"Contiguous Sun, Earth, DTE, and Joint visibility windows for {site_id} (Parquet, Snappy compressed with metadata).",
            }
        )

    # 2. Write consolidated all_sites_windows to both destinations
    for base in [processed_dir, web_public_dir]:
        all_csv = base / "all_sites_windows.csv"
        all_parquet = base / "all_sites_windows.parquet"

        write_csv(all_csv, all_rows)
        write_parquet(all_parquet, all_rows)

    web_all_csv = web_public_dir / "all_sites_windows.csv"
    web_all_parquet = web_public_dir / "all_sites_windows.parquet"

    # Prepend consolidated files to catalog
    consolidated_entries = [
        {
            "site_id": "all-sites",
            "filename": "all_sites_windows.parquet",
            "rel_path": "./data/all_sites_windows.parquet",
            "format": "Parquet",
            "size_bytes": web_all_parquet.stat().st_size,
            "sha256": file_sha256(web_all_parquet),
            "rows": len(all_rows),
            "license": "CC-BY-4.0",
            "description": "Consolidated visibility windows across all 6 lunar sites (Parquet format with embedded metadata).",
        },
        {
            "site_id": "all-sites",
            "filename": "all_sites_windows.csv",
            "rel_path": "./data/all_sites_windows.csv",
            "format": "CSV",
            "size_bytes": web_all_csv.stat().st_size,
            "sha256": file_sha256(web_all_csv),
            "rows": len(all_rows),
            "license": "CC-BY-4.0",
            "description": "Consolidated visibility windows across all 6 lunar sites (standard RFC 4180 CSV).",
        },
    ]

    catalog_files = consolidated_entries + catalog_files

    catalog = {
        "version": "1.0.0",
        "created_utc": "2026-11-02T04:00:00Z",
        "total_files": len(catalog_files),
        "license_data": "CC-BY-4.0",
        "license_code": "MIT",
        "suggested_citation": (
            "LightPath Team (2026). LightPath: Lunar South-Pole Solar Illumination and "
            "Direct-to-Earth Line of Sight Dataset (Version 1.0.0) [Data set]. NASA Space Apps Challenge 2026."
        ),
        "files": catalog_files,
    }

    catalog_path = web_public_dir / "data_catalog.json"
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    return catalog


if __name__ == "__main__":
    cat = export_all_datasets()
    print(f"Exported {cat['total_files']} files successfully to data/processed and web/public/data.")
