const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '..', 'web', 'dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

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

const PORT = 4198;

function captureUrl(route, filename, windowSize, budgetMs = 4000) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    const url = `http://localhost:${PORT}/${route}`;
    console.log(`Capturing ${filename} (${windowSize}) from ${url}`);

    const tempProfile = path.join(SCREENSHOTS_DIR, `temp_prof_${Date.now()}_${Math.floor(Math.random()*1000)}`);
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--virtual-time-budget=${budgetMs}`,
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
      console.log(`Finished ${filename} (code ${code})`);
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
  console.log(`Server started on port ${PORT}`);
  try {
    // 1. Home screen at 1920px (Desktop)
    await captureUrl('#/', 'home_1920px.png', '1920,1080', 4000);

    // 2. Home screen at 768px (Tablet)
    await captureUrl('#/', 'home_768px.png', '768,1024', 4000);

    // 3. Home screen at 360px (Mobile)
    await captureUrl('#/', 'home_360px.png', '360,800', 4000);

    // 4. Route page at 1920px (Desktop, showing 3-step onboarding & map)
    await captureUrl('#/route/synthetic-proving-ground', 'route_1920px.png', '1920,1200', 6000);

    // 5. Route page at 768px (Tablet)
    await captureUrl('#/route/synthetic-proving-ground', 'route_768px.png', '768,1100', 6000);

    // 6. Route page at 360px (Mobile: map above controls, touch targets >=44px)
    await captureUrl('#/route/synthetic-proving-ground', 'route_360px.png', '360,1100', 6000);

    console.log('All responsive acceptance screenshots captured successfully.');
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
