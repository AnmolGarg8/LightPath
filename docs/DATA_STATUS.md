# LightPath Data Status Matrix

Governed by `docs/PROJECT_RULES.md` (Rule 2: Never invent facts or citations; Rule 3: Never present synthetic data as real).

This document provides a single, authoritative reference matrix declaring the data status—real, synthetic, placeholder, or not run—for every pipeline asset, ephemeris model, terrain raster, coordinate set, and benchmark in LightPath.

---

## Data Status Matrix

| Subsystem / Data Item | Status | Source / Provenance | Verification / Notes |
| :--- | :---: | :--- | :--- |
| **Near-Field Terrain (`test-location`)** | **REAL** | NASA LRO LOLA DEM (`LDEM_80S_20MPP_ADJ.TIF`, 20 m/pixel) | Local GeoTIFF crop in `data/raw/near_test_location.tif` with margin $\ge 10\text{ km}$. Ground elevation $-721.96\text{ m}$ sampled via bilinear interpolation. |
| **Far-Field Terrain (`test-location`)** | **REAL** | NASA LRO LOLA DEM (`LDEM_80S_80MPP_ADJ.TIF`, 80 m/pixel) | Full-coverage south-polar raster for 360° horizon raycasting up to $120\text{ km}$ range. |
| **Ephemerides (Sun & Earth positions)** | **REAL** | NASA NAIF SPICE Kernels (`de421.bsp`, `pck00010.tpc`, `moon_pa_de421_1900-2050.bpc`, `naif0012.tls`, `moon_080317.tf`) | Topocentric vectors in `MOON_ME` with per-point local vertical and aberration `NONE` (`ABCORR_FOR_VALIDATION`). Evaluated against JPL Horizons ($\le 0.00049^\circ \le 0.010^\circ$). |
| **Planetary Constants & Geometry** | **REAL** | Archinal et al. (2018) / IAU Cartographic Frame | Lunar radius $R = 1,737,400.0\text{ m}$; Sun angular radius $0.266^\circ$ ($0.53^\circ$ diameter); Earth angular radius $0.950^\circ$ ($1.90^\circ$ diameter). |
| **Test Location Coordinates** | **REAL** | Arbitrary real south-polar coordinate ($\text{lat}=-89.5^\circ, \text{lon}=0.0^\circ$) | Explicitly badged as "Test location, not a mission site" to avoid confusion with mission landing targets. |
| **Horizon Skyline Profile (`test-location`)** | **REAL** | Raycast great-circle geodesics across LOLA DEMs | 360 azimuth bins ($1.0^\circ$ step) from $1.0\text{ m}$ to $10.0\text{ m}$ mast heights. |
| **Visibility Cube (`test-location`)** | **REAL** | Computed from LOLA DEM & SPICE kernels | $25 \times 25$ spatial grid ($50\text{ m}$ spacing), 1,441 half-hour steps (2026-11-01 to 2026-12-01). Binary cube: `cubes/test-location.bin` (133 kB). |
| **Synthetic Proving Ground Terrain** | **SYNTHETIC** | Procedural geometric model | Flat circular basin ($R = 1,737,400\text{ m}$), $100\text{ m}$ vertical wall feature, synthetic crater rim. Used exclusively for closed-form mathematical benchmark verification (V1, V2). |
| **Synthetic Proving Ground Cube** | **SYNTHETIC** | Procedural lighting & moving shadow field | $25 \times 25$ grid, $50\text{ m}$ spacing, 1,441 steps. Permanent `is_synthetic: true` flag and UI banner. |
| **DSN Ground Station Coordinates** | **PLACEHOLDER** | `configs/dsn_stations.yaml` (Goldstone, Madrid, Canberra) | Unverified coordinates marked `verified: false`. Used for multi-lane contact line-of-sight demonstrations. |
| **Example Landing Sites (Missions)** | **UNVERIFIED SOURCED** | `data/missions.json`, `docs/MISSION_SOURCES.md` | Sourced coordinates for polar exploration candidate zones without computed illumination datasets. Displayed as unverified example entries. |
| **Benchmark V4 (NASA Published Baseline)** | **NOT RUN** | Pending human operator input | Marked `NOT RUN` in Trust dashboard. Requires human investigator to supply `tests/fixtures/published_<site>.json` (see `docs/V4_HOW_TO.md`). |
| **Benchmark V7 (Independent Ephemeris)** | **OPTIONAL / NOT RUN** | PyEphem / Skyfield cross-check | Secondary independent sanity check; SPICE vs. Horizons (V3) serves as authoritative ephemeris proof. |
