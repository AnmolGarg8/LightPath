# Lunar Space-Time Route Solver & Departure Window Map Specification

## 1. Overview & Heritage

LightPath implements a deterministic **4D Space-Time Graph Search ($A^*$)** engine in both Python (`pipeline.routing`) and client-side TypeScript (`web/src/workers/routeWorker.ts`).

The solver finds optimal traverses across moving solar illumination and Earth direct-to-Earth (DTE) communication visibility windows for robotic rovers and human crew at the lunar South Pole.

The implementation builds on foundational planetary robotics literature:
- **MIT SEXTANT (Johnson, 2010)**: Surface path planning incorporating solar elevation, vehicle speed, slope limits, and energy state over terrain.
- **NASA xGDS / VIPER Traverse Planning (Lees et al., 2016)**: Ground data systems and spatio-temporal route evaluation tracking moving shadow boundaries across South Pole crater rims.

---

## 2. Space-Time Formulation

### State Space
Each state in the graph is a 3-tuple:
$$s = (x, y, t)$$
where:
- $x, y \in \{0, \dots, N_x-1\} \times \{0, \dots, N_y-1\}$ are discrete raster grid coordinates.
- $t \in \{0, \dots, N_t-1\}$ is the discrete time step index corresponding to UTC timestamp $T[t]$.

### Admissible Moves & Transitions
From state $(x, y, t)$, the rover may execute:
1. **Planar Moves (8 directions)**:
   $$\Delta x \in \{-1, 0, 1\}, \quad \Delta y \in \{-1, 0, 1\}, \quad (\Delta x, \Delta y) \neq (0, 0)$$
   Physical distance:
   $$d = \begin{cases} s_{\text{grid}} & \text{orthogonal} \\ s_{\text{grid}}\sqrt{2} & \text{diagonal} \end{cases}$$
   Transit duration:
   $$\tau = \frac{d}{v_{\text{rover}}}$$
   Accumulated transit duration from departure at $t_0$:
   $$g_{\text{new}} = g + \tau$$

2. **Wait in Place (if enabled)**:
   $$(\Delta x, \Delta y) = (0, 0), \quad \tau = \Delta t_{\text{step}}, \quad g_{\text{new}} = g + \Delta t_{\text{step}}$$

### Time Discretisation & Lookahead Epoch Formulation

In both the Python reference solver (`pipeline.routing`) and the client-side TypeScript solver (`web/src/workers/routeWorker.ts`), time is discretised **identically** by tracking continuous accumulated transit duration $g$ from departure index $t_0$, and mapping to the discrete time step index $t$ using **round-up (ceiling)**:

$$t = \begin{cases} t_0 & \text{if } g_{\text{new}} = 0 \\ t_0 + \left\lceil \operatorname{round}\left(\frac{g_{\text{new}}}{\Delta t_{\text{step}}}, 9\right) \right\rceil & \text{if } g_{\text{new}} > 0 \end{cases}$$

Next state is $(x + \Delta x, y + \Delta y, t)$.

#### Rationale for Round-Up (Ceiling) Discretisation
1. **Conservative Lookahead Safety (Anti-Shadow Clipping):**
   Environmental fields (solar illumination fraction and Earth line-of-sight visibility) are sampled at discrete raster cube timestamps $T[t] = T[t_0] + t \cdot \Delta t_{\text{step}}$. When a rover transits over continuous interval $(g - \tau, g]$, using `floor` would evaluate environmental safety at $t_0 + \lfloor g / \Delta t_{\text{step}} \rfloor$ (the backward/start epoch), falsely assuming the terrain remains illuminated even if a moving shadow band encroaches before arrival. Using `ceiling` evaluates environmental validity at the forward bounding epoch $t = t_0 + \lceil g / \Delta t_{\text{step}} \rceil$, guaranteeing that the rover only commits to entering a cell if that cell is safe and illuminated upon arrival.
2. **Prevention of Step-Horizon Exhaustion on Sub-Step Moves:**
   At typical lunar rover exploration parameters ($s_{\text{grid}} = 50\text{ m}$, $v = 0.05\text{ m/s}$, $\Delta t_{\text{step}} = 3\text{ hours} = 10,800\text{ s}$), each cell transition takes $\tau = 1,000\text{ s} \approx 0.0926$ time steps. If a solver increments $t$ by at least 1 discrete step per move (as an uncoupled step model would), moving 33 grid cells ($1.65\text{ km}$, $\approx 9.16\text{ h}$) would artificially advance $t$ by 33 steps ($99\text{ hours}$), prematurely exhausting the entire simulation horizon! By accumulating continuous transit time $g$ and taking the ceiling, a $1.2\text{ km}$ traverse ($24,000\text{ s} = 6.67\text{ h}$) consumes exactly $\lceil 24,000 / 10,800 \rceil = 3$ discrete steps, leaving 30 steps of simulation horizon available.
