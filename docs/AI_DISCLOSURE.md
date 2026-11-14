# AI Usage & Verification Disclosure

## 1. Statement of AI Tools Used

In accordance with the NASA Space Apps Challenge Participant Terms and open science best practices, this repository discloses the use of generative artificial intelligence and agentic coding tools during development.

- **AI Tools Used**: Google DeepMind Antigravity agentic AI coding assistant powered by Gemini models (Google DeepMind).
- **Domains of Assistance**:
  1. **Code Implementation**: Scaffolding, refactoring, and implementing the offline data pipeline (`pipeline/`), configuration validation (`pipeline/config_schema.py`), and TypeScript/React web interface (`web/src/`).
  2. **Test Engineering**: Authoring comprehensive automated test suites (`tests/` and `web/src/__tests__/`), benchmark validation suites (V1 through V6), schema conformance checks, and the automated claims guard.
  3. **Documentation & Traceability**: Structuring technical documentation (`docs/`), dependency license audit tooling (`scripts/make_third_party_licenses.py`), and citation mappings (`docs/CREDITS.md`).

---

## 2. Architectural Integrity & Absence of Runtime AI

To ensure complete scientific rigor and reproducibility, LightPath adheres strictly to **Rule 8 of `docs/PROJECT_RULES.md`**:
> **Rule 8: No machine learning in the core.** Deterministic, reproducible, no network calls at runtime in the web app.

- **Deterministic Celestial Mechanics**: All planetary positions and lunar coordinate transformations are computed deterministically via NAIF SPICE kernels (`kernels/de421.bsp`, `kernels/naif0012.tls`, `kernels/pck00010.tpc`, `kernels/moon_pa_de421_1900-2050.bpc`) and checked against JPL Horizons fixtures.
- **Deterministic Topographic Horizon & Route Solver**: Horizon elevation angles and rover route planning use deterministic geometry (Horn 1981 slope gradient, exact spherical curvature ray-casting, Dijkstra / A* graph traversal on precomputed visibility cubes).
- **No Runtime Generative Models**: No generative AI, language models, or neural networks run inside the pipeline or web client. Every result is 100% reproducible from committed code, configuration files, and raw LOLA DEM rasters.

---

## 3. Human Review and Verification Record

In compliance with NASA Space Apps rules, human team members have reviewed, tested, and validated all agent-generated code, documentation, and scientific formulas.

The placeholders below must be completed by human participants prior to final project submission:

### Reviewer 1: Pipeline & Astrodynamics
- **Name**: `[Human Reviewer 1: Full Name]`
- **Role / Speciality**: `[e.g. Astrodynamics / Backend Lead]`
- **Reviewed Scope**: `[e.g. Verified SPICE DE421 ephemeris implementation in pipeline/ephemeris.py; cross-referenced Sun and Earth vector angles against JPL Horizons fixtures; verified V1-V6 benchmark test results]`
- **Date Verified**: `[YYYY-MM-DD]`

### Reviewer 2: Web Application & Traversal Solver
- **Name**: `[Human Reviewer 2: Full Name]`
- **Role / Speciality**: `[e.g. Web Frontend / Algorithms Lead]`
- **Reviewed Scope**: `[e.g. Verified web/src/ UI components, verified routePlanner and visibility cube decoding in routeWorker.ts, confirmed zero hardcoded headline numbers via automated tests]`
- **Date Verified**: `[YYYY-MM-DD]`

### Reviewer 3: Citations, Licensing & Compliance
- **Name**: `[Human Reviewer 3: Full Name]`
- **Role / Speciality**: `[e.g. Science Communication / Team Lead]`
- **Reviewed Scope**: `[e.g. Audited docs/CREDITS.md and docs/THIRD_PARTY_LICENSES.md against NASA Space Apps terms; confirmed LOLA DOIs (Barker et al. 2023, 2021) and DSN 810-005 citations]`
- **Date Verified**: `[YYYY-MM-DD]`

### Additional Team Members (Optional)
- **Name**: `[Human Reviewer 4: Full Name or N/A]`
- **Reviewed Scope**: `[e.g. Video presentation, slide deck, UI accessibility]`
- **Date Verified**: `[YYYY-MM-DD]`
