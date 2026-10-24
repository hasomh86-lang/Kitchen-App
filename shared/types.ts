// Shared types between the Worker API and the web app.

export type Lang = 'en' | 'ar';

/** A bilingual string. Either side may be empty; the UI falls back to the other. */
export interface L10n {
  en: string;
  ar: string;
}

export type Role = 'admin' | 'sub-admin' | 'butler' | 'chef' | 'pending';
export const STAFF_ROLES: Role[] = ['admin', 'sub-admin', 'butler', 'chef'];

export type ThemeId = 'midnight' | 'ivory' | 'olive' | 'blush';
export const THEMES: { id: ThemeId; label: L10n }[] = [
  { id: 'midnight', label: { en: 'Midnight', ar: 'ليلي' } },
  { id: 'ivory', label: { en: 'Ivory', ar: 'عاجي' } },
  { id: 'olive', label: { en: 'Olive', ar: 'زيتوني' } },
  { id: 'blush', label: { en: 'Blush', ar: 'وردي' } },
];

export type SuitableFor =
  | 'breakfast' | 'lunch' | 'dinner'
  | 'pre-workout' | 'post-workout'
  | 'light-meal' | 'high-protein' | 'low-carb';

export const SUITABLE_FOR: { id: SuitableFor; label: L10n }[] = [
  { id: 'breakfast', label: { en: 'Breakfast', ar: 'فطور' } },
  { id: 'lunch', label: { en: 'Lunch', ar: 'غداء' } },
  { id: 'dinner', label: { en: 'Dinner', ar: 'عشاء' } },
  { id: 'pre-workout', label: { en: 'Pre-workout', ar: 'قبل التمرين' } },
  { id: 'post-workout', label: { en: 'Post-workout', ar: 'بعد التمرين' } },
  { id: 'light-meal', label: { en: 'Light meal', ar: 'وجبة خفيفة' } },
  { id: 'high-protein', label: { en: 'High protein', ar: 'عالي البروتين' } },
  { id: 'low-carb', label: { en: 'Low carb', ar: 'قليل الكارب' } },
];

export type CoreComponent =
  | 'nuts' | 'fish' | 'olive-oil' | 'dairy'
  | 'vegetables' | 'fruit' | 'legumes' | 'whole-grains';

export const CORE_COMPONENTS: { id: CoreComponent; label: L10n }[] = [
  { id: 'nuts', label: { en: 'Nuts', ar: 'مكسرات' } },
  { id: 'fish', label: { en: 'Fish', ar: 'سمك' } },
  { id: 'olive-oil', label: { en: 'Olive oil', ar: 'زيت زيتون' } },
  { id: 'dairy', label: { en: 'Dairy', ar: 'ألبان' } },
  { id: 'vegetables', label: { en: 'Vegetables', ar: 'خضار' } },
  { id: 'fruit', label: { en: 'Fruit', ar: 'فواكه' } },
  { id: 'legumes', label: { en: 'Legumes', ar: 'بقوليات' } },
  { id: 'whole-grains', label: { en: 'Whole grains', ar: 'حبوب كاملة' } },
];

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbohydrates: number;
  fiber: number;
}

export interface DishTag { label: L10n; color: string }

export const TAG_PALETTE = [
  '#B08D57', '#C6304B', '#E0662A', '#D9A420', '#2F8F5B', '#1D9A8F',
  '#2563C9', '#6D48D7', '#9C3D8F', '#DB5A86', '#4B5563', '#1A1A1A',
];

