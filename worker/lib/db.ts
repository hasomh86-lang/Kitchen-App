import type { Category, Client, Device, Dish, L10n, Menu, MenuSettings, Order, User } from '@shared/types';

export const now = () => new Date().toISOString();

const j = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
const l10n = (s: unknown): L10n => {
  const v = j<Partial<L10n>>(s, {});
  return { en: v.en ?? '', ar: v.ar ?? '' };
};

export const DEFAULT_SETTINGS: MenuSettings = {
  theme: 'midnight',
  defaultLang: 'ar',
  showNutrition: true,
  showCoreComponents: true,
  title: { en: 'Artisan Kitchen', ar: 'المطبخ الحرفي' },
  subtitle: { en: 'Selection', ar: 'التشكيلة' },
  tagline: { en: '', ar: '' },
  philosophyTitle: { en: '', ar: '' },
  philosophyBody: { en: '', ar: '' },
  logoImage: null,
  openAccess: false,
};

export function rowToClient(r: any): Client {
  return { id: r.id, name: r.name, slug: r.slug, status: r.status, createdAt: r.created_at };
}

export function rowToMenu(r: any): Menu {
  const s = j<Partial<MenuSettings>>(r.settings, {});
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    settings: { ...DEFAULT_SETTINGS, ...s, title: { ...DEFAULT_SETTINGS.title, ...(s.title || {}) } },
    contentUpdatedAt: r.content_updated_at ?? null,
    createdAt: r.created_at,
  };
}

export function rowToCategory(r: any): Category {
  return {
    id: r.id,
    menuId: r.menu_id,
    name: l10n(r.name),
    description: l10n(r.description),
    image: r.image ?? null,
    isHidden: !!r.is_hidden,
    sortOrder: r.sort_order ?? 0,
    disclaimerEnabled: !!r.disclaimer_enabled,
    disclaimerImage: r.disclaimer_image ?? null,
    disclaimerText: l10n(r.disclaimer_text),
  };
}

export function rowToDish(r: any): Dish {
  return {
    id: r.id,
    menuId: r.menu_id,
    categoryId: r.category_id,
    name: l10n(r.name),
    description: l10n(r.description),
    extraInfo: l10n(r.extra_info),
    image: r.image ?? null,
    angleImages: j(r.angle_images, []),
    ingredients: j<any[]>(r.ingredients, []).map((x) => (typeof x === 'string' ? { en: x, ar: '' } : { en: x.en ?? '', ar: x.ar ?? '' })),
    sideDishes: j<any[]>(r.side_dishes, []).map((x) => (typeof x === 'string' ? { en: x, ar: '' } : { en: x.en ?? '', ar: x.ar ?? '' })),
    nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0, ...j(r.nutrition, {}) },
    suitableFor: j(r.suitable_for, []),
    coreComponents: j(r.core_components, []),
    tags: j(r.tags, []),
    recommendedDishIds: j(r.recommended_dish_ids, []),
    isHidden: !!r.is_hidden,
    isFeatured: !!r.is_featured,
    sortOrder: r.sort_order ?? 0,
    updatedAt: r.updated_at,
  };
}

export function rowToUser(r: any, menuIds: string[] = []): User {
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    status: r.status,
    menuIds,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null,
  };
}

export function rowToDevice(r: any): Device {
  return {
    id: r.id,
    menuId: r.menu_id,
    name: r.name,
    building: r.building,
    location: r.location,
    status: r.status,
    tokenPreview: r.token_preview,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at ?? null,
  };
}

export function rowToOrder(r: any, includeInternal: boolean): Order {
  return {
    id: r.id,
    menuId: r.menu_id,
    number: r.number,
    status: r.status,
    customerName: r.customer_name,
    customerContact: includeInternal ? r.customer_contact : '',
    deliveryAt: r.delivery_at ?? null,
    specialInstructions: r.special_instructions,
    internalNotes: includeInternal ? r.internal_notes : '',
    items: j(r.items, []),
    createdBy: r.created_by ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    events: j(r.events, []),
  };
}

/** Mark a menu's guest-visible content as changed (drives client cache invalidation). */
export async function touchMenu(db: D1Database, menuId: string) {
  await db.prepare('UPDATE menus SET content_updated_at = ? WHERE id = ?').bind(now(), menuId).run();
}

export async function audit(db: D1Database, userId: string | null, action: string, entity?: string, entityId?: string, detail?: unknown) {
  await db
    .prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)')
    .bind(userId, action, entity ?? null, entityId ?? null, detail ? JSON.stringify(detail) : null)
    .run();
}
