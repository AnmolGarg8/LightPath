/**
 * Automated Guided Demo Headless Recorder for LightPath
 * 
 * Spawns an internal static server and captures high-resolution 1920x1080 frames
 * for all 8 guided demo steps, then stitches them into docs/demo.mp4 using ffmpeg.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '..', 'web', 'dist');
const FRAMES_DIR = path.resolve(__dirname, '..', 'docs', 'demo_frames');
const OUTPUT_MP4 = path.resolve(__dirname, '..', 'docs', 'demo.mp4');

if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
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

const PORT = 4176;

function captureStep(stepIdx, route, filename) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(FRAMES_DIR, filename);
    const url = `http://localhost:${PORT}/${route}`;
    console.log(`[Step ${stepIdx + 1}/8] Capturing ${filename} -> ${url}`);

    const tempProfile = path.join(FRAMES_DIR, `temp_prof_${Date.now()}_${stepIdx}`);
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--virtual-time-budget=3000',
      '--run-all-compositor-stages-before-draw',
      '--window-size=1920,1080',
      `--user-data-dir=${tempProfile}`,
      '--no-default-browser-check',
      '--disable-component-update',
      `--screenshot=${outPath}`,
      url,
    ];

    const proc = spawn(CHROME_PATH, args, { stdio: 'ignore' });

    proc.on('close', (code) => {
      console.log(`  Finished step ${stepIdx + 1}: code ${code}`);
      try {
        if (fs.existsSync(tempProfile)) {
          fs.rmSync(tempProfile, { recursive: true, force: true });
        }
      } catch (e) {}
      resolve();
    });

    proc.on('error', (err) => {
      console.error(`  Error capturing step ${stepIdx + 1}:`, err);
      reject(err);
    });
  });
}

const STEPS = [
  { idx: 0, route: '#/?demo=1', file: 'step_01.png', label: 'CLPS Mission Browser' },
  { idx: 1, route: '#/site/synthetic-proving-ground?demo=1', file: 'step_02.png', label: '360 Horizon Panorama' },
  { idx: 2, route: '#/site/synthetic-proving-ground?demo=1', file: 'step_03.png', label: 'Mast Height Sensitivity' },
  { idx: 3, route: '#/site/synthetic-proving-ground?demo=1', file: 'step_04.png', label: 'Direct-to-Earth Contact' },
  { idx: 4, route: '#/compare/synthetic-proving-ground/synthetic-crater-rim?demo=1', file: 'step_05.png', label: 'Comparative Site Trade Study' },
  { idx: 5, route: '#/route/synthetic-proving-ground?demo=1', file: 'step_06.png', label: 'Dynamic Space-Time Traverse' },
  { idx: 6, route: '#/route/synthetic-proving-ground?demo=1', file: 'step_07.png', label: 'Infeasible Case & Relaxation' },
  { idx: 7, route: '#/evidence/synthetic-proving-ground?demo=1', file: 'step_08.png', label: 'Evidence Card' },
  { idx: 8, route: '#/trust?demo=1', file: 'step_09.png', label: 'Trust & Verification' },
];

server.listen(PORT, async () => {
  console.log(`Recording server running at http://localhost:${PORT}/`);

  try {
    for (const s of STEPS) {
      await captureStep(s.idx, s.route, s.file);
    }

    console.log('All 8 demo frames captured.');

    // Assemble MP4 video with ffmpeg (4 seconds per step = 32s slideshow demo)
    console.log('Stitching frames into docs/demo.mp4 with ffmpeg...');
    try {
      execSync(
        `ffmpeg -y -framerate 1/4 -i "${path.join(FRAMES_DIR, 'step_%02d.png')}" -c:v libx264 -r 30 -pix_fmt yuv420p "${OUTPUT_MP4}"`,
        { stdio: 'inherit' }
      );
      console.log(`Successfully generated video: ${OUTPUT_MP4}`);
    } catch (ffmpegErr) {
      console.warn('ffmpeg video encoding warning:', ffmpegErr.message);
    }
  } catch (err) {
    console.error('Recording error:', err);
  } finally {
    server.close(() => {
      console.log('Recorder server stopped.');
      process.exit(0);
    });
  }
});
