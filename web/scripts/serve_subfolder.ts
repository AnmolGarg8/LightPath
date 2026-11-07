import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4173;
const SUBFOLDER = '/LightPath';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.csv': 'text/csv; charset=utf-8',
  '.parquet': 'application/vnd.apache.parquet',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] || '/';

  // Only serve under subfolder
  if (!urlPath.startsWith(SUBFOLDER)) {
    res.writeHead(302, { Location: `${SUBFOLDER}/` });
    res.end();
    return;
  }

  let relativePath = urlPath.slice(SUBFOLDER.length);
  if (relativePath === '' || relativePath === '/') {
    relativePath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, relativePath);

  // Security: prevent path traversal outside DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: if not an asset file with extension, serve index.html
      const ext = path.extname(filePath);
      if (!ext) {
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.readFile(indexPath, (indexErr, data) => {
          if (indexErr) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
          }
        });
        return;
      }

      res.writeHead(404);
      res.end(`Not Found: ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static server running at http://127.0.0.1:${PORT}${SUBFOLDER}/`);
});
