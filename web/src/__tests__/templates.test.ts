/**
 * Unit Tests for Templated Site Comparison Text
 * 
 * Acceptance check:
 * - Tests for the templated text.
 * - Adheres strictly to wording rules: "visible" not "powered", "in line of sight" not "connected".
 */

import { describe, it, expect } from 'vitest';
import { generateSiteComparison } from '../utils/comparisonTemplate';

describe('Templated Comparison Generator', () => {
  it('generates dominant statement when Site A leads on sunlight and has shorter outage', () => {
    const siteA = {
      name: 'Shackleton Peak',
      sunUptimeFraction: 0.85,
      earthUptimeFraction: 0.90,
      dteUptimeFraction: 0.88,
      jointUptimeFraction: 0.80,
      longestDarknessH: 10,
      longestEarthOutageH: 4,
      groundElevM: 1400,
    };

    const siteB = {
      name: 'Amundsen Basin',
      sunUptimeFraction: 0.65,
      earthUptimeFraction: 0.80,
      dteUptimeFraction: 0.75,
      jointUptimeFraction: 0.60,
      longestDarknessH: 28,
      longestEarthOutageH: 16,
      groundElevM: -400,
    };

    const text = generateSiteComparison(siteA, siteB, 0.50);
    expect(text).toContain('Shackleton Peak provides 20.0% greater sunlight visibility');
    expect(text).toContain('12.0h shorter longest Earth line-of-sight outage');
    expect(text).toContain('(threshold ≥ 50% disc)');

    // Wording rules verification
    expect(text.toLowerCase()).not.toContain('powered');
    expect(text.toLowerCase()).not.toContain('connected');
    expect(text).toContain('line-of-sight');
  });

  it('generates trade-off statement when Site A has more sunlight but longer Earth outage', () => {
    const siteA = {
      name: 'Connecting Ridge',
      sunUptimeFraction: 0.82,
      earthUptimeFraction: 0.70,
      dteUptimeFraction: 0.68,
      jointUptimeFraction: 0.65,
      longestDarknessH: 12,
      longestEarthOutageH: 22,
      groundElevM: 1200,
    };

    const siteB = {
      name: 'Malapert Mountain',
      sunUptimeFraction: 0.72,
      earthUptimeFraction: 0.88,
      dteUptimeFraction: 0.85,
      jointUptimeFraction: 0.70,
      longestDarknessH: 18,
      longestEarthOutageH: 8,
      groundElevM: 2000,
    };

    const text = generateSiteComparison(siteA, siteB, 0.80);
    expect(text).toContain('Connecting Ridge offers 10.0% more sunlight visibility, but incurs a 14.0h longer Earth line-of-sight outage');
    expect(text).toContain('(threshold ≥ 80% disc)');
  });

  it('generates comparable statement when metrics are within 1.0%', () => {
    const siteA = {
      name: 'Plateau Alpha',
      sunUptimeFraction: 0.75,
      earthUptimeFraction: 0.85,
      dteUptimeFraction: 0.80,
      jointUptimeFraction: 0.72,
      longestDarknessH: 14,
      longestEarthOutageH: 6,
      groundElevM: 500,
    };

    const siteB = {
      name: 'Plateau Beta',
      sunUptimeFraction: 0.755,
      earthUptimeFraction: 0.848,
      dteUptimeFraction: 0.798,
      jointUptimeFraction: 0.718,
      longestDarknessH: 14.5,
      longestEarthOutageH: 6.2,
      groundElevM: 520,
    };

    const text = generateSiteComparison(siteA, siteB, 0.50);
    expect(text).toContain('demonstrate comparable illumination visibility and Earth line-of-sight availability within 1.0%');
  });
});
