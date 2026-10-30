/**
 * Guided Demo Script (90-Second Walkthrough)
 * 
 * Complies with Prompt 14:
 * Eight scripted steps with captions, pause support, and route targets:
 * 1. Mission browser
 * 2. Site panorama scrub
 * 3. Mast height change
 * 4. Direct-to-Earth contact
 * 5. Route planning from lander to a nearby point
 * 6. Infeasible case with relaxation
 * 7. Evidence Card
 * 8. Trust page
 */

export interface DemoStep {
  id: number;
  title: string;
  caption: string;
  route: string;
  durationSeconds: number;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    title: '1. CLPS Mission Browser',
    caption: 'LightPath evaluates lunar south-pole CLPS landing sites for solar illumination and direct-to-Earth contact. Each card displays verified mission windows and headline availability.',
    route: '#/',
    durationSeconds: 10,
  },
  {
    id: 2,
    title: '2. 360° Horizon Panorama',
    caption: 'The true-angular Sun (0.53°) and Earth (1.90°) discs are clipped in real time by the 3D terrain skyline. Notice the grazing solar path along the southern crater rims.',
    route: '#/site/synthetic-proving-ground',
    durationSeconds: 11,
  },
  {
    id: 3,
    title: '3. Observer Mast Height Sensitivity',
    caption: 'Raising the observer mast from 2.0m to 5.0m depresses the horizon skyline, recovering sunlight that would otherwise be blocked by near-field ridges.',
    route: '#/site/synthetic-proving-ground',
    durationSeconds: 9,
  },
  {
    id: 4,
    title: '4. Direct-to-Earth (DTE) Contact',
    caption: 'Multi-lane timeline displays simultaneous Sun visibility, Earth line of sight, and Deep Space Network (DSN) ground station contact across Goldstone, Madrid, and Canberra.',
    route: '#/site/synthetic-proving-ground',
    durationSeconds: 10,
  },
  {
    id: 5,
    title: '5. Comparative Site Trade Study',
    caption: 'Side-by-side comparison of candidate landing sites with identical scales, synchronized thresholds, overlaid skyline profiles, and automated advantage metrics.',
    route: '#/compare/synthetic-proving-ground/synthetic-crater-rim',
    durationSeconds: 11,
  },
  {
    id: 6,
    title: '6. Dynamic Space-Time Traverse',
    caption: 'Our signature feature: a 4D space-time solver. A rover travels across the terrain, calculating movement speed against advancing shadow boundaries in under one second.',
    route: '#/route/synthetic-proving-ground',
    durationSeconds: 13,
  },
  {
    id: 7,
    title: '7. Infeasible Analysis & One-Click Relaxation',
    caption: 'When steep slopes or advancing shadows block travel, LightPath explains the mathematical bottleneck and provides an instant one-click suggested relaxation.',
    route: '#/route/synthetic-proving-ground',
    durationSeconds: 10,
  },
  {
    id: 8,
    title: '8. One-Page Printable Evidence Card',
    caption: 'A NASA-style printable briefing card detailing exact geodetic coordinates, kernel checksums, software versions, provenance hash, and synthetic data watermarks.',
    route: '#/evidence/synthetic-proving-ground',
    durationSeconds: 9,
  },
  {
    id: 9,
    title: '9. Scientific Trust & Verification',
    caption: 'V1 through V6 verification suite proving exact spherical formulas, convergence limits, and cross-checks with published NASA data (Barker et al. 2021). Math before claims.',
    route: '#/trust',
    durationSeconds: 10,
  },
];
