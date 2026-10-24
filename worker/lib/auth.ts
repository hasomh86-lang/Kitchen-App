import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import type { Role, SessionUser } from '@shared/types';
import type { AppContext } from '../env';
import { randomToken, sha256Hex } from './crypto';
import { now } from './db';

const COOKIE = 'ak_session';
const SESSION_DAYS = 30;

export async function createSession(c: Context<AppContext>, userId: string) {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?,?,?,?)')
    .bind(id, userId, expires.toISOString(), c.req.header('user-agent') ?? null)
    .run();
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), userId).run();
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    expires,
  });
}

export async function destroySession(c: Context<AppContext>) {
  const token = getCookie(c, COOKIE);
  if (token) {
    const id = await sha256Hex(token);
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  }
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Loads the session user (if any) into c.var.user. Never throws. */
export const sessionLoader: MiddlewareHandler<AppContext> = async (c, next) => {
  c.set('user', null);
  c.set('sessionId', null);
  const token = getCookie(c, COOKIE);
  if (token) {
    const id = await sha256Hex(token);
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    ).bind(id).first<any>();
    if (row && row.status === 'active' && new Date(row.expires_at) > new Date()) {
      const menus = await c.env.DB.prepare('SELECT menu_id FROM staff_assignments WHERE user_id = ?').bind(row.id).all<{ menu_id: string }>();
      const user: SessionUser = {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        menuIds: menus.results.map((m) => m.menu_id),
      };
      c.set('user', user);
      c.set('sessionId', id);
    }
  }
  await next();
};

export function requireRole(...roles: Role[]): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const u = c.get('user');
    if (!u) throw new HTTPException(401, { message: 'Sign in required' });
    if (u.role !== 'admin' && !roles.includes(u.role)) throw new HTTPException(403, { message: 'Not allowed for your role' });
    await next();
  };
}

/** Admin sees every menu; other staff only assigned menus. */
export function canAccessMenu(u: SessionUser, menuId: string): boolean {
  return u.role === 'admin' || u.menuIds.includes(menuId);
}

export function assertMenuAccess(c: Context<AppContext>, menuId: string) {
  const u = c.get('user');
  if (!u) throw new HTTPException(401, { message: 'Sign in required' });
  if (!canAccessMenu(u, menuId)) throw new HTTPException(403, { message: 'You are not assigned to this menu' });
  return u;
}

export const displayName = (u: SessionUser) => `${u.firstName} ${u.lastName}`.trim() || u.email;
