const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '..', 'web', 'dist');
const DOCS_DIR = path.resolve(__dirname, '..', 'docs');

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

const PORT = 4199;

server.listen(PORT, async () => {
  console.log(`Lighthouse test server listening on port ${PORT}...`);
  try {
    const desktopJson = path.join(DOCS_DIR, 'lighthouse_desktop.json');
    const mobileJson = path.join(DOCS_DIR, 'lighthouse_mobile.json');

    console.log('Running Lighthouse Desktop Audit...');
    execSync(
      `npx --yes lighthouse http://localhost:${PORT}/ --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="${desktopJson}" --preset=desktop --quiet`,
      { stdio: 'inherit' }
    );

    console.log('Running Lighthouse Mobile Audit...');
    execSync(
      `npx --yes lighthouse http://localhost:${PORT}/ --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="${mobileJson}" --quiet`,
      { stdio: 'inherit' }
    );

    console.log('\n========================================');
    console.log('       LIGHTHOUSE AUDIT SCORES');
    console.log('========================================');

    if (fs.existsSync(desktopJson)) {
      const d = JSON.parse(fs.readFileSync(desktopJson, 'utf8'));
      const cats = d.categories;
      console.log('DESKTOP PRESET:');
      console.log(`  Performance:    ${Math.round((cats.performance?.score || 0) * 100)}%`);
      console.log(`  Accessibility:  ${Math.round((cats.accessibility?.score || 0) * 100)}%`);
      console.log(`  Best Practices: ${Math.round((cats['best-practices']?.score || 0) * 100)}%`);
      console.log(`  SEO:            ${Math.round((cats.seo?.score || 0) * 100)}%`);
    }

    if (fs.existsSync(mobileJson)) {
      const m = JSON.parse(fs.readFileSync(mobileJson, 'utf8'));
      const cats = m.categories;
      console.log('\nMOBILE PRESET:');
      console.log(`  Performance:    ${Math.round((cats.performance?.score || 0) * 100)}%`);
      console.log(`  Accessibility:  ${Math.round((cats.accessibility?.score || 0) * 100)}%`);
      console.log(`  Best Practices: ${Math.round((cats['best-practices']?.score || 0) * 100)}%`);
      console.log(`  SEO:            ${Math.round((cats.seo?.score || 0) * 100)}%`);
    }
    console.log('========================================\n');
  } catch (err) {
    console.error('Lighthouse audit error:', err.message);
  } finally {
    server.close(() => {
      console.log('Lighthouse server stopped.');
      process.exit(0);
    });
  }
});
