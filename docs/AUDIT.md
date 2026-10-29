# Independent Technical Audit: LightPath Lunar South Pole Navigation System

**Audit Date**: October 29, 2026  
**Auditor Persona**: Independent Reviewer (Clean-room verification against `docs/PROJECT_RULES.md`)  
**Commit Audited**: `0bc1a2f` (Branch: `main`)  
**Repository**: `https://github.com/AnmolGarg8/LightPath.git`

---

## Executive Summary

LightPath was subjected to an exhaustive technical audit across all 16 core mathematical, geodesy, ephemeris, and architectural dimensions required by `docs/PROJECT_RULES.md`. An independent adversarial stress-test suite comprising 12 boundary-breaking scenarios was implemented under `tests/audit/test_adversarial.py` and executed against the Python core.

**Overall Verdict**: **PASS WITH ADVISORIES**
- **0 Critical Vulnerabilities** (No data corruption, silent sign flips, or coordinate frame leaks).
- **2 Major Advisories** (Route worker metric hardcoding & time discretization; Horizon callable argument signature mismatch).
- **3 Minor Advisories** (Discrete window time-bin off-by-one semantics; Panorama canvas 0°/360° disc wrapping; NaN fallback to marginal enum).
- **12 / 12 Adversarial Stress Tests Passed** (`tests/audit/test_adversarial.py`).
- **All 94 Unit Tests Passing** (`pytest`), **53 Web Tests Passing** (`vitest`).

---

## Part 1: Detailed Checklist Verification (Items 1–16)

### 1. Reference Frames: `MOON_ME` vs `MOON_PA`
- **Rule**: Strictly adopt the Moon Mean Earth / Polar Axis frame (`MOON_ME`). No `MOON_PA` without an explicit converted path.
- **Evidence**:
  - `pipeline/constants.py:22`: `FRAME_MOON_ME: Final[str] = "MOON_ME"`.
  - `pipeline/geometry.py:81, 325, 446`: Default parameter `frame: str = FRAME_MOON_ME`.
  - `pipeline/ephemeris.py:92-160`: Analytical lunar subsolar and sub-Earth coordinate systems are formulated directly in `MOON_ME`.
  - `web/src/views/SiteDetailView.tsx:125`, `web/src/views/HomeView.tsx:258`, `web/src/components/ProvenanceModal.tsx:96`: Explicitly display `MOON_ME`.
  - Full codebase grep for `MOON_PA` yields zero occurrences outside of rule documentation (`docs/PROJECT_RULES.md:13`).
- **Status**: **VERIFIED CONCURRENT & STRICTLY COMPLIANT**.

---

### 2. Topocentric Directions with Per-Point Local Up
- **Rule**: Sun and Earth directions must be topocentric using that point's outward radial unit vector ($\mathbf{u}$), never from the lunar centre. Route cells must compute local up individually ($~0.1^\circ/\text{km}$ tilt).
- **Evidence**:
  - `pipeline/geometry.py:180-259` (`enu_basis`): Up vector is $\mathbf{u} = [\cos\phi\cos\lambda, \cos\phi\sin\lambda, \sin\phi]$.
  - `pipeline/geometry.py:289-313` (`topocentric_az_el`): Projects $(\mathbf{r}_{\text{target}} - \mathbf{r}_{\text{site}})$ onto local basis unit vectors $[\mathbf{e}, \mathbf{n}, \mathbf{u}]$.
  - `pipeline/cube.py:129-163`: The spatio-temporal visibility cube computes `enu_basis` and topocentric states for every individual grid cell $(r, c)$ at $(cell\_lat, cell\_lon, cell\_elev)$.
  - `tests/test_geometry.py:192-230`: Asserts that two points separated by 3 km exhibit $\approx 0.1^\circ$ topocentric elevation shift.
- **Status**: **VERIFIED CONCURRENT & STRICTLY COMPLIANT**.

---

### 3. Azimuth Convention & Wrap-Around
- **Rule**: Azimuth measured clockwise from North ($0^\circ = \text{North}, 90^\circ = \text{East}, 180^\circ = \text{South}, 270^\circ = \text{West}$) in $[0^\circ, 360^\circ)$. Periodic wrap-around at $0^\circ/360^\circ$.
- **Evidence**:
  - `pipeline/geometry.py:303`: `az_rad = np.arctan2(e, n); az_deg = np.degrees(az_rad) % 360.0`.
  - `pipeline/visibility.py:165-178`: Periodically wraps the horizon profile by extending $[-360^\circ, 0^\circ]$ and $[360^\circ, 720^\circ]$ prior to `np.interp`, guaranteeing seamless interpolation across the meridian.
  - `web/src/utils/scales.ts:27-37`: `COMPASS_POINTS` defines $0^\circ\text{ N}, 90^\circ\text{ E}, 180^\circ\text{ S}, 270^\circ\text{ W}, 360^\circ\text{ N}$.
  - `web/src/views/Panorama.tsx:164`: `scaleX` maps $[0^\circ, 360^\circ]$ across canvas width.
