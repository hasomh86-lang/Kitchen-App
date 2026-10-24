import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { CORE_COMPONENTS, SUITABLE_FOR, type CoreComponent, type SuitableFor } from '@shared/types';
import type { AppContext } from '../env';
import { assertMenuAccess, requireRole } from '../lib/auth';
import { randomId } from '../lib/crypto';
import { audit, now, rowToCategory, rowToDish, touchMenu } from '../lib/db';
import { bad, bool, imageRef, l10n, l10nList, num, str, strList } from '../lib/validate';

export const catalog = new Hono<AppContext>();
catalog.use('*', requireRole('admin', 'sub-admin', 'butler', 'chef'));

const SF = SUITABLE_FOR.map((x) => x.id);
const CC = CORE_COMPONENTS.map((x) => x.id);
const canEdit = (role: string) => role === 'admin' || role === 'sub-admin';

/** Full staff catalog for one menu (all dishes, hidden included). */
catalog.get('/menus/:menuId/catalog', async (c) => {
  const menuId = c.req.param('menuId');
  assertMenuAccess(c, menuId);
  const [cats, dishes] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM categories WHERE menu_id = ? ORDER BY sort_order, created_at').bind(menuId),
    c.env.DB.prepare('SELECT * FROM dishes WHERE menu_id = ? ORDER BY sort_order, created_at').bind(menuId),
  ]);
  return c.json({ categories: cats.results.map(rowToCategory), dishes: dishes.results.map(rowToDish) });
});

/* -------------------------------- Categories ------------------------------- */

