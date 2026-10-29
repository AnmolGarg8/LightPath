# NASA Space Apps Challenge 2026 — Official Submission Document

**Challenge Name**: Commercial Lunar Payload Services (CLPS) Mission Browser  
**Project Title**: LightPath — CLPS Lunar Mission Browser & Space-Time Traverse Planner  
**Submission Category**: Interactive Lunar Exploration, Navigation & Mission Planning  

---

## 1. Project Summary (248 words)

At the lunar south pole, where NASA's Commercial Lunar Payload Services (CLPS) missions and Artemis astronauts will land, the Sun never rises higher than 1.5° above the horizon. Mountain peaks cast elongated, dynamic shadows that sweep across crater floors at the speed of a rover. A landing target offset of 500 meters or a departure delay of two hours can plunge a solar-powered lander or rover into weeks of lethal darkness and sever direct radio communication with Earth.

**LightPath** solves this challenge through an open, deterministic web browser and space-time navigation platform. By combining high-resolution NASA Lunar Reconnaissance Orbiter (LRO) LOLA digital elevation models with NAIF SPICE planetary ephemerides and Deep Space Network (DSN) ground station geometry, LightPath computes exact 360° topocentric terrain skylines, clips the true angular discs of the Sun (0.53°) and Earth (1.90°), and maps continuous direct-to-Earth communication availability.

Beyond static site assessment, LightPath introduces a signature **4D Space-Time Traverse Solver**: an A* algorithm navigating space and time $(x, y, t)$ across moving shadows and terrain slope hazards to determine whether rovers or crew can travel safely between surface points without running out of power or communication links.

Every calculation is independently verified against peer-reviewed literature (Barker et al. 2021) with shared Python and TypeScript mathematical test vectors matching to $< 10^{-14\circ}$. LightPath delivers instantaneous, actionable mission insight for scientists, flight planners, students, and the public.

---

## 2. The Problem

Commercial Lunar Payload Services (CLPS) landers and future Artemis rovers operate under severe physical constraints at the lunar south pole:
1. **Grazing Solar Angles**: Low solar elevation means near-field boulders and distant crater rims dictate illumination; standard flat-Moon approximations incur multi-degree errors.
2. **Dynamic Darkness Traps**: Shadow boundaries move constantly across polar craters; paths that are sunlit at dawn become sub-zero darkness traps within hours.
3. **Intermittent Earth Line-of-Sight**: Lunar libration causes Earth to oscillate near the horizon ($1.90^\circ$ apparent diameter), causing frequent terrain occlusions that disrupt Direct-To-Earth (DTE) communication.
4. **Toolchain Complexity**: Existing astrodynamics software requires heavy desktop installations, specialized training, and hours of computation time, locking out commercial providers, students, and mission designers who need immediate answers.

---

## 3. The Solution

LightPath democratizes lunar south pole mission planning through a zero-runtime-network, instant-loading web platform:
- **Instantaneous 360° Skyline Panorama**: Real-time rendering of the lunar horizon with true-scale celestial discs clipped by local topography.
- **Observer Mast Optimization**: Interactive sliders show how raising payload masts from 1 to 10 meters depresses apparent horizons and recovers lost illumination.
- **Multi-Lane Contact Timeline**: Tracks simultaneous solar illumination, Earth line-of-sight, and Deep Space Network (Goldstone, Madrid, Canberra) contact windows.
- **4D Space-Time Route Solver**: Plans viable traverses across moving shadow fields with mechanical slope safety constraints (Horn 1981 method) in under 1 second.
- **One-Page Printable Evidence Card**: Generates NASA-standard A4/Letter PDF briefing cards containing exact geodetic coordinates, kernel manifests, and SHA-256 provenance records.
- **Independent Verification Suite**: A public audit page proving calculation accuracy against published NASA benchmarks and 12 adversarial stress tests.

---

## 4. Use of NASA Space Agency Data & Open Science Assets

LightPath directly integrates authoritative NASA planetary datasets:
1. **NASA Lunar Reconnaissance Orbiter (LRO) LOLA DEMs**:
   - High-resolution gridded elevation models from the Lunar Orbiter Laser Altimeter team via the NASA Planetary Data System (PDS).
   - Referenced to the IAU Mean Earth/Polar Axis sphere ($R = 1,737,400.0\text{ m}$).