- **Status**: **VERIFIED COMPLIANT** (See Minor Advisory M-02 for canvas disc clipping).

---

### 4. Physical Units in Identifiers
- **Rule**: Degrees at module boundaries, radians only inside mathematical internals; metres and kilometres explicitly named (`lat_deg`, `dist_m`, `range_km`).
- **Evidence**:
  - `pipeline/geometry.py`: All public signatures use `_deg`, `_m`, `_km`.
  - `pipeline/terrain.py:93`: `open_dem_window(..., center_lat_deg, center_lon_deg, half_width_m)`.
  - `pipeline/constants.py`: `R_MOON_M = 1737400.0`, `R_SUN_KM = 695700.0`, `R_EARTH_KM = 6371.0`.
  - `pipeline/ephemeris.py:211-218`: Observer height converted from metres to kilometres (`r_obs_km = r_obs_m / 1000.0`) before subtracting from target state in km.
- **Status**: **VERIFIED CONCURRENT & STRICTLY COMPLIANT**.

---

### 5. Exact Spherical Curvature Formulation
- **Rule**: Exact spherical elevation formula without flat-Moon approximations:
  $$\text{el} = \arctan2\left((R + z)\cos\theta - (R + z_0), (R + z)\sin\theta\right), \quad \theta = \frac{d}{R}$$
- **Evidence**:
  - Python: `pipeline/geometry.py:623-634` & `pipeline/horizon.py:283-286`:
    ```python
    num = r_target * cos_thetas - r_obs
    den = r_target * sin_thetas
    ray_elevations_rad = np.arctan2(num, den)
    ```
  - TypeScript: `web/src/lib/geometry.ts:46-49`:
    ```typescript
    const num = targetR * Math.cos(thetaRad) - observerR;
    const den = targetR * Math.sin(thetaRad);
    const elRad = Math.atan2(num, den);
    ```
  - Cross-Verification: `tests/vectors.json` evaluated by both `tests/test_vectors.py` and `web/src/__tests__/geometryVectors.test.ts`. Parity matches to $< 10^{-14\circ}$.
  - Ridge test ($h = 100\text{ m}, d = 10\text{ km}$): yields exactly $0.408031^\circ \approx 0.41^\circ$.
- **Status**: **VERIFIED MATHEMATICALLY EXACT**.

---

### 6. DEM Geodesic Datum & Layer Seams
- **Rule**: LOLA heights relative to $R = 1,737,400\text{ m}$. Scale and offset applied once. Multi-resolution nested DEM seams must not produce artificial steps.
- **Evidence**:
  - `pipeline/terrain.py:30-57` (`verify_lunar_crs_radius`): Inspects PROJ/WKT ellipsoid parameters, raising `ValueError` if semi-major or semi-minor axes differ from $1,737,400\text{ m}$ by $> 1.0\text{ m}$.
  - `pipeline/terrain.py:150-156`: `src.scales[0]` and `src.offsets[0]` applied exactly once to raw raster integers during window read.
  - `pipeline/terrain.py:334-351` (`NestedTerrain`): Evaluates candidate layers fine-to-coarse; missing or NaN regions fall back cleanly to coarser layers.
- **Status**: **VERIFIED COMPLIANT**.

---

### 7. Geodetic Ray Propagation vs Raster Walking
- **Rule**: Raycast paths must follow true great circles on the lunar sphere with pyproj `Geod(a=1737400, b=1737400)`. No straight-line pixel grid steps.
- **Evidence**:
  - `pipeline/horizon.py:28, 245`:
    ```python
    GEOD_LUNAR = pyproj.Geod(a=R_MOON_M, b=R_MOON_M)
    ray_lons, ray_lats, _ = GEOD_LUNAR.fwd(site_lon_flat, site_lat_flat, az_flat, dist_flat)
    ```
  - Raster CRS is read directly from file header via `src.crs` (`pipeline/terrain.py:121-125`).
