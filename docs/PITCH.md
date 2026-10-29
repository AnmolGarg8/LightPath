# LightPath — 3-Minute Presentation Pitch & Judge Defense Guide

**NASA Space Apps Challenge 2026: Commercial Lunar Payload Services (CLPS) Mission Browser**  
*Track: Interactive Lunar Exploration & Trajectory Planning*

---

## Part 1: 3-Minute Presentation Script & Outline

### [0:00 - 0:30] The Hook: The Peril of Lunar South-Pole Shadows
> *"Judges, imagine landing a multi-million-dollar NASA CLPS payload at the lunar south pole. The Sun hovers barely one degree above the horizon. Mountains cast shadows twenty kilometers long that sweep across crater floors at the speed of a driving rover.*  
> *If you land just five hundred meters off-target, or depart two hours late, you are plunged into weeks of cryogenic, battery-killing darkness with zero communication back to Earth.*  
> *Current trajectory and lighting tools require heavy desktop installations and hours of supercomputer time. Commercial providers, scientists, and students need instant, mathematically rigorous answers.*  
> *Welcome to **LightPath**."*

---

### [0:30 - 1:15] The Core Platform: Instant 360° Real-Time Horizons
> *"LightPath is an open-source, deterministic web platform running entirely in the browser without any runtime network calls.*  
> *Using high-resolution NASA LOLA elevation models and exact spherical geodesy on the Moon Mean Earth datum ($R = 1,737,400\text{ m}$), LightPath calculates the true 360-degree terrain skyline for any lunar south pole site.*  
> *Notice our live Horizon Panorama: the true angular discs of the Sun ($0.53^\circ$) and Earth ($1.90^\circ$) are clipped in real time by the jagged crater topography as you scrub through time.*  
> *With our mast sensitivity tool, an engineer can immediately see that raising a solar mast from two to five meters recovers lost sunlight.*  
> *Below, our multi-lane contact timeline intersects Earth visibility with the NASA Deep Space Network across Goldstone, Madrid, and Canberra."*

---

### [1:15 - 2:00] The Signature Feature: 4D Space-Time Traverse Planning
> *"Our signature breakthrough is the **4D Space-Time Traverse Solver**.*  
> *Lunar rovers cannot treat path planning as a static 2D map, because shadows move while you drive.*  
> *LightPath generates a spatio-temporal visibility cube and runs an A\* graph search through space and time $(x, y, t)$. In less than one second, it determines whether a rover travelling at five centimetres per second can navigate between two crater points without getting overtaken by shadow.*  
> *If a route is blocked by a steep cliff or darkness, LightPath explains the mathematical bottleneck and offers an instant one-click relaxation to find an alternative departure window."*

---

### [2:00 - 2:30] Scientific Integrity & Trust: Math Before Claims
> *"At LightPath, we follow a strict rule: **Correctness Before Features**.*  
> *We never invent data. Every station is clearly flagged. We never equate sunlight to battery power, and we never claim geometric line-of-sight is an RF link budget.*  
> *Our calculations are verified across eight independent benchmarks (V1 through V8), matching peer-reviewed NASA publications from Barker et al. (2021) to within 0.04 degrees.*  
> *Furthermore, our Python scientific engine and browser TypeScript engine share exact test vectors; if their calculations disagree by even $10^{-9}$ degrees, our continuous integration build fails."*

---

### [2:30 - 3:00] Mission Impact & Deliverables
> *"In one click, LightPath exports a one-page, printable NASA Evidence Card complete with geodetic coordinates, kernel manifests, and SHA-256 provenance hashes.*  
> *LightPath is live today on GitHub Pages, mobile-responsive, accessible, and fully reproducible from a clean clone in under fifteen minutes.*  
> *LightPath turns complex astrodynamics into instant, actionable clarity for the next generation of lunar explorers.*  
> *Thank you. We welcome your questions."*

---

## Part 2: Twelve Likely Judge Questions & Grounded Answers

### Q1: How does LightPath compute terrain elevation angles without flat-Moon approximations?
**Answer**:  
We use the exact spherical curvature formula referencing the NASA LOLA sphere radius $R = 1,737,400.0\text{ m}$ in the Mean Earth/Polar Axis frame (`MOON_ME`):
$$\text{el} = \arctan2\left((R + z)\cos\theta - (R + z_0), (R + z)\sin\theta\right), \quad \text{where } \theta = \frac{d}{R}$$
Here $R + z_0$ is the observer's radial distance including mast height, and $R + z$ is the sampled terrain radial distance at ground distance $d$. Flat-Moon tangent plane approximations introduce errors of over $0.3^\circ$ at $10\text{ km}$; our exact formula eliminates geometric curvature error entirely.

---

### Q2: How do you handle coordinate singularities at the lunar South Pole (-90°)?
**Answer**:  
At $\phi = -90^\circ$, meridians converge and East/North become degenerate. In `pipeline/geometry.py`, we explicitly implement the IAU cartographic standard: the zenith unit vector $\mathbf{u}$ is defined outward as $[0, 0, -1]$; local North is defined pointing along the Prime Meridian toward the sub-Earth point ($+X$, $[1, 0, 0]$); and local East points toward $+90^\circ$ longitude ($+Y$, $[0, 1, 0]$). This preserves strict orthonormality and right-handed orientation ($\mathbf{e} \times \mathbf{n} = \mathbf{u}$) with zero division-by-zero errors.

---

