import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Category, Dish, L10n } from '@shared/types';
import { CORE_COMPONENTS, SUITABLE_FOR } from '@shared/types';
import { imgSrc } from '@/lib/api';
import { splitAmount, useI18n } from '@/lib/i18n';
import { CoreIcon, Drop, Flame, Leaf, Protein, Wheat } from '@/components/icons';
import { cx } from '@/components/ui';

/* --------------------------------- Image ----------------------------------- */
export function Img({ src, alt, className, eager }: { src: string | null | undefined; alt: string; className?: string; eager?: boolean }) {
  const [ok, setOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const url = imgSrc(src);
  if (!url || !ok) {
    return (
      <div className={cx('flex items-center justify-center bg-bg-3 text-fg-3', className)}>
        <Leaf size={28} className="opacity-40" />
      </div>
    );
  }
  return (
    <div className={cx('relative overflow-hidden bg-bg-3', className)}>
      {!loaded && <div className="skeleton absolute inset-0" />}
      <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(true)} onError={() => setOk(false)}
        className={cx('h-full w-full object-cover transition-opacity duration-700', loaded ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

/* ------------------------------- Nutrition --------------------------------- */
export function NutritionRow({ dish, compact }: { dish: Dish; compact?: boolean }) {
  const { t } = useI18n();
  const n = dish.nutrition;
  const items: { k: string; v: number; unit: string; icon: ReactNode; hot?: boolean }[] = [
    { k: t('menu.cals'), v: n.calories, unit: '', icon: <Flame size={14} />, hot: true },
    { k: t('menu.protein'), v: n.protein, unit: t('menu.g'), icon: <Protein size={14} /> },
    { k: t('menu.fat'), v: n.fat, unit: t('menu.g'), icon: <Drop size={14} /> },
    { k: t('menu.carbs'), v: n.carbohydrates, unit: t('menu.g'), icon: <Wheat size={14} /> },
    { k: t('menu.fiber'), v: n.fiber, unit: t('menu.g'), icon: <Leaf size={14} /> },
  ];
  return (
    <div className={cx('grid grid-cols-5 divide-x divide-line rtl:divide-x-reverse', compact ? 'text-center' : 'text-center')}>
      {items.map((it) => (
        <div key={it.k} className="px-1 py-1">
          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.18em] text-fg-3">{it.icon}<span>{it.k}</span></div>
          <div className={cx('mt-1 font-display leading-none', compact ? 'text-xl' : 'text-2xl md:text-3xl', it.hot ? 'text-accent' : 'text-fg')}>
            {Math.round(it.v)}<span className="ms-0.5 text-[11px] font-sans text-fg-3">{it.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Core components ----------------------------- */
export function CoreRow({ dish, size = 'md' }: { dish: Dish; size?: 'sm' | 'md' }) {
  const { l } = useI18n();
  const has = new Set(dish.coreComponents);
  return (
    <div className={cx('grid grid-cols-8 gap-1', size === 'sm' ? 'max-w-xs' : '')}>
      {CORE_COMPONENTS.map((c) => {
        const on = has.has(c.id);
        return (
          <div key={c.id} className="flex flex-col items-center gap-1.5" title={l(c.label)}>
            <div className={cx('flex items-center justify-center rounded-full border transition',
              size === 'sm' ? 'h-8 w-8' : 'h-11 w-11',
              on ? 'border-accent/70 bg-accent/10 text-accent' : 'border-line text-fg-3/40 border-dashed')}>
              <CoreIcon id={c.id} size={size === 'sm' ? 15 : 20} />
            </div>
            {size === 'md' && <span className={cx('text-[8px] uppercase tracking-[0.08em] text-center leading-tight break-words', on ? 'text-fg-2' : 'text-fg-3/50')}>{l(c.label)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Tags ----------------------------------- */
export function Tags({ dish, className }: { dish: Dish; className?: string }) {
  const { l } = useI18n();
  if (!dish.tags.length) return null;
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {dish.tags.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm backdrop-blur" style={{ background: `${t.color}e6` }}>
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />{l(t.label)}
        </span>
      ))}
    </div>
  );
}

export function SuitableChips({ dish }: { dish: Dish }) {
  const { l } = useI18n();
  if (!dish.suitableFor.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {dish.suitableFor.map((s) => {
        const o = SUITABLE_FOR.find((x) => x.id === s);
        return <span key={s} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-2">{o ? l(o.label) : s}</span>;
      })}
    </div>
  );
}

/* ------------------------------- Ingredients ------------------------------- */
export function ItemList({ items, title }: { items: L10n[]; title: string }) {
  const { l } = useI18n();
  if (!items.length) return null;
  return (
    <div>
      <div className="rule mb-3 text-[10px] uppercase tracking-[0.22em]"><span>{title}</span></div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {items.map((it, i) => {
          const { name, amount } = splitAmount(l(it));
          return (
            <li key={i} className="flex items-baseline justify-between gap-3 border-b border-dotted border-line pb-1 text-sm">
              <span className="text-fg">{name}</span>
              {amount && <span className="shrink-0 font-display text-base text-fg-3">{amount}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------- Disclaimer -------------------------------- */
export function Disclaimer({ category, onClose }: { category: Category; onClose: () => void }) {
  const { l, t } = useI18n();
  const text = l(category.disclaimerText);
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-fade" onClick={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-bg-2 shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>
        {category.disclaimerImage && <Img src={category.disclaimerImage} alt="" className="max-h-[70dvh] w-full" eager />}
        {text && <p className="whitespace-pre-wrap px-6 py-5 text-sm leading-relaxed text-fg-2">{text}</p>}
        <div className="flex justify-center border-t border-line p-4">
          <button onClick={onClose} className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-fg">{t('menu.disclaimerOk')}</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Scroll reveal hook ---------------------------- */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}
