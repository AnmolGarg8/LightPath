# Proof of Authenticity, Sensitivity, and Mathematical Soundness: SPICE vs. JPL Horizons Benchmark (Tasks S0b & S0c)

**Date:** 2026-11-07  
**Branch:** `data-acquisition`  
**Governing Policy:** [PROJECT_RULES.md](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/docs/PROJECT_RULES.md) (Rule 2: Never invent facts; Rule 8: Offline determinism; Rule 9: Full provenance; Rule 10: Fail loud).  
**Script & Test Implementations:**
- [pipeline/constants.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/pipeline/constants.py): defines canonical validation aberration `ABCORR_FOR_VALIDATION = "LT+S"`
- [scripts/baseline_report.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/scripts/baseline_report.py): reconciled accuracy benchmark evaluating all 721 hourly samples
- [tests/test_verification.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/tests/test_verification.py): V3 test reading fixtures directly, evaluating all 721 rows at tightened $0.01^\circ$ tolerance
- [tests/test_v3_fault_injection.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/tests/test_v3_fault_injection.py): fault-injection suite asserting failures under perturbed physics
- [scripts/audit_horizons_fixtures.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/scripts/audit_horizons_fixtures.py): independent parser and 0-diff fixture verifier
- [scripts/sensitivity_audit.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/scripts/sensitivity_audit.py): multi-parameter sensitivity audit
- [scripts/fetch_second_location.py](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/scripts/fetch_second_location.py): independent second-site evaluation

---

## 1. Executive Summary

This document proves that the LightPath SPICE ephemeris engine agreement with the NASA JPL Horizons system is genuine, mathematically rigorous, highly sensitive to physical perturbations, and robust across lunar polar sites.

### Key Evidence
1. **0-Diff Independent Re-Parse:** Independent parsing directly from raw Horizons API text responses shows an exact $0.0000000000^\circ$ difference across all 721 hourly epochs in November 2026 for both Sun and Earth.
2. **Strict Code Path Isolation:** The topocentric SPICE engine reads only the local NAIF binary kernels and site coordinates; zero Horizons numbers are fed into the SPICE calculations.
3. **Tightened $0.01^\circ$ Tolerance:** The acceptance threshold has been tightened from $0.05^\circ$ to $0.01^\circ$. Both SPICE `LT+S` ($\le 0.00004^\circ$ max deviation) and SPICE `NONE` ($\le 0.00597^\circ$ max deviation) satisfy this tightened bound across all 721 samples.
4. **Single Validation Constant (`ABCORR_FOR_VALIDATION`):** Defined in `pipeline/constants.py` as `"LT+S"`, shared consistently across `scripts/baseline_report.py`, `tests/test_verification.py`, and the pipeline.
5. **Physical Aberration Justification:** Optical sunlight casting shadows on the lunar surface and radio communications to Earth travel at $c$. An observer on the lunar surface observes and points towards the *apparent* topocentric position (`LT+S`). JPL Horizons computes apparent topocentric positions under Quantity 4. Hence, `LT+S` is the physical operational setting.
6. **Automated Fault-Injection Suite:** Three dedicated tests in `tests/test_v3_fault_injection.py` inject deliberate errors (`MOON_PA` frame, Moon-centre parallax, and $0.02^\circ$ latitude shift) and assert that V3 fails at the $0.01^\circ$ tolerance.
7. **Frame Rotation Provenance:** The exact Euler angles defining `MOON_ME_DE421` relative to `MOON_PA_DE421` are extracted directly from `kernels/moon_080317.tf`: $(67.92'', 78.56'', 0.30'')$ on axes $(3, 2, 1)$, giving a total rotation of $103.85'' \approx 0.02885^\circ$.
8. **Identical Surface Height:** Geodetic altitude $h = 0.0\text{ m}$ on reference sphere $R = 1,737.4\text{ km}$ ($R_{\text{obs}} = 1,737,400.0\text{ m}$) is enforced identically across both SPICE and Horizons queries.
9. **Full Sample Evaluation (No Downsampling):** The V3 pytest evaluates every single row ($N=721$ for Sun and $N=721$ for Earth) directly from the CSV fixtures and logs the true maximum and RMS deviations to `tests/results.json`.

---

## 2. Reconciled Accuracy Benchmark Table (All 721 Hourly Samples)

The comparison evaluated by `scripts/baseline_report.py` over the entire month of November 2026 (721 hourly epochs) for test location (Lat $-89.5^\circ$, Lon $0.0^\circ$, Height $0.0\text{ m}$):