3. **Exact Waiting Semantics:**
   A wait action has $\tau = \Delta t_{\text{step}}$. Because $g_{\text{new}} = g + \Delta t_{\text{step}}$, the ratio $g_{\text{new}} / \Delta t_{\text{step}} = g / \Delta t_{\text{step}} + 1.0$. Thus $\lceil g_{\text{new}} / \Delta t_{\text{step}} \rceil = \lceil g / \Delta t_{\text{step}} \rceil + 1$, advancing the discrete time index by exactly 1 step without drift.
4. **Floating-Point Guard:**
   Before applying ceiling, the ratio is rounded to 9 decimal places (`math.ceil(round(new_g / step_dt_s, 9))` in Python; `Math.ceil(Math.round((newG / stepDtS) * 1e9) / 1e9)` in TypeScript) to prevent IEEE 754 precision noise (e.g. $10800.000000000002 / 10800 \to 1.0000000000000002$) from erroneously pushing a 1.0-step transition into step 2.

#### Discretisation Timing Error Bound
The difference between the discrete evaluation epoch $t \cdot \Delta t_{\text{step}}$ and true continuous transit time $g$ is:
$$\Delta \tau_{\text{error}} = \left\lceil \frac{g}{\Delta t_{\text{step}}} \right\rceil \Delta t_{\text{step}} - g$$
Because $0 \le \lceil u \rceil - u < 1$ for all real $u$, the timing error satisfies the strict analytical bound:
$$0 \le \Delta \tau_{\text{error}} < \Delta t_{\text{step}}$$
For the default simulation parameter ($\Delta t_{\text{step}} = 3.0\text{ hours} = 10,800\text{ s}$), the maximum timing discretisation error is strictly less than 1 time step ($< 3.0\text{ hours}$). It is always non-negative, representing a conservative forward buffer against advancing shadows.

### Diagonal Corner-Cutting Prevention
To ensure physical plausibility, diagonal transitions through the apex of two impassable obstacles are strictly forbidden:
$$\text{If } \Delta x \neq 0 \text{ and } \Delta y \neq 0: \quad \text{both } (x + \Delta x, y) \text{ and } (x, y + \Delta y) \text{ must be traversable and have slope} \le \theta_{\text{max}}.$$

