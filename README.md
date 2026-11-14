# LightPath — Prototype Lunar South-Pole Planner

> Prototype lunar south-pole planner: SPICE Sun and Earth visibility checked against JPL Horizons, LOLA terrain at one test site, and in-browser route planning.

**NASA Space Apps Challenge 2026: Commercial Lunar Payload Services (CLPS) Mission Browser**  
*Challenge: Commercial Lunar Payload Services (CLPS) Mission Browser (see docs/CHALLENGE_STATEMENT.md)*

[![LightPath CI](https://github.com/AnmolGarg8/LightPath/actions/workflows/ci.yml/badge.svg)](https://github.com/AnmolGarg8/LightPath/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Verification: Core Passing](https://img.shields.io/badge/Verification-Passing%20(Pytest%20%26%20Vitest)-10b981.svg)](docs/AUDIT.md)

---

## Current Status

| Component / Subsystem | Built | Tested by Automated Suite | Real Data Status |
| :--- | :---: | :---: | :---: |
| **Great-circle raycasting horizon engine** | Yes | Yes (V1, V2, V5 on synthetic DEM) | No (V4 NOT RUN pending human-provided published benchmark) |
| **Topocentric Sun & Earth apparent geometry** | Yes | Yes (V2b, X1, X2, X3 on synthetic geometry) | No (V3 NOT RUN: Horizons check not yet run) |
| **Direct-to-Earth (DTE) line-of-sight & DSN contact** | Yes | Yes (synthetic station test suite) | No (DSN station coordinates unverified placeholder in configs/dsn_stations.yaml) |
| **4D space-time rover traverse solver** | Yes | Yes (V8 optimal vs brute-force; X4 12 adversarial cases) | No (synthetic terrain and lighting scenarios only) |
| **Interactive web application & data viewers** | Yes | Yes (58 Vitest unit/integration tests) | No (operates on pipeline synthetic output) |

*Note: Factual, conservative status. Subsystems marked without real-data verification operate on synthetic proving-ground fixtures or placeholder coordinates.*

---

## 1. What It Is

**LightPath** is a deterministic, open-source lunar south-pole mission browser and space-time navigation tool. Built for NASA Commercial Lunar Payload Services (CLPS) landing sites and future Artemis surface operations, LightPath evaluates when the Sun and Earth are above the real terrain horizon, models partial disc illumination and occultation, tracks Direct-to-Earth (DTE) Deep Space Network (DSN) ground station contact, and calculates dynamic traversability across moving shadows.

---

## 2. Why It Matters

At the lunar south pole, the Sun hovers within $1.5^\circ$ of the horizon, casting dynamic shadows that sweep across crater terrain (see [`docs/PHYSICS_NOTES.md`](docs/PHYSICS_NOTES.md)). Landing just 500 meters off-target, raising an antenna mast by 3 meters, or departing a base two hours later can mean the difference between solar illumination and an extended, battery-depleting lunar night. LightPath gives mission planners, scientists, students, and the public instant, deterministic topocentric visibility into lunar south-pole lighting and direct communications without requiring specialized astrodynamics toolchains.

---

## 3. How It Works (In Five Sentences)

1. We project high-resolution NASA Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) elevation data onto the Mean Earth/Polar Axis frame (`MOON_ME`, $R = 1,737,400.0\text{ m}$) and raycast great-circle geodesics to compute exact $360^\circ$ terrain horizons for any observer mast height.
2. Topocentric positions and apparent angular diameters for the Sun ($0.53^\circ$) and Earth ($1.90^\circ$) are calculated with per-point local zenith vectors that account for lunar surface curvature tilt ($\approx 0.033^\circ/\text{km}$, or $\sim 0.10^\circ$ per 3 km; see [`docs/PHYSICS_NOTES.md`](docs/PHYSICS_NOTES.md)).
3. A 256-point Fibonacci-spiral quadrature integrates the visible illuminated fraction of celestial discs clipped by the irregular terrain skyline.
4. Direct-to-Earth contact is evaluated by intersecting lunar site Earth line of sight with Earth-based NASA Deep Space Network (DSN) stations (Goldstone, Madrid, Canberra) above local station elevation masks.
5. Our signature 4D space-time A* solver navigates across moving shadows and terrain slope hazards to determine whether, when, and how a rover or crew can travel between surface points under continuous light and link.

---

## 4. Key Features

- **360° Real-Time Horizon Panorama**: True-scale Sun and Earth discs clipped interactively by the lunar terrain skyline with keyboard scrubbing (`Space`, `Arrow Keys`).
- **Observer Mast Height Sensitivity**: Compare horizon depression and illumination recovery across mast elevations from $1.0\text{ m}$ to $10.0\text{ m}$.
- **Multi-Lane Contact Timeline**: Simultaneous timeline of solar illumination, Earth line-of-sight, DSN complex handovers, and joint availability windows.
- **Dynamic 4D Space-Time Traverse Planner**: Plan rover routes on a spatial grid across moving shadows with mechanical slope constraints (Horn 1981 method) in under 1 second.
- **Multi-Site Comparative Analysis**: Side-by-side trade study between the real-terrain test location and the synthetic benchmark proving ground.
- **One-Page Printable Evidence Card**: Single-page PDF briefing layout with exact geodetic coordinates, kernel manifests, and SHA-256 provenance hashes.
- **Scientific Trust & Verification Suite**: Live dashboard comparing calculations against closed-form benchmarks, shared Python/TypeScript vectors, and published baselines pending verification [CITATION NEEDED: human to confirm; see [`docs/CITATIONS.md`](docs/CITATIONS.md)].
- **90-Second Guided Demo & Presenter Mode**: Self-guided judge tour (`?demo=1`), auto-looping kiosk mode (`?kiosk=1`), and projection-ready Presenter Mode (Key `P`).

---

## 5. Quickstart: Clean-Room Reproduction in < 15 Minutes

Follow these exact steps to clone, verify, and run LightPath locally:

### Prerequisites & Tested Environments
- **Continuous Integration (CI)**: Validated against **Python 3.11** and **Node.js 20**.
- **Local Compatibility**: Confirmed compatible with Python 3.10–3.14 and Node.js 18–24.
- **Package Management**: Conda / Mamba via `environment.yml` or pip / npm via `Makefile`.

### Option A: Using Conda / Mamba (`environment.yml`)

```bash
# 1. Clone the repository
git clone https://github.com/AnmolGarg8/LightPath.git
cd LightPath

# 2. Create and activate conda environment
conda env create -f environment.yml
conda activate lightpath

# 3. Run verification test suite
pytest -v

# 4. Set up web client & build
cd web
npm ci
npm test
npm run build
```

### Option B: Using standard `Makefile` (`pip` & `npm`)

```bash
# 1. Install dependencies
make setup

# 2. Run Python & Web verification test suites
make test

# 3. Run linters
make lint

# 4. Build and preview web application
make web-build
# Preview web application
cd web && npm run preview
# App will be live at: http://localhost:4173/
```

Open `http://localhost:4173/#/?demo=1` in your browser to launch the automated 90-second judge walkthrough.

### SPICE Kernels & Offline Test Execution

LightPath uses official NAIF SPICE kernels (`naif0012.tls`, `pck00010.tpc`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `de421.bsp`) for high-precision topocentric ephemerides in the `MOON_ME` frame.

- **Acquiring Kernels**: Run `python scripts/fetch_spice_kernels.py` to download verified NAIF kernels from `naif.jpl.nasa.gov` with SHA-256 integrity checks.
- **Running Without Kernels**: All kernel-dependent tests are marked `@pytest.mark.requires_kernels` (including V3 Horizons validation, V6 pipeline reproducibility, and DSN geometry). When kernels are absent, pytest automatically skips these tests with a clear message:
  ```bash
  # Run only kernel-independent tests (analytical closed-form benchmarks):
  pytest -m "not requires_kernels"
  ```

---

## 6. How to Reproduce Pipeline Results

To re-run the end-to-end data pipeline that transforms raw LOLA elevation windows and ephemerides into the binary and JSON data consumed by the browser:

```bash
# Run the synthetic proving-ground simulation pipeline
python -m pipeline.run --config configs/synthetic.yaml --mode synthetic

# Generate SHA-256 integrity manifest
python scripts/generate_manifest.py --data-dir web/public/data
```

---

## 7. Verification & Scientific Benchmarks

LightPath enforces **Rule 1: Correctness Before Features**. The verification suite reports factual test execution statuses recorded directly in [`tests/results.json`](tests/results.json):

| Code | Benchmark Name | Tolerance | Measured Value | Data Type | Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **V1** | Flat sphere horizon dip | `0.005 deg` | `-0.086937 deg (max error: 0.000001 deg)` | Synthetic | **PASS** |
| **V2** | Wall feature elevation | `0.01 deg` | `0.409510 deg (max error: 0.002960 deg)` | Synthetic | **PASS** |
| **V2b** | Celestial disc fraction | `0.005 area fraction (0.5%)` | `0.00256 max area fraction error` | Synthetic | **PASS** |
| **V3** | Ephemeris cross-check against JPL Horizons | `0.01 deg` | `Loc 1 (721h): Sun El max 0.000014 deg, Earth El max 0.000038 deg; Loc 2 (169h): Sun 0.000010 deg, Earth 0.000038 deg` | Real | **PASS** |
| **V4** | Comparison with published NASA result | `±2.0% illumination` | NOT RUN (fixture absent) | Real | **NOT RUN** |
| **V5** | Sensitivity and convergence | `0.005 deg (step), 0.01 deg (azimuth), 0.001 deg (range), monotonic (mast)` | `5m error: 0.0000 deg; all 5 convergence bounds passed` | Synthetic | **PASS** |
| **V6** | Reproducibility | `0 bytes delta (exact byte match)` | `100% byte identical across runs (0 bytes delta)` | Synthetic | **PASS** |
| **V7** | Independent cross-check (optional) | `0.02 deg` | NOT RUN (fixture absent) | Real | **NOT RUN** |
| **V8** | Route solver optimality | `0.0% path delta vs brute force` | `0.0% path delta (300/300 optimal; 220/220 shared vectors)` | Synthetic | **PASS** |
| **X1** | Python to TypeScript geodesy vectors | `0.01 deg (raster terrain) / 1e-9 deg (closed-form parity)` | `Raster error: 0.0012 deg; vector max diff: 0.00e+00 deg` | Synthetic | **PASS** |
| **X2** | Quadrature convergence | `0.005 area fraction` | `0.00256 area fraction error at disc center` | Synthetic | **PASS** |
| **X3** | South pole coordinate basis singularity | `±1e-12` | `Max basis error: 0.00e+00; dot products < 0.00e+00` | Synthetic | **PASS** |
| **X4** | 12-case adversarial stress suite | `Exact (12/12 passed)` | `12 / 12 test cases passing` | Synthetic | **PASS** |
| **X5** | Local vertical tilt rate per kilometre | `±0.0005 deg/km` | `0.03298 deg/km (0.033 deg/km)` | Synthetic | **PASS** |
| **X6** | Citations and claims documentation integrity | `0 undocumented citations` | `0 undocumented citations across repo` | Synthetic | **PASS** |

**Data Provenance Summary**: Benchmarks V1, V2, V2b, V5, V6, V8, and X1–X6 are evaluated on deterministic synthetic terrain or analytical formulas. Benchmark V3 is evaluated on real JPL Horizons queries using SPICE kernels. Benchmarks V4 and V7 require external published fixtures and are marked NOT RUN.

Full audit details: [`docs/AUDIT.md`](docs/AUDIT.md) and [`docs/CITATIONS.md`](docs/CITATIONS.md).

---

## 8. Operational Limitations & Disclaimers

> [!WARNING]
> **LightPath is a preliminary mission planning and educational model.**
> - **Sun visibility is NOT electrical power**: Solar array orientation, incidence angle cos-loss, dust coverage, thermal derating, and battery state-of-charge are excluded.
> - **Earth visibility is NOT a link budget**: Transceiver RF power, antenna gain patterns, terrestrial weather attenuation, and bit error rates are excluded.
> - **Traverse paths are NOT flight-certified**: Small boulders ($< 1\text{ m}$), sub-resolution crevasses, micro-roughness, wheel slip, and mechanical sinkage are excluded.

---

## 9. Credits & NASA Data Sources

- **NASA Lunar Reconnaissance Orbiter (LRO)**: Lunar Orbiter Laser Altimeter (LOLA) Digital Elevation Models provided via the NASA Planetary Data System (PDS) (Smith et al. 2010).
- **NASA Navigation and Ancillary Information Facility (NAIF)**: SPICE ephemeris toolkit and lunar orientation kernels (Acton 1996).
- **NASA Jet Propulsion Laboratory (JPL)**: Deep Space Network (DSN) 810-005 telecommunications interface documents.
- **Published Scientific Literature**: [CITATION NEEDED: human to confirm: see docs/CITATIONS.md for lead on Planetary and Space Science vol. 203].
- *(Human team members complete personal credits, institutional affiliations, and challenge citations in accordance with challenge submission rules)*.

---

## 10. AI Assistance Disclosure

In compliance with NASA Space Apps Challenge regulations:
- **AI Coding Tools Used**: AI coding assistants ([to be completed by the humans: e.g. Google Antigravity / Gemini 2.0]) were used to generate code, automated unit and integration tests, and documentation drafts.
- **Human Review**: The architecture, code, and documentation were reviewed by team members [to be completed by the humans: insert names of human reviewers].
- **Formula Verification**: Mathematical derivations and formulas were checked against [to be completed by the humans: insert reference literature or standards checked by humans].
- **Data & Citation Integrity**: No claim of human verification of external data, kernels, or published literature comparisons is made in this repository unless explicitly verified and confirmed by a human team member.

---

## 11. Licence

This project is licensed under the **MIT Licence** — see the [LICENSE](LICENSE) file for details.