catalog.post('/menus/:menuId/categories', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const b = await c.req.json<any>();
  const id = randomId('ct');
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE menu_id = ?').bind(menuId).first<{ m: number }>();
  await c.env.DB.prepare(
    `INSERT INTO categories (id, menu_id, name, description, image, is_hidden, sort_order, disclaimer_enabled, disclaimer_image, disclaimer_text)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, menuId,
    JSON.stringify(l10n(b.name, 'name', 120)), JSON.stringify(l10n(b.description, 'description', 1000)),
    imageRef(b.image), bool(b.isHidden) ? 1 : 0, (max?.m ?? 0) + 1,
    bool(b.disclaimerEnabled) ? 1 : 0, imageRef(b.disclaimerImage), JSON.stringify(l10n(b.disclaimerText, 'disclaimerText', 4000)),
  ).run();
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, 'category.create', 'category', id);
  const row = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ category: rowToCategory(row) }, 201);
});

catalog.patch('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Category not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const b = await c.req.json<any>();
  const cat = rowToCategory(cur);
  await c.env.DB.prepare(
    `UPDATE categories SET name=?, description=?, image=?, is_hidden=?, disclaimer_enabled=?, disclaimer_image=?, disclaimer_text=?, updated_at=? WHERE id=?`,
  ).bind(
    JSON.stringify(b.name !== undefined ? l10n(b.name, 'name', 120) : cat.name),
    JSON.stringify(b.description !== undefined ? l10n(b.description, 'description', 1000) : cat.description),
    b.image !== undefined ? imageRef(b.image) : cat.image,
    bool(b.isHidden, cat.isHidden) ? 1 : 0,
    bool(b.disclaimerEnabled, cat.disclaimerEnabled) ? 1 : 0,
    b.disclaimerImage !== undefined ? imageRef(b.disclaimerImage) : cat.disclaimerImage,
    JSON.stringify(b.disclaimerText !== undefined ? l10n(b.disclaimerText, 'disclaimerText', 4000) : cat.disclaimerText),
    now(), id,
  ).run();
  await touchMenu(c.env.DB, cur.menu_id);
  const row = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return c.json({ category: rowToCategory(row) });
});

catalog.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Category not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM dishes WHERE category_id = ?').bind(id).first<{ n: number }>();
  if ((count?.n ?? 0) > 0 && !c.req.query('force')) {
    throw new HTTPException(409, { message: `This category still has ${count!.n} dishes. Move them first or delete with force.` });
  }
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  await touchMenu(c.env.DB, cur.menu_id);
  await audit(c.env.DB, u.id, 'category.delete', 'category', id);
  return c.json({ ok: true });
});

/** Reorder: body { ids: string[] } in the desired order. */
catalog.post('/menus/:menuId/categories/reorder', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const { ids } = await c.req.json<{ ids: string[] }>();
  if (!Array.isArray(ids)) bad('ids must be a list');
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE categories SET sort_order=? WHERE id=? AND menu_id=?').bind(i + 1, id, menuId)));
  await touchMenu(c.env.DB, menuId);
  return c.json({ ok: true });
});

/* ---------------------------------- Dishes --------------------------------- */

function dishFields(b: any, cur?: ReturnType<typeof rowToDish>) {
  const nutritionIn = b.nutrition ?? {};
  const nutrition = cur?.nutrition ?? { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0 };
  return {
    name: JSON.stringify(b.name !== undefined ? l10n(b.name, 'name', 160) : cur?.name ?? { en: '', ar: '' }),
    description: JSON.stringify(b.description !== undefined ? l10n(b.description, 'description', 2000) : cur?.description ?? { en: '', ar: '' }),
    extra_info: JSON.stringify(b.extraInfo !== undefined ? l10n(b.extraInfo, 'extraInfo', 2000) : cur?.extraInfo ?? { en: '', ar: '' }),
    image: b.image !== undefined ? imageRef(b.image) : cur?.image ?? null,
    angle_images: JSON.stringify(b.angleImages !== undefined ? strList(b.angleImages, 'angleImages').map((x) => imageRef(x)).filter(Boolean).slice(0, 3) : cur?.angleImages ?? []),
    ingredients: JSON.stringify(b.ingredients !== undefined ? l10nList(b.ingredients, 'ingredients') : cur?.ingredients ?? []),
    side_dishes: JSON.stringify(b.sideDishes !== undefined ? l10nList(b.sideDishes, 'sideDishes') : cur?.sideDishes ?? []),
    nutrition: JSON.stringify(
      b.nutrition !== undefined
        ? {
            calories: num(nutritionIn.calories, 'calories'),
            protein: num(nutritionIn.protein, 'protein'),
            fat: num(nutritionIn.fat, 'fat'),
            carbohydrates: num(nutritionIn.carbohydrates, 'carbohydrates'),
            fiber: num(nutritionIn.fiber, 'fiber'),
          }
        : nutrition,
    ),
    suitable_for: JSON.stringify(b.suitableFor !== undefined ? strList<SuitableFor>(b.suitableFor, 'suitableFor', SF) : cur?.suitableFor ?? []),
    core_components: JSON.stringify(b.coreComponents !== undefined ? strList<CoreComponent>(b.coreComponents, 'coreComponents', CC) : cur?.coreComponents ?? []),
    tags: JSON.stringify(
      b.tags !== undefined
        ? (Array.isArray(b.tags) ? b.tags : []).slice(0, 4).map((t: any) => ({
            label: l10n(t?.label, 'tag.label', 40),
            color: /^#[0-9a-fA-F]{6}$/.test(String(t?.color)) ? String(t.color) : '#B08D57',
          }))
        : cur?.tags ?? [],
    ),
    recommended_dish_ids: JSON.stringify(b.recommendedDishIds !== undefined ? strList(b.recommendedDishIds, 'recommendedDishIds').slice(0, 6) : cur?.recommendedDishIds ?? []),
    is_hidden: bool(b.isHidden, cur?.isHidden ?? false) ? 1 : 0,
    is_featured: bool(b.isFeatured, cur?.isFeatured ?? false) ? 1 : 0,
  };
}

catalog.post('/menus/:menuId/dishes', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const b = await c.req.json<any>();
  const categoryId = str(b.categoryId, 'categoryId', { required: true });
  const cat = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? AND menu_id = ?').bind(categoryId, menuId).first();
  if (!cat) throw new HTTPException(404, { message: 'Category not found in this menu' });
  const f = dishFields(b);
  const id = randomId('ds');
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM dishes WHERE category_id = ?').bind(categoryId).first<{ m: number }>();
  await c.env.DB.prepare(
    `INSERT INTO dishes (id, menu_id, category_id, name, description, extra_info, image, angle_images, ingredients, side_dishes, nutrition,
       suitable_for, core_components, tags, recommended_dish_ids, is_hidden, is_featured, sort_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, menuId, categoryId, f.name, f.description, f.extra_info, f.image, f.angle_images, f.ingredients, f.side_dishes, f.nutrition,
    f.suitable_for, f.core_components, f.tags, f.recommended_dish_ids, f.is_hidden, f.is_featured, (max?.m ?? 0) + 1,
  ).run();
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, 'dish.create', 'dish', id);
  const row = await c.env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(id).first();
  return c.json({ dish: rowToDish(row) }, 201);
});

