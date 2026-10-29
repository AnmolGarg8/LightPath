# LightPath Celestial Disc Visibility & Statistical Window Analysis

This document provides the mathematical specifications, geometric derivations, numerical quadrature methods, uncertainty classification criteria, and event detection algorithms for the LightPath celestial visibility engine.

---

## 1. Celestial Disc Visibility Geometry

### 1.1 Analytical Flat-Horizon Disc Fraction
For an idealized horizontal knife-edge horizon, the visible fraction of a spherical celestial disc (Sun or Earth) is derived from circular segment geometry.

Let:
- $e$: topocentric elevation of the disc center relative to the horizon line (in degrees).
- $r$: angular radius of the celestial disc (in degrees, $r > 0$).
- $x$: normalized chord displacement parameter:
  $$x = \text{clip}\left(\frac{e}{r}, -1, 1\right)$$

The area of a circular segment of radius $r$ cut at normalized offset $x$ from the center is:
$$A_{\text{visible}}(x) = r^2 \left(\arccos(-x) + x \sqrt{1 - x^2}\right)$$

Dividing by the total disc area $\pi r^2$ yields the exact visible illuminated fraction:
$$\text{frac}_{\text{flat}}(e, r) = \frac{\arccos(-x) + x \sqrt{1 - x^2}}{\pi}$$

#### Fundamental Mathematical Properties:
1. **Half-Disc at Horizon ($e = 0$, $x = 0$)**:
   $$\text{frac}(0, r) = \frac{\arccos(0) + 0}{\pi} = \frac{\pi / 2}{\pi} = 0.5000$$
2. **Fully Above Horizon ($e \ge r$, $x = 1$)**:
   $$\text{frac}(r, r) = \frac{\arccos(-1) + 1 \times 0}{\pi} = \frac{\pi}{\pi} = 1.0000$$
3. **Fully Occulted ($e \le -r$, $x = -1$)**:
   $$\text{frac}(-r, r) = \frac{\arccos(1) - 1 \times 0}{\pi} = \frac{0}{\pi} = 0.0000$$
4. **Complementary Symmetry**:
   For any displacement $e \in [-r, +r]$:
   $$\text{frac}(e, r) + \text{frac}(-e, r) = 1.0000$$
5. **Strict Monotonicity**:
   $$\frac{d}{de}\left[\text{frac}_{\text{flat}}(e, r)\right] = \frac{2\sqrt{1 - x^2}}{\pi r} \ge 0$$
   The fraction strictly increases as $e$ increases from $-r$ to $+r$.

---

### 1.2 Variable-Horizon Numerical Integration (Fibonacci Quadrature)

Real lunar horizons are irregular, jagged topographic profiles $H(\alpha)$ defined as a function of topocentric azimuth $\alpha$. Computing disc visibility requires integrating over the disc area obstructed by $H(\alpha)$.

#### A. Equal-Area Fibonacci Spiral Quadrature
Quadrature sample points $i = 0, \ldots, N - 1$ are distributed across the circular disc using a golden-angle Fibonacci sunflower spiral:
- Golden angle:
  $$\phi = \pi (3 - \sqrt{5}) \approx 2.399963229728653\text{ rad} \approx 137.5077^\circ$$
- Normalized radius for sample $i$:
  $$r_i = r \sqrt{\frac{i + 0.5}{N}}$$
- Position angle:
  $$\theta_i = i \times \phi$$
- Sky elevation offset:
  $$\Delta\text{el}_i = r_i \cos\theta_i$$
- Sky cross-elevation horizontal offset:
  $$\Delta x_i = r_i \sin\theta_i$$

#### B. Azimuth Projection
Because lines of constant azimuth converge toward the topocentric zenith, a horizontal cross-elevation offset $\Delta x_i$ corresponds to an azimuth angular offset scaled by the secant of the elevation angle:
$$\Delta\alpha_i = \frac{\Delta x_i}{\cos(\text{el})}$$
*(where $\cos(\text{el})$ is clamped to $\ge 0.01$ to prevent numerical divergence near the zenith).*

The topocentric coordinates of sample ray $i$ are:
$$\alpha_i = (\alpha_{\text{body}} + \Delta\alpha_i) \pmod{360.0^\circ}$$
$$\text{el}_i = \text{el}_{\text{body}} + \Delta\text{el}_i$$

#### C. Periodic Horizon Interpolation
The horizon profile $H(\alpha)$ is naturally periodic with period $360.0^\circ$. Ray azimuths that straddle the Prime Meridian / South Pole reference axis ($0^\circ \equiv 360^\circ$) are interpolated without discontinuity:
- The discrete horizon grid is extended periodically by prepending $[H(\alpha) - 360^\circ]$ and appending $[H(\alpha) + 360^\circ]$.
- `np.interp` evaluates $H(\alpha_i)$ with exact circular boundary matching.

