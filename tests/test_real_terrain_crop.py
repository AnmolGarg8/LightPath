"""Validation tests for real terrain crops.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 1: Correctness before features).
Marked real_data and skipped when files are absent.
"""

import math
from pathlib import Path

import numpy as np
import pytest
import rasterio
import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "configs" / "terrain_windows.yaml"
RAW_DIR = ROOT / "data" / "raw"

def get_sites():
    if not CONFIG_PATH.exists():
        return []
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    return cfg.get("sites", [])

SITES = get_sites()

@pytest.mark.real_data
@pytest.mark.parametrize("site", SITES, ids=[s["id"] for s in SITES])
def test_crop_margin_and_site_elevation(site):
    """Test 2: The site coordinate must fall inside the crop with at least 10 km margin;

    print the height at the site.
    """
    site_id = site["id"]
    near_path = RAW_DIR / f"near_{site_id}.tif"
    if not near_path.exists():
        pytest.skip(f"Crop {near_path.name} not present.")

    import pyproj
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    transformer = pyproj.Transformer.from_crs(
        "+proj=longlat +R=1737400 +no_defs",
        cfg["crs"]["proj4"],
        always_xy=True
    )
    sx, sy = transformer.transform(site["lon_deg"], site["lat_deg"])

    with rasterio.open(near_path) as src:
        bounds = src.bounds
        margin_left = sx - bounds.left
        margin_right = bounds.right - sx
        margin_bottom = sy - bounds.bottom
        margin_top = bounds.top - sy

        min_margin_m = min(margin_left, margin_right, margin_bottom, margin_top)
        assert min_margin_m >= 10000.0, f"Crop margin {min_margin_m:.1f} m is less than 10 km!"

        # Sample height at site
        row, col = src.index(sx, sy)
        data = src.read(1)
        site_height_m = float(data[row, col])
        assert not np.isnan(site_height_m), "Site elevation is NaN!"
        print(f"\n[Site {site_id}] Ground elevation at ({site['lat_deg']}°, {site['lon_deg']}°): {site_height_m:.2f} m")
        print(f"  Crop boundary margin: {min_margin_m / 1000.0:.2f} km (required >= 10.0 km)")


@pytest.mark.real_data
@pytest.mark.parametrize("site", SITES, ids=[s["id"] for s in SITES])
def test_crop_elevation_plausibility(site):
    """Test 3: Heights must lie within a plausible range for the lunar south pole

    (-10 km to +12 km relative to the sphere).
    """
    site_id = site["id"]
    near_path = RAW_DIR / f"near_{site_id}.tif"
    if not near_path.exists():
        pytest.skip(f"Crop {near_path.name} not present.")

    with rasterio.open(near_path) as src:
        data = src.read(1)
        valid = data[~np.isnan(data)]
        h_min = float(np.min(valid))
        h_max = float(np.max(valid))

        print(f"\n[Site {site_id}] Crop elevation range: [{h_min:.2f} m, {h_max:.2f} m]")
        assert h_min >= -10000.0, f"Minimum elevation {h_min:.2f} m is below -10,000 m limit!"
        assert h_max <= 12000.0, f"Maximum elevation {h_max:.2f} m is above +12,000 m limit!"


@pytest.mark.real_data
@pytest.mark.parametrize("site", SITES, ids=[s["id"] for s in SITES])
def test_crop_nodata_fraction(site):
    """Test 4: No-data fraction below 1 percent in the near layer."""
    site_id = site["id"]
    near_path = RAW_DIR / f"near_{site_id}.tif"
    if not near_path.exists():
        pytest.skip(f"Crop {near_path.name} not present.")

    with rasterio.open(near_path) as src:
        data = src.read(1)
        nodata_frac = float(np.isnan(data).sum() / data.size)
        print(f"\n[Site {site_id}] No-data fraction: {nodata_frac:.4%}")
        assert nodata_frac < 0.01, f"No-data fraction {nodata_frac:.4%} exceeds 1.0% limit!"


@pytest.mark.real_data
@pytest.mark.network
@pytest.mark.real_data
@pytest.mark.network
@pytest.mark.parametrize("site", SITES, ids=[s["id"] for s in SITES])
def test_random_25_pixels_identical_to_remote(site):
    """Test 1: Pick 25 random pixels inside each cropped window; read the same coordinates

    from the remote file with /vsicurl/ and from the local crop; the values must be identical.
    """
    site_id = site["id"]
    near_path = RAW_DIR / f"near_{site_id}.tif"
    if not near_path.exists():
        pytest.skip(f"Crop {near_path.name} not present.")

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    remote_url = f"/vsicurl/{cfg['layers']['near']['url']}"

    rng = np.random.default_rng(seed=42)

    with rasterio.open(near_path) as local_src, rasterio.open(remote_url) as remote_src:
        local_data = local_src.read(1)
        rows = rng.integers(0, local_src.height, size=25)
        cols = rng.integers(0, local_src.width, size=25)

        for r, c in zip(rows, cols):
            local_val = float(local_data[r, c])
            x, y = local_src.xy(r, c)
            rem_r, rem_c = remote_src.index(x, y)
            rem_window = rasterio.windows.Window(rem_c, rem_r, 1, 1)
            rem_val = float(remote_src.read(1, window=rem_window)[0, 0])

            if np.isnan(local_val):
                assert np.isnan(rem_val), f"Local is NaN but remote is {rem_val} at ({x}, {y})"
            else:
                assert math.isclose(local_val, rem_val, abs_tol=1e-5), f"Mismatch at ({x}, {y}): local={local_val}, remote={rem_val}"
        print(f"\n[Site {site_id}] 25 random pixel coordinates identical between local crop and remote /vsicurl/ source.")
