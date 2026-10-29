/**
 * Scale and coordinate projection utilities for Horizon Panorama and Timeline.
 * 
 * Complies with PROJECT_RULES:
 * - Azimuth 0° to 360° clockwise from North.
 * - Topocentric elevation angles in degrees.
 * - Angular size conversions for celestial bodies (Sun ~0.53° diameter, Earth ~1.9° diameter).
 * - Vertical exaggeration math with clear labeling.
 */

import { scaleLinear } from 'd3-scale';

export interface PanoramaScaleConfig {
  width: number;
  height: number;
  minElevationDeg?: number;
  maxElevationDeg?: number;
  verticalExaggeration?: number;
}

export interface CompassTick {
  azimuthDeg: number;
  label: string;
  isCardinal: boolean;
}

export const COMPASS_POINTS: CompassTick[] = [
  { azimuthDeg: 0, label: '0° N', isCardinal: true },
  { azimuthDeg: 45, label: '45° NE', isCardinal: false },
  { azimuthDeg: 90, label: '90° E', isCardinal: true },
  { azimuthDeg: 135, label: '135° SE', isCardinal: false },
  { azimuthDeg: 180, label: '180° S', isCardinal: true },
  { azimuthDeg: 225, label: '225° SW', isCardinal: false },
  { azimuthDeg: 270, label: '270° W', isCardinal: true },
  { azimuthDeg: 315, label: '315° NW', isCardinal: false },
  { azimuthDeg: 360, label: '360° N', isCardinal: true },
];

/**
 * Creates D3 linear scales for the 360-degree cylindrical horizon panorama.
 */
export function createPanoramaScales(config: PanoramaScaleConfig) {
  const {
    width,
    height,
    minElevationDeg = -1.0,
    maxElevationDeg = 6.0,
    verticalExaggeration = 1.0,
  } = config;

  // Azimuth scale: 0° to 360° maps across the canvas width
  const scaleX = scaleLinear()
    .domain([0, 360])
    .range([0, width]);

  // Elevation scale: maps angular elevation domain [minElevationDeg, maxElevationDeg] to pixel height [height, 0]
  const scaleY = scaleLinear()
    .domain([minElevationDeg, maxElevationDeg])
    .range([height, 0]);

  return {
    scaleX,
    scaleY,
    width,
    height,
    minElevationDeg,
    maxElevationDeg,
    verticalExaggeration,
  };
}

/**
 * Converts angular radius in degrees to pixel radius on the canvas.
 * Handles vertical exaggeration appropriately for the vertical dimension.
 */
export function discRadiusInPixels(
  radiusDeg: number,
  scales: ReturnType<typeof createPanoramaScales>
): { rx: number; ry: number } {
  // Horizontal radius (unaffected by vertical exaggeration)
  const rx = Math.abs(scales.scaleX(radiusDeg) - scales.scaleX(0));

  // Vertical radius (scaled by vertical exaggeration)
  const ry = Math.abs(scales.scaleY(radiusDeg * scales.verticalExaggeration) - scales.scaleY(0));

  return { rx, ry };
}

/**
 * Validates whether celestial discs conform to expected angular diameters.
 * Sun: ~0.53° diameter (0.265° radius)
 * Earth: ~1.90° diameter (0.95° radius)
 */
export function verifyAngularDiameter(
  sunRadiusDeg: number,
  earthRadiusDeg: number
): { sunDiameterDeg: number; earthDiameterDeg: number; valid: boolean } {
  const sunDiameterDeg = sunRadiusDeg * 2.0;
  const earthDiameterDeg = earthRadiusDeg * 2.0;

  const sunValid = sunDiameterDeg >= 0.50 && sunDiameterDeg <= 0.56;
  const earthValid = earthDiameterDeg >= 1.80 && earthDiameterDeg <= 2.05;

  return {
    sunDiameterDeg,
    earthDiameterDeg,
    valid: sunValid && earthValid,
  };
}