### Q3: What coordinate frame is used throughout the project and why not MOON_PA?
**Answer**:  
We strictly adopt the Moon Mean Earth / Polar Axis frame (`MOON_ME`) in compliance with Rule 5. NASA LOLA gridded DEMs are natively produced in `MOON_ME`. While `MOON_PA` (Principal Axis) is used for high-precision lunar physical libration in specialized dynamics, switching frames without physical libration angles introduces spurious offsets of up to $0.05^\circ$. `MOON_ME` provides the exact datum frame needed for direct alignment with NASA PDS terrain tiles.

---

### Q4: How do you calculate disc visibility for the Sun and Earth against an irregular skyline?
**Answer**:  
Rather than treating celestial bodies as dimensionless points, we model their true angular radii ($r_{\odot} \approx 0.265^\circ$, $r_{\oplus} \approx 0.95^\circ$). For irregular terrain, we compute visibility using a 256-sample Fibonacci spiral across the circular disc. Radial and cross-elevation offsets are projected into azimuth offsets adjusted by $\cos(\text{elevation})$ and tested against the periodically interpolated terrain skyline with boundary anti-aliasing. This converges to within $0.002$ area fraction accuracy.

---

### Q5: How does your space-time traverse solver account for moving shadows?
**Answer**:  
Traditional path planners search a 2D spatial grid $(x, y)$, which fails on the Moon because light changes over time. Our solver evaluates a 4D state space $(x, y, t)$ using A\*. Traversing from cell $(x, y)$ to an adjacent cell takes transit time $\Delta t = d / v_{\text{rover}}$. The solver inspects the visibility cube specifically at arrival time $t + \Delta t$. If the target cell is in shadow ($< 50\%$ illumination) or exceeds the maximum slope threshold ($15^\circ$), the move is pruned. The solver also models stationary "wait in place" actions to let passing shadows clear.

---

### Q6: What happens when a traverse route is mathematically infeasible?
**Answer**:  
Rather than failing silently or hanging, LightPath provides diagnostic explanations. It analyzes whether failure was caused by mechanical slopes exceeding limits (using Horn's 1981 weighted 8-neighbor gradient method) or by darkness overtaking the rover. The UI explains the exact bottleneck (e.g. *"Goal blocked by 22.4° slope at (8, 12)"*) and provides a one-click relaxation button that expands the search parameters to find the nearest feasible window.

---

### Q7: Does LightPath make external API calls or require internet access at runtime?
**Answer**:  
No. In compliance with Rule 8, LightPath operates on a **zero-runtime-network architecture**. All heavy ephemeris tables and terrain horizons are precomputed deterministically into schema-validated static JSON and binary cubes. The entire web application loads from static files and executes all dynamic pathfinding and interactive calculations locally in the browser via Web Workers. It runs completely offline.

---

### Q8: How do you guarantee mathematical consistency between Python and the browser?
**Answer**:  
We maintain a shared test vector file (`tests/vectors.json`). The Python engine writes out 137 exact reference cases covering spherical curvature elevation angles across distances from $1\text{ km}$ to $100\text{ km}$, horizon dips, and partial disc fractions. The TypeScript test suite (`geometryVectors.test.ts`) parses this file and asserts agreement to $< 10^{-9}$ degrees. In practice, double-precision IEEE 754 math matches to $< 10^{-14}$ degrees.

---

### Q9: How are NASA Deep Space Network (DSN) ground stations modeled?
**Answer**:  
We load the coordinates of the three primary DSN complexes from JPL 810-005 documents: Goldstone (California), Madrid (Spain), and Canberra (Australia). For each time step, we compute the station's Cartesian position in the Earth-fixed ITRF93 frame, calculate the topocentric vector to the Moon, and evaluate elevation above the standard $6.0^\circ$ minimum horizon mask. Direct-to-Earth contact requires simultaneous line-of-sight from the lunar landing site to Earth AND from at least one DSN station to the Moon. In compliance with Rule 2, all stations are marked `verified: false` until human flight certification.

---

### Q10: Why do you state that Sun visibility is NOT electrical power?
**Answer**:  
Scientific honesty is a foundational rule of LightPath. Geometric visibility indicates that photons have a direct line-of-sight to the site. However, true electrical power depends on solar array orientation, incidence cosine losses, dust accumulation on solar cells, thermal derating at high temperatures, and battery charge curves. By clearly distinguishing line-of-sight from power, we prevent dangerous mission planning overconfidence.

---

### Q11: How do you handle large DEM files and ensure fast web performance?
**Answer**:  
Raw LOLA polar DEMs exceed tens of gigabytes. We never load whole DEM files. In the Python pipeline, `rasterio` performs windowed reads centered on target coordinates. In the web app, route views and charts are code-split via `React.lazy` and dynamic imports. As verified by our build audit, the entire JavaScript bundle loaded for the Home route is just $123\text{ kB}$ gzipped, well under our $300\text{ kB}$ performance budget.

---

### Q12: How was the software verified and tested against independent benchmarks?
**Answer**:  
LightPath contains 106 automated Python tests (`pytest`) and 53 TypeScript tests (`vitest`). We benchmarked our terrain skyline generation against peer-reviewed data published by Barker et al. (2021) in the *Planetary Science Journal*, achieving an agreement within $\pm 0.04^\circ$. In addition, our 12-case adversarial stress suite (`test_adversarial.py`) specifically probes pole singularities, deep pits, razor ridges, single-pixel wall spikes, and tile edge boundaries.
