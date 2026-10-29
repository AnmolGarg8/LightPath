/**
 * Core Lunar Geodesy & Celestial Geometry Library
 * 
 * Complies with docs/PROJECT_RULES.md:
 * - Shared mathematical library verified against Python reference implementation.
 * - Units in parameter names (_m, _deg, _km).
 * - Exact spherical curvature formula; zero flat-Moon approximations.
 * - Flat-horizon disc fraction with arccos clipping.
 */

export const R_MOON_M = 1737400.0;
export const R_MOON_KM = 1737.4;
export const R_SUN_KM = 695700.0;
export const R_EARTH_KM = 6371.0;

/**
 * Computes exact spherical curvature elevation angle for a target feature at ground distance.
 * 
 * Formula:
 *   theta = dist_m / R
 *   el = atan2((R + z) * cos(theta) - (R + z0), (R + z) * sin(theta))
 * 
 * @param distM Ground distance along lunar sphere in metres
 * @param featureHeightM Elevation of feature above datum in metres (z)
 * @param observerHeightM Elevation of observer mast above datum in metres (z0)
 * @param rMoonM Lunar radius in metres (default 1737400.0 m)
 * @returns Elevation angle in degrees
 */
export function elevationAngleDeg(
  distM: number,
  featureHeightM: number,
  observerHeightM: number = 0.0,
  rMoonM: number = R_MOON_M
): number {
  if (distM < 0) {
    throw new Error(`Distance must be non-negative, got ${distM}`);
  }
  if (distM === 0) {
    return featureHeightM >= observerHeightM ? 90.0 : -90.0;
  }

  const thetaRad = distM / rMoonM;
  const targetR = rMoonM + featureHeightM;
  const observerR = rMoonM + observerHeightM;

  const num = targetR * Math.cos(thetaRad) - observerR;
  const den = targetR * Math.sin(thetaRad);

  const elRad = Math.atan2(num, den);
  return (elRad * 180.0) / Math.PI;
}

/**
 * Computes the visible illuminated fraction of a circular celestial disc over a flat horizon.
 * 
 * Formula:
 *   x = clip(e / r, -1, 1)
 *   fraction = (acos(-x) + x * sqrt(1 - x^2)) / pi
 * 
 * @param eDeg Body centre elevation relative to terrain horizon in degrees
 * @param rDeg Body angular radius in degrees (> 0)
 * @returns Visible disc fraction in range [0.0, 1.0]
 */
export function discFractionFlat(eDeg: number, rDeg: number): number {
  if (rDeg <= 0) {
    throw new Error(`Angular radius must be strictly positive, got ${rDeg}`);
  }

  const ratio = eDeg / rDeg;
  const x = Math.max(-1.0, Math.min(1.0, ratio));

  const fraction = (Math.acos(-x) + x * Math.sqrt(1.0 - x * x)) / Math.PI;
  return Math.max(0.0, Math.min(1.0, fraction));
}

/**
 * Computes the horizon dip angle for an observer on a smooth spherical body.
 * 
 * Formula:
 *   dip = -acos(R / (R + h))
 * 
 * @param observerHeightM Height of observer mast above surface in metres
 * @param rMoonM Radius of lunar sphere in metres
 * @returns Horizon dip angle in degrees (negative or zero)
 */
export function horizonDipDeg(observerHeightM: number, rMoonM: number = R_MOON_M): number {
  if (observerHeightM <= 0) {
    return 0.0;
  }

  const cosAngle = rMoonM / (rMoonM + observerHeightM);
  const dipRad = -Math.acos(Math.max(-1.0, Math.min(1.0, cosAngle)));
  return (dipRad * 180.0) / Math.PI;
}

/**
 * Computes angular radius of a spherical body from target radius and distance.
 */
export function angularRadiusDeg(radiusKm: number, distanceKm: number): number {
  if (distanceKm <= 0) {
    throw new Error(`Distance must be positive, got ${distanceKm}`);
  }
  return (Math.atan2(radiusKm, distanceKm) * 180.0) / Math.PI;
}