| Target Body | Sample Count | Metric | SPICE (`NONE` Geometric) | SPICE (`LT+S` Apparent) | Analytic Fallback | Tolerance | Verdict (`LT+S`) | Verdict (`NONE`) |
| :--- | :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| **SUN** | 721 | Azimuth Max | $0.00597^\circ$ | **$0.00000^\circ$** | $61.21702^\circ$ | $0.01^\circ$ | **PASS** | **PASS** |
| **SUN** | 721 | Azimuth RMS | $0.00575^\circ$ | **$0.00000^\circ$** | $60.71921^\circ$ | $0.01^\circ$ | — | — |
| **SUN** | 721 | Elevation Max | $0.00009^\circ$ | **$0.00001^\circ$** | $2.59745^\circ$ | $0.01^\circ$ | **PASS** | **PASS** |
| **SUN** | 721 | Elevation RMS | $0.00004^\circ$ | **$0.00001^\circ$** | $1.69573^\circ$ | $0.01^\circ$ | — | — |
| **EARTH** | 721 | Azimuth Max | $0.00021^\circ$ | **$0.00001^\circ$** | $14.51264^\circ$ | $0.01^\circ$ | **PASS** | **PASS** |
| **EARTH** | 721 | Azimuth RMS | $0.00019^\circ$ | **$0.00000^\circ$** | $9.36521^\circ$ | $0.01^\circ$ | — | — |
| **EARTH** | 721 | Elevation Max | $0.00003^\circ$ | **$0.00004^\circ$** | $1.43035^\circ$ | $0.01^\circ$ | **PASS** | **PASS** |
| **EARTH** | 721 | Elevation RMS | $0.00002^\circ$ | **$0.00002^\circ$** | $0.92177^\circ$ | $0.01^\circ$ | — | — |

### Aberration Setting Selection Justification
1. **Physical Shadow Casting:** Solar illumination rays that cast terrain shadows on lunar topography travel at speed $c$. The 1-way light time from the Sun is $\approx 499\text{ s}$. The true direction from which incoming photons arrive at the lunar surface is the apparent topocentric direction, shifted by planetary stellar aberration ($\sim 20.5'' \approx 0.0057^\circ$).
2. **Direct-To-Earth Antenna Pointing:** Lunar surface communications antennas transmitting to Earth tracking stations must be pointed at the apparent position of the Earth.
3. **NASA Horizons Ground Truth Parity:** Quantity 4 of JPL Horizons outputs apparent azimuth and elevation (`Apparent AZ & EL`). Using `LT+S` achieves complete sub-arcsecond agreement ($\le 0.00004^\circ$) with JPL Horizons.
4. **Mathematical Margin:** Both `NONE` and `LT+S` satisfy the tightened $0.01^\circ$ threshold, but `LT+S` provides the rigorous physical match.

---

## 3. Step 1: Fixture Provenance, Echo Headers, and Independent Re-Parse

- **Audit Script:** `scripts/audit_horizons_fixtures.py`
- **Audit Log:** [logs/v3_proof_step1_fixture_audit.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/v3_proof_step1_fixture_audit.log)

### A. Raw Response Headers & Request Echo

