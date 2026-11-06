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
    caption: 'LightPath evaluates NASA CLPS candidate landing sites across the lunar south pole for solar illumination, Earth line-of-sight, and communications windows.',
    route: '#/',
    durationSeconds: 10,
  },
  {
    id: 2,
    title: '2. 360° Topocentric Horizon Skyline',
    caption: 'Real NASA LOLA topography at Shackleton Connecting Ridge. The Sun (0.53°) and Earth (1.90°) discs are rendered at physical scale, clipped in real time by the crater rim.',
    route: '#/site/shackleton-connecting-ridge',
    durationSeconds: 11,
  },
  {
    id: 3,
    title: '3. Observer Mast Height Optimization',
    caption: 'Raising the solar array mast from 2.0m to 5.0m depresses the horizon skyline, recovering over 90 hours of continuous sunlight otherwise blocked by near-field ridges.',
    route: '#/site/shackleton-connecting-ridge',
    durationSeconds: 9,
  },
  {
    id: 4,
    title: '4. Direct-to-Earth (DTE) Network Contact',
    caption: 'Multi-lane timeline displays simultaneous solar illumination, Earth optical line of sight, and Deep Space Network (DSN) contact across Goldstone, Madrid, and Canberra.',
    route: '#/site/shackleton-connecting-ridge',
    durationSeconds: 10,
  },
  {
    id: 5,
    title: '5. Comparative Site Trade Study',
    caption: 'Side-by-side trade study between Shackleton Connecting Ridge and Malapert Mountain, comparing peak sunlight uptime, maximum darkness spells, and link windows.',
    route: '#/compare/shackleton-connecting-ridge/malapert-mountain',
    durationSeconds: 11,
  },
  {
    id: 6,
    title: '6. 4D Space-Time Traverse Planning',
    caption: 'Our signature feature: a 4D space-time solver. A rover traveling at 8 cm/s navigates dynamic shadow corridors across Shackleton Ridge, evading cryogenic freeze.',
    route: '#/route/shackleton-connecting-ridge',
    durationSeconds: 13,
  },
  {
    id: 7,
    title: '7. Infeasibility Bottleneck & Relaxation',
    caption: 'When steep slopes or advancing shadows block travel, LightPath pinpoints the exact mathematical bottleneck and computes the smallest parameter relaxation.',
    route: '#/route/malapert-mountain',
    durationSeconds: 10,
  },
  {
    id: 8,
    title: '8. Mission Readiness Evidence Card',
    caption: 'A single-page printable NASA engineering dossier with exact geodetic coordinates, LOLA DEM resolution, DE440 ephemeris manifests, and SHA-256 provenance hashes.',
    route: '#/evidence/shackleton-connecting-ridge',
    durationSeconds: 9,
  },
  {
    id: 9,
    title: '9. Scientific Trust & Verification',
    caption: 'V1 through V8 verification suite proving exact spherical formulas, double-precision cross-engine parity (< 10⁻⁹ deg), and route solver optimality. Math before claims.',
    route: '#/trust',
    durationSeconds: 10,
  },
];
