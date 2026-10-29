#!/usr/bin/env python3
"""Print exact JPL Horizons parameters and instructions for generating lunar validation fixtures.

Rules:
- DO NOT CALL THE NETWORK. This script generates only parameters and instructions.
- Target: Sun (10) and Earth (399).
- Observer: Topocentric site on the Moon (body 301).
- Reference Frame: MOON_ME (IAU Mean Earth / Polar Axis frame).
"""

import argparse
from urllib.parse import urlencode


def generate_horizons_instructions(
    site_name: str = "Shackleton Connecting Ridge",
    lat_deg: float = -89.44,
    lon_deg: float = 137.5,
    elev_m: float = 1250.0,
    start_utc: str = "2026-11-01 00:00",
    stop_utc: str = "2026-11-15 00:00",
    step_size: str = "1 h",
):
    elev_km = elev_m / 1000.0

    print("================================================================================")
    print("           NASA JPL HORIZONS VALIDATION FIXTURE GENERATION GUIDE")
    print("================================================================================")
    print("In accordance with Rule 8 and Rule 2, this script does NOT call the network.")
    print("Follow the instructions below to download independent JPL Horizons benchmark data.\n")

    print(f"Target Site:       {site_name}")
    print(f"Coordinates:       Latitude: {lat_deg:.4f}° | Longitude: {lon_deg:.4f}° E | Altitude: {elev_km:.3f} km")
    print("Reference Frame:   MOON_ME (Moon Mean Earth / Polar Axis IAU frame, Center: 301)")
    print(f"Time Window:       {start_utc} to {stop_utc} UTC (Step: {step_size})\n")

    # 1. Web REST API URLs (copy & paste into browser or curl)
    base_api = "https://ssd.jpl.nasa.gov/api/horizons.api"

    common_params = {
        "format": "text",
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"'{lon_deg},{lat_deg},{elev_km}'",
        "START_TIME": f"'{start_utc}'",
        "STOP_TIME": f"'{stop_utc}'",
        "STEP_SIZE": f"'{step_size}'",
        "QUANTITIES": "'4,20'",  # 4: Apparent Az/El, 20: Target distance & angular diameter
        "ANG_FORMAT": "DEG",
        "TIME_DIGITS": "MINUTES",
    }

    # Sun query
    sun_params = dict(common_params)
    sun_params["COMMAND"] = "'10'"  # Sun
    sun_url = f"{base_api}?{urlencode(sun_params)}"

    # Earth query
    earth_params = dict(common_params)
    earth_params["COMMAND"] = "'399'"  # Earth
    earth_url = f"{base_api}?{urlencode(earth_params)}"

    print("--- 1. REST API URLS (Human Operator: run curl or open in browser) ---")
    print("\n[A] Topocentric Sun Query (Center @ Moon site):")
    print(f"{sun_url}\n")

    print("[B] Topocentric Earth Query (Center @ Moon site):")
    print(f"{earth_url}\n")

    print("--- 2. BATCH SPECIFICATION (For horizons@ssd.jpl.nasa.gov email interface) ---")
    batch_text = f"""!$$SOF (Start of batch specification)
COMMAND       = '10'
CENTER        = 'coord@301'
COORD_TYPE    = 'GEODETIC'
SITE_COORD    = '{lon_deg},{lat_deg},{elev_km}'
START_TIME    = '{start_utc}'
STOP_TIME     = '{stop_utc}'
STEP_SIZE     = '{step_size}'
QUANTITIES    = '4,20'
ANG_FORMAT    = 'DEG'
CSV_FORMAT    = 'YES'
!$$EOF (End of batch specification)"""
    print(batch_text)

    print("\n--- 3. VERIFICATION INSTRUCTIONS ---")
    print("1. Download the output text files from the URLs above.")
    print("2. Save files into tests/fixtures/horizons_sun.txt and tests/fixtures/horizons_earth.txt.")
    print("3. Verify that the difference between LightPath topocentric Az/El and Horizons is < 0.01 deg.")
    print("================================================================================\n")


def main():
    parser = argparse.ArgumentParser(description="Generate JPL Horizons parameters for lunar site fixtures")
    parser.add_argument("--site", type=str, default="Shackleton Connecting Ridge", help="Site name")
    parser.add_argument("--lat", type=float, default=-89.44, help="Latitude in degrees")
    parser.add_argument("--lon", type=float, default=137.5, help="Longitude in degrees")
    parser.add_argument("--elev", type=float, default=1250.0, help="Elevation in meters")
    parser.add_argument("--start", type=str, default="2026-11-01 00:00", help="Start UTC")
    parser.add_argument("--stop", type=str, default="2026-11-15 00:00", help="Stop UTC")
    parser.add_argument("--step", type=str, default="1 h", help="Step size")
    args = parser.parse_args()

    generate_horizons_instructions(
        site_name=args.site,
        lat_deg=args.lat,
        lon_deg=args.lon,
        elev_m=args.elev,
        start_utc=args.start,
        stop_utc=args.stop,
        step_size=args.step,
    )


if __name__ == "__main__":
    main()
