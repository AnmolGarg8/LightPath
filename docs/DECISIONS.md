# LightPath — Architecture Decision Records (ADRs)

This document records key architectural, engineering, and scientific decisions for LightPath in compliance with Rule 1 and Rule 13.

## ADR Template
- **Title**: [Short title of the solved problem]
- **Status**: [Proposed | Accepted | Superseded]
- **Context**: [Problem description and constraints]
- **Decision**: [The change that we're committing to]
- **Consequences**: [Pros, cons, and trade-offs]

---

## ADR 001: Zero-Runtime-Network Architecture for Web Client
- **Status**: Accepted
- **Context**: Rule 8 mandates: "Deterministic, reproducible, no network calls at runtime in the web app." Hackathon demonstrators and lunar mission planners need to run reliably offline and across sandboxed environments.
- **Decision**: All computationally heavy simulations (horizon raycasting, 14-day ephemerides, and visibility cubes) are computed deterministically offline via the Python pipeline into static schema-validated JSON artifacts (`/data/<site>/`). The web client runs completely offline without any external network dependency.
- **Consequences**: High reliability, instant loading, offline functionality. Dynamic parameter tweaks are handled in-browser via Web Workers.

## ADR 002: MOON_ME Datum and Exact Curvature Formulation
- **Status**: Accepted
- **Context**: Lunar surface features at polar latitudes have strong curvature effects ($1\text{ km} \approx 0.033^\circ$ curvature tilt; $10\text{ km} \approx 0.33^\circ$). Flat-Moon approximations create major errors at grazing illumination angles.
- **Decision**: Strictly adopt the LOLA datum reference radius $R = 1,737,400.0\text{ m}$ in the Mean Earth/Polar Axis frame (`MOON_ME`). Use the exact curvature equation:
  $$\text{el} = \text{atan2}((R + z)\cos(\theta) - (R + z_0), (R + z)\sin(\theta))$$
  for all topocentric elevation calculations.
- **Consequences**: Sub-arcminute elevation accuracy; zero flat-Moon geometric error.

## ADR 003: Asynchronous Space-Time Routing via Web Worker
- **Status**: Accepted
- **Context**: The signature traverse planner explores a 3D state space $(x, y, t)$ across terrain slope limits and moving solar shadows. Running complex pathfinding on the UI thread could cause interface stuttering.
- **Decision**: Offload the space-time route solver to a dedicated Web Worker (`src/workers/routeWorker.ts`) with typed message passing.
- **Consequences**: Smooth, 60 FPS user interface during complex path exploration.

## ADR 004: Fallback and Optional Numba Acceleration
- **Status**: Accepted
- **Context**: Raster processing and great-circle horizon raycasting can benefit from JIT compilation via `numba`, but `numba` has heavy binary dependencies that may not install on every platform.
- **Decision**: The core pipeline uses pure NumPy vectorized operations by default. When `numba` is present, JIT kernels are activated; if missing, code falls back seamlessly to vectorized NumPy without errors.
- **Consequences**: Portability on all Python 3.11+ environments, with optional JIT acceleration when installed.