#### Sun Fixture Raw Header (`tests/fixtures/horizons_test_location_sun_raw.txt`):
```text
*******************************************************************************
 Revised: July 31, 2013                  Sun                                 10

 PHYSICAL PROPERTIES (updated 2024-Oct-30):
  GM, km^3/s^2          = 132712440041.93938  Mass, 10^24 kg        = ~1988410
  Vol. mean radius, km  = 695700              Volume, 10^12 km^3    = 1412000
  Solar radius (IAU2015)= 695700 km           Mean density, g/cm^3  = 1.408
  Radius (photosphere)  = 696500 km           Angular diam at 1 AU  = 1919.3"
  Photosphere temp., K  = 6600 (bottom)       Photosphere temp., K  = 4400(top)
  Photospheric depth    = ~500 km             Chromospheric depth   = ~2500 km
  Flatness, f           = 0.00005             Adopted sid. rot. per.= 25.38 d
  Surface gravity       =  274.0 m/s^2        Escape speed, km/s    =  617.7
  Pole (RA,DEC), deg.   = (286.13, 63.87)     Obliquity to ecliptic = 7.25 deg.
  Solar constant (1 AU) = 1367.6 W/m^2        Luminosity, 10^24 J/s = 382.8
  Mass-energy conv rate = 4.260 x 10^9 kg/s   Effective temp, K     = 5772
  Sunspot cycle         = 11.4 yr             Cycle 24 sunspot min. = 2008 A.D.

 Motion relative to nearby stars = apex : R.A.= 271 deg.; DEC.= +30 deg.
                                   speed: 19.4 km/s (0.0112 au/day)
 Motion relative to 2.73K BB/CBR = apex : l= 264.7 +- 0.8; b= 48.2 +- 0.5 deg.
                                   speed: 369 +-11 km/s
*******************************************************************************


*******************************************************************************
Ephemeris / API_USER Sat Nov  7 05:26:45 2026 Pasadena, USA      / Horizons    
*******************************************************************************
Target body name: Sun (10)                        {source: DE441}
Center body name: Moon (301)                      {source: DE441}
Center-site name: (user defined site below)
*******************************************************************************
Start time      : A.D. 2026-Nov-01 00:00:00.0000 UT      
Stop  time      : A.D. 2026-Dec-01 00:00:00.0000 UT      
Step-size       : 60 minutes
*******************************************************************************
Target pole/equ : IAU_SUN                         {East-longitude positive}
Target radii    : 695700.0, 695700.0, 695700.0 km {Equator_a, b, pole_c}       
Center geodetic : 0.0, -89.5, 0.0                 {E-lon(deg),Lat(deg),Alt(km)}
Center cylindric: 0.0, 15.16148, -1737.334        {E-lon(deg),Dxy(km),Dz(km)}
Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}
```

#### Earth Fixture Raw Header (`tests/fixtures/horizons_test_location_earth_raw.txt`):
```text
*******************************************************************************
Ephemeris / API_USER Sat Nov  7 05:26:47 2026 Pasadena, USA      / Horizons    
*******************************************************************************
Target body name: Earth (399)                     {source: DE441}
Center body name: Moon (301)                      {source: DE441}
Center-site name: (user defined site below)
*******************************************************************************
Start time      : A.D. 2026-Nov-01 00:00:00.0000 UT      
Stop  time      : A.D. 2026-Dec-01 00:00:00.0000 UT      
Step-size       : 60 minutes
*******************************************************************************
Target pole/equ : ITRF93                          {East-longitude positive}
Target radii    : 6378.137, 6378.137, 6356.752 km {Equator_a, b, pole_c}       
Center geodetic : 0.0, -89.5, 0.0                 {E-lon(deg),Lat(deg),Alt(km)}
Center cylindric: 0.0, 15.16148, -1737.334        {E-lon(deg),Dxy(km),Dz(km)}
Center pole/equ : MEAN_ME (high precision)        {East-longitude positive}
Center radii    : 1737.4, 1737.4, 1737.4 km       {Equator_a, b, pole_c}       
Elevation corr  : None (apparent elevation)
Atmospheric ref.: NO (AIRLESS)
```

### B. Sidecar Metadata JSON Files
- **Sun Metadata:** [tests/fixtures/horizons_test_location_sun.json](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/tests/fixtures/horizons_test_location_sun.json)
- **Earth Metadata:** [tests/fixtures/horizons_test_location_earth.json](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/tests/fixtures/horizons_test_location_earth.json)

Both sidecars record the exact query parameters: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='0.0,-89.5,0.0'`, `QUANTITIES='4'`, `CSV_FORMAT='YES'`.

### C. Independent Re-Parse and Row-by-Row Diff

The independent parser extracted the numeric table between `$$SOE` and `$$EOE` directly from raw strings. The resulting rows were diffed against `horizons_test_location_sun.csv` and `horizons_test_location_earth.csv`:

| Fixture File | Total Rows | Timestamp Mismatches | Max Azimuth Diff | Max Elevation Diff | Verdict |
| :--- | :-: | :-: | :-: | :-: | :---: |
| `horizons_test_location_sun.csv` | 721 | 0 | $0.0000000000^\circ$ | $0.0000000000^\circ$ | **Exact Match (0 diff)** |
| `horizons_test_location_earth.csv` | 721 | 0 | $0.0000000000^\circ$ | $0.0000000000^\circ$ | **Exact Match (0 diff)** |

---

## 4. Step 2: Code Path Used in SPICE Baseline

The computation pipeline evaluated in `scripts/baseline_report.py` executes the following isolated path:

```
SPICE Kernels (kernels/meta.tm)
  ├─ naif0012.tls (LSK)
  ├─ pck00010.tpc (Planetary Constants)
  ├─ moon_pa_de421_1900-2050.bpc (Binary Orientation)
  ├─ moon_080317.tf (Lunar Frames: MOON_ME)
  └─ de421.bsp (JPL Ephemeris DE421)
         │
         ▼
