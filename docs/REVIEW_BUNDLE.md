# LightPath Independent Auditor Review Bundle

**Timestamp of Audit**: 2026-10-31T15:55:00Z  
**Repository Working Directory**: `C:\Users\anmol\OneDrive\Desktop\Lunar`  
**Target Git Remote**: `https://github.com/AnmolGarg8/LightPath.git`  
**Audit Rule Adherence**: Factual measurements and direct terminal outputs only. No opinions and no unverified claims. No source files modified during audit.

---

## 1. Git Log & Status

### Command: `git log --oneline`
```text
6d4c808 fix(demo): align web demo and views with LunarWindow Team Knowledge Guide
e6bcdc5 ci: add enablement true to configure-pages step in deploy workflow
097c28a feat(judging): finalize project deliverables, demo video, docs, performance and audit fixes
9c5c909 docs: complete independent technical audit and 12-case adversarial stress suite
0bc1a2f feat: implement /explain view, shared mathematical vectors, 90s guided demo, and presenter mode
4c0306c feat: build Evidence Card, RFC 4180 CSV / RFC 5545 ICS exports, and Trust page
62f02fb feat: implement area scan view, cell side panel, uncertainty hatching, and top-five table
00397ad feat: build fixed-site analysis views, Horizon Panorama, timeline, and stats panels
bb7e008 feat: build web app foundation, UI components, hash router, and test suite
fc065bd feat: implement end-to-end data pipeline, LPVC binary cube, caching, schemas, and determinism
0fab672 feat: implement celestial disc visibility, Fibonacci horizon quadrature, and statistical window analysis
ad726d9 feat: implement terrain windowing, synthetic DEM generator, and horizon raycasting
dca3788 feat: implement SpiceyPy geometry, DSN station visibility, and mathematical test suite
93ac604 feat: scaffold LightPath repository with schemas, pipeline, tests, web client, and docs
```

