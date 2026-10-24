import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { MenuSettings, Role } from '@shared/types';
import { STAFF_ROLES, THEMES } from '@shared/types';
import type { AppContext } from '../env';
import { assertMenuAccess, requireRole } from '../lib/auth';
import { hashPassword, randomDigits, randomId, sha256Hex } from '../lib/crypto';
import { DEFAULT_SETTINGS, audit, now, rowToClient, rowToDevice, rowToMenu, rowToUser, touchMenu } from '../lib/db';
import { bool, email, imageRef, l10n, slug, str, strList } from '../lib/validate';

export const admin = new Hono<AppContext>();

/* ---------------------------------- Clients -------------------------------- */

admin.get('/clients', requireRole('admin'), async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM clients ORDER BY created_at').all();
  return c.json({ clients: rows.results.map(rowToClient) });
});

admin.post('/clients', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const id = randomId('cl');
  const name = str(b.name, 'name', { max: 120, required: true });
  const sl = slug(b.slug ?? name, 'slug');
  try {
    await c.env.DB.prepare('INSERT INTO clients (id, name, slug) VALUES (?,?,?)').bind(id, name, sl).run();
  } catch {
    throw new HTTPException(409, { message: 'A client with this slug already exists' });
  }
  await audit(c.env.DB, c.get('user')!.id, 'client.create', 'client', id);
  const row = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
  return c.json({ client: rowToClient(row) }, 201);
});

admin.patch('/clients/:id', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Client not found' });
  const name = b.name !== undefined ? str(b.name, 'name', { max: 120, required: true }) : cur.name;
  const sl = b.slug !== undefined ? slug(b.slug, 'slug') : cur.slug;
  const status = b.status === 'inactive' ? 'inactive' : b.status === 'active' ? 'active' : cur.status;
  await c.env.DB.prepare('UPDATE clients SET name=?, slug=?, status=? WHERE id=?').bind(name, sl, status, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
  return c.json({ client: rowToClient(row) });
});

admin.delete('/clients/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(c.req.param('id')).run();
  await audit(c.env.DB, c.get('user')!.id, 'client.delete', 'client', c.req.param('id'));
  return c.json({ ok: true });
});

/* ----------------------------------- Menus --------------------------------- */

// Every staff member can list the menus they can access.
admin.get('/menus', requireRole(...STAFF_ROLES), async (c) => {
  const u = c.get('user')!;
  const rows = await c.env.DB.prepare('SELECT * FROM menus ORDER BY created_at').all();
  const menus = rows.results.map(rowToMenu).filter((m) => u.role === 'admin' || u.menuIds.includes(m.id));
  return c.json({ menus });
});

admin.post('/menus', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const clientId = str(b.clientId, 'clientId', { required: true });
  const client = await c.env.DB.prepare('SELECT id FROM clients WHERE id = ?').bind(clientId).first();
  if (!client) throw new HTTPException(404, { message: 'Client not found' });
  const name = str(b.name, 'name', { max: 120, required: true });
  const sl = slug(b.slug ?? name, 'slug');
  const id = randomId('mn');
  const settings: MenuSettings = { ...DEFAULT_SETTINGS, title: { en: name, ar: name } };
  try {
    await c.env.DB.prepare('INSERT INTO menus (id, client_id, name, slug, settings, content_updated_at) VALUES (?,?,?,?,?,?)')
      .bind(id, clientId, name, sl, JSON.stringify(settings), now()).run();
  } catch {
    throw new HTTPException(409, { message: 'A menu with this slug already exists' });
  }
  await audit(c.env.DB, c.get('user')!.id, 'menu.create', 'menu', id);
  const row = await c.env.DB.prepare('SELECT * FROM menus WHERE id = ?').bind(id).first();
  return c.json({ menu: rowToMenu(row) }, 201);
});

