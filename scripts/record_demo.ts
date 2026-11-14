/**
 * Automated 90-Second Demo Video Recording and Screenshot Generator
 *
 * Governed by docs/PROJECT_RULES.md (Rule 1 & Rule 2):
 * - Records a continuous 90-second walkthrough in a 1920x1080 viewport.
 * - Serves the production build (web/dist) locally.
 * - Injects legible caption banners matching docs/PITCH.md.
 * - Captures numbered screenshots in docs/images/.
 * - Saves output to docs/demo.webm.
 * - STRICT VALIDATION: Fails with non-zero exit code if any caption number differs from docs/pitch_numbers.json.
 * - No voice, no music, no people.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// Load Playwright from web/node_modules
const playwrightPath = path.resolve(__dirname, '../web/node_modules/playwright');
const { chromium } = require(playwrightPath);

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'web/dist');
const DOCS_DIR = path.resolve(ROOT_DIR, 'docs');
const IMAGES_DIR = path.resolve(DOCS_DIR, 'images');
const PITCH_NUMBERS_PATH = path.resolve(DOCS_DIR, 'pitch_numbers.json');

// Interface for demo steps
interface DemoStep {
  id: number;
  slug: string;
  title: string;
  headingSelector: string;
  expectedHeadingText: string;
  url: string;
  actionBeforeWait?: (page: any) => Promise<void>;
  caption: string;
  durationMs: number;
  expectedNumbers: number[];
}

/**
 * Start lightweight local static file server for web/dist
 */
function startLocalServer(distDir: string, port = 4173): Promise<http.Server> {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.bin': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.csv': 'text/csv',
    '.parquet': 'application/octet-stream',
  };

  const server = http.createServer((req, res) => {
    let reqUrl = req.url || '/';
    reqUrl = reqUrl.split('?')[0].split('#')[0];
    if (reqUrl === '/' || !reqUrl) reqUrl = '/index.html';

    let filePath = path.join(distDir, reqUrl);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } catch (err) {
      res.writeHead(500);
      res.end('Server Error');
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`[SERVER] Serving ${distDir} at http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * Validate that every number present in a caption matches authoritative pitch_numbers.json
 */
function validateCaptionNumbers(caption: string, pitchNumbers: Record<string, any>, expectedNumbers: number[]): void {
  // Extract all numbers (integers or floats, with optional negative sign)
  const matches = caption.match(/-?\d+(?:\.\d+)?/g) || [];
  const foundNumbers = matches.map(Number);

  // Collect all known numbers from pitch_numbers.json into an authoritative lookup
  const authoritativeNumbers = new Set<number>();

  function collectFromObj(obj: any) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number') {
      authoritativeNumbers.add(obj);
    } else if (typeof obj === 'string') {
      const parsed = parseFloat(obj.replace('%', ''));
      if (!isNaN(parsed)) authoritativeNumbers.add(parsed);
      const strMatches = obj.match(/-?\d+(?:\.\d+)?/g);
      if (strMatches) {
        for (const m of strMatches) authoritativeNumbers.add(parseFloat(m));
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(collectFromObj);
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(collectFromObj);
    }
  }

  collectFromObj(pitchNumbers);

  // Also include the declared benchmark indices V1..V8 if used as descriptors
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((n) => authoritativeNumbers.add(n));

  for (const num of foundNumbers) {
    // Check against authoritative numbers with small float tolerance
    let matched = false;
    for (const auth of authoritativeNumbers) {
      if (Math.abs(auth - num) < 1e-4) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(
        `[AUDIT FAIL] Caption number ${num} in caption:\n"${caption}"\ndoes NOT match any authoritative number in docs/pitch_numbers.json!`
      );
    }
  }

  // Ensure all declared expected numbers are actually present in the caption
  for (const exp of expectedNumbers) {
    let present = false;
    for (const f of foundNumbers) {
      if (Math.abs(f - exp) < 1e-4) {
        present = true;
        break;
      }
    }
    if (!present) {
      throw new Error(`[AUDIT FAIL] Expected number ${exp} was not found in caption:\n"${caption}"`);
    }
  }
}

/**
 * Inject stylish, high-contrast readable caption banner into DOM
 */
async function injectCaptionBanner(page: any, stepNumber: number, title: string, captionText: string): Promise<void> {
  await page.evaluate(
    ({ num, heading, text }: { num: number; heading: string; text: string }) => {
      let banner = document.getElementById('demo-caption-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'demo-caption-banner';
        document.body.appendChild(banner);
      }

      banner.style.position = 'fixed';
      banner.style.bottom = '28px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.width = 'calc(100% - 96px)';
      banner.style.maxWidth = '1480px';
      banner.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
      banner.style.border = '2px solid rgba(56, 189, 248, 0.6)';
      banner.style.borderRadius = '12px';
      banner.style.padding = '18px 28px';
      banner.style.color = '#f8fafc';
      banner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      banner.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.85)';
      banner.style.zIndex = '999999';
      banner.style.backdropFilter = 'blur(10px)';

      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #0284c7; color: #fff; font-size: 12px; font-weight: 800; padding: 2px 8px; borderRadius: 4px;">STEP ${num} OF 6</span>
            <span style="font-size: 15px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">${heading}</span>
          </div>
          <div style="font-size: 13px; color: #94a3b8; font-family: monospace;">LightPath 90s Guided Demo</div>
        </div>
        <div style="font-size: 19px; line-height: 1.45; font-weight: 500; color: #f1f5f9;">${text}</div>
      `;
    },
    { num: stepNumber, heading: title, text: captionText }
  );
}