[1] spice.str2et(utc_iso)  --> Ephemeris Time (TDB seconds past J2000)
         │
         ▼
[2] spice.spkpos(target, et, "MOON_ME", abcorr=ABCORR_FOR_VALIDATION, "301")  --> Target Cartesian Position (km)
         │
         ▼
[3] site_position_moon_me_km(lat, lon, r_km)  --> Site Cartesian Position (km)
    X = (R + h) * cos(lat) * cos(lon)
    Y = (R + h) * cos(lat) * sin(lon)
    Z = (R + h) * sin(lat)
    [where h = 0.0 km, R = 1737.4 km]
         │
         ▼
[4] enu_basis(lat, lon)  --> Orthonormal Topocentric Basis Matrix
    u = [cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat)]    (Local Up)
    e = [-sin(lon), cos(lon), 0]                            (East)
    n = u x e = [-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat)] (North)
         │
         ▼
[5] topocentric_az_el(target_pos, site_pos, basis)
    d = target_pos - site_pos                               (Topocentric Displacement)
    e_comp = d . e
    n_comp = d . n
    u_comp = d . u
    Azimuth = atan2(e_comp, n_comp) mod 360°
    Elevation = asin(u_comp / ||d||)
```

### Confirmation of Isolation
- **Input Parameters:** Latitude ($-89.5^\circ$), Longitude ($0.0^\circ$), Geodetic Height ($0.0\text{ m}$ on sphere $R = 1,737,400\text{ m}$), and UTC timestamps.
- **Independence:** Zero parameters, angles, or coordinates from the Horizons fixtures are ingested. The Horizons data are opened only after the SPICE calculation completes to compute the residual metrics $\Delta\text{Az}$ and $\Delta\text{El}$.

---

## 5. Verification of PA to ME Frame Rotation from Kernel File

In `kernels/moon_080317.tf`, the `MOON_ME_DE421` text kernel frame specification defines the exact Euler angle rotation from the Principal Axes (`MOON_PA_DE421`) frame to the Mean Earth (`MOON_ME_DE421`) frame:

```text
      FRAME_MOON_ME_DE421           = 31007
      FRAME_31007_NAME              = 'MOON_ME_DE421'
      FRAME_31007_CLASS             = 4
      FRAME_31007_CLASS_ID          = 31007
      FRAME_31007_CENTER            = 301

      TKFRAME_31007_SPEC            = 'ANGLES'
      TKFRAME_31007_RELATIVE        = 'MOON_PA_DE421'
      TKFRAME_31007_ANGLES          = (   67.92     78.56     0.30    )
      TKFRAME_31007_AXES            = (   3,        2,        1       )
      TKFRAME_31007_UNITS           = 'ARCSECONDS'
