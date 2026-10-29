/**
 * Local Developer & Demo HTTP Server for Maven Deep Code Review Action.
 * Listens on PORT 8095, serves REST API endpoints and the Interactive Review Simulator UI.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { ReviewService } from './services/reviewService';
import { ReviewController } from './controllers/reviewController';

const PORT = parseInt(process.env.PORT || '8095', 10);
const service = new ReviewService();
const controller = new ReviewController(service);

// Locate frontend directory
const possibleFrontendDirs = [
  path.join(__dirname, '..', 'frontend'),
  path.join(__dirname, '..', 'docs'),
  path.join(__dirname, 'frontend'),
];

let FRONTEND_DIR = possibleFrontendDirs.find((dir) => fs.existsSync(dir)) || path.join(__dirname, '..', 'docs');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url || '/', true);
  const pathname = parsedUrl.pathname || '/';

  // API Routes
  if (pathname === '/api/health' && req.method === 'GET') {
    controller.handleHealth(req, res);
    return;
  }

  if (pathname === '/api/review/simulate' && req.method === 'POST') {
    controller.handleSimulate(req, res);
    return;
  }

  if (pathname === '/api/audit' && req.method === 'GET') {
    controller.handleListAudits(req, res);
    return;
  }

  // Static File Serving
  let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/plain';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Maven Code Review Action Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving frontend simulator from: ${FRONTEND_DIR}`);
});

export default server;
