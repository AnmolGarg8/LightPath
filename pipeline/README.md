# `pipeline/`

Core deterministic Python modules implementing the mathematical, physical, and geometric foundations of LightPath.

## Modules
- `constants.py`: Physical constants ($R = 1,737,400\text{ m}$), MOON_ME reference frame, and status enumerations.
- `geometry.py`: Exact spherical curvature elevation angle formula, topocentric basis vectors, and Horn's slope algorithm.
- `disc.py`: Analytical flat-horizon and variable-horizon partial disc illumination fraction calculations.
- `horizon.py`: Great-circle terrain raycasting and observer mast height interpolation.
- `ephemeris.py`: Topocentric Sun, Earth, and DSN ground station visibility (Goldstone, Madrid, Canberra).
- `series.py`: 14-day time series, uptime, downtime, and joint light & link window statistics.
- `cube.py`: Spatio-temporal visibility cube ($T \times Y \times X$) and traversability grids.
- `routing.py`: Space-Time A* route planner for continuous lunar traverse.
- `provenance.py`: Full audit trail generation and run metadata.