2. **NASA NAIF SPICE Toolkit & Ephemerides**:
   - Planetary ephemeris kernel DE440 and lunar orientation binary PCK kernels for subsolar and sub-Earth coordinate transformations.
3. **NASA Deep Space Network (DSN) 810-005 Documents**:
   - Telecommunications interface guidelines for Goldstone (DSS-14), Madrid (DSS-63), and Canberra (DSS-43) complexes, including geodetic coordinates and elevation masks.
4. **Published Literature Benchmark**:
   - Horizon profiles and solar percentage comparisons benchmarked against Barker, M. K., et al. (2021), *Planetary Science Journal*.

---

## 5. What Was Verified (Scientific Integrity & Rigour)

LightPath adheres strictly to **Rule 1: Correctness Before Features**:
- **106 Automated Pytest Tests** & **53 Vitest Tests** passing in automated CI.
- **V1–V8 Independent Verification Suite**:
  - V1: Spherical horizon dip angle ($h = 2\text{ m}$) matches exact analytical formula to $0.000^\circ$.
  - V2: Ridge elevation angle ($100\text{ m}$ at $10\text{ km}$) matches theoretical $0.408^\circ$ to $0.000^\circ$.
  - V3: Flat-horizon partial disc formula preserves strict monotonicity and symmetry to $10^{-15}$.
  - V4: 256-point Fibonacci spiral quadrature converges to within $0.002$ area fraction.
  - V5: South Pole IAU coordinate singularity resolves consistently with zero division errors.
  - V6: Shared mathematical vectors in Python and TypeScript agree to $< 10^{-14\circ}$.
  - V7: 12-case adversarial stress suite (pits, ridges, single-pixel spikes, tile edges, waiting) passes completely.
  - V8: Benchmark comparison against Barker et al. (2021) matches within $\pm 0.04^\circ$.

---

## 6. Operational Limitations & Disclaimers

In compliance with NASA Space Apps rules, LightPath states clear scientific boundaries:
- **Sun visibility is NOT electrical power**: Solar panel orientation, dust attenuation, incidence cosine losses, thermal derating, and battery capacities are not modeled.
- **Earth visibility is NOT an RF link budget**: Antenna gain patterns, transmitter power, terrestrial atmospheric losses, and data rates are not modeled.
- **Traverse routes are NOT flight-certified**: Sub-pixel boulders ($< 1\text{ m}$), rover wheel slip, and mechanical sinkage require localized ground-truth validation.

---

## 7. Project Links & Artifacts

- **Source Code Repository**: [https://github.com/AnmolGarg8/LightPath](https://github.com/AnmolGarg8/LightPath)
- **Live Web Application**: [https://AnmolGarg8.github.io/LightPath/](https://AnmolGarg8.github.io/LightPath/)
- **90-Second Guided Demo**: `https://AnmolGarg8.github.io/LightPath/#/?demo=1`
- **Headless Video Recording**: [`docs/demo.mp4`](demo.mp4) (Backup frames in [`docs/demo_frames/`](demo_frames/))
- **Technical Audit Report**: [`docs/AUDIT.md`](AUDIT.md)
- **Architecture Decision Records**: [`docs/DECISIONS.md`](DECISIONS.md)

---

## 8. Team Members & Contributions

| Member Name | Role | Primary Contributions |
| :--- | :--- | :--- |
| **Anmol Garg** | Project Lead & Astrodynamics Engineer | System architecture, SPICE & geodesy implementation, space-time A* solver, verification suite. |
| *[Team Member 2]* | *[To be completed by team]* | *[UI/UX, Frontend styling, Documentation]* |
| *[Team Member 3]* | *[To be completed by team]* | *[Science verification, Mission research]* |

---

## 9. AI Coding Tools Disclosure

In accordance with NASA Space Apps Challenge regulations, the team discloses that AI coding assistants (including Google Antigravity / Gemini 2.0) were utilized for code scaffolding, type generation, unit test creation, and documentation drafting. All scientific formulas, mathematical algorithms, SPICE integration paths, and verification tests were designed, verified, and audited against NASA peer-reviewed publications.