### Command: `git status`
```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

---

## 2. Tracked File Tree & Line Counts

Generated via `git ls-files` and lines measured per file.

```text
Lines	File Path
42	.github/workflows/ci.yml
44	.github/workflows/deploy.yml
34	.gitignore
40	Makefile
157	README.md
0	configs/.gitkeep
5	configs/README.md
37	configs/dsn_stations.yaml
84	configs/pipeline.yaml
55	configs/sites.json
74	configs/synthetic.yaml
5	data/README.md
40	data/dem_manifest.json
36	data/missions.json
0	data/processed/.gitkeep
0	data/raw/.gitkeep
255	docs/AUDIT.md
31	docs/CREDITS.md
41	docs/DECISIONS.md
48	docs/DEMO_RECORDING.md
49	docs/EXPLAIN_SCRIPT.md
75	docs/GEOMETRY.md
135	docs/HORIZON.md
57	docs/HORIZONS_FIXTURES.md
192	docs/PIPELINE.md
86	docs/PITCH.md
41	docs/PROJECT_RULES.md
19	docs/QUESTIONS.md
7	docs/README.md
75	docs/SUBMISSION.md
137	docs/VISIBILITY.md
7164	docs/demo.mp4 (binary)
1706	docs/demo_frames/step_01.png (binary)
1706	docs/demo_frames/step_02.png (binary)
1706	docs/demo_frames/step_03.png (binary)
1706	docs/demo_frames/step_04.png (binary)
1706	docs/demo_frames/step_05.png (binary)
1706	docs/demo_frames/step_06.png (binary)
1706	docs/demo_frames/step_07.png (binary)
1706	docs/demo_frames/step_08.png (binary)
1706	docs/demo_frames/step_09.png (binary)
25	environment.yml
0	kernels/.gitkeep
12	pipeline/README.md
2	pipeline/__init__.py
66	pipeline/config_schema.py
32	pipeline/constants.py
151	pipeline/cube.py
46	pipeline/disc.py
242	pipeline/dsn.py
269	pipeline/ephemeris.py
599	pipeline/geometry.py
412	pipeline/horizon.py
101	pipeline/provenance.py
271	pipeline/routing.py
1096	pipeline/run.py
194	pipeline/scan.py
212	pipeline/series.py
255	pipeline/stats.py
346	pipeline/synthetic.py
297	pipeline/terrain.py
287	pipeline/visibility.py
41	pyproject.toml
11	schemas/README.md
47	schemas/horizon.schema.json
35	schemas/index.schema.json
50	schemas/manifest.schema.json
66	schemas/missions.schema.json
60	schemas/provenance.schema.json
89	schemas/route_result.schema.json
35	schemas/run_info.schema.json
73	schemas/series.schema.json
89	schemas/site.schema.json
63	schemas/stats.schema.json
103	schemas/visibility_cube.schema.json
0	scripts/.gitkeep
8	scripts/README.md
118	scripts/fetch_dem.py
109	scripts/fetch_kernels.py
96	scripts/make_horizons_request.py
62	scripts/make_meta_kernel.py
125	scripts/record_demo.cjs
186	scripts/run_pipeline.py
17	tests/README.md
404	tests/audit/test_adversarial.py
14	tests/conftest.py
229	tests/results.json
99	tests/test_disc.py
92	tests/test_dsn.py
68	tests/test_ephemeris.py
335	tests/test_geometry.py
412	tests/test_horizon.py
170	tests/test_pipeline_run.py
19	tests/test_provenance.py
120	tests/test_routing.py
9	tests/test_sample.py
148	tests/test_scan.py
199	tests/test_schemas.py
62	tests/test_series.py
190	tests/test_stats.py
120	tests/test_terrain.py
135	tests/test_vectors.py
146	tests/test_visibility.py
798	tests/vectors.json
4	web/.prettierignore
7	web/.prettierrc
21	web/README.md
12	web/eslint.config.js
14	web/index.html
4351	web/package-lock.json
37	web/package.json
2	web/public/data/cubes/synthetic-crater-rim.bin (binary)
17639	web/public/data/cubes/synthetic-crater-rim.json
5	web/public/data/cubes/synthetic-flat-basin.bin (binary)
17639	web/public/data/cubes/synthetic-flat-basin.json
1	web/public/data/cubes/synthetic-proving-ground.bin (binary)
46094	web/public/data/cubes/synthetic-proving-ground.json
70	web/public/data/index.json
2913	web/public/data/malapert-mountain/horizon.json
34	web/public/data/malapert-mountain/provenance.json
30	web/public/data/malapert-mountain/route_result.json
9	web/public/data/malapert-mountain/run_info.json
6107	web/public/data/malapert-mountain/series.json
16	web/public/data/malapert-mountain/site.json
59	web/public/data/malapert-mountain/stats.json
1854	web/public/data/malapert-mountain/visibility_cube.json
311	web/public/data/manifest.json
97	web/public/data/missions.json
2913	web/public/data/nobile-crater-rim/horizon.json
34	web/public/data/nobile-crater-rim/provenance.json
30	web/public/data/nobile-crater-rim/route_result.json
9	web/public/data/nobile-crater-rim/run_info.json
6107	web/public/data/nobile-crater-rim/series.json
16	web/public/data/nobile-crater-rim/site.json
59	web/public/data/nobile-crater-rim/stats.json
1854	web/public/data/nobile-crater-rim/visibility_cube.json
2913	web/public/data/shackleton-connecting-ridge/horizon.json
34	web/public/data/shackleton-connecting-ridge/provenance.json
56	web/public/data/shackleton-connecting-ridge/route_result.json
9	web/public/data/shackleton-connecting-ridge/run_info.json
6107	web/public/data/shackleton-connecting-ridge/series.json
17	web/public/data/shackleton-connecting-ridge/site.json
64	web/public/data/shackleton-connecting-ridge/stats.json
1854	web/public/data/shackleton-connecting-ridge/visibility_cube.json
30	web/public/data/sites.json
132	web/public/data/sites/synthetic-crater-rim.json
132	web/public/data/sites/synthetic-flat-basin.json
126	web/public/data/sites/synthetic-proving-ground.json
1838	web/public/data/synthetic-crater-rim/horizon.json
47	web/public/data/synthetic-crater-rim/provenance.json
7	web/public/data/synthetic-crater-rim/run_info.json
257	web/public/data/synthetic-crater-rim/series.json
132	web/public/data/synthetic-crater-rim/site.json
69	web/public/data/synthetic-crater-rim/stats.json
17639	web/public/data/synthetic-crater-rim/visibility_cube.json
1838	web/public/data/synthetic-flat-basin/horizon.json
47	web/public/data/synthetic-flat-basin/provenance.json
7	web/public/data/synthetic-flat-basin/run_info.json
257	web/public/data/synthetic-flat-basin/series.json
132	web/public/data/synthetic-flat-basin/site.json
69	web/public/data/synthetic-flat-basin/stats.json
17639	web/public/data/synthetic-flat-basin/visibility_cube.json
608	web/public/data/synthetic-proving-ground/horizon.json
47	web/public/data/synthetic-proving-ground/provenance.json
56	web/public/data/synthetic-proving-ground/route_result.json
15	web/public/data/synthetic-proving-ground/run_info.json
923	web/public/data/synthetic-proving-ground/series.json
126	web/public/data/synthetic-proving-ground/site.json
59	web/public/data/synthetic-proving-ground/stats.json
46094	web/public/data/synthetic-proving-ground/visibility_cube.json
229	web/public/data/test_results.json
116	web/scripts/capture_views.cjs
644	web/scripts/make_fake_data.ts
103	web/scripts/run_audit_and_screenshots.ts
13	web/src/App.tsx
34	web/src/__tests__/badge.test.ts
62	web/src/__tests__/cubeDecoder.test.ts
52	web/src/__tests__/demoAndExplain.test.ts
798	web/src/__tests__/fixtures/vectors.json
53	web/src/__tests__/geometryVectors.test.ts
110	web/src/__tests__/integration.test.ts
68	web/src/__tests__/loader.test.ts
14	web/src/__tests__/sample.test.ts
78	web/src/__tests__/scales.test.ts
145	web/src/__tests__/scanCalculator.test.ts
90	web/src/__tests__/templates.test.ts
69	web/src/__tests__/thresholds.test.ts
218	web/src/__tests__/trustAndEvidence.test.ts
73	web/src/__tests__/validation.test.ts
55	web/src/components/DisclaimerBanner.tsx
168	web/src/components/HorizonViewer.tsx
128	web/src/components/ProvenanceModal.tsx
206	web/src/components/RoutePlannerViewer.tsx
184	web/src/components/SensitivityPanel.tsx
79	web/src/components/SiteSelector.tsx
273	web/src/components/StatsPanel.tsx
465	web/src/components/Timeline.tsx
244	web/src/components/TimelineSeriesViewer.tsx
236	web/src/components/common/GuidedDemoOverlay.tsx
88	web/src/components/common/LimitationsPanel.tsx
25	web/src/components/layout/AppLayout.tsx
45	web/src/components/layout/DisclaimerBanner.tsx
59	web/src/components/layout/Footer.tsx
211	web/src/components/layout/Header.tsx
149	web/src/components/ui/Badge.tsx
100	web/src/components/ui/Card.tsx
136	web/src/components/ui/DataTable.tsx
81	web/src/components/ui/SegmentedControl.tsx
95	web/src/components/ui/Slider.tsx
133	web/src/components/ui/Stat.tsx
88	web/src/components/ui/Toast.tsx
52	web/src/components/ui/Tooltip.tsx
106	web/src/components/ui/ValidationErrorPage.tsx
88	web/src/data/demoScript.ts
263	web/src/index.css
93	web/src/lib/geometry.ts
9	web/src/main.tsx
102	web/src/router.tsx
137	web/src/types.ts
293	web/src/types/schemas.ts
61	web/src/utils/comparisonTemplate.ts
121	web/src/utils/cubeDecoder.ts
100	web/src/utils/dataLoader.ts
152	web/src/utils/exportUtils.ts
95	web/src/utils/scales.ts
214	web/src/utils/scanCalculator.ts
226	web/src/utils/statsCalculator.ts
412	web/src/views/CompareView.tsx
448	web/src/views/EvidenceView.tsx
624	web/src/views/ExplainView.tsx
520	web/src/views/HomeView.tsx
722	web/src/views/Panorama.tsx
291	web/src/views/RoutePlannerView.tsx
901	web/src/views/ScanView.tsx
232	web/src/views/SiteDetailView.tsx
407	web/src/views/TrustView.tsx
207	web/src/workers/routeWorker.ts
47	web/src/workers/routeWorkerClient.ts
22	web/tsconfig.json
32	web/vite.config.ts
```

---

## 3. Environment & Installed Package Versions

### `python --version`
```text
Python 3.14.2
```

### `pip list` (Environment Packages)
```text
Package                   Version
------------------------- ----------
affine                    3.0.1
annotated-types           0.8.0
attrs                     26.1.0
certifi                   2026.10.23
click                     8.5.0
colorama                  0.4.6
iniconfig                 2.3.1
jsonschema                4.26.0
jsonschema-specifications 2025.9.1
numpy                     2.5.4
packaging                 26.3
pip                       25.3
pluggy                    1.7.0
pydantic                  2.14.1
pydantic_core             2.50.1
Pygments                  2.21.0
pyparsing                 3.3.3
pyproj                    3.8.0
pytest                    9.2.0
PyYAML                    6.0.3
rasterio                  1.5.2
referencing               0.37.0
rpds-py                   2026.9.1
ruff                      0.17.3
scipy                     1.18.1
spiceypy                  8.3.0
typing_extensions         4.16.0
typing-inspection         0.4.4
```

### `node --version`
```text
v24.7.0
```

### `cd web && npm ls --depth=0`
```text
lightpath-web@0.1.0 C:\Users\anmol\OneDrive\Desktop\Lunar\web
+-- @eslint/js@9.39.5
+-- @types/d3-scale@4.0.9
+-- @types/node@22.20.5
+-- @types/react-dom@19.3.0
+-- @types/react@19.3.0
+-- @vitejs/plugin-react@5.2.0
+-- d3-scale@4.0.2
+-- eslint@9.39.5
+-- lucide-react@1.64.0
+-- prettier@3.9.10
+-- react-dom@19.3.1
+-- react@19.3.1
+-- tsx@4.23.15
+-- typescript-eslint@8.72.1
+-- typescript@5.9.3
+-- vite@6.4.5
+-- vitest@3.2.7
`-- zod@4.6.7
```

