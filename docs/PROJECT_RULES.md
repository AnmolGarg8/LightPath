# LightPath Project Rules (Prompt 0)

LightPath (working title), a NASA Space Apps Challenge 2026 project for the challenge CLPS Lunar Mission Browser. Read these rules before every task.

## PURPOSE
LightPath shows, for lunar south-pole CLPS sites and a date range: when the Sun and Earth are above the terrain horizon (including the visible fraction of each disc), when a ground station on Earth can also see the Moon (direct-to-Earth contact), how uncertain that is, and how the answer changes with mast height, landing-point offset and, as the signature feature, motion: whether a rover or crew can travel from A to B while light and link are available. It is a preliminary planning and education tool. Sun visibility is not electrical power. Earth visibility is not a link budget. It is not for flight operations and does not certify landing or traverse safety.

## NON-NEGOTIABLE RULES
1. Correctness before features. Tests first or alongside. A module is not done until its tests pass.
2. Never invent facts, coordinates, mission names, dates, dataset values, DSN station data or citations. If you need one, add a TODO to docs/QUESTIONS.md and use a clearly labelled placeholder that the UI marks as unverified.
3. Never present synthetic or placeholder data as real. Synthetic output carries is_synthetic=true and the UI shows a permanent banner.
4. Units and frames in names: lat_deg, el_deg, dist_m, sun_xyz_moon_me_km. Degrees at module boundaries, radians only inside math functions.
5. Use the Moon mean-Earth/polar-axis frame MOON_ME everywhere (LOLA products use it). No MOON_PA without an explicit converted and tested path.
6. Directions to the Sun and Earth are topocentric (from the site or cell, using that point's local up), never from the Moon centre. For route planning, local up is computed per grid cell, because a few kilometres of travel tilts local up by about 0.1 degrees, which is comparable to the horizon margins we work with.
7. Elevation angles use the exact curvature formula below. No flat-Moon approximations.
8. No machine learning in the core. Deterministic, reproducible, no network calls at runtime in the web app.
9. Every output number traces to a provenance record (datasets, kernels, versions, parameters).
10. No hidden fallbacks. Raise errors or label results.
11. Independent implementation: write all code from the specifications here. Do not copy code from other hackathon repositories. Any third-party library or dataset is listed in docs/CREDITS.md.
12. Typed (Python hints, TypeScript strict), small modules, docstrings with the formula or reference.
13. When a requirement is ambiguous, write the question in docs/QUESTIONS.md, proceed with the safest assumption and state it.

## KEY FORMULAS
- R = 1737400 m (LOLA heights are relative to this sphere). Terrain radius = R + z.
- Observer radius R + z0. Sample at angular distance theta = d / R and radius R + z.
- el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta)).
- Horizon elevation at an azimuth = maximum el along that great-circle path.
- Flat-horizon disc visibility: x = clip(e / r, -1, 1); fraction = (acos(-x) + x * sqrt(1 - x^2)) / pi.
- Variable horizon: sample the disc in sky-angle offsets, compare each with the interpolated horizon.
- Slope of a cell from the DEM gradient (Horn method) at the grid spacing; documented.

## DATA CONTRACT (JSON, validated by schemas/*.schema.json)
site: id, name, mission_ids[], lat_deg, lon_deg, ground_elev_m, source_links[], verified, is_synthetic
run_info: created_utc, git_commit, software_versions (separate from deterministic content)
horizon: az_step_deg, heights_m[], el_deg[h][az], nan_fraction[h][az], flags
series: time_utc[], sun{az_deg, el_deg, radius_deg, frac, status}, earth{az_deg, el_deg, radius_deg, frac, status, dist_km}, dte{station_visible[], link_ok[]}
stats: thresholds, sun{}, earth{}, dte{}, joint{} with windows[] and longest_outage_h
visibility_cube (route planner): grid{origin, spacing_m, nx, ny}, time_utc[], sun_frac[t][y][x] uint8 percent, earth_frac[t][y][x] uint8 percent, slope_deg[y][x], traversable[y][x], flags
route_result: mode, params, feasible, path[{x, y, t}], metrics, alternatives[], explanation
provenance: datasets[], kernels[], parameters{}, tolerances{}, tests_summary
status values: robust_visible, marginal, robust_blocked

## REPO LAYOUT
kernels/ data/raw/ data/processed/ pipeline/ tests/ schemas/ web/ docs/ scripts/ configs/

## DEFINITION OF DONE
Runs on a clean machine from the README, tests pass, matches the contract, documented in docs/.

When you finish any task, report: what you built, how to run it, the exact test commands and their output, assumptions, open questions, and anything you could not verify.
