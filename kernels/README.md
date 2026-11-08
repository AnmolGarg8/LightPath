# `kernels/`

This directory contains lunar orientation and planetary ephemeris kernels (SPICE kernels) and meta-kernels for LightPath.

## Contents
- `kernels.json`: Manifest of required SPICE kernels with NAIF source URLs, local paths, and SHA-256 checksums.
- `meta.tm`: Generated SPICE meta-kernel referencing loaded kernels with relative paths.
- Binary kernels (e.g., `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `pck00010.tpc`, `naif0012.tls`) are downloaded via `scripts/fetch_kernels.py` and are gitignored to keep the repository lightweight.