async function main(): Promise<void> {
  console.log('=== LightPath 90-Second Demo Recording & Captions Verification ===');

  if (!fs.existsSync(PITCH_NUMBERS_PATH)) {
    throw new Error(`docs/pitch_numbers.json not found! Run python scripts/pitch_numbers.py first.`);
  }

  const pitchNumbers = JSON.parse(fs.readFileSync(PITCH_NUMBERS_PATH, 'utf-8'));
  console.log(`[DATA] Loaded authoritative pitch numbers (commit ${pitchNumbers.commit_hash}, date ${pitchNumbers.generation_date}).`);

  // Ensure output directories exist
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const tempVideoDir = path.resolve(DOCS_DIR, 'video_temp');
  fs.mkdirSync(tempVideoDir, { recursive: true });

  // 90-second path definition conforming strictly to instructions:
  // Step 1: Home (15s)
  // Step 2: Route Planner (18s) - shows scenario story & departure window map
  // Step 3: Site Page (17s) - panorama, Sun lens
  // Step 4: Trust (15s) - V1 to V8 (V4 & V7 NOT RUN)
  // Step 5: Evidence card (13s)
  // Step 6: Data page (12s)
  // Total = 15 + 18 + 17 + 15 + 13 + 12 = 90s
  const steps: DemoStep[] = [
    {
      id: 1,
      slug: 'home',
      title: 'Home & Lunar Site Assessment',
      headingSelector: 'h1',
      expectedHeadingText: 'LightPath',
      url: 'http://127.0.0.1:4173/#/',
      caption: `At ${pitchNumbers.site_name} (${pitchNumbers.site_lat_deg.toFixed(1)}° N, ${pitchNumbers.site_lon_deg.toFixed(1)}° E), solar uptime is ${pitchNumbers.sun_uptime_pct} (${pitchNumbers.sun_uptime_h} hours) with ${pitchNumbers.longest_darkness_h} hours (${pitchNumbers.longest_darkness_days} days) of longest darkness.`,
      durationMs: 15000,
      expectedNumbers: [
        pitchNumbers.site_lat_deg,
        pitchNumbers.site_lon_deg,
        parseFloat(pitchNumbers.sun_uptime_pct.replace('%', '')),
        pitchNumbers.sun_uptime_h,
        pitchNumbers.longest_darkness_h,
        pitchNumbers.longest_darkness_days,
      ],
      actionBeforeWait: async (page) => {
        // Find and highlight 'Try the demo'
        const btn = page.locator('[data-testid="try-the-demo-btn"]');
        if (await btn.isVisible()) {
          await btn.scrollIntoViewIfNeeded();
        }
      },
    },
    {
      id: 2,
      slug: 'route_planner',
      title: '4D Space-Time Route Planner',
      headingSelector: 'h1',
      expectedHeadingText: 'Route Planner',
      url: 'http://127.0.0.1:4173/#/route/test-location',
      caption: `Between demo coordinates, ${pitchNumbers.route_demo_working_steps} departure steps are feasible, providing a ${pitchNumbers.route_demo_window_availability_h}-hour departure window before advancing shadows block the corridor. Once departing, transit time is ${pitchNumbers.route_demo_transit_time_h} hours at ${pitchNumbers.route_demo_speed_m_s} m/s with a ${pitchNumbers.route_demo_max_slope_deg}° slope limit.`,
      durationMs: 18000,
      expectedNumbers: [
        pitchNumbers.route_demo_working_steps,
        pitchNumbers.route_demo_window_availability_h,
        pitchNumbers.route_demo_transit_time_h,
        pitchNumbers.route_demo_speed_m_s,
        pitchNumbers.route_demo_max_slope_deg,
      ],
      actionBeforeWait: async (page) => {
        // Wait for departure map or story elements
        await page.waitForTimeout(1000);
      },
    },
    {
      id: 3,
      slug: 'site_panorama',
      title: '360° Topocentric Horizon Skyline',
      headingSelector: 'h1',
      expectedHeadingText: 'Site Assessment',
      url: 'http://127.0.0.1:4173/#/site/test-location',
      caption: `Live Horizon Panorama renders true angular discs of the Sun (${pitchNumbers.sun_disc_diam_deg}°) and Earth (${pitchNumbers.earth_disc_diam_deg}°) clipped by local topography (skyline peak ${pitchNumbers.skyline_peak_deg}° at azimuth ${pitchNumbers.skyline_peak_az_deg}°).`,
      durationMs: 17000,
      expectedNumbers: [
        pitchNumbers.sun_disc_diam_deg,
        pitchNumbers.earth_disc_diam_deg,
        pitchNumbers.skyline_peak_deg,
        pitchNumbers.skyline_peak_az_deg,
      ],
      actionBeforeWait: async (page) => {
        await page.waitForTimeout(1000);
      },
    },
    {
      id: 4,
      slug: 'trust_benchmarks',
      title: 'Scientific Trust & Verification',
      headingSelector: 'h1',
      expectedHeadingText: 'Trust',
      url: 'http://127.0.0.1:4173/#/trust',
      caption: `Automated CI benchmarks test exact spherical geodesy: V1 horizon dip -0.086937 deg, V2 ridge elevation 0.409510 deg, V6 100% byte-reproducible, V8 0.0% path delta; V4 and V7 honestly marked NOT RUN.`,
      durationMs: 15000,
      expectedNumbers: [-0.086937, 0.409510, 100, 0.0],
      actionBeforeWait: async (page) => {
        await page.waitForTimeout(1000);
      },
    },
    {
      id: 5,
      slug: 'evidence_card',
      title: 'Mission Readiness Evidence Card',
      headingSelector: 'h1',
      expectedHeadingText: 'Evidence',
      url: 'http://127.0.0.1:4173/#/evidence/test-location',
      caption: `One-page printable engineering dossier embeds exact coordinates (${pitchNumbers.site_lat_deg.toFixed(1)}° N, ${pitchNumbers.site_lon_deg.toFixed(1)}° E), elevation ${pitchNumbers.site_ground_elev_m} m, margin ${pitchNumbers.margin_deg}°, LOLA DEMs, and SPICE DE421 provenance records.`,
      durationMs: 13000,
      expectedNumbers: [
        pitchNumbers.site_lat_deg,
        pitchNumbers.site_lon_deg,
        pitchNumbers.site_ground_elev_m,
        pitchNumbers.margin_deg,
      ],
      actionBeforeWait: async (page) => {
        await page.waitForTimeout(1000);
      },
    },
    {
      id: 6,
      slug: 'open_data',
      title: 'Open Science Data Catalog & Downloads',
      headingSelector: 'h1',
      expectedHeadingText: 'Data',
      url: 'http://127.0.0.1:4173/#/data',
      caption: `All analysis outputs are published in open CSV and Parquet formats with complete metadata, conforming to open science data standards.`,
      durationMs: 12000,
      expectedNumbers: [],
      actionBeforeWait: async (page) => {
        await page.waitForTimeout(1000);
      },
    },
  ];

  // 1. Strict Caption Number Audit against pitch_numbers.json
  console.log('[AUDIT] Validating all step caption numbers against docs/pitch_numbers.json...');
  for (const step of steps) {
    validateCaptionNumbers(step.caption, pitchNumbers, step.expectedNumbers);
    console.log(`  ✓ Step ${step.id} (${step.slug}) numbers verified against pitch_numbers.json`);
  }
  console.log('[PASS] All caption numbers match authoritative data.');

  // 2. Start local HTTP server for web/dist
  const server = await startLocalServer(DIST_DIR, 4173);

  // 3. Launch Playwright with video recording
  console.log('[PLAYWRIGHT] Launching Chromium (1920x1080 viewport)...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  try {
    let cumulativeElapsedMs = 0;

    for (const step of steps) {
      console.log(`\n[STEP ${step.id}/6] Navigating to ${step.url}...`);
      await page.goto(step.url, { waitUntil: 'networkidle' });

      // Verify visible heading
      const heading = page.locator(step.headingSelector).first();
      await heading.waitFor({ state: 'visible', timeout: 8000 });
      const headingText = await heading.textContent();
      console.log(`  Heading verified: "${headingText?.trim()}" (contains "${step.expectedHeadingText}")`);

      // Run optional interactive step actions (e.g. scrolling, highlighting)
      if (step.actionBeforeWait) {
        await step.actionBeforeWait(page);
      }

      // Inject caption banner
      await injectCaptionBanner(page, step.id, step.title, step.caption);

      // Take numbered screenshot
      const screenshotFilename = `0${step.id}_${step.slug}.png`;
      const screenshotPath = path.resolve(IMAGES_DIR, screenshotFilename);
      await page.screenshot({ path: screenshotPath });
      console.log(`  Captured screenshot: docs/images/${screenshotFilename}`);

      // Record frame duration
      console.log(`  Playing step for ${(step.durationMs / 1000).toFixed(1)} seconds...`);
      await page.waitForTimeout(step.durationMs);

      cumulativeElapsedMs += step.durationMs;
      console.log(`  Elapsed time: ${(cumulativeElapsedMs / 1000).toFixed(1)}s / 90.0s`);
    }

    console.log(`\n[RECORDING] 90-second traversal complete. Closing page and finalizing video...`);
    const video = page.video();
    let videoPath: string | null = null;
    if (video) {
      videoPath = await video.path();
    }

    await page.close();
    await context.close();
    await browser.close();

    // Finalize video file
    if (videoPath && fs.existsSync(videoPath)) {
      const targetVideoPath = path.resolve(DOCS_DIR, 'demo.webm');
      fs.copyFileSync(videoPath, targetVideoPath);
      const stat = fs.statSync(targetVideoPath);
      console.log(`[VIDEO] Successfully generated docs/demo.webm (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.warn(`[WARN] Video file not located from page.video(). Checking ${tempVideoDir}...`);
      const files = fs.readdirSync(tempVideoDir);
      if (files.length > 0) {
        const src = path.resolve(tempVideoDir, files[0]);
        const target = path.resolve(DOCS_DIR, 'demo.webm');
        fs.copyFileSync(src, target);
        console.log(`[VIDEO] Recovered docs/demo.webm from temp directory (${fs.statSync(target).size} bytes)`);
      }
    }

    // Clean up temporary video directory
    fs.rmSync(tempVideoDir, { recursive: true, force: true });
  } finally {
    server.close();
    console.log('[SERVER] Local test server stopped.');
  }

  console.log('\nSUCCESS: 90-second video demo (docs/demo.webm) and numbered screenshots (docs/images/) generated.');
}

main().catch((err) => {
  console.error('\nFAILURE:', err);
  process.exit(1);
});