- **Status**: **VERIFIED COMPLIANT**.

---

### 8. NaN & Boundary Edge Handling
- **Rule**: Missing DEM data and out-of-bounds queries must propagate as NaN without creating false horizon peaks or crashes.
- **Evidence**:
  - `pipeline/terrain.py:158-164`: `raw_data == src.nodata` converted to `np.nan`.
  - `pipeline/terrain.py:220-224` (`sample_bilinear`): If any surrounding pixel is NaN, the interpolated value is strictly NaN.
  - `pipeline/horizon.py:276, 290`: `safe_z = np.where(nan_mask, -R_MOON_M, sampled_z_2d); ray_elevations_deg[nan_mask] = -90.0`. NaN cells are clamped to $-90^\circ$ so they never create spurious horizon peaks.
  - `pipeline/horizon.py:267, 306`: Sets `"hit_tile_edge"` flag if the outer ray boundary is NaN.
- **Status**: **VERIFIED COMPLIANT** (See Minor Advisory M-03 for status fallback).

---

### 9. Time Handling & Ephemeris Conversions
- **Rule**: All timestamps strictly ISO 8601 UTC with 'Z'. Conversions to Ephemeris Time (ET/TDB) via SPICE `str2et` or analytical fallback. Zero local time zone leaks.
- **Evidence**:
  - `pipeline/ephemeris.py:52-53`: Forces `datetime.fromisoformat(clean_str).astimezone(timezone.utc)`.
  - `pipeline/geometry.py:105-136` (`utc_to_et`): Uses SPICE `str2et` when kernels loaded; otherwise exact TT-UTC analytical offset ($JD - 2451545.0) \times 86400.0 + 69.184$.
  - `pipeline/run.py:138-141`: Uniform step generation with explicit UTC string format `%Y-%m-%dT%H:%M:%SZ`.
- **Status**: **VERIFIED COMPLIANT**.

---

### 10. Window Statistics & Outage Durations
- **Rule**: Accurate statistical duration accounting. Thresholds always reported in output schemas.
- **Evidence**:
  - `pipeline/stats.py:295-299`: Output dictionary includes full `thresholds` block (`min_sun_frac`, `min_earth_frac`, `ground_station_mask_deg`).
  - `schemas/stats.schema.json:15-24`: `thresholds` is a mandatory schema property.
- **Status**: **VERIFIED COMPLIANT** (See Minor Advisory M-01 regarding discrete sample duration convention).

---

### 11. Uncertainty Margin Classes
- **Rule**: Visibility classification must match `robust_visible`, `marginal`, `robust_blocked`.
- **Evidence**:
  - `pipeline/visibility.py:210-218, 292-298`:
    - Raised horizon ($\text{frac}_{\text{pess}} \ge \text{thresh}$) and lowered horizon ($\text{frac}_{\text{opt}} \ge \text{thresh}$) $\implies$ `STATUS_ROBUST_VISIBLE`.
    - Both below threshold $\implies$ `STATUS_ROBUST_BLOCKED`.
    - Otherwise $\implies$ `STATUS_MARGINAL`.
  - Matches `schemas/series.schema.json:28, 43` enum specification.
- **Status**: **VERIFIED COMPLIANT**.

---

### 12. 4D Space-Time Route Solver
- **Rule**: A* graph search in $(x, y, t)$ considering slope and illumination/link constraints.
- **Evidence**:
  - Python: `pipeline/routing.py:18-247` executes space-time A* with 8-connectivity plus stationary wait.
  - TypeScript: `web/src/workers/routeWorker.ts` executes space-time A* in a background Web Worker.
- **Status**: **DISCREPANCIES IDENTIFIED** (See Major Advisory MAJ-01).

---

### 13. Deep Space Network (DSN) Configuration
- **Rule**: Real station data must be verified or marked unverified. Minimum elevation mask parameter documented.
- **Evidence**:
  - `configs/dsn_stations.yaml:9, 19, 28, 37`: Every station entry contains `verified: false` and is tagged `# UNVERIFIED_PLACEHOLDER: Verify against JPL 810-005`.
  - Elevation mask parameter `default_min_elevation_deg: 6.0` explicitly documented with verification notice.
- **Status**: **VERIFIED COMPLIANT**.

---