export interface Client {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface MenuSettings {
  theme: ThemeId;
  defaultLang: Lang;
  showNutrition: boolean;
  showCoreComponents: boolean;
  title: L10n;
  subtitle: L10n;
  tagline: L10n;
  philosophyTitle: L10n;
  philosophyBody: L10n;
  logoImage: string | null;
  openAccess: boolean;          // true → no device token needed
}

export interface Menu {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  settings: MenuSettings;
  contentUpdatedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  menuId: string;
  name: L10n;
  description: L10n;
  image: string | null;
  isHidden: boolean;
  sortOrder: number;
  disclaimerEnabled: boolean;
  disclaimerImage: string | null;
  disclaimerText: L10n;
}

export interface Dish {
  id: string;
  menuId: string;
  categoryId: string;
  name: L10n;
  description: L10n;
  extraInfo: L10n;
  image: string | null;
  angleImages: string[];
  ingredients: L10n[];
  sideDishes: L10n[];
  nutrition: Nutrition;
  suitableFor: SuitableFor[];
  coreComponents: CoreComponent[];
  tags: DishTag[];
  recommendedDishIds: string[];
  isHidden: boolean;
  isFeatured: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: 'active' | 'disabled';
  menuIds: string[];   // assignments (empty for admin = all)
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Device {
  id: string;
  menuId: string;
  name: string;
  building: string;
  location: string;
  status: 'active' | 'revoked';
  tokenPreview: string;  // last 4 chars
  createdAt: string;
  lastSeenAt: string | null;
}

export type OrderStatus =
  | 'draft' | 'submitted' | 'preparing' | 'ready'
  | 'out_for_delivery' | 'delivered' | 'completed'
  | 'cancelled' | 'rejected';

export const ORDER_STATUS: { id: OrderStatus; label: L10n; tone: string }[] = [
  { id: 'draft', label: { en: 'Draft', ar: 'مسودة' }, tone: 'neutral' },
  { id: 'submitted', label: { en: 'Submitted', ar: 'مرسل للمطبخ' }, tone: 'amber' },
  { id: 'preparing', label: { en: 'Preparing', ar: 'قيد التحضير' }, tone: 'blue' },
  { id: 'ready', label: { en: 'Ready', ar: 'جاهز' }, tone: 'violet' },
  { id: 'out_for_delivery', label: { en: 'Out for delivery', ar: 'في الطريق' }, tone: 'cyan' },
  { id: 'delivered', label: { en: 'Delivered', ar: 'تم التوصيل' }, tone: 'teal' },
  { id: 'completed', label: { en: 'Completed', ar: 'مكتمل' }, tone: 'green' },
  { id: 'cancelled', label: { en: 'Cancelled', ar: 'ملغي' }, tone: 'rose' },
  { id: 'rejected', label: { en: 'Rejected', ar: 'مرفوض' }, tone: 'rose' },
];

export const ACTIVE_STATUSES: OrderStatus[] = ['draft', 'submitted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
export const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'rejected'];
export const CHEF_QUEUE: OrderStatus[] = ['submitted', 'preparing'];

/** Who may perform which transition. */
export const TRANSITIONS: Record<OrderStatus, { to: OrderStatus; roles: Role[] }[]> = {
  draft: [{ to: 'submitted', roles: ['butler', 'admin'] }, { to: 'cancelled', roles: ['butler', 'admin'] }],
  submitted: [
    { to: 'preparing', roles: ['chef', 'admin'] },
    { to: 'rejected', roles: ['chef', 'admin'] },
    { to: 'cancelled', roles: ['butler', 'admin'] },
  ],
  preparing: [{ to: 'ready', roles: ['chef', 'admin'] }],
  ready: [{ to: 'out_for_delivery', roles: ['butler', 'admin'] }],
  out_for_delivery: [{ to: 'delivered', roles: ['butler', 'admin'] }],
  delivered: [{ to: 'completed', roles: ['butler', 'admin'] }],
  completed: [],
  cancelled: [],
  rejected: [],
};

export interface OrderItem {
  dishId: string;
  name: L10n;       // snapshot at order time
  quantity: number;
  notes: string;
}

export interface Order {
  id: string;
  menuId: string;
  number: number;          // human-friendly sequential per menu
  status: OrderStatus;
  customerName: string;
  customerContact: string;
  deliveryAt: string | null;
  specialInstructions: string;
  internalNotes: string;   // butler/admin only
  items: OrderItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  events: OrderEvent[];
}

export interface OrderEvent {
  at: string;
  by: string;      // user display name
  from: OrderStatus | null;
  to: OrderStatus;
}

/** Everything the public menu needs in one payload. */
export interface PublicMenuBundle {
  menu: { id: string; slug: string; name: string; settings: MenuSettings; contentUpdatedAt: string | null };
  categories: Category[];
  dishes: Dish[];
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  menuIds: string[];
}

export const emptyL10n = (): L10n => ({ en: '', ar: '' });
export const pick = (l: L10n | undefined | null, lang: Lang): string =>
  !l ? '' : (l[lang] || l[lang === 'ar' ? 'en' : 'ar'] || '');