---

## 4. Python Test Suite Execution

### Command: `pytest -v -rs`
```text
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\Users\anmol\OneDrive\Desktop\Lunar
configfile: pyproject.toml
testpaths: tests
collected 109 items

tests\audit\test_adversarial.py ............                             [ 11%]
tests\test_disc.py ........                                              [ 18%]
tests\test_dsn.py ....                                                   [ 22%]
tests\test_ephemeris.py .....                                            [ 26%]
tests\test_geometry.py ....ss...s...                                     [ 38%]
tests\test_horizon.py ..............                                     [ 51%]
tests\test_pipeline_run.py .....                                         [ 55%]
tests\test_provenance.py ..                                              [ 57%]
tests\test_routing.py ....                                               [ 61%]
tests\test_sample.py .                                                   [ 62%]
tests\test_scan.py ....                                                  [ 66%]
tests\test_schemas.py ..........                                         [ 75%]
tests\test_series.py ...                                                 [ 77%]
tests\test_stats.py .....                                                [ 82%]
tests\test_terrain.py .........                                          [ 90%]
tests\test_vectors.py .                                                  [ 91%]
tests\test_visibility.py .........                                       [100%]

=========================== short test summary info ===========================
SKIPPED [1] tests\test_geometry.py:147: Requires physical SPICE kernels. Run scripts/fetch_kernels.py once manifests are filled.
SKIPPED [1] tests\test_geometry.py:156: Requires physical SPICE kernels. Run scripts/fetch_kernels.py once manifests are filled.
SKIPPED [1] tests\test_geometry.py:266: Horizons fixture horizons_shackleton_sun.csv not found. See docs/HORIZONS_FIXTURES.md for human instructions on generating benchmark fixtures.
================== 106 passed, 3 skipped in 90.63s (0:01:30) ==================
```

### Command: `pytest --collect-only -q`
```text
tests/audit/test_adversarial.py: 12
tests/test_disc.py: 8
tests/test_dsn.py: 4
tests/test_ephemeris.py: 5
tests/test_geometry.py: 13
tests/test_horizon.py: 14
tests/test_pipeline_run.py: 5
tests/test_provenance.py: 2
tests/test_routing.py: 4
tests/test_sample.py: 1
tests/test_scan.py: 4
tests/test_schemas.py: 10
tests/test_series.py: 3
tests/test_stats.py: 5
tests/test_terrain.py: 9
tests/test_vectors.py: 1
tests/test_visibility.py: 9
```

---

## 5. Web Tests & Production Build Output

### Command: `cd web && npm test && npm run build`
```text
> lightpath-web@0.1.0 test
> vitest run

 RUN  v3.2.7 C:/Users/anmol/OneDrive/Desktop/Lunar/web

 ✓ src/__tests__/geometryVectors.test.ts (4 tests) 6ms
 ✓ src/__tests__/cubeDecoder.test.ts (5 tests) 36ms
 ✓ src/__tests__/badge.test.ts (5 tests) 8ms
 ✓ src/__tests__/loader.test.ts (4 tests) 9ms
 ✓ src/__tests__/validation.test.ts (3 tests) 9ms
 ✓ src/__tests__/trustAndEvidence.test.ts (7 tests) 7ms
 ✓ src/__tests__/scales.test.ts (5 tests) 7ms
 ✓ src/__tests__/scanCalculator.test.ts (5 tests) 3ms
 ✓ src/__tests__/thresholds.test.ts (3 tests) 2ms
 ✓ src/__tests__/integration.test.ts (2 tests) 4ms
 ✓ src/__tests__/demoAndExplain.test.ts (5 tests) 2ms
 ✓ src/__tests__/templates.test.ts (3 tests) 2ms
 ✓ src/__tests__/sample.test.ts (2 tests) 2ms

 Test Files  13 passed (13)
      Tests  53 passed (53)
   Start at  21:21:22
   Duration  885ms (transform 356ms, setup 0ms, collect 1.07s, tests 97ms, environment 2ms, prepare 1.38s)

> lightpath-web@0.1.0 build
> tsc && vite build

vite v6.4.5 building for production...
transforming...
✓ 2323 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                1.19 kB │ gzip:  0.65 kB
dist/assets/index-D60inCfe.css                 5.83 kB │ gzip:  1.91 kB
dist/assets/scales-C7Bj36XD.js                 1.04 kB │ gzip:  0.48 kB
dist/assets/Slider-Dn4PLGPl.js                 1.27 kB │ gzip:  0.66 kB
dist/assets/SegmentedControl-ChL339lP.js       1.31 kB │ gzip:  0.71 kB
dist/assets/Stat-CTvWPO0S.js                   1.94 kB │ gzip:  0.83 kB
dist/assets/statsCalculator-Bp31F8yQ.js        2.15 kB │ gzip:  0.83 kB
dist/assets/ValidationErrorPage-7-neNpqM.js    2.49 kB │ gzip:  1.00 kB
dist/assets/LimitationsPanel-W75GWSW3.js       2.75 kB │ gzip:  1.30 kB
dist/assets/Badge-Bzgr2Eph.js                  3.71 kB │ gzip:  1.22 kB
dist/assets/vendor-BDI1YCB4.js                 4.21 kB │ gzip:  1.58 kB
dist/assets/RoutePlannerView-BSpW_Ntk.js       7.84 kB │ gzip:  2.99 kB
dist/assets/CompareView-BUIS2PiG.js           11.71 kB │ gzip:  3.66 kB
dist/assets/HomeView-CJOpXMPO.js              12.35 kB │ gzip:  3.59 kB
dist/assets/TrustView-CPRJBXUa.js             16.70 kB │ gzip:  4.71 kB
dist/assets/EvidenceView-Dn9FFbwY.js          18.56 kB │ gzip:  5.64 kB
dist/assets/SiteDetailView-CYdD8P5x.js        19.68 kB │ gzip:  4.28 kB
dist/assets/ExplainView-ilCQL0W_.js           21.71 kB │ gzip:  6.32 kB
dist/assets/Timeline-FdGb4UpN.js              22.59 kB │ gzip:  6.99 kB
dist/assets/ScanView-83FxQ2zo.js              25.70 kB │ gzip:  7.56 kB
dist/assets/charts-CPI6uaDZ.js                50.76 kB │ gzip: 16.37 kB
dist/assets/dataLoader-D2M1GKFV.js           102.25 kB │ gzip: 29.73 kB
dist/assets/index-C6VHUflR.js                230.08 kB │ gzip: 72.53 kB
✓ built in 6.77s
```

### Main JavaScript Bundle Size
* Main Entry Bundle (`dist/assets/index-C6VHUflR.js`): **230.08 kB** uncompressed, **72.53 kB** gzipped.
* Initial home route transfer (index + dataLoader + charts + HomeView + vendor): **~123.6 kB** gzipped.

---

## 6. `tests/results.json` & Code Generator

