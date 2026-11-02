# LightPath Physics Notes

This document provides formal physical derivations, formulas, and quantitative calculations supporting scientific claims made throughout LightPath documentation and user interfaces, in strict compliance with **Rule 2: Never invent facts or citations**.

---

## 1. Topocentric Local Vertical Curvature Tilt

### 1.1 Formula
The Moon is modelled as a sphere with mean radius $R = 1,737.4\text{ km} = 1,737,400.0\text{ m}$ in the `MOON_ME` (Mean Earth/Polar Axis) frame, consistent with LOLA digital elevation model baselines (Archinal et al. 2018; Smith et al. 2010).

For two surface points separated by arc distance $\Delta s$, the angle subtended at the lunar centre—and therefore the angular tilt $\Delta \theta$ between their local vertical (zenith) outward unit vectors $\mathbf{u}_1$ and $\mathbf{u}_2$—is given by:

$$\Delta \theta_{\text{rad}} = \frac{\Delta s}{R}$$

Converting to degrees:

$$\Delta \theta_{\text{deg}} = \frac{\Delta s}{R} \times \left(\frac{180^\circ}{\pi}\right)$$

### 1.2 Quantitative Evaluation
For a surface traverse distance $\Delta s = 1.0\text{ km}$:

$$\Delta \theta_{\text{rad}} = \frac{1.0\text{ km}}{1,737.4\text{ km}} \approx 0.000575573\text{ rad}$$

$$\Delta \theta_{\text{deg}} = 0.000575573 \times \frac{180}{\pi} \approx 0.0329783^\circ \approx 0.033^\circ/\text{km}$$

For a traverse distance $\Delta s = 3.0\text{ km}$:

$$\Delta \theta_{\text{deg}} = 3.0 \times 0.0329783^\circ \approx 0.098935^\circ \approx 0.099^\circ \approx 0.10^\circ$$

### 1.3 Physical Implication
- Local vertical tilts by **$\approx 0.033^\circ$ per kilometre** (or **$\approx 0.10^\circ$ over $3\text{ km}$**).
- Statements asserting that local vertical tilts by $0.1^\circ/\text{km}$ are in error by a factor of 3 and have been corrected.
- Because lunar horizon margins for grazing polar sunlight are on the order of $0.05^\circ$ to $0.10^\circ$, computing local up per grid cell is physically necessary for traverses spanning several kilometres.

---

## 2. Lunar South Pole Shadow Sweep Speed

### 2.1 Context and Geometry
At the lunar south pole, the Moon's small obliquity to the ecliptic ($1.5424^\circ$) constrains solar elevation angles $\theta_{\text{sun}}$ to grazing angles between $-1.54^\circ$ and $+1.54^\circ$ relative to the mean horizontal plane. Elevated topographic massifs and crater rims cast shadows that extend tens of kilometres across adjacent low-lying terrain.

### 2.2 Rotational Angular Velocity
The Moon's rotation is synchronous with its orbital motion. The synodic period relative to the Sun (the lunar solar day) is:

$$T_{\text{synodic}} = 29.53059\text{ Earth days} = 708.734\text{ hours} = 2,551,443\text{ seconds}$$

The angular rotation rate of the Sun in local azimuth around the pole is:

$$\omega_{\text{sun}} = \frac{2\pi}{T_{\text{synodic}}} = \frac{2\pi}{2,551,443\text{ s}} \approx 2.4626 \times 10^{-6}\text{ rad/s}$$

In angular degrees:

$$\omega_{\text{sun}} = \frac{360^\circ}{708.734\text{ h}} \approx 0.5079^\circ/\text{hour} \approx 12.19^\circ/\text{day}$$

### 2.3 Shadow Geometry on a Local Plane
Consider an elevated ridge or massif of relief height $H$ casting a shadow across a relatively flat plain at solar elevation $\theta_{\text{sun}} > 0$. The cast shadow length $L$ along the ground is:

$$L = \frac{H}{\tan(\theta_{\text{sun}})}$$

For small solar elevations $\theta_{\text{sun}} \ll 1\text{ rad}$, $\tan(\theta_{\text{sun}}) \approx \theta_{\text{sun}}$.

### 2.4 Lateral Shadow Sweep Speed
As the Sun rotates in azimuth at angular rate $\omega_{\text{sun}}$, the shadow rotates like the spoke of a wheel. At distance $L$ from the obstruction (the shadow tip or shadow boundary), the lateral speed of the shadow edge is:

$$v_{\text{lateral}} = L \times \omega_{\text{sun}} = \frac{H}{\tan(\theta_{\text{sun}})} \times \omega_{\text{sun}}$$

#### Numerical Examples at Latitude $\phi \approx -89.5^\circ$ (e.g., Shackleton Crater Rim, $\sim 15.2\text{ km}$ from pole):
1. **Modest Ridge ($H = 100\text{ m}$, $\theta_{\text{sun}} = 1.0^\circ$):**
   - Shadow length: $L = 100 / \tan(1.0^\circ) \approx 5,729\text{ m} \approx 5.7\text{ km}$.
   - Lateral speed: $v_{\text{lateral}} = 5,729\text{ m} \times 2.4626 \times 10^{-6}\text{ rad/s} \approx 0.0141\text{ m/s} = 1.41\text{ cm/s} \approx 50.8\text{ m/hour}$.

2. **Prominent Massif ($H = 500\text{ m}$, $\theta_{\text{sun}} = 1.0^\circ$):**
   - Shadow length: $L = 500 / \tan(1.0^\circ) \approx 28,645\text{ m} \approx 28.6\text{ km}$.
   - Lateral speed: $v_{\text{lateral}} = 28,645\text{ m} \times 2.4626 \times 10^{-6}\text{ rad/s} \approx 0.0705\text{ m/s} = 7.05\text{ cm/s} \approx 254\text{ m/hour}$.

3. **Major Crater Rim / Peak ($H = 1,000\text{ m}$, grazing $\theta_{\text{sun}} = 0.5^\circ$):**
   - Shadow length: $L = 1,000 / \tan(0.5^\circ) \approx 114,590\text{ m} \approx 114.6\text{ km}$.
   - Lateral speed: $v_{\text{lateral}} = 114,590\text{ m} \times 2.4626 \times 10^{-6}\text{ rad/s} \approx 0.2822\text{ m/s} = 28.2\text{ cm/s} \approx 1.02\text{ km/hour}$.

### 2.5 Radial Shadow Extension / Contraction Speed
As solar elevation changes over the lunar month due to orbital precession and tilt, the rate of change of shadow length is:

$$\left|\frac{dL}{dt}\right| = \frac{H}{\sin^2(\theta_{\text{sun}})} \left|\frac{d\theta_{\text{sun}}}{dt}\right|$$

With maximum $|d\theta_{\text{sun}}/dt| \approx 1.54^\circ \times (2\pi / 27.212\text{ days}) \approx 0.00986^\circ/\text{hour} \approx 4.78 \times 10^{-8}\text{ rad/s}$:
- For $H = 500\text{ m}$, $\theta_{\text{sun}} = 1.0^\circ$:
  $$\left|\frac{dL}{dt}\right| \approx \frac{500}{(0.01745)^2} \times 4.78 \times 10^{-8} \approx 1,642,000 \times 4.78 \times 10^{-8} \approx 0.0785\text{ m/s} = 7.85\text{ cm/s} \approx 283\text{ m/hour}$$

### 2.6 Comparison with Lunar Rover Speeds
- **Uncrewed Robotic Exploration Rovers:**
  - NASA VIPER (Volatiles Investigating Polar Exploration Rover): nominal traverse speed is **$2.0\text{ cm/s}$ to $10.0\text{ cm/s}$** ($72\text{ m/h}$ to $360\text{ m/h}$), with maximum speed $\approx 20\text{ cm/s}$.
  - CNSA Chang'e-4 / Yutu-2: operational drive speed $\approx 5.0\text{ cm/s}$ ($180\text{ m/h}$).
  - ISRO Pragyan / Chandrayaan-3: drive speed $\approx 1.0\text{ cm/s}$ ($36\text{ m/h}$).
- **Crewed Rovers:**
  - Apollo Lunar Roving Vehicle (LRV): operational traverse speeds were **$8.0\text{ to }12.0\text{ km/h}$** ($2.2\text{ to }3.3\text{ m/s}$).

### 2.7 Conclusion & Documentation Policy
The calculated shadow sweep speeds ($1.4\text{ to }7.8\text{ cm/s}$, or $50\text{ to }280\text{ m/h}$) are **directly comparable to uncrewed robotic exploration rovers** (such as VIPER or Yutu-2), but **an order of magnitude slower than crewed rovers** (Apollo LRV). 

All project documents must qualify the comparison explicitly: "speeds comparable to an uncrewed robotic lunar rover (e.g. VIPER traverse speed $\sim 2-10\text{ cm/s}$)", avoiding ambiguous claims that shadows move at the speed of high-speed crewed vehicles.
