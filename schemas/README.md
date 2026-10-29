# `schemas/`

JSON Schema specifications (Draft 2020-12) strictly defining the LightPath Data Contract.

## Schemas
- `site.schema.json`: Landing/exploration site coordinates, ground elevation, mission IDs, and verification flags.
- `run_info.schema.json`: Execution metadata, git commit hash, and software versions.
- `horizon.schema.json`: Azimuth step, heights array, 2D elevation grid `el_deg[h][az]`, and NaN fractions.
- `series.schema.json`: Simulation timestamps, Sun state, Earth state, and DSN ground station visibility.
- `stats.schema.json`: Operational thresholds, category stats (uptime, windows, longest outages), and joint statistics.
- `visibility_cube.schema.json`: Spatial grid origin and spacing, 3D `sun_frac`, 3D `earth_frac`, 2D slopes, and traversability map.
- `route_result.schema.json`: Route mode, waypoints `[{x, y, t}]`, duration, distance, slope metrics, and explanation.
- `provenance.schema.json`: Datasets, ephemeris kernels, parameters, numerical tolerances, and test summary.
