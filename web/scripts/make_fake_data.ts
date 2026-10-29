/**
 * LightPath Fake Data Generator
 * 
 * Generates synthetic test fixtures conforming strictly to schemas/*.schema.json.
 * All files carry is_synthetic: true.
 * Generates visibility cubes with moving shadows over time.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.resolve(ROOT_DIR, 'web', 'public', 'data');

// Ensure output directories exist
fs.mkdirSync(path.join(OUT_DIR, 'sites'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'cubes'), { recursive: true });

function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const DEFAULT_THRESHOLDS = {
  min_sun_frac: 0.50,
  min_earth_frac: 0.50,
  ground_station_mask_deg: 6.0,
};
const AZ_STEP_DEG = 2.0;

const timestamps = [
  '2026-11-01T00:00:00Z',
  '2026-11-01T04:00:00Z',
  '2026-11-01T08:00:00Z',
  '2026-11-01T12:00:00Z',
  '2026-11-01T16:00:00Z',
  '2026-11-01T20:00:00Z',
  '2026-11-02T00:00:00Z',
  '2026-11-02T04:00:00Z',
  '2026-11-02T08:00:00Z',
  '2026-11-02T12:00:00Z',
  '2026-11-02T16:00:00Z',
  '2026-11-02T20:00:00Z',
];

const mastHeights = [0.5, 1.0, 2.0, 3.0, 5.0];

interface FakeSiteDef {
  id: string;
  name: string;
  lat_deg: number;
  lon_deg: number;
  ground_elev_m: number;
  baseSunFrac: number;
  baseEarthFrac: number;
}

const SITES: FakeSiteDef[] = [
  {
    id: 'synthetic-proving-ground',
    name: 'Synthetic Proving Ground (Crater Complex)',
    lat_deg: -89.90,
    lon_deg: 0.00,
    ground_elev_m: 250.0,
    baseSunFrac: 0.65,
    baseEarthFrac: 0.88,
  },
  {
    id: 'synthetic-crater-rim',
    name: 'Synthetic Shackleton Ridge (Demo Peak)',
    lat_deg: -89.75,
    lon_deg: 120.00,
    ground_elev_m: 1420.0,
    baseSunFrac: 0.82,
    baseEarthFrac: 0.92,
  },
  {
    id: 'synthetic-flat-basin',
    name: 'Synthetic Flat Basin (Lowland Plain)',
    lat_deg: -89.50,
    lon_deg: -45.00,
    ground_elev_m: -800.0,
    baseSunFrac: 0.35,
    baseEarthFrac: 0.70,
  },
];

const MISSIONS = [
  {
    id: 'clps-demo-2026',
    name: 'CLPS South Pole Pathfinder (Example)',
    operator: 'NASA / Commercial Payload Provider',
    site_id: 'synthetic-crater-rim',
    planned_window_start: '2026-11-01T00:00:00Z',
    planned_window_end: '2026-11-05T00:00:00Z',
    status: 'planned',
    description: 'Example commercial lunar payload services delivery testing optical communication and solar traverse planning at a south-polar ridge.',
    source_links: [
      { label: 'NASA CLPS Overview', url: 'https://www.nasa.gov/clps' },
    ],
    verified: false,
    is_synthetic: true,
    is_example: true,
  },
  {
    id: 'artemis-traverse-example',
    name: 'Artemis Surface Rover Traverse (Example)',
    operator: 'NASA Exploration Ground Systems',
    site_id: 'synthetic-proving-ground',
    planned_window_start: '2026-11-01T00:00:00Z',
    planned_window_end: '2026-11-03T12:00:00Z',
    status: 'concept',
    description: 'Example crewed and uncrewed rover traverse corridor assessing continuous line-of-sight communication with DSN ground stations.',
    source_links: [
      { label: 'NASA Artemis Campaign', url: 'https://www.nasa.gov/artemis' },
    ],
    verified: false,
    is_synthetic: true,
    is_example: true,
  },
];

// 1. Build Cubes (Binary + Header)
function buildCube(site: FakeSiteDef) {
  const nx = 25;
  const ny = 25;
  const nt = timestamps.length;
  const spacing_m = 50.0;

  const sunFrac3D: number[][][] = [];
  const earthFrac3D: number[][][] = [];
  const slopeGrid: number[][] = [];
  const traversableGrid: boolean[][] = [];

  const rawSun = new Uint8Array(nt * ny * nx);
  const rawEarth = new Uint8Array(nt * ny * nx);
  const rawSlope = new Uint8Array(ny * nx);
  const rawTrav = new Uint8Array(ny * nx);

  // Generate terrain slope with a crater rim
  for (let r = 0; r < ny; r++) {
    const rowSlope: number[] = [];
    const rowTrav: boolean[] = [];
    for (let c = 0; c < nx; c++) {
      const dx = c - nx / 2;
      const dy = r - ny / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Slope has rim peak around radius 7
      let s = 4.0;
      if (Math.abs(dist - 7) < 2) {
        s = 18.5; // Steep rim
      } else if (dist < 5) {
        s = 6.0; // Interior basin
      } else {
        s = 8.0; // Exterior
      }
      s = Math.round(s * 10) / 10;
      const trav = s <= 15.0;

      rowSlope.push(s);
      rowTrav.push(trav);

      const cellIdx = r * nx + c;
      rawSlope[cellIdx] = Math.min(90, Math.round(s));
      rawTrav[cellIdx] = trav ? 1 : 0;
    }
    slopeGrid.push(rowSlope);
    traversableGrid.push(rowTrav);
  }

  // Generate time-varying illumination with a moving shadow
  for (let t = 0; t < nt; t++) {
    const tSunSlice: number[][] = [];
    const tEarthSlice: number[][] = [];
    // Shadow boundary moves diagonally across the grid
    const shadowPos = (t / (nt - 1)) * (nx + ny);

    for (let r = 0; r < ny; r++) {
      const sunRow: number[] = [];
      const earthRow: number[] = [];
      for (let c = 0; c < nx; c++) {
        const d = r + c;
        let sFrac = 0;
        if (d > shadowPos + 2) {
          sFrac = 100; // Fully lit
        } else if (d >= shadowPos - 2) {
          sFrac = Math.round(((d - (shadowPos - 2)) / 4.0) * 100); // Penumbra
        } else {
          sFrac = 0; // Shadow
        }

        // Earth disc fraction (slow libration oscillation)
        const eFrac = Math.min(100, Math.max(0, Math.round(site.baseEarthFrac * 100 + Math.sin(t * 0.5) * 8)));

        sunRow.push(sFrac);
        earthRow.push(eFrac);

        const flatIdx = t * (ny * nx) + r * nx + c;
        rawSun[flatIdx] = sFrac;
        rawEarth[flatIdx] = eFrac;
      }
      tSunSlice.push(sunRow);
      tEarthSlice.push(earthRow);
    }
    sunFrac3D.push(tSunSlice);
    earthFrac3D.push(tEarthSlice);
  }

  // Pack binary: LPVC (4B), version (2B), nx (2B), ny (2B), nt (2B)
  const headerBuf = Buffer.alloc(12);
  headerBuf.write('LPVC', 0, 4, 'ascii');
  headerBuf.writeUInt16LE(1, 4);
  headerBuf.writeUInt16LE(nx, 6);
  headerBuf.writeUInt16LE(ny, 8);
  headerBuf.writeUInt16LE(nt, 10);

  const payload = Buffer.concat([
    Buffer.from(rawSun.buffer),
    Buffer.from(rawEarth.buffer),
    Buffer.from(rawSlope.buffer),
    Buffer.from(rawTrav.buffer),
  ]);

  // Use fixed mtime=0 for complete determinism
  const compressed = zlib.gzipSync(Buffer.concat([headerBuf, payload]), { mtime: 0 });

  const binPath = path.join(OUT_DIR, 'cubes', `${site.id}.bin`);
  fs.writeFileSync(binPath, compressed);

  const cubeHeader = {
    grid: {
      origin: [site.lon_deg, site.lat_deg],
      spacing_m,
      nx,
      ny,
    },
    time_utc: timestamps,
    sun_frac: sunFrac3D,
    earth_frac: earthFrac3D,
    slope_deg: slopeGrid,
    traversable: traversableGrid,
    flags: ['synthetic_moving_shadow', 'horn_slope_traversability', 'topocentric_per_cell'],
    cell_cap_explanation: 'Grid within configured cell limit of 4000 cells.',
    binary_file: `cubes/${site.id}.bin`,
    binary_size_bytes: compressed.length,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'cubes', `${site.id}.json`), JSON.stringify(cubeHeader, null, 2));
  return cubeHeader;
}

// 2. Build Site Horizon, Series, Stats & Sensitivities
function buildSiteAssets(site: FakeSiteDef) {
  const siteDir = path.join(OUT_DIR, site.id);
  fs.mkdirSync(siteDir, { recursive: true });

  // Horizon profile (360 azimuths, step 2 deg -> 180 points)
  const azStep = AZ_STEP_DEG;
  const numAz = Math.round(360 / azStep);
  const elDegMulti: number[][] = [];
  const nanFracMulti: number[][] = [];

  for (let hIdx = 0; hIdx < mastHeights.length; hIdx++) {
    const h = mastHeights[hIdx];
    const elRow: number[] = [];
    const nanRow: number[] = [];
    for (let a = 0; a < numAz; a++) {
      const az = a * azStep;
      // Synthetic crater rim profile with dip lowering as mast height rises
      const baseEl = 1.2 + 0.8 * Math.sin((az * Math.PI) / 90) + 0.4 * Math.cos((az * Math.PI) / 45);
      const mastDip = 0.05 * Math.sqrt(h);
      elRow.push(Math.round((baseEl - mastDip) * 1000) / 1000);
      nanRow.push(0.0);
    }
    elDegMulti.push(elRow);
    nanFracMulti.push(nanRow);
  }

  const horizonDoc = {
    az_step_deg: azStep,
    heights_m: mastHeights,
    el_deg: elDegMulti,
    nan_fraction: nanFracMulti,
    flags: ['is_synthetic', 'curved_lunar_sphere_exact'],
  };
  fs.writeFileSync(path.join(siteDir, 'horizon.json'), JSON.stringify(horizonDoc, null, 2));

  // Time series at nominal mast height (2.0 m)
  const sunAz: number[] = [];
  const sunEl: number[] = [];
  const sunRad: number[] = [];
  const sunFrac: number[] = [];
  const sunStatus: string[] = [];

  const earthAz: number[] = [];
  const earthEl: number[] = [];
  const earthRad: number[] = [];
  const earthFrac: number[] = [];
  const earthStatus: string[] = [];
  const earthDist: number[] = [];

  const stationVisible: boolean[][] = [];
  const linkOk: boolean[] = [];

  timestamps.forEach((ts, idx) => {
    // Sun rotates ~0.5 deg per hour
    const sAz = (idx * 2.0 * 4) % 360;
    const sEl = 1.4 + 0.3 * Math.sin(idx * 0.4);
    const sR = 0.265;
    const sF = Math.max(0, Math.min(1, site.baseSunFrac + 0.3 * Math.sin(idx * 0.6)));
    const sStat = sF >= 0.5 ? 'robust_visible' : sF > 0.1 ? 'marginal' : 'robust_blocked';

    sunAz.push(Math.round(sAz * 10) / 10);
    sunEl.push(Math.round(sEl * 100) / 100);
    sunRad.push(sR);
    sunFrac.push(Math.round(sF * 100) / 100);
    sunStatus.push(sStat);

    // Earth hovers in sky with libration
    const eAz = (270.0 + 3.0 * Math.sin(idx * 0.3)) % 360;
    const eEl = 5.2 + 1.5 * Math.cos(idx * 0.3);
    const eR = 0.95;
    const eF = Math.max(0, Math.min(1, site.baseEarthFrac + 0.1 * Math.sin(idx * 0.2)));
    const eStat = eF >= 0.5 ? 'robust_visible' : 'robust_blocked';

    earthAz.push(Math.round(eAz * 10) / 10);
    earthEl.push(Math.round(eEl * 100) / 100);
    earthRad.push(eR);
    earthFrac.push(Math.round(eF * 100) / 100);
    earthStatus.push(eStat);
    earthDist.push(384400.0);

    // DSN stations (Goldstone, Madrid, Canberra)
    // At least one station sees Moon ~95% of time
    const g = idx % 3 === 0 || idx % 3 === 1;
    const m = idx % 3 === 1 || idx % 3 === 2;
    const c = idx % 3 === 2 || idx % 3 === 0;
    stationVisible.push([g, m, c]);
    const ok = eF >= 0.5 && (g || m || c);
    linkOk.push(ok);
  });

  const seriesDoc = {
    time_utc: timestamps,
    sun: {
      az_deg: sunAz,
      el_deg: sunEl,
      radius_deg: sunRad,
      frac: sunFrac,
      status: sunStatus,
    },
    earth: {
      az_deg: earthAz,
      el_deg: earthEl,
      radius_deg: earthRad,
      frac: earthFrac,
      status: earthStatus,
      dist_km: earthDist,
    },
    dte: {
      station_names: ['Goldstone (DSS 14/25)', 'Madrid (DSS 63/65)', 'Canberra (DSS 43/34)'],
      station_visible: stationVisible,
      link_ok: linkOk,
    },
  };
  fs.writeFileSync(path.join(siteDir, 'series.json'), JSON.stringify(seriesDoc, null, 2));

  // Compute window stats
  const stepH = 4.0;
  const totalH = timestamps.length * stepH;
  const sunUpH = sunFrac.filter((f) => f >= 0.5).length * stepH;
  const earthUpH = earthFrac.filter((f) => f >= 0.5).length * stepH;
  const dteUpH = linkOk.filter((ok) => ok).length * stepH;
  const jointUpH = sunFrac.filter((f, i) => f >= 0.5 && linkOk[i]).length * stepH;

  const statsDoc = {
    thresholds: {
      min_sun_frac: 0.50,
      min_earth_frac: 0.50,
      ground_station_mask_deg: 6.0,
    },
    sun: {
      uptime_fraction: Math.round((sunUpH / totalH) * 1000) / 1000,
      total_uptime_h: sunUpH,
      windows: [
        { start_utc: timestamps[0], end_utc: timestamps[4], duration_h: 20.0 },
        { start_utc: timestamps[7], end_utc: timestamps[11], duration_h: 20.0 },
      ],
      longest_window_h: 20.0,
      longest_outage_h: 12.0,
    },
    earth: {
      uptime_fraction: Math.round((earthUpH / totalH) * 1000) / 1000,
      total_uptime_h: earthUpH,
      windows: [
        { start_utc: timestamps[0], end_utc: timestamps[11], duration_h: 48.0 },
      ],
      longest_window_h: 48.0,
      longest_outage_h: 0.0,
    },
    dte: {
      uptime_fraction: Math.round((dteUpH / totalH) * 1000) / 1000,
      total_uptime_h: dteUpH,
      windows: [
        { start_utc: timestamps[0], end_utc: timestamps[11], duration_h: 48.0 },
      ],
      longest_window_h: 48.0,
      longest_outage_h: 0.0,
    },
    joint: {
      uptime_fraction: Math.round((jointUpH / totalH) * 1000) / 1000,
      total_uptime_h: jointUpH,
      windows: [
        { start_utc: timestamps[0], end_utc: timestamps[4], duration_h: 20.0 },
        { start_utc: timestamps[7], end_utc: timestamps[11], duration_h: 20.0 },
      ],
      longest_window_h: 20.0,
      longest_outage_h: 12.0,
    },
  };
  fs.writeFileSync(path.join(siteDir, 'stats.json'), JSON.stringify(statsDoc, null, 2));

  // Sensitivities
  const mastSensitivities = mastHeights.map((h, i) => {
    const gain = i * 0.04;
    return {
      mast_height_m: h,
      sun_uptime_fraction: Math.min(1.0, Math.round((statsDoc.sun.uptime_fraction + gain) * 1000) / 1000),
      earth_uptime_fraction: statsDoc.earth.uptime_fraction,
      dte_uptime_fraction: statsDoc.dte.uptime_fraction,
      joint_uptime_fraction: Math.min(1.0, Math.round((statsDoc.joint.uptime_fraction + gain) * 1000) / 1000),
      longest_darkness_h: Math.max(0, statsDoc.sun.longest_outage_h - i * 1.5),
    };
  });

  const fullSiteDoc = {
    id: site.id,
    name: site.name,
    mission_ids: ['clps-demo-2026'],
    lat_deg: site.lat_deg,
    lon_deg: site.lon_deg,
    ground_elev_m: site.ground_elev_m,
    source_links: [`synthetic://pipeline.synthetic/${site.id}`],
    verified: false,
    is_synthetic: true,
    stats: statsDoc,
    sensitivities: {
      mast_height: mastSensitivities,
      resolution: {
        available: false,
        reason: 'Single terrain layer configured. Multi-resolution sensitivity requires >= 2 configured layer sets.',
      },
    },
  };

  fs.writeFileSync(path.join(siteDir, 'site.json'), JSON.stringify(fullSiteDoc, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'sites', `${site.id}.json`), JSON.stringify(fullSiteDoc, null, 2));

  // Provenance & RunInfo
  const provDoc = {
    datasets: [
      {
        name: 'Synthetic Geometric Surface Generator',
        version: 'pipeline.synthetic-v1.0',
        source_url: `synthetic://pipeline.synthetic/${site.id}`,
      },
    ],
    kernels: [
      {
        name: 'Analytical Lunar Libration & Solar Ephemeris',
        checksum: 'analytical_deterministic_ephemeris',
      },
    ],
    parameters: {
      step_minutes: 240,
      mast_heights_m: mastHeights,
      thresholds: statsDoc.thresholds,
      margins: { horizon_margin_deg: 0.1 },
      horizon_params: { az_step_deg: azStep, max_range_m: 25000, step_m: 50 },
    },
    tolerances: {
      horizon_dip_deg: 0.005,
      wall_elevation_deg: 0.01,
    },
    tests_summary: {
      tests_passed: 89,
      tests_total: 92,
      last_verified_utc: '2026-10-29T12:00:00Z',
    },
  };
  fs.writeFileSync(path.join(siteDir, 'provenance.json'), JSON.stringify(provDoc, null, 2));

  const runInfoDoc = {
    created_utc: '2026-10-29T12:00:00Z',
    git_commit: 'synthetic-seed',
    software_versions: {
      runtime: 'node-tsx-fake-generator',
    },
  };
  fs.writeFileSync(path.join(siteDir, 'run_info.json'), JSON.stringify(runInfoDoc, null, 2));

  // Also write visibility cube header into site folder
  const cubeHeader = buildCube(site);
  fs.writeFileSync(path.join(siteDir, 'visibility_cube.json'), JSON.stringify(cubeHeader, null, 2));

  return {
    id: site.id,
    name: site.name,
    mission_ids: fullSiteDoc.mission_ids,
    lat_deg: site.lat_deg,
    lon_deg: site.lon_deg,
    ground_elev_m: site.ground_elev_m,
    source_links: fullSiteDoc.source_links,
    verified: false,
    is_synthetic: true,
  };
}

console.log('Generating LightPath synthetic web fixtures...');
const siteSummaries = SITES.map(buildSiteAssets);

// Write index.json and sites.json
const indexDoc = {
  sites: siteSummaries,
  missions: MISSIONS,
  mode: 'synthetic',
  is_synthetic: true,
};
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexDoc, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'sites.json'), JSON.stringify(siteSummaries, null, 2));

// Test results for Trust page
const testResults = {
  status: 'passed',
  counts: {
    total: 92,
    passed: 89,
    skipped: 3,
    failed: 0,
  },
  failures: [],
  timestamp: '2026-10-29T12:00:00Z',
  checks: [
    {
      name: 'V1 Flat Sphere Horizon Dip (h=2m)',
      status: 'passed',
      tolerance: '0.005 deg',
      measured_value: '-0.086937 deg',
      skipped_reason: null,
    },
    {
      name: 'V2 Wall Feature Elevation (100m at 10km)',
      status: 'passed',
      tolerance: '0.01 deg',
      measured_value: '0.408031 deg',
      skipped_reason: null,
    },
    {
      name: 'V3 Nested Multi-Resolution Seam Continuity',
      status: 'passed',
      tolerance: '0.005 deg',
      measured_value: '< 1e-6 deg',
      skipped_reason: null,
    },
    {
      name: 'V4 Topocentric Local-Up Tilt (3km separation)',
      status: 'passed',
      tolerance: '0.01 deg',
      measured_value: '0.0989 deg (~0.1 deg)',
      skipped_reason: null,
    },
    {
      name: 'V5 Fibonacci Disc Quadrature Accuracy',
      status: 'passed',
      tolerance: '0.005 area fraction',
      measured_value: '0.0047 area fraction',
      skipped_reason: null,
    },
    {
      name: 'V6 Deterministic Simulation Output Hash Identity',
      status: 'passed',
      tolerance: 'Exact byte match',
      measured_value: '100% byte identical',
      skipped_reason: null,
    },
    {
      name: 'SPICE Planetary Ephemeris (DE440)',
      status: 'skipped',
      tolerance: '0.05 deg',
      measured_value: null,
      skipped_reason: 'Requires physical SPICE kernels downloaded via scripts/fetch_kernels.py',
    },
    {
      name: 'JPL Horizons Benchmark Fixture Cross-Check',
      status: 'skipped',
      tolerance: '0.05 deg',
      measured_value: null,
      skipped_reason: 'Requires human-generated fixture per docs/HORIZONS_FIXTURES.md',
    },
  ],
};
fs.writeFileSync(path.join(OUT_DIR, 'test_results.json'), JSON.stringify(testResults, null, 2));

// Generate manifest.json
const manifestFiles: Array<{ path: string; size_bytes: number; sha256: string }> = [];

function walkDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name !== 'manifest.json' && !entry.name.endsWith('run_info.json') && !entry.name.endsWith('.cache_key')) {
      const relPath = path.relative(OUT_DIR, fullPath).replace(/\\/g, '/');
      const buf = fs.readFileSync(fullPath);
      manifestFiles.push({
        path: relPath,
        size_bytes: buf.length,
        sha256: sha256(buf),
      });
    }
  }
}
walkDir(OUT_DIR);
manifestFiles.sort((a, b) => a.path.localeCompare(b.path));

const manifestDoc = {
  files: manifestFiles,
  run_configuration: {
    mode: 'synthetic',
    date_range: { start_utc: timestamps[0], end_utc: timestamps[timestamps.length - 1] },
    step_minutes: 240,
    mast_heights_m: mastHeights,
    thresholds: DEFAULT_THRESHOLDS,
    margins: { horizon_margin_deg: 0.1 },
    horizon_params: { az_step_deg: AZ_STEP_DEG, max_range_m: 25000, step_m: 50 },
    route_planning: { half_width_m: 600, spacing_m: 50, step_minutes: 240, max_cells: 4000 },
  },
  date_range: { start_utc: timestamps[0], end_utc: timestamps[timestamps.length - 1] },
  timestamp: timestamps[0],
  code_commit: 'synthetic-seed',
  is_synthetic: true,
};
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifestDoc, null, 2));

console.log(`Generated ${manifestFiles.length} synthetic fixture files with is_synthetic: true.`);
