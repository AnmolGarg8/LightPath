# LightPath — CLPS Lunar Mission Browser
**NASA Space Apps Challenge 2026: CLPS Lunar Mission Browser**

LightPath is an open, deterministic planning and educational tool for lunar south-pole Commercial Lunar Payload Services (CLPS) sites. It calculates:
- Exact topocentric terrain horizons using exact lunar spherical curvature (no flat-Moon approximations).
- Partial illuminated disc visibility for the Sun and Earth (including subsolar and sub-Earth libration tracks).
- Direct-To-Earth (DTE) communication availability across NASA Deep Space Network (DSN) ground stations (Goldstone, Madrid, Canberra).
- Sensitivity to observer mast height and landing point offsets.
- **Signature Feature: Motion & Traverse Planning** — Spatio-temporal pathfinding evaluating whether a rover or crew can traverse from point A to point B while illumination and communication links remain continuously available.

> **Operational Notice:** LightPath is a preliminary planning and education tool. Sun visibility is not electrical power. Earth visibility is not a link budget. It is not for flight operations and does not certify landing or traverse safety.

---

## Key Formulas & Physics

1. **Lunar Reference Datum (LOLA)**:
   - Reference sphere radius: $R = 1,737,400.0\text{ m}$.
   - Coordinate Frame: Moon Mean Earth / Polar Axis frame (`MOON_ME`).
   - Terrain sample radius: $R + z$ (from LOLA heights).
   - Observer radius: $R + z_0$, where $z_0 = z_{\text{ground}} + z_{\text{mast}}$.
2. **Exact Spherical Curvature Elevation**:
   - Angular distance along great circle: $\theta = d / R$.
   - Apparent elevation angle:
     $$\text{el} = \text{atan2}((R + z)\cos(\theta) - (R + z_0), (R + z)\sin(\theta))$$
3. **Partial Disc Visibility (Flat & Variable Horizons)**:
   - For center elevation offset $e$ and angular radius $r > 0$:
     $$x = \text{clip}(e / r, -1, 1)$$
     $$\text{fraction} = \frac{\arccos(-x) + x \sqrt{1 - x^2}}{\pi}$$
   - For variable horizons: sampled in sky-angle offsets and integrated numerically.
4. **Surface Slope (Horn 1981 Method)**:
   - Computed from 8-neighbor weighted finite differences at DEM cell spacing.

---

## Repository Layout

```
Lunar/
├── configs/             # Site definitions (CLPS targets: Shackleton, Nobile, Malapert, Synthetic)
├── data/
│   ├── raw/             # Raw LOLA DEMs and ephemerides
│   └── processed/       # Precomputed site horizons, series, cubes, and route results
├── docs/
│   ├── QUESTIONS.md     # Ambiguities, TODOs, and unverified parameters
│   └── CREDITS.md       # Citations and third-party references
├── kernels/             # Lunar ephemeris kernels and orientation data
├── pipeline/            # Core deterministic Python simulation modules
│   ├── constants.py     # Physical constants (R=1737400m, MOON_ME) and statuses
│   ├── geometry.py      # Exact curvature formula, topocentric basis, Horn slope
│   ├── disc.py          # Disc fraction (flat and variable horizon integration)
│   ├── horizon.py       # Horizon profile generation & mast height interpolation
│   ├── ephemeris.py     # Topocentric Sun, Earth, and DSN ground station visibility
│   ├── series.py        # 14-day time series and window statistics (Sun, Earth, DTE, Joint)
│   ├── cube.py          # Spatio-temporal visibility cube generation (T x Y x X)
│   ├── routing.py       # Space-time A* route planner for continuous light & link
│   └── provenance.py    # Auditable provenance records and execution run info
├── schemas/             # JSON schemas validating the data contract
├── scripts/             # Data execution and batch pipeline scripts
│   └── run_pipeline.py  # Simulation pipeline runner
├── tests/               # Pytest suite with 45 comprehensive unit and schema tests
└── web/                 # Strict TypeScript / React browser application
    ├── public/data/     # Static processed JSON datasets
    └── src/             # UI components (Horizon, Timeline, Route Planner, Provenance)
```

---

## Quickstart & How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Python Pipeline & Tests

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   # Windows:
   .\.venv\Scripts\pip install pytest numpy jsonschema
   # Linux / macOS:
   source .venv/bin/activate && pip install pytest numpy jsonschema
   ```

2. Run the test suite:
   ```bash
   # Windows:
   .\.venv\Scripts\pytest -v
   # Linux / macOS:
   pytest -v
   ```
   *Expected output: 45 passed in ~0.5s.*

3. Run the data pipeline to generate all CLPS site datasets:
   ```bash
   python scripts/run_pipeline.py
   ```
   Outputs are validated against `schemas/*.schema.json` and saved to `data/processed/` and `web/public/data/`.

### 2. Web Application

1. Install frontend dependencies and build:
   ```bash
   cd web
   npm install
   npm run build
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

---

## Data Contract

All simulation outputs conform strictly to draft 2020-12 JSON schemas in `schemas/`:
- `site.schema.json`: Site id, coordinates, ground elevation, mission IDs, verified flag, synthetic flag.
- `run_info.schema.json`: Execution metadata, git commit hash, software versions.
- `horizon.schema.json`: Azimuth step, observer mast heights array, 2D elevation grid `el_deg[h][az]`.
- `series.schema.json`: Timestamps, Sun state, Earth state, and DTE ground station visibility.
- `stats.schema.json`: Thresholds, window metrics, uptime fractions, and longest outages.
- `visibility_cube.schema.json`: Grid origin, spacing, time steps, 3D `sun_frac`, 3D `earth_frac`, 2D slopes, traversability map.
- `route_result.schema.json`: Route mode, waypoints `[{x, y, t}]`, duration, distance, slope metrics, explanation.
- `provenance.schema.json`: Complete audit trail of datasets, kernels, parameters, and tolerances.
