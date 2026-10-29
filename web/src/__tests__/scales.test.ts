/**
 * Unit Tests for Scales and Angular Disc Dimensions
 * 
 * Acceptance check:
 * - Tests for the scales.
 * - Earth disc is about 1.9 degrees wide and Sun about 0.53 degrees on the angular axis.
 * - Vertical exaggeration math.
 */

import { describe, it, expect } from 'vitest';
import {
  createPanoramaScales,
  discRadiusInPixels,
  verifyAngularDiameter,
  COMPASS_POINTS,
} from '../utils/scales';

describe('Scales & Coordinate Transformations', () => {
  it('maps azimuth [0, 360] linearly across canvas width', () => {
    const scales = createPanoramaScales({ width: 720, height: 360 });
    expect(scales.scaleX(0)).toBe(0);
    expect(scales.scaleX(180)).toBe(360);
    expect(scales.scaleX(360)).toBe(720);
  });

  it('inverts vertical elevation with 0° properly situated above the bottom', () => {
    const scales = createPanoramaScales({
      width: 720,
      height: 300,
      minElevationDeg: -2.0,
      maxElevationDeg: 8.0,
    });
    // Max elevation (8°) should be at top (y = 0)
    expect(scales.scaleY(8.0)).toBe(0);
    // Min elevation (-2°) should be at bottom (y = 300)
    expect(scales.scaleY(-2.0)).toBe(300);
    // Zero elevation should be at y = 240
    expect(scales.scaleY(0.0)).toBe(240);
  });

  it('contains cardinal and ordinal compass points covering 0° to 360°', () => {
    expect(COMPASS_POINTS.length).toBe(9);
    expect(COMPASS_POINTS[0]).toEqual({ azimuthDeg: 0, label: '0° N', isCardinal: true });
    expect(COMPASS_POINTS[2]).toEqual({ azimuthDeg: 90, label: '90° E', isCardinal: true });
    expect(COMPASS_POINTS[4]).toEqual({ azimuthDeg: 180, label: '180° S', isCardinal: true });
    expect(COMPASS_POINTS[6]).toEqual({ azimuthDeg: 270, label: '270° W', isCardinal: true });
    expect(COMPASS_POINTS[8]).toEqual({ azimuthDeg: 360, label: '360° N', isCardinal: true });
  });

  it('correctly validates true celestial angular diameters (Earth ~1.9°, Sun ~0.53°)', () => {
    // Read from typical physical dataset values
    const sunRadiusDeg = 0.265; // ~0.53° diameter
    const earthRadiusDeg = 0.95; // ~1.90° diameter

    const result = verifyAngularDiameter(sunRadiusDeg, earthRadiusDeg);
    expect(result.valid).toBe(true);
    expect(result.sunDiameterDeg).toBeCloseTo(0.53, 2);
    expect(result.earthDiameterDeg).toBeCloseTo(1.90, 2);
  });

  it('applies vertical exaggeration to vertical elevation without distorting horizontal azimuth', () => {
    const normalScales = createPanoramaScales({
      width: 720,
      height: 300,
      minElevationDeg: -2.0,
      maxElevationDeg: 8.0,
      verticalExaggeration: 1.0,
    });

    const exaggeratedScales = createPanoramaScales({
      width: 720,
      height: 300,
      minElevationDeg: -2.0,
      maxElevationDeg: 8.0,
      verticalExaggeration: 2.5,
    });

    // Horizontal azimuth mapping must remain identical
    expect(normalScales.scaleX(90)).toBe(exaggeratedScales.scaleX(90));
    expect(normalScales.scaleX(270)).toBe(exaggeratedScales.scaleX(270));

    // Vertical radius for discs scales proportionally
    const normalDisc = discRadiusInPixels(0.5, normalScales);
    const exaggeratedDisc = discRadiusInPixels(0.5, exaggeratedScales);

    expect(normalDisc.rx).toBe(exaggeratedDisc.rx);
    expect(exaggeratedDisc.ry).toBeCloseTo(normalDisc.ry * 2.5, 1);
  });
});
