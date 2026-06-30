/**
 * Minimal static file server for the QMetriX demo — stdlib only (no dependency).
 *
 * Serves a directory over `node:http`: maps extensions to MIME types, resolves a
 * trailing-slash request to `index.html`, refuses path traversal, and auto-increments
 * the port when the preferred one is busy. It is intentionally tiny — just enough to
 * preview the self-contained `dist/site/` the demo assembles, and to mirror how the
 * same directory behaves when served by GitHub Pages.
 *
 * Used by dev/demo/run.mjs; also runnable directly:
 *   node dev/demo/serve.mjs <dir> [--port 8080] [--host 127.0.0.1]
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const contentType = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

/**
 * Resolve a request URL to a file inside `root`, or null if it would escape the
 * root (path traversal) — the same safety boundary a static host enforces.
 */
function resolvePath(root, url) {
  const raw = decodeURIComponent(url.split('?')[0].split('#')[0]);
  const rel = raw.replace(/^\/+/, '');
  const target = path.resolve(root, rel || '.');
  const within = target === root || target.startsWith(root + path.sep);
  return within ? target : null;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function handler(root) {
  return async (req, res) => {
    let target = resolvePath(root, req.url || '/');
    if (!target) {
      return send(res, 403, '403 Forbidden');
    }
    try {
      let info = await stat(target).catch(() => null);
      if (info?.isDirectory()) {
        target = path.join(target, 'index.html');
        info = await stat(target).catch(() => null);
      }
      if (!info?.isFile()) {
        return send(res, 404, `404 Not Found: ${req.url}`);
      }
      res.writeHead(200, { 'Content-Type': contentType(target), 'Content-Length': info.size });
      createReadStream(target)
        .on('error', () => {
          if (!res.headersSent) {
            send(res, 500, '500 Internal Server Error');
          } else {
            res.destroy();
          }
        })
        .pipe(res);
    } catch {
      send(res, 500, '500 Internal Server Error');
    }
  };
}

/**
 * Start a static server rooted at `root`. Tries `port`, then increments up to
 * `maxTries-1` times when the address is in use. Resolves with { server, port, url }.
 */
export function startServer({ root, port = 8080, host = '127.0.0.1', maxTries = 20 } = {}) {
  const absRoot = path.resolve(root);
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const server = http.createServer(handler(absRoot));
    const tryListen = (p) => {
      server.listen(p, host);
    };
    server.on('listening', () => {
      const actual = server.address().port;
      const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      resolve({ server, port: actual, url: `http://${shown}:${actual}` });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < maxTries - 1) {
        attempt += 1;
        setTimeout(() => tryListen(port + attempt), 0);
      } else {
        reject(err);
      }
    });
    tryListen(port);
  });
}

// ── Standalone CLI ──────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const dir = argv.find((a) => !a.startsWith('--')) || '.';
  const port = Number(opt('--port', process.env.QMETRIX_DEMO_PORT || 8080));
  const host = opt('--host', '127.0.0.1');
  const { url } = await startServer({ root: dir, port, host });
  console.log(`Serving ${path.resolve(dir)}\n→ ${url}  (Ctrl-C to stop)`);
}
