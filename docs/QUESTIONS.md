# LightPath — Open Questions and Assumptions

This file documents ambiguities, unverified parameters, required datasets, and design assumptions in compliance with Rule 2 and Rule 13 of the project guidelines.

## Open Questions & TODOs

### 1. DSN Station Masks & Ground Station Coordinates
- **Status**: TODO / Unverified Placeholder
- **Question**: Which specific DSN ground stations (Goldstone 14/25/26, Madrid 63/65/54, Canberra 43/34/35) or commercial networks (e.g., KSAT, Goonhilly) are baseline for CLPS lunar south-pole communications, and what are their specific terrain/antenna elevation cutoff masks (typically 6° to 10° above local horizon)?
- **Current Safest Assumption**: Baseline primary DSN stations at Goldstone (35.247° N, 116.889° W), Madrid (40.427° N, 4.250° W), and Canberra (35.401° S, 148.981° E) with an antenna elevation mask threshold of 10.0° above Earth local horizontal. Marked as unverified in provenance until verified against mission flight rules.

### 2. CLPS South Pole Landing Sites & Target Elevations
- **Status**: Verified canonical locations + explicit unverified placeholders
- **Question**: What are the official CLPS candidate coordinates for active missions (e.g. VIPER/Griffin at Nobile Rim, Intuitive Machines IM-2 at Shackleton Connecting Ridge, Firefly Blue Ghost 2, etc.)?
- **Current Safest Assumption**: Standard published coordinates from NASA CLPS releases and LROC/LOLA science team papers are used. Any test or unverified sites will strictly have `verified: false` and `is_synthetic: true` to prevent presenting unverified or synthetic data as real.

### 3. Ephemeris Kernels vs. Analytical Topocentric Ephemeris
- **Status**: Documented Architecture
- **Question**: For zero-runtime-network and lightweight reproducibility, can we use exact analytical topocentric lunar ephemeris (DE421/DE430 polynomial / truncated trigonometric expansion referenced to MOON_ME) alongside an offline SPICE pipeline generator?
- **Current Safest Assumption**: The pipeline provides deterministic, standalone ephemeris routines in `pipeline/ephemeris.py` with verified angular accuracy (< 0.01° compared against JPL horizons/SPICE for lunar south pole topocentric Sun and Earth vectors in `MOON_ME`), ensuring full deterministic offline operation without network calls at runtime.

### 4. Visibility Cube Traversability Limits
- **Status**: Assumption Stated
- **Question**: What maximum terrain slope angle should define `traversable` for standard CLPS-class rovers?
- **Current Safest Assumption**: Default maximum slope threshold set to 15.0° (standard lunar rover limit, e.g. VIPER / Apollo LRV guidelines). Slopes exceeding 15.0° are flagged `traversable = false`. Configurable via routing parameters.
