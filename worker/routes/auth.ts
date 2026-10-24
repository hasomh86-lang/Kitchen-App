import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../env';
import { createSession, destroySession } from '../lib/auth';
import { hashPassword, randomId, verifyPassword } from '../lib/crypto';
import { audit } from '../lib/db';
import { email, str } from '../lib/validate';

export const auth = new Hono<AppContext>();

// Is the system initialised (does any user exist)?
auth.get('/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return c.json({ needsSetup: (row?.n ?? 0) === 0, appName: c.env.APP_NAME });
});

// First-run: create the first admin. Only works while there are zero users.
auth.post('/setup', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  if ((row?.n ?? 0) > 0) throw new HTTPException(409, { message: 'Setup already completed' });
  const b = await c.req.json<any>();
  const em = email(b.email);
  const pw = str(b.password, 'password', { max: 200, required: true });
  if (pw.length < 8) throw new HTTPException(400, { message: 'Password must be at least 8 characters' });
  const id = randomId('us');
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, first_name, last_name, role, status) VALUES (?,?,?,?,?,?,?)',
  ).bind(id, em, await hashPassword(pw), str(b.firstName, 'firstName', { max: 80 }), str(b.lastName, 'lastName', { max: 80 }), 'admin', 'active').run();
  await audit(c.env.DB, id, 'setup.admin_created', 'user', id);
  await createSession(c, id);
  return c.json({ ok: true });
});

auth.post('/login', async (c) => {
  const b = await c.req.json<any>();
  const em = email(b.email);
  const pw = str(b.password, 'password', { max: 200, required: true });
  const u = await c.env.DB.prepare('SELECT id, password_hash, status, role FROM users WHERE email = ?').bind(em).first<any>();
  // Constant-ish time: always verify against something.
  const ok = u ? await verifyPassword(pw, u.password_hash) : (await verifyPassword(pw, 'pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='), false);
  if (!ok) throw new HTTPException(401, { message: 'Email or password is incorrect' });
  if (u.status !== 'active') throw new HTTPException(403, { message: 'This account is disabled' });
  await createSession(c, u.id);
  await audit(c.env.DB, u.id, 'auth.login');
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  return c.json({ user: c.get('user') });
});

auth.post('/change-password', async (c) => {
  const u = c.get('user');
  if (!u) throw new HTTPException(401, { message: 'Sign in required' });
  const b = await c.req.json<any>();
  const current = str(b.currentPassword, 'currentPassword', { required: true });
  const next = str(b.newPassword, 'newPassword', { required: true });
  if (next.length < 8) throw new HTTPException(400, { message: 'Password must be at least 8 characters' });
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(u.id).first<any>();
  if (!row || !(await verifyPassword(current, row.password_hash))) throw new HTTPException(400, { message: 'Current password is incorrect' });
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), u.id).run();
  // Invalidate every other session for safety.
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(u.id, c.get('sessionId')).run();
  return c.json({ ok: true });
});
