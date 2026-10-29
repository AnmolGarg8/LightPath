#!/usr/bin/env python3
"""Run complete LightPath data pipeline for Lunar CLPS South Pole sites.

Generates and validates:
- site.json
- horizon.json
- series.json
- stats.json
- visibility_cube.json
- route_result.json
- provenance.json
- run_info.json

Usage:
    python scripts/run_pipeline.py [--site-id ID] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from jsonschema import validate

# Ensure pipeline on path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipeline.cube import compute_visibility_cube  # noqa: E402
from pipeline.horizon import compute_synthetic_horizon_profile  # noqa: E402
from pipeline.provenance import create_provenance_record, create_run_info  # noqa: E402
from pipeline.routing import plan_lunar_traverse  # noqa: E402
from pipeline.series import compute_series_and_stats, generate_time_steps  # noqa: E402

SCHEMAS_DIR = ROOT_DIR / "schemas"
CONFIGS_DIR = ROOT_DIR / "configs"
DATA_PROCESSED_DIR = ROOT_DIR / "data" / "processed"
WEB_DATA_DIR = ROOT_DIR / "web" / "public" / "data"


def load_schema(name: str) -> dict:
    with open(SCHEMAS_DIR / f"{name}.schema.json", "r", encoding="utf-8") as f:
        return json.load(f)


def run_pipeline_for_site(
    site: dict,
    start_iso: str = "2026-11-01T00:00:00Z",
    end_iso: str = "2026-11-15T00:00:00Z",
    step_minutes: int = 60,
    observer_height_m: float = 2.0,
):
    site_id = site["id"]
    print(f"--> Processing site: {site['name']} (ID: {site_id})")

    # Load schemas
    site_schema = load_schema("site")
    horizon_schema = load_schema("horizon")
    series_schema = load_schema("series")
    stats_schema = load_schema("stats")
    cube_schema = load_schema("visibility_cube")
    route_schema = load_schema("route_result")
    provenance_schema = load_schema("provenance")
    run_info_schema = load_schema("run_info")

    # Validate site
    validate(instance=site, schema=site_schema)

    # 1. Horizon profile
    # For south pole regions, crater rims / mountain massifs create distinctive horizons
    features = []
    if site_id == "shackleton-connecting-ridge":
        features = [
            {"az_center_deg": 120.0, "width_deg": 25.0, "height_deg": 3.2},
            {"az_center_deg": 300.0, "width_deg": 30.0, "height_deg": 1.8},
        ]
    elif site_id == "malapert-mountain":
        # Elevated massif: low horizon, high clearance
        features = [
            {"az_center_deg": 45.0, "width_deg": 15.0, "height_deg": 0.5},
        ]

    prof = compute_synthetic_horizon_profile(
        az_step_deg=1.0,
        heights_m=[0.0, 2.0, 5.0, 10.0],
        base_elev_m=site["ground_elev_m"],
        features=features,
    )
    horizon_dict = prof.to_dict()
    validate(instance=horizon_dict, schema=horizon_schema)

    # 2. Time series & stats
    timestamps = generate_time_steps(start_iso, end_iso, step_minutes=step_minutes)
    series_dict, stats_dict = compute_series_and_stats(
        site_lat_deg=site["lat_deg"],
        site_lon_deg=site["lon_deg"],
        site_ground_elev_m=site["ground_elev_m"],
        horizon_profile=prof,
        timestamps=timestamps,
        observer_height_m=observer_height_m,
    )
    validate(instance=series_dict, schema=series_schema)
    validate(instance=stats_dict, schema=stats_schema)

    # 3. Visibility Cube (5x5 grid around site for 12 hours)
    nx, ny = 7, 7
    spacing_m = 40.0
    cube_timestamps = timestamps[:13]  # First 12 hours (hourly steps)
    elev_dem = np.zeros((ny, nx), dtype=np.float64)
    # Realistic gentle undulating crater terrain
    for r in range(ny):
        for c in range(nx):
            dx = (c - nx // 2) * spacing_m
            dy = (r - ny // 2) * spacing_m
            elev_dem[r, c] = site["ground_elev_m"] + 0.05 * dx + 0.03 * dy + 2.0 * np.sin(dx / 50.0)

    cube_dict = compute_visibility_cube(
        center_lat_deg=site["lat_deg"],
        center_lon_deg=site["lon_deg"],
        spacing_m=spacing_m,
        nx=nx,
        ny=ny,
        timestamps=cube_timestamps,
        elev_dem_m=elev_dem,
        max_slope_deg=15.0,
    )
    validate(instance=cube_dict, schema=cube_schema)

    # 4. Route planner traverse result
    route_dict = plan_lunar_traverse(
        visibility_cube=cube_dict,
        start_coord=(1, 1),
        end_coord=(5, 5),
        start_time_idx=0,
        speed_m_s=0.08,
        mode="rover",
        max_slope_deg=15.0,
        min_sun_frac=0.50,
        min_earth_frac=0.50,
    )
    validate(instance=route_dict, schema=route_schema)

    # 5. Provenance & Run Info
    prov_dict = create_provenance_record(
        parameters={
            "site_id": site_id,
            "observer_height_m": observer_height_m,
            "start_utc": start_iso,
            "end_utc": end_iso,
            "step_minutes": step_minutes,
        }
    )
    validate(instance=prov_dict, schema=provenance_schema)

    run_info_dict = create_run_info()
    validate(instance=run_info_dict, schema=run_info_schema)

    # Output directories
    out_dirs = [DATA_PROCESSED_DIR / site_id, WEB_DATA_DIR / site_id]
    for out_dir in out_dirs:
        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / "site.json", "w", encoding="utf-8") as f:
            json.dump(site, f, indent=2)
        with open(out_dir / "horizon.json", "w", encoding="utf-8") as f:
            json.dump(horizon_dict, f, indent=2)
        with open(out_dir / "series.json", "w", encoding="utf-8") as f:
            json.dump(series_dict, f, indent=2)
        with open(out_dir / "stats.json", "w", encoding="utf-8") as f:
            json.dump(stats_dict, f, indent=2)
        with open(out_dir / "visibility_cube.json", "w", encoding="utf-8") as f:
            json.dump(cube_dict, f, indent=2)
        with open(out_dir / "route_result.json", "w", encoding="utf-8") as f:
            json.dump(route_dict, f, indent=2)
        with open(out_dir / "provenance.json", "w", encoding="utf-8") as f:
            json.dump(prov_dict, f, indent=2)
        with open(out_dir / "run_info.json", "w", encoding="utf-8") as f:
            json.dump(run_info_dict, f, indent=2)

    print(f"   [OK] Site {site_id} completed successfully. Data exported.")


def main():
    parser = argparse.ArgumentParser(description="LightPath simulation pipeline")
    parser.add_argument("--site-id", type=str, help="Process single site ID")
    parser.add_argument("--start", type=str, default="2026-11-01T00:00:00Z")
    parser.add_argument("--end", type=str, default="2026-11-15T00:00:00Z")
    parser.add_argument("--step-minutes", type=int, default=60)
    args = parser.parse_args()

    with open(CONFIGS_DIR / "sites.json", "r", encoding="utf-8") as f:
        sites = json.load(f)

    # Copy site catalog to processed and web public
    for target_dir in [DATA_PROCESSED_DIR, WEB_DATA_DIR]:
        target_dir.mkdir(parents=True, exist_ok=True)
        with open(target_dir / "sites.json", "w", encoding="utf-8") as f:
            json.dump(sites, f, indent=2)

    selected_sites = [s for s in sites if args.site_id is None or s["id"] == args.site_id]
    if not selected_sites:
        print(f"Error: No sites found matching --site-id {args.site_id}")
        sys.exit(1)

    for site in selected_sites:
        run_pipeline_for_site(
            site=site,
            start_iso=args.start,
            end_iso=args.end,
            step_minutes=args.step_minutes,
        )

    print("All site processing complete.")


if __name__ == "__main__":
    main()