admin.patch('/menus/:id', requireRole('admin', 'sub-admin'), async (c) => {
  const id = c.req.param('id');
  const u = assertMenuAccess(c, id);
  const b = await c.req.json<any>();
  const cur = await c.env.DB.prepare('SELECT * FROM menus WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Menu not found' });
  const menu = rowToMenu(cur);

  // Only admin may change identity/status; sub-admin may change presentation settings.
  let name = menu.name, sl = menu.slug, status = menu.status;
  if (u.role === 'admin') {
    if (b.name !== undefined) name = str(b.name, 'name', { max: 120, required: true });
    if (b.slug !== undefined) sl = slug(b.slug, 'slug');
    if (b.status === 'active' || b.status === 'inactive') status = b.status;
  }
  let settings = menu.settings;
  if (b.settings && typeof b.settings === 'object') {
    const s = b.settings;
    settings = {
      ...settings,
      theme: THEMES.some((t) => t.id === s.theme) ? s.theme : settings.theme,
      defaultLang: s.defaultLang === 'en' || s.defaultLang === 'ar' ? s.defaultLang : settings.defaultLang,
      showNutrition: bool(s.showNutrition, settings.showNutrition),
      showCoreComponents: bool(s.showCoreComponents, settings.showCoreComponents),
      title: s.title !== undefined ? l10n(s.title, 'title', 120) : settings.title,
      subtitle: s.subtitle !== undefined ? l10n(s.subtitle, 'subtitle', 120) : settings.subtitle,
      tagline: s.tagline !== undefined ? l10n(s.tagline, 'tagline', 400) : settings.tagline,
      philosophyTitle: s.philosophyTitle !== undefined ? l10n(s.philosophyTitle, 'philosophyTitle', 120) : settings.philosophyTitle,
      philosophyBody: s.philosophyBody !== undefined ? l10n(s.philosophyBody, 'philosophyBody', 2000) : settings.philosophyBody,
      logoImage: s.logoImage !== undefined ? imageRef(s.logoImage) : settings.logoImage,
      openAccess: u.role === 'admin' ? bool(s.openAccess, settings.openAccess) : settings.openAccess,
    };
  }
  try {
    await c.env.DB.prepare('UPDATE menus SET name=?, slug=?, status=?, settings=? WHERE id=?')
      .bind(name, sl, status, JSON.stringify(settings), id).run();
  } catch {
    throw new HTTPException(409, { message: 'A menu with this slug already exists' });
  }
  await touchMenu(c.env.DB, id);
  await audit(c.env.DB, u.id, 'menu.update', 'menu', id);
  const row = await c.env.DB.prepare('SELECT * FROM menus WHERE id = ?').bind(id).first();
  return c.json({ menu: rowToMenu(row) });
});

admin.delete('/menus/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM menus WHERE id = ?').bind(c.req.param('id')).run();
  await audit(c.env.DB, c.get('user')!.id, 'menu.delete', 'menu', c.req.param('id'));
  return c.json({ ok: true });
});

/* ----------------------------------- Users --------------------------------- */

async function loadUsers(db: D1Database) {
  const rows = await db.prepare('SELECT * FROM users ORDER BY created_at').all<any>();
  const asg = await db.prepare('SELECT user_id, menu_id FROM staff_assignments').all<{ user_id: string; menu_id: string }>();
  const byUser = new Map<string, string[]>();
  for (const a of asg.results) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a.menu_id]);
  return rows.results.map((r) => rowToUser(r, byUser.get(r.id) ?? []));
}

admin.get('/users', requireRole('admin'), async (c) => c.json({ users: await loadUsers(c.env.DB) }));

const ROLES: Role[] = ['admin', 'sub-admin', 'butler', 'chef', 'pending'];

admin.post('/users', requireRole('admin'), async (c) => {
  const b = await c.req.json<any>();
  const em = email(b.email);
  const pw = str(b.password, 'password', { required: true, max: 200 });
  if (pw.length < 8) throw new HTTPException(400, { message: 'Password must be at least 8 characters' });
  const role: Role = ROLES.includes(b.role) ? b.role : 'pending';
  const id = randomId('us');
  try {
    await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?,?,?,?,?,?)')
      .bind(id, em, await hashPassword(pw), str(b.firstName, 'firstName', { max: 80 }), str(b.lastName, 'lastName', { max: 80 }), role).run();
  } catch {
    throw new HTTPException(409, { message: 'A user with this email already exists' });
  }
  const menuIds = strList(b.menuIds, 'menuIds');
  if (menuIds.length) {
    await c.env.DB.batch(menuIds.map((m) => c.env.DB.prepare('INSERT OR IGNORE INTO staff_assignments (user_id, menu_id) VALUES (?,?)').bind(id, m)));
  }
  await audit(c.env.DB, c.get('user')!.id, 'user.create', 'user', id, { role });
  const users = await loadUsers(c.env.DB);
  return c.json({ user: users.find((u) => u.id === id) }, 201);
});

