/**
 * Standalone test: starts a static file server per the extension's approach,
 * loads dist HTML files in a real Chromium browser via iframe (same as extension),
 * and reports failed resource loads.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST_ROOT = '/Users/roen/Developer/Eyeshare/es-env-test/env1/eye-share-scenario/eye-share-demo/ClientFlex/host/dist';

const MIME = {
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.xml': 'application/xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

function createServer(root) {
  return http.createServer((req, res) => {
    if (!req.url) { res.writeHead(400); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const relativePath = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
    const filePath = path.resolve(root, relativePath);
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    stream.on('open', () => {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      stream.pipe(res);
    });
    stream.on('error', () => { res.writeHead(404); res.end(); });
  });
}

async function main() {
  const server = createServer(DIST_ROOT);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;

  console.log(`Server running at ${baseUrl}\n`);

  const htmlFiles = fs.readdirSync(DIST_ROOT).filter(f => f.endsWith('.html') || f.endsWith('.htm'));
  console.log(`Testing ${htmlFiles.length} HTML files: ${htmlFiles.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  for (const file of htmlFiles) {
    const page = await context.newPage();
    const failedRequests = [];
    const consoleErrors = [];

    page.on('requestfailed', req => {
      failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
    });
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    try {
      await page.goto(`${baseUrl}${file}`, { waitUntil: 'networkidle', timeout: 10000 });
    } catch (e) {
      // timeout is acceptable for pages with long-polling
    }

    console.log(`=== ${file} ===`);
    if (failedRequests.length) {
      console.log(`  FAILED REQUESTS (${failedRequests.length}):`);
      failedRequests.forEach(r => console.log(`    ${r.error}: ${r.url}`));
    } else {
      console.log('  All resources loaded OK');
    }
    if (consoleErrors.length) {
      console.log(`  CONSOLE ERRORS (${consoleErrors.length}):`);
      consoleErrors.slice(0, 5).forEach(e => console.log(`    ${e.slice(0, 150)}`));
    }
    console.log('');

    await page.close();
  }

  await browser.close();
  server.close();
}

main().catch(e => { console.error(e); process.exit(1); });
