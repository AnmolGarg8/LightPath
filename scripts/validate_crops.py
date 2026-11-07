#!/usr/bin/env python3
"""Step 5: Generate hillshade previews and compute error statistics.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/metrics).
"""

import datetime
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pyproj
import rasterio
import yaml
from matplotlib.colors import LightSource

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "configs" / "terrain_windows.yaml"
RAW_DIR = ROOT / "data" / "raw"
IMAGES_DIR = ROOT / "docs" / "images"
DOCS_DIR = ROOT / "docs"
LOGS_DIR = ROOT / "logs"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def generate_hillshade_preview(dem_path: Path, out_png: Path, site_x: float = None, site_y: float = None, site_label: str = None, max_dim: int = 1000):
    with rasterio.open(dem_path) as src:
        # If image is very large (e.g. 7600x7600 far layer), subsample for preview to keep under 300 KB
        scale_factor = max(1, max(src.width, src.height) // max_dim)
        out_shape = (src.height // scale_factor, src.width // scale_factor)
        data = src.read(1, out_shape=out_shape, resampling=rasterio.enums.Resampling.bilinear)
        bounds = src.bounds
        nodata = src.nodata

    # Mask nodata or nan
    valid_mask = ~np.isnan(data)
    if nodata is not None and not np.isnan(nodata):
        valid_mask &= (data != nodata)

    min_val = np.min(data[valid_mask]) if np.any(valid_mask) else 0.0
    filled_data = np.where(valid_mask, data, min_val)

    ls = LightSource(azdeg=315, altdeg=45)
    rgb = ls.shade(filled_data, cmap=plt.cm.bone, vert_exag=1.5, blend_mode="overlay")

    fig, ax = plt.subplots(figsize=(5, 5), dpi=80)
    extent = [bounds.left / 1000.0, bounds.right / 1000.0, bounds.bottom / 1000.0, bounds.top / 1000.0]  # km
    ax.imshow(rgb, extent=extent, origin="upper")

    if site_x is not None and site_y is not None:
        sx_km = site_x / 1000.0
        sy_km = site_y / 1000.0
        ax.plot(sx_km, sy_km, "r+", markersize=10, markeredgewidth=2, label=site_label or "Site")
        ax.legend(loc="upper right", framealpha=0.8, fontsize=8)

    ax.set_title(f"Terrain Hillshade: {dem_path.name}", fontsize=9)
    ax.set_xlabel("Polar Stereographic X (km)", fontsize=8)
    ax.set_ylabel("Polar Stereographic Y (km)", fontsize=8)
    ax.tick_params(labelsize=7)

    plt.tight_layout()
    fig.savefig(out_png, dpi=80, format="png")
    plt.close(fig)

    file_size_kb = out_png.stat().st_size / 1024.0
    return file_size_kb

def main():
    log_lines = []
    def log(msg):
        print(msg, flush=True)
        log_lines.append(msg)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log(f"=== STEP 5: Validate Crops & Generate Previews ({now}) ===\n")

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    transformer = pyproj.Transformer.from_crs(
        "+proj=longlat +R=1737400 +no_defs",
        cfg["crs"]["proj4"],
        always_xy=True
    )

    sites = cfg["sites"]
    err_reports = []

    for site in sites:
        site_id = site["id"]
        lat = site["lat_deg"]
        lon = site["lon_deg"]
        x, y = transformer.transform(lon, lat)

        near_path = RAW_DIR / f"near_{site_id}.tif"
        err_path = RAW_DIR / f"err_{site_id}.tif"

        if not near_path.exists():
            log(f"ERROR: {near_path.name} does not exist yet!")
            sys.exit(1)

        # 1. Hillshade of near window with site marked
        near_png = IMAGES_DIR / f"terrain_preview_{site_id}.png"
        near_size_kb = generate_hillshade_preview(near_path, near_png, site_x=x, site_y=y, site_label=site["name"])
        log(f"Generated near preview: {near_png.name} ({near_size_kb:.1f} KB, target < 300 KB: {near_size_kb < 300.0})")

        # 2. Error statistics on near error window
        if err_path.exists():
            with rasterio.open(err_path) as err_src:
                err_data = err_src.read(1)
                valid_err = err_data[~np.isnan(err_data)]
                err_median = float(np.median(valid_err))
                err_p95 = float(np.percentile(valid_err, 95))
                log(f"Error Statistics for site '{site_id}':")
                log(f"  Valid Error Samples: {valid_err.size:,}")
                log(f"  Median Z Error: {err_median:.3f} m")
                log(f"  95th Percentile Z Error: {err_p95:.3f} m\n")

                err_reports.append({
                    "site_id": site_id,
                    "site_name": site["name"],
                    "median_err_m": err_median,
                    "p95_err_m": err_p95,
                })

    # 3. Hillshade of far layer
    far_path = RAW_DIR / cfg["layers"]["far"]["filename"]
    if far_path.exists():
        far_png = IMAGES_DIR / "terrain_preview_far.png"
        far_size_kb = generate_hillshade_preview(far_path, far_png, site_label="Far Layer 80mpp")
        log(f"Generated far layer preview: {far_png.name} ({far_size_kb:.1f} KB, target < 300 KB: {far_size_kb < 300.0})")

    # 4. Append/Update error statistics in docs/terrain_inspection.md
    if err_reports:
        inspection_path = DOCS_DIR / "terrain_inspection.md"
        content = inspection_path.read_text(encoding="utf-8") if inspection_path.exists() else ""
        if "## 3. Near-Window Surface Height Error Statistics" in content:
            content = content.split("## 3. Near-Window Surface Height Error Statistics")[0].rstrip() + "\n\n"

        addendum = [
            "## 3. Near-Window Surface Height Error Statistics",
            "",
            "Measured directly from `LDEM_80S_20MPP_ADJ_ERR.TIF` across the cropped near-layer windows:",
            "",
            "| Site ID | Site Name | Window Extent | Median Z Error (m) | 95th Percentile Z Error (m) | Recommended Angular Margin (deg) |",
            "| :--- | :--- | :--- | :-: | :-: | :-: |",
        ]
        for r in err_reports:
            # Angular margin: at 1000m range, arctan(p95 / 1000)
            rec_deg = math.degrees(math.atan2(r["p95_err_m"], 1000.0))
            addendum.append(f"| `{r['site_id']}` | {r['site_name']} | 80 km x 80 km | {r['median_err_m']:.3f} | {r['p95_err_m']:.3f} | {rec_deg:.3f}° |")
        addendum.append("")

        inspection_path.write_text(content + "\n".join(addendum), encoding="utf-8")
        log(f"Appended error statistics to {inspection_path.relative_to(ROOT)}")

    log_path = LOGS_DIR / "step5_validate_crops.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