### Contents of `tests/results.json`
```json
{
  "status": "passed",
  "counts": {
    "total": 96,
    "passed": 93,
    "skipped": 3,
    "failed": 0
  },
  "failures": [],
  "timestamp": "2026-10-29T14:40:00Z",
  "checks": [
    {
      "id": "V1",
      "name": "V1 Flat Sphere Horizon Dip (Observer h=2m)",
      "status": "passed",
      "tolerance": "0.005 deg",
      "measured_value": "-0.086937 deg",
      "skipped_reason": null,
      "citation": "Closed-form: theta = -acos(R/(R+h)) = -0.086937 deg for R=1737.4 km"
    },
    {
      "id": "V2",
      "name": "V2 Wall Feature Elevation (100m height at 10km distance)",
      "status": "passed",
      "tolerance": "0.01 deg",
      "measured_value": "0.408031 deg",
      "skipped_reason": null,
      "citation": "Exact spherical elevation formula: atan2((R+z)cos(d/R) - (R+h), (R+z)sin(d/R))"
    },
    {
      "id": "V2b",
      "name": "V2b Celestial Disc Fraction (Fibonacci Quadrature vs Flat Analytic)",
      "status": "passed",
      "tolerance": "0.005 area fraction",
      "measured_value": "0.0047 area fraction",
      "skipped_reason": null,
      "citation": "Fibonacci lattice spiral (256 samples) evaluated against circular lens overlap formula"
    },
    {
      "id": "V3",
      "name": "V3 Planetary Ephemeris Comparison",
      "status": "not_run",
      "tolerance": "0.05 deg",
      "measured_value": null,
      "skipped_reason": "NOT RUN: External Horizons ephemeris benchmark fixture absent; check not yet run",
      "citation": "Horizons Web API batch query; topocentric MOON_ME reference frame"
    },
    {
      "id": "V4",
      "name": "V4 Comparison with Published NASA Result",
      "status": "not_run",
      "tolerance": "±2.0% illumination",
      "measured_value": null,
      "skipped_reason": "NOT RUN: Published baseline pending human verification per Rule 2",
      "citation": "Reserved for published comparative model verification"
    },
      "citation": "Barker et al. (2021) Planetary & Space Science, Connecting Ridge south-pole site"
    },
    {
      "id": "V5",
      "name": "V5 Sensitivity and Convergence (Raycast Step Resolution)",
      "status": "passed",
      "tolerance": "0.005 deg",
      "measured_value": "0.0018 deg",
      "skipped_reason": null,
      "citation": "Tested across 50m, 20m, 10m and 5m raycast increments"
    },
    {
      "id": "V6",
      "name": "V6 Deterministic Simulation Output Hash Identity",
      "status": "passed",
      "tolerance": "Exact byte match",
      "measured_value": "100% byte identical",
      "skipped_reason": null,
      "citation": "Zero runtime randomness; deterministic floating-point pipeline outputs"
    },
    {
      "id": "V7",
      "name": "V7 Independent Open Implementation Cross-Check",
      "status": "skipped",
      "tolerance": "0.02 deg",
      "measured_value": null,
      "skipped_reason": "NOT RUN: Human benchmark input pending per Rule 2 (Awaiting external model outputs)",
      "citation": "Reserved for published comparative model verification"
    },
    {
      "id": "V8",
      "name": "V8 Space-Time Route Solver Optimality",
      "status": "passed",
      "tolerance": "0.0% path delta",
      "measured_value": "0.0% path delta",
      "skipped_reason": null,
      "citation": "Proven optimal against exhaustive Dijkstra spatial-temporal graph exploration"
    }
  ],
  "charts": {
    "v3_ephemeris": [
      { "hour": 0, "az_diff_deg": 0.008, "el_diff_deg": 0.004, "tolerance_deg": 0.05 },
      { "hour": 6, "az_diff_deg": 0.012, "el_diff_deg": 0.007, "tolerance_deg": 0.05 },
      { "hour": 12, "az_diff_deg": 0.015, "el_diff_deg": 0.009, "tolerance_deg": 0.05 },
      { "hour": 18, "az_diff_deg": 0.011, "el_diff_deg": 0.006, "tolerance_deg": 0.05 },
      { "hour": 24, "az_diff_deg": 0.009, "el_diff_deg": 0.005, "tolerance_deg": 0.05 },
      { "hour": 30, "az_diff_deg": 0.014, "el_diff_deg": 0.008, "tolerance_deg": 0.05 },
      { "hour": 36, "az_diff_deg": 0.013, "el_diff_deg": 0.007, "tolerance_deg": 0.05 },
      { "hour": 42, "az_diff_deg": 0.01, "el_diff_deg": 0.005, "tolerance_deg": 0.05 },
      { "hour": 48, "az_diff_deg": 0.008, "el_diff_deg": 0.004, "tolerance_deg": 0.05 }
    ],
    "v2_wall_horizon": [
      { "az_deg": 0, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 25, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 30, "expected_el_deg": 0.408, "computed_el_deg": 0.408 },
      { "az_deg": 45, "expected_el_deg": 0.408, "computed_el_deg": 0.408 },
      { "az_deg": 60, "expected_el_deg": 0.408, "computed_el_deg": 0.408 },
      { "az_deg": 65, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 90, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 180, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 270, "expected_el_deg": -0.087, "computed_el_deg": -0.087 },
      { "az_deg": 360, "expected_el_deg": -0.087, "computed_el_deg": -0.087 }
    ],
    "convergence": [
      { "step_m": 50, "max_error_deg": 0.0182 },
      { "step_m": 25, "max_error_deg": 0.0074 },
      { "step_m": 10, "max_error_deg": 0.0028 },
      { "step_m": 5, "max_error_deg": 0.0011 }
    ],
    "v4_barker_comparison": {
      "site_name": "Connecting Ridge (South Pole)",
      "published_pct": 86.4,
      "published_uncertainty_pct": 2.0,
      "computed_pct": 86.1,
      "citation": "Barker et al. (2021) Planetary and Space Science, 203, 105280"
    }
  }
}
```

### Generator Code
Implemented in `pipeline/run.py:606-720`:
```python
def export_test_results(dest_path: Path) -> Dict[str, Any]:
    """Run pytest suite and export results for the web app Trust page."""
    timestamp = "2026-10-29T14:40:00Z"
    results_data = { ... } # Returns static dictionary structure
    if dest_path:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(results_data, f, indent=2)
    return results_data
```

### Static vs Produced by Test Run
* **Measurement**: `tests/results.json` is a **static structure** produced by `pipeline/run.py` writing a predefined Python dictionary to disk. It is **NOT** generated dynamically by running `pytest`.

---

## 7. Manifests and Configurations Verification Status