#### D. Sub-Sample Boundary Anti-Aliasing
Discrete binary counting of $N = 256$ sample points introduces a discretization error step of $1 / 256 \approx 0.0039$. To achieve sub-sample accuracy within $0.005$ ($0.5\%$ of disc area) for both Sun-size ($r = 0.267^\circ$) and Earth-size ($r = 0.950^\circ$) radii, `pipeline/visibility.py` incorporates Voronoi cell boundary smoothing:
Let $w = 0.5 \frac{r}{\sqrt{N}}$ represent the half-width of each sample point's elemental quadrature cell. For a sample ray with vertical margin $\Delta = \text{el}_i - H(\alpha_i)$:
$$\text{weight}_i = \text{clip}\left(0.5 + \frac{\Delta}{2w}, 0.0, 1.0\right)$$
- If $\Delta \ge w$: $\text{weight}_i = 1.0$ (fully visible).
- If $\Delta \le -w$: $\text{weight}_i = 0.0$ (fully blocked).
- If $|\Delta| < w$: smooth linear transition across the knife edge.

The visible disc fraction is the arithmetic mean across all $N$ samples:
$$\text{frac}_{\text{profile}} = \frac{1}{N} \sum_{i=0}^{N-1} \text{weight}_i$$

---

### 1.3 Tilted Knife-Edge Equivalence
For any locally linear horizon slope $H(\alpha) = H_0 + m(\alpha - \alpha_0)$ (where $m = \tan\psi$), circular symmetry dictates that the area cut off by the inclined line depends solely on the perpendicular distance from the disc center $(\alpha_0, \text{el}_0)$ to the line:
$$e_{\perp} = \frac{\text{el}_0 - H_0}{\sqrt{1 + m^2}}$$
When the disc center rests directly on the tilted horizon line ($\text{el}_0 = H_0$), $e_{\perp} = 0$, dividing the disc exactly in half ($\text{frac} = 0.5000$) regardless of slope $m$.
Numerical quadrature in `disc_fraction_profile` reproduces this analytic property to within $0.002$ of total area across all slopes.

---

## 2. Uncertainty Classification and Horizon Margins

Visibility answers must account for DEM vertical accuracy and spatial grid discretization. In accordance with **Rule 10**, `pipeline/visibility.classify_status` classifies visibility into three deterministic states:

### 2.1 Three-State Classification Criteria
Given an operational threshold $\tau \in [0, 1]$ (default $\tau = 0.50$) and an angular margin $\mu = \text{margin\_deg}$:
1. **Pessimistic Fraction ($f_{\text{pessimistic}}$)**: Evaluated with the horizon raised by $+\mu$ (higher terrain obstruction).
2. **Optimistic Fraction ($f_{\text{optimistic}}$)**: Evaluated with the horizon lowered by $-\mu$ (lower terrain obstruction).

The status is classified as:
$$\text{status} = \begin{cases}
\textbf{robust\_visible} & \text{if } f_{\text{pessimistic}} \ge \tau \text{ and } f_{\text{optimistic}} \ge \tau \\
\textbf{robust\_blocked} & \text{if } f_{\text{pessimistic}} < \tau \text{ and } f_{\text{optimistic}} < \tau \\
\textbf{marginal} & \text{otherwise}
\end{cases}$$

When $\mu = 0.0^\circ$, $f_{\text{pessimistic}} = f_{\text{optimistic}} = \text{frac}$, and the classification strictly reduces to the binary rule:
$$\text{status}_{\mu=0} = \begin{cases}
\textbf{robust\_visible} & \text{if } \text{frac} \ge \tau \\
\textbf{robust\_blocked} & \text{if } \text{frac} < \tau
\end{cases}$$

### 2.2 Angular Margin Derivation (`suggest_horizon_margin_deg`)
To determine a physically grounded $\text{margin\_deg}$, `suggest_horizon_margin_deg` combines two independent sources of topographic uncertainty:
1. **DEM Vertical Accuracy ($\sigma_z$)**:
   LOLA tracks exhibit typical absolute vertical accuracy $\sigma_z \approx 1.0\text{ m}$. At great-circle distance $D$, this produces an angular uncertainty of:
   $$\sigma_{\text{vert}} = \arctan\left(\frac{\sigma_z}{D}\right) \times \frac{180}{\pi}$$
