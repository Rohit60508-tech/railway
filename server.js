/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * INDIAN RAILWAYS AI PLATFORM — UNIFIED WEB & API PRODUCTION SERVER
 *
 * Serves:
 *   1. Static web frontend (index.html, frontend/pages/*.html, assets, components)
 *   2. Node.js AI API Gateway endpoints (/api/v1/ai/*)
 *   3. WebSocket & real-time safety telemetry
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { handleAiRequest, API_PREFIX } = require('./backend/api/ai-api');

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8',
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API Gateway Route Dispatcher
  if (pathname.startsWith('/api/v1/ai')) {
    try {
      const handled = await handleAiRequest(req, res);
      if (handled) return;
    } catch (err) {
      console.error('[API Handler Error]:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: err.message } }));
      }
      return;
    }
  }

  // 2. Static File Serving
  // Root '/' redirects to the login portal; original landing page accessible at /index.html
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/frontend/pages/login.html' });
    res.end();
    return;
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for directory indexing
      if (stats && stats.isDirectory()) {
        const indexCandidate = path.join(filePath, 'index.html');
        if (fs.existsSync(indexCandidate)) {
          filePath = indexCandidate;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>404 Not Found</h1><p>The requested directory does not contain index.html.</p>`);
          return;
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>404 - Page Not Found | RAKSHA PATH</title></head>
          <body style="background:#FAF6EE;color:#0F172A;font-family:'Inter',sans-serif;text-align:center;padding:80px 20px;">
            <div style="max-width:500px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(195,178,150,0.45);border-radius:12px;padding:40px;box-shadow:0 8px 30px rgba(15,23,42,0.06);">
              <h1 style="color:#003366;font-size:2rem;margin-bottom:12px;">404 &bull; Resource Not Found</h1>
              <p style="color:#475569;font-size:0.95rem;margin-bottom:24px;">The requested file <code style="background:#FAF6EE;padding:3px 8px;border-radius:4px;border:1px solid #E5DED0;">${pathname}</code> was not found on this server.</p>
              <a href="/" style="display:inline-block;background:#003366;color:#FFFFFF;text-decoration:none;font-weight:600;padding:10px 22px;border-radius:6px;font-size:0.9rem;">&larr; Return to Home Portal</a>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('[Stream Error]:', streamErr);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log('=============================================================');
  console.log('  RAKSHA PATH — WEB & API SERVER RUNNING                    ');
  console.log('=============================================================');
  console.log(`  Local URL:       http://localhost:${PORT}`);
  console.log(`  Network URL:     http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
  console.log(`  API Gateway:     http://localhost:${PORT}/api/v1/ai`);
  console.log(`  Python Backend:  http://127.0.0.1:5001`);
  console.log('-------------------------------------------------------------');
  console.log('  Portals Available:');
  console.log(`    • Landing Page:      http://localhost:${PORT}/`);
  console.log(`    • Executive Admin:   http://localhost:${PORT}/frontend/pages/admin-dashboard.html`);
  console.log(`    • Control Office:    http://localhost:${PORT}/frontend/pages/control-office.html`);
  console.log(`    • Maintenance Cell:  http://localhost:${PORT}/frontend/pages/maintenance-dashboard.html`);
  console.log(`    • Surveillance:      http://localhost:${PORT}/frontend/pages/surveillance-dashboard.html`);
  console.log(`    • AI Model MLOps:    http://localhost:${PORT}/frontend/pages/ai-model-management.html`);
  console.log(`    • Executive Summary: http://localhost:${PORT}/frontend/pages/project-summary.html`);
  console.log('=============================================================');
});
