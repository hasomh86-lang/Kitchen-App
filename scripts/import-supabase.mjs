#!/usr/bin/env node
// Imports the old Supabase export (categories.csv + dishes.csv) into the new app,
// downloading photos straight from Supabase Storage (works for private buckets).
//
// Usage:
//   1. Put categories.csv and dishes.csv into ./import-work/
//   2. Create ./import-work/.env with:
//        TARGET_URL=https://your-app.workers.dev      (or http://localhost:8787)
//        ADMIN_EMAIL=you@example.com
//        ADMIN_PASSWORD=********
//        MENU_SLUG=main-menu                           (target menu in the NEW app)
//        SUPABASE_URL=https://xxxx.supabase.co         (optional: needed for photos)
//        SUPABASE_SERVICE_KEY=eyJ...                   (optional: Project Settings → API → service_role)
//        REPLACE=false                                 (true wipes the target menu first)
//   3. node scripts/import-supabase.mjs
import fs from 'node:fs';
import path from 'node:path';

const WORK = path.resolve('import-work');
loadEnv(path.join(WORK, '.env'));
const {
  TARGET_URL, ADMIN_EMAIL, ADMIN_PASSWORD, MENU_SLUG = 'main-menu',
  SUPABASE_URL, SUPABASE_SERVICE_KEY, REPLACE = 'false',
} = process.env;
if (!TARGET_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) die('TARGET_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required (import-work/.env)');

const categoriesCsv = readCsv(path.join(WORK, 'categories.csv'));
const dishesCsv = readCsv(path.join(WORK, 'dishes.csv'));
log(`Read ${categoriesCsv.length} categories and ${dishesCsv.length} dishes`);