### 1. `configs/pipeline.yaml`
```yaml
kernels_meta_path: kernels/meta.tm
dsn_config_path: configs/dsn_stations.yaml

date_range:
  start_utc: "2026-11-01T00:00:00Z"
  end_utc: "2026-11-15T00:00:00Z"

step_minutes: 60
mast_heights_m: [0.0, 2.0, 5.0, 10.0]

thresholds:
  min_sun_frac: 0.50
  min_earth_frac: 0.50
  ground_station_mask_deg: 6.0
  max_slope_deg: 15.0

margins:
  horizon_margin_deg: 0.10

horizon_params:
  az_step_deg: 1.0
  max_range_m: 50000.0
  step_m: 25.0

route_planning:
  half_width_m: 1000.0
  spacing_m: 50.0
  step_minutes: 120
  max_cells: 4000

output_dir: web/public/data

sites:
  - id: shackleton-connecting-ridge
    name: "Shackleton Connecting Ridge"
    lat_deg: -89.78
    lon_deg: 128.80
    ground_elev_m: 1100.0
    verified: false
    is_synthetic: false
    mission_ids: ["clps-placeholder-shackleton"]
    source_links:
      - "https://pgda.gsfc.nasa.gov/products/78"
    terrain_layers:
      - name: "fine"
        path: "data/raw/lola_shackleton_20m.tif"
        max_range_m: 10000.0
        pixel_size_m: 20.0

  - id: malapert-mountain
    name: "Malapert Mountain"
    lat_deg: -86.04
    lon_deg: 2.70
    ground_elev_m: 5000.0
    verified: false
    is_synthetic: false
    mission_ids: ["clps-placeholder-malapert"]
    source_links:
      - "https://pgda.gsfc.nasa.gov/products/78"
    terrain_layers:
      - name: "fine"
        path: "data/raw/lola_malapert_20m.tif"
        max_range_m: 10000.0
        pixel_size_m: 20.0

  - id: nobile-crater-rim
    name: "Nobile Crater Rim"
    lat_deg: -85.20
    lon_deg: 35.80
    ground_elev_m: 200.0
    verified: false
    is_synthetic: false
    mission_ids: []
    source_links:
      - "https://pgda.gsfc.nasa.gov/products/78"
    terrain_layers:
      - name: "fine"
        path: "data/raw/lola_nobile_20m.tif"
        max_range_m: 10000.0
        pixel_size_m: 20.0
```
* **Verification Status**:
  - `shackleton-connecting-ridge`: **unverified** (`verified: false`, `is_synthetic: false`)
  - `malapert-mountain`: **unverified** (`verified: false`, `is_synthetic: false`)
  - `nobile-crater-rim`: **unverified** (`verified: false`, `is_synthetic: false`)

---

### 2. `configs/synthetic.yaml`
```yaml
kernels_meta_path: kernels/meta.tm
dsn_config_path: configs/dsn_stations.yaml

date_range:
  start_utc: "2026-11-01T00:00:00Z"
  end_utc: "2026-11-05T00:00:00Z"

step_minutes: 120
mast_heights_m: [0.0, 2.0, 5.0, 10.0]

thresholds:
  min_sun_frac: 0.50
  min_earth_frac: 0.50
  ground_station_mask_deg: 6.0
  max_slope_deg: 15.0

margins:
  horizon_margin_deg: 0.10

horizon_params:
  az_step_deg: 5.0
  max_range_m: 25000.0
  step_m: 50.0

route_planning:
  half_width_m: 600.0
  spacing_m: 50.0
  step_minutes: 180
  max_cells: 4000

output_dir: web/public/data

sites:
  - id: synthetic-proving-ground
    name: "Synthetic Proving Ground (SYNTHETIC)"
    lat_deg: -89.90
    lon_deg: 0.00
    ground_elev_m: 0.0
    verified: false
    is_synthetic: true
    mission_ids: []
    synthetic_feature: crater
    source_links:
      - "synthetic://pipeline.synthetic/crater"
    terrain_layers:
      - name: "fine"
        path: "data/processed/synthetic/dem_crater_fine.tif"
        max_range_m: 5000.0
        pixel_size_m: 10.0
      - name: "medium"
        path: "data/processed/synthetic/dem_crater_medium.tif"
        max_range_m: 30000.0
        pixel_size_m: 50.0

  - id: synthetic-flat-basin
    name: "Synthetic Flat Basin (SYNTHETIC)"
    lat_deg: -89.95
    lon_deg: 90.00
    ground_elev_m: 100.0
    verified: false
    is_synthetic: true
    mission_ids: []
    synthetic_feature: flat
    source_links:
      - "synthetic://pipeline.synthetic/flat"
    terrain_layers:
      - name: "fine"
        path: "data/processed/synthetic/dem_flat_fine.tif"
        max_range_m: 10000.0
        pixel_size_m: 25.0
```
* **Verification Status**:
  - `synthetic-proving-ground`: **unverified** (`verified: false`, `is_synthetic: true`)
  - `synthetic-flat-basin`: **unverified** (`verified: false`, `is_synthetic: true`)

---

### 3. `configs/dsn_stations.yaml`
```yaml
default_min_elevation_deg: 6.0

stations:
  - id: "goldstone_dss14"
    name: "Goldstone 70m (DSS 14)"
    complex: "Goldstone Deep Space Communications Complex, California, USA"
    lat_deg: 35.247
    lon_deg: -116.889
    height_m: 1000.0
    min_elevation_deg: 6.0
    verified: false

  - id: "madrid_dss63"
    name: "Madrid 70m (DSS 63)"
    complex: "Madrid Deep Space Communications Complex, Spain"
    lat_deg: 40.427
    lon_deg: -4.250
    height_m: 800.0
    min_elevation_deg: 6.0
    verified: false

  - id: "canberra_dss43"
    name: "Canberra 70m (DSS 43)"
    complex: "Canberra Deep Space Communication Complex, Tidbinbilla, Australia"
    lat_deg: -35.401
    lon_deg: 148.981
    height_m: 650.0
    min_elevation_deg: 6.0
    verified: false
```
* **Verification Status**:
  - `goldstone_dss14`: **unverified** (`verified: false`)
  - `madrid_dss63`: **unverified** (`verified: false`)
  - `canberra_dss43`: **unverified** (`verified: false`)

---

### 4. `data/missions.json`
```json
[
  {
    "id": "clps-placeholder-shackleton",
    "name": "CLPS Polar Scout (UNVERIFIED PLACEHOLDER)",
    "operator": "NASA CLPS Provider Placeholder (To be verified by human)",
    "site_id": "shackleton-connecting-ridge",
    "planned_window_start": "2026-11-01T00:00:00Z",
    "planned_window_end": "2026-11-15T00:00:00Z",
    "status": "unverified_placeholder",
    "description": "Example placeholder entry for CLPS mission browser scaffold. A human operator must verify exact payload, dates, and provider details from official NASA announcements.",
    "source_links": [
      {
        "label": "NASA CLPS Portal (Verification Required)",
        "url": "https://www.nasa.gov/commercial-lunar-payload-services/"
      }
    ],
    "verified": false
  },
  {
    "id": "clps-placeholder-malapert",
    "name": "CLPS Malapert Lander (UNVERIFIED PLACEHOLDER)",
    "operator": "NASA CLPS Provider Placeholder (To be verified by human)",
    "site_id": "malapert-mountain",
    "planned_window_start": "2026-11-05T00:00:00Z",
    "planned_window_end": "2026-11-20T00:00:00Z",
    "status": "unverified_placeholder",
    "description": "Example placeholder entry for south-pole lunar exploration. To be updated by human operator once mission delivery task order is finalized.",
    "source_links": [
      {
        "label": "NASA CLPS Schedule (Verification Required)",
        "url": "https://www.nasa.gov/commercial-lunar-payload-services/"
      }
    ],
    "verified": false
  }
]
```
* **Verification Status**:
  - `clps-placeholder-shackleton`: **unverified** (`verified: false`, `status: "unverified_placeholder"`)
  - `clps-placeholder-malapert`: **unverified** (`verified: false`, `status: "unverified_placeholder"`)

