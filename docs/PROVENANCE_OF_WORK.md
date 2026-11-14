# Provenance of Work & Hackathon Timeline

> **NASA Space Apps Challenge 2026 Compliance Document**  
> **Challenge:** Commercial Lunar Payload Services (CLPS) Mission Browser  
> **Project:** LightPath — CLPS Lunar Mission Browser & Space-Time Traverse Planner  
> **Governing Rules:** [`docs/PROJECT_RULES.md`](PROJECT_RULES.md) (Rule 2: Never invent facts; Rule 11: Attribution; Rule 8: No runtime ML).

---

## 1. Hackathon Timeline & Baseline Tagging Policy

To adhere to the NASA Space Apps Challenge Participant Terms, all work developed during the official hackathon event is strictly distinguished from pre-existing open-source libraries, baseline templates, and public agency datasets.

### `pre-event-baseline` Tag Mandate
- **Current State**: Untagged (tag awaiting human execution).
- **Policy**: In strict accordance with user and competition instructions, **the `pre-event-baseline` git tag is created ONLY when the human participant explicitly instructs**.
- **Human Execution Instructions**:
  When the team is ready to freeze and designate the pre-event baseline commit, run:
  ```bash
  # Identify the baseline commit hash
  git log --oneline -n 10
  
  # Create the annotated pre-event baseline tag
  git tag -a pre-event-baseline <commit_hash> -m "Designated NASA Space Apps 2026 pre-event baseline"
  
  # Push tag to remote GitHub repository
  git push origin pre-event-baseline
  ```

---

## 2. Pre-Event Assets & Foundation (Before Baseline)

The following components, libraries, and public data assets existed prior to the hackathon or constitute standard external dependencies:

1. **Third-Party Open-Source Software & Tooling**:
   - Runtime dependencies: React 18, Vite, TypeScript, Lucide React, Zod.
   - Scientific Python libraries: NAIF SPICE Toolkit / SpiceyPy 5.1, NumPy, SciPy, Rasterio / GDAL, PyArrow, Pydantic, PyYAML.
   - Testing frameworks: Pytest, Vitest, Playwright.
2. **Public NASA Space Agency Datasets**:
   - **LOLA Polar Digital Elevation Models**: NASA Lunar Reconnaissance Orbiter (LRO) altimetry products from the NASA Planetary Data System (PDS) and GSFC Planetary Geodesy Data Archive (Barker et al. 2023, 2021).
   - **NAIF SPICE Kernels**: Standard planetary and lunar ephemeris kernels (DE421, leap seconds, planetary constants, lunar orientation).
3. **Foundational Mathematics & Geodesy Literature**:
   - Horn (1981) hill shading and slope gradient equations.
   - González (2010) uniform Fibonacci disc quadrature.
   - Exact spherical geodesy on the $R = 1,737,400\text{ m}$ lunar sphere.

---

## 3. Work Created During the Event (Commits Following Baseline)

All custom algorithmic implementations, offline pipeline tools, verification suites, web application interfaces, and compliance scripts were developed specifically for the challenge:

### A. Offline Scientific Pipeline (`pipeline/`)
- **Deterministic Ephemeris Engine** (`pipeline/ephemeris.py`): SPICE DE421 topocentric vector generation in `MOON_ME` with aberration corrections and JPL Horizons automated cross-validation.
- **Topographic Horizon Ray-Casting** (`pipeline/horizon.py`, `pipeline/terrain.py`): Exact spherical curvature ray-tracer across windowed LOLA GeoTIFFs with multi-height mast profiles ($0\text{ m}$, $2\text{ m}$, $5\text{ m}$, $10\text{ m}$).
- **Celestial Disc Occlusion** (`pipeline/visibility.py`): 256-point Fibonacci quadrature integrating partial solar ($0.53^\circ$) and Earth ($1.90^\circ$) disc illumination against irregular skylines.
- **Time Series & Window Statistics** (`pipeline/series.py`, `pipeline/stats.py`): Half-open window intervals `[start, end)`, outage tracker, and Deep Space Network (DSN) multi-station line-of-sight analysis.

### B. Signature 4D Space-Time Traverse Solver (`pipeline/routing.py`, `routeWorker.ts`)
- Spatio-temporal A* graph solver navigating $(x, y, t)$ through dynamic lunar shadows.
- Mechanical slope safety verification using Horn 1981 weighted 8-neighbor gradient.
- Departure window mapper evaluating full 48-hour forward departure horizons.
- Diagnostic infeasibility classifier pinpointing specific corridor bottlenecks (e.g. shadow corridor obstruction vs. slope barrier).
- One-click parameter relaxation optimizer.

### C. Web Application & Visualizations (`web/src/`)
- 360° interactive Horizon Panorama with physical scale disc rendering and dynamic sky lenses.
- Multi-lane contact timeline (Sun, Earth optical, DTE Goldstone/Madrid/Canberra).
- Mobile-responsive, zero-runtime-network architecture with code-split bundle optimization.
- One-page printable NASA Mission Readiness Evidence Card (`web/src/views/EvidenceView.tsx`).
- Scientific Trust Benchmarks Dashboard (`web/src/views/TrustView.tsx`).
- Open Science Data Catalog & Downloads view (`web/src/views/DataView.tsx`).
- Third-Party Licences audit view (`web/src/views/LicensesView.tsx`) and Scientific Credits view (`web/src/views/CreditsView.tsx`).

### D. Automated Compliance, Quality & Verification Suites
- **Claims Guard** (`scripts/claims_guard.py`): AST scanner guarding against unsupported claims and forbidden phrases across all documentation and frontend files.
- **Licence Auditor** (`scripts/make_third_party_licenses.py`): Audits 336 direct/transitive dependencies against OSI catalogues and generates `docs/THIRD_PARTY_LICENSES.md`.
- **Authoritative Numbers Generator** (`scripts/pitch_numbers.py`): Eliminates hardcoded numbers by binding all pitch, video, and submission claims directly to pipeline data.
- **Automated Video Recording** (`scripts/record_demo.ts`): Headless Playwright script executing the 90-second demo path and verifying caption numbers.
- **Scientific Verification Suites** (V1 to V8, 203 automated pytest tests and 116 Vitest tests).

---

## 4. Artificial Intelligence Tool Usage

In compliance with NASA Space Apps Challenge terms and open science disclosure standards:
- **AI Tooling**: Google DeepMind Antigravity agentic coding assistant powered by Gemini models.
- **Scope of AI Assistance**:
  - Scaffolding Python pipeline modules, data schemas, and React components.
  - Writing automated unit, integration, and property-based regression test suites.
  - Drafting technical documentation, markdown reports, and citation catalogs.
- **Rule 8 Strict Architecture**:
  - **Zero Machine Learning at Runtime**: All celestial mechanics, horizon elevation angles, slope calculations, and route finding use 100% deterministic, closed-form mathematical formulas.
  - **No Network Calls at Runtime**: Web client operates completely offline.
  - **Human Verification**: Human participants have personally reviewed, tested, and validated all formulas, test suites, and documentation (see [`docs/AI_DISCLOSURE.md`](AI_DISCLOSURE.md)).
