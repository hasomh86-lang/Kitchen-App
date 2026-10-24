/**
 * Artisan Kitchen — self-hosted Node server (Oracle Cloud, Riyadh).
 *
 * Runs the same Hono API as the Cloudflare build, with:
 *   - SQLite database file   → $DATA_DIR/kitchen.db
 *   - photos on disk          → $DATA_DIR/images/
 *   - the built web app       → ./dist (served with SPA fallback)
 * Sits behind Caddy, which terminates HTTPS.
 *
 * Env: PORT (8080), HOST (127.0.0.1), DATA_DIR (/var/lib/artisan-kitchen),
 *      APP_DIR (directory holding dist/ and migrations/), GEMINI_API_KEY (optional).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync, createReadStream, mkdirSync } from 'node:fs';
import { join, resolve, extname, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import app from '../worker/index';
import { DiskKV, SqliteD1, migrate } from './shims';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_DIR = resolve(process.env.DATA_DIR ?? '/var/lib/artisan-kitchen');
const APP_DIR = resolve(process.env.APP_DIR ?? process.cwd());
const DIST = join(APP_DIR, 'dist');

mkdirSync(DATA_DIR, { recursive: true });
const DB = new SqliteD1(join(DATA_DIR, 'kitchen.db'));
const migDir = join(APP_DIR, 'migrations');
migrate(DB, readdirSync(migDir).filter((f) => f.endsWith('.sql')).map((name) => ({ name, sql: readFileSync(join(migDir, name), 'utf8') })));
const IMAGES = new DiskKV(join(DATA_DIR, 'images'));

const env = {
  DB,
  IMAGES,
  ASSETS: { fetch: () => new Response('Not found', { status: 404 }) },
  APP_NAME: process.env.APP_NAME ?? 'Artisan Kitchen',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
} as any;

/* ------------------------------ static files ------------------------------ */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

function sendFile(res: ServerResponse, file: string, method: string) {
  const ext = extname(file).toLowerCase();
  const isHashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'content-length': statSync(file).size,
    'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
  });
  if (method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let rel: string;
  try { rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, ''); } catch { return false; }
  const file = join(DIST, rel);
  if (!file.startsWith(DIST)) return false;
  if (rel && existsSync(file) && statSync(file).isFile()) { sendFile(res, file, req.method); return true; }
  // SPA fallback for page routes (anything without a file extension).
  if (!extname(rel)) { sendFile(res, join(DIST, 'index.html'), req.method); return true; }
  return false;
}

/* ------------------------------- API bridge ------------------------------- */
async function toRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    // @ts-expect-error Node's fetch needs this for streamed bodies
    duplex: hasBody ? 'half' : undefined,
  });
}

async function sendResponse(res: ServerResponse, r: Response) {
  const headers: Record<string, string | string[]> = {};
  r.headers.forEach((v, k) => {
    if (k === 'set-cookie') return;
    headers[k] = v;
  });
  const cookies = r.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(r.status, headers);
  if (!r.body) return res.end();
  const buf = Buffer.from(await r.arrayBuffer());
  res.end(buf);
}

const MAX_BODY = 12 * 1024 * 1024;

createServer(async (req, res) => {
  try {
    // Caddy forwards the real host + scheme.
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url ?? '/', `${proto}://${host}`);
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) { res.writeHead(413).end('Too large'); return; }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/img/')) {
      const r = await app.fetch(await toRequest(req, url), env, { waitUntil() {}, passThroughOnException() {} } as any);
      return void (await sendResponse(res, r));
    }
    if (serveStatic(req, res, url.pathname)) return;
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Something went wrong on the server' }));
  }
}).listen(PORT, HOST, () => {
  console.log(`[artisan-kitchen] listening on http://${HOST}:${PORT}  data=${DATA_DIR}`);
});

/* Graceful shutdown so SQLite closes cleanly on restart. */
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => { try { DB.db.close(); } catch { /* ignore */ } process.exit(0); });
}