```

### Rotation Breakdown
- **Axis 3 (Z axis):** $+67.92'' = 0.018867^\circ$
- **Axis 2 (Y axis):** $+78.56'' = 0.021822^\circ$
- **Axis 1 (X axis):** $+0.30'' = 0.000083^\circ$
- **Total Magnitude of Rotation:**
  $$\theta = \sqrt{67.92^2 + 78.56^2 + 0.30^2}'' = 103.85'' \approx 0.028847^\circ$$

This establishes that any code substituting `MOON_PA` for `MOON_ME` introduces an error up to $0.02183^\circ$, which exceeds the tightened $0.01^\circ$ tolerance and triggers an immediate test failure.

---

## 6. Fault-Injection Sensitivity Suite

- **Script:** `scripts/sensitivity_audit.py`
- **Automated Test Module:** `tests/test_v3_fault_injection.py`

### Sensitivity Scenarios Across 721 Hourly Samples (November 2026)

| Scenario | Sun Max $\Delta\text{Az}$ | Sun Max $\Delta\text{El}$ | Earth Max $\Delta\text{Az}$ | Earth Max $\Delta\text{El}$ | Behavior vs. $0.01^\circ$ | Physical Explanation |
| :--- | :-: | :-: | :-: | :-: | :---: | :--- |
| **Clean Baseline (`LT+S`)** | **$0.00000^\circ$** | **$0.00001^\circ$** | **$0.00001^\circ$** | **$0.00004^\circ$** | **PASS ($\le 0.01^\circ$)** | Sub-arcsecond agreement between SPICE DE421 and Horizons DE441 |
| **(a) Frame `MOON_PA` instead of `MOON_ME`** | $0.01371^\circ$ | **$0.02183^\circ$** | $0.01878^\circ$ | **$0.02172^\circ$** | **FAILS ($> 2.1\times$)** | Euler rotation between PA and ME frames is $103.85'' \approx 0.02885^\circ$ |
| **(b) Moon-centre direction for Earth** | $0.00597^\circ$ | $0.00076^\circ$ | $0.00021^\circ$ | **$0.27554^\circ$** | **FAILS ($> 27.5\times$)** | Topocentric parallax $\approx R_{\text{moon}} / D_{\text{earth}} \approx 1737 / 384400 \approx 0.259^\circ$ |
| **(c) Aberration `NONE` instead of `LT+S`** | $0.00597^\circ$ | $0.00009^\circ$ | $0.00021^\circ$ | $0.00003^\circ$ | PASS ($\le 0.01^\circ$) | Stellar aberration magnitude is $v_{\text{orbit}}/c \approx 20.5'' \approx 0.0057^\circ$ |
| **(d) Time shifted by $+60$ seconds** | $0.00292^\circ$ | $0.00007^\circ$ | $0.00158^\circ$ | $0.00111^\circ$ | PASS ($\le 0.01^\circ$) | Lunar rotation rate is $0.0001525^\circ/\text{s}$; in $60\text{ s}$ rotates by $0.00915^\circ$ |
| **(e) Latitude shifted by $+0.02^\circ$** | $0.01227^\circ$ | **$0.02000^\circ$** | $0.00050^\circ$ | **$0.02025^\circ$** | **FAILS ($2.0\times$)** | Tilting local normal by $0.02^\circ$ produces an exact $0.0200^\circ$ elevation shift |

### Automated Failure Assertions in `tests/test_v3_fault_injection.py`

```text
pytest -v tests/test_v3_fault_injection.py

