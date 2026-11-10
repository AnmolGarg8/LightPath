# Related Work & LightPath Differentiation

Governed by `docs/PROJECT_RULES.md` (Rule 1: Correctness before features; Rule 2: Never invent facts or citations).

---

## 1. Existing Prior Art

Lunar south-pole visibility tools and traverse planners incorporating solar illumination and shadow constraints already exist within the planetary science and aerospace engineering communities. NASA centers, international space agencies, and academic research institutions have developed sophisticated high-performance computing pipelines to simulate grazing polar lighting, crater rim horizon occultation, and rover path planning under shadow constraints.

In strict compliance with **Rule 2 (Never invent facts or citations)**, specific names, institutional attributions, and direct links to these external tools and literature are documented in [`docs/RELATED_WORK_SOURCES.md`](RELATED_WORK_SOURCES.md) as they are verified and confirmed by human researchers. LightPath does not invent or fabricate citations.

---

## 2. What LightPath Adds

While existing polar illumination and traverse analysis toolchains are powerful, they typically operate as heavyweight desktop applications, require local SPICE toolkit compilation, depend on high-performance compute clusters, or remain proprietary internal agency tools.

LightPath contributes a novel combination of architectural, mathematical, and algorithmic capabilities designed for open, immediate, and reproducible access:

### 1. In-Browser 4D Space-Time Traverse Planning
- **Client-Side Solver**: Executes a dynamic 4D A* graph search in space and time $(x, y, t)$ entirely inside the user's browser via multi-threaded Web Workers.
- **Real-Time Performance**: Evaluates traversability across moving polar shadow fields on $25 \times 25$ grids in under 1 second, with zero server compute or backend API latency.
- **Departure Window Mapping**: Sweeps dozens to hundreds of candidate departure times across the synodic month in seconds, revealing transient sunlit corridors and advance warnings for shadow traps.

### 2. Exact Topocentric Disc Clipping with Per-Point Local Curvature
- **Per-Point Local Up**: Recognizes that lunar surface curvature tilts the local vertical by $\approx 0.033^\circ/\text{km}$ ($\approx 0.10^\circ$ over 3 km; see [`docs/PHYSICS_NOTES.md`](PHYSICS_NOTES.md)). Local zenith vectors are computed per grid cell, rather than using a single tangent-plane approximation across the region.
- **Physical Disc Integration**: Replaces point-source Sun approximations with 256-point uniform Fibonacci-spiral quadrature, evaluating partial disc occultation for the $0.53^\circ$ solar disc and $1.90^\circ$ Earth disc against irregular raycast horizons.

### 3. Interactive Observer Mast Sensitivity Optimization
- Provides real-time scrubbing of payload mast height ($1.0\text{ m}$ to $10.0\text{ m}$), instantly computing horizon depression ($\theta_{\text{dip}} = -\arccos(R / (R + z_0))$) and quantifying the recovered hours of continuous sunlight versus mechanical mast mass.

### 4. Multi-Lane Earth Line-of-Sight & DSN Geometry
- Intersects topocentric lunar Earth line of sight with Earth-fixed NASA Deep Space Network (DSN) complexes (Goldstone, Madrid, Canberra), accounting for Earth's rotation, station elevation masks ($6.0^\circ$), and identifying operational **Joint Windows** where solar power and high-rate comms coincide.

### 5. Deterministic Open Data Publication & Provenance
- Publishes all pipeline outputs in dual open standards: RFC 4180 CSV and Apache Parquet with embedded geodetic metadata.
- All numbers trace to cryptographic SHA-256 digests and SPICE kernel manifests, supported by an automated verification suite (V1–V8).
