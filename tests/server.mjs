// Static server for the demo and the tests, with a strict Content-Security-Policy (no inline scripts or styles).
// /panel/* serves ../meliora-accessibility/src when that checkout exists, for the tests that run both together.
// POST /api/consent stores the last consent-log record; GET /api/consent returns it.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const panel = path.resolve(root, '../meliora-accessibility/src');
const port = Number(process.env.PORT) || 8790;
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json'};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";
let lastLog = null;

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/consent') {
    if (request.method === 'POST') {
      let body = '';
      for await (const chunk of request) body += chunk;
      try { lastLog = JSON.parse(body); } catch { lastLog = {invalid: body}; }
      response.writeHead(204).end();
    } else {
      response.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}).end(JSON.stringify(lastLog));
    }
    return;
  }
  let base = root, file = decodeURIComponent(url.pathname);
  if (file.startsWith('/panel/')) { base = panel; file = file.slice('/panel'.length); }
  if (file.endsWith('/')) file += 'index.html';
  const full = path.join(base, path.normalize(file));
  if (!full.startsWith(base)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(full);
    response.writeHead(200, {'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store'});
    response.end(body);
  } catch {
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Meliora Consent demo: http://127.0.0.1:${port}/`));
