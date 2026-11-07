# LightPath — Human Verification Checklist & Operational Guide

> **Governed by `docs/PROJECT_RULES.md` (Rule 1 & Rule 2)**:  
> AI coding assistants must **never** invent facts, mock external flight data, or set `verified: true`.  
> This checklist catalogs the **exact items that a human operator must verify, populate, and certify** before any operational or flight deployment.

---

## Summary Checklist Overview

| # | Domain | Target Files | Official Place to Look | Verification Status |
| :-: | :--- | :--- | :--- | :-: |
| **1** | Challenge Text & Submission Details | `docs/CHALLENGE_STATEMENT.md`<br>`docs/SUBMISSION.md` | NASA Space Apps Challenge portal | ⏳ Awaiting Human |
| **2** | CLPS Missions & Delivery Windows | `data/missions.json` | NASA CLPS Task Order Announcements | ⏳ Awaiting Human |
| **3** | South-Pole Site Coordinates & DEMs | `configs/pipeline.yaml`<br>`data/dem_manifest.json`<br>`data/raw/` | NASA PDS Geosciences Node / LOLA Archive | ⏳ Awaiting Human |
| **4** | DSN Station Coordinates & Cutoffs | `configs/dsn_stations.yaml` | JPL 810-005 Telecommunications Handbook | ⏳ Awaiting Human |
| **5** | NAIF SPICE Ephemeris Kernels | `kernels/kernels.json`<br>`kernels/meta.tm`<br>`kernels/` | NASA NAIF Generic Kernels Server | ⏳ Awaiting Human |
| **6** | Horizons Validation Fixtures | `tests/fixtures/` | NASA Horizons On-Line Ephemeris Web API | ⏳ Awaiting Human |
| **7** | Published Literature Citations | `docs/CITATIONS.md`<br>`README.md` | NASA ADS / Planetary and Space Science vol. 203 | ⏳ Awaiting Human |
| **8** | Team Credits & AI Disclosure | `README.md`<br>`docs/SUBMISSION.md` | Human Team Members & Institutional Records | ⏳ Awaiting Human |
| **9** | Historical Mission Backtest Case | `docs/BACKTEST_CASE.md` | Official Mission Flight & Operations Telemetry | ⏳ Awaiting Human |

---

## 1. Challenge Text & Official Submission Checklist

- [ ] **Official Challenge Title & Prompt**:
  - **Where to look**: [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/) $\to$ Challenge: *Commercial Lunar Payload Services (CLPS) Mission Browser*.
  - **File to edit**: [`docs/CHALLENGE_STATEMENT.md`](CHALLENGE_STATEMENT.md) and [`docs/SUBMISSION.md`](SUBMISSION.md).
  - **Action**: Paste the exact challenge prompt text and confirm submission category and deliverables.
- [ ] **300-Word Project Summary**:
  - **File to edit**: [`docs/SUBMISSION.md`](SUBMISSION.md) Section 2.
  - **Action**: Review and finalize the executive summary.

---

## 2. CLPS Mission List & Operational Dates