/* ------------------------------------------------------------------------ */
/*  1. Sign in to the new app                                                */
/* ------------------------------------------------------------------------ */
const origin = new URL(TARGET_URL).origin;
let cookie = '';
{
  const res = await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) die(`Login failed: ${res.status} ${await res.text()}`);
  cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) die('Login did not return a session cookie');
}
const api = async (method, p, body) => {
  const res = await fetch(`${origin}${p}`, { method, headers: { 'content-type': 'application/json', origin, cookie }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};
const menus = (await api('GET', '/api/admin/menus')).menus;
const menu = menus.find((m) => m.slug === MENU_SLUG);
if (!menu) die(`No menu with slug "${MENU_SLUG}" in the new app. Existing: ${menus.map((m) => m.slug).join(', ')}`);
log(`Target menu: ${menu.name} (${menu.id})`);

/* ------------------------------------------------------------------------ */
/*  2. Photos: Supabase Storage → new app (R2)                               */
/* ------------------------------------------------------------------------ */
const imageCache = new Map(); // old URL → new image id
const report = { images: 0, imageFailures: [] };

async function migrateImage(oldUrl) {
  if (!oldUrl) return null;
  if (oldUrl.startsWith('data:')) {
    const r = await api('POST', '/api/images/data-url', { dataUrl: oldUrl, menuId: menu.id });
    report.images++; return r.id;
  }
  if (imageCache.has(oldUrl)) return imageCache.get(oldUrl);
  try {
    const bytes = await downloadFromSupabase(oldUrl);
    const mime = guessMime(oldUrl, bytes);
    const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    const r = await api('POST', '/api/images/data-url', { dataUrl, menuId: menu.id });
    imageCache.set(oldUrl, r.id);
    report.images++;
    process.stdout.write('.');
    return r.id;
  } catch (e) {
    report.imageFailures.push({ url: oldUrl, error: e.message });
    process.stdout.write('x');
    return null;
  }
}

async function downloadFromSupabase(url) {
  // Public URL shape: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
  const m = /\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/.exec(url);
  if (m && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const [, bucket, objPath] = m;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objPath}`, {
      headers: { authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY },
    });
    if (!res.ok) throw new Error(`storage ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  // Fallback: plain fetch (works if the bucket is public or the URL is elsewhere)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/* ------------------------------------------------------------------------ */
/*  3. Transform rows                                                        */
/* ------------------------------------------------------------------------ */
const isArabic = (s) => /[؀-ۿ]/.test(s || '');
const l10n = (s) => (isArabic(s) ? { en: '', ar: s || '' } : { en: s || '', ar: '' });
const json = (s, fb) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
const bool = (s) => String(s).toLowerCase() === 'true' || s === '1';

log('\nMigrating category images…');
const categories = [];
for (const r of categoriesCsv.sort((a, b) => Number(a.order ?? a.display_order ?? 0) - Number(b.order ?? b.display_order ?? 0))) {
  categories.push({
    id: `ct_${r.id.replace(/-/g, '').slice(0, 16)}`,
    _oldId: r.id,
    name: l10n(r.name),
    description: l10n(r.description),
    image: await migrateImage(r.image),
    isHidden: bool(r.is_hidden),
    sortOrder: Number(r.order ?? r.display_order ?? 0) + 1,
    disclaimerEnabled: bool(r.disclaimer_enabled),
    disclaimerImage: await migrateImage(r.disclaimer_image),
  });
}
const catIdMap = new Map(categories.map((c) => [c._oldId, c.id]));
const dishIdMap = new Map(dishesCsv.map((r) => [r.id, `ds_${r.id.replace(/-/g, '').slice(0, 16)}`]));

log('\nMigrating dish images…');
const dishes = [];
for (const r of dishesCsv) {
  const categoryId = catIdMap.get(r.category_id);
  if (!categoryId) { log(`\nskip dish "${r.name}" — unknown category ${r.category_id}`); continue; }
  const angle = [];
  for (const a of json(r.angle_images, []).slice(0, 3)) { const id = await migrateImage(a); if (id) angle.push(id); }
  const n = json(r.nutrition, {});
  dishes.push({
    id: dishIdMap.get(r.id),
    categoryId,
    name: l10n(r.name),
    description: l10n(r.description),
    extraInfo: l10n(r.extra_info),
    image: await migrateImage(r.image),
    angleImages: angle,
    ingredients: json(r.ingredients, []).map(l10n),
    sideDishes: json(r.side_dishes, []).map(l10n),
    nutrition: { calories: +n.calories || 0, protein: +n.protein || 0, fat: +n.fat || 0, carbohydrates: +n.carbohydrates || 0, fiber: +n.fiber || 0 },
    suitableFor: json(r.suitable_for, []),
    coreComponents: json(r.core_components, []),
    tags: json(r.custom_tags, []).map((t) => ({ label: l10n(t.label), color: t.color })),
    recommendedDishIds: json(r.recommended_dish_ids, []).map((id) => dishIdMap.get(id)).filter(Boolean),
    isHidden: bool(r.is_hidden),
    isFeatured: bool(r.is_featured),
    sortOrder: Number(r.sort_order || 0),
  });
}

/* ------------------------------------------------------------------------ */
/*  4. Push                                                                  */
/* ------------------------------------------------------------------------ */
log(`\nImporting ${categories.length} categories and ${dishes.length} dishes into "${menu.name}"${REPLACE === 'true' ? ' (replacing existing content)' : ''}…`);
const result = await api('POST', `/api/catalog/menus/${menu.id}/import`, { categories: categories.map(({ _oldId, ...c }) => c), dishes, replace: REPLACE === 'true' });
log(`Done: ${result.categories} categories, ${result.dishes} dishes, ${report.images} photos.`);
if (report.imageFailures.length) {
  const f = path.join(WORK, 'image-failures.json');
  fs.writeFileSync(f, JSON.stringify(report.imageFailures, null, 2));
  log(`${report.imageFailures.length} photos could not be fetched — see ${f}`);
  if (!SUPABASE_SERVICE_KEY) log('Tip: set SUPABASE_URL and SUPABASE_SERVICE_KEY in import-work/.env to read a private bucket.');
}

/* ------------------------------------------------------------------------ */
function log(s) { console.log(s); }
function die(s) { console.error(`\n✖ ${s}`); process.exit(1); }
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
function guessMime(url, bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return /\.png(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg';
}
/** Minimal RFC-4180 CSV parser (handles quoted newlines, which Supabase exports use). */
function readCsv(file) {
  if (!fs.existsSync(file)) die(`Missing ${file}`);
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.length > 1 || r[0]);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}
