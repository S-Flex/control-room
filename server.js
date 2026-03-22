const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8092;
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

// PUT-saveable data files
const WRITABLE_FILES = new Set(['models.json', 'resource.json']);

function handleJsonPut(req, res, filename) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      JSON.parse(body); // validate JSON
      fs.writeFile(path.join(ROOT, 'data', filename), body, 'utf8', (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(`{"error":"write failed"}`);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        console.log(`Saved ${filename}`);
      });
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(`{"error":"${e.message}"}`);
    }
  });
}

const server = http.createServer((req, res) => {
  // Handle PUT to save data files
  if (req.method === 'PUT' && req.url.startsWith('/data/')) {
    const filename = path.basename(req.url);
    if (WRITABLE_FILES.has(filename)) {
      handleJsonPut(req, res, filename);
      return;
    }
  }

  // Proxy external files (e.g. /proxy?url=https://...)
  const urlParts = new URL(req.url, `http://localhost:${PORT}`);
  if (urlParts.pathname === '/proxy' && urlParts.searchParams.get('url')) {
    const target = urlParts.searchParams.get('url');
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== 'https:') {
        res.writeHead(400);
        res.end('Only HTTPS URLs are allowed');
        return;
      }
    } catch {
      res.writeHead(400);
      res.end('Invalid URL');
      return;
    }
    https.get(target, (upstream) => {
      res.writeHead(upstream.statusCode, {
        'Content-Type': upstream.headers['content-type'] || 'application/octet-stream',
        'Content-Length': upstream.headers['content-length'] || '',
        'Cache-Control': 'public, max-age=86400',
      });
      upstream.pipe(res);
    }).on('error', (e) => {
      res.writeHead(502);
      res.end('Proxy error: ' + e.message);
    });
    return;
  }

  // Static file serving
  const urlPath = urlParts.pathname;
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
