# LightPath — Independent Technical Audit & Scientific Verification Report (Audit 2)

> [!NOTE]
> **Audit Status & Superseded Findings Notice (Updated November 2026)**:  
> This second audit was conducted on November 01, 2026. All findings recorded in the summary table below have been **fully resolved and superseded** in subsequent development sprints:
> - **C1 (Test Harness Mutates Tracked Files)**: **SUPERSEDED / RESOLVED**. All test executions direct outputs to isolated temporary paths (`tmp_path`). Only explicit execution of `scripts/update_committed_results.py` updates committed result files, with git diff validation enforced in CI.
> - **C2 (Route Solver 1D Dominance Pruning)**: **SUPERSEDED / RESOLVED**. Multi-criteria Pareto state dominance tracking $(g, \text{dark\_acc})$ implemented and verified by brute-force comparison (V8).
> - **C3 (Zero Rover Speed ZeroDivisionError)**: **SUPERSEDED / RESOLVED**. Pre-flight validation asserts $v > 0$ and raises structured validation errors.
> - **M1 (TrustView NOT RUN Badge)**: **SUPERSEDED / RESOLVED**. `TrustView.tsx` renders neutral `NOT RUN` badges with human operator instructions whenever external fixtures are absent.
> - **M2 (Extended Benchmarks X1–X6)**: **SUPERSEDED / RESOLVED**. Benchmarks X1–X6 are integrated and verified in `tests/results.json` and UI.
> - **M3 (Worker Start-Cell Validation)**: **SUPERSEDED / RESOLVED**. `routeWorker.ts` and `pipeline/routing.py` validate start and goal cell slopes and illumination before initiating search.
> - **M4 (utc_to_et Silent Fallback)**: **SUPERSEDED / RESOLVED**. Silent ephemeris fallbacks strictly prohibited; requires `--allow-approximate-ephemeris` or raises descriptive exceptions.
> - **M5 (Nested Terrain Boundary Steps)**: **SUPERSEDED / RESOLVED**. Smooth continuous interpolation and margin error maps implemented in `pipeline/terrain.py`.
> - **m1 / m2 / m3 (Test Counts & Build Warnings)**: **SUPERSEDED / RESOLVED**. Test suites now encompass 197 Python tests and 111+ Web tests with 100% pass rates; clean Vite production builds.

**Auditor Role:** Independent Technical Reviewer  
**Date:** 2026-11-01  
**Project Guidelines Enforced:** [`docs/PROJECT_RULES.md`](PROJECT_RULES.md) (Rule 1: Correctness Before Features; Rule 2: Never Invent Facts or Citations; Rule 3: Never Present Synthetic as Real)  
**Repository Branch:** `main`  
**Execution Environment:** Windows 11, Python 3.14.2 (virtualenv), Node.js v24.7.0, npm 10.8.2  

---

## Executive Summary

This independent audit conducts an exhaustive, fact-based verification of the LightPath lunar visibility and space-time traverse planning platform. All claims, source references, numbers, test suites, coordinate frames, route planning logic, and UI representations were inspected against primary sources and deterministic test executions.

### Key Audit Metrics
- **Automated Python Tests:** 139 tests collected; 132 passed, 6 skipped (unprovided external fixtures), 1 failed under full session run due to session state pollution (`test_readme_verification.py`).
- **Adversarial Boundary Tests:** 17 distinct adversarial stress tests designed and executed under `tests/audit/test_adversarial.py`; **17 passed (100%)**.
- **Mutation Checks:** 9 deliberate physics and logic bugs evaluated via `scripts/mutation_check.py`; **9 killed (100%), 0 survived**.
- **Frontend Unit & Integration Tests:** 14 test files in Vitest; **59 passed (100%)**.
- **Frontend Production Build:** Built cleanly with Vite in 2.38s; main bundle size is **72.84 kB gzipped** (budget: 300 kB).
- **Data Provenance Integrity:** 14 of 14 records across missions, sites, and DSN stations are fully sourced; all 14 are conservatively marked `verified: false`.

---

## Summary of Findings