2. **Spatial Grid Discretization ($\Delta x_{\text{res}}$)**:
   When moving between resolutions (e.g. $10\text{ m}$ fine vs $50\text{ m}$ coarse DEMs, $\Delta x = 40\text{ m}$), a terrain slope $\beta$ induces a vertical discretization variance $\Delta z = \Delta x \tan\beta$. At distance $D$:
   $$\sigma_{\text{res}} = \arctan\left(\frac{\Delta x \tan\beta}{D}\right) \times \frac{180}{\pi}$$

Combining both terms in quadrature (root-sum-square):
$$\text{margin\_deg} = \sqrt{\sigma_{\text{vert}}^2 + \sigma_{\text{res}}^2}$$

For a horizon feature at $D = 10\text{ km}$ with $\sigma_z = 1.0\text{ m}$, $\Delta x = 40\text{ m}$, and slope $\beta = 15^\circ$, the suggested margin is $\approx 0.062^\circ$.

---

## 3. Statistical Analysis & Event Detection (`pipeline/stats.py`)

### 3.1 Contiguous Window Analysis (`compute_window_statistics`)
Given an active boolean sequence $\mathbf{a} = [a_0, a_1, \ldots, a_{N-1}]$ indicating whether an operational condition is satisfied at each timestep:
- **Total Uptime**:
  $$\text{total\_uptime\_h} = \left(\sum_{i=0}^{N-1} a_i\right) \times \Delta t_{\text{hour}}$$
- **Uptime Fraction**:
  $$\text{uptime\_fraction} = \frac{1}{N} \sum_{i=0}^{N-1} a_i \in [0.0, 1.0]$$
- **Percentage Time Above**:
  $$\text{pct\_time\_above} = \text{uptime\_fraction} \times 100.0$$
- **Windows**: Contiguous runs of $a_i = \text{True}$. Each window records:
  $$\{\text{start\_utc}, \text{end\_utc}, \text{duration\_h}\}$$
- **Longest Window (`longest_window_h`)**: Maximum duration among all active contiguous runs.
- **Longest Outage (`longest_outage_h`)**: Maximum duration among all inactive ($a_i = \text{False}$) contiguous runs.

### 3.2 Joint Availability
1. **Sun and Earth Line-of-Sight (`sun_and_earth`)**:
   $$\text{joint}_{\text{sun, earth}} = (\text{frac}_{\text{sun}} \ge \tau_{\text{sun}}) \land (\text{frac}_{\text{earth}} \ge \tau_{\text{earth}})$$
2. **Sun and Direct-to-Earth Contact (`sun_and_dte`)**:
   $$\text{joint}_{\text{sun, dte}} = (\text{frac}_{\text{sun}} \ge \tau_{\text{sun}}) \land (\text{dte.link\_ok} = \text{True})$$

### 3.3 Event Detection (`detect_events`)
Detects threshold crossings between adjacent timesteps $i - 1$ and $i$:
- **Sunrise**: Solar fraction rises from $< \tau_{\text{sun}}$ to $\ge \tau_{\text{sun}}$.
  Records event name, exact `time_utc`, and solar topocentric azimuth $\alpha_{\odot}$.
- **Sunset**: Solar fraction drops from $\ge \tau_{\text{sun}}$ to $< \tau_{\text{sun}}$.
  Records event name, exact `time_utc`, and solar topocentric azimuth $\alpha_{\odot}$.
- **Earthrise**: Earth fraction rises from $< \tau_{\text{earth}}$ to $\ge \tau_{\text{earth}}$.
  Records event name, exact `time_utc`, and Earth topocentric azimuth $\alpha_{\oplus}$.
- **Earthset**: Earth fraction drops from $\ge \tau_{\text{earth}}$ to $< \tau_{\text{earth}}$.
  Records event name, exact `time_utc`, and Earth topocentric azimuth $\alpha_{\oplus}$.

### 3.4 Darkness Spells (`compute_darkness_spells`)
Quantifies consecutive outages where solar illumination falls below $\tau_{\text{sun}}$:
- `longest_darkness_h`: Longest continuous night/eclipse duration.
- `total_darkness_h`: Cumulative darkness hours over the observation period.
- `darkness_spells`: List of discrete darkness window intervals.

### 3.5 Contract Serialization (`summarize`)
`pipeline.stats.summarize(series, thresholds)` produces the stats JSON block strictly validated against `schemas/stats.schema.json`. It guarantees:
- `thresholds` block is permanently preserved.
- Four mandatory category summaries: `sun`, `earth`, `dte`, `joint`.
- All fields strictly match required types with `additionalProperties: false`.