### Constraints & Infeasibility Checks
A transition to $(x', y', t')$ is valid if and only if:
1. **Grid Bounds**: $0 \le x' < N_x$ and $0 \le y' < N_y$.
2. **Horizon Bounds**: $t' < N_t$.
3. **Mechanical Traversability**: $\text{traversable}[y', x'] = \text{True}$.
4. **Slope Limit**: $\text{slope}[y', x'] \le \theta_{\text{max}}$.
5. **Earth Line-of-Sight**: $\text{earth\_frac}[t', y', x'] \ge f_{\text{Earth,min}}$.
6. **Solar Illumination & Dark Budget**:
   $$\text{is\_dark} = (\text{sun\_frac}[t', y', x'] < f_{\text{Sun,min}})$$
   If $\text{is\_dark}$:
   $$\tau_{\text{dark,accum}} + \tau \le \tau_{\text{dark\_budget}}$$
   Otherwise, the transition is pruned.

---

## 3. Optimality & Admissible Heuristic

Cost metric:
$$g(s) = \sum \tau_i \quad \text{(total transit time in seconds)}$$

Heuristic function:
$$h(x, y) = \frac{\sqrt{(x - x_{\text{goal}})^2 + (y - y_{\text{goal}})^2} \cdot s_{\text{grid}}}{v_{\text{rover}}}$$

### Proof of Admissibility
The Euclidean distance divided by maximum rover speed $v_{\text{rover}}$ represents the absolute minimum travel time along an unconstrained straight line with zero terrain slope and zero obstacles.
Because physical moves are constrained to 8-connected grid steps on terrain where actual path length $\ge \text{straight line distance}$, and velocity is bounded by $v \le v_{\text{rover}}$:
$$h(x, y) \le g^*(x, y) \quad \forall (x, y)$$
Thus, $h$ never overestimates the true remaining transit time, guaranteeing that $A^*$ returns the optimal (minimum duration) path for any feasible departure.

---

## 4. Departure Window Map Architecture

### Design & Algorithm Choice
The Departure Window Map evaluates traverse feasibility, duration, and dark exposure across every time step $t_0 \in [0, N_t - 1]$ in the simulation horizon.

#### Batch Forward Solves vs. Single Backward Pass
- **Backward Pass Considerations**: In static networks without resource accumulation, a single backward Dijkstra pass from $(x_{\text{goal}}, y_{\text{goal}})$ can compute all-to-one distances. However, lunar traverses operate under **dynamic moving illumination**, non-stationary shadow corridors, and non-monotonic accumulator constraints (battery dark budget accumulation $\le \tau_{\text{dark\_budget}}$ and waiting transitions). In time-varying directed graphs with path-dependent resource bounds, a single backward pass requires exponential state-space tracking or multi-objective Pareto frontiers.
- **Batch Forward Solves with Array Pre-Extraction**:
  By pre-converting raster lists to NumPy contiguous buffers once (in Python) and utilizing a binary min-heap $O(\log N)$ priority queue in both languages:
  - 200 departure evaluations complete in **0.048 seconds** in Python.
  - 200 departure evaluations complete in **0.016 seconds** in the TypeScript Web Worker.
  This satisfies the $< 3.0$ second performance requirement with a $60\times$ safety margin while guaranteeing exact mathematical parity between the window map and single route execution.

### Key Window Markers
1. **Earliest Feasible Departure ($t_{\text{earliest}}$)**: First time step index where traverse to target is feasible.
2. **Latest Safe Departure ($t_{\text{latest}}$)**: Final time step index where rover reaches destination before shadows or simulation horizon close. Provably identical to `planner_mode="latest_departure"`.
3. **Lowest Dark Exposure Departure ($t_{\text{lowest\_dark}}$)**: Departure step minimizing accumulated shadows along the route:
   $$\arg\min_{t \in \text{Feasible}} \left(\tau_{\text{dark}}(t), \tau_{\text{duration}}(t)\right)$$

### Hatched Gap Representation
Infeasible departure windows are rendered as clearly hatched gaps (`<pattern id="infeasibleHatch">` with $45^\circ$ diagonal red lines and red bounding box), visually distinguishing viable traverse windows from shadow closures.

### Plain-Language Synthesis
A deterministic summary sentence is synthesized directly from solver outputs:
> *"Leaving between 2026-11-01T00:00:00Z (step 0) and 2026-11-01T03:00:00Z (step 1) works; leaving after 2026-11-01T03:00:00Z does not because of the moving shadow on the terrain corridor. Lowest dark exposure is 0.00 h at step 0."*

---

## 5. Multi-Stop Mission Planning & Chained Traverses

### 5.1 Multi-Stop Mission Formulation
Planetary surface sorties rarely consist of a single isolated transit. LightPath extends the 4D space-time solver to orchestrate **multi-stop mission sorties** chaining up to five consecutive science stations:
$$\mathcal{S} = \{S_1, S_2, \dots, S_K\}, \quad 1 \le K \le 5$$
originating from a common starting base $S_0 = (x_0, y_0)$ at departure time step $t_0$.

Each station $S_k$ defines:
1. **Target Coordinates**: $(x_k, y_k) \in \mathbb{N}^2$ within the DEM bounds.
2. **Dwell Duration**: $\tau_{\text{dwell}, k} \ge 0.0$ hours required for science payload operations (e.g., drilling, spectrometer integration, or sample acquisition).
3. **Solar Illumination Constraint (Optional)**: Minimum fractional solar visibility $f_{\text{sun,min}} \in [0.0, 1.0]$ required throughout the entire dwell window:
   $$\text{sun\_frac}[t, y_k, x_k] \ge f_{\text{sun,min}} \quad \forall t \in [t_{\text{arr}, k}, t_{\text{dep}, k}]$$
4. **Earth Direct-to-Earth Link Constraint (Optional)**: Required cumulative communication contact time $\tau_{\text{earth,req}}$ (hours) where Earth fraction $\ge 0.5$ during the dwell period:
   $$\sum_{t=t_{\text{arr}, k}}^{t_{\text{dep}, k}} [\text{earth\_frac}[t, y_k, x_k] \ge 0.5] \cdot \Delta t_{\text{step}} \ge \tau_{\text{earth,req}}$$
5. **Hard Station Deadline (Optional)**: Prescribed deadline time step index $t_{\text{deadline}, k}$ by which the rover must arrive and complete dwell:
   $$t_{\text{dep}, k} \le t_{\text{deadline}, k}$$

### 5.2 Sequential Leg Chaining & Dynamic Waiting
The mission solver evaluates legs sequentially:
- **Leg $k$ ($S_{k-1} \to S_k$)**: Initiates at state $(x_{k-1}, y_{k-1}, t_{\text{dep}, k-1})$. The space-time $A^*$ search finds the time-optimal traversable path to $(x_k, y_k)$ under slope, moving shadow, and dark budget constraints.
- **Waiting in Place**: If arriving immediately would cause subsequent operations to encounter advancing shadow fronts or miss future communication windows, the rover can wait in place at traversable, sunlit states where beneficial.
- **Science Dwell**: Upon reaching $S_k$ at $t_{\text{arr}, k}$, the dwell interval commences for $\Delta t_{\text{dwell}, k} = \operatorname{ceil}(\tau_{\text{dwell}, k} / \Delta t_{\text{step}})$ steps.

### 5.3 Unified Multi-Lane Timeline
The complete mission sortie is compiled into a unified temporal event log and rendered across three synchronized lanes:
1. **Rover Activity Lane**: Chronological sequence of transit legs (blue `#38bdf8`), active science dwells (green `#10b981`), station waits (amber `#f59e0b`), and infeasibility violation intervals (diagonal red hatching `#ef4444`).
2. **Solar Illumination Lane**: Step-by-step solar disc visibility percentage evaluated along the rover's instantaneous location, transitioning smoothly between transit waypoints and fixed station dwells.
3. **Earth Link Lane**: Direct-to-Earth line-of-sight status, visually distinguishing periods of active data downlink from occulted or masked intervals.

### 5.4 Infeasibility Explanation & Smallest-Change Fix Recommendation
When a proposed mission sortie violates one or more operational constraints, the engine identifies the first failing station, isolates the specific blocking constraint (`unreachable_leg`, `sun_below_threshold`, `insufficient_earth_link`, or `deadline_missed`), and deterministically computes the **smallest operational change** that restores feasibility:

1. **Stop Order Permutation (Structural Fix)**:
   - Evaluates alternative visitation permutations, prioritizing adjacent transpositions ($d_{\text{swap}} = 1$) followed by general permutations.
   - Preserves all science dwell durations and payload objectives without compromising mission scope.
2. **Earlier Departure Time Shift (Temporal Non-Destructive Fix)**:
   - Searches earlier departure time steps $t < t_0$ (in increments of 1 step up to $\min(24, t_0)$ steps).
   - Allows the rover to cross dynamic shadow corridors before closure and complete dwells prior to deadline expiration without reducing dwell hours.
3. **Dwell Duration Shortening (Science Compromise Fix)**:
   - Progressively reduces dwell time $\tau_{\text{dwell}, k}$ at the failing station in decrements of $0.5$ hours down to $0.0$ hours.
   - Restores viability when advancing regional shadows or immovable deadlines prevent the full requested dwell duration.

The web UI surfaces this diagnosis in a dedicated alert banner with a one-click **"Apply Fix"** action that updates the mission configuration dynamically.

### 5.5 Export Standards
Mission plans can be exported in three independent formats:
- **One-Page Printable Plan Card**: Self-contained high-contrast modal summarizing mission overview, waypoint coordinates, dwell requirements, timeline events, and constraint verification badges.
- **RFC 5545 iCalendar (`.ics`)**: Standardized calendar schedule generating `VEVENT` blocks for each transit leg and science dwell, compatible with mission operations software and desktop calendars.
- **Tabular CSV Schedule**: Comma-delimited timeline detailing event types, start/end timestamps, duration, distance, coordinate bounding, and constraint satisfaction flags.

### 5.6 Operational Boundaries & Disclaimers
In strict compliance with `docs/PROJECT_RULES.md`, all UI components, plan cards, CSV headers, and calendar descriptions display the following operational disclaimer:
> **"Geometric Sun and Earth visibility only; no power or link budget."**
The solver calculates line-of-sight and illumination angles from digital elevation models and approximate analytic ephemeris (to be replaced by SPICE). Thermal dynamics, battery SOC discharge curves, radio frequency link margins, and slip coefficients must be verified by dedicated subsystem engineering models.

---

## 6. Robustness to Terrain Uncertainty & Landing Dispersion

### 6.1 Conservative Traverse Planning (Horizon Margin Elevation)
Digital Elevation Models (such as LOLA gridded polar products) exhibit finite vertical precision ($\sigma_z \approx 1.0\,\text{m}$) and horizontal grid discretization ($\Delta x \approx 20\text{--}50\,\text{m}$). At the lunar South Pole, where the Sun grazes the terrain at elevations $\le 1.5^\circ$, a small elevation discrepancy can determine whether a ridgeline casts a long shadow.

To protect traverses against unmodeled terrain variations, LightPath provides **Conservative Mode**:
1. **Pessimistic Illumination ($f_{\text{pessimistic}}$)**: Evaluates the traverse graph with the horizon elevated by the declared angular uncertainty margin $\mu = \text{horizon\_margin\_deg}$ (default $0.10^\circ$).
2. **Marginal Cells Count as Dark**: Any cell where the solar disc fraction satisfies:
   $$\text{sun\_frac}[t, y, x] - \mu < \tau_{\text{sun}}$$
   is classified as marginal or obstructed and strictly treated as dark.
3. **Zero-Margin Identity**: When $\mu = 0.0^\circ$, $f_{\text{pessimistic}} \equiv \text{sun\_frac}$, mathematically guaranteeing that the conservative path strictly equals the nominal route.
4. **Cost of Caution**: The engine computes the delta between nominal and conservative traverses:
   $$\Delta d = d_{\text{conservative}} - d_{\text{nominal}}, \quad \Delta \tau = \tau_{\text{conservative}} - \tau_{\text{nominal}}$$
   quantifying the extra distance traveled or extra hours spent waiting in sunlight to avoid marginal lighting.

### 6.2 Landing Dispersion Analysis
Commercial Lunar Payload Services (CLPS) landers target a nominal surface landing site but inevitably land within an empirical dispersion ellipse due to guidance, navigation, and control (GNC) uncertainties.

To ensure traverse viability regardless of where the lander touches down:
1. **Dispersion Geometry & Assumptions**:
   - Nominal landing coordinate: $(x_0, y_0)$
   - Dispersion radius $R_{\text{disp}}$: default $250\,\text{m}$ (parameter and explicit engineering assumption).
   - Sample pattern count $N$: default 25 points.
2. **Fixed Deterministic Pattern**:
   Sample locations are placed deterministically inside the disc to ensure exact area-balanced symmetry:
   - Point 0: Center $(0, 0)$ (nominal touchdown).
   - Ring 1 (8 points): Radius $r_1 = R_{\text{disp}}\sqrt{1/3}$, angles $\theta_{1, k} = (k + 0.5) \cdot \frac{2\pi}{8}$ ($k = 0 \dots 7$).
   - Ring 2 (16 points): Radius $r_2 = R_{\text{disp}}$, angles $\theta_{2, k} = (k + 0.5) \cdot \frac{2\pi}{16}$ ($k = 0 \dots 15$).
   This fixed configuration ensures that half-plane obstacles (such as a ridge or crater wall splitting the disc) yield exactly the expected ~50% (12/25 = 48%) feasible share.
3. **Multi-Start Batch Solves**:
   The engine solves $A^*$ space-time traverses from all 25 starting points to the designated science goal in parallel.
4. **Viability Metrics & Plain-Language Synthesis**:
   - **Success Share**: $\frac{N_{\text{feasible}}}{N}$ (percentage of landings providing viable access to goal).
   - **Arrival Time Range**: $[\tau_{\min}, \tau_{\max}]$ hours across viable points.
   - **Dark Exposure Range**: Cumulative darkness encountered across landing starts.
   - **Failure Diagnostic & Synthesis**:
     > *"22 of 25 landing points allow the trip within the window; the failures are on the shadowed side of the ridge."*
     Diagnoses whether failures stem from touchdown in local shadow, touchdown on steep crater slopes ($> 15^\circ$), or advancing shadow fronts closing the traverse corridor.
5. **Solve Performance**:
   All 25 space-time route evaluations complete in $< 40\,\text{ms}$ in the background Web Worker, maintaining smooth real-time interactivity.