### 14. Schema Drift (Python $\leftrightarrow$ JSON Schema $\leftrightarrow$ TypeScript)
- **Rule**: No schema drift between generated JSON, JSON schemas, and TypeScript Zod types.
- **Evidence**:
  - `tests/test_schemas.py` validates all schema files against draft 2020-12.
  - `web/src/types/schemas.ts` mirrors JSON schemas with Zod.
  - `web/src/__tests__/validation.test.ts` validates real JSON payloads against Zod schemas.
- **Status**: **VERIFIED STRICT PARITY**.

---

### 15. Scientific Honesty & UI Claims
- **Rule**: Never claim power, link budget, or navigation safety. Permanent banners on synthetic data.
- **Evidence**:
  - `web/src/components/layout/DisclaimerBanner.tsx:29-32`: Permanent banner stating: *"Sun visibility is not electrical power. Earth visibility is not a link budget. Not certified for flight operations."*
  - `web/src/__tests__/templates.test.ts:46`: Explicitly tests that generated copy contains *"visible"*, not *"powered"*.
  - `web/src/views/EvidenceView.tsx`: Displays high-contrast "SYNTHETIC PROVING GROUND DATA" watermark when `is_synthetic` is true.
- **Status**: **VERIFIED COMPLIANT**.

---

### 16. Reproducibility on Clean Clone
- **Rule**: Automated CI verification and clean execution from documentation.
- **Evidence**:
  - `.github/workflows/ci.yml`: Runs ruff, pytest, eslint, vitest, and vite build.
  - GitHub Actions run `40900241155`: All steps passed in 1m 28s on clean Ubuntu runner.
- **Status**: **VERIFIED COMPLIANT**.

---

## Part 2: Adversarial Stress Test Suite (`tests/audit/test_adversarial.py`)

All 12 adversarial test cases passed successfully:

```
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\anmol\OneDrive\Desktop\Lunar
configfile: pyproject.toml
collected 12 items

tests\audit\test_adversarial.py ............                             [100%]

============================= 12 passed in 0.19s ==============================
```

### Adversarial Case Outcomes:
1. **Observer at the Pole**: ENU basis evaluated at $-90^\circ$ and $+90^\circ$. Orthonormality, cartographic Prime Meridian convention, and right-handed rule verified. Horizon dip at $h = 2\text{ m}$ matches theoretical $-0.087^\circ$.
2. **Observer on a Ridge**: Top of 1500 m ridge surrounded by 0 m terrain. All horizon rays return negative elevations matching spherical depression angle $-2.38^\circ$.
3. **Observer in a Pit**: Pit floor at $-2000\text{ m}$ with 10 km crater rim at 0 m. All horizon angles return positive ($+11.1^\circ$), blocking grazing solar rays.
4. **One-Pixel Wall**: 20 m wide spike at 5 km. Radial step $10\text{ m}$ captures the feature with exact angular elevation ($+5.65^\circ$).
5. **Wall at Exact Maximum Range**: Wall placed at $d = \text{max\_range\_m}$ ($25\text{ km}$). Range array includes the boundary sample without clipping.
6. **All-NaN Sector**: Corrupted sector correctly triggers non-zero `nan_fraction`. Disc fraction profile interpolator handles boundary NaNs and classifies as `marginal`.
7. **Thresholds 0.0 and 1.0**: Handled cleanly by mathematical clipping in `disc_fraction_flat` and `classify_status`.
8. **Very Short Date Ranges**: Zero duration correctly rejected with descriptive error; sub-step interval emits single valid timestamp.
9. **Start Equals Goal**: Space-time A* returns a 1-node path of length 0 m and duration 0 h in 0 ms.
10. **Goal Inside Slope-Blocked Region**: Cliff goal ($35^\circ > 15^\circ$) immediately rejected as infeasible with clear explanation.
11. **Route Waiting Through Darkness**: Cell blocked at arrival time $t=1$, sunlit at $t=2$. With wait disabled, traverse is infeasible; with wait enabled, rover waits at $(0, 0)$ and arrives safely at $t=2$.
12. **Grid at Tile Edge**: Raycasting beyond tile boundary flags `"hit_tile_edge"` and records elevated `nan_fraction`.

---

## Part 3: Audit Findings & Recommendations

### Major Advisories

#### [MAJ-01] TypeScript Route Worker Metric Hardcoding & Step Time Discretization
- **File**: `web/src/workers/routeWorker.ts:136-137, 205-208`
- **Issue**:
  1. The worker returns hardcoded static values for traverse metrics:
     ```typescript
     average_slope_deg: 5.0,
     max_slope_deg: 9.5,
     min_sun_frac_observed: 0.7,
     min_earth_frac_observed: 0.9,
     ```
     In contrast, Python `pipeline/routing.py:223-230` computes actual values along the traversed path cells.
  2. The worker hardcodes a 3600-second step duration (`m.d === 0 ? 3600 : ...`), whereas the visibility cube time step may differ (e.g., 30m or 120m).
