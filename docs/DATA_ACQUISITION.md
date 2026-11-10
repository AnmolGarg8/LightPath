# LightPath Data Acquisition Log

Governed by `docs/PROJECT_RULES.md` (Rule 2: Never invent facts, coordinates, file names, checksums, or citations; Rule 9: Every number traces to a record).

This document records the provenance, download commands, verification checksums, sizes, and execution metrics for all real scientific data acquired for the LightPath system under Task S0.

---

## 1. Summary of Acquired Data

| Dataset Category | Source Host | Files Acquired | Total Size on Disk | Acquisition Time | Status |
| :--- | :--- | :-: | :-: | :-: | :-: |
| **NAIF SPICE Kernels** | `naif.jpl.nasa.gov` | 5 | 18,713,858 bytes (17.85 MB) | 5.7 s | **Verified** |
| **LOLA Far Layer DEM** | `pgda.gsfc.nasa.gov` | 1 | 189,158,392 bytes (180.40 MB) | 895.2 s | **Verified** |
| **LOLA Near Layer Crops** | `pgda.gsfc.nasa.gov` | 2 | 109,309,087 bytes (104.24 MB) | 74.2 s | **Verified** |
| **JPL Horizons Fixtures** | `ssd.jpl.nasa.gov` | 6 | 312,238 bytes (0.30 MB) | 3.2 s | **Verified** |
| **Total** | — | **14** | **317,493,575 bytes (302.79 MB)** | **978.3 s (~16.3 min)** | **ALL PASS** |

---

## 2. SPICE Ephemeris and Frame Kernels

- **Acquisition Script:** `scripts/fetch_kernels.py` (`make fetch-kernels`)
- **Inspection Listing:** `docs/sources/naif_*.html`
- **Verification Script:** `scripts/check_kernels.py`
- **Meta-Kernel:** `kernels/meta.tm`
- **Acquisition Date:** 2026-11-07
- **Network Host:** `naif.jpl.nasa.gov` (HTTP 200, Content-Type: `text/plain` or `application/octet-stream`)

### Kernel Inventory and Hashing

