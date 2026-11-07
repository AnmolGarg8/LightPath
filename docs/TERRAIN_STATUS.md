# Terrain Status & Precondition Audit

**Audit Date:** 2026-11-07  
**Status:** Precondition Not Met — Terrain is Strictly Synthetic  
**Governing Policy:** [PROJECT_RULES.md](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/PROJECT_RULES.md) (Rule 2: Never invent facts; Rule 3: Never present synthetic or placeholder data as real; Rule 10: Fail loud, fail clean)

---

## 1. Precondition Audit Summary

The pipeline rules require that real-data processing modes execute only when human operators have staged verified LOLA elevation files in `data/raw/` and populated `data/dem_manifest.json` with official product metadata.

An audit of the repository conducted on 2026-11-07 confirms:
- **`data/dem_manifest.json`:** Contains placeholder entries (`TODO_LOLA_SOUTH_POLE_120M_PLACEHOLDER`, `TODO_FILL_OFFICIAL_PDS_OR_PGDA_URL_E_G_HTTPS_PGDA_GSFC_NASA_GOV`, `TODO_FILL_OFFICIAL_SHA256_CHECKSUM`).
- **`data/raw/` directory:** Contains only `.gitkeep`. No raw LOLA DEM files (such as `LDEM_80S_120M.IMG` or GeoTIFF rasters) have been placed in the repository.
- **Coverage:** Zero candidate sites have verified LOLA DEM coverage or the required 120 km margin staged.

**Outcome:** In accordance with the prompt's precondition directive, real DEM execution has halted. No elevation numbers or horizon profiles have been fabricated. Operating mode is strictly declared as **SYNTHETIC**.

---

## 2. Active Mode & Output Markings

All system outputs and user interfaces are synchronized to reflect synthetic benchmark status:

| File / Component | Property / Field | Value | Description |
| :--- | :--- | :--- | :--- |
| `data/data_status.json` | `has_lola_dem` | `false` | System flag confirming absence of real LOLA DEM files |
| `configs/sites.json` | `terrain_source` | `"synthetic"` | Explicit terrain lineage for every site entry |
| `configs/sites.json` | `is_synthetic` | `true` | Declares all terrain geometries are synthetic |
| `configs/sites.json` | `verified` | `false` | No unverified human certifications |
| `web/public/data/index.json` | `mode` / `is_synthetic` | `"synthetic"` / `true` | Production web bundle contract metadata |
| `web/public/data/index.json` | `candidate_sites` | `status: "not_computed"` | Real mission sites listed as uncomputed with sourced coordinates |
| `web/public/data/synthetic-proving-ground/provenance.json` | `kernels` | `none (synthetic)` | SHA-256 tracked only against real local synthetic assets |

---

## 3. User Interface Integrity

The web application enforces complete transparency regarding data provenance:
1. **Global Synthetic Banner:** Rendered prominently across the header of all views (`HomeView`, `Panorama`, `RoutePlannerView`, `AreaScanView`, `TrustView`, `ExplainView`, `DataContractView`).
2. **Site Status Badges:** Display `Synthetic Benchmark`, `Terrain: Synthetic`, and `Ephemeris: Analytic Approx` adjacent to the site title.
3. **Hero Honest Status Line:** Displays `Demo uses synthetic terrain; approximate analytic ephemeris (SPICE kernels pending)` directly beneath the primary call to action.
4. **Candidate Sites Section:** Candidate sites (`shackleton-connecting-ridge`, `malapert-mountain`, `nobile-crater-rim`) are listed in a dedicated section with status `Site data not available (not computed)` without failing links.
5. **Trust & Verification Live Panel:** Verification metrics read dynamically from `tests/results.json`. Tests relying on real DEM data or external peer-reviewed benchmarks (`V3`, `V4`, `V7`) are explicitly presented as `NOT RUN`.

---

## 4. Instructions for Staging Real LOLA DEM Data

To transition from synthetic calibration mode to real terrain analysis, a human operator must perform the following steps:

1. **Download Official Product:**
   Download the LRO LOLA South Pole Digital Elevation Model (80°S to 90°S, 120 m/pixel polar stereographic, e.g., `LDEM_80S_120M.IMG`) from the official NASA GSFC Planetary Geodesy Data Archive:
   - Archive URL: [https://pgda.gsfc.nasa.gov/products/54](https://pgda.gsfc.nasa.gov/products/54)
   - Alternative PDS Node: [https://pds-geosciences.wustl.edu/missions/lro/lola.htm](https://pds-geosciences.wustl.edu/missions/lro/lola.htm)
2. **Verify Checksum:**
   Calculate the SHA-256 hash of the downloaded image:
   ```powershell
   Get-FileHash -Algorithm SHA256 data/raw/LDEM_80S_120M.IMG
   ```
3. **Update Manifest:**
   In `data/dem_manifest.json`, replace placeholder values with the verified file name, official download URL, and actual SHA-256 hash.
4. **Update Status:**
   In `data/data_status.json`, set `"has_lola_dem": true`.
5. **Run Processing Pipeline:**
   Execute the ingestion and horizon calculation pipeline:
   ```powershell
   python -m pipeline.run --real-dem
   ```
   This will sample true ground elevations, compute real horizon profiles, evaluate physical plausibility checks, and generate real visibility cubes.