admin.patch('/users/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const me = c.get('user')!;
  const b = await c.req.json<any>();
  const cur = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'User not found' });
  const role: Role = b.role !== undefined && ROLES.includes(b.role) ? b.role : cur.role;
  const status = b.status === 'disabled' ? 'disabled' : b.status === 'active' ? 'active' : cur.status;
  if (id === me.id && (role !== 'admin' || status !== 'active')) throw new HTTPException(400, { message: 'You cannot demote or disable your own account' });
  const stmts = [
    c.env.DB.prepare('UPDATE users SET first_name=?, last_name=?, role=?, status=? WHERE id=?').bind(
      b.firstName !== undefined ? str(b.firstName, 'firstName', { max: 80 }) : cur.first_name,
      b.lastName !== undefined ? str(b.lastName, 'lastName', { max: 80 }) : cur.last_name,
      role, status, id,
    ),
  ];
  if (b.password) {
    const pw = str(b.password, 'password', { max: 200 });
    if (pw.length < 8) throw new HTTPException(400, { message: 'Password must be at least 8 characters' });
    stmts.push(c.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(pw), id));
    stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
  }
  if (Array.isArray(b.menuIds)) {
    stmts.push(c.env.DB.prepare('DELETE FROM staff_assignments WHERE user_id=?').bind(id));
    for (const m of strList(b.menuIds, 'menuIds')) stmts.push(c.env.DB.prepare('INSERT OR IGNORE INTO staff_assignments (user_id, menu_id) VALUES (?,?)').bind(id, m));
  }
  if (status === 'disabled') stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
  await c.env.DB.batch(stmts);
  await audit(c.env.DB, me.id, 'user.update', 'user', id, { role, status });
  const users = await loadUsers(c.env.DB);
  return c.json({ user: users.find((u) => u.id === id) });
});

admin.delete('/users/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user')!.id) throw new HTTPException(400, { message: 'You cannot delete your own account' });
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  await audit(c.env.DB, c.get('user')!.id, 'user.delete', 'user', id);
  return c.json({ ok: true });
});

/* ---------------------------------- Devices -------------------------------- */

admin.get('/menus/:menuId/devices', requireRole('admin'), async (c) => {
  const menuId = c.req.param('menuId');
  const rows = await c.env.DB.prepare('SELECT * FROM devices WHERE menu_id = ? ORDER BY created_at DESC').bind(menuId).all();
  return c.json({ devices: rows.results.map(rowToDevice) });
});

// Returns the plaintext token exactly once (on creation / rotation).
admin.post('/menus/:menuId/devices', requireRole('admin'), async (c) => {
  const menuId = c.req.param('menuId');
  const b = await c.req.json<any>();
  const token = b.token ? str(b.token, 'token', { max: 64, required: true }) : randomDigits(8);
  if (token.length < 4) throw new HTTPException(400, { message: 'Token must be at least 4 characters' });
  const id = randomId('dv');
  await c.env.DB.prepare('INSERT INTO devices (id, menu_id, name, building, location, token_hash, token_preview) VALUES (?,?,?,?,?,?,?)')
    .bind(id, menuId, str(b.name, 'name', { max: 80 }), str(b.building, 'building', { max: 80 }), str(b.location, 'location', { max: 80 }), await sha256Hex(token), token.slice(-4)).run();
  await audit(c.env.DB, c.get('user')!.id, 'device.create', 'device', id);
  const row = await c.env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();
  return c.json({ device: rowToDevice(row), token }, 201);
});

admin.patch('/devices/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const cur = await c.env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Device not found' });
  let token: string | undefined;
  let tokenHash = cur.token_hash, preview = cur.token_preview;
  if (b.rotateToken || b.token) {
    token = b.token ? str(b.token, 'token', { max: 64, required: true }) : randomDigits(8);
    tokenHash = await sha256Hex(token);
    preview = token.slice(-4);
  }
  const status = b.status === 'revoked' ? 'revoked' : b.status === 'active' ? 'active' : cur.status;
  await c.env.DB.prepare('UPDATE devices SET name=?, building=?, location=?, status=?, token_hash=?, token_preview=? WHERE id=?').bind(
    b.name !== undefined ? str(b.name, 'name', { max: 80 }) : cur.name,
    b.building !== undefined ? str(b.building, 'building', { max: 80 }) : cur.building,
    b.location !== undefined ? str(b.location, 'location', { max: 80 }) : cur.location,
    status, tokenHash, preview, id,
  ).run();
  await audit(c.env.DB, c.get('user')!.id, 'device.update', 'device', id, { status, rotated: !!token });
  const row = await c.env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();
  return c.json({ device: rowToDevice(row), token });
});

admin.delete('/devices/:id', requireRole('admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

/* --------------------------------- Audit log ------------------------------- */

admin.get('/audit', requireRole('admin'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200`,
  ).all();
  return c.json({ entries: rows.results });
});
