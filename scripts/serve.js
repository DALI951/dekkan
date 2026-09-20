/* DEKKAN dev server — dead-simple static file server for E2E + manual testing.
 * Run: node scripts/serve.js [port]   (default 4173)
 * Serves the repo root with correct MIME types and no-cache headers so the
 * service worker never feeds a stale file during tests.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.argv[2] || '4173', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, body, mime) {
  res.writeHead(code, {
    'Content-Type': mime || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden');

    fs.readFile(file, (err, data) => {
      if (err) return send(res, err.code === 'ENOENT' ? 404 : 500, err.code || 'error');
      send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  } catch (e) {
    send(res, 400, 'bad request');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dekkan dev server on http://127.0.0.1:${PORT} (root: ${ROOT})`);
});