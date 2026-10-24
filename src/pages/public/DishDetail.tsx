import { useEffect, useState } from 'react';
import type { Dish } from '@shared/types';
import { useI18n } from '@/lib/i18n';
import { cx } from '@/components/ui';
import { CoreRow, Img, ItemList, NutritionRow, SuitableChips, Tags } from './parts';

export function DishDetail({ dish, all, onClose, onPick, showNutrition, showCore }: {
  dish: Dish; all: Dish[]; onClose: () => void; onPick: (d: Dish) => void; showNutrition: boolean; showCore: boolean;
}) {
  const { l, t } = useI18n();
  const images = [dish.image, ...dish.angleImages].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [dish.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const recs = dish.recommendedDishIds.map((id) => all.find((d) => d.id === id)).filter(Boolean) as Dish[];
  const extra = l(dish.extraInfo);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center sm:p-6 animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-bg-2 shadow-2xl sm:rounded-3xl md:flex-row animate-rise">
        <button onClick={onClose} aria-label={t('common.close')} className="absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">✕</button>

        {/* Gallery */}
        <div className="relative md:w-1/2 md:shrink-0">
          <Img src={images[idx] ?? dish.image} alt={l(dish.name)} className="aspect-[4/3] w-full md:aspect-auto md:h-full md:min-h-[520px]" eager />
          <Tags dish={dish} className="absolute start-4 top-4" />
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
              {images.map((im, i) => (
                <button key={im} onClick={() => setIdx(i)} className={cx('h-12 w-12 overflow-hidden rounded-lg border-2 transition', i === idx ? 'border-accent' : 'border-white/30 opacity-70 hover:opacity-100')}>
                  <Img src={im} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">{l(dish.name)}</h2>
          {l(dish.description) && <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{l(dish.description)}</p>}
          <div className="mt-4"><SuitableChips dish={dish} /></div>

          {showNutrition && (
            <section className="mt-7">
              <div className="rule mb-3 text-[10px] uppercase tracking-[0.22em]"><span>{t('menu.composition')}</span></div>
              <NutritionRow dish={dish} />
            </section>
          )}
          {showCore && (
            <section className="mt-7">
              <div className="rule mb-4 text-[10px] uppercase tracking-[0.22em]"><span>{t('menu.coreComponents')}</span></div>
              <CoreRow dish={dish} />
            </section>
          )}
          <div className="mt-7 space-y-6">
            <ItemList items={dish.ingredients} title={t('menu.ingredients')} />
            <ItemList items={dish.sideDishes} title={t('menu.sides')} />
          </div>
          {extra && (
            <section className="mt-7 rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-accent">{t('menu.extra')}</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-2">{extra}</p>
            </section>
          )}
          {recs.length > 0 && (
            <section className="mt-8">
              <div className="rule mb-3 text-[10px] uppercase tracking-[0.22em]"><span>{t('menu.recommended')}</span></div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {recs.map((r) => (
                  <button key={r.id} onClick={() => onPick(r)} className="w-36 shrink-0 text-start">
                    <Img src={r.image} alt={l(r.name)} className="aspect-square w-full rounded-xl" />
                    <div className="mt-1.5 line-clamp-2 text-xs text-fg-2">{l(r.name)}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
