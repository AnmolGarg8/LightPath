# Authoritative Pitch Numbers & Mission Analysis Baseline

> **Generated on:** `2026-11-10`  
> **Source Commit:** `3ab986b` (`3ab986b35e6d76eceef86656a23111ad90a4a1c3`)  
> **Governing Policy:** [`docs/PROJECT_RULES.md`](PROJECT_RULES.md) (Rule 2: Never invent facts; Rule 9: Every number traces to a record).

This reference document compiles every verified quantitative value used in the 3-minute pitch ([`docs/PITCH.md`](PITCH.md)), the project submission dossier ([`docs/SUBMISSION.md`](SUBMISSION.md)), and the 90-second video demo. All values are read directly from committed data artifacts in `web/public/data/`.

---

## 1. Primary Landing & Assessment Site

| Parameter | Value | File of Origin |
| :--- | :--- | :--- |
| **Site Identifier** | `test-location` | `web/public/data/index.json` |
| **Site Name** | Real terrain test location (not a mission site) | `web/public/data/test-location/site.json` |
| **Latitude** | `-89.5° N` | `web/public/data/test-location/site.json` |
| **Longitude** | `0.0° E` | `web/public/data/test-location/site.json` |
| **Ground Elevation** | `-721.96 m` (MOON_ME sphere $R=1,737,400\text{ m}$) | `web/public/data/test-location/site.json` |
| **Analysis Window** | `[2026-11-01T00:00:00Z, 2026-12-01T00:00:00Z)` | `web/public/data/test-location/series.json` |
| **Window Duration** | `720.0 hours` (30.0 days) | `web/public/data/test-location/stats.json` |
| **Sampling Step** | `30 minutes` (1441 total discrete samples) | `web/public/data/test-location/provenance.json` |
| **Observer Mast Height** | `2.0 m` | `web/public/data/test-location/provenance.json` |
| **Azimuth Margin ($\epsilon$)** | `0.03°` (derived from DEM error map) | `web/public/data/test-location/provenance.json` |
| **Skyline Peak** | `9.59°` at Azimuth `159.0°` | `web/public/data/test-location/horizon.json` |

---

## 2. Illumination & Communications Window Statistics

All percentages and hours are computed over the 30-day analysis range (720.0 hours):

| Signal / Channel | Uptime (%) | Total Hours | Longest Window | Longest Outage |
| :--- | :--- | :--- | :--- | :--- |
| **Solar Illumination (Sun $\ge 50\%$)** | **22.7%** | **163.5 h** | 154.0 h | **556.5 h (23.2 days)** |
| **Earth Optical Line-of-Sight** | **36.5%** | **262.5 h** | 246.5 h | **403.0 h (16.8 days)** |
| **Direct-to-Earth (DTE) Link** | **36.5%** | **262.5 h** | 246.5 h | **403.0 h (16.8 days)** |
| **Joint Sunlight & DTE Contact** | **15.1%** | **109.0 h** | 99.5 h | **556.5 h (23.2 days)** |

---

## 3. Topography & Ephemeris Provenance

| Component | Specification / File Manifest | Provenance Source |
| :--- | :--- | :--- |
| **Terrain Elevation Product** | NASA GSFC Planetary Geodesy Data Archive / LOLA 20mpp & 80mpp (Barker et al. 2023) | NASA Planetary Data System / GSFC PGDA |
| **Raster Resolution** | 20 m near / 80 m far | Nested 20 m local crop + 80 m south-pole mosaic |
| **Elevation Formula** | Exact spherical geodesy: $\text{el} = \arctan2((R+z)\cos\theta - (R+z_0), (R+z)\sin\theta)$ | Horn 1981 / exact Moon sphere ($R=1,737,400\text{ m}$) |
| **Planetary Ephemeris** | SPICE DE421 (naif0012.tls, pck00010.tpc, moon_pa_de421_1900-2050.bpc, moon_080317.tf, de421.bsp) | NASA NAIF SPICE kernels (DE421) |
| **Ephemeris Frame** | Mean Earth / Polar Axis (`MOON_ME`) | IAU lunar cartographic standard |

---

## 4. Scientific Verification Suite (V1 to V8)

Values extracted directly from automated verification runs (`web/public/data/test_results.json`):

| Code | Benchmark Description | Status | Measured Accuracy / Value | Tolerance |
| :--- | :--- | :--- | :--- | :--- |
| **V1** | Flat sphere horizon dip ($h = 2\text{ m}$) | **`PASSED`** | `-0.086937 deg (max error: 0.000001 deg)` | `0.005°` |
| **V2** | Ridge feature elevation ($100\text{ m}$ at $10\text{ km}$) | **`PASSED`** | `0.409510 deg (max error: 0.002960 deg)` | `0.010°` |
| **V3** | SPICE Ephemeris vs. JPL Horizons Baseline | **`PASSED`** | `Sun Az max 0.000005 deg, El max 0.000014 deg; Earth Az max 0.000005 deg, El max 0.000038 deg` | `0.010°` |
| **V4** | Comparison with published NASA literature | **`NOT RUN`** | *Fixture absent — honest status* | `±2.0%` |
| **V5** | Raycast convergence & mast scaling | **`PASSED`** | `5m error: 0.0000 deg; all 5 convergence bounds passed` | `0.005°` |
| **V6** | Binary bit-for-bit reproducibility | **`PASSED`** | `100% byte identical across runs (0 bytes delta)` | `0 bytes` |
| **V7** | Independent third-party cross-check | **`NOT RUN`** | *Fixture absent — honest status* | `0.020°` |
| **V8** | 4D space-time route solver optimality | **`PASSED`** | `0.0% path delta across 300 brute-force grids (300/300 optimal)` | `0.0%` |

---

## 5. 4D Space-Time Route Solver Benchmark

Evaluated on the visibility cube for `test-location` (`web/public/data/cubes/test-location.json`):

| Parameter | Value | Notes |
| :--- | :--- | :--- |
| **Traverse Start Coordinate** | `(3, 3)` | Discrete grid cell index |
| **Traverse Goal Coordinate** | `(20, 20)` | Discrete grid cell index |
| **Rover Speed** | `0.05 m/s` (180 m/h) | Standard CLPS rover mobility rate |
| **Max Mechanical Slope** | `15.0°` | Traversability limit via Horn 1981 gradient |
| **Total Departure Steps Evaluated** | `97` | Steps 0 to 96 (48-hour forward departure sweep) |
| **Feasible Departure Steps** | **`10 steps`** | Steps 0 through 9 are feasible |
| **Feasible Departure Window** | **`4.5 hours`** | `2026-11-01T00:00:00Z` to `2026-11-01T04:30:00Z` |
| **Nominal Transit Time** | **`6.7 hours`** | Single traverse duration at Step 0 |
| **Infeasibility Bottleneck (> Step 9)** | Corridor shadow: moving lunar shadow obstructs corridor; darkness along traverse exceeds allowable dark budget (0.0 h) | Explained dynamically by solver |