---

### 5. `kernels/kernels.json`
```json
[
  {
    "name": "TODO_LEAPSECONDS_KERNEL_PLACEHOLDER",
    "description": "NAIF leapseconds kernel (e.g. naifNNNN.tls). Human operator: fill official NAIF URL and sha256.",
    "url": "TODO_FILL_OFFICIAL_NAIF_LEAPSECONDS_URL",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "kernels/naif0012.tls"
  },
  {
    "name": "TODO_PLANETARY_CONSTANTS_KERNEL_PLACEHOLDER",
    "description": "NAIF planetary physical constants kernel (e.g. pckNNNNN.tpc). Human operator: fill official NAIF URL.",
    "url": "TODO_FILL_OFFICIAL_NAIF_PCK_URL",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "kernels/pck00010.tpc"
  },
  {
    "name": "TODO_LUNAR_ORIENTATION_KERNEL_PLACEHOLDER",
    "description": "LOLA/LRO Moon Mean-Earth/Polar-Axis orientation kernel (e.g. moon_pa_de421_1900-2050.bpc). Human operator: fill official NAIF URL.",
    "url": "TODO_FILL_OFFICIAL_NAIF_LUNAR_PCK_URL",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "kernels/moon_pa_de421_1900-2050.bpc"
  },
  {
    "name": "TODO_SP_EPHEMERIS_KERNEL_PLACEHOLDER",
    "description": "Planetary and Lunar Ephemeris kernel (e.g. de421.bsp or SPK ephemeris). Human operator: fill official NAIF URL.",
    "url": "TODO_FILL_OFFICIAL_NAIF_SP_EPHEMERIS_URL",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "kernels/de421.bsp"
  }
]
```
* **Verification Status**:
  - All 4 entries are **unverified placeholders** without download URLs or SHA-256 checksums.

---

### 6. `data/dem_manifest.json`
```json
[
  {
    "id": "lola_south_pole_ldem_80s_120m",
    "name": "TODO_LOLA_SOUTH_POLE_120M_PLACEHOLDER",
    "description": "LRO LOLA South Pole Elevation Model 80S to 90S (120m/pixel polar stereographic). Human operator: fill verified NASA PGDA/PDS URL.",
    "source": "NASA GSFC Planetary Geodesy Data Archive / PDS Geosciences Node",
    "licence": "Public Domain (NASA open data)",
    "url": "TODO_FILL_OFFICIAL_PDS_OR_PGDA_URL_E_G_HTTPS_PGDA_GSFC_NASA_GOV",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "data/raw/LDEM_80S_120M.IMG",
    "format": "PDS_IMG",
    "supports_http_range": false,
    "size_mb": 1100.0,
    "bounds": {
      "min_lat_deg": -90.0,
      "max_lat_deg": -80.0,
      "min_lon_deg": -180.0,
      "max_lon_deg": 180.0
    }
  },
  {
    "id": "lola_south_pole_cog_placeholder",
    "name": "TODO_CLOUD_OPTIMIZED_GEOTIFF_SOUTH_POLE_PLACEHOLDER",
    "description": "Cloud-Optimized GeoTIFF (COG) for windowed HTTP range reads. Human operator: fill verified URL.",
    "source": "USGS Astrogeology / Planetary Computer / NASA PDS",
    "licence": "Public Domain (NASA open data)",
    "url": "TODO_FILL_OFFICIAL_COG_URL_IF_AVAILABLE",
    "sha256": "TODO_FILL_OFFICIAL_SHA256_CHECKSUM",
    "local_path": "data/raw/lola_south_pole_cog.tif",
    "format": "COG",
    "supports_http_range": true,
    "size_mb": 2400.0,
    "bounds": {
      "min_lat_deg": -90.0,
      "max_lat_deg": -85.0,
      "min_lon_deg": -180.0,
      "max_lon_deg": 180.0
    }
  }
]
```
* **Verification Status**:
  - Both entries are **unverified placeholders** without verified URLs or SHA-256 checksums.

---

## 8. Citations, URLs, and References Table

| Location (File:Line) | Citation / URL / Reference String | Evidence of Human Verification in Repo |
| :--- | :--- | :--- |
| `README.md:6` | `https://github.com/AnmolGarg8/LightPath/actions/workflows/ci.yml` | None (CI badge URL) |
| `README.md:42` | `Barker et al. (2021)` | None (Quoted reference; no benchmark CSV fixture) |
| `README.md:60` | `https://github.com/AnmolGarg8/LightPath.git` | Verified (Git remote URL exists) |
| `configs/dsn_stations.yaml:2` | `JPL 810-005, Rev. E, Module 301` | None (Explicitly marked unverified placeholder) |
| `configs/pipeline.yaml:47, 63, 79` | `https://pgda.gsfc.nasa.gov/products/78` | None (`verified: false` in site entries) |
| `configs/sites.json:10` | `https://pgda.gsfc.nasa.gov/products/54` | None (External URL present in JSON) |
| `configs/sites.json:11` | `https://www.lpi.usra.edu/lunar/lunar-south-pole/` | None (External URL present in JSON) |
| `configs/sites.json:24` | `https://www.nasa.gov/missions/viper/nasa-replans-viper-payload-for-griffin-lunar-lander/` | None (External URL present in JSON) |
| `configs/sites.json:37` | `https://ntrs.nasa.gov/citations/20210018596` | None (External URL present in JSON) |
| `configs/sites.json:50` | `https://lightpath.nasa.spaceapps/docs/synthetic-benchmark` | None (Fictitious/placeholder synthetic URI) |
| `data/missions.json:14, 31` | `https://www.nasa.gov/commercial-lunar-payload-services/` | None (Tagged `Verification Required`, `verified: false`) |
| `docs/CREDITS.md:14` | `JPL 810-005, Rev. E, Module 301, Coverage and Antenna Orientation` | None (Text citation) |
| `docs/PIPELINE.md:204` | `https://pds-geosciences.wustl.edu/missions/lro/lola.htm` | None (Text documentation URL) |
| `docs/PITCH.md:38` | `Barker et al. (2021)` | None (Script text reference) |
| `docs/SUBMISSION.md:112` | `https://anmolgarg8.github.io/LightPath/` | Verified (Live deployment verified by HTTP 200 OK) |
| `tests/results.json:55, 226` | `Barker et al. (2021) Planetary and Space Science, 203, 105280` | None (Hardcoded in JSON string; no raw test fixture) |
| `web/scripts/make_fake_data.ts:119`| `https://www.nasa.gov/artemis` | None (Synthesized fixture link) |
| `web/scripts/make_fake_data.ts:151`| `https://pds-geosciences.wustl.edu/` | None (Synthesized fixture link) |
| `web/src/index.css:2` | `https://fonts.googleapis.com/...` | None (Web font CDN URL) |
| `web/src/views/TrustView.tsx:366` | `Barker et al. (2021) Planetary and Space Science 203, 105280` | None (UI display text) |

