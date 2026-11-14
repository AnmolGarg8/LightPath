# LightPath — Third-Party Credits & Citations

In accordance with Rule 11 of the project guidelines ([`docs/PROJECT_RULES.md`](PROJECT_RULES.md)) and the **NASA Space Apps Challenge Participant Terms** (Intellectual Property & Third-Party Licences), all third-party libraries, primary scientific datasets, ephemerides, and foundational mathematics are documented below with their canonical source addresses and retrieval dates.

---

## 1. Ephemerides & Celestial Mechanics

- **JPL Planetary and Lunar Ephemeris DE421**:
  - Reference: Folkner, W. M., Williams, J. G., & Boggs, D. H. (2009). *The Planetary and Lunar Ephemeris DE 421*. Interplanetary Network Progress Report (IPN PR), 42-178, pp. 1–34.
  - Note: LightPath uses the DE421 ephemeris kernel (`de421.bsp`), not DE430 or DE431.
  - Source Address: https://ipnpr.jpl.nasa.gov/progress_report/42-178/178C.pdf
  - Date Retrieved: 2026-10-29

- **NASA NAIF SPICE Toolkit**:
  - Reference: Acton, C. H. (1996). *Ancillary Data Services of NASA's Navigation and Ancillary Information Facility*. Planetary and Space Science, 44(1), pp. 65–70. doi:10.1016/0032-0633(95)00107-7.
  - Additional Reference: Acton, C., Bachman, N., Semenov, B., & Wright, E. (2018). *A look towards the future in the handling of space science data: The SPICE system*. Planetary and Space Science, 150, pp. 9–12. doi:10.1016/j.pss.2017.02.013.
  - Source Address: https://naif.jpl.nasa.gov/naif/
  - Date Retrieved: 2026-10-29

- **SpiceyPy Library**:
  - Reference: Annex, A. M., Pearson, B., Seignovert, B., Carcich, B., Eichhorn, H., Mapel, J., von Forstner, J. L., McAuliffe, J., Del Rio, J., Berry, K., Aye, K.-M., Stefko, M., de Val-Borro, M., Kulumani, S., & Murakami, S. (2020). *SpiceyPy: a Pythonic Wrapper for the SPICE Toolkit*. Journal of Open Source Software, 5(46), 2050. doi:10.21105/joss.02050.
  - Source Address: https://github.com/AndrewAnnex/SpiceyPy
  - Date Retrieved: 2026-10-29

- **NASA JPL Horizons On-Line Ephemeris System**:
  - Reference: Giorgini, J. D., Yeomans, D. K., Chamberlin, A. B., Chodas, P. W., Jacobson, R. A., Keesey, M. S., Lieske, J. H., Ostro, S. J., Standish, E. M., & Wimberly, R. N. (1996). *JPL's On-Line Solar System Data Service*. Bulletin of the American Astronomical Society, 28, 1158.
  - Source Address: https://ssd.jpl.nasa.gov/horizons/
  - Date Retrieved: 2026-10-29

---

## 2. Lunar Altimetry & Topographic Data Products

- **NASA GSFC Planetary Geodesy Data Archive — LOLA Products (Barker et al. 2023)**:
  - Exact Citation Line: `Barker et al. (2023), Planetary Science Journal 4:183, doi:10.3847/PSJ/acf3e1`
  - Full Citation: Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Head, J. W., & Sun, X. (2023). *A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA)*. The Planetary Science Journal, 4(9), 183. doi:10.3847/PSJ/acf3e1.
  - Data DOI: 10.60903/gsfcpgda-lola-spole
  - Source Address: https://pgda.gsfc.nasa.gov/products/78
  - Date Retrieved: 2026-11-07

- **NASA GSFC Planetary Geodesy Data Archive — Polar Site Elevation Analysis (Barker et al. 2021)**:
  - Exact Citation Line: `Barker et al. (2021), Planetary and Space Science 203:105119, doi:10.1016/j.pss.2020.105119`
  - Full Citation: Barker, M. K., Mazarico, E., Neumann, G. A., Zuber, M. T., Haruyama, J., & Smith, D. E. (2021). *High-resolution LOLA topography for lunar south pole landing sites*. Planetary and Space Science, 203, 105119. doi:10.1016/j.pss.2020.105119.
  - Source Address: https://doi.org/10.1016/j.pss.2020.105119
  - Date Retrieved: 2026-11-07