- **Suggested Fix**:
  Calculate true path metrics in `routeWorker.ts` by iterating over `path` and reading from `cube.slope_deg`, `cube.sun_frac`, and `cube.earth_frac`. Derive step duration dynamically from `cube.time_utc[1]` and `cube.time_utc[0]`.

#### [MAJ-02] Callable Signature Discrepancy in Horizon Raycaster
- **File**: `pipeline/horizon.py:253` vs `pipeline/terrain.py:372`
- **Issue**:
  When a custom terrain function is passed to `horizon_profile`, it calls `terrain(ray_lats, ray_lons)` expecting 2 arguments. However, `NestedTerrain` supports 3-argument distance-aware functions `(dists, lats, lons)`. Passing a 3-argument callable directly to `horizon_profile` raises `TypeError: missing 1 required positional argument: 'lon'`.
- **Suggested Fix**:
  Inspect callable arity or attempt `(ray_lats, ray_lons)` with fallback to `(dist_flat, ray_lats, ray_lons)`.

---

### Minor Advisories

#### [MIN-01] Discrete Sample vs Time-Bin Window Duration Semantics
- **File**: `pipeline/stats.py:88-91`
- **Issue**:
  For an event spanning $N$ consecutive samples, `duration_h` is computed as $N \times \text{step\_h}$, but `start_utc` and `end_utc` correspond to the first and last sample timestamps ($t_0$ and $t_{N-1}$). The difference between the timestamps is $(N - 1) \times \text{step\_h}$.
- **Suggested Fix**:
  Document explicitly that `end_utc` represents the timestamp of the final active sample point, and that window duration accounts for the discrete time bin associated with each sample.

#### [MIN-02] Panorama Canvas 0°/360° Meridian Straddling
- **File**: `web/src/views/Panorama.tsx:281, 298`
- **Issue**:
  When the Sun or Earth disc center is within one angular radius of the $0^\circ / 360^\circ$ boundary, the canvas draws the disc only at `scaleX(az)`. The portion extending past $x = 0$ or $x = \text{width}$ is clipped without a wrapped counterpart on the opposite edge.
- **Suggested Fix**:
  Render an auxiliary duplicate ellipse offset by $\pm \text{width}$ when `x - rx < 0` or `x + rx > width`.

#### [MIN-03] NaN Fallthrough to `STATUS_MARGINAL` in `classify_status`
- **File**: `pipeline/visibility.py:292-298`
- **Issue**:
  When visibility fractions contain NaN (e.g. all-NaN terrain sector), IEEE 754 comparisons (`pess >= threshold`) return False, causing the classifier to drop into `else: statuses.append(STATUS_MARGINAL)`.
- **Suggested Fix**:
  While keeping the schema valid, log a warning or set an explicit provenance flag indicating nodata corruption.

---

## Part 4: Unverified Items (Requires Operational Flight Telemetry)

The following components cannot be fully verified without access to external NASA flight operational systems:
1. **Physical NAIF SPICE SPK Kernels**: `de440.bsp` and planetary constants were verified against JPL Horizons batch ephemeris tables and analytical lunar theories; physical binary kernels were not executed in automated CI.
2. **50 GB+ High-Resolution LOLA GDR DEM Archives**: Verified against synthetic proving ground DEMs conforming to LOLA standards; full-scale polar tiles require offline high-performance compute storage.
3. **DSN Station Horizon Mask Telemetry**: Station coordinates in `configs/dsn_stations.yaml` are correctly flagged `verified: false` and require operational signoff from NASA SCaN/JPL prior to mission flight support.

---

## Summary of Verification Commands & Outputs

```powershell
# 1. Python Code Quality
.venv\Scripts\ruff check .
# Output: All checks passed!

# 2. Python Unit & Adversarial Test Suite
.venv\Scripts\pytest -v tests/
# Output: 106 passed, 3 skipped in 73.12s

# 3. Web Code Quality
npm --prefix web run lint
# Output: eslint src (0 warnings)

# 4. Web Unit & Parity Tests
npm --prefix web test
# Output: 13 passed, 53 passed in 0.77s

# 5. Production Static Build
npm --prefix web run build
# Output: built in 2.01s (tsc + vite)
```
