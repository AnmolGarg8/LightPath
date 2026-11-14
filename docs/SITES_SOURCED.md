# NASA LOLA 5 m Landing Site DEMs (Sourced Sites)

Coordinates are derived from the GeoTIFF georeference (tile centre); they are not mission landing coordinates.

In accordance with `docs/PROJECT_RULES.md` (Rule 2: never invent coordinates or sources), this document catalogs the exact landing site digital elevation models published by the NASA GSFC Planetary Geodesy Data Archive (PGDA). All parameters below are determined directly from the remote GeoTIFF headers and HTTP HEAD metadata via GDAL/rasterio `/vsicurl/` access without downloading full raster payloads.

## Sourced Sites Catalog

| Tile ID | Name on NASA's Page | Centre Latitude | Centre Longitude | Tile Size (m) | Centre Surface Height (m) | File URL | Size (bytes) | Retrieved On | Source Page | Papers to Cross-Check | Horizon Margin Check (150 km) | Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Site01** | Connecting ridge | -89.463163° | -137.489553° | 16000 m × 16000 m | 1944.77 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif | 40,980,810 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (287.7 km ≥ 150 km) | false |
| **Site04** | Shackleton rim | -89.766811° | -171.869898° | 16000 m × 16000 m | 767.98 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif | 40,980,806 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (296.9 km ≥ 150 km) | false |
| **Site07** | Peak near Shackleton | -88.811008° | +123.690068° | 16000 m × 16000 m | 1645.55 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site07/Site07_final_adj_5mpp_surf.tif | 40,980,808 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (267.9 km ≥ 150 km) | false |
| **Site11** | de Gerlache rim | -88.683418° | -67.932100° | 16000 m × 16000 m | 1793.66 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site11/Site11_final_adj_5mpp_surf.tif | 40,980,806 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (264.1 km ≥ 150 km) | false |
| **Site20** | Leibnitz beta plateau | -85.426577° | +31.742761° | 16000 m × 16000 m | 6398.83 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site20/Site20_final_adj_5mpp_surf.tif | 40,980,802 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (165.2 km ≥ 150 km) | false |
| **Site23** | Malapert massif | -85.994785° | -0.235784° | 21000 m × 21000 m | 4783.63 m | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site23/Site23_final_adj_5mpp_surf.tif | 70,586,804 | 2026-11-14 | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Mazarico et al. (2011) [doi:10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030); Barker et al. (2021) [doi:10.1016/j.pss.2020.105119](https://doi.org/10.1016/j.pss.2020.105119) | PASS (182.5 km ≥ 150 km) | false |

---

## Detailed Tile Header & Geodetic Parameters

All rasters share the following common header structure:
- **Coordinate Reference System (CRS)**: South Polar Stereographic projection on spherical lunar datum $R = 1,737,400\,\text{m}$ (`PROJCS["unnamed", GEOGCS["unnamed ellipse", DATUM["unknown", SPHEROID["unnamed", 1737400, 0]], PRIMEM["Greenwich", 0], UNIT["degree", 0.0174532925199433]], PROJECTION["Polar_Stereographic"], PARAMETER["latitude_of_origin", -90], PARAMETER["central_meridian", 0], PARAMETER["false_easting", 0], PARAMETER["false_northing", 0], UNIT["metre", 1]]`).
- **Pixel Resolution**: Exactly $5.0\,\text{m} \times 5.0\,\text{m}$.
- **Data Type**: 32-bit floating point (`float32`).
- **No-Data Value**: `NaN`.
- **Scale / Offset**: `1.0` / `0.0`.
- **Reference Frame**: MOON_ME (Mean Earth / Polar Axis frame), ephemeris DE421.

### Corner Coordinates (Geodetic Longitude / Latitude on $R=1,737,400\,\text{m}$ Sphere)

1. **Site01 (Connecting ridge)**:
   - Bottom-Left: `(-19000.0, -20000.0) m` $\rightarrow$ Lon: `-136.468801°`, Lat: `-89.090284°`
   - Bottom-Right: `(-3000.0, -20000.0) m` $\rightarrow$ Lon: `-171.469234°`, Lat: `-89.333071°`
   - Top-Right: `(-3000.0, -4000.0) m` $\rightarrow$ Lon: `-143.130102°`, Lat: `-89.835111°`
   - Top-Left: `(-19000.0, -4000.0) m` $\rightarrow$ Lon: `-101.888658°`, Lat: `-89.359692°`
   - Tile Centre: `(-11000.0, -12000.0) m` $\rightarrow$ Lon: `-137.489553°`, Lat: `-89.463163°`

2. **Site04 (Shackleton rim)**:
   - Bottom-Left: `(-9000.0, -15000.0) m` $\rightarrow$ Lon: `-149.036243°`, Lat: `-89.423127°`
   - Bottom-Right: `(7000.0, -15000.0) m` $\rightarrow$ Lon: `+154.983107°`, Lat: `-89.454123°`
   - Top-Right: `(7000.0, 1000.0) m` $\rightarrow$ Lon: `+81.869898°`, Lat: `-89.766811°`
   - Top-Left: `(-9000.0, 1000.0) m` $\rightarrow$ Lon: `-83.659808°`, Lat: `-89.701373°`
   - Tile Centre: `(-1000.0, -7000.0) m` $\rightarrow$ Lon: `-171.869898°`, Lat: `-89.766811°`

3. **Site07 (Peak near Shackleton)**:
   - Bottom-Left: `(22000.0, -28000.0) m` $\rightarrow$ Lon: `+141.842773°`, Lat: `-88.825732°`
   - Bottom-Right: `(38000.0, -28000.0) m` $\rightarrow$ Lon: `+126.384352°`, Lat: `-88.443484°`
   - Top-Right: `(38000.0, -12000.0) m` $\rightarrow$ Lon: `+107.525568°`, Lat: `-88.685898°`
   - Top-Left: `(22000.0, -12000.0) m` $\rightarrow$ Lon: `+118.610460°`, Lat: `-89.173591°`
   - Tile Centre: `(30000.0, -20000.0) m` $\rightarrow$ Lon: `+123.690068°`, Lat: `-88.811008°`

4. **Site11 (de Gerlache rim)**:
   - Bottom-Left: `(-45000.0, 7000.0) m` $\rightarrow$ Lon: `-81.158185°`, Lat: `-88.498234°`
   - Bottom-Right: `(-29000.0, 7000.0) m` $\rightarrow$ Lon: `-76.429566°`, Lat: `-89.016199°`
   - Top-Right: `(-29000.0, 23000.0) m` $\rightarrow$ Lon: `-51.581945°`, Lat: `-88.779419°`
   - Top-Left: `(-45000.0, 23000.0) m` $\rightarrow$ Lon: `-62.927920°`, Lat: `-88.333510°`
   - Tile Centre: `(-37000.0, 15000.0) m` $\rightarrow$ Lon: `-67.932100°`, Lat: `-88.683418°`

5. **Site20 (Leibnitz beta plateau)**:
   - Bottom-Left: `(65000.0, 110000.0) m` $\rightarrow$ Lon: `+30.579227°`, Lat: `-85.788335°`
   - Bottom-Right: `(81000.0, 110000.0) m` $\rightarrow$ Lon: `+36.366580°`, Lat: `-85.497366°`
   - Top-Right: `(81000.0, 126000.0) m` $\rightarrow$ Lon: `+32.735226°`, Lat: `-85.063304°`
   - Top-Left: `(65000.0, 126000.0) m` $\rightarrow$ Lon: `+27.287988°`, Lat: `-85.327053°`
   - Tile Centre: `(73000.0, 118000.0) m` $\rightarrow$ Lon: `+31.742761°`, Lat: `-85.426577°`

6. **Site23 (Malapert massif)**:
   - Bottom-Left: `(-11000.0, 111000.0) m` $\rightarrow$ Lon: `-5.659482°`, Lat: `-86.322787°`
   - Bottom-Right: `(10000.0, 111000.0) m` $\rightarrow$ Lon: `+5.147885°`, Lat: `-86.325889°`
   - Top-Right: `(10000.0, 132000.0) m` $\rightarrow$ Lon: `+4.332314°`, Lat: `-85.636555°`
   - Top-Left: `(-11000.0, 132000.0) m` $\rightarrow$ Lon: `-4.763642°`, Lat: `-85.633944°`
   - Tile Centre: `(-500.0, 121500.0) m` $\rightarrow$ Lon: `-0.235784°`, Lat: `-85.994785°`

---

## 20 m and 80 m Layer Boundary & Horizon Margin Analysis

The regional LOLA layers covering $80^\circ\,\text{S}$ to $90^\circ\,\text{S}$ (`LDEM_80S_20MPP_ADJ.TIF` and `LDEM_80S_80MPP_ADJ.TIF`) have bounds $[-304000, -304000, 304000, 304000]\,\text{m}$ in South Polar Stereographic projection ($R = 1,737,400\,\text{m}$), corresponding to an $80^\circ\,\text{S}$ boundary radius of $R_{\text{circ}} = 304,000\,\text{m} = 304\,\text{km}$.

The distance from each tile centre to the $80^\circ\,\text{S}$ regional terrain boundary is:
- **Site01 (Connecting ridge)**: $287.72\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+137.72\,\text{km}$) $\rightarrow$ **PASS**
- **Site04 (Shackleton rim)**: $296.93\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+146.93\,\text{km}$) $\rightarrow$ **PASS**
- **Site07 (Peak near Shackleton)**: $267.94\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+117.94\,\text{km}$) $\rightarrow$ **PASS**
- **Site11 (de Gerlache rim)**: $264.08\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+114.08\,\text{km}$) $\rightarrow$ **PASS**
- **Site20 (Leibnitz beta plateau)**: $165.24\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+15.24\,\text{km}$) $\rightarrow$ **PASS**
- **Site23 (Malapert massif)**: $182.50\,\text{km}$ ($\ge 150\,\text{km}$, margin: $+32.50\,\text{km}$) $\rightarrow$ **PASS**

All 6 tile centres have at least $150\,\text{km}$ distance to the edge of the $20\,\text{m}$ and $80\,\text{m}$ regional layers, satisfying the full $150\,\text{km}$ raycast horizon search horizon requirement.

---

## Things I Could Not Determine
- **None**: All 6 remote GeoTIFF headers were successfully parsed via `/vsicurl/` and HTTP HEAD.
- Pixel values outside the 3×3 center window were intentionally not downloaded in strict compliance with the task instruction.
