#!/usr/bin/env python3
"""Step 3: Choose terrain windows and configure nested terrain.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts/coordinates).
Allowed hosts: pgda.gsfc.nasa.gov
"""

import datetime
import math
import re
import urllib.request
from pathlib import Path

import pyproj
import yaml

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
SOURCES_DIR = DOCS_DIR / "sources"
CONFIGS_DIR = ROOT / "configs"
LOGS_DIR = ROOT / "logs"

SOURCES_DIR.mkdir(parents=True, exist_ok=True)
CONFIGS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

R_MOON_M = 1737400.0

def fetch_page(url: str, save_path: Path):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "LightPath-DataAcquisition/1.0 (+https://github.com/AnmolGarg8/LightPath)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8", errors="replace")
        save_path.write_text(content, encoding="utf-8")
        return resp.status, len(content), content

def great_circle_distance(lat1_deg: float, lon1_deg: float, lat2_deg: float, lon2_deg: float) -> float:
    phi1 = math.radians(lat1_deg)
    phi2 = math.radians(lat2_deg)
    dphi = math.radians(lat2_deg - lat1_deg)
    dlambda = math.radians(lon2_deg - lon1_deg)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R_MOON_M * c

def main():
    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    now = datetime.timezone.utc
    iso_now = datetime.datetime.now(now).isoformat()
    log(f"=== STEP 3: Choose Windows & Inspect Optional Products ({iso_now}) ===\n")

    # 1. SITES_SOURCED.md check
    sites_sourced_path = DOCS_DIR / "SITES_SOURCED.md"
    if not sites_sourced_path.exists():
        log(f"{sites_sourced_path.name} not found. Creating template per Rule 2...")
        template_text = """# Sourced Lunar South Pole Sites

This file contains human-verified site coordinates with sourced references.
Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts, coordinates, mission names, dates).

## Sourced Sites Table

| Site ID | Site Name | Latitude (°N) | Longitude (°E) | Ground Elevation (m) | Primary Source / Document Reference | Human Verified By | Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *TODO* | *Fill when confirmed* | *Fill* | *Fill* | *Fill* | *Fill* | *Pending human confirmation* | *Pending* |

> [!NOTE]
> For pipeline automated testing when no human-verified sites have been placed in this file,
> LightPath strictly uses the synthetic benchmark site or the designated pipeline test location:
> - Label: `TEST_LOCATION_NOT_A_MISSION_SITE`
> - Latitude: `-89.5`
> - Longitude: `0.0`
> This test location must NEVER be presented as a real mission or landing site.
"""
        sites_sourced_path.write_text(template_text, encoding="utf-8")
        log(f"Created template at {sites_sourced_path.relative_to(ROOT)}")

    # Active sites for pipeline testing
    sites = [
        {
            "id": "test_location",
            "name": "TEST_LOCATION_NOT_A_MISSION_SITE",
            "lat_deg": -89.5,
            "lon_deg": 0.0,
            "is_test_location": True,
        }
    ]

    # 2. Inspect Optional 5m Products (Product 78 and Product 81)
    log("\n--- Inspecting Optional 5m Products on PGDA ---")
    p78_url = "https://pgda.gsfc.nasa.gov/products/78"
    p81_url = "https://pgda.gsfc.nasa.gov/products/81"

    status78, len78, text78 = fetch_page(p78_url, SOURCES_DIR / "pgda_product_78.txt")
    log(f"Product 78 ({p78_url}): HTTP {status78}, {len78} chars saved to docs/sources/pgda_product_78.txt")
    # Matches both quoted and unquoted hrefs
    matches78 = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s>]*\.tif)["\']?[^>]*>(.*?)</a>', text78, re.IGNORECASE)
    log(f"Product 78 TIF files found: {len(matches78)}")
    for url, label in matches78[:15]:
        log(f"  {label.strip()} -> {url}")

    status81, len81, text81 = fetch_page(p81_url, SOURCES_DIR / "pgda_product_81.txt")
    log(f"Product 81 ({p81_url}): HTTP {status81}, {len81} chars saved to docs/sources/pgda_product_81.txt")
    matches81 = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s>]*\.tif)["\']?[^>]*>(.*?)</a>', text81, re.IGNORECASE)
    log(f"Product 81 TIF files found: {len(matches81)}")
    for url, label in matches81[:15]:
        log(f"  {label.strip()} -> {url}")

    # 3. Write configs/terrain_windows.yaml
    config_data = {
        "description": "Nested terrain configuration for LightPath lunar south-pole horizon and route analysis",
        "reference_sphere_radius_m": R_MOON_M,
        "crs": {
            "name": "Moon (2015) South Polar Stereographic",
            "proj4": "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
            "authority": "IAU:30135"
        },
        "layers": {
            "near": {
                "id": "lola_20mpp_near",
                "filename": "LDEM_80S_20MPP_ADJ.TIF",
                "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
                "resolution_m": 20.0,
                "window_half_width_m": 40000.0,  # 40 km half-width (80 km x 80 km total)
                "read_mode": "vsicurl_windowed",
                "download_full": False
            },
            "near_err": {
                "id": "lola_20mpp_err",
                "filename": "LDEM_80S_20MPP_ADJ_ERR.TIF",
                "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ_ERR.TIF",
                "resolution_m": 20.0,
                "window_half_width_m": 40000.0,
                "read_mode": "vsicurl_windowed",
                "download_full": False
            },
            "far": {
                "id": "lola_80mpp_far",
                "filename": "LDEM_80S_80MPP_ADJ.TIF",
                "url": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
                "resolution_m": 80.0,
                "read_mode": "local_full",
                "download_full": True
            },
            "optional_5m": {
                "enabled": False,
                "description": "5m site products from PGDA Products 78 and 81 (disabled by default)"
            }
        },
        "sites": sites
    }

    yaml_path = CONFIGS_DIR / "terrain_windows.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(config_data, f, sort_keys=False, default_flow_style=False)
    log(f"\nWrote terrain configuration to {yaml_path.relative_to(ROOT)}")

    # 4. Compute distances to edges for each site
    log("\n--- Layer Edge Distance Analysis ---")
    transformer = pyproj.Transformer.from_crs(
        "+proj=longlat +R=1737400 +no_defs",
        "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        always_xy=True
    )

    # Dem extent in meters: [-304000, -304000, 304000, 304000]
    # Corresponding to latitude ~ -80 degrees (from pole d = R * (90 - 80)*pi/180 ~ 303,228 m)
    near_half_width_m = 40000.0
    nominal_horizon_range_m = 150000.0  # 150 km

    for s in sites:
        x, y = transformer.transform(s["lon_deg"], s["lat_deg"])
        r_from_pole_m = math.hypot(x, y)

        # Great circle distance from site to lat -80 degrees
        # Site latitude is s["lat_deg"], edge latitude is -80.0
        dist_to_80s_gc_m = great_circle_distance(s["lat_deg"], s["lon_deg"], -80.0, s["lon_deg"])

        # Near layer edge distance is exactly the window half-width
        dist_near_edge_m = near_half_width_m

        log(f"Site: {s['name']} (ID: {s['id']}) at lat={s['lat_deg']}°, lon={s['lon_deg']}°")
        log(f"  Polar stereographic coordinates: X={x:.1f} m, Y={y:.1f} m (Distance from pole: {r_from_pole_m/1000.0:.2f} km)")
        log(f"  Distance to Near Layer Window Edge: {dist_near_edge_m / 1000.0:.1f} km")
        log(f"  Distance to Far Layer (80°S DEM) Edge: {dist_to_80s_gc_m / 1000.0:.1f} km")

        if dist_to_80s_gc_m < nominal_horizon_range_m:
            log(f"  WARNING: Distance to 80°S far layer edge ({dist_to_80s_gc_m/1000.0:.1f} km) is LESS than the nominal horizon range ({nominal_horizon_range_m/1000.0:.1f} km)!")
        else:
            log(f"  [OK] Far layer covers full nominal horizon range of {nominal_horizon_range_m/1000.0:.1f} km (Margin: {(dist_to_80s_gc_m - nominal_horizon_range_m)/1000.0:.1f} km).")

    log_path = LOGS_DIR / "step3_choose_windows.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