| File Name | Description | Source URL | Size (bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :-: | :--- |
| `kernels/naif0012.tls` | Generic leapseconds kernel (LSK) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls` | 5,257 | `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b` |
| `kernels/pck00010.tpc` | Generic planetary constants kernel (text PCK) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc` | 126,143 | `59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2` |
| `kernels/moon_pa_de421_1900-2050.bpc` | High-precision lunar orientation binary PCK | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc` | 1,770,496 | `656f90616403d75a75f0cd6c8830fc5b44f8cb4facb5ccb8915e752b397520cf` |
| `kernels/moon_080317.tf` | Lunar Frames Kernel defining `MOON_ME` | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf` | 21,437 | `78732477b96f9863e7b0d65bcee3c22b8707ca5ed0db56d1173319cb2e8c7993` |
| `kernels/de421.bsp` | Planetary ephemeris SPK (DE421) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp` | 16,790,528 | `08b20db2ae22488650641c5a9033e5bfda4b1c4b440cfeaf20f621cfa18ecdb3` |

### Kernel Coverage and Transformation Verification
- **SPK Coverage:** DE421 ephemeris spans from `1899-07-28` to `2053-10-08`, fully covering the mission analysis window (November 2026 – December 2027).
- **PCK Coverage:** Binary orientation spans from `1899-12-31` to `2050-12-31`.
- **Coordinate Transformations:** Matrix determinant verified to equal 1.0 within $2.22 \times 10^{-16}$, and orthogonality error $\|R \cdot R^T - I\|_{\max} = 2.22 \times 10^{-16}$.

---

## 3. NASA LOLA Digital Elevation Models (PGDA Product 90)

- **Acquisition Script:** `scripts/fetch_dem_windows.py` (`make fetch-terrain`)
- **Validation Script:** `scripts/validate_crops.py`
- **Unit & Integration Tests:** `tests/test_real_terrain_crop.py`
- **Acquisition Date:** 2026-11-07
- **Network Host:** `pgda.gsfc.nasa.gov`
- **Citation:** Barker et al. (2023), Planetary Science Journal 4:183, doi:10.3847/PSJ/acf3e1
- **Data DOI:** 10.60903/gsfcpgda-lola-spole

### DEM File Inventory and Verification

| File Name | Layer Type | Source URL | Dimensions (cols × rows) | Pixel Size | File Size (bytes) | SHA-256 Checksum |
| :--- | :--- | :--- | :-: | :-: | :-: | :--- |
| `data/raw/LDEM_80S_80MPP_ADJ.TIF` | Far Layer (Full) | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF` | 7600 × 7600 | 80 m | 189,158,392 | `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a` |
| `data/raw/near_test_location.tif` | Near Layer (Crop) | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF` | 4000 × 4000 | 20 m | 54,989,936 | `ca7159a5c3be561f3606f46fa852d0df6968d4ef691efbfcf014d02b8a6d56df` |
| `data/raw/err_test_location.tif` | Near Error (Crop) | `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ_ERR.TIF` | 4000 × 4000 | 20 m | 54,319,151 | `8ccdd1ba0763f0462781afd511bd8c108634a2f3ad33ed46436f02dbbaa2174e` |

### Crop Window Parameters
- **Target Site ID:** `test_location` (`TEST_LOCATION_NOT_A_MISSION_SITE`)
- **Coordinates:** Lat -89.5°, Lon 0.0°
- **Stereographic Coordinates:** $X = 0.0\text{ m}$, $Y = 15,161.8\text{ m}$
- **Crop Window Extent:** 80 km × 80 km (half-width 40 km)
- **Window Offsets in Remote 20mpp Raster:** `col_off=13200`, `row_off=12442`, `width=4000`, `height=4000`
- **Elevation Range:** $[-4,251.30\text{ m}, +1,959.42\text{ m}]$
- **Elevation at Test Site (`site.ground_elev_m`):**
  - **Continuous Bilinear Interpolation (Standardized):** $-721.96\text{ m}$ (relative to $R = 1,737,400.0\text{ m}$ sphere), evaluated by `DEMWindow.sample_lat_lon` (`sample_bilinear`) across the 4 enclosing grid pixels at projected coordinate $(X = 0.0\text{ m}, Y = 15,161.77\text{ m})$.
  - **Discrete Nearest-Neighbour Pixel Center:** $-720.33\text{ m}$ (at grid cell row 1999, col 2000 of `near_test_location.tif`, 20 m/pixel resolution).
  - **System-Wide Agreement:** `site.ground_elev_m` is standardized to $-721.96\text{ m}$ across `configs/pipeline.yaml`, `configs/sites.json`, `site.json`, the S0 data log, and all UI displays.
- **Margin to Boundary:** $40.00\text{ km}$ (exceeds $\ge 10\text{ km}$ requirement)
- **No-data Fraction:** $0.0000\%$ (exceeds $< 1.0\%$ requirement)
- **Direct Remote Verification:** 25 randomly sampled pixels matched `/vsicurl/` remote reads to within $10^{-5}\text{ m}$.
- **Error Uncertainty:** Median $Z$ error = $0.191\text{ m}$, 95th percentile $Z$ error = $0.468\text{ m}$.

---

## 4. JPL Horizons Reference Ephemerides

- **Acquisition Script:** `scripts/fetch_horizons.py` (`make fetch-horizons`)
- **Comparison Script:** `scripts/baseline_report.py`
- **Acquisition Date:** 2026-11-07
- **Network Host:** `ssd.jpl.nasa.gov` (Horizons REST API v1.0)
- **Target Epochs:** 2026-11-01 00:00:00 to 2026-12-01 00:00:00 TDB (721 hourly samples)
- **Observer Location:** `coord@301`, Longitude $0.0^\circ$, Latitude $-89.5^\circ$, Altitude $-0.72033\text{ km}$, Refraction model: `AIRLESS`.

### Horizons Files Saved

| File Name | Target Body | Rows | Size (bytes) | Status |
| :--- | :--- | :-: | :-: | :-: |
| `tests/fixtures/horizons_test_location_sun.csv` | Sun (10) | 721 | 80,094 | **Verified** |
| `tests/fixtures/horizons_test_location_sun.json` | Sun (metadata) | — | 1,460 | **Verified** |
| `tests/fixtures/horizons_test_location_sun_raw.txt` | Sun (raw response) | — | 74,484 | **Verified** |
| `tests/fixtures/horizons_test_location_earth.csv` | Earth (399) | 721 | 80,183 | **Verified** |
| `tests/fixtures/horizons_test_location_earth.json` | Earth (metadata) | — | 1,466 | **Verified** |
| `tests/fixtures/horizons_test_location_earth_raw.txt` | Earth (raw response) | — | 74,551 | **Verified** |

---

## 5. Verification Commands

All data can be verified offline at any time without hitting the network:

```powershell
make check-data
```

This runs:
1. `scripts/check_kernels.py`: Validates SPICE meta-kernel loading, SPK/PCK coverage windows, and rotation matrix orthogonality.
2. `scripts/check_data_offline.py`: Validates SHA-256 hashes and byte lengths for all raw rasters and kernels against their manifests.
3. `pytest -v -m "real_data and not network" tests/test_real_terrain_crop.py`: Validates crop geometry, boundary margins, elevation limits, and no-data fractions.
