# JPL Horizons Validation Fixtures Guide

This document explains how human operators produce independent benchmark validation fixtures from the NASA JPL Horizons system, how Horizons defines local vertical and coordinate frames, and how to verify LightPath against Horizons data.

---

## 1. How to Produce Horizons Fixtures

In accordance with Rule 8 and Rule 2, LightPath does not make network calls during test execution. A human operator generates validation fixtures using the following procedure:

1. Run the parameter generator script:
   ```bash
   python scripts/make_horizons_request.py --site "Shackleton Connecting Ridge" --lat -89.44 --lon 137.5 --elev 1250.0 --start "2026-11-01 00:00" --stop "2026-11-15 00:00" --step "1 h"
   ```
2. Copy the resulting REST API URL or send the batch specification email to `horizons@ssd.jpl.nasa.gov`.
3. Save the resulting output CSV data into `tests/fixtures/horizons_shackleton_sun.csv`.
4. Create the JSON sidecar `tests/fixtures/horizons_shackleton_sun.json` specifying the metadata and tolerance.

### Required CSV Format (`tests/fixtures/horizons_<site>_<target>.csv`)
```csv
utc,az_deg,el_deg
2026-11-01 00:00,124.52,1.23
2026-11-01 01:00,125.04,1.25
```

### Required JSON Sidecar Format (`tests/fixtures/horizons_<site>_<target>.json`)
```json
{
  "site": {
    "name": "Shackleton Connecting Ridge",
    "lat_deg": -89.44,
    "lon_deg": 137.5,
    "ground_elev_m": 1250.0
  },
  "target": "SUN",
  "start_utc": "2026-11-01T00:00:00Z",
  "end_utc": "2026-11-15T00:00:00Z",
  "step_minutes": 60,
  "tolerance_deg": 0.05
}
```

---

## 2. Understanding Coordinate Definitions & Local Vertical

When comparing LightPath topocentric Az/El against JPL Horizons, subtle frame differences must be accounted for:

### A. Datum Reference Sphere vs Horizons Ellipsoid
- **LightPath**: Strictly adopts the NASA LOLA reference sphere ($R_{\text{moon}} = 1,737,400.0\text{ m}$) in the Moon Mean Earth/Polar Axis frame (`MOON_ME`). The local vertical (zenith unit vector $\mathbf{u}$) is the outward radial unit vector:
  $$\mathbf{u} = [\cos(\phi)\cos(\lambda), \cos(\phi)\sin(\lambda), \sin(\phi)]^T$$
- **JPL Horizons**: Uses the IAU lunar reference triaxial/ellipsoid for Moon body 301. For `COORD_TYPE='GEODETIC'`, the local geodetic vertical is perpendicular to the reference ellipsoid tangent plane. On the Moon, flattening is negligible ($f \approx 0.0012$), causing $< 0.01^\circ$ deflection of vertical between geocentric/spherical and geodetic coordinates.

### B. Azimuth Definition
- Both LightPath and Horizons define topocentric Azimuth clockwise from local geodetic North:
  - $0^\circ = \text{North}$
  - $90^\circ = \text{East}$
  - $180^\circ = \text{South}$
  - $270^\circ = \text{West}$
- Near the lunar poles ($\phi \to -90^\circ$), meridians converge. LightPath explicitly adopts the IAU/LOLA cartographic convention where local North points toward the sub-Earth Prime Meridian ($+X$, lon $0^\circ$).

### C. Refraction
- The Moon has a surface exosphere with essentially zero atmospheric refraction. Both Horizons (vacuum calculation) and LightPath omit atmospheric bending.

---

## 3. Automated Test Verification

Once fixture files are placed in `tests/fixtures/`, run:
```bash
pytest tests/test_geometry.py -k test_horizons_fixture_benchmark -s
```
The test automatically parses the CSV, runs LightPath topocentric series, and prints the Max and RMS elevation and azimuth differences. If differences exceed `tolerance_deg` (default $0.05^\circ$), the test fails.
