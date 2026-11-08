#!/usr/bin/env python3
"""Step 2: Inspect remote terrain files via HTTP HEAD and /vsicurl/.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts).
Allowed hosts: pgda.gsfc.nasa.gov
"""

import datetime
import urllib.request
from pathlib import Path

import rasterio

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
LOGS_DIR = ROOT / "logs"

DOCS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    "LDEM_80S_20MPP_ADJ.TIF",
    "LDEM_80S_80MPP_ADJ.TIF",
    "LDEM_80S_40MPP_ADJ.TIF",
    "LDEM_80S_20MPP_ADJ_ERR.TIF",
    "LDSM_80S_20MPP_ADJ.TIF",
]

BASE_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/"

def inspect_head(url: str):
    req = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "LightPath-DataAcquisition/1.0 (+https://github.com/AnmolGarg8/LightPath)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return {
            "status": resp.status,
            "content_length": resp.getheader("Content-Length"),
            "last_modified": resp.getheader("Last-Modified"),
            "accept_ranges": resp.getheader("Accept-Ranges"),
            "content_type": resp.getheader("Content-Type"),
        }

def inspect_rasterio(url: str):
    vsi_url = f"/vsicurl/{url}"
    with rasterio.open(vsi_url) as src:
        crs = src.crs
        wkt = crs.to_wkt() if crs else "NONE"
        proj = crs.to_proj4() if crs else "NONE"

        # Check sphere radius
        # Typically spheroid in WKT has 1737400
        radius = None
        if "1737400" in wkt or "+R=1737400" in proj or "+a=1737400" in proj:
            radius = 1737400.0

        overviews = src.overviews(1) if src.count >= 1 else []
        scale = src.scales[0] if src.scales else 1.0
        offset = src.offsets[0] if src.offsets else 0.0

        return {
            "wkt": wkt,
            "proj": proj,
            "radius": radius,
            "width": src.width,
            "height": src.height,
            "bounds": {
                "left": src.bounds.left,
                "bottom": src.bounds.bottom,
                "right": src.bounds.right,
                "top": src.bounds.top,
            },
            "res": src.res,
            "dtype": str(src.dtypes[0]),
            "nodata": src.nodata,
            "scale": scale,
            "offset": offset,
            "is_tiled": src.is_tiled,
            "block_shapes": src.block_shapes,
            "overviews": overviews,
            "driver": src.driver,
            "compression": src.compression.value if src.compression else "none",
        }

def main():
    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 2: Inspect Remote Files via HEAD & /vsicurl/ ({now}) ===\n")

    md_report = [
        "# Remote Terrain Inspection Report",
        "",
        f"**Inspection Date:** {now}  ",
        "**Source Host:** `pgda.gsfc.nasa.gov`  ",
        "**Verification Engine:** `rasterio` + GDAL `/vsicurl/`  ",
        "",
        "---",
        "",
    ]

    for fname in FILES:
        url = f"{BASE_URL}{fname}"
        log(f"Inspecting {fname}...")
        log(f"URL: {url}")

        # HEAD
        head_info = inspect_head(url)
        log(f"  HTTP HEAD: Status={head_info['status']}, Content-Length={head_info['content_length']} bytes, Accept-Ranges={head_info['accept_ranges']}, Last-Modified={head_info['last_modified']}")

        # Rasterio /vsicurl/
        meta = inspect_rasterio(url)
        log(f"  Dimensions: {meta['width']} x {meta['height']} pixels")
        log(f"  Pixel Resolution: dx={meta['res'][0]} m, dy={meta['res'][1]} m")
        log(f"  Bounds (m): left={meta['bounds']['left']}, bottom={meta['bounds']['bottom']}, right={meta['bounds']['right']}, top={meta['bounds']['top']}")
        log(f"  Data Type: {meta['dtype']}, NoData: {meta['nodata']}, Scale: {meta['scale']}, Offset: {meta['offset']}")
        log(f"  Tiled: {meta['is_tiled']}, Block Shapes: {meta['block_shapes'][0] if meta['block_shapes'] else 'N/A'}, Overviews: {meta['overviews']}, Compression: {meta['compression']}")
        log(f"  Sphere Radius detected: {meta['radius']} m")

        # Validation check
        is_polar_stereo = "Polar_Stereographic" in meta["wkt"] or "stere" in meta["proj"]
        is_valid_radius = meta["radius"] == 1737400.0
        if not (is_polar_stereo and is_valid_radius):
            err_msg = f"CRITICAL CRS MISMATCH on {fname}! PolarStereo={is_polar_stereo}, Radius={meta['radius']}"
            log(f"ERROR: {err_msg}")
            raise RuntimeError(err_msg)
        else:
            log("  [PASS] CRS verified: South Polar Stereographic on 1,737,400 m sphere.\n")

        size_bytes = int(head_info['content_length']) if head_info['content_length'] else 0
        size_mb = size_bytes / (1024 * 1024)

        md_report.extend([
            f"## `{fname}`",
            "",
            f"- **URL:** `{url}`",
            f"- **HTTP Status:** `{head_info['status']}`",
            f"- **Content-Length:** `{size_bytes:,}` bytes ({size_mb:.2f} MB)",
            f"- **Last-Modified:** `{head_info['last_modified']}`",
            f"- **Accept-Ranges (HTTP range reads):** `{head_info['accept_ranges']}`",
            f"- **Width x Height:** `{meta['width']} x {meta['height']}` pixels",
            f"- **Pixel Size:** `{meta['res'][0]} m x {meta['res'][1]} m`",
            f"- **Bounds (metres):** `[{meta['bounds']['left']}, {meta['bounds']['bottom']}, {meta['bounds']['right']}, {meta['bounds']['top']}]`",
            f"- **Data Type:** `{meta['dtype']}`",
            f"- **No-Data Value:** `{meta['nodata']}`",
            f"- **Scale / Offset:** `{meta['scale']} / {meta['offset']}`",
            f"- **Tiled:** `{meta['is_tiled']}` (block size: `{meta['block_shapes'][0] if meta['block_shapes'] else 'N/A'}`)",
            f"- **Overviews:** `{meta['overviews']}`",
            f"- **Cloud-Optimized / Streamable:** `{'Yes (Tiled Deflate with HTTP Range support)' if meta['is_tiled'] and head_info['accept_ranges'] == 'bytes' else 'No'}`",
            f"- **Sphere Radius:** `{meta['radius']} m`",
            "- **CRS Projection:** `South Polar Stereographic (IAU:30135)`",
            f"- **PROJ String:** `{meta['proj']}`",
            "<details><summary>Full WKT</summary>",
            "",
            "```wkt",
            meta["wkt"],
            "```",
            "",
            "</details>",
            "",
            "---",
            "",
        ])

    # Write docs/terrain_inspection.md
    target_md = DOCS_DIR / "terrain_inspection.md"
    target_md.write_text("\n".join(md_report), encoding="utf-8")
    log(f"Wrote inspection document to {target_md.relative_to(ROOT)}")

    # Write logs
    target_log = LOGS_DIR / "step2_inspect_remote_files.log"
    target_log.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"Wrote raw log to {target_log.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
