#!/usr/bin/env python3
"""Step 4: Fetch DEM windows (near layer via /vsicurl/ and far layer full download).

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/checksums).
Allowed hosts: pgda.gsfc.nasa.gov
"""

import datetime
import hashlib
import time
import urllib.request
from pathlib import Path

import numpy as np
import pyproj
import rasterio
import yaml
from rasterio.windows import Window, from_bounds

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "configs" / "terrain_windows.yaml"
RAW_DIR = ROOT / "data" / "raw"
LOGS_DIR = ROOT / "logs"

RAW_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def download_file_resumable(url: str, dest_path: Path, log):
    """Download a file with progress logging, idempotent if already exists."""
    if dest_path.exists():
        log(f"File {dest_path.name} already exists ({dest_path.stat().st_size:,} bytes). Verifying...")
        # Check size with HEAD
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "LightPath/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            expected_len = int(r.getheader("Content-Length", 0))
        if dest_path.stat().st_size == expected_len and expected_len > 0:
            log(f"Size matches remote Content-Length ({expected_len:,} bytes). Skipping re-download.")
            return

    log(f"Downloading {url} -> {dest_path}...")
    req = urllib.request.Request(url, headers={"User-Agent": "LightPath/1.0"})
    start_time = time.time()
    last_log_time = start_time
    bytes_downloaded = 0

    with urllib.request.urlopen(req, timeout=60) as response, open(dest_path, "wb") as out_f:
        total_size = int(response.getheader("Content-Length", 0))
        while chunk := response.read(1024 * 1024):
            out_f.write(chunk)
            bytes_downloaded += len(chunk)
            now = time.time()
            if now - last_log_time >= 5.0 or bytes_downloaded == total_size:
                pct = (bytes_downloaded / total_size * 100.0) if total_size > 0 else 0.0
                speed = (bytes_downloaded / (1024 * 1024)) / max(1e-3, now - start_time)
                log(f"  {bytes_downloaded / (1024 * 1024):.1f} MB / {total_size / (1024 * 1024):.1f} MB ({pct:.1f}%) @ {speed:.2f} MB/s")
                last_log_time = now

    elapsed = time.time() - start_time
    log(f"Finished downloading {dest_path.name} in {elapsed:.1f}s ({dest_path.stat().st_size:,} bytes).")

def crop_window_vsicurl(url: str, site_id: str, x: float, y: float, half_width_m: float, dest_path: Path, log):
    """Crop a spatial window using rasterio windowed read through /vsicurl/."""
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        log(f"Crop {dest_path.name} already exists ({dest_path.stat().st_size:,} bytes). Reusing.")
        return

    log(f"Cropping window from {url} for site '{site_id}' at X={x:.1f}, Y={y:.1f} (half-width: {half_width_m/1000.0:.1f} km)...")
    vsi_url = f"/vsicurl/{url}"

    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF",
        GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
        VSI_CACHE="TRUE",
        VSI_CACHE_SIZE="67108864",
        GDAL_NUM_THREADS="ALL_CPUS"
    ):
        with rasterio.open(vsi_url) as src:
            left = x - half_width_m
            right = x + half_width_m
            bottom = y - half_width_m
            top = y + half_width_m

            # Build window with from_bounds
            win = from_bounds(left, bottom, right, top, transform=src.transform)

            # Round offsets and lengths to exact integer pixels per instructions
            col_off = int(round(win.col_off))
            row_off = int(round(win.row_off))
            width = int(round(win.width))
            height = int(round(win.height))
            rounded_win = Window(col_off=col_off, row_off=row_off, width=width, height=height)

            log(f"  Window: col_off={col_off}, row_off={row_off}, width={width}, height={height}")
            t0 = time.time()
            data = src.read(1, window=rounded_win)
            t_read = time.time() - t0
            log(f"  Read completed in {t_read:.1f}s. Data shape: {data.shape}, dtype: {data.dtype}")

            out_transform = src.window_transform(rounded_win)
            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": height,
                "width": width,
                "transform": out_transform,
                "compress": "deflate",
                "tiled": True,
                "blockxsize": min(512, width),
                "blockysize": min(512, height),
            })

            with rasterio.open(dest_path, "w", **out_meta) as dst:
                dst.write(data, 1)

            log(f"  Wrote crop to {dest_path.name} ({dest_path.stat().st_size:,} bytes).")