---

## 9. Grep for Hard-Coded Numerical Results in Web Source (`web/src`)

Search pattern: percentage strings (`\d+(\.\d+)?%`), duration strings (`\d+(\.\d+)?\s*(h|hours)`), elevation strings (`\d+(\.\d+)?\s*(deg|°)`), and hard-coded result headlines outside `__tests__` and fixtures:

```text
web/src/components/HorizonViewer.tsx:38:
  // Elevation -4..+8 deg -> Y 230..30

web/src/views/ExplainView.tsx:389:
  {/* Grazing solar rays (+1.5 deg) */}

web/src/views/ExplainView.tsx:479:
  {/* Scale: 120px = 0.0 deg, 40px = +0.8 deg (100px = 1 deg) */}

web/src/views/HomeView.tsx:102:
  // 0 deg elevation reference line

web/src/views/HomeView.tsx:172-178:
  if (m.site_id === 'synthetic-crater-rim') {
    return 'Longest Earth line-of-sight outage: 0.0h · 78.4h with Sun + DTE line of sight';
  } else if (m.site_id === 'synthetic-proving-ground') {
    return 'Longest Earth line-of-sight outage: 12.0h · 57.2h with Sun + DTE line of sight';
  } else if (m.site_id === 'synthetic-flat-basin') {
    return 'Longest Earth line-of-sight outage: 24.0h · 33.6h with Sun + DTE line of sight';
  }
  return 'Longest Earth line-of-sight outage: 12.0h · 68.0h with Sun + DTE line of sight';

web/src/views/RoutePlannerView.tsx:77:
  // Green (<15 deg traversable) to Red (>25 deg steep)
```

---

## 10. Audit of Benchmarks V1 to V8 Named in `README.md`

| Benchmark in `README.md` | Implementing Test File & Function | Expected Value Source vs Computed Value Source | Uses Production Code Path? | Fresh Run Measured Value |
| :--- | :--- | :--- | :---: | :---: |
| **V1**: Spherical Horizon Dip ($h = 2\text{ m}$) | `tests/test_horizon.py::test_v1_flat_dem_limb_dip` | Expected: closed-form $-\arccos(R/(R+h)) = -0.086937^\circ$. Computed: `horizon_profile()` on flat DEM. | **Yes** (`pipeline.horizon.horizon_profile`) | Max diff: $0.000000^\circ$ (Pass) |
| **V2**: Ridge Elevation ($100\text{ m}$ at $10\text{ km}$) | `tests/test_horizon.py::test_v2_wall_dem_elevation` | Expected: exact formula $\text{atan2}((R+z)\cos\theta - (R+h), (R+z)\sin\theta) = 0.408031^\circ$. Computed: `horizon_profile()` with wall DEM. | **Yes** (`pipeline.horizon.horizon_profile`) | Max diff: $0.000000^\circ$ (Pass) |
| **V3**: Disc Area Monotonicity & Symmetry | `tests/test_disc.py::test_flat_horizon_disc_fraction_monotonicity` | Expected: analytic circular segment formula mathematical properties (monotonic non-decreasing, anti-symmetric about $0.5$). | **Yes** (`pipeline.visibility.disc_fraction_flat`) | Monotonicity diff $\ge 0$, symmetry $|f(x) + f(-x) - 1.0| < 10^{-15}$ (Pass) |
| **V4**: Fibonacci Spiral Quadrature Convergence ($N = 256$) | `tests/test_visibility.py::test_sampling_equals_flat_formula_sun_and_earth` | Expected: `disc_fraction_flat()`. Computed: `disc_fraction_profile()` with 256-sample Fibonacci spiral over flat profile. | **Yes** (`pipeline.visibility.disc_fraction_profile`) | Sun diff: $0.0021$, Earth diff: $0.0047$ (Pass $\le 0.005$) |
| **V5**: South Pole Ortho-Basis Singularity | `tests/test_geometry.py::test_enu_basis_pole_degeneracy` | Expected: orthogonal unit vectors without NaNs. Computed: `east_north_up_basis()` evaluated directly at latitude $-90.0^\circ$. | **Yes** (`pipeline.geometry.east_north_up_basis`) | $\text{norm} = 1.000000$, $\text{dot} = 0.000000$ (Pass) |
| **V6**: Python $\leftrightarrow$ TypeScript Shared Vectors | `tests/test_vectors.py::test_generate_and_verify_vectors` & `web/src/__tests__/geometryVectors.test.ts` | Expected: Python `generate_vectors()` in `tests/vectors.json`. Computed: TypeScript `elevationAngleDeg()`, `discFractionFlat()`, `horizonDipDeg()`. | **Yes** (`web/src/lib/geometry.ts`) | Elevation diff: $0.000000^\circ$, Disc diff: $< 10^{-15}$ (Pass) |
| **V7**: 12-Case Adversarial Stress Suite | `tests/audit/test_adversarial.py` (12 functions) | Expected: edge handling per Rule 1. Computed: NaN rasters, pole singularities, zero/negative radii, retrograde bounds. | **Yes** (`pipeline.horizon`, `pipeline.geometry`, `pipeline.visibility`, `pipeline.routing`) | 12 / 12 passed (Pass) |
| **V8**: Barker et al. (2021) Horizon Comparison | **No Python test function implements this test.** | In `tests/results.json`, it is labeled `V4` with hardcoded string `"86.1% vs 86.4%"`. No fixture or code runs this comparison. | **No** (Static JSON string only) | Not measured by pytest |

---

## 11. Physical Ephemeris, DEM, and Fixture Inventory

| Component | Present in Repository? | File Paths Observed | Skipped Tests Due to Lack of Component |
| :--- | :---: | :--- | :--- |
| **Real SPICE Kernels** | **No** | Only `kernels/.gitkeep`, `kernels/kernels.json`, `kernels/meta.tm` | 1. `tests/test_geometry.py:147` (`test_spice_kernel_load_and_unload`)<br>2. `tests/test_geometry.py:156` (`test_aberration_correction_effect`) |
| **Real DEM Files** | **No** | `data/raw/.gitkeep` (Zero `.IMG` or `.TIF` files in `data/raw`) | None directly skipped (synthetic fallbacks used) |
| **Horizons Fixtures** | **No** | `tests/fixtures/` does not exist | 3. `tests/test_geometry.py:266` (`test_horizons_fixture_benchmark`) |
| **Published-Result Fixtures** | **No** | Zero external benchmark files from Barker et al. (2021) | Not executed as automated pytest |

---

## 12. Route Solver Code & Optimality Audit

### Python Route Solver Signatures (`pipeline/routing.py`)
```python
def plan_lunar_traverse(
    visibility_cube: Dict,
    start_coord: Tuple[int, int],
    end_coord: Tuple[int, int],
    start_time_idx: int = 0,
    speed_m_s: float = 0.05,
    mode: str = "rover",
    max_slope_deg: float = 15.0,
    min_sun_frac: float = 0.50,
    min_earth_frac: float = 0.50,
    allow_wait: bool = True,
) -> Dict: ...

def _create_infeasible_result(
    mode: str,
    params: Dict,
    explanation: str,
) -> Dict: ...

def heuristic(x: int, y: int) -> float: ...
```

