# LightPath Task S0 Review Bundle: Real Data Acquisition & Verification

**Date:** 2026-11-07  
**Branch:** `data-acquisition`  
**Governing Policy:** [PROJECT_RULES.md](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/PROJECT_RULES.md) (Rule 2: Never invent facts, coordinates, file names, checksums, or citations; Rule 8: Offline determinism; Rule 9: Every number traces to a record).

---

## 1. Executive Summary

Task S0 successfully acquired, verified, and established reproducible pipelines for real lunar south polar topography and high-precision planetary ephemerides without altering geometry, horizon, route, or UI application code.

### Summary of Completed Objectives
1. **NASA GSFC PGDA Product 90 Verification:** Confirmed catalog listing, exact file names, sizes, Barker et al. (2023) journal publication, and DOIs.
2. **Remote GeoTIFF Inspection:** Verified South Polar Stereographic CRS on a 1,737,400.0 m sphere, 512×512 tiling, and HTTP Range support across all product layers.
3. **Terrain Acquisition:** Acquired full 80 m far layer (`LDEM_80S_80MPP_ADJ.TIF`, 180.4 MB) covering 80°S–90°S, and cropped 80 km × 80 km 20 m near-layer (`near_test_location.tif`, 52.4 MB) and error (`err_test_location.tif`, 51.8 MB) rasters for `TEST_LOCATION_NOT_A_MISSION_SITE` (lat -89.5°, lon 0.0°).
4. **Crop Validation & Hillshades:** Validated 25 randomly sampled pixels matching remote `/vsicurl/` reads to within $10^{-5}\text{ m}$, verified 40 km boundary margin, 0.0000% no-data, and generated preview hillshades under 300 KB.
5. **NAIF SPICE Kernels:** Acquired and cryptographically verified 5 official NAIF kernels (`naif0012.tls`, `pck00010.tpc`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `de421.bsp`), verified coverage through 2050, and mathematically proved frame transformation orthogonality to $2.22 \times 10^{-16}$.
6. **JPL Horizons Ephemeris Comparison:** Retrieved 721 hourly topocentric reference epochs (November 2026). Proved that SPICE matches Horizons within $0.00004^\circ$ ($\approx 0.14\text{ arcsec}$), confirming mathematical precision and highlighting the known limitations of approximate analytic formulas ($61.22^\circ$ solar azimuth discrepancy).
7. **Offline Reproducibility:** Updated `Makefile` with `make check-data`, `make fetch-terrain`, `make fetch-kernels`, and `make fetch-horizons`.

---

## 2. NASA GSFC PGDA Product 90 Verification

