# LightPath — CLPS Lunar Mission Browser & Space-Time Traverse Planner

**NASA Space Apps Challenge 2026: Commercial Lunar Payload Services (CLPS) Mission Browser**  
*Track: Interactive Lunar Exploration & Trajectory Planning*

[![LightPath CI](https://github.com/AnmolGarg8/LightPath/actions/workflows/ci.yml/badge.svg)](https://github.com/AnmolGarg8/LightPath/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Verification: 100% Core Passing](https://img.shields.io/badge/Verification-106%2F106%20Pytest%20%7C%2053%20Vitest-10b981.svg)](docs/AUDIT.md)

---

## 1. What It Is

**LightPath** is a deterministic, open-source lunar south-pole mission browser and space-time navigation tool. Built for NASA Commercial Lunar Payload Services (CLPS) landing sites and future Artemis surface operations, LightPath evaluates when the Sun and Earth are above the real terrain horizon, models partial disc illumination and occultation, tracks Direct-to-Earth (DTE) Deep Space Network (DSN) ground station contact, and calculates dynamic traversability across moving shadows.

---

## 2. Why It Matters

At the lunar south pole, the Sun hovers within $1.5^\circ$ of the horizon, casting shadows tens of kilometers long that sweep across crater rims at speeds comparable to a lunar rover. Landing just 500 meters off-target, raising an antenna mast by 3 meters, or departing a base two hours later can mean the difference between continuous solar power and a catastrophic, battery-depleting lunar night. LightPath gives mission planners, scientists, students, and the public instant, mathematically rigorous visibility into lunar south-pole lighting and direct communications without requiring specialized astrodynamics toolchains.

---

## 3. How It Works (In Five Sentences)

1. We project high-resolution NASA Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) elevation data onto the Mean Earth/Polar Axis frame (`MOON_ME`, $R = 1,737,400.0\text{ m}$) and raycast great-circle geodesics to compute exact $360^\circ$ terrain horizons for any observer mast height.
2. Topocentric positions and apparent angular radii for the Sun ($0.53^\circ$) and Earth ($1.90^\circ$) are calculated with per-point local zenith vectors that account for lunar surface curvature tilt ($\sim 0.1^\circ/\text{km}$).
3. A 256-point Fibonacci-spiral quadrature integrates the visible illuminated fraction of celestial discs clipped by the irregular terrain skyline.
4. Direct-to-Earth contact is evaluated by intersecting lunar site Earth line of sight with Earth-based NASA Deep Space Network (DSN) stations (Goldstone, Madrid, Canberra) above local station elevation masks.
5. Our signature 4D space-time A* solver navigates across moving shadows and terrain slope hazards to determine whether, when, and how a rover or crew can travel between surface points under continuous light and link.

---

## 4. Key Features

- **360° Real-Time Horizon Panorama**: True-scale Sun and Earth discs clipped interactively by the lunar terrain skyline with keyboard scrubbing (`Space`, `Arrow Keys`).
- **Observer Mast Height Sensitivity**: Compare horizon depression and illumination recovery across mast elevations from $1.0\text{ m}$ to $10.0\text{ m}$.
- **Multi-Lane Contact Timeline**: Simultaneous timeline of solar illumination, Earth line-of-sight, DSN complex handovers, and joint availability windows.
- **Dynamic 4D Space-Time Traverse Planner**: Plan rover routes on a spatial grid across moving shadows with mechanical slope constraints (Horn 1981 method) in under 1 second.
- **Multi-Site Comparative Analysis**: Side-by-side comparison of competing CLPS candidate landing sites (e.g. Shackleton Connecting Ridge, Malapert Mountain, Nobile Rim).
- **One-Page Printable Evidence Card**: Single-page PDF briefing layout with exact geodetic coordinates, kernel manifests, and SHA-256 provenance hashes.
- **Scientific Trust & Verification Suite**: Live dashboard comparing calculations against NASA benchmarks (Barker et al. 2021) and shared Python/TypeScript vectors ($< 10^{-14\circ}$).
- **90-Second Guided Demo & Presenter Mode**: Self-guided judge tour (`?demo=1`), auto-looping kiosk mode (`?kiosk=1`), and projection-ready Presenter Mode (Key `P`).

---

## 5. Quickstart: Clean-Room Reproduction in < 15 Minutes

Follow these exact steps to clone, verify, and run LightPath locally:

### Prerequisites
- **Python 3.10+** (tested on 3.11, 3.12, 3.14)
- **Node.js 18+** & **npm 9+** (tested on Node 20 & 24)
- **Git**

### Step-by-Step Commands

```bash
# 1. Clone the repository
git clone https://github.com/AnmolGarg8/LightPath.git
cd LightPath

# 2. Set up Python environment & run verification tests (~2 minutes)
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
pip install ruff pytest pytest-cov jsonschema numpy scipy pydantic pyyaml matplotlib spiceypy rasterio pyproj
ruff check .
pytest -v

# On macOS / Linux:
source .venv/bin/activate
pip install ruff pytest pytest-cov jsonschema numpy scipy pydantic pyyaml matplotlib spiceypy rasterio pyproj
ruff check .
pytest -v
# Output: 106 passed, 3 skipped (98% test pass rate)

# 3. Set up Web Client & run Vitest shared vector checks (~1 minute)
cd web
npm install
npm run lint
npm test
# Output: 13 test files, 53 tests passed (100% passing)

# 4. Build and preview production application (~1 minute)
npm run build
npm run preview
# Web app will be live at: http://localhost:4173/
```

Open `http://localhost:4173/#/?demo=1` in your browser to launch the automated 90-second judge walkthrough.

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

LightPath enforces **Rule 1: Correctness Before Features**. Calculations are verified against 8 independent verification benchmarks:

| Benchmark | Description | Tolerance | Measured Error | Status |
| :--- | :--- | :---: | :---: | :---: |
| **V1** | Spherical Horizon Dip Angle ($h = 2\text{ m}$) | $\pm 0.005^\circ$ | $0.000^\circ$ | **Pass** |
| **V2** | Ridge Elevation Angle ($100\text{ m}$ at $10\text{ km}$) | $\pm 0.005^\circ$ | $0.000^\circ$ | **Pass** |
| **V3** | Flat-Horizon Disc Area Monotonicity & Symmetry | $\pm 10^{-6}$ | $10^{-15}$ | **Pass** |
| **V4** | Fibonacci Spiral Quadrature Convergence ($N = 256$) | $\le 0.005$ | $0.002$ | **Pass** |
| **V5** | South Pole Cartographic Ortho-Basis Singularity | $\pm 10^{-12}$ | $0.000$ | **Pass** |
| **V6** | Python $\leftrightarrow$ TypeScript Shared Geodesy Vectors | $< 10^{-9\circ}$ | $< 10^{-14\circ}$ | **Pass** |
| **V7** | 12-Case Adversarial Stress Suite | Exact | 12 / 12 passed | **Pass** |
| **V8** | Barker et al. (2021) Horizon Profile Comparison | $\pm 0.10^\circ$ | $0.04^\circ$ | **Pass** |

Full audit details: [`docs/AUDIT.md`](docs/AUDIT.md).

---

## 8. Operational Limitations & Disclaimers

> [!WARNING]
> **LightPath is a preliminary mission planning and educational model.**
> - **Sun visibility is NOT electrical power**: Solar array orientation, incidence angle cos-loss, dust coverage, thermal derating, and battery state-of-charge are excluded.
> - **Earth visibility is NOT a link budget**: Transceiver RF power, antenna gain patterns, terrestrial weather attenuation, and bit error rates are excluded.
> - **Traverse paths are NOT flight-certified**: Small boulders ($< 1\text{ m}$), sub-resolution crevasses, micro-roughness, wheel slip, and mechanical sinkage are excluded.

---

## 9. Credits & NASA Data Sources

- **NASA Lunar Reconnaissance Orbiter (LRO)**: Lunar Orbiter Laser Altimeter (LOLA) Digital Elevation Models provided via the NASA Planetary Data System (PDS).
- **NASA Navigation and Ancillary Information Facility (NAIF)**: SPICE ephemeris toolkit, DE440 planetary ephemeris, and lunar orientation kernels.
- **NASA Jet Propulsion Laboratory (JPL)**: Deep Space Network (DSN) 810-005 telecommunications interface documents.
- **Published Scientific Literature**: Barker, M. K., et al. (2021), *Lunar South Pole Illumination and Horizon Geometry*, Planetary Science Journal.
- *(Human team members complete personal credits, institutional affiliations, and challenge citations in accordance with challenge submission rules)*.

---

## 10. AI Assistance Disclosure

In compliance with NASA Space Apps Challenge regulations, the authors disclose that modern AI coding assistants (including Google Antigravity / Gemini 2.0) were utilized as pair-programming tools for code scaffolding, type generation, unit test creation, and documentation drafting. All scientific formulas, mathematical algorithms, SPICE integration paths, and verification tests were designed, verified, and audited against NASA peer-reviewed publications.

---

## 11. Licence

This project is licensed under the **MIT Licence** — see the [LICENSE](LICENSE) file for details.
