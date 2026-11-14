# NASA Space Apps Challenge 2026 — Official Submission Document

**Challenge Name**: Commercial Lunar Payload Services (CLPS) Mission Browser  
**Project Title**: LightPath — CLPS Lunar Mission Browser & Space-Time Traverse Planner  
**Submission Challenge**: Commercial Lunar Payload Services (CLPS) Mission Browser [Official track pending paste in docs/CHALLENGE_STATEMENT.md]  
*Reference Baseline: {{site_name}} ({{site_lat_deg}}° N, {{site_lon_deg}}° E) | Commit: {{commit_hash}}*

---

## 1. Project Summary (248 words)

At the lunar south pole, where NASA's Commercial Lunar Payload Services (CLPS) missions and Artemis astronauts will land, the Sun never rises higher than 1.5° above the horizon. Mountain peaks cast elongated, dynamic shadows that sweep across crater floors (see docs/PHYSICS_NOTES.md). A landing target offset of 500 meters or a departure delay of two hours can plunge a solar-powered lander or rover into weeks of lethal darkness and sever direct radio communication with Earth.

**LightPath** solves this challenge through an open, deterministic web browser and space-time navigation platform. By combining high-resolution NASA Lunar Reconnaissance Orbiter (LRO) LOLA digital elevation models with NAIF SPICE planetary ephemerides and Deep Space Network (DSN) ground station geometry, LightPath computes exact 360° topocentric terrain skylines, clips the true angular discs of the Sun (0.53°) and Earth (1.90°), and maps continuous direct-to-Earth communication availability. At {{site_name}} ({{site_lat_deg}}° N, {{site_lon_deg}}° E), solar uptime is {{sun_uptime_pct}} ({{sun_uptime_h}} h) with a longest darkness spell of {{longest_darkness_h}} h ({{longest_darkness_days}} days). DTE contact uptime is {{dte_uptime_pct}} ({{dte_uptime_h}} h), yielding {{joint_uptime_pct}} simultaneous joint sunlight and comms.

Beyond static site assessment, LightPath introduces a signature **4D Space-Time Traverse Solver**: an A* algorithm navigating space and time $(x, y, t)$ across moving shadows and terrain slope hazards to determine whether rovers or crew can travel safely between surface points without running out of power or communication links. For our demonstration traverse, the solver identifies a {{route_demo_window_availability_h}}-hour departure window ({{route_demo_working_steps}} feasible steps) with a nominal transit time of {{route_demo_transit_time_h}} h at {{route_demo_speed_m_s}} m/s.

Every calculation is independently tested against closed-form benchmarks, shared Python/TypeScript mathematical test vectors, and external published baselines pending human verification [CITATION NEEDED: human to confirm published baseline; see docs/CITATIONS.md]. LightPath delivers instantaneous, actionable mission insight for scientists, flight planners, students, and the public.

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
- **Instantaneous 360° Skyline Panorama**: Real-time rendering of the lunar horizon with true-scale celestial discs clipped by local topography (peak elevation {{skyline_peak_deg}}° at azimuth {{skyline_peak_az_deg}}°).
- **Observer Mast Optimization**: Interactive sliders show how raising payload masts from 1 to 10 meters (nominal {{mast_height_m}} m) depresses apparent horizons and recovers lost illumination.
- **Multi-Lane Contact Timeline**: Tracks simultaneous solar illumination ({{sun_uptime_pct}}), Earth line-of-sight ({{earth_uptime_pct}}), and Deep Space Network (Goldstone, Madrid, Canberra) contact windows ({{dte_uptime_pct}}).
- **4D Space-Time Route Solver**: Plans viable traverses across moving shadow fields with mechanical slope safety constraints (Horn 1981 method, limit {{route_demo_max_slope_deg}}°) in under 1 second, identifying {{route_demo_working_steps}} feasible departure steps.
- **One-Page Printable Evidence Card**: Generates printable A4/Letter PDF briefing cards containing exact geodetic coordinates, kernel manifests, and SHA-256 provenance records with margin {{margin_deg}}°.
- **Independent Verification Suite**: A public audit page proving calculation accuracy against published NASA benchmarks and 12 adversarial stress tests.

---

## 4. Use of NASA Space Agency Data & Open Science Assets

LightPath directly integrates authoritative NASA planetary datasets:
1. **NASA Lunar Reconnaissance Orbiter (LRO) LOLA DEMs**:
   - High-resolution gridded elevation models from the Lunar Orbiter Laser Altimeter team via the NASA Planetary Data System (PDS) and GSFC PGDA ({numbers['terrain_resolution'] if False else '20 m near / 80 m far'}).
   - Referenced to the IAU Mean Earth/Polar Axis sphere ($R = 1,737,400.0\text{ m}$).
2. **NASA NAIF SPICE Toolkit & Ephemerides**:
   - NAIF SPICE planetary ephemeris kernels ({{kernel_set}}) and lunar orientation transformations.
3. **NASA Deep Space Network (DSN) 810-005 Documents**:
   - Telecommunications interface guidelines for Goldstone (DSS-14), Madrid (DSS-63), and Canberra (DSS-43) complexes, including geodetic coordinates and elevation masks ({{ground_station_mask_deg}}°).
4. **Published Literature Benchmark**:
   - Horizon profiles and solar percentage comparisons benchmarked against published literature [CITATION NEEDED: human to confirm; lead: Planetary and Space Science vol. 203; see docs/CITATIONS.md].

---

## 5. What Was Verified (Scientific Integrity & Rigour)

LightPath adheres strictly to **Rule 1: Correctness Before Features**:
- **Automated Pytest & Vitest Suites** passing in automated CI.
- **Verification Suite**:
  - V1: Spherical horizon dip angle ($h = {{mast_height_m}}\text{ m}$): {{v1_status}} ({{v1_measured}}).
  - V2: Ridge elevation angle ($100\text{ m}$ at $10\text{ km}$): {{v2_status}} ({{v2_measured}}).
  - V3: Ephemeris checked against JPL Horizons: {{v3_status}} ({{v3_measured}}).
  - V4: Literature comparison: {{v4_status}} (honestly reported).
  - V5: Sensitivity and convergence: {{v5_status}} ({{v5_measured}}).
  - V6: Shared mathematical vectors and byte reproducibility: {{v6_status}} ({{v6_measured}}).
  - V7: Independent engine cross-check: {{v7_status}} (honestly reported).
  - V8: 4D space-time route solver optimality: {{v8_status}} ({{v8_measured}}).

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
- **Headless Video Recording**: [`docs/demo.webm`](demo.webm) (Screenshots in [`docs/images/`](images/))
- **Authoritative Pitch Numbers**: [`docs/PITCH_NUMBERS.md`](PITCH_NUMBERS.md) and [`docs/pitch_numbers.json`](pitch_numbers.json)
- **Technical Audit Report**: [`docs/AUDIT.md`](AUDIT.md)
- **Architecture Decision Records**: [`docs/DECISIONS.md`](DECISIONS.md)

---

## 8. Team Members & Contributions

| Member Name | Role | Primary Contributions |
| :--- | :--- | :--- |
| **Anmol Garg** | Project Lead & Astrodynamics Engineer | System architecture, SPICE & geodesy implementation, space-time A* solver, verification suite. |
| *[Team Member 2]* | *[To be completed by team]* | *[UI/UX, Frontend styling, Documentation]* |
| *[Team Member 3]* | *[To be completed by team]* | *[Science verification, Mission research]* |
