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
  '.csv': 'text/csv; charset=utf-8',
  '.parquet': 'application/octet-stream',
  '.cff': 'text/plain; charset=utf-8',
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

const PORT = 4199;

function captureUrl(route, filename, windowSize = '1600,1400', budgetMs = 5000) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    const url = `http://localhost:${PORT}/${route}`;
    console.log(`Capturing ${filename} from ${url}`);

    const tempProfile = path.join(SCREENSHOTS_DIR, `temp_prof_${Date.now()}`);
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
    // 1. Desktop full page capture of #/data
    await captureUrl('#/data', 'data_page_desktop.png', '1600,1800', 4000);

    // 2. Mobile view at 375px
    await captureUrl('#/data', 'data_page_mobile.png', '375,1200', 4000);

    console.log('Data page screenshots captured successfully.');
  } catch (err) {
    console.error('Screenshot capture failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
