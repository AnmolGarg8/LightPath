# `scripts/`

Operational utility scripts for dataset downloads, SPICE kernel management, simulation execution, and test fixtures.

## Scripts
- `fetch_kernels.py`: Downloads SPICE kernels defined in `kernels/kernels.json`, verifies checksums, never overwrites silently.
- `make_meta_kernel.py`: Builds the relative-path SPICE meta-kernel `kernels/meta.tm`.
- `fetch_dem.py`: Downloads LOLA polar DEM products from PDS/PGDA using windowed range requests or full download fallback.
- `make_horizons_request.py`: Generates the exact JPL Horizons batch and API queries to produce validation fixtures for Moon topocentric observers without runtime network calls.
- `run_pipeline.py`: Runs full batch simulation and exports schema-validated JSON outputs to `data/processed/` and `web/public/data/`.
