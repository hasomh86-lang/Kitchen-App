import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from './env';
import { sessionLoader } from './lib/auth';
import { admin } from './routes/admin';
import { ai } from './routes/ai';
import { auth } from './routes/auth';
import { catalog } from './routes/catalog';
import { images, serveImage } from './routes/images';
import { orders } from './routes/orders';
import { pub } from './routes/public';

const app = new Hono<AppContext>();

// Security headers for everything the worker answers itself.
app.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  c.header('x-frame-options', 'SAMEORIGIN');
});

// CSRF guard: state-changing API calls must come from our own origin.
app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    const host = c.req.header('host');
    if (origin && host) {
      let ok = false;
      try { ok = new URL(origin).host === host; } catch { ok = false; }
      if (!ok) throw new HTTPException(403, { message: 'Cross-origin request blocked' });
    }
  }
  c.header('cache-control', 'no-store');
  await next();
});

app.use('/api/*', sessionLoader);

app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));
app.route('/api/auth', auth);
app.route('/api/public', pub);
app.route('/api/admin', admin);
app.route('/api/catalog', catalog);
app.route('/api/orders', orders);
app.route('/api/images', images);
app.route('/api/ai', ai);
app.get('/img/:id', serveImage);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong on the server' }, 500);
});

export default app;