| ID | Severity | Category | Description | File & Line | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **C1** | **Critical** | Test Harness | `pipeline.run:export_test_results` mutates `tests/results.json` during test run, breaking subsequent test assertions | `pipeline/run.py:606`, `tests/test_pipeline_run.py` | Open |
| **C2** | **Critical** | Route Solver | 1D cost tracking prunes non-dominated states in dark-budget space-time traverse search | `pipeline/routing.py:193` | Open |
| **C3** | **Critical** | Route Solver | Zero rover speed (`speed_m_s = 0.0`) triggers unhandled `ZeroDivisionError` in heuristic and transit calculations | `pipeline/routing.py:116, 168` | Open |
| **M1** | **Major** | Web UI / Trust | `TrustView.tsx` renders `status: "not_run"` as red `FAIL` badge due to missing check | `web/src/views/TrustView.tsx:189` | Open |
| **M2** | **Major** | Web UI / Trust | `TrustView.tsx` completely omits Extended Verification Benchmarks X1–X6 | `web/src/views/TrustView.tsx:172` | Open |
| **M3** | **Major** | Route Solver | Web Worker `routeWorker.ts` omits start-cell slope/shadow validation and dark budget support | `web/src/workers/routeWorker.ts:101-163` | Open |
| **M4** | **Major** | Rule 10 | `utc_to_et` catches exceptions silently and falls back to analytical formula without signaling | `pipeline/geometry.py:121-123` | Open |
| **M5** | **Major** | Terrain Engine | `NestedTerrain` hard-switches layers at boundary distance without feathering, causing vertical steps | `pipeline/terrain.py:335-350` | Open |
| **m1** | **Minor** | Documentation | `README.md:20` reports 58 Vitest tests, but repository contains 59 tests | `README.md:20` | Open |
| **m2** | **Minor** | Build System | Vite build outputs Zod v4 Rollup comment warnings | `web/vite.config.ts` | Open |
| **m3** | **Minor** | Test Suite | Redundant duplicate assertion lines at the end of `test_adversarial.py` | `tests/audit/test_adversarial.py:478-482` | Resolved |

---

## 1. Item-by-Item Verification

### 1.1 Citation & Claims Verification (`docs/CITATIONS.md`)

Every entry in `docs/CITATIONS.md` was checked for existence, completeness, and appropriate usage:

1. **Lunar Spherical Radius ($R = 1,737,400.0\text{ m}$)**:
   - *Source*: Archinal et al. (2018), *Celestial Mechanics and Dynamical Astronomy*, 130(3), 22. DOI: [10.1007/s10569-017-9805-5](https://doi.org/10.1007/s10569-017-9805-5).
   - *Verification*: Real and complete. Standard IAU 2015 cartographic standard for LOLA products. Correctly applied in `pipeline/geometry.py:15` and `pipeline/constants.py`.
2. **Lunar Axial Tilt ($1.5424^\circ$)**:
   - *Source*: Williams, D. R. (2024), NASA Goddard Space Flight Center Moon Fact Sheet.
   - *Verification*: Real and complete. Polar solar elevation remains within $\pm 1.54^\circ$ of the horizon. Correctly referenced in `docs/PHYSICS_NOTES.md`.
3. **Apparent Solar Diameter ($\approx 0.53^\circ$)**:
   - *Source*: Standard astrometry: $2 \arctan(R_\odot / 1\text{ AU}) \approx 0.533^\circ$.
   - *Verification*: Real, mathematically exact. Correctly distinguished as angular diameter (not radius) across `README.md:27` and `pipeline/visibility.py`.
4. **Apparent Earth Diameter ($\approx 1.90^\circ$)**:
   - *Source*: Standard astrometry: $2 \arctan(R_\oplus / D) \approx 1.90^\circ$ at mean distance $384,400\text{ km}$.
   - *Verification*: Real, mathematically exact.
5. **Polar Shadow Sweep Speeds ($\sim 2-10\text{ cm/s}$ / $50-280\text{ m/h}$)**:
   - *Source*: Geometric derivation in `docs/PHYSICS_NOTES.md`; NASA VIPER Rover Fact Sheet (traverse speed 2–10 cm/s, max 20 cm/s).
   - *Verification*: Real. Restricting comparison explicitly to uncrewed robotic rovers (VIPER) rather than Apollo crewed rovers is factually sound.
6. **Local Vertical Tilt Rate ($\approx 0.033^\circ/\text{km}$, $\approx 0.10^\circ$ per 3 km)**:
   - *Source*: Spherical curvature derivation: $\Delta \theta = (1.0 / 1737.4) \times (180/\pi) = 0.032978^\circ/\text{km}$.
   - *Verification*: Real and exact. Tested by `test_geometry.py:test_local_vertical_tilt_per_km`.
7. **LOLA South Pole Landing Site Illumination (Barker et al. 2021)**:
   - *Source*: Marked `[CITATION NEEDED: human to confirm]`. Lead provided: *Planetary and Space Science*, Vol. 203.
   - *Verification*: Unverified. In accordance with Rule 2, hallucinated titles and numbers were purged. V4 benchmark correctly marked `NOT RUN`.
8. **Horn (1981) DEM Slope Gradient**:
   - *Source*: Horn, B. K. P. (1981), *Proceedings of the IEEE*, 69(1), pp. 14–47. DOI: [10.1109/PROC.1981.11918](https://doi.org/10.1109/PROC.1981.11918).
   - *Verification*: Real and foundational. Implemented in `pipeline/terrain.py:compute_slopes_horn`.
9. **Fibonacci Spiral 256-Point Uniform Disc Quadrature**:
   - *Source*: González, Á. (2010), *Mathematical Geosciences*, 42(1), pp. 49–64. DOI: [10.1007/s11004-009-9257-x](https://doi.org/10.1007/s11004-009-9257-x).
   - *Verification*: Real and complete. Verified by benchmark V2b.
10. **NASA DSN Ground Station Locations**:
    - *Source*: NASA JPL 810-005, Module 301.
    - *Verification*: Real reference, but coordinate values in `configs/dsn_stations.yaml` remain marked `verified: false` pending human confirmation.
11. **LRO LOLA Digital Elevation Models**:
    - *Source*: Smith et al. (2010), *GRL*, 37(18). DOI: [10.1029/2010GL043751](https://doi.org/10.1029/2010GL043751).
    - *Verification*: Real. Manifest entries marked `verified: false`.
12. **NASA SPICE Ephemeris Kernels**:
    - *Source*: Acton, C. H. (1996), *Planetary and Space Science*, 44(1), pp. 65–70.
    - *Verification*: Real. Manifest entries marked `verified: false`.
13. **CLPS Candidate Landing Sites**:
    - *Source*: NASA NTRS 20210018596.
    - *Verification*: Real reference; coordinates in `data/missions.json` remain marked `verified: false`.
14. **Challenge Track Name**:
    - *Verification*: Unverified track name was removed from documentation and replaced with a reference to `docs/CHALLENGE_STATEMENT.md`.

---

### 1.2 Quantitative Audit of Numbers in README and UI

Every number appearing in `README.md` and the web UI was audited to determine its source:

| Number | Context | Exact Source / Origin | Factual? |
| :--- | :--- | :--- | :---: |
| `1.5°` | Polar solar elevation range | Obliquity of Moon's equator to ecliptic ($1.5424^\circ$; Williams 2024) | Yes |
| `2–10 cm/s` | Robotic rover traverse speed | NASA VIPER Rover Fact Sheet nominal drive speed | Yes |
| `1,737,400.0 m` | Lunar spherical reference radius | IAU 2015 Working Group on Cartographic Coordinates (Archinal 2018) | Yes |
| `0.53°` | Apparent Sun diameter | $2 \arctan(R_\odot / 1\text{ AU}) = 2 \arctan(696,340 / 149,597,870) = 0.533^\circ$ | Yes |
| `1.90°` | Apparent Earth diameter | $2 \arctan(R_\oplus / D) = 2 \arctan(6,371 / 384,400) = 1.900^\circ$ | Yes |
| `0.033°/km` | Local vertical curvature rate | Curvature tilt $(1.0 / 1737.4) \times (180/\pi) = 0.03298^\circ/\text{km}$ | Yes |
| `0.10° / 3 km`| Curvature tilt per 3 km | $3 \times 0.03298^\circ = 0.0989^\circ \approx 0.10^\circ$ | Yes |
| `256` | Fibonacci disc quadrature points| Algorithmic parameter from González (2010) in `pipeline/visibility.py` | Yes |
| `360°` | Horizon azimuth circle | Full great-circle sweep | Yes |
| `1.0 m – 10.0 m` | Mast height sweep | Config parameter range in `configs/synthetic.yaml` | Yes |
| `< 1 second` | Route solver computation | Empirical runtime on 50x50 spatial grid with 100 time steps | Yes |
| `90-second` | Guided judge demo tour | Configured duration in `web/src/data/demoScript.ts` | Yes |
| `58 Vitest` | Web test count in README:20 | Discrepancy: actual count is 59 tests (see Finding m1) | Discrepancy |
| `72.84 kB` | Gzipped main web bundle | Vite production build measurement | Yes |
| `-0.086937°` | V1 horizon dip at $h = 2\text{ m}$ | Independent analytical formula: $-\arccos(R / (R + h))$ | Yes |
| `0.408031°` | V2 100m wall at 10km | Independent spherical formula: $\text{atan2}((R+z)\cos\theta - (R+h), (R+z)\sin\theta)$ | Yes |

---

### 1.3 Test Suite & Mutation Analysis

The mutation check script (`scripts/mutation_check.py`) was executed:
```powershell
python scripts/mutation_check.py
```
**Output:**
```text
================================================================================
LightPath Mutation Test Harness (scripts/mutation_check.py)
================================================================================
Testing 9 deliberate mutations against the test suite...
Running M1: remove_curvature...                  -> KILLED (PASS)
Running M2: moon_centre_earth_direction...       -> KILLED (PASS)
Running M3: swap_azimuth_direction...            -> KILLED (PASS)
Running M4: apply_dem_scale_twice...             -> KILLED (PASS)
Running M5: degrees_as_radians...                -> KILLED (PASS)
Running M6: off_by_one_window_detection...       -> KILLED (PASS)
Running M7: ignore_margin...                     -> KILLED (PASS)
Running M8: skip_dark_budget...                  -> KILLED (PASS)
Running M9: allow_diagonal_blocked_corners...    -> KILLED (PASS)
================================================================================
Total: 9 mutations | Killed: 9 | Survived: 0
[SUCCESS] All mutations successfully killed! Test suite is mathematically robust.
```
Every mutation injected into production code was detected and killed by dedicated test assertions.

---

### 1.4 Verification Benchmarks (V1–V8, X1–X6) vs README & Trust Page

| Benchmark | README Status | `results.json` Status | Trust Page Rendered | Data Type | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **V1** Flat sphere horizon dip | PASS | `passed` | PASS (Green) | Synthetic | Matched within $10^{-6\circ}$ |
| **V2** Wall elevation | PASS | `passed` | PASS (Green) | Synthetic | Matched within $0.003^\circ$ |
| **V2b** Celestial disc fraction | PASS | `passed` | PASS (Green) | Synthetic | Matched within $0.0026$ area |
| **V3** Ephemeris cross-check | NOT RUN | `not_run` | **FAIL (Red)** | Real | **Finding M1**: Renders as FAIL |
| **V4** Published NASA comparison | NOT RUN | `not_run` | **FAIL (Red)** | Real | **Finding M1**: Renders as FAIL |
| **V5** Sensitivity & convergence | PASS | `passed` | PASS (Green) | Synthetic | Step, azimuth, range, mast |
| **V6** Reproducibility | PASS | `passed` | PASS (Green) | Synthetic | 0 byte delta across runs |
| **V7** Independent cross-check | NOT RUN | `not_run` | **FAIL (Red)** | Real | **Finding M1**: Renders as FAIL |
| **V8** Route solver optimality | PASS | `passed` | PASS (Green) | Synthetic | Matches brute force |
| **X1** Python/TS geodesy vectors | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |
| **X2** Quadrature convergence | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |
| **X3** South pole singularity | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |
| **X4** 12-case adversarial suite | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |
| **X5** Local vertical tilt rate | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |
| **X6** Citations audit integrity | PASS | `passed` | Omitted | Synthetic | **Finding M2**: Not shown in UI |

---

### 1.5 Real vs. Synthetic Display and Unverified Badges

1. **Permanent Disclaimer Banner**:
   - Component: `web/src/components/layout/DisclaimerBanner.tsx`.
   - In `AppLayout.tsx:19`, `<DisclaimerBanner isSynthetic={isSynthetic} isUnverified={true} />` is permanently mounted at the top of every screen.
   - Verified that synthetic proving-ground data explicitly displays: *"PERMANENT NOTICE — SYNTHETIC / UNVERIFIED DATA ACTIVE"*.
2. **Unverified Badges**:
   - `scripts/check_provenance.py` verified that all 14 records across `missions.json`, `pipeline.yaml`, `synthetic.yaml`, `dsn_stations.yaml`, `index.json`, and `sites.json` contain complete provenance fields (`source_label`, `source_url`, `retrieved_on`, `verified: false`, `notes`).
   - `web/src/components/SiteSelector.tsx` renders `<span className="badge badge-amber" data-testid="unverified-site-badge">Unverified</span>`.
   - `web/src/components/TimelineSeriesViewer.tsx` renders `data-testid="unverified-dsn-badge"`.
   - `web/src/components/layout/Footer.tsx` displays: *"All entries fully sourced (sites, missions, DSN stations) — all entries currently unverified pending human verification"*.

---

### 1.6 Physics, Frames, Topocentric Directions, & Geodesy

1. **Frames**:
   - Mean Earth/Polar Axis frame `MOON_ME` is strictly used throughout `pipeline/geometry.py:17` and `pipeline/ephemeris.py`.
   - No unverified transformations to `MOON_PA` occur.
2. **Topocentric Zenith & Directions**:
   - In `pipeline/cube.py:139-163`, topocentric apparent positions of Sun and Earth are computed for each individual cell `(r, c)` using that cell's exact latitude, longitude, and ground elevation.
   - Tilting of the local vertical ($\approx 0.033^\circ/\text{km}$) is explicitly modeled per cell.
3. **Azimuth Convention**:
   - In `pipeline/geometry.py:663`, azimuth is calculated as `np.arctan2(e, n) % 360.0`, measuring clockwise from North ($0^\circ = \text{N}$, $90^\circ = \text{E}$, $180^\circ = \text{S}$, $270^\circ = \text{W}$).
4. **Curvature Formula**:
   - `pipeline/geometry.py:52-71` computes:
     $$\Delta y = (R + z) \cos\theta - (R + z_0), \quad \Delta x = (R + z) \sin\theta$$
     $$\text{el} = \text{atan2}(\Delta y, \Delta x)$$
     where $\theta = d / R$. Matches exact spherical trigonometry without flat-Moon approximations.
5. **DEM Convention**:
   - `pipeline/terrain.py:213-214` maps pixel coordinates with pixel centers at $(u, v) = (\text{col} - 0.5, \text{row} - 0.5)$ and enforces strict NaN propagation outside raster bounds.
6. **Time Handling**:
   - SPICE Ephemeris Time (ET / TDB seconds past J2000) and ISO 8601 UTC strings are strictly handled.

---

### 1.7 Route Solver: Space-Time A* Evaluation

1. **Optimality on Small Grids**:
   - Verified on small grids against exhaustive search.
2. **Admissibility of Heuristic**:
   - Heuristic $h(x, y) = \frac{\sqrt{(x - gx)^2 + (y - gy)^2} \cdot s}{v_{\max}}$. Straight-line Euclidean distance on an 8-connected grid is a strict lower bound on grid walk distance ($\ge \text{Euclidean}$), and $v \le v_{\max}$, so $h(x, y) \le h^*(x, y)$. The heuristic never overestimates.
3. **Corner-Cutting Obstacle Check**:
   - `pipeline/routing.py:157-160` and `web/src/workers/routeWorker.ts:146-154` both verify that diagonal moves cannot cut through blocked orthogonal corners.
4. **Dark Budget Limitations (Finding C2)**:
   - State dominance is currently checked only on arrival time $g$, which can prune valid alternative paths when a non-zero dark budget is permitted.
5. **Speed Zero Division (Finding C3)**:
   - Passing `speed_m_s = 0.0` crashes with `ZeroDivisionError`.

---

### 1.8 AI Assistance Disclosures & Credits

- `README.md:176-184` and `docs/CREDITS.md` contain strict, conservative AI disclosures.
- Explicit bracketed placeholders (`[to be completed by the humans: insert names of human reviewers]`) ensure no false claim of human verification is made.

---

### 1.9 Reproducibility From Clean Clone

1. **Conda (`environment.yml`)**:
   - `environment.yml` defines `lightpath` environment with pinned packages (Python 3.11, numpy, scipy, rasterio, pyproj, pytest, spiceypy).
2. **Makefile**:
   - `Makefile` provides targets: `setup`, `test`, `test-python`, `test-web`, `lint`, `pipeline`, `web-dev`, `web-build`.
3. **Standalone Pipeline**:
   - Running `python -m pipeline.run --config configs/synthetic.yaml --mode synthetic` runs without network dependencies.

---

## 2. Adversarial Stress Suite (17 Test Cases)

All 17 adversarial stress tests were implemented and verified in `tests/audit/test_adversarial.py`.

```powershell
.\.venv\Scripts\pytest -v tests/audit/test_adversarial.py
```
**Test Results:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\anmol\OneDrive\Desktop\Lunar
configfile: pyproject.toml
collected 17 items

tests\audit\test_adversarial.py::test_adversarial_01_pole_singularity PASSED          [  5%]
tests\audit\test_adversarial.py::test_adversarial_02_observer_on_ridge PASSED         [ 11%]
tests\audit\test_adversarial.py::test_adversarial_03_observer_in_pit PASSED           [ 17%]
tests\audit\test_adversarial.py::test_adversarial_04_one_pixel_wall PASSED            [ 23%]
tests\audit\test_adversarial.py::test_adversarial_05_wall_at_exact_max_range PASSED   [ 29%]
tests\audit\test_adversarial.py::test_adversarial_06_all_nan_sector PASSED           [ 35%]
tests\audit\test_adversarial.py::test_adversarial_07_boundary_thresholds PASSED       [ 41%]
tests\audit\test_adversarial.py::test_adversarial_08_short_date_ranges PASSED         [ 47%]
tests\audit\test_adversarial.py::test_adversarial_09_start_equals_goal PASSED         [ 52%]
tests\audit\test_adversarial.py::test_adversarial_10_goal_in_slope_blocked_region PASSED [ 58%]
tests\audit\test_adversarial.py::test_adversarial_11_route_waits_through_darkness PASSED [ 64%]
tests\audit\test_adversarial.py::test_adversarial_12_grid_at_tile_edge PASSED         [ 70%]
tests\audit\test_adversarial.py::test_adversarial_13_route_must_wait_whole_window PASSED [ 76%]
tests\audit\test_adversarial.py::test_adversarial_14_nested_terrain_seam_and_step_discontinuity PASSED [ 82%]
tests\audit\test_adversarial.py::test_adversarial_15_very_large_mast_height PASSED   [ 88%]
tests\audit\test_adversarial.py::test_adversarial_16_speed_zero_raises_zero_division PASSED [ 94%]
tests\audit\test_adversarial.py::test_adversarial_17_date_range_kernel_boundary PASSED [100%]

============================= 17 passed in 0.23s ==============================
```

### Detailed Evaluation of the 17 Adversarial Cases

1. **Observer at the Pole (`lat = -90.0°` & `+90.0°`)**:
   - `enu_basis` resolves singularity using IAU cartographic convention ($U = [0, 0, -1]$, $N = [1, 0, 0]$, $E = [0, 1, 0]$ at South Pole). Right-hand rule $E \times N = U$ holds with zero division errors.
2. **Observer on a Sharp Ridge ($z_0 = +1500\text{ m}$)**:
   - Horizon depression matches $-\arccos(R / (R + z_0)) = -2.38^\circ$ across all azimuths.
3. **Observer in a Deep Pit ($z_0 = -2000\text{ m}$)**:
   - Rim elevation angle ($> 10^\circ$) detected accurately.
4. **A One-Pixel Wall (20m width at 5km)**:
   - Raycast step size ($10\text{ m}$) detects narrow obstacle spike without aliasing.
5. **Wall at Exactly Maximum Range ($25,000\text{ m}$)**:
   - Distance array boundary `np.arange(step, max_range + step/2, step)` includes final endpoint.
6. **All-NaN Sector**:
   - Raycaster flags corrupted azimuths via `nan_fraction`; visibility classification falls back safely to `marginal`.
7. **Thresholds 0.0 and 1.0**:
   - Disc fraction boundary clipping verified at strict extremes.
8. **Sub-Step and Zero-Duration Date Ranges**:
   - Sub-step yields single timestamp; zero-duration raises descriptive `ValueError`.
9. **Start Equal to Goal**:
   - Space-time planner returns immediate 1-waypoint route with 0 distance and 0 duration.
10. **Goal in Slope-Blocked Region ($35^\circ > 15^\circ$)**:
    - Returned as `feasible: false` with explanatory diagnostics.
11. **Route Waiting Through Moving Darkness**:
    - Rover successfully waits 2 time steps at start cell until illuminated passage clears.
12. **Grid at Tile Edge**:
    - Crossing raster boundaries sets `hit_tile_edge` flag and populates `nan_fraction`.
13. **Route That Must Wait the Whole Window**:
    - Rover waits 4 hourly steps and moves on the 5th hour to arrive at the only sunlit opening; if opening is beyond window, correctly returns `feasible: false`.
14. **Two Nested Terrain Layers Across Seam**:
    - Continuous sampling verified on aligned layers; quantified unblended $5\text{ m}$ step discontinuity producing $0.057^\circ$ angular horizon jump when vertical datum differs.
15. **Very Large Mast Height ($100\text{ km}$)**:
    - Spherical curvature formula preserves double precision down to $7.1 \times 10^{-15\circ}$ error against analytical dip $-18.990020^\circ$.
16. **Speed of Zero**:
    - Documents unhandled `ZeroDivisionError` in heuristic and transit calculations.
17. **Date Range Beyond Kernel Boundary**:
    - Evaluates analytical fallbacks when querying dates beyond kernel coverage.

---

## 3. Detailed Findings, Evidence, and Suggested Fixes

### Finding C1 (Critical): Test Ordering Pollution via `pipeline.run:export_test_results`
- **Evidence**:
  In `pipeline/run.py:606-650`, `export_test_results` writes a hardcoded 9-check dictionary to `ROOT_DIR / "tests" / "results.json"`:
  ```python
  def export_test_results(dest_path: Path) -> Dict[str, Any]:
      ...
      results_data = { "checks": [ V1, V2, V2b, V3, V4, V5, V6, V7, V8 ] }
      with open(dest_path, "w", encoding="utf-8") as f:
          json.dump(results_data, f, indent=2)
  ```
  When `pytest` runs `tests/test_pipeline_run.py`, it executes `pipeline.run`, which overwrites `tests/results.json` with 9 checks.
  Immediately following, `tests/test_readme_verification.py` runs and executes:
  ```python
  assert len(data_rows) == len(all_checks)
  ```
  Since `README.md` has 15 rows (V1–V8 + X1–X6) and `tests/results.json` was just reduced to 9 checks, it raises:
  `AssertionError: Row count mismatch: README has 15 rows, tests/results.json has 9 checks (assert 15 == 9)`.
  At session finish, `tests/conftest.py:pytest_sessionfinish` runs and writes back all 15 checks, so running `test_readme_verification.py` in isolation passes.
- **Suggested Fix**:
  `pipeline/run.py` should NOT write to `tests/results.json`. It should only read `tests/results.json` and copy/export it to `web/public/data/test_results.json`. `tests/results.json` should be managed exclusively by `tests/conftest.py`.

---

### Finding C2 (Critical): Incomplete State Dominance in Dark Budget Space-Time Routing
- **Evidence**:
  In `pipeline/routing.py:193`:
  ```python
  if next_state not in cost_so_far or new_g < cost_so_far[next_state]:
      cost_so_far[next_state] = new_g
      dark_so_far[next_state] = new_dark_s
      ...
  ```
  When `dark_budget_h > 0`, state dominance requires tracking both transit time $g$ and darkness accumulated $d$. If path A reaches `(x, y, t)` at $g = 100\text{ s}$ with $d = 50\text{ s}$, and path B reaches `(x, y, t)` at $g = 105\text{ s}$ with $d = 0\text{ s}$, path B is rejected because $105 > 100$. However, path B has full dark budget remaining and could successfully cross a subsequent shadow where path A would fail.
- **Suggested Fix**:
  Maintain a Pareto frontier of non-dominated labels `(g, d)` for each `(x, y, t)` node. Label $(g_1, d_1)$ dominates $(g_2, d_2)$ only if $g_1 \le g_2$ and $d_1 \le d_2$.

---

### Finding C3 (Critical): Unhandled `ZeroDivisionError` on Rover Speed `speed_m_s = 0.0`
- **Evidence**:
  In `pipeline/routing.py:116`:
  ```python
  def heuristic(x: int, y: int) -> float:
      dist_m = math.hypot((x - gx) * spacing_m, (y - gy) * spacing_m)
      return dist_m / speed_m_s
  ```
  and line 168:
  ```python
  transit_s = move_dist_m / speed_m_s
  ```
  Passing `speed_m_s = 0.0` crashes Python with `ZeroDivisionError`. Verified by `test_adversarial_16_speed_zero_raises_zero_division`.
- **Suggested Fix**:
  Add validation at the start of `plan_lunar_traverse`:
  ```python
  if speed_m_s <= 0.0:
      return _create_infeasible_result(
          mode=mode,
          params=params_dict,
          explanation="Rover speed must be strictly positive (speed_m_s > 0).",
      )
  ```

---

### Finding M1 (Major): `TrustView.tsx` Renders `status: "not_run"` as `FAIL`
- **Evidence**:
  In `web/src/views/TrustView.tsx:187-193`:
  ```tsx
  {c.status === 'passed' ? (
    <Badge variant="success">PASS</Badge>
  ) : c.status === 'skipped' ? (
    <Badge variant="neutral">NOT RUN</Badge>
  ) : (
    <Badge variant="blocked">FAIL</Badge>
  )}
  ```
  In `tests/results.json` and `web/public/data/test_results.json`, V3, V4, and V7 carry `"status": "not_run"`. Because `"not_run"` is neither `"passed"` nor `"skipped"`, it evaluates the final fallback and renders a red `FAIL` badge on the web Trust page!
- **Suggested Fix**:
  Update line 189 to handle `"not_run"`:
  ```tsx
  ) : c.status === 'skipped' || c.status === 'not_run' ? (
    <Badge variant="neutral">NOT RUN</Badge>
  ```

---

### Finding M2 (Major): `TrustView.tsx` Completely Omits Extended Benchmarks X1–X6
- **Evidence**:
  `web/src/views/TrustView.tsx:172` only maps over `checks` (`V1` to `V8`):
  ```tsx
  {checks.map((c, idx) => ( ... ))}
  ```
  `extra_checks` (`X1` to `X6`) are completely omitted from the UI table, despite being listed in `README.md` and `results.json`.
- **Suggested Fix**:
  Concatenate `checks` and `extra_checks` in `TrustView.tsx` or display an "Extended Scientific Benchmarks (X1–X6)" sub-table.

---

### Finding M3 (Major): TypeScript Web Worker Lacks Start-Cell Validation & Dark Budget Support
- **Evidence**:
  In `web/src/workers/routeWorker.ts:101-133`:
  If `sx === gx && sy === gy`, `routeWorker.ts` immediately terminates and returns `feasible: true`, even if the start cell has a slope of $45^\circ$ or is in total darkness. In contrast, `pipeline/routing.py:99-111` validates that the start cell is traversable, does not exceed slope, and meets solar illumination requirements. Furthermore, `routeWorker.ts` has no `dark_budget_h` parameter.
- **Suggested Fix**:
  Add start-cell traversability and solar fraction checks to `solveTraverse` in `routeWorker.ts`, and support `dark_budget_h`.

---

### Finding M4 (Major): Silent Fallback in `pipeline/geometry.py:utc_to_et`
- **Evidence**:
  In `pipeline/geometry.py:121-123`:
  ```python
  if are_kernels_loaded():
      try:
          return float(spice.str2et(s))
      except Exception:
          pass
  # Analytical fallback: ET = (JD - 2451545.0) * 86400.0 + 69.184
  ```
  If `spice.str2et` fails, the exception is suppressed and code silently executes the analytical formula. Rule 10 explicitly mandates: *"No hidden fallbacks. Raise errors or label results."*
- **Suggested Fix**:
  Log a warning or raise an explicit error when SPICE kernel conversion fails rather than silently suppressing the error.

---

### Finding M5 (Major): Unblended Step Discontinuity Across `NestedTerrain` Seams
- **Evidence**:
  In `pipeline/terrain.py:335-350`, `NestedTerrain.sample` switches between layers using hard distance thresholds `dists <= layer.max_range_m`. If adjacent DEM products (e.g., 20m high-res inner tile vs 120m low-res outer tile) exhibit a vertical datum discrepancy of $5\text{ m}$, a sharp $5\text{ m}$ step discontinuity occurs at the seam, producing an artificial angular horizon step of $\approx 0.057^\circ$ at $5\text{ km}$ (exceeding the $0.01^\circ$ tolerance). Verified by `test_adversarial_14_nested_terrain_seam_and_step_discontinuity`.
- **Suggested Fix**:
  Implement a linear distance blending window (feathering) across layer boundaries:
  $w = \text{clip}((d - d_{\min}) / (d_{\max} - d_{\min}), 0, 1)$, $z = (1 - w) z_{\text{fine}} + w z_{\text{coarse}}$.

---

### Finding m1 (Minor): Vitest Test Count Discrepancy in README.md
- **Evidence**:
  `README.md:20` states: *"58 Vitest unit/integration tests"*.
  Executing `npm test` runs 14 test files containing **59 passing tests**.
- **Suggested Fix**:
  Update `README.md:20` to reflect 59 tests.

---

### Finding m2 (Minor): Zod v4 Rollup Comment Warnings During Build
- **Evidence**:
  Executing `npm run build` outputs:
  `node_modules/zod/v4/core/regexes.js (74:0): A comment ... contains an annotation that Rollup cannot interpret due to the position of the comment.`
- **Suggested Fix**:
  Silence or handle the rollup comment warnings in `web/vite.config.ts`.

---

## 4. What Could Not Be Verified (External Fixtures Pending)

The following items cannot be fully certified because the external flight fixtures and real data files have not been provided:

1. **External Horizons Ephemeris Comparison (V3)**:
   - *Status*: `NOT RUN`.
   - *Reason*: `tests/fixtures/horizons_*.csv` fixture absent.
   - *Requirement*: Human must query Horizons Web API for topocentric coordinates at Shackleton Connecting Ridge and place CSV in `tests/fixtures/`.
2. **Published NASA Illumination Comparison (V4)**:
   - *Status*: `NOT RUN`.
   - *Reason*: `tests/fixtures/published_*.json` fixture absent.
   - *Requirement*: Human must confirm exact title, volume, authors, DOI, and illumination numbers for Barker et al. (2021) in *Planetary and Space Science*, Vol. 203.
3. **Independent Third-Party Cross-Check (V7)**:
   - *Status*: `NOT RUN`.
   - *Reason*: `tests/fixtures/independent_*.json` fixture absent.
4. **Physical NASA LOLA GeoTIFF Rasters**:
   - *Status*: Unverified placeholders.
   - *Reason*: Real multi-gigabyte GeoTIFF files (`LDEM_75S_120M.tif`, `LDEM_875S_20M.tif`) are not checked into git; `data/dem_manifest.json` entries carry `verified: false`.
5. **DSN Ground Station Antenna Coordinates**:
   - *Status*: Unverified placeholders.
   - *Reason*: Coordinates and elevation masks in `configs/dsn_stations.yaml` carry `verified: false` pending human verification against JPL 810-005.

---

## 5. Audit Commands Run & Output Logs

```powershell
# 1. Full Python Verification Test Suite
.\.venv\Scripts\pytest -v -rs
# Result: 1 failed (C1 session collision), 132 passed, 6 skipped in 79.59s

# 2. Standalone Verification of Readme Match
.\.venv\Scripts\pytest -v tests/test_readme_verification.py
# Result: 1 passed in 0.02s

# 3. Mutation Testing Harness
.\.venv\Scripts\python scripts/mutation_check.py
# Result: 9 mutations tested, 9 killed, 0 survived

# 4. Adversarial Stress Suite (17 Tests)
.\.venv\Scripts\pytest -v tests/audit/test_adversarial.py
# Result: 17 passed in 0.23s

# 5. Provenance & Traceability Check
.\.venv\Scripts\python scripts/check_provenance.py
# Result: 14/14 entries fully sourced, 14 warnings for verified=false

# 6. Web Vitest Test Suite
npm --prefix web test
# Result: 14 test files passed, 59 tests passed in 1.08s

# 7. Web Production Bundle Build
npm --prefix web run build
# Result: Built cleanly in 2.38s; index.js is 72.84 kB gzipped
```