- **LOLA Instrument Investigation on LRO**:
  - Reference: Smith, D. E., Zuber, M. T., Jackson, G. B., et al. (2010). *The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission*. Space Science Reviews, 150(1–4), pp. 209–241. doi:10.1007/s11214-009-9512-y.
  - Source Address: https://link.springer.com/article/10.1007/s11214-009-9512-y
  - Date Retrieved: 2026-10-29

---

## 3. Telecommunications & Ground Stations

- **NASA Deep Space Network (DSN) Telecommunications Link Design Handbook**:
  - Reference: Jet Propulsion Laboratory (2019). *DSN Telecommunications Link Design Handbook: 810-005, Module 301, Rev. E [verify module and revision: Module 301, Coverage and Antenna Orientation]*, Jet Propulsion Laboratory, California Institute of Technology.
  - Source Address: https://deepspace.jpl.nasa.gov/dsndocs/810-005/
  - Date Retrieved: 2026-10-29

---

## 4. Terrain & Numerical Algorithms

- **DEM Gradient & Hill Shading (Horn 1981)**:
  - Reference: Horn, B. K. P. (1981). *Hill shading and the reflectance map*. Proceedings of the IEEE, 69(1), pp. 14–47. doi:10.1109/PROC.1981.11918.
  - Source Address: https://ieeexplore.ieee.org/document/1456186
  - Date Retrieved: 2026-10-29

- **Fibonacci Uniform Disc Quadrature**:
  - Reference: González, Á. (2010). *Measurement of areas on a sphere using Fibonacci and latitude–longitude lattices*. Mathematical Geosciences, 42(1), pp. 49–64. doi:10.1007/s11004-009-9257-x.
  - Source Address: https://doi.org/10.1007/s11004-009-9257-x
  - Date Retrieved: 2026-10-29

- **Exact Spherical Curvature Elevation Model**:
  - Formulation: Topocentric elevation of sampled terrain point at great-circle distance $d$ and altitude $z$ relative to observer at altitude $z_0$ on sphere $R = 1,737,400\text{ m}$:
    $$\text{el} = \text{atan2}((R + z) \cos(d/R) - (R + z_0), (R + z) \sin(d/R))$$
  - Source Address: [`docs/PROJECT_RULES.md`](PROJECT_RULES.md)
  - Date Retrieved: 2026-10-29

---

## 5. Physical Data Products Used in LightPath

Every raw topography and kernel file used in production runs is traced with its exact file path, canonical source address, and date retrieved:

| Data Product | Description / Role | Source Address | Date Retrieved |
| :--- | :--- | :--- | :-: |
| `data/raw/near_test_location.tif` | LOLA 20 mpp co-registered DEM crop (80 km × 80 km) at Lat -89.5°, Lon 0.0° | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF | 2026-11-07 |
| `data/raw/near_test_location_2.tif` | LOLA 20 mpp co-registered DEM crop (80 km × 80 km) at Lat -85.0°, Lon 30.0° | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF | 2026-11-10 |
| `data/raw/LDEM_80S_80MPP_ADJ.TIF` | LOLA 80 mpp far-field DEM (80°S to 90°S) for horizon raycasting | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF | 2026-11-07 |
| `data/raw/err_test_location_2.tif` | LOLA 20 mpp 1-sigma surface height error raster crop for test location 2 | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ_ERR.TIF | 2026-11-10 |
| `kernels/de421.bsp` | JPL DE421 SPK ephemeris kernel (Sun, Earth, Moon positions) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de421.bsp | 2026-11-07 |
| `kernels/moon_pa_de421_1900-2050.bpc` | JPL binary PCK kernel for high-precision lunar principal axis orientation | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc | 2026-11-07 |
| `kernels/moon_080317.tf` | NAIF text frame kernel defining `MOON_ME` (Mean Earth/Polar Axis) frame | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf | 2026-11-07 |
| `kernels/pck00010.tpc` | NAIF text planetary constants kernel (IAU body radii & constants) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc | 2026-11-07 |
| `kernels/naif0012.tls` | NAIF text leapseconds kernel (UTC to Ephemeris Time ET/TDB conversion) | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls | 2026-11-07 |
