#!/usr/bin/env node
// Tiny dependency-free static file server for development and e2e tests.
//   CLI:    node tools/serve.mjs [port=8080] [root=repo root] [--host 0.0.0.0]
//   Module: const { url, close } = await startServer({ root, port });

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export function mimeType(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

// Maps a request URL to an absolute path inside root, or null when it escapes root.
function resolvePath(root, reqUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(reqUrl, 'http://x').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

async function statOrNull(file) {
  try {
    return await stat(file);
  } catch {
    return null;
  }
}

async function handle(root, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }
  let file = resolvePath(root, req.url);
  if (!file) {
    send(res, 403, 'Forbidden');
    return;
  }
  let info = await statOrNull(file);
  if (info?.isDirectory()) {
    const { pathname, search } = new URL(req.url, 'http://x');
    if (!pathname.endsWith('/')) {
      send(res, 301, 'Moved Permanently', { Location: `${pathname}/${search}` });
      return;
    }
    file = path.join(file, 'index.html');
    info = await statOrNull(file);
  }
  if (!info?.isFile()) {
    send(res, 404, 'Not Found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mimeType(file),
    'Content-Length': info.size,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

// port 0 picks a free port. Resolves once listening; rejects e.g. on EADDRINUSE.
export function startServer({ root = REPO_ROOT, port = 0, host = '127.0.0.1' } = {}) {
  const absRoot = path.resolve(root);
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    handle(absRoot, req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 'Internal Server Error');
      else res.destroy();
    });
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const actual = server.address().port;
      const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      resolve({
        url: `http://${shownHost}:${actual}/`,
        port: actual,
        root: absRoot,
        server,
        close: () => new Promise((done) => {
          for (const s of sockets) s.destroy();
          server.close(() => done());
        }),
      });
    });
  });
}

function parseCli(argv) {
  const opts = { port: 8080, root: REPO_ROOT, host: '127.0.0.1' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--host') opts.host = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
    else positional.push(argv[i]);
  }
  if (positional[0] !== undefined) opts.port = Number(positional[0]);
  if (positional[1] !== undefined) opts.root = path.resolve(positional[1]);
  return opts;
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: node tools/serve.mjs [port=8080] [root=.] [--host 127.0.0.1]');
    return;
  }
  if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) {
    console.error(`serve: invalid port "${process.argv[2]}"`);
    process.exit(1);
  }
  const rootInfo = await statOrNull(opts.root);
  if (!rootInfo?.isDirectory()) {
    console.error(`serve: root directory not found: ${opts.root}`);
    process.exit(1);
  }
  try {
    const { url, close } = await startServer({ root: opts.root, port: opts.port, host: opts.host });
    console.log(`Açaí Fever dev server: ${url}  (root ${opts.root}, no caching) – Ctrl+C to stop`);
    const stop = () => close().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`serve: port ${opts.port} is already in use – try: node tools/serve.mjs ${opts.port + 1}`);
    } else {
      console.error(`serve: ${err.message}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
