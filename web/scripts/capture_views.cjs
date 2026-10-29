const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url?.split('?')[0] || '/';
  if (reqPath === '/' || !path.extname(reqPath)) {
    reqPath = '/index.html';
  }
  let filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 4173;

function runAsyncCapture(filename, windowSize, route) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    const url = `http://localhost:${PORT}/${route}`;
    console.log(`Capturing ${filename} (${windowSize}) -> ${url}`);

    const tempProfile = path.join(SCREENSHOTS_DIR, `temp_profile_${Date.now()}`);
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--virtual-time-budget=3000',
      '--run-all-compositor-stages-before-draw',
      `--window-size=${windowSize}`,
      `--user-data-dir=${tempProfile}`,
      '--no-default-browser-check',
      '--disable-component-update',
      `--screenshot=${outPath}`,
      url,
    ];

    const proc = spawn(CHROME_PATH, args, { stdio: 'ignore' });

    proc.on('close', (code) => {
      console.log(`Finished ${filename}, exit code: ${code}`);
      try {
        if (fs.existsSync(tempProfile)) {
          fs.rmSync(tempProfile, { recursive: true, force: true });
        }
      } catch (e) {}
      resolve();
    });

    proc.on('error', (err) => {
      console.error(`Error capturing ${filename}:`, err);
      reject(err);
    });
  });
}

server.listen(PORT, async () => {
  console.log(`Static server running at http://localhost:${PORT}/`);

  try {
    // 1. Home / Mission Browser Desktop (1920px)
    await runAsyncCapture('home_1920px.png', '1920,1080', '#/');

    // 2. Home / Mission Browser Mobile (360px)
    await runAsyncCapture('home_360px.png', '360,800', '#/');

    // 3. Site Detail & Panorama Desktop (1920px)
    await runAsyncCapture('site_1920px.png', '1920,1080', '#/site/synthetic-proving-ground');

    // 4. Site Detail & Panorama Mobile (360px)
    await runAsyncCapture('site_360px.png', '360,800', '#/site/synthetic-proving-ground');

    // 5. Compare View Desktop (1920px)
    await runAsyncCapture('compare_1920px.png', '1920,1080', '#/compare/synthetic-proving-ground/synthetic-crater-rim');

    // 6. Area Scan Metric: Earth Line of Sight (1920px)
    await runAsyncCapture('scan_earth_visibility.png', '1920,1080', '#/scan/synthetic-proving-ground?metric=earth');

    // 7. Area Scan Metric: Sun Illumination (1920px)
    await runAsyncCapture('scan_sun_visibility.png', '1920,1080', '#/scan/synthetic-proving-ground?metric=sun');

    // 8. Area Scan Metric: Sun + Direct-to-Earth Contact (1920px)
    await runAsyncCapture('scan_joint_dte_visibility.png', '1920,1080', '#/scan/synthetic-proving-ground?metric=joint_dte');

    // 9. Evidence Card Print Preview (1200, 1500)
    await runAsyncCapture('evidence_card_print_preview.png', '1200,1500', '#/evidence/synthetic-proving-ground');

    // 10. Trust & Independent Verification Benchmarks (1920px)
    await runAsyncCapture('trust_verification_benchmarks.png', '1920,1080', '#/trust');

    // 11. Interactive /explain View Desktop (1920px)
    await runAsyncCapture('explain_view_desktop.png', '1920,1080', '#/explain');

    // 12. 90-Second Guided Demo Overlay (1920px)
    await runAsyncCapture('guided_demo_overlay.png', '1920,1080', '#/?demo=1');

    console.log('All screenshots captured successfully.');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
});
