# Terrain Status & Precondition Audit

**Audit Date:** 2026-11-07  
**Status:** Real Far Layer (80 m) and Near Layer Crop (20 m) Acquired & Verified  
**Governing Policy:** [PROJECT_RULES.md](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/PROJECT_RULES.md) (Rule 2: Never invent facts; Rule 3: Never present synthetic or placeholder data as real; Rule 9: Every number traces to a record)

---

## 1. Summary of Real Terrain Acquisition (Task S0)

In accordance with Task S0 of the data acquisition protocol, verified real LOLA elevation data from NASA GSFC Planetary Geodesy Data Archive (PGDA Product 90) have been downloaded, cropped, and checksum-verified:

### 1. Far Layer (Full 80°S to 90°S Coverage)
- **File:** `data/raw/LDEM_80S_80MPP_ADJ.TIF`
- **Source:** [NASA GSFC PGDA Product 90](https://pgda.gsfc.nasa.gov/products/90)
- **Direct URL:** `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`
- **Citation:** Barker et al. (2023), Planetary Science Journal 4:183, doi:10.3847/PSJ/acf3e1
- **Data DOI:** `10.60903/gsfcpgda-lola-spole`
- **Projection:** South Polar Stereographic (IAU:30135, sphere radius $R = 1,737,400\text{ m}$)
- **Grid Extent:** $[-304,000\text{ m}, -304,000\text{ m}, +304,000\text{ m}, +304,000\text{ m}]$ (7600 × 7600 pixels)
- **Pixel Resolution:** 80.0 m × 80.0 m
- **File Size:** 189,158,392 bytes (180.40 MB)
- **SHA-256 Checksum:** `82030dcbdd7c4bb0c7d858e9b4b293b9f2cda5a543ba31ec0f42784bd6beee5a`
- **Elevation Range:** $-7,295.52\text{ m}$ to $+7,026.33\text{ m}$ (mean $-1,500.65\text{ m}$)
- **No-data Fraction:** $0.0000\%$

### 2. Near Layer (20 m Crop for Test Location)
- **File:** `data/raw/near_test_location.tif`
- **Parent File:** `LDEM_80S_20MPP_ADJ.TIF` (2.6 GB remote raster)
- **Target Site ID:** `test_location` (`TEST_LOCATION_NOT_A_MISSION_SITE` at lat -89.5°, lon 0.0°)
- **Window Offsets:** `col_off=13200`, `row_off=12442`, `width=4000`, `height=4000` (80 km × 80 km)
- **Pixel Resolution:** 20.0 m × 20.0 m
- **File Size:** 54,989,936 bytes (52.44 MB)
- **SHA-256 Checksum:** `ca7159a5c3be561f3606f46fa852d0df6968d4ef691efbfcf014d02b8a6d56df`
- **Elevation Range:** $-4,251.30\text{ m}$ to $+1,959.42\text{ m}$ (mean $-706.05\text{ m}$)
- **Elevation at Site (`site.ground_elev_m`):** $-721.96\text{ m}$ (continuous bilinear interpolation from 20 mpp DEM `near_test_location.tif` at $X=0.0\text{ m}, Y=15,161.77\text{ m}$; discrete nearest pixel center $-720.33\text{ m}$)
- **Margin to Boundary:** $40.00\text{ km}$ (required $\ge 10\text{ km}$)
- **No-data Fraction:** $0.0000\%$
- **Sample Consistency:** 25 randomly sampled pixels matched remote `/vsicurl/` reads to within $10^{-5}\text{ m}$.

### 3. Surface Height Uncertainty (20 m Error Crop)
- **File:** `data/raw/err_test_location.tif`
- **Parent File:** `LDEM_80S_20MPP_ADJ_ERR.TIF` (3.7 GB remote raster)
- **Window Offsets:** `col_off=13200`, `row_off=12442`, `width=4000`, `height=4000`
- **File Size:** 54,319,151 bytes (51.80 MB)
- **SHA-256 Checksum:** `8ccdd1ba0763f0462781afd511bd8c108634a2f3ad33ed46436f02dbbaa2174e`
- **Median $Z$ Error:** $0.191\text{ m}$
- **95th Percentile $Z$ Error:** $0.468\text{ m}$

---

## 2. Status of Candidate Landing Sites

The acquired 80 m far layer covers the entire lunar south pole from 80°S to 90°S, which encompasses all candidate landing sites:
- Shackleton Connecting Ridge
- Malapert Mountain
- Nobile Crater Rim

### What is Still Missing for Candidate Sites
1. **Authoritative Coordinates Decision:** As documented in `docs/SITES_SOURCED.md`, candidate landing sites require final human confirmation of landing coordinates before cropping dedicated 20 m near-layer windows.
2. **Dedicated 20 m Near Crops:** `near_<site>.tif` and `err_<site>.tif` need to be cropped using `scripts/fetch_dem_windows.py` once the final coordinates are added to `configs/terrain_windows.yaml`.
3. **Optional 5 m Products:** Sites situated on Shackleton Connecting Ridge or de Gerlache rim could optionally utilize the 5 m products from PGDA Product 78 or Product 81 (e.g. `site_01_5mpp_adjust.tif`, 549 MB) if sub-20 m resolution is required.

Until dedicated crops are generated and verified for candidate sites, those sites remain marked as `Site data not available (not computed)` in the user interface.

---

## 3. Data Manifest and Reproducibility

All downloaded terrain files are tracked in `data/dem_manifest.json` with exact cryptographic hashes, sizes, bounding boxes, and citations. All files can be verified offline via:

```powershell
make check-data
```
