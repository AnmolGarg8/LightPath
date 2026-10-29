/**
 * Templated comparison generator for site comparisons.
 * 
 * Complies with PROJECT_RULES:
 * - Strictly uses "visible", "in line of sight", never "powered" or "connected".
 * - Always includes explicit threshold reference.
 * - Formats concise, human-legible comparative statements for mission planners.
 */

export interface SiteComparisonInput {
  name: string;
  sunUptimeFraction: number;
  earthUptimeFraction: number;
  dteUptimeFraction: number;
  jointUptimeFraction: number;
  longestDarknessH: number;
  longestEarthOutageH: number;
  groundElevM: number;
}

/**
 * Generates an authoritative, factual one-line comparison between two landing sites.
 */
export function generateSiteComparison(
  siteA: SiteComparisonInput,
  siteB: SiteComparisonInput,
  threshold: number = 0.50
): string {
  const thresholdPct = Math.round(threshold * 100);
  const sunDelta = (siteA.sunUptimeFraction - siteB.sunUptimeFraction) * 100;
  const jointDelta = (siteA.jointUptimeFraction - siteB.jointUptimeFraction) * 100;
  const darkDelta = siteA.longestDarknessH - siteB.longestDarknessH;
  const outageDelta = siteA.longestEarthOutageH - siteB.longestEarthOutageH;

  // Case 1: Site A dominates on both sunlight visibility and communication line of sight
  if (sunDelta > 1.0 && outageDelta < -1.0) {
    return `${siteA.name} provides ${Math.abs(sunDelta).toFixed(1)}% greater sunlight visibility and a ${Math.abs(outageDelta).toFixed(1)}h shorter longest Earth line-of-sight outage than ${siteB.name} (threshold ≥ ${thresholdPct}% disc).`;
  }

  // Case 2: Site B dominates on both
  if (sunDelta < -1.0 && outageDelta > 1.0) {
    return `${siteB.name} provides ${Math.abs(sunDelta).toFixed(1)}% greater sunlight visibility and a ${Math.abs(outageDelta).toFixed(1)}h shorter longest Earth line-of-sight outage than ${siteA.name} (threshold ≥ ${thresholdPct}% disc).`;
  }

  // Case 3: Trade-off - One site has more sunlight, other has better Earth line of sight
  if (sunDelta > 1.0 && outageDelta > 1.0) {
    return `${siteA.name} offers ${Math.abs(sunDelta).toFixed(1)}% more sunlight visibility, but incurs a ${Math.abs(outageDelta).toFixed(1)}h longer Earth line-of-sight outage than ${siteB.name} (threshold ≥ ${thresholdPct}% disc).`;
  }

  if (sunDelta < -1.0 && outageDelta < -1.0) {
    return `${siteB.name} offers ${Math.abs(sunDelta).toFixed(1)}% more sunlight visibility, but incurs a ${Math.abs(outageDelta).toFixed(1)}h longer Earth line-of-sight outage than ${siteA.name} (threshold ≥ ${thresholdPct}% disc).`;
  }

  // Case 4: Joint availability divergence
  if (Math.abs(jointDelta) > 1.0) {
    const leader = jointDelta > 0 ? siteA.name : siteB.name;
    const trailer = jointDelta > 0 ? siteB.name : siteA.name;
    return `${leader} delivers ${Math.abs(jointDelta).toFixed(1)}% higher joint sunlight and direct-to-Earth line of sight than ${trailer} (threshold ≥ ${thresholdPct}% disc).`;
  }

  // Case 5: Darkness spell difference
  if (Math.abs(darkDelta) > 1.0) {
    const better = darkDelta < 0 ? siteA.name : siteB.name;
    const worse = darkDelta < 0 ? siteB.name : siteA.name;
    return `${better} reduces the longest continuous darkness spell by ${Math.abs(darkDelta).toFixed(1)}h compared to ${worse} (threshold ≥ ${thresholdPct}% disc).`;
  }

  // Default: Comparable performance
  return `${siteA.name} and ${siteB.name} demonstrate comparable illumination visibility and Earth line-of-sight availability within 1.0% (threshold ≥ ${thresholdPct}% disc).`;
}