def print_dataset_stats(path: Path, log):
    sha = compute_sha256(path)
    with rasterio.open(path) as src:
        arr = src.read(1)
        valid = arr[~np.isnan(arr)]
        nodata_frac = float(np.isnan(arr).sum() / arr.size)
        res = src.res
        bounds = src.bounds
        shape = src.shape
        dtype = src.dtypes[0]

        v_min = float(np.min(valid)) if valid.size > 0 else float("nan")
        v_max = float(np.max(valid)) if valid.size > 0 else float("nan")
        v_mean = float(np.mean(valid)) if valid.size > 0 else float("nan")

    file_size = path.stat().st_size
    log(f"Dataset: {path.name}")
    log(f"  Shape: {shape} (rows, cols), Data Type: {dtype}")
    log(f"  Pixel Size: dx={res[0]:.2f} m, dy={res[1]:.2f} m")
    log(f"  Bounds: left={bounds.left:.1f}, bottom={bounds.bottom:.1f}, right={bounds.right:.1f}, top={bounds.top:.1f}")
    log(f"  Elevation/Value Stats: Min={v_min:.2f}, Max={v_max:.2f}, Mean={v_mean:.2f}")
    log(f"  No-Data Fraction: {nodata_frac:.4%}")
    log(f"  File Size: {file_size:,} bytes ({file_size / (1024*1024):.2f} MB)")
    log(f"  SHA-256: {sha}\n")
    return {
        "filename": path.name,
        "shape": shape,
        "res": res,
        "bounds": bounds,
        "min": v_min,
        "max": v_max,
        "mean": v_mean,
        "nodata_fraction": nodata_frac,
        "size_bytes": file_size,
        "sha256": sha,
    }

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 4: Fetch DEM Windows & Far Layer ({now}) ===\n")

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    # Setup coordinate transformer
    transformer = pyproj.Transformer.from_crs(
        "+proj=longlat +R=1737400 +no_defs",
        cfg["crs"]["proj4"],
        always_xy=True
    )

    layers = cfg["layers"]
    sites = cfg["sites"]

    # 1. Download Far Layer in full
    far_cfg = layers["far"]
    far_path = RAW_DIR / far_cfg["filename"]
    log(f"--- Processing Far Layer ({far_cfg['filename']}) ---")
    download_file_resumable(far_cfg["url"], far_path, log)

    # 2. For each site, crop Near Layer and Near Error Layer
    near_cfg = layers["near"]
    near_err_cfg = layers["near_err"]

    for site in sites:
        site_id = site["id"]
        lat = site["lat_deg"]
        lon = site["lon_deg"]
        x, y = transformer.transform(lon, lat)
        log(f"--- Processing Site: {site['name']} (ID: {site_id}) at lat={lat}°, lon={lon}° ---")
        log(f"Stereographic Coordinates: X={x:.1f} m, Y={y:.1f} m")

        # Near height crop: data/raw/near_<site>.tif
        near_dest = RAW_DIR / f"near_{site_id}.tif"
        crop_window_vsicurl(
            near_cfg["url"],
            site_id,
            x,
            y,
            near_cfg["window_half_width_m"],
            near_dest,
            log
        )

        # Near error crop: data/raw/err_<site>.tif
        err_dest = RAW_DIR / f"err_{site_id}.tif"
        crop_window_vsicurl(
            near_err_cfg["url"],
            site_id,
            x,
            y,
            near_err_cfg["window_half_width_m"],
            err_dest,
            log
        )

    # 3. Print stats for all produced files
    log("\n--- Verification Statistics of Generated/Downloaded Files ---")
    all_stats = []

    # Far layer stats
    all_stats.append(print_dataset_stats(far_path, log))

    # Site crops stats
    for site in sites:
        site_id = site["id"]
        all_stats.append(print_dataset_stats(RAW_DIR / f"near_{site_id}.tif", log))
        all_stats.append(print_dataset_stats(RAW_DIR / f"err_{site_id}.tif", log))

    # Save log
    log_file = LOGS_DIR / "step4_fetch_dem_windows.log"
    log_file.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"Wrote log to {log_file.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
