# LightPath: 90-Second Executive & Educational Demo Script

> **Purpose:** This script provides the authoritative narration and visual cues for communicators, judges, and educators presenting LightPath. It explains why lunar south-pole illumination is unique, how topography governs survival, and why the space-time route solver is our signature feature.

---

## Part 1: Interactive Educational Concepts (/explain)

### Step 1: The Sun Barely Rises at the Pole
- **The Core Fact:** The Moon’s equator is tilted only **1.54°** relative to the ecliptic plane. Unlike Earth, which experiences strong seasonal tilt (23.5°), the lunar poles never see the Sun rise high in the sky.
- **What You See:** The Sun skims the horizon, oscillating between **-1.5° and +1.5°** elevation over an 18.6-year nodal cycle. At polar ground level, solar elevation rarely exceeds 1.5° above the horizon.
- **Why It Matters:** Because the Sun is so low, even tiny topographic features cast enormous shadows across the landscape.
- **Rule 2 Notice:** Solar elevation numbers are derived from NASA LOLA topography and SPICE ephemerides (marked *verify until sourced* for external citations).

---

### Step 2: A Ridge Decides (Topography Rules Survival)
- **The Core Formula:** On a sphere of radius $R = 1,737.4\text{ km}$, a feature of height $z$ at ground distance $d$ has topocentric elevation:
  $$\text{el} = \text{atan2}((R + z) \cos(d/R) - (R + z_0), (R + z) \sin(d/R))$$
- **The Baseline Reality:** A ridge **100 metres high at a distance of 10 kilometres** subtends **+0.41°** of elevation.
- **The Consequence:** Because the solar angular diameter is **0.53°**, that single modest ridge will occult **more than 80%** of the solar disc! A lander parked in its shadow freezes in perpetual darkness.
- **Interactive Control:** Move the sliders from 0 to 500 m and 1 to 50 km to see the Sun disc clip in real time.

---

### Step 3: Earth is Wide (Communications Line of Sight)
- **The Contrast:** As seen from the Moon, Earth has an angular diameter of **~1.90°**—almost **four times wider** than the Sun!
- **What You See:** While the Sun is easily eclipsed by a small mound, Earth looms broad in the sky. Earthrise and Earthset are slow, grazing transitions lasting many hours.
- **Operational Reality:** Earth line-of-sight availability differs fundamentally from solar illumination. A rover may be in pitch darkness yet maintain unbroken high-bandwidth contact with Earth, or be bathed in sunlight while blocked from direct-to-Earth (DTE) communication.

---

### Step 4: The Light Moves, and So Can We (The Signature Feature)
- **The Problem:** Sun elevation changes slowly (~0.5° per Earth day), but shadows sweep across the terrain at tens of metres per hour. A pass that is sunlit at dawn becomes a frozen shadow trap by afternoon.
- **The Solution:** LightPath’s 4D space-time solver computes time-dependent traversability. Leaving at $T=0\text{h}$ allows a rover to traverse a ridge safely in continuous light; leaving just two hours later ($T=2\text{h}$) traps the rover in an advancing darkness shadow.
- **Takeaway:** Motion is survival. Timing your traverse is as vital as choosing your destination.

---

### Step 5: Why Trust It (Correctness Before Features)
- **Scientific Foundation:** Zero machine learning; zero runtime randomness. 
- **Verification Suite:** 93 automated tests verifying closed-form spherical trigonometry, SPICE ephemerides against JPL Horizons, and published NASA results (Barker et al. 2021 Connecting Ridge illumination: 86.1% vs 86.4%, within 0.3%).
- **Rule 8 Language:** We strictly say *"visible"*, not *"powered"*; *"in line of sight"*, not *"connected"*.

---

## Part 2: The 90-Second Guided Tour (?demo=1)

| Step | View Route | Time | Narration & Key Value |
|---|---|---|---|
| **1. Mission Browser** | `#/` | 10s | *"Welcome to LightPath. We evaluate lunar south-pole CLPS landing sites for light and link before hardware flies."* |
| **2. Horizon Panorama** | `#/site/...` | 12s | *"Here is the 360° terrain skyline. The Sun and Earth are drawn at true angular size, physically clipped by lunar ridges."* |
| **3. Mast Height Study** | `#/site/...` | 10s | *"Watch the horizon open as we raise the observer mast from 2m to 5m. A taller mast can double annual sunlight."* |
| **4. Direct-to-Earth Link** | `#/site/...` | 10s | *"The multi-lane timeline shows continuous Earth line of sight and DSN ground station visibility across Madrid, Goldstone, and Canberra."* |
| **5. Feasible Traverse** | `#/route/...` | 14s | *"Our signature feature: a 4D space-time solver. The rover navigates from the lander to an elevated ridge while staying in sunlight."* |
| **6. Suggested Relaxation** | `#/route/...` | 12s | *"When terrain or darkness blocks the path, LightPath explains why and suggests a mathematical relaxation you can apply in one click."* |
| **7. Evidence Card** | `#/evidence/...` | 12s | *"A single-page printable audit card with exact geodetic coordinates, kernel checksums, provenance hash, and synthetic watermark."* |
| **8. Trust & Verification** | `#/trust` | 10s | *"Every formula is backed by analytical tests and cross-checked with published NASA data. Trust is earned through math."* |

---

## Presenter Controls & Shortcuts
- **Spacebar:** Pause / Resume the guided tour.
- **Arrow Keys (← / →):** Step backward or forward through demo steps.
- **Key 'P':** Toggle **Presenter Mode** (enlarged typography, high contrast, secondary controls hidden).
- **URL Parameter `?kiosk=1`:** Automated looping mode for conference display booths with editing controls hidden.