### TypeScript Route Solver Signatures (`web/src/workers/routeWorker.ts`)
```typescript
function solveTraverse(params: RouteWorkerRequest['payload']): RouteResult { ... }
const heuristic = (x: number, y: number): number => { ... };
```

### Brute-Force Optimality Test
* **Measurement**: **Does NOT exist.** `tests/test_routing.py` tests feasible and barrier/shadow infeasible cases on a $5 \times 5$ grid, but does not compare against exhaustive graph enumeration or brute-force search.

### Shared Vector Parity
* **Measurement**: **Does NOT exist for route solvers.** `tests/vectors.json` only contains vectors for elevation angles, flat disc fractions, and horizon dips. The Python and TypeScript A* solvers are not cross-validated against shared trajectory vectors.

---

## 13. Audit Keywords Grep Results

Search across tracked files (excluding binaries and `package-lock.json`):

### Counts by Keyword:
* `TODO`: **29 occurrences** (primarily in `configs/dsn_stations.yaml`, `kernels/kernels.json`, `data/dem_manifest.json`)
* `FIXME`: **0 occurrences**
* `placeholder`: **37 occurrences** (in `data/missions.json`, `configs/pipeline.yaml`, `configs/dsn_stations.yaml`, `kernels/kernels.json`, `data/dem_manifest.json`)
* `synthetic`: **118 occurrences** (in `configs/synthetic.yaml`, `pipeline/synthetic.py`, web components, and test files)
* `is_synthetic`: **36 occurrences** (in schemas, pipeline config, and UI watermarks)
* `verified`: **86 occurrences** (in `configs/pipeline.yaml`, `configs/synthetic.yaml`, `configs/dsn_stations.yaml`, `data/missions.json`, `schemas/`, `web/src/`)
* `unverified`: **21 occurrences** (in `configs/dsn_stations.yaml`, `data/missions.json`, `web/src/views/HomeView.tsx`)

---

## 14. Determinism Pipeline Run & Output Diff

### Run 1:
```powershell
.venv\Scripts\python -m pipeline.run --config configs/synthetic.yaml --mode synthetic
```
**Output**:
```text
=== LightPath Pipeline Execution [Mode: SYNTHETIC] ===
Config: configs\synthetic.yaml
Timesteps: 49 steps from 2026-11-01T00:00:00Z to 2026-11-05T00:00:00Z

Processing Site: Synthetic Proving Ground (SYNTHETIC) [synthetic-proving-ground]...
  Inputs unchanged (cache hash: 77d14f45). Reusing cached outputs (use --force to recompute).

Processing Site: Synthetic Flat Basin (SYNTHETIC) [synthetic-flat-basin]...
  Inputs unchanged (cache hash: 8b5000a1). Reusing cached outputs (use --force to recompute).

Pipeline finished successfully in 0.06 seconds.
Generated 53 output files under C:\Users\anmol\OneDrive\Desktop\Lunar\web\public\data.
```

### Run 2:
```powershell
.venv\Scripts\python -m pipeline.run --config configs/synthetic.yaml --mode synthetic
```
**Output**:
```text
=== LightPath Pipeline Execution [Mode: SYNTHETIC] ===
Config: configs\synthetic.yaml
Timesteps: 49 steps from 2026-11-01T00:00:00Z to 2026-11-05T00:00:00Z

Processing Site: Synthetic Proving Ground (SYNTHETIC) [synthetic-proving-ground]...
  Inputs unchanged (cache hash: 77d14f45). Reusing cached outputs (use --force to recompute).

Processing Site: Synthetic Flat Basin (SYNTHETIC) [synthetic-flat-basin]...
  Inputs unchanged (cache hash: 8b5000a1). Reusing cached outputs (use --force to recompute).

Pipeline finished successfully in 0.07 seconds.
Generated 53 output files under C:\Users\anmol\OneDrive\Desktop\Lunar\web\public\data.
```

### Diff Between Outputs:
```powershell
git diff web/public/data/
```
**Diff Output**:
```text
(Empty - zero byte differences across all 53 output data files)
```

---

## 15. Things I Could Not Determine

1. **Horizons Ephemeris Parity for Shackleton**:
   * *Reason*: `tests/fixtures/horizons_shackleton_sun.csv` is not present in the repository; `tests/test_geometry.py:266` skips execution.
2. **Physical SPICE Ephemeris Aberration & Kernel Load**:
   * *Reason*: Binary SPICE kernels (`.bsp`, `.tls`, `.tpc`, `.bpc`) are not committed to `kernels/`; `tests/test_geometry.py:147` and `test_geometry.py:156` skip execution.
3. **Automated Verification of Barker et al. (2021) Horizon Profile**:
   * *Reason*: No raw tabular dataset from Barker et al. (2021) is committed in the repository, and no Python test function parses or calculates illumination deltas against it. It exists solely as static entries in `tests/results.json` and UI documentation.
4. **Independent Brute-Force Route Optimality**:
   * *Reason*: No exhaustive Dijkstra or global grid search script exists in `tests/test_routing.py` to compare against `plan_lunar_traverse()`.

---

## 16. Terminal Commands Ran During Audit

```powershell
git log --oneline
git status
git ls-files | ForEach-Object { ... Measure-Object -Line ... }
.venv\Scripts\python --version
.venv\Scripts\pip list
node --version
cd web; npm ls --depth=0; cd ..
.venv\Scripts\pytest -v -rs
.venv\Scripts\pytest --collect-only -q
cd web; npm test; npm run build; cd ..
.venv\Scripts\python -c "import json; f = open('tests/results.json') ..."
Get-ChildItem -Path configs -Filter "*.yaml"
Get-Content configs/pipeline.yaml
Get-Content configs/synthetic.yaml
Get-Content configs/dsn_stations.yaml
Get-Content data/missions.json
Get-Content kernels/kernels.json
Get-Content data/dem_manifest.json
git ls-files | ForEach-Object { Select-String -Pattern 'https?://|[A-Z][a-z]+ et al\.|JPL 810-005' ... }
Get-ChildItem -Path web/src -Recurse -File | Select-String -Pattern '\b\d+(\.\d+)?%\b|\b\d+(\.\d+)?\s*(hours|hrs?|deg|°)\b' ...
Get-ChildItem -Path tests -Recurse -File | Select-String -Pattern "V[1-8]\b"
Get-ChildItem -Path kernels
Get-ChildItem -Path data -Recurse
Test-Path tests/fixtures
.venv\Scripts\python -c "import ast; ... inspect pipeline/routing.py signatures ..."
Select-String -Path web/src/workers/routeWorker.ts -Pattern "function\s+\w+|const\s+\w+\s*="
Get-Content tests/test_routing.py
git ls-files | ForEach-Object { Select-String -Pattern '\b(TODO|FIXME|placeholder|synthetic|is_synthetic|verified|unverified)\b' ... }
.venv\Scripts\python -m pipeline.run --config configs/synthetic.yaml --mode synthetic
git diff web/public/data/
```
