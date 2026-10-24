import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PublicMenuBundle } from '@shared/types';
import type { AppContext } from '../env';
import { sha256Hex } from '../lib/crypto';
import { now, rowToCategory, rowToDish, rowToMenu } from '../lib/db';

export const pub = new Hono<AppContext>();

async function resolveMenu(db: D1Database, slug: string) {
  const row = await db.prepare(`SELECT m.* FROM menus m JOIN clients c ON c.id = m.client_id
                                WHERE m.slug = ? AND m.status = 'active' AND c.status = 'active'`).bind(slug).first<any>();
  if (!row) throw new HTTPException(404, { message: 'Menu not found' });
  return rowToMenu(row);
}

/** Validates the device token for a menu. Returns the device id or null. */
async function checkDevice(db: D1Database, menuId: string, token: string | undefined) {
  if (!token) return null;
  const hash = await sha256Hex(token.trim());
  const dev = await db.prepare(`SELECT id, last_seen_at FROM devices WHERE menu_id = ? AND token_hash = ? AND status = 'active'`).bind(menuId, hash).first<any>();
  if (!dev) return null;
  // Touch last_seen at most every 5 minutes to keep writes low.
  if (!dev.last_seen_at || Date.now() - new Date(dev.last_seen_at).getTime() > 5 * 60_000) {
    await db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').bind(now(), dev.id).run();
  }
  return dev.id as string;
}

/** Lightweight gate status: is a token needed, and is the given one valid? */
pub.get('/menu/:slug/gate', async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param('slug'));
  const token = c.req.header('x-device-token');
  const deviceId = menu.settings.openAccess ? 'open' : await checkDevice(c.env.DB, menu.id, token);
  return c.json({
    openAccess: menu.settings.openAccess,
    authorized: !!deviceId,
    title: menu.settings.title,
    logoImage: menu.settings.logoImage,
    theme: menu.settings.theme,
    defaultLang: menu.settings.defaultLang,
  });
});

/** Cheap freshness probe used by the client cache. */
pub.get('/menu/:slug/version', async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param('slug'));
  return c.json({ contentUpdatedAt: menu.contentUpdatedAt });
});

/** The full public bundle. Hidden categories/dishes are stripped; nothing internal leaks. */
pub.get('/menu/:slug', async (c) => {
  const menu = await resolveMenu(c.env.DB, c.req.param('slug'));
  if (!menu.settings.openAccess) {
    const deviceId = await checkDevice(c.env.DB, menu.id, c.req.header('x-device-token'));
    if (!deviceId) throw new HTTPException(401, { message: 'Device access required' });
  }
  const etag = `"${menu.contentUpdatedAt ?? '0'}"`;
  if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304 });

  const [cats, dishes] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM categories WHERE menu_id = ? AND is_hidden = 0 ORDER BY sort_order, created_at').bind(menu.id),
    c.env.DB.prepare('SELECT * FROM dishes WHERE menu_id = ? AND is_hidden = 0 ORDER BY sort_order, created_at').bind(menu.id),
  ]);
  const visibleCats = cats.results.map(rowToCategory);
  const catIds = new Set(visibleCats.map((x) => x.id));
  const bundle: PublicMenuBundle = {
    menu: { id: menu.id, slug: menu.slug, name: menu.name, settings: { ...menu.settings, openAccess: menu.settings.openAccess }, contentUpdatedAt: menu.contentUpdatedAt },
    categories: visibleCats,
    dishes: dishes.results.map(rowToDish).filter((d) => catIds.has(d.categoryId)),
  };
  c.header('etag', etag);
  c.header('cache-control', 'private, no-cache');
  return c.json(bundle);
});
