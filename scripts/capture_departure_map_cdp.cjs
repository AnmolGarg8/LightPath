const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '..', 'web', 'dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
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

// Static server
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

const HTTP_PORT = 4182;
const CDP_PORT = 9225;

async function run() {
  server.listen(HTTP_PORT);
  console.log(`Server listening on port ${HTTP_PORT}`);

  const tempProfile = path.join(SCREENSHOTS_DIR, `temp_cdp_${Date.now()}`);
  const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tempProfile}`,
    '--window-size=1600,2400',
    'about:blank',
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  // Wait for CDP to be ready
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        wsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    throw new Error('Failed to obtain CDP WebSocket URL');
  }
  console.log(`Connected to CDP at ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
    }
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg);
    }
  };

  await new Promise((r) => (ws.onopen = r));

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const cmdId = id++;
      callbacks.set(cmdId, (msg) => {
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      });
      ws.send(JSON.stringify({ id: cmdId, method, params }));
    });
  }

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');

  const targetUrl = `http://localhost:${HTTP_PORT}/#/route/synthetic-proving-ground`;
  console.log(`Navigating to ${targetUrl}`);
  await sendCommand('Page.navigate', { url: targetUrl });

  // Wait until departure map svg is rendered
  console.log('Waiting for [data-testid="departure-map-svg"] to appear in DOM...');
  let found = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 250));
    const evalRes = await sendCommand('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(\'[data-testid="departure-map-svg"]\'))',
      returnByValue: true,
    });
    if (evalRes?.result?.value === true) {
      found = true;
      console.log(`Found departure-map-svg after ${(attempt + 1) * 250}ms!`);
      break;
    }
  }

  if (!found) {
    console.warn('departure-map-svg not found within 15s; checking DOM state...');
    const bodyText = await sendCommand('Runtime.evaluate', {
      expression: 'document.body.innerText',
      returnByValue: true,
    });
    console.log('Body text:', bodyText?.result?.value?.slice(0, 500));
  }

  // Allow a tiny moment for SVG rendering to complete
  await new Promise((r) => setTimeout(r, 500));

  console.log('Capturing screenshot...');
  const ss = await sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const outPath = path.join(SCREENSHOTS_DIR, 'departure_window_map.png');
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  ws.close();
  chromeProc.kill();
  server.close();
  try {
    fs.rmSync(tempProfile, { recursive: true, force: true });
  } catch (e) {}
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