- [ ] **Confirmed Delivery Task Orders & Landers**:
  - **Where to look**: [NASA Commercial Lunar Payload Services Deliveries](https://www.nasa.gov/commercial-lunar-payload-services/) and [NASA Press Releases](https://www.nasa.gov/news-release/).
  - **File to edit**: [`data/missions.json`](../data/missions.json).
  - **Required fields per entry**:
    - `id`: Unique mission identifier (e.g. `clps-to-prime1-intuitive-machines`).
    - `name`: Official flight name (e.g. `IM-2 Polar Lander / PRIME-1`).
    - `operator`: Commercial payload contractor (e.g. `Intuitive Machines / NASA CLPS`).
    - `site_id`: Target lunar south-pole landing site (`shackleton-connecting-ridge`, `malapert-mountain`, `nobile-crater-rim`).
    - `planned_window_start`: Exact ISO 8601 UTC timestamp.
    - `planned_window_end`: Exact ISO 8601 UTC timestamp.
    - `status`: Flight status (`planned`, `en_route`, `landed`, `completed`).
    - `source_label`: Official NASA press release or mission web page title.
    - `source_url`: Full HTTPS URL.
    - `retrieved_on`: YYYY-MM-DD date when human verified the source.
    - `verified`: Change from `false` to `true` **only after human confirmation**.
    - `notes`: Human operator notes regarding payload instruments or launch updates.

---

## 3. Lunar South Pole Site Coordinates & LOLA DEM Rasters

- [ ] **IAU / LOLA Planetocentric Site Coordinates**:
  - **Where to look**: NASA GSFC Planetary Geodesy Data Archive ([PGDA Product 78](https://pgda.gsfc.nasa.gov/products/78)) and [PDS Geosciences Node LRO LOLA Data](https://pds-geosciences.wustl.edu/missions/lro/lola.htm).
  - **File to edit**: [`configs/pipeline.yaml`](../configs/pipeline.yaml).
  - **Parameters to confirm**:
    - Latitude (`lat_deg`) in $[-90.0^\circ, 90.0^\circ]$ (IAU Mean Earth/Polar Axis `MOON_ME` body-fixed frame).
    - Longitude (`lon_deg`) in $[-180.0^\circ, 360.0^\circ]$ ($+X$ toward Earth Prime Meridian).
    - Elevation (`ground_elev_m`) relative to the standard $1,737,400.0\text{ m}$ reference sphere.
- [ ] **Acquire Real 20m & 120m GeoTIFF Elevation Rasters**:
  - **File to edit**: [`data/dem_manifest.json`](../data/dem_manifest.json).
  - **Action**:
    1. Download `LDEM_80S_120M.IMG` (or GeoTIFF equivalents) from the PDS Geosciences node into `data/raw/`.
    2. Download high-resolution 20m landing site tiles:
       - `data/raw/lola_shackleton_20m.tif`
       - `data/raw/lola_malapert_20m.tif`
       - `data/raw/lola_nobile_20m.tif`
    3. Compute SHA-256 checksums (`Get-FileHash data/raw/<file>` on Windows or `sha256sum` on Linux).
    4. Replace `TODO_FILL_OFFICIAL_SHA256_CHECKSUM` and update `url` in [`data/dem_manifest.json`](../data/dem_manifest.json).

---

## 4. NASA Deep Space Network (DSN) Ground Stations

- [ ] **DSN 70-Meter Station Coordinates**:
  - **Where to look**: [NASA JPL 810-005 Telecommunications Link Design Handbook](https://deepspace.jpl.nasa.gov/dsndocs/810-005/), Module 301 (Coverage and Antenna Orientation).
  - **File to edit**: [`configs/dsn_stations.yaml`](../configs/dsn_stations.yaml).
  - **Parameters to confirm**:
    - **Goldstone (DSS 14)**: Latitude, East Longitude, elevation above sea level.
    - **Madrid (DSS 63)**: Latitude, East Longitude, elevation above sea level.
    - **Canberra (DSS 43)**: Latitude, East Longitude, elevation above sea level.
    - **Minimum elevation cutoff angle** (`default_min_elevation_deg`): Confirm whether mission operations mandate $6.0^\circ$, $10.0^\circ$, or specific local horizon profile masks.
    - Set `verified: true` for verified stations and update `retrieved_on`.

---

## 5. NAIF SPICE Ephemeris Kernels

- [ ] **Official SPICE Kernels & Checksums**:
  - **Where to look**: [NAIF Generic Kernels Server](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/).
  - **File to edit**: [`kernels/kernels.json`](../kernels/kernels.json) and [`kernels/meta.tm`](../kernels/meta.tm).
  - **Kernels to download into `kernels/`**:
    - `naif0012.tls` (Leapseconds Kernel) $\to$ `generic_kernels/lsk/`
    - `pck00010.tpc` (Planetary Constants Kernel) $\to$ `generic_kernels/pck/`
    - `moon_pa_de421_1900-2050.bpc` (High-Precision Lunar Orientation PCK) $\to$ `generic_kernels/pck/`
    - `de421.bsp` or SPK ephemeris (Solar System Ephemeris SPK) $\to$ `generic_kernels/spk/`
  - Compute SHA-256 hashes for each kernel and replace `TODO_FILL_OFFICIAL_SHA256_CHECKSUM` in `kernels/kernels.json`.

---

## 6. Horizons Validation Fixtures (Benchmark V3)

- [ ] **Generate Two Real Topocentric Fixtures**:
  - **Where to look**: [NASA Horizons Web API](https://ssd.jpl.nasa.gov/horizons/).
  - **Instructions**: Follow [`docs/HORIZONS_FIXTURES.md`](HORIZONS_FIXTURES.md).
  - **Command**:
    ```bash
    python scripts/make_horizons_request.py --site "Shackleton Connecting Ridge" --lat -89.78 --lon 128.8 --elev 1100.0 --start "2026-11-01 00:00" --stop "2026-11-15 00:00" --step "1 h"
    ```
  - **Files to save**:
    - `tests/fixtures/horizons_shackleton_sun.csv` + `tests/fixtures/horizons_shackleton_sun.json`
    - `tests/fixtures/horizons_shackleton_earth.csv` + `tests/fixtures/horizons_shackleton_earth.json`
  - Once saved, run `pytest -v tests/test_verification.py -k test_v3` to execute the real ephemeris benchmark.

---

## 7. Published Literature Citations (Benchmark V4)

- [ ] **NASA Literature Citation & Illumination Numbers**:
  - **Where to look**: [NASA Astrophysics Data System (ADS)](https://ui.adsabs.harvard.edu/) or publisher journal: *Planetary and Space Science*, Volume 203 (Barker et al. 2021: Improved LOLA elevation models for lunar south pole landing sites).
  - **Files to edit**: [`docs/CITATIONS.md`](CITATIONS.md) and [`README.md`](../README.md#9-credits--nasa-data-sources).
  - **Action**: Confirm official publication title, author list, volume, article ID, DOI, and site solar illumination percentage. If verified, save `tests/fixtures/published_barker_2021.json` to enable benchmark **V4**.

---

## 8. Team Credits & AI Disclosure

- [ ] **Human Team Member Names & Institutional Affiliations**:
  - **File to edit**: [`README.md`](../README.md#10-ai-assistance-disclosure) and [`docs/SUBMISSION.md`](SUBMISSION.md) Section 7.
  - **Action**: Replace `[to be completed by the humans: insert names of human reviewers]` with your team roster.
- [ ] **Verified Formulas & External Standards**:
  - **File to edit**: [`README.md`](../README.md#10-ai-assistance-disclosure).
  - **Action**: Replace `[to be completed by the humans: insert reference literature or standards checked by humans]` with the references reviewed by the humans.

---

## 9. Historical South-Pole Mission Backtest Case (`docs/BACKTEST_CASE.md`)

- [ ] **Verified Mission Timeline & Telemetry Events**:
  - **Where to look**: Official Space Agency Mission Operations Logs (e.g., ISRO Chandrayaan-3 Vikram lander / Pragyan rover operations report, Intuitive Machines IM-1 telemetry, or NASA/JAXA reports).
  - **File to create**: `docs/BACKTEST_CASE.md`.
  - **Precondition Rule**: LightPath will **NEVER** invent mission landing coordinates, sunset times, or signal loss timestamps (Rule 2). The Replay page shows **NOT AVAILABLE** until this file is supplied by a human operator.
  - **Required Sourced Fields**:
    - `mission_name`: Official mission title.
    - `landing_time_utc`: Exact landing timestamp in ISO 8601 UTC.
    - `landing_coord`: Latitude, longitude, and elevation.
    - `landing_uncertainty_m`: Radius of landing dispersion ellipse (m).
    - `dem_resolution_m`: LOLA DEM resolution (e.g. 20m).
    - `reported_events`: Array of events (`sunset`, `loss_of_sunlight`, `earth_los`, `loss_of_signal`, `end_of_operations`) with exact UTC timestamp, source label, source URL, and notes.
    - `verified`: `true` only when confirmed by a human.

---

## 10. Automated Traceability & Provenance Verification

Run the provenance auditor to confirm all data entries are properly sourced:
```bash
python scripts/check_provenance.py
```
- **Exit code 0**: All displayed values have required source labels, URLs, dates, and notes.
- **Warnings**: Accurately reports all entries currently flagged as `verified: false`.
- **Exit code 1**: Fails the build immediately if any displayed entry is missing required provenance fields.
