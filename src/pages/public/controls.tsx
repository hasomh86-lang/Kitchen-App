import { useEffect, useState, type ReactNode } from 'react';
import type { Dish, ThemeId } from '@shared/types';
import { THEMES } from '@shared/types';
import { useI18n } from '@/lib/i18n';
import { Drop, Flame, Protein, Wheat } from '@/components/icons';
import { cx } from '@/components/ui';

/* ------------------------------------------------------------------------- */
/*  Nutrition limit filters                                                   */
/*  Each axis has three bands; picking one band narrows the list. Multiple    */
/*  axes combine with AND. Mirrors the live menu's "Nutrition limits" row.    */
/* ------------------------------------------------------------------------- */
export type Axis = 'calories' | 'protein' | 'carbohydrates';
export type Band = 0 | 1 | 2;
export type Limits = Partial<Record<Axis, Band>>;

const AXES: { id: Axis; icon: typeof Flame; unit: string; bands: [number, number] }[] = [
  { id: 'calories', icon: Flame, unit: '', bands: [400, 700] },
  { id: 'protein', icon: Protein, unit: 'g', bands: [20, 40] },
  { id: 'carbohydrates', icon: Wheat, unit: 'g', bands: [30, 60] },
];

export function matchesLimits(d: Dish, limits: Limits) {
  for (const ax of AXES) {
    const band = limits[ax.id];
    if (band === undefined) continue;
    const v = d.nutrition[ax.id];
    const [a, b] = ax.bands;
    if (band === 0 && !(v < a)) return false;
    if (band === 1 && !(v >= a && v <= b)) return false;
    if (band === 2 && !(v > b)) return false;
  }
  return true;
}

export const hasLimits = (l: Limits) => Object.values(l).some((v) => v !== undefined);

export function LimitFilters({ value, onChange, className }: { value: Limits; onChange: (v: Limits) => void; className?: string }) {
  const { t, lang } = useI18n();
  const label = (ax: (typeof AXES)[number], band: Band) => {
    const [a, b] = ax.bands;
    const u = ax.unit ? t('menu.g') : '';
    if (band === 0) return lang === 'ar' ? `أقل من ${a}${u}` : `< ${a}${u}`;
    if (band === 1) return `${a}–${b}${u}`;
    return lang === 'ar' ? `أكثر من ${b}${u}` : `${b}${u} >`;
  };
  const axisName = (id: Axis) => (id === 'calories' ? t('menu.cals') : id === 'protein' ? t('menu.protein') : t('menu.carbs'));
  return (
    <div className={cx('animate-rise', className)} style={{ animationDelay: '300ms' }}>
      <div className="rule mb-5 text-[10px] uppercase tracking-[0.3em]">
        <span className="inline-flex items-center gap-3">
          {t('menu.filters')}
          {hasLimits(value) && (
            <button onClick={() => onChange({})} className="rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.2em] text-fg-2 hover:border-accent hover:text-fg">{t('menu.clearFilters')}</button>
          )}
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {AXES.map((ax) => {
          const Icon = ax.icon;
          return (
            <div key={ax.id}>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-fg-3"><Icon size={12} />{axisName(ax.id)}</div>
              <div className="flex gap-1.5">
                {([0, 1, 2] as Band[]).map((b) => {
                  const on = value[ax.id] === b;
                  return (
                    <button key={b} onClick={() => onChange({ ...value, [ax.id]: on ? undefined : b })}
                      className={cx('h-9 flex-1 rounded-full border text-[11px] tracking-[0.08em] transition',
                        on ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-bg-2/60 text-fg-2 hover:border-fg-3 hover:text-fg')}>
                      {label(ax, b)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  View mode                                                                 */
/* ------------------------------------------------------------------------- */
export type ViewMode = 'grid' | 'compact' | 'list';
const VIEW_KEY = 'ak.view';

export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [v, setV] = useState<ViewMode>(() => {
    try { const s = localStorage.getItem(VIEW_KEY); if (s === 'grid' || s === 'compact' || s === 'list') return s; } catch { /* ignore */ }
    return 'grid';
  });
  const set = (n: ViewMode) => { setV(n); try { localStorage.setItem(VIEW_KEY, n); } catch { /* ignore */ } };
  return [v, set];
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t } = useI18n();
  const opts: { id: ViewMode; label: string; icon: ReactNode }[] = [
    { id: 'grid', label: t('menu.viewGrid'), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg> },
    { id: 'compact', label: t('menu.viewCompact'), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16" /></svg> },
    { id: 'list', label: t('menu.viewList'), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="4" rx="1.5" /><rect x="4" y="15" width="16" height="4" rx="1.5" /></svg> },
  ];
  return (
    <div role="radiogroup" aria-label={t('menu.view')} className="inline-flex rounded-full border border-line bg-bg-2/70 p-1 backdrop-blur">
      {opts.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} title={o.label} onClick={() => onChange(o.id)}
          className={cx('flex h-8 w-9 items-center justify-center rounded-full transition', value === o.id ? 'bg-accent text-accent-fg' : 'text-fg-3 hover:text-fg')}>
          {o.icon}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Guest theme picker — overrides the menu's default on this device only     */
/* ------------------------------------------------------------------------- */
const THEME_KEY = 'ak.guestTheme';
export const guestTheme = {
  get(): ThemeId | null { try { return (localStorage.getItem(THEME_KEY) as ThemeId) || null; } catch { return null; } },
  set(v: ThemeId | null) { try { v ? localStorage.setItem(THEME_KEY, v) : localStorage.removeItem(THEME_KEY); } catch { /* ignore */ } },
};

const SWATCH: Record<ThemeId, { bg: string; accent: string }> = {
  midnight: { bg: '#0b0a09', accent: '#d4b27a' },
  ivory: { bg: '#f7f3ec', accent: '#8a6b3c' },
  olive: { bg: '#0f1511', accent: '#c9b57a' },
  blush: { bg: '#f8efec', accent: '#9a5c4a' },
};

export function ThemePicker({ current, menuDefault, onPick, onClose }: { current: ThemeId; menuDefault: ThemeId; onPick: (t: ThemeId | null) => void; onClose: () => void }) {
  const { t, l } = useI18n();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute end-0 top-14 z-50 w-72 rounded-2xl border border-line bg-bg-2/95 p-4 shadow-2xl backdrop-blur-xl animate-rise">
        <div className="text-[10px] uppercase tracking-[0.3em] text-fg-3">{t('menu.theme')}</div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {THEMES.map((th) => {
            const sw = SWATCH[th.id];
            const on = current === th.id;
            return (
              <button key={th.id} onClick={() => onPick(th.id)} className={cx('flex flex-col items-center gap-1.5 rounded-xl border p-2 transition', on ? 'border-accent bg-accent/10' : 'border-line hover:border-fg-3')}>
                <span className="relative h-8 w-8 overflow-hidden rounded-full border border-line" style={{ background: sw.bg }}>
                  <span className="absolute inset-x-2 bottom-1.5 h-2 rounded-full" style={{ background: sw.accent }} />
                </span>
                <span className={cx('text-[9px] uppercase tracking-[0.12em]', on ? 'text-fg' : 'text-fg-3')}>{l(th.label)}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => onPick(null)} className={cx('mt-3 w-full rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]', current === menuDefault && !guestTheme.get() ? 'border-accent/40 text-fg-3' : 'border-line text-fg-2 hover:border-accent hover:text-fg')}>
          {t('menu.themeReset')}
        </button>
      </div>
    </>
  );
}
