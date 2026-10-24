import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { TRANSITIONS, type OrderEvent, type OrderItem, type OrderStatus } from '@shared/types';
import type { AppContext } from '../env';
import { assertMenuAccess, displayName, requireRole } from '../lib/auth';
import { randomId } from '../lib/crypto';
import { audit, now, rowToOrder } from '../lib/db';
import { bad, l10n, num, str } from '../lib/validate';

export const orders = new Hono<AppContext>();
orders.use('*', requireRole('admin', 'butler', 'chef'));

const seesInternal = (role: string) => role === 'admin' || role === 'butler';

/**
 * List orders for a menu. Chef only sees the kitchen queue (submitted/preparing) plus
 * recently finished ones for context. `since` (ISO) returns only orders updated after it,
 * which the dashboards poll every few seconds.
 */
orders.get('/menus/:menuId/orders', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  const since = c.req.query('since');
  const scope = c.req.query('scope') ?? 'all'; // all | active | closed
  let sql = 'SELECT * FROM orders WHERE menu_id = ?';
  const args: unknown[] = [menuId];
  if (u.role === 'chef') { sql += ` AND (status IN ('submitted','preparing') OR (status IN ('ready','rejected') AND updated_at > ?))`; args.push(new Date(Date.now() - 6 * 3600_000).toISOString()); }
  else if (scope === 'active') { sql += ` AND status IN ('draft','submitted','preparing','ready','out_for_delivery','delivered')`; }
  else if (scope === 'closed') { sql += ` AND status IN ('completed','cancelled','rejected')`; }
  if (since) { sql += ' AND updated_at > ?'; args.push(since); }
  sql += ' ORDER BY updated_at DESC LIMIT 300';
  const rows = await c.env.DB.prepare(sql).bind(...args).all();
  return c.json({ orders: rows.results.map((r) => rowToOrder(r, seesInternal(u.role))), serverTime: now() });
});

function parseItems(v: unknown): OrderItem[] {
  if (!Array.isArray(v) || v.length === 0) bad('An order needs at least one dish');
  return v.map((it: any, i) => ({
    dishId: str(it.dishId, `items[${i}].dishId`, { required: true }),
    name: l10n(it.name, `items[${i}].name`, 160),
    quantity: Math.max(1, Math.min(99, Math.round(num(it.quantity, 'quantity', 1)))),
    notes: str(it.notes, `items[${i}].notes`, { max: 500 }),
  }));
}

/** Create a draft (or submit directly with status: 'submitted'). Butler/admin. */
orders.post('/menus/:menuId/orders', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (u.role === 'chef') throw new HTTPException(403, { message: 'Chefs do not create orders' });
  const b = await c.req.json<any>();
  const items = parseItems(b.items);
  // Snapshot current dish names so the kitchen ticket survives later edits.
  const ids = items.map((i) => i.dishId);
  const dishRows = await c.env.DB.prepare(`SELECT id, name FROM dishes WHERE menu_id = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(menuId, ...ids).all<any>();
  const nameById = new Map(dishRows.results.map((r) => [r.id, JSON.parse(r.name)]));
  for (const it of items) { if (!nameById.has(it.dishId)) bad('One of the dishes no longer exists'); it.name = nameById.get(it.dishId); }

  const status: OrderStatus = b.status === 'submitted' ? 'submitted' : 'draft';
  const id = randomId('or');
  const nextNo = await c.env.DB.prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM orders WHERE menu_id = ?').bind(menuId).first<{ n: number }>();
  const ev: OrderEvent[] = [{ at: now(), by: displayName(u), from: null, to: status }];
  await c.env.DB.prepare(
    `INSERT INTO orders (id, menu_id, number, status, customer_name, customer_contact, delivery_at, special_instructions, internal_notes, items, events, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, menuId, nextNo?.n ?? 1, status,
    str(b.customerName, 'customerName', { max: 120, required: true }),
    str(b.customerContact, 'customerContact', { max: 200 }),
    b.deliveryAt ? new Date(b.deliveryAt).toISOString() : null,
    str(b.specialInstructions, 'specialInstructions', { max: 2000 }),
    str(b.internalNotes, 'internalNotes', { max: 2000 }),
    JSON.stringify(items), JSON.stringify(ev), u.id,
  ).run();
  await audit(c.env.DB, u.id, 'order.create', 'order', id, { status });
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return c.json({ order: rowToOrder(row, true) }, 201);
});

/** Edit order details. Allowed while draft or submitted (butler/admin). */
orders.patch('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Order not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  if (u.role === 'chef') throw new HTTPException(403, { message: 'Chefs do not edit orders' });
  if (!['draft', 'submitted'].includes(cur.status)) throw new HTTPException(409, { message: 'Only draft or submitted orders can be edited' });
  const b = await c.req.json<any>();
  const items = b.items !== undefined ? parseItems(b.items) : (JSON.parse(cur.items) as OrderItem[]);
  await c.env.DB.prepare(
    `UPDATE orders SET customer_name=?, customer_contact=?, delivery_at=?, special_instructions=?, internal_notes=?, items=?, updated_at=? WHERE id=?`,
  ).bind(
    b.customerName !== undefined ? str(b.customerName, 'customerName', { max: 120, required: true }) : cur.customer_name,
    b.customerContact !== undefined ? str(b.customerContact, 'customerContact', { max: 200 }) : cur.customer_contact,
    b.deliveryAt !== undefined ? (b.deliveryAt ? new Date(b.deliveryAt).toISOString() : null) : cur.delivery_at,
    b.specialInstructions !== undefined ? str(b.specialInstructions, 'specialInstructions', { max: 2000 }) : cur.special_instructions,
    b.internalNotes !== undefined ? str(b.internalNotes, 'internalNotes', { max: 2000 }) : cur.internal_notes,
    JSON.stringify(items), now(), id,
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return c.json({ order: rowToOrder(row, true) });
});

/** Status transition: body { to } — validated against the TRANSITIONS table and the caller's role. */
orders.post('/orders/:id/transition', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Order not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  const { to } = await c.req.json<{ to: OrderStatus }>();
  const from = cur.status as OrderStatus;
  const allowed = TRANSITIONS[from]?.find((t) => t.to === to);
  if (!allowed) throw new HTTPException(409, { message: `Cannot move an order from "${from}" to "${to}"` });
  if (!allowed.roles.includes(u.role)) throw new HTTPException(403, { message: `Your role cannot move an order to "${to}"` });
  const events = [...(JSON.parse(cur.events) as OrderEvent[]), { at: now(), by: displayName(u), from, to }];
  // Guard against two people clicking at once: only apply if status unchanged.
  const res = await c.env.DB.prepare('UPDATE orders SET status=?, events=?, updated_at=? WHERE id=? AND status=?')
    .bind(to, JSON.stringify(events), now(), id, from).run();
  if (!res.meta.changes) throw new HTTPException(409, { message: 'Order was updated by someone else — refresh' });
  await audit(c.env.DB, u.id, 'order.transition', 'order', id, { from, to });
  const row = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return c.json({ order: rowToOrder(row, seesInternal(u.role)) });
});

/** Delete: only terminal orders, butler/admin. */
orders.delete('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Order not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  if (u.role === 'chef') throw new HTTPException(403, { message: 'Chefs do not delete orders' });
  if (!['completed', 'cancelled', 'rejected', 'draft'].includes(cur.status)) throw new HTTPException(409, { message: 'Only draft or closed orders can be deleted' });
  await c.env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
  await audit(c.env.DB, u.id, 'order.delete', 'order', id);
  return c.json({ ok: true });
});
