# `tests/`

Comprehensive unit and integration test suite for LightPath following Rule 1: "Correctness before features. Tests first or alongside. A module is not done until its tests pass."

## Test Suites
- `test_geometry.py`: Verifies exact spherical curvature formula, topocentric basis orthonormality, and Horn slope method.
- `test_disc.py`: Verifies partial disc visibility analytical identities, symmetry, monotonicity, and quadrature.
- `test_horizon.py`: Verifies horizon raycasting, mast height sensitivity, and interpolation.
- `test_ephemeris.py`: Verifies topocentric celestial positions, apparent radii, and DSN visibility cycles.
- `test_series.py`: Verifies window metrics and joint statistics.
- `test_routing.py`: Verifies space-time A* pathfinding and infeasibility detection.
- `test_schemas.py`: Strictly validates JSON instances against all draft 2020-12 schemas.
- `test_provenance.py`: Verifies audit trails and run metadata.
- `test_sample.py`: Smoke test ensuring clean CI execution.

## Running Tests
```bash
pytest -v
```
No network calls are made during test execution.