catalog.patch('/dishes/:id', async (c) => {
  const id = c.req.param('id');
  const curRow = await c.env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(id).first<any>();
  if (!curRow) throw new HTTPException(404, { message: 'Dish not found' });
  const u = assertMenuAccess(c, curRow.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const b = await c.req.json<any>();
  const cur = rowToDish(curRow);
  let categoryId = cur.categoryId;
  if (b.categoryId !== undefined && b.categoryId !== cur.categoryId) {
    categoryId = str(b.categoryId, 'categoryId', { required: true });
    const cat = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ? AND menu_id = ?').bind(categoryId, cur.menuId).first();
    if (!cat) throw new HTTPException(404, { message: 'Target category not found in this menu' });
  }
  // Optimistic concurrency: reject if someone saved after the version the editor loaded.
  if (b.expectedUpdatedAt && b.expectedUpdatedAt !== cur.updatedAt) {
    throw new HTTPException(409, { message: 'This dish was changed by someone else. Reload and try again.' });
  }
  const f = dishFields(b, cur);
  await c.env.DB.prepare(
    `UPDATE dishes SET category_id=?, name=?, description=?, extra_info=?, image=?, angle_images=?, ingredients=?, side_dishes=?, nutrition=?,
       suitable_for=?, core_components=?, tags=?, recommended_dish_ids=?, is_hidden=?, is_featured=?, updated_at=? WHERE id=?`,
  ).bind(
    categoryId, f.name, f.description, f.extra_info, f.image, f.angle_images, f.ingredients, f.side_dishes, f.nutrition,
    f.suitable_for, f.core_components, f.tags, f.recommended_dish_ids, f.is_hidden, f.is_featured, now(), id,
  ).run();
  await touchMenu(c.env.DB, cur.menuId);
  const row = await c.env.DB.prepare('SELECT * FROM dishes WHERE id = ?').bind(id).first();
  return c.json({ dish: rowToDish(row) });
});

catalog.delete('/dishes/:id', async (c) => {
  const id = c.req.param('id');
  const cur = await c.env.DB.prepare('SELECT menu_id FROM dishes WHERE id = ?').bind(id).first<any>();
  if (!cur) throw new HTTPException(404, { message: 'Dish not found' });
  const u = assertMenuAccess(c, cur.menu_id);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  await c.env.DB.prepare('DELETE FROM dishes WHERE id = ?').bind(id).run();
  await touchMenu(c.env.DB, cur.menu_id);
  await audit(c.env.DB, u.id, 'dish.delete', 'dish', id);
  return c.json({ ok: true });
});

/** Reorder dishes within a category: body { categoryId, ids } */
catalog.post('/menus/:menuId/dishes/reorder', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (!canEdit(u.role)) throw new HTTPException(403, { message: 'Only admins and sub-admins edit the menu' });
  const { ids } = await c.req.json<{ ids: string[] }>();
  if (!Array.isArray(ids)) bad('ids must be a list');
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare('UPDATE dishes SET sort_order=? WHERE id=? AND menu_id=?').bind(i + 1, id, menuId)));
  await touchMenu(c.env.DB, menuId);
  return c.json({ ok: true });
});

/** Bulk import (used by the migration script and the admin JSON import). */
catalog.post('/menus/:menuId/import', async (c) => {
  const menuId = c.req.param('menuId');
  const u = assertMenuAccess(c, menuId);
  if (u.role !== 'admin') throw new HTTPException(403, { message: 'Admin only' });
  const b = await c.req.json<{ categories?: any[]; dishes?: any[]; replace?: boolean }>();
  const stmts: D1PreparedStatement[] = [];
  if (b.replace) {
    stmts.push(c.env.DB.prepare('DELETE FROM dishes WHERE menu_id = ?').bind(menuId));
    stmts.push(c.env.DB.prepare('DELETE FROM categories WHERE menu_id = ?').bind(menuId));
  }
  const catIdMap = new Map<string, string>();
  let ci = 0;
  for (const cat of b.categories ?? []) {
    const id = typeof cat.id === 'string' && /^[\w-]{3,64}$/.test(cat.id) ? cat.id : randomId('ct');
    catIdMap.set(String(cat.id ?? id), id);
    stmts.push(
      c.env.DB.prepare(
        `INSERT OR REPLACE INTO categories (id, menu_id, name, description, image, is_hidden, sort_order, disclaimer_enabled, disclaimer_image, disclaimer_text)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        id, menuId, JSON.stringify(l10n(cat.name, 'name', 120)), JSON.stringify(l10n(cat.description, 'description', 1000)),
        imageRef(cat.image), bool(cat.isHidden) ? 1 : 0, num(cat.sortOrder, 'sortOrder', ++ci),
        bool(cat.disclaimerEnabled) ? 1 : 0, imageRef(cat.disclaimerImage), JSON.stringify(l10n(cat.disclaimerText, 'disclaimerText', 4000)),
      ),
    );
  }
  let di = 0;
  for (const d of b.dishes ?? []) {
    const categoryId = catIdMap.get(String(d.categoryId)) ?? d.categoryId;
    if (!categoryId) continue;
    const id = typeof d.id === 'string' && /^[\w-]{3,64}$/.test(d.id) ? d.id : randomId('ds');
    const f = dishFields(d);
    stmts.push(
      c.env.DB.prepare(
        `INSERT OR REPLACE INTO dishes (id, menu_id, category_id, name, description, extra_info, image, angle_images, ingredients, side_dishes, nutrition,
           suitable_for, core_components, tags, recommended_dish_ids, is_hidden, is_featured, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        id, menuId, categoryId, f.name, f.description, f.extra_info, f.image, f.angle_images, f.ingredients, f.side_dishes, f.nutrition,
        f.suitable_for, f.core_components, f.tags, f.recommended_dish_ids, f.is_hidden, f.is_featured, num(d.sortOrder, 'sortOrder', ++di),
      ),
    );
  }
  // D1 batch limit safety: chunk.
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await touchMenu(c.env.DB, menuId);
  await audit(c.env.DB, u.id, 'catalog.import', 'menu', menuId, { categories: b.categories?.length ?? 0, dishes: b.dishes?.length ?? 0 });
  return c.json({ ok: true, categories: b.categories?.length ?? 0, dishes: b.dishes?.length ?? 0 });
});
