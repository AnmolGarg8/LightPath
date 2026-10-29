import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mimeTypes: Record<string, string> = {
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

server.listen(PORT, async () => {
  console.log(`Test server running at http://localhost:${PORT}/`);

  try {
    const tempProfile = path.join(SCREENSHOTS_DIR, 'chrome-temp-profile');
    const commonChromeFlags = `--headless=new --no-sandbox --disable-gpu --user-data-dir="${tempProfile}" --no-default-browser-check --disable-component-update`;

    // 1. Screenshot 1920px Home View
    const shot1920 = path.join(SCREENSHOTS_DIR, 'home_1920px.png');
    console.log(`Taking desktop screenshot (1920px): ${shot1920}`);
    execSync(
      `"${CHROME_PATH}" ${commonChromeFlags} --screenshot="${shot1920}" --window-size=1920,1080 --hide-scrollbars "http://localhost:${PORT}/#/"`,
      { stdio: 'inherit' }
    );

    // 2. Screenshot 360px Mobile Home View
    const shot360 = path.join(SCREENSHOTS_DIR, 'home_360px.png');
    console.log(`Taking mobile screenshot (360px): ${shot360}`);
    execSync(
      `"${CHROME_PATH}" ${commonChromeFlags} --screenshot="${shot360}" --window-size=360,800 --hide-scrollbars "http://localhost:${PORT}/#/"`,
      { stdio: 'inherit' }
    );

    // 3. Screenshot Site Detail View
    const shotSite = path.join(SCREENSHOTS_DIR, 'site_1920px.png');
    console.log(`Taking site detail screenshot (1920px): ${shotSite}`);
    execSync(
      `"${CHROME_PATH}" ${commonChromeFlags} --screenshot="${shotSite}" --window-size=1920,1080 --hide-scrollbars "http://localhost:${PORT}/#/site/synthetic-proving-ground"`,
      { stdio: 'inherit' }
    );

    // 4. Screenshot Route Planner View
    const shotRoute = path.join(SCREENSHOTS_DIR, 'route_1920px.png');
    console.log(`Taking route planner screenshot (1920px): ${shotRoute}`);
    execSync(
      `"${CHROME_PATH}" ${commonChromeFlags} --screenshot="${shotRoute}" --window-size=1920,1080 --hide-scrollbars "http://localhost:${PORT}/#/route/synthetic-proving-ground"`,
      { stdio: 'inherit' }
    );

    // 5. Run Lighthouse Accessibility Audit
    console.log('Running Lighthouse accessibility audit on home page...');
    const reportPath = path.join(SCREENSHOTS_DIR, 'lighthouse_report.json');
    execSync(
      `npx --yes lighthouse "http://localhost:${PORT}/" --only-categories=accessibility --output=json --output-path="${reportPath}" --chrome-flags="${commonChromeFlags}"`,
      { stdio: 'inherit' }
    );

    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      const score = Math.round((report.categories?.accessibility?.score ?? 0) * 100);
      console.log(`\n========================================`);
      console.log(`LIGHTHOUSE ACCESSIBILITY SCORE: ${score} / 100`);
      console.log(`========================================\n`);
      if (score < 95) {
        console.error(`Warning: Accessibility score ${score} is below requirement 95!`);
      }
    }
  } catch (err) {
    console.error('Error during audit or screenshots:', err);
  } finally {
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
});