- **Catalog URL:** `https://pgda.gsfc.nasa.gov/products/90`
- **Saved Copy:** [pgda_product_90.txt](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/sources/pgda_product_90.txt)
- **Log:** [step1_verify_source_page.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/step1_verify_source_page.log)
- **Paper Citation:** Barker et al. (2023), *A New 20 m/pixel Digital Elevation Model of the Lunar South Pole*, Planetary Science Journal, 4:183, doi: [10.3847/PSJ/acf3e1](https://doi.org/10.3847/PSJ/acf3e1)
- **Data DOI:** [10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole)

### Product 90 File Catalog Verification

| File Name | Catalog Size | HTTP Content-Length | Content Type | Status |
| :--- | :-: | :-: | :--- | :---: |
| `LDEM_80S_20MPP_ADJ.TIF` | 2.6G | 2,757,980,312 bytes | `image/tiff` | **Matched** |
| `LDEM_80S_80MPP_ADJ.TIF` | 181M | 189,158,392 bytes | `image/tiff` | **Matched** |
| `LDEM_80S_40MPP_ADJ.TIF` | 685M | 717,801,232 bytes | `image/tiff` | **Matched** |
| `LDEM_80S_20MPP_ADJ_ERR.TIF` | 3.7G | 3,922,669,960 bytes | `image/tiff` | **Matched** |
| `LDSM_80S_20MPP_ADJ.TIF` | 3.6G | 3,744,383,728 bytes | `image/tiff` | **Matched** |

---

## 3. Remote GeoTIFF Inspection Log

- **Inspection Document:** [terrain_inspection.md](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/terrain_inspection.md)
- **Inspection Script:** `scripts/step2_inspect_remote_files.py`
- **Log:** [step2_inspect_remote_files.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/step2_inspect_remote_files.log)

### Key Metadata Confirmed
- **Coordinate Reference System:** South Polar Stereographic (`IAU:30135`)
- **Reference Ellipsoid / Datum:** Sphere of radius $R = 1,737,400.0\text{ m}$
- **PROJ.4 Definition:** `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs`
- **Global Raster Bounds:** $[-304,000.0\text{ m}, -304,000.0\text{ m}, +304,000.0\text{ m}, +304,000.0\text{ m}]$
- **Internal Structure:** Tiled ($512 \times 512$ block size), compressed with Deflate (`PREDICTOR=3` floating-point horizontal differencing).
- **HTTP Range Support:** Confirmed via `Accept-Ranges: bytes` on all HTTP HEAD responses, enabling efficient windowed `/vsicurl/` reads.

---

## 4. NAIF SPICE Kernels Verification

- **Manifest:** [kernels.json](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/kernels/kernels.json)
- **Meta-Kernel:** [meta.tm](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/kernels/meta.tm)
- **Verification Script:** `scripts/check_kernels.py`
- **Log:** [step7_check_kernels.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/step7_check_kernels.log)

### Downloaded Kernels Inventory

| Kernel Name | Type | Size (bytes) | SHA-256 Checksum |
| :--- | :--- | :-: | :--- |
| `naif0012.tls` | LSK | 5,257 | `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b` |
| `pck00010.tpc` | Text PCK | 126,143 | `59468328349aa730d18bf1f8d7e86efe6e40b75dfb921908f99321b3a7a701d2` |
| `moon_pa_de421_1900-2050.bpc` | Binary PCK | 1,770,496 | `656f90616403d75a75f0cd6c8830fc5b44f8cb4facb5ccb8915e752b397520cf` |
| `moon_080317.tf` | Frames FK | 21,437 | `78732477b96f9863e7b0d65bcee3c22b8707ca5ed0db56d1173319cb2e8c7993` |
| `de421.bsp` | SPK | 16,790,528 | `08b20db2ae22488650641c5a9033e5bfda4b1c4b440cfeaf20f621cfa18ecdb3` |

### Mathematical Correctness Proof
- **Coverage Windows:**
  - `de421.bsp` (Sun, Earth, Moon): `1899-07-28` to `2053-10-08` (covers target mission period 2026–2027).
  - `moon_pa_de421_1900-2050.bpc`: `1899-12-31` to `2050-12-31`.
- **Coordinate Transformations (`J2000` to `MOON_ME` via `pxform`):**
  - Epoch `2026-11-01T00:00:00`: Determinant error $= 2.22 \times 10^{-16}$, Orthogonality error $= 2.22 \times 10^{-16}$.
  - Epoch `2027-01-01T12:00:00`: Determinant error $= 1.11 \times 10^{-16}$, Orthogonality error $= 2.22 \times 10^{-16}$.
  - Epoch `2027-12-31T00:00:00`: Determinant error $= 0.00$, Orthogonality error $= 2.22 \times 10^{-16}$.

---

## 5. SPICE vs JPL Horizons Comparison Table

- **Fixtures:** `tests/fixtures/horizons_test_location_<sun|earth>.csv`
- **Report Script:** `scripts/baseline_report.py`
- **Log:** [baseline_report.txt](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/baseline_report.txt)
- **Comparison Interval:** 2026-11-01 00:00:00 to 2026-12-01 00:00:00 (721 hourly epochs)
- **Observer Location:** Lat $-89.5^\circ$, Lon $0.0^\circ$, Elevation $-720.33\text{ m}$ relative to $1,737.4\text{ km}$ Moon sphere.

### Baseline Comparison Results

| Metric | SPICE vs Horizons Max Error | SPICE vs Horizons RMS Error | SPICE Tolerance ($\le 0.05^\circ$) | Analytic vs Horizons Max Error | Analytic vs Horizons RMS Error | Status |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| **Sun Azimuth** | $0.00000^\circ$ | $0.00000^\circ$ | **PASS** | $61.21702^\circ$ | $60.77122^\circ$ | EXCEEDS |
| **Sun Elevation** | $0.00001^\circ$ | $0.00001^\circ$ | **PASS** | $2.59745^\circ$ | $1.86241^\circ$ | EXCEEDS |
| **Earth Azimuth** | $0.00001^\circ$ | $0.00000^\circ$ | **PASS** | $14.51264^\circ$ | $10.84021^\circ$ | EXCEEDS |
| **Earth Elevation** | $0.00004^\circ$ | $0.00002^\circ$ | **PASS** | $1.43035^\circ$ | $0.94121^\circ$ | EXCEEDS |

**Conclusion:** The SPICE implementation matches JPL Horizons to within $0.00004^\circ$ ($\approx 0.14\text{ arcsec}$), demonstrating complete consistency with official NASA/JPL ephemeris standards. In contrast, approximate analytic formulas exhibit substantial azimuth and elevation offsets, validating the need for the SPICE ephemeris upgrade in real mission mode.

---

## 6. DEM Crop Verification & Error Percentiles

- **Manifest:** [dem_manifest.json](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/data/dem_manifest.json)
- **Test Suite:** `tests/test_real_terrain_crop.py`
- **Execution Log:** [step5_validate_crops.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/step5_validate_crops.log)

### Crop Geometry & Integrity Metrics
- **Target Site:** `test_location` (`TEST_LOCATION_NOT_A_MISSION_SITE`)
- **Site Ground Elevation:** $-720.33\text{ m}$
- **Crop Extent:** 80 km × 80 km (4000 × 4000 pixels at 20 m resolution)
- **Boundary Margin:** $40.00\text{ km}$ from site to nearest crop edge (required $\ge 10\text{ km}$)
- **Elevation Range:** $[-4,251.30\text{ m}, +1,959.42\text{ m}]$ (plausible within $[-10\text{ km}, +12\text{ km}]$)
- **No-data Fraction:** $0.0000\%$ (required $< 1.0\%$)
- **25 Random Pixel Spot Check:** All 25 random pixels matched remote `/vsicurl/` reads to within $10^{-5}\text{ m}$.

### Surface Height Error Statistics (from `err_test_location.tif`)
- **Total Samples:** 16,000,000 valid error pixels
- **Median $Z$ Error:** $0.191\text{ m}$
- **95th Percentile $Z$ Error ($p_{95}$):** $0.468\text{ m}$
- **Derived Angular Margin at 1 km range:** $\arctan(0.468\text{ m} / 1000\text{ m}) = 0.027^\circ$

---

## 7. Terrain Previews

Hillshade previews were generated from the real rasters using a 315° azimuth, 45° altitude light source with vertical exaggeration of 1.5. Both preview PNGs are strictly under 300 KB:

- **Near Layer Preview (80 km × 80 km with site marker):** [terrain_preview_test_location.png](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/images/terrain_preview_test_location.png) (213.1 KB)
- **Far Layer Preview (Full 80°S to 90°S South Polar Cap):** [terrain_preview_far.png](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/images/terrain_preview_far.png) (256.0 KB)

---

## 8. Old Placeholder References Audit

Per Step 6, the repository was audited for legacy references to placeholder products (`LDEM_80S_120M` and `products/54`):

### Files Referencing `LDEM_80S_120M`
- `docs/HUMAN_TODO.md`
- `docs/REVIEW_BUNDLE.md`
- `tests/test_schemas.py`
- `web/public/data/malapert-mountain/provenance.json`
- `web/public/data/nobile-crater-rim/provenance.json`
- `web/public/data/shackleton-connecting-ridge/provenance.json`

### Files Referencing `products/54`
- `configs/sites.json`
- `docs/REVIEW_BUNDLE.md`
- `tests/test_schemas.py`
- `web/public/data/index.json`
- `web/public/data/malapert-mountain/provenance.json`
- `web/public/data/nobile-crater-rim/provenance.json`
- `web/public/data/shackleton-connecting-ridge/provenance.json`
- `web/public/data/shackleton-connecting-ridge/site.json`

*Note:* In accordance with the Task S0 rule ("Do NOT modify the geometry, horizon, route or UI code in this task"), UI and pipeline schema files will be updated in subsequent pipeline tasks when candidate sites are processed.

---

## 9. Things I Could Not Verify

In strict adherence to Rule 2 (never invent facts):
1. **Candidate Mission Site Coordinates:** Official landing coordinates for candidate exploration target sites vary across mission design studies (e.g. CLPS, VIPER, Artemis III candidate zones). Sourced coordinates require human team confirmation before cropping near-layer windows.
2. **5 m Micro-Topography (Product 78 & 81):** Sub-20 m products (`site_01_5mpp_adjust.tif`, etc.) cover specific polar ridges. We verified their remote availability and sizes in `docs/terrain_inspection.md`, but have disabled them by default pending human selection of exact landing target polygons.
3. **PDS IMG Fixed-Width Format:** We verified and acquired the official Cloud-Optimized GeoTIFF equivalents (`Product 90`). Older PDS3 fixed-width binary raster files (`.IMG`) were not acquired because GeoTIFF is natively supported by GDAL/rasterio and offers internal compression and range requests.

---

## 10. What a Human Must Still Do

1. **Confirm Candidate Landing Coordinates:** Review `docs/SITES_SOURCED.md` and confirm the landing coordinates for candidate landing sites.
2. **Crop Candidate Windows:** Once coordinates are confirmed in `configs/terrain_windows.yaml`, execute `make fetch-terrain` to crop near-layer 20 m windows and compute error statistics.
3. **Optionally Enable 5 m Micro-Topography:** If sub-20 m resolution is required for rover hazard avoidance or local mast line-of-sight studies, enable Product 78/81 in `configs/terrain_windows.yaml`.
4. **Merge Branch:** Review this data acquisition bundle on branch `data-acquisition` and merge into `main` to proceed with pipeline integration tasks.
