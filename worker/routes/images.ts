import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../env';
import { requireRole } from '../lib/auth';
import { randomId } from '../lib/crypto';

export const images = new Hono<AppContext>();

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']);

async function store(c: any, bytes: ArrayBuffer, contentType: string, menuId: string | null) {
  if (!ALLOWED.has(contentType)) throw new HTTPException(415, { message: `Unsupported image type ${contentType}` });
  if (bytes.byteLength > MAX_BYTES) throw new HTTPException(413, { message: 'Image is larger than 8 MB' });
  const id = randomId('img');
  await c.env.IMAGES.put(id, bytes, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
  await c.env.DB.prepare('INSERT INTO images (id, menu_id, content_type, bytes, created_by) VALUES (?,?,?,?,?)')
    .bind(id, menuId, contentType, bytes.byteLength, c.get('user')?.id ?? null).run();
  return { id, url: `/img/${id}`, bytes: bytes.byteLength, contentType };
}

/** Multipart upload: field "file"; optional "menuId". */
images.post('/', requireRole('admin', 'sub-admin'), async (c) => {
  const form = await c.req.formData();
  const file = form.get('file') as unknown as File | null;
  if (!file || typeof file === 'string' || typeof (file as File).arrayBuffer !== 'function') throw new HTTPException(400, { message: 'file is required' });
  const menuId = typeof form.get('menuId') === 'string' ? String(form.get('menuId')) : null;
  return c.json(await store(c, await file.arrayBuffer(), file.type || 'application/octet-stream', menuId), 201);
});

/** Base64 data-URL upload (used by AI tools and the import script). */
images.post('/data-url', requireRole('admin', 'sub-admin'), async (c) => {
  const b = await c.req.json<{ dataUrl: string; menuId?: string }>();
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(b.dataUrl ?? '');
  if (!m) throw new HTTPException(400, { message: 'dataUrl must be a base64 image data URL' });
  const bytes = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  return c.json(await store(c, bytes.buffer, m[1].toLowerCase(), b.menuId ?? null), 201);
});

/** Fetch a remote image (e.g. an old Supabase storage URL) into R2. Admin only. */
images.post('/from-url', requireRole('admin'), async (c) => {
  const b = await c.req.json<{ url: string; menuId?: string }>();
  let url: URL;
  try { url = new URL(b.url); } catch { throw new HTTPException(400, { message: 'url is not valid' }); }
  if (url.protocol !== 'https:') throw new HTTPException(400, { message: 'Only https URLs are allowed' });
  const res = await fetch(url.toString(), { headers: { accept: 'image/*' } });
  if (!res.ok) throw new HTTPException(502, { message: `Remote image returned ${res.status}` });
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  return c.json(await store(c, await res.arrayBuffer(), ct, b.menuId ?? null), 201);
});

images.delete('/:id', requireRole('admin', 'sub-admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.IMAGES.delete(id);
  await c.env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

/** Public, cacheable image delivery: GET /img/:id */
export async function serveImage(c: any) {
  const id = c.req.param('id');
  if (!/^img_[a-z0-9]+$/.test(id)) return c.notFound();
  const etag = `"${id}"`;
  if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304 });
  const obj = await c.env.IMAGES.get(id);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', etag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}
