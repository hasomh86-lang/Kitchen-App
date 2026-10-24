import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { L10n, Lang } from '@shared/types';
import { pick } from '@shared/types';

/* ---------------------------------------------------------------- */
/*  UI strings. Arabic is colloquial-leaning Gulf "white" Arabic.    */
/* ---------------------------------------------------------------- */
const STRINGS = {
  // shared
  'app.name': { en: 'Artisan Kitchen', ar: 'المطبخ الحرفي' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.saving': { en: 'Saving…', ar: 'جاري الحفظ…' },
  'common.saved': { en: 'Saved', ar: 'تم الحفظ' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.add': { en: 'Add', ar: 'إضافة' },
  'common.close': { en: 'Close', ar: 'إغلاق' },
  'common.back': { en: 'Back', ar: 'رجوع' },
  'common.search': { en: 'Search', ar: 'بحث' },
  'common.loading': { en: 'Loading…', ar: 'لحظة…' },
  'common.error': { en: 'Something went wrong', ar: 'صار خطأ، جرّب مرة ثانية' },
  'common.retry': { en: 'Try again', ar: 'أعد المحاولة' },
  'common.yes': { en: 'Yes', ar: 'نعم' },
  'common.no': { en: 'No', ar: 'لا' },
  'common.confirmDelete': { en: 'Delete this permanently?', ar: 'متأكد تبي تحذفه نهائياً؟' },
  'common.hidden': { en: 'Hidden', ar: 'مخفي' },
  'common.visible': { en: 'Visible', ar: 'ظاهر' },
  'common.featured': { en: 'Featured', ar: 'مميز' },
  'common.name': { en: 'Name', ar: 'الاسم' },
  'common.description': { en: 'Description', ar: 'الوصف' },
  'common.image': { en: 'Image', ar: 'الصورة' },
  'common.upload': { en: 'Upload', ar: 'رفع' },
  'common.remove': { en: 'Remove', ar: 'إزالة' },
  'common.english': { en: 'English', ar: 'إنجليزي' },
  'common.arabic': { en: 'Arabic', ar: 'عربي' },
  'common.offline': { en: 'Offline — showing saved menu', ar: 'بدون إنترنت — نعرض آخر نسخة محفوظة' },
  'common.none': { en: 'None', ar: 'لا يوجد' },
  'common.optional': { en: 'optional', ar: 'اختياري' },
  'common.all': { en: 'All', ar: 'الكل' },

  // public menu
  'menu.eyebrow': { en: 'Private dining curations', ar: 'تجربة طعام خاصة' },
  'menu.choose': { en: 'Choose your menu', ar: 'اختر قائمتك' },
  'menu.explore': { en: 'Explore', ar: 'استعرض' },
  'menu.dishes': { en: 'dishes', ar: 'طبق' },
  'menu.searchPlaceholder': { en: 'Search dishes or ingredients…', ar: 'ابحث عن طبق أو مكوّن…' },
  'menu.noResults': { en: 'Nothing matches that search.', ar: 'ما لقينا شي يطابق بحثك.' },
  'menu.composition': { en: 'Composition', ar: 'القيم الغذائية' },
  'menu.coreComponents': { en: 'Core components', ar: 'المكونات الأساسية' },
  'menu.ingredients': { en: 'Ingredients', ar: 'المكونات' },
  'menu.sides': { en: 'Served with', ar: 'يُقدَّم مع' },
  'menu.recommended': { en: 'Pairs well with', ar: 'يناسبه' },
  'menu.suitableFor': { en: 'Best for', ar: 'مناسب لـ' },
  'menu.kcal': { en: 'kcal', ar: 'سعرة' },
  'menu.cals': { en: 'Cals', ar: 'سعرات' },
  'menu.protein': { en: 'Prot', ar: 'بروتين' },
  'menu.fat': { en: 'Fat', ar: 'دهون' },
  'menu.carbs': { en: 'Carb', ar: 'كارب' },
  'menu.fiber': { en: 'Fiber', ar: 'ألياف' },
  'menu.g': { en: 'g', ar: 'غ' },
  'menu.allDishes': { en: 'All dishes', ar: 'كل الأطباق' },
  'menu.backToMenus': { en: 'All menus', ar: 'كل القوائم' },
  'menu.swipe': { en: 'Swipe to explore', ar: 'اسحب للاستعراض' },
  'menu.updated': { en: 'Menu updated', ar: 'تم تحديث القائمة' },
  'menu.extra': { en: 'Good to know', ar: 'معلومة تهمك' },
  'menu.disclaimerOk': { en: 'I understand', ar: 'تمام، فهمت' },

  // device gate
  'gate.title': { en: 'Device access', ar: 'الدخول من جهاز مسجّل' },
  'gate.body': { en: 'This menu opens on registered devices only. Enter the access code from your host.', ar: 'هذه القائمة تفتح من الأجهزة المسجّلة فقط. أدخل رمز الدخول اللي عطاك إياه المضيف.' },
  'gate.placeholder': { en: 'Access code', ar: 'رمز الدخول' },
  'gate.unlock': { en: 'Unlock menu', ar: 'افتح القائمة' },
  'gate.wrong': { en: 'That code is not valid for this menu.', ar: 'الرمز غير صحيح لهذه القائمة.' },
  'gate.notFound': { en: 'This menu does not exist or is not active.', ar: 'هذه القائمة غير موجودة أو موقّفة.' },

  // auth
  'auth.staff': { en: 'Staff entrance', ar: 'دخول الموظفين' },
  'auth.signIn': { en: 'Sign in', ar: 'تسجيل الدخول' },
  'auth.signOut': { en: 'Sign out', ar: 'تسجيل الخروج' },
  'auth.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'auth.password': { en: 'Password', ar: 'كلمة المرور' },
  'auth.setupTitle': { en: 'Create the first administrator', ar: 'إنشاء حساب المدير الأول' },
  'auth.setupBody': { en: 'This only happens once. You will be able to add the rest of the team afterwards.', ar: 'هذي الخطوة مرة وحدة بس. بعدها تقدر تضيف باقي الفريق.' },
  'auth.firstName': { en: 'First name', ar: 'الاسم الأول' },
  'auth.lastName': { en: 'Last name', ar: 'اسم العائلة' },
  'auth.create': { en: 'Create account', ar: 'إنشاء الحساب' },
  'auth.denied': { en: 'Your account has no access yet. Ask an administrator to assign your role.', ar: 'حسابك ما له صلاحية بعد. اطلب من المدير يحدد دورك.' },
  'auth.changePassword': { en: 'Change password', ar: 'تغيير كلمة المرور' },

  // staff nav
  'nav.dashboard': { en: 'Overview', ar: 'نظرة عامة' },
  'nav.dishes': { en: 'Dishes', ar: 'الأطباق' },
  'nav.categories': { en: 'Categories', ar: 'التصنيفات' },
  'nav.orders': { en: 'Orders', ar: 'الطلبات' },
  'nav.butler': { en: 'Butler', ar: 'الباتلر' },
  'nav.chef': { en: 'Kitchen', ar: 'المطبخ' },
  'nav.menus': { en: 'Menus & clients', ar: 'القوائم والعملاء' },
  'nav.users': { en: 'Team', ar: 'الفريق' },
  'nav.devices': { en: 'Devices', ar: 'الأجهزة' },
  'nav.settings': { en: 'Appearance', ar: 'المظهر' },
  'nav.viewMenu': { en: 'Open public menu', ar: 'افتح القائمة العامة' },
  'nav.workingMenu': { en: 'Working menu', ar: 'القائمة الحالية' },

  // roles
  'role.admin': { en: 'Administrator', ar: 'مدير' },
  'role.sub-admin': { en: 'Menu editor', ar: 'محرر قائمة' },
  'role.butler': { en: 'Butler', ar: 'باتلر' },
  'role.chef': { en: 'Chef', ar: 'شيف' },
  'role.pending': { en: 'No access', ar: 'بدون صلاحية' },

  // orders
  'order.new': { en: 'New order', ar: 'طلب جديد' },
  'order.customer': { en: 'Customer', ar: 'العميل' },
  'order.contact': { en: 'Contact', ar: 'التواصل' },
  'order.deliveryAt': { en: 'Delivery time', ar: 'وقت التوصيل' },
  'order.instructions': { en: 'Kitchen instructions', ar: 'تعليمات للمطبخ' },
  'order.internal': { en: 'Internal notes (butler only)', ar: 'ملاحظات داخلية (للباتلر فقط)' },
  'order.items': { en: 'Dishes', ar: 'الأطباق' },
  'order.addDish': { en: 'Add dish', ar: 'أضف طبق' },
  'order.saveDraft': { en: 'Save draft', ar: 'حفظ كمسودة' },
  'order.submit': { en: 'Send to kitchen', ar: 'أرسل للمطبخ' },
  'order.startPreparing': { en: 'Start preparing', ar: 'ابدأ التحضير' },
  'order.markReady': { en: 'Mark ready', ar: 'جاهز' },
  'order.reject': { en: 'Reject', ar: 'رفض' },
  'order.outForDelivery': { en: 'Out for delivery', ar: 'خرج للتوصيل' },
  'order.delivered': { en: 'Delivered', ar: 'تم التوصيل' },
  'order.complete': { en: 'Complete', ar: 'إكمال' },
  'order.cancel': { en: 'Cancel order', ar: 'إلغاء الطلب' },
  'order.active': { en: 'Active', ar: 'نشطة' },
  'order.closed': { en: 'Closed', ar: 'منتهية' },
  'order.empty': { en: 'No orders here yet.', ar: 'ما فيه طلبات هنا بعد.' },
  'order.queueEmpty': { en: 'Kitchen is clear.', ar: 'المطبخ فاضي حالياً.' },
  'order.notes': { en: 'Notes', ar: 'ملاحظات' },
  'order.qty': { en: 'Qty', ar: 'الكمية' },
  'order.history': { en: 'History', ar: 'السجل' },
  'order.live': { en: 'Live', ar: 'مباشر' },
} satisfies Record<string, L10n>;

export type StringKey = keyof typeof STRINGS;

interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (k: StringKey) => string;
  l: (v: L10n | null | undefined) => string;
  other: Lang;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children, initial, storageKey = 'ak.lang' }: { children: ReactNode; initial?: Lang; storageKey?: string }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(storageKey) as Lang | null;
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
    return initial ?? 'ar';
  });
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(storageKey, l); } catch {}
  }, [storageKey]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const value = useMemo<I18n>(() => ({
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    other: lang === 'ar' ? 'en' : 'ar',
    setLang,
    toggle: () => setLang(lang === 'ar' ? 'en' : 'ar'),
    t: (k) => STRINGS[k]?.[lang] ?? k,
    l: (v) => pick(v, lang),
  }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** Format "Name: 120g" ingredient strings coming from the old system. */
export function splitAmount(s: string): { name: string; amount: string } {
  const m = /^(.*?):\s*([\d.,]+\s*(?:g|gm|gr|ml|kg|غ|جم|مل)?)\s*$/i.exec(s);
  return m ? { name: m[1].trim(), amount: m[2].trim() } : { name: s, amount: '' };
}

export const fmtDate = (iso: string | null | undefined, lang: Lang, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) =>
  iso ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', opts).format(new Date(iso)) : '';
