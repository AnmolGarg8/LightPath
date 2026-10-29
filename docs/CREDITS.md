# LightPath — Third-Party Credits & Citations

In accordance with Rule 11 of the project guidelines, all third-party libraries, datasets, and mathematical foundations are documented below.

## Datasets & Ephemeris
- **NASA LOLA (Lunar Orbiter Laser Altimeter)**:
  - Reference: Smith, D. E., et al. (2010), *The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission*, Space Sci Rev.
  - Coordinate Frame: Moon Mean Earth/Polar Axis (MOON_ME), reference radius $R = 1,737,400\text{ m}$.
  - Product: LOLA South Pole DEMs (LDEM_80S to 90S).
- **JPL Planetary and Lunar Ephemerides (DE421 / DE440)**:
  - Reference: Folkner, W. M., et al., *The Planetary and Lunar Ephemeris DE430 and DE431*, IPN Progress Report 42-196 (2014).
  - Used for topocentric Sun and Earth vectors referenced to the lunar center of mass and transformed to topocentric local frames.
- **NASA Deep Space Network (DSN)**:
  - DSN Station Locations: JPL 810-005, Rev. E, Module 301, *Coverage and Antenna Orientation*.

## Algorithms & Mathematics
- **Exact Spherical Terrain Curvature**:
  - Observer radius $R + z_0$, terrain sample at angular distance $\theta = d / R$ and radius $R + z$.
  - Elevation angle formula:
    $$\text{el} = \text{atan2}((R + z) \cos(\theta) - (R + z_0), (R + z) \sin(\theta))$$
- **Partial Disc Visibility (Flat Horizon)**:
  - $x = \text{clip}(e / r, -1, 1)$
  - $\text{fraction} = \frac{\arccos(-x) + x \sqrt{1 - x^2}}{\pi}$
- **Digital Elevation Model (DEM) Gradient**:
  - Horn's method (1981): Horn, B. K. P., *Hill shading and the reflectance map*, Proceedings of the IEEE, 69(1), 14–47.

## Python Libraries
- `numpy`: Numerical array processing (BSD 3-Clause License).
- `pytest`: Unit and integration testing framework (MIT License).
- `jsonschema`: Strict JSON schema validation (MIT License).

## Web / Visualization
- `TypeScript`: Strongly typed JavaScript (Apache 2.0).
- `React`: UI rendering library (MIT License).
- `TailwindCSS`: Utility-first CSS framework (MIT License).
- `Lucide-React`: Icons (ISC License).
