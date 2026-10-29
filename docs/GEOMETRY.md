# LightPath Geometry & Topocentric Transformations Reference

This document provides the mathematical specifications, reference frames, algorithms, and SPICE integration details for [`pipeline/geometry.py`](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/pipeline/geometry.py) and [`pipeline/dsn.py`](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/pipeline/dsn.py).

---

## 1. Reference Datums & Frames

### Lunar Datum
- **Reference Radius**: $R_{\text{moon}} = 1,737,400.0\text{ m}$ ($1,737.4\text{ km}$).
- **Datum Frame**: Moon Mean Earth/Polar Axis frame (`MOON_ME`).
  - Origin: Lunar center of mass.
  - $+Z$ axis: Moon mean axis of rotation (North pole).
  - $+X$ axis: Directed along the mean sub-Earth point (longitude 0°, latitude 0°).
  - $+Y$ axis: Completes the right-handed Cartesian frame ($+90^\circ$ East longitude).

### Earth Body-Fixed Frame
- **Frame**: International Terrestrial Reference Frame (`ITRF93`) or `IAU_EARTH`.
- **Ellipsoid**: WGS84 ($a = 6,378.137\text{ km}$, $f = 1 / 298.257223563$).

---

## 2. Mathematical Formulations

### A. Exact Spherical Curvature Elevation
Terrain heights $z$ from LOLA are referenced to the $R_{\text{moon}} = 1,737,400\text{ m}$ sphere:
- Observer radius: $r_0 = R + z_{\text{ground}} + z_{\text{mast}}$.
- Terrain sample radius at angular distance $\theta = d / R$: $r = R + z$.
- Apparent elevation angle $\text{el}$ above the local observer horizontal plane:
  $$\Delta y = (R + z)\cos(\theta) - (R + z_0)$$
  $$\Delta x = (R + z)\sin(\theta)$$
  $$\text{el} = \text{atan2}(\Delta y, \Delta x)$$
  $$\text{el}_{\text{deg}} = \frac{180}{\pi} \text{el}$$

### B. Local ENU Orthonormal Basis
For a point at latitude $\phi$ and east longitude $\lambda$:
$$\mathbf{u} = [\cos(\phi)\cos(\lambda), \cos(\phi)\sin(\lambda), \sin(\phi)]^T \quad (\text{Zenith / Up})$$
$$\mathbf{e} = [-\sin(\lambda), \cos(\lambda), 0]^T \quad (\text{East})$$
$$\mathbf{n} = [-\sin(\phi)\cos(\lambda), -\sin(\phi)\sin(\lambda), \cos(\phi)]^T \quad (\text{North})$$
$$\mathbf{e} \times \mathbf{n} = \mathbf{u} \quad (\text{Right-handed})$$

#### Pole Degeneracy Handling
At polar latitudes ($\phi \to \pm 90^\circ$), meridians converge:
- **South Pole ($\phi = -90^\circ$)**:
  $$\mathbf{u} = [0, 0, -1]^T$$
  $$\mathbf{n} = [1, 0, 0]^T \quad (\text{Defined toward the Prime Meridian / sub-Earth point } +X)$$
  $$\mathbf{e} = [0, 1, 0]^T \quad (\text{Pointing toward } +90^\circ\text{ East longitude } +Y)$$
  $$\mathbf{e} \times \mathbf{n} = [0, 1, 0] \times [1, 0, 0] = [0, 0, -1] = \mathbf{u}$$
- **North Pole ($\phi = +90^\circ$)**:
  $$\mathbf{u} = [0, 0, 1]^T, \quad \mathbf{n} = [-1, 0, 0]^T, \quad \mathbf{e} = [0, 1, 0]^T, \quad \mathbf{e} \times \mathbf{n} = \mathbf{u}$$

### C. Topocentric Azimuth, Elevation & Range
Given target position $\mathbf{r}_{\text{target}}$ and site position $\mathbf{r}_{\text{site}}$ in `MOON_ME`:
$$\mathbf{v} = \mathbf{r}_{\text{target}} - \mathbf{r}_{\text{site}}$$
$$e = \mathbf{v} \cdot \mathbf{e}, \quad n = \mathbf{v} \cdot \mathbf{n}, \quad u = \mathbf{v} \cdot \mathbf{u}$$
$$\text{az} = \text{atan2}(e, n) \pmod{360^\circ}$$
$$\text{el} = \text{atan2}(u, \sqrt{e^2 + n^2})$$
$$\text{range} = ||\mathbf{v}||$$

### D. Apparent Angular Radii
- **Sun**: $R_{\odot} = 695,700\text{ km}$ (IAU 2015 resolution).
  $$\theta_{\text{sun}} = \arcsin\left(\frac{R_{\odot}}{\text{range}_{\odot}}\right) \approx 0.267^\circ$$
- **Earth**: $R_{\oplus} = 6,371\text{ km}$ (Volumetric mean radius).
  $$\theta_{\text{earth}} = \arcsin\left(\frac{R_{\oplus}}{\text{range}_{\oplus}}\right) \approx 0.95^\circ$$

### E. Earth Shadow on Moon (Lunar Eclipse Check)
Evaluates whether the Earth occults the Sun as observed from the lunar site:
1. Apparent separation between Sun and Earth centers:
   $$\theta_{\text{sep}} = \arccos(\hat{\mathbf{v}}_{\odot} \cdot \hat{\mathbf{v}}_{\oplus})$$
2. Total eclipse (umbra): $\theta_{\text{sep}} \le \theta_{\text{earth}} - \theta_{\text{sun}}$ (obscuration fraction = 1.0).
3. No eclipse: $\theta_{\text{sep}} \ge \theta_{\text{earth}} + \theta_{\text{sun}}$ (obscuration fraction = 0.0).
4. Partial eclipse (penumbra): Two-circle intersection area over total solar disc area.

---

## 3. DSN Station Visibility & Direct-To-Earth (DTE) Contact

### Ground Stations
Loaded from `configs/dsn_stations.yaml` (Goldstone DSS 14, Madrid DSS 63, Canberra DSS 43). Shipped with placeholders marked `verified: false` per Rule 2.

### Direct-To-Earth Contact Formula
DTE contact is active at time $t$ if and only if:
$$\text{DTE}(t) = \left(\text{earth\_frac}(t) \ge \text{threshold}\right) \land \left(\bigvee_{s \in \text{Stations}} \text{el}_s(t) \ge \text{mask}_s\right)$$

---

## 4. Kernel Dependencies & Verification Status

When physical SPICE kernels (`de421.bsp`, `naif0012.tls`, `pck00010.tpc`, `moon_pa_de421_1900-2050.bpc`) are downloaded:
- High-precision planetary ephemeris calls `spice.spkpos`.
- Direct az/el computation cross-checks with `spice.azlcpo`.
- ITRF93 Earth orientation and station positions use `spice.georec`.

When kernels are absent:
- Clean analytical ephemeris (IAU GMST rotation and lunar libration series) provides exact deterministic verification.
- Two kernel tests (`test_spice_kernel_load_and_unload`, `test_cross_check_with_azlcpo`) and the Horizons fixture benchmark are cleanly skipped with instructions.