tests\test_v3_fault_injection.py::test_fault_injection_moon_pa_fails_tolerance PASSED
tests\test_v3_fault_injection.py::test_fault_injection_moon_centre_earth_fails_tolerance PASSED
tests\test_v3_fault_injection.py::test_fault_injection_latitude_shift_fails_tolerance PASSED
============================== 3 passed in 0.13s ==============================
```

Each test purposefully injects one physical perturbation, verifies that the resulting angular discrepancy exceeds $0.01^\circ$, and asserts that the check fails under corrupted conditions.

---

## 7. Step 4: Second Location Evaluation (Lat -85.0°, Lon 30.0°)

- **Script:** `scripts/fetch_second_location.py`
- **Output Log:** [logs/v3_proof_step4_second_location.log](file:///c:/Users/anmol/OneDrive/Desktop/Lunar/logs/v3_proof_step4_second_location.log)
- **Target Site:** `TEST_LOCATION_2_NOT_A_MISSION_SITE` (Label: `test-only`)
- **Coordinates:** Latitude $-85.0^\circ$, Longitude $+30.0^\circ$, Altitude $0.0\text{ km}$
- **Epoch Range:** 2026-11-01 00:00 to 2026-11-08 00:00 (7 days, 169 hourly samples)

| Target Body | Azimuth Max Error | Azimuth RMS Error | Elevation Max Error | Elevation RMS Error | Status ($\le 0.01^\circ$) |
| :--- | :-: | :-: | :-: | :-: | :---: |
| **Sun (10)** | **$0.00000^\circ$** | $0.00000^\circ$ | **$0.00001^\circ$** | $0.00001^\circ$ | **PASS** |
| **Earth (399)** | **$0.00001^\circ$** | $0.00000^\circ$ | **$0.00004^\circ$** | $0.00003^\circ$ | **PASS** |

The results at this second, independent location confirm that the sub-arcsecond agreement between SPICE and Horizons is consistent across coordinates.

---

## 8. Step 5: Mathematical Conditioning: Why Azimuth Agrees at Lat -89.5°

Polar coordinates in spherical trigonometry can become ill-conditioned near the poles if divided by $\cos\phi$ ($\cos(-89.5^\circ) \approx 0.0087265$).

### Well-Conditioned Topocentric Basis
Both CSPICE and Horizons compute topocentric directions via Cartesian linear algebra without dividing by $\cos\phi$:
1. **Basis Formulation:**
   $$\mathbf{u} = \begin{pmatrix} \cos\phi\cos\lambda \\ \cos\phi\sin\lambda \\ \sin\phi \end{pmatrix}, \quad \mathbf{e} = \begin{pmatrix} -\sin\lambda \\ \cos\lambda \\ 0 \end{pmatrix}, \quad \mathbf{n} = \mathbf{u} \times \mathbf{e} = \begin{pmatrix} -\sin\phi\cos\lambda \\ -\sin\phi\sin\lambda \\ \cos\phi \end{pmatrix}$$

   Every vector is orthonormal by construction: $\|\mathbf{u}\| = \|\mathbf{e}\| = \|\mathbf{n}\| = 1.0$, with condition number **identically equal to 1.0**.

2. **Vector Subtraction and Projections:**
   $$\mathbf{d} = \mathbf{r}_{\text{target}} - \mathbf{r}_{\text{site}}$$
   $$\text{Azimuth} = \operatorname{atan2}(\mathbf{d} \cdot \mathbf{e},\, \mathbf{d} \cdot \mathbf{n})$$

3. **Double-Precision Bounds:**
   Machine precision $\epsilon_{\text{mach}} \approx 2.22 \times 10^{-16}$. At distance $\|\mathbf{d}\| \sim 1.5 \times 10^8\text{ km}$, projection angular precision is bounded by $\sim 1.27 \times 10^{-14\circ}$, more than 11 orders of magnitude below the $0.01^\circ$ tolerance.

---

## 9. Dynamic Execution Proof in `tests/results.json`

### Pytest Execution Command
```text
pytest -v tests/test_verification.py
```

### Dynamic Check Entry Recorded in `tests/results.json`
```json
{
  "code": "V3",
  "id": "V3",
  "name": "Ephemeris cross-check against JPL Horizons",
  "status": "passed",
  "data_type": "real",
  "tolerance": "0.01 deg",
  "measured_value": "Sun (N=721): Az max 0.00000°, rms 0.00000°; El max 0.00001°, rms 0.00001° | Earth (N=721): Az max 0.00001°, rms 0.00000°; El max 0.00004°, rms 0.00002° [abcorr=LT+S, site height=0m]",
  "expected_value": "JPL Horizons ephemeris query (DE441, topocentric MOON_ME, apparent)",
  "source_of_expected_value": "NASA JPL Horizons On-Line Ephemeris System",
  "citation": "JPL Horizons batch query; MOON_ME frame, LT+S aberration, site height 0m (R=1737.4 km)",
  "skip_reason": null,
  "skipped_reason": null
}
```

Every sample row ($N=721$) is evaluated dynamically; no synthetic numbers or hard-coded summaries are used.

---

## 10. Precision Reconciliation & Decimal Analysis (Task S0 Step 0)

### 1. Decimal Analysis of Fixtures and Raw Responses
- **Raw JPL Horizons API Output:**
  Inspecting `tests/fixtures/horizons_test_location_sun_raw.txt` and `tests/fixtures/horizons_test_location_earth_raw.txt` shows azimuth and elevation reported to **6 decimal places** (e.g., `Azi____(a-app)___Elev = 277.925206  -1.391740`).
- **Parsed CSV Fixtures:**
  `tests/fixtures/horizons_test_location_sun.csv` and `tests/fixtures/horizons_test_location_earth.csv` preserve these exact 6 decimal digits with zero truncation or rounding.

### 2. Resolution of the $0.0005^\circ$ Discrepancy
- **Root Cause:** Prior to Task S0 Step 0, `sun_earth_series` in `pipeline/geometry.py` invoked `round(float(val), 3)`, truncating topocentric azimuth and elevation angles to 3 decimal places ($0.001^\circ$). This introduced artificial numeric discretization / quantization noise of up to $\pm 0.0005^\circ$.
- **Correction:** The quantization in `pipeline/geometry.py` was updated to preserve 6 decimal places (`round(float(val), 6)`), matching the precision of the raw Horizons telemetry.
- **Result:** `scripts/baseline_report.py` and `tests/test_verification.py` now evaluate identical floating-point values and yield completely unified numbers:
  - **Sun ($N=721$):** Az max $0.00000^\circ$ (rms $0.00000^\circ$), El max $0.00001^\circ$ (rms $0.00001^\circ$)
  - **Earth ($N=721$):** Az max $0.00001^\circ$ (rms $0.00000^\circ$), El max $0.00004^\circ$ (rms $0.00002^\circ$)
- Both the benchmark report and `tests/results.json` are now 100% synchronized and reproducible.
