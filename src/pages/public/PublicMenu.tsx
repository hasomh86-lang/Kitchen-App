import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Dish, PublicMenuBundle, ThemeId } from '@shared/types';
import { imgSrc } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { bundleCache, deviceToken, loadBundle } from '@/lib/menuCache';
import { ArrowStart, Globe, Key, Monogram, Search, Wifi } from '@/components/icons';
import { cx } from '@/components/ui';
import { DishDetail } from './DishDetail';
import { CoreRow, Disclaimer, Img, NutritionRow, Tags, useReveal } from './parts';
import { LimitFilters, ThemePicker, ViewToggle, guestTheme, hasLimits, matchesLimits, useViewMode, type Limits, type ViewMode } from './controls';

type GateState =
  | { kind: 'loading' }
  | { kind: 'locked'; error?: string; title?: { en: string; ar: string }; logo?: string | null }
  | { kind: 'notfound' }
  | { kind: 'ready'; bundle: PublicMenuBundle; offline: boolean };

export default function PublicMenu({ slug }: { slug: string }) {
  const { lang, setLang, toggle, t, l } = useI18n();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [catId, setCatId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Dish | null>(null);
  const [disclaimerFor, setDisclaimerFor] = useState<Category | null>(null);
  const seenDisclaimer = useRef(new Set<string>());
  const [toast, setToast] = useState<string | null>(null);
  const langTouched = useRef(false);
  const [limits, setLimits] = useState<Limits>({});
  const [view, setView] = useViewMode();
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeOverride, setThemeOverride] = useState<ThemeId | null>(() => guestTheme.get());

  const applyTheme = useCallback((theme: ThemeId) => { document.documentElement.dataset.theme = guestTheme.get() ?? theme; }, []);
  const pickTheme = (t: ThemeId | null, menuDefault: ThemeId) => {
    guestTheme.set(t); setThemeOverride(t);
    document.documentElement.dataset.theme = t ?? menuDefault;
  };

  const load = useCallback(async () => {
    const token = deviceToken.get(slug);
    try {
      const { bundle, fromCache, changed } = await loadBundle(slug, token);
      applyTheme(bundle.menu.settings.theme);
      if (!langTouched.current && !localStorage.getItem('ak.lang')) setLang(bundle.menu.settings.defaultLang);
      setState({ kind: 'ready', bundle, offline: fromCache });
      if (changed) { setToast(t('menu.updated')); setTimeout(() => setToast(null), 2500); }
    } catch (e: any) {
      if (e?.code === 404) return setState({ kind: 'notfound' });
      if (e?.code === 401) {
        try {
          const g = await fetch(`/api/public/menu/${encodeURIComponent(slug)}/gate`).then((r) => r.json());
          applyTheme(g.theme);
          setState({ kind: 'locked', title: g.title, logo: g.logoImage, error: token ? t('gate.wrong') : undefined });
        } catch { setState({ kind: 'locked' }); }
        return;
      }
      const cached = bundleCache.get(slug);
      if (cached) { applyTheme(cached.menu.settings.theme); setState({ kind: 'ready', bundle: cached, offline: true }); }
      else setState({ kind: 'locked', error: t('common.error') });
    }
  }, [slug, setLang, t, applyTheme]);

  useEffect(() => { void load(); }, [load]);

  // Poll for content changes every 60s while visible (cheap ETag probe).
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    const onVis = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onVis); };
  }, [state.kind, load]);

  const bundle = state.kind === 'ready' ? state.bundle : null;
  const dishesByCat = useMemo(() => {
    const m = new Map<string, Dish[]>();
    for (const d of bundle?.dishes ?? []) m.set(d.categoryId, [...(m.get(d.categoryId) ?? []), d]);
    return m;
  }, [bundle]);

  const q = query.trim().toLowerCase();
  const filtering = hasLimits(limits);
  // Search text + nutrition limits together. Null means "no filtering active".
  const searchResults = useMemo(() => {
    if ((!q && !filtering) || !bundle) return null;
    return bundle.dishes.filter((d) => {
      if (!matchesLimits(d, limits)) return false;
      if (!q) return true;
      return [d.name.en, d.name.ar, d.description.en, d.description.ar, ...d.ingredients.flatMap((i) => [i.en, i.ar]), ...d.tags.flatMap((x) => [x.label.en, x.label.ar])]
        .some((s) => s?.toLowerCase().includes(q));
    });
  }, [q, filtering, limits, bundle]);

  const openCategory = (c: Category) => {
    setCatId(c.id);
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (c.disclaimerEnabled && (c.disclaimerImage || c.disclaimerText.en || c.disclaimerText.ar) && !seenDisclaimer.current.has(c.id)) {
      seenDisclaimer.current.add(c.id);
      setDisclaimerFor(c);
    }
  };

  /* ------------------------------------------------------------------------ */
  if (state.kind === 'loading') return <Splash />;
  if (state.kind === 'notfound') return <Gate slug={slug} notFound onRetry={load} />;
  if (state.kind === 'locked') return <Gate slug={slug} error={state.error} title={state.title} logo={state.logo} onRetry={load} />;

  const { menu, categories } = state.bundle;
  const s = menu.settings;
  const current = catId ? categories.find((c) => c.id === catId) ?? null : null;

  return (
    <div className="grain min-h-dvh bg-bg text-fg">
      <Atmosphere />
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 backdrop-blur-md md:px-10" style={{ background: 'color-mix(in srgb, var(--t-bg) 72%, transparent)' }}>
        <button onClick={() => { setCatId(null); setQuery(''); }} className="flex items-center gap-3">
          {s.logoImage ? <img src={imgSrc(s.logoImage)} alt="" className="h-9 w-9 rounded-full object-cover" /> : <Monogram size={34} className="text-fg" />}
          <span className="hidden text-[11px] uppercase tracking-[0.3em] text-fg-2 sm:inline">{l(s.title)}</span>
        </button>
        <div className="flex items-center gap-2">
          {state.offline && <span className="hidden items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] text-fg-3 sm:flex"><Wifi size={12} />{t('common.offline')}</span>}
          <button onClick={() => { langTouched.current = true; toggle(); }} className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-fg-2 hover:border-accent hover:text-fg">
            <Globe size={14} />{lang === 'ar' ? 'EN' : 'عربي'}
          </button>
          <div className="relative">
            <button aria-label={t('menu.theme')} onClick={() => setThemeOpen((v) => !v)} className={cx('flex h-9 w-9 items-center justify-center rounded-full border transition', themeOpen ? 'border-accent text-accent' : 'border-line text-fg-2 hover:border-accent hover:text-fg')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1 2-2 0-1-.6-1.6-.6-2.4 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" /><circle cx="7.5" cy="11.5" r="1" fill="currentColor" /><circle cx="10.5" cy="7.5" r="1" fill="currentColor" /><circle cx="15.5" cy="7.5" r="1" fill="currentColor" /></svg>
            </button>
            {themeOpen && <ThemePicker current={themeOverride ?? s.theme} menuDefault={s.theme} onPick={(th) => pickTheme(th, s.theme)} onClose={() => setThemeOpen(false)} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-28 md:px-10">
        {!current ? (
          <>
            {/* Hero */}
            <section className="grid gap-8 pb-14 pt-10 md:grid-cols-12 md:pt-20">
              <div className="md:col-span-7 animate-rise">
                <div className="text-[11px] uppercase tracking-[0.35em] text-fg-3">{l(s.title)}</div>
                <h1 className="mt-3 font-display text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.95] text-accent">{l(s.subtitle) || t('menu.eyebrow')}</h1>
              </div>
              <div className="flex items-end md:col-span-5 md:justify-end animate-rise" style={{ animationDelay: '120ms' }}>
                <p className="max-w-xs text-[12px] uppercase leading-relaxed tracking-[0.2em] text-fg-2 md:text-end">{l(s.tagline) || t('menu.eyebrow')}</p>
              </div>
            </section>

            <SearchBar value={query} onChange={setQuery} />

            {/* Quick jump to a menu */}
            <div className="mt-8 animate-rise" style={{ animationDelay: '260ms' }}>
              <div className="rule mb-4 text-[10px] uppercase tracking-[0.3em]"><span>{t('menu.quick')}</span></div>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => openCategory(c)} className="rounded-full border border-line bg-bg-2/60 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-fg-2 transition hover:border-accent hover:text-fg">{l(c.name)}</button>
                ))}
              </div>
            </div>

            {s.showNutrition && <LimitFilters value={limits} onChange={setLimits} className="mt-10" />}

            {searchResults ? (
              <>
                <div className="mt-12 flex items-center justify-between gap-4">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-fg-3">{searchResults.length} {t('menu.dishes')}</div>
                  <ViewToggle value={view} onChange={setView} />
                </div>
                <SearchGrid results={searchResults} onOpen={setOpen} showNutrition={s.showNutrition} view={view} />
              </>
            ) : (
              <>
                <div className="rule mt-14 mb-8 text-[10px] uppercase tracking-[0.3em]"><span>{t('menu.choose')}</span></div>
                <CategoryStrip categories={categories} counts={dishesByCat} onOpen={openCategory} />
                <div className="grid gap-6 sm:grid-cols-2 lg:hidden">
                  {categories.map((c, i) => (
                    <CategoryCard key={c.id} c={c} i={i} count={dishesByCat.get(c.id)?.length ?? 0} onOpen={() => openCategory(c)} />
                  ))}
                </div>
                {(l(s.philosophyTitle) || l(s.philosophyBody)) && (
                  <section className="mx-auto mt-24 max-w-2xl text-center">
                    <div className="font-display text-3xl italic text-accent md:text-4xl">{l(s.philosophyTitle)}</div>
                    <p className="mt-4 text-[15px] leading-relaxed text-fg-2">{l(s.philosophyBody)}</p>
                  </section>
                )}
              </>
            )}
          </>
        ) : (
          <CategoryView
            c={current}
            index={categories.findIndex((x) => x.id === current.id)}
            dishes={(searchResults ?? dishesByCat.get(current.id) ?? []).filter((d) => !searchResults || d.categoryId === current.id)}
            query={query} onQuery={setQuery}
            limits={limits} onLimits={setLimits}
            view={view} onView={setView}
            onBack={() => { setCatId(null); setQuery(''); }}
            onOpen={setOpen}
            showNutrition={s.showNutrition} showCore={s.showCoreComponents}
            siblings={categories} onSwitch={openCategory}
          />
        )}
      </main>

      <footer className="pb-10 text-center text-[10px] uppercase tracking-[0.3em] text-fg-3">{l(s.title)} · {lang === 'ar' ? 'تجربة طعام خاصة' : 'Private dining'}</footer>

      {open && <DishDetail dish={open} all={state.bundle.dishes} onClose={() => setOpen(null)} onPick={setOpen} showNutrition={s.showNutrition} showCore={s.showCoreComponents} />}
      {disclaimerFor && <Disclaimer category={disclaimerFor} onClose={() => setDisclaimerFor(null)} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-xs text-bg shadow-xl animate-rise">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="absolute -top-40 start-[-10%] h-[60vh] w-[60vw] rounded-full opacity-[0.18] blur-3xl" style={{ background: 'radial-gradient(closest-side, var(--t-accent), transparent)' }} />
      <div className="absolute bottom-[-20%] end-[-10%] h-[50vh] w-[50vw] rounded-full opacity-[0.10] blur-3xl" style={{ background: 'radial-gradient(closest-side, var(--t-accent), transparent)' }} />
    </div>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg text-fg animate-fade">
      <Monogram size={64} className="text-fg" />
      <div className="mt-6 h-px w-24 bg-line" />
    </div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto max-w-2xl animate-rise" style={{ animationDelay: '220ms' }}>
      <Search size={18} className="pointer-events-none absolute start-5 top-1/2 -translate-y-1/2 text-fg-3" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('menu.searchPlaceholder')}
        className="h-14 w-full rounded-full border border-line bg-bg-2/70 ps-13 pe-5 text-[15px] text-fg placeholder:text-fg-3 backdrop-blur focus:border-accent focus:outline-none" />
      {value && <button onClick={() => onChange('')} className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full px-2 text-fg-3 hover:text-fg">✕</button>}
    </div>
  );
}

function CategoryCard({ c, i, count, onOpen }: { c: Category; i: number; count: number; onOpen: () => void }) {
  const { l, t } = useI18n();
  const { ref, shown } = useReveal<HTMLButtonElement>();
  return (
    <button ref={ref} onClick={onOpen} className={cx('group relative overflow-hidden rounded-2xl border border-line bg-bg-2 text-start transition duration-700', shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')} style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Img src={c.image} alt={l(c.name)} className="h-full w-full transition duration-[1200ms] ease-out group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        <div className="absolute start-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/30 font-display text-sm text-white backdrop-blur">{String(i + 1).padStart(2, '0')}</div>
      </div>
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{String(i + 1).padStart(2, '0')} — {count} {t('menu.dishes')}</div>
        <h3 className="mt-2 font-display text-2xl leading-tight">{l(c.name)}</h3>
        {l(c.description) && <p className="mt-2 line-clamp-2 text-sm text-fg-2">{l(c.description)}</p>}
        <div className="mt-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-fg-2 group-hover:text-fg">
          {t('menu.explore')} <ArrowStart size={14} className="rotate-180 transition group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </div>
      </div>
    </button>
  );
}

/**
 * Desktop-only expanding strip: every category is a tall panel; the active one
 * widens and shows its copy, the others collapse to a vertical title. Hover or
 * focus previews, click opens. Mirrors the interaction guests liked on v1.
 */
function CategoryStrip({ categories, counts, onOpen }: { categories: Category[]; counts: Map<string, Dish[]>; onOpen: (c: Category) => void }) {
  const { l, t } = useI18n();
  const [active, setActive] = useState(0);
  const { ref, shown } = useReveal<HTMLDivElement>();
  if (categories.length < 2) return null;
  return (
    <div ref={ref} className={cx('hidden h-[520px] gap-3 lg:flex transition duration-700', shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}>
      {categories.map((c, i) => {
        const on = i === active;
        return (
          <button key={c.id} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => (on ? onOpen(c) : setActive(i))}
            className={cx('group relative overflow-hidden rounded-[1.75rem] border text-start transition-[flex,border-color] duration-700 ease-out-expo', on ? 'border-accent/40' : 'border-line hover:border-fg-3/40')}
            style={{ flex: on ? '4 1 0%' : '1 1 0%', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}>
            <Img src={c.image} alt="" className={cx('absolute inset-0 h-full w-full transition duration-[1400ms]', on ? 'scale-100 opacity-100' : 'scale-110 opacity-40 saturate-50')} />
            <div className={cx('absolute inset-0 transition duration-700', on ? 'bg-gradient-to-t from-black/85 via-black/30 to-black/10' : 'bg-black/55')} />
            {/* Number */}
            <div className="absolute start-5 top-5 font-display text-sm tracking-[0.3em] text-white/70">{String(i + 1).padStart(2, '0')}</div>
            {/* Collapsed vertical title */}
            <div className={cx('absolute inset-0 flex items-end justify-center pb-8 transition duration-500', on ? 'opacity-0' : 'opacity-100 delay-200')}>
              <span className="font-display text-2xl text-white [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">{l(c.name)}</span>
            </div>
            {/* Expanded copy */}
            <div className={cx('absolute inset-x-0 bottom-0 p-8 transition duration-500', on ? 'translate-y-0 opacity-100 delay-200' : 'translate-y-4 opacity-0')}>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold-2">{t('menu.eyebrow')} · {counts.get(c.id)?.length ?? 0} {t('menu.dishes')}</div>
              <h3 className="mt-2 font-display text-5xl leading-none text-white">{l(c.name)}</h3>
              {l(c.description) && <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">{l(c.description)}</p>}
              <span className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gold-2 px-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-black transition group-hover:bg-white">
                {t('menu.explore')} <ArrowStart size={14} className="rotate-180" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DishGrid({ dishes, onOpen, showNutrition, showCore, view }: { dishes: Dish[]; onOpen: (d: Dish) => void; showNutrition: boolean; showCore: boolean; view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="divide-y divide-line rounded-2xl border border-line bg-bg-2/50">
        {dishes.map((d, i) => <DishRow key={d.id} d={d} i={i} onOpen={() => onOpen(d)} showNutrition={showNutrition} />)}
      </div>
    );
  }
  if (view === 'compact') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {dishes.map((d, i) => <DishTile key={d.id} d={d} i={i} onOpen={() => onOpen(d)} showNutrition={showNutrition} />)}
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {dishes.map((d, i) => <DishCard key={d.id} d={d} i={i} onOpen={() => onOpen(d)} showNutrition={showNutrition} showCore={showCore} />)}
    </div>
  );
}

function SearchGrid({ results, onOpen, showNutrition, view }: { results: Dish[]; onOpen: (d: Dish) => void; showNutrition: boolean; view: ViewMode }) {
  const { t } = useI18n();
  if (!results.length) return <p className="mt-12 text-center text-sm text-fg-3">{t('menu.noResults')}</p>;
  return <div className="mt-6"><DishGrid dishes={results} onOpen={onOpen} showNutrition={showNutrition} showCore={false} view={view} /></div>;
}

function CategoryView({ c, index, dishes, query, onQuery, limits, onLimits, view, onView, onBack, onOpen, showNutrition, showCore, siblings, onSwitch }: {
  c: Category; index: number; dishes: Dish[]; query: string; onQuery: (q: string) => void; limits: Limits; onLimits: (l: Limits) => void;
  view: ViewMode; onView: (v: ViewMode) => void; onBack: () => void; onOpen: (d: Dish) => void;
  showNutrition: boolean; showCore: boolean; siblings: Category[]; onSwitch: (c: Category) => void;
}) {
  const { l, t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(hasLimits(limits));
  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8 pt-8 md:pt-14">
        <div>
          <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-fg-3 hover:text-fg"><ArrowStart size={14} />{t('menu.backToMenus')}</button>
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{String(index + 1).padStart(2, '0')} — {dishes.length} {t('menu.dishes')}</div>
          <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1]">{l(c.name)}</h1>
          {l(c.description) && <p className="mt-3 max-w-xl text-sm text-fg-2">{l(c.description)}</p>}
        </div>
        <div className="w-full md:w-80"><SearchBar value={query} onChange={onQuery} /></div>
      </div>

      {/* Category switcher + view controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {siblings.map((s) => (
            <button key={s.id} onClick={() => s.id !== c.id && onSwitch(s)} className={cx('shrink-0 rounded-full border px-4 py-2 text-xs transition', s.id === c.id ? 'border-accent bg-accent text-accent-fg' : 'border-line text-fg-2 hover:border-fg-3')}>{l(s.name)}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showNutrition && (
            <button onClick={() => setFiltersOpen((v) => !v)} className={cx('h-10 rounded-full border px-4 text-[11px] uppercase tracking-[0.18em] transition', filtersOpen || hasLimits(limits) ? 'border-accent text-accent' : 'border-line text-fg-2 hover:border-fg-3')}>
              {t('menu.filters')}{hasLimits(limits) ? ' •' : ''}
            </button>
          )}
          <ViewToggle value={view} onChange={onView} />
        </div>
      </div>
      {showNutrition && filtersOpen && <LimitFilters value={limits} onChange={onLimits} className="mb-10 rounded-2xl border border-line bg-bg-2/50 p-5" />}

      {dishes.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-3">{t('menu.noResults')}</p>
      ) : (
        <DishGrid dishes={dishes} onOpen={onOpen} showNutrition={showNutrition} showCore={showCore} view={view} />
      )}
    </div>
  );
}

/* Compact tile: photo-first, name + kcal only. */
function DishTile({ d, i, onOpen, showNutrition }: { d: Dish; i: number; onOpen: () => void; showNutrition: boolean }) {
  const { l, t } = useI18n();
  const { ref, shown } = useReveal<HTMLButtonElement>();
  return (
    <button ref={ref} onClick={onOpen} className={cx('group relative overflow-hidden rounded-2xl border border-line bg-bg-2 text-start transition duration-700', shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')} style={{ transitionDelay: `${(i % 5) * 60}ms` }}>
      <div className="relative aspect-square overflow-hidden bg-white">
        <Img src={d.image} alt={l(d.name)} className="h-full w-full transition duration-[1200ms] group-hover:scale-[1.04]" />
        <div className="absolute start-2.5 top-2.5 rounded-full bg-black/35 px-2 py-0.5 font-display text-[11px] text-white backdrop-blur">{String(i + 1).padStart(2, '0')}</div>
        {d.isFeatured && <div className="absolute end-2.5 top-2.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] text-accent-fg">★</div>}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 font-display text-base leading-tight">{l(d.name)}</div>
        {showNutrition && <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-fg-3"><span className="text-accent">{Math.round(d.nutrition.calories)}</span> {t('menu.kcal')}</div>}
      </div>
    </button>
  );
}

/* List row: thumbnail, name, one-line macros with a dotted leader. */
function DishRow({ d, i, onOpen, showNutrition }: { d: Dish; i: number; onOpen: () => void; showNutrition: boolean }) {
  const { l, t } = useI18n();
  const n = d.nutrition;
  return (
    <button onClick={onOpen} className="group flex w-full items-center gap-4 px-4 py-4 text-start transition hover:bg-bg-3/60 sm:gap-6 sm:px-6">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white sm:h-20 sm:w-20"><Img src={d.image} alt="" className="h-full w-full transition duration-700 group-hover:scale-105" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xs text-fg-3">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="truncate font-display text-xl leading-tight sm:text-2xl">{l(d.name)}</h3>
          <span className="hidden flex-1 border-b border-dotted border-line sm:block" />
          <Tags dish={d} className="hidden sm:flex" />
        </div>
        {showNutrition && (
          <div className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-fg-3">
            <span className="text-accent">{Math.round(n.calories)} {t('menu.kcal')}</span> · {Math.round(n.protein)}{t('menu.g')} {t('menu.protein')} · {Math.round(n.carbohydrates)}{t('menu.g')} {t('menu.carbs')} · {Math.round(n.fat)}{t('menu.g')} {t('menu.fat')}
          </div>
        )}
      </div>
      <ArrowStart size={16} className="shrink-0 rotate-180 text-fg-3 transition group-hover:text-fg" />
    </button>
  );
}

function DishCard({ d, i, onOpen, showNutrition, showCore }: { d: Dish; i: number; onOpen: () => void; showNutrition: boolean; showCore: boolean }) {
  const { l } = useI18n();
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <article ref={ref} className={cx('group overflow-hidden rounded-2xl border border-line bg-bg-2 transition duration-700', shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
      <button onClick={onOpen} className="block w-full text-start">
        <div className="relative aspect-square overflow-hidden bg-white">
          <Img src={d.image} alt={l(d.name)} className="h-full w-full transition duration-[1200ms] ease-out group-hover:scale-[1.03]" />
          <div className="absolute start-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 font-display text-sm text-white backdrop-blur">{String(i + 1).padStart(2, '0')}</div>
          <Tags dish={d} className="absolute end-4 top-4 justify-end" />
          {d.isFeatured && <div className="absolute bottom-4 start-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-fg">★</div>}
        </div>
        <div className="p-5">
          <h3 className="font-display text-2xl leading-tight">{l(d.name)}</h3>
          {l(d.description) && <p className="mt-2 line-clamp-2 text-sm text-fg-2">{l(d.description)}</p>}
          {showNutrition && <div className="mt-5 border-t border-line pt-4"><NutritionRow dish={d} compact /></div>}
          {showCore && d.coreComponents.length > 0 && <div className="mt-4 border-t border-line pt-4"><CoreRow dish={d} size="sm" /></div>}
        </div>
      </button>
    </article>
  );
}

/* ---------------------------------- Gate ----------------------------------- */
function Gate({ slug, error, title, logo, notFound, onRetry }: { slug: string; error?: string; title?: { en: string; ar: string }; logo?: string | null; notFound?: boolean; onRetry: () => void }) {
  const { t, l, toggle, lang } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    deviceToken.set(slug, code.trim());
    await onRetry();
    setBusy(false);
  };
  return (
    <div className="grain flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <Atmosphere />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-3xl border border-line bg-bg-2/80 p-8 text-center shadow-2xl backdrop-blur animate-rise">
        <button type="button" onClick={toggle} className="absolute end-4 top-4 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-3">{lang === 'ar' ? 'EN' : 'عربي'}</button>
        {logo ? <img src={imgSrc(logo)} alt="" className="mx-auto h-16 w-16 rounded-full object-cover" /> : <Monogram size={56} className="mx-auto text-fg" />}
        <div className="mt-3 text-[10px] uppercase tracking-[0.35em] text-fg-3">{title ? l(title) : t('app.name')}</div>
        {notFound ? (
          <p className="mt-8 text-sm text-fg-2">{t('gate.notFound')}</p>
        ) : (
          <>
            <div className="mx-auto mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"><Key size={20} /></div>
            <h1 className="mt-4 font-display text-2xl">{t('gate.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-2">{t('gate.body')}</p>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('gate.placeholder')} autoFocus inputMode="text" autoCapitalize="characters"
              className="mt-6 h-12 w-full rounded-xl border border-line bg-bg text-center text-lg tracking-[0.3em] text-fg placeholder:tracking-normal placeholder:text-fg-3 focus:border-accent focus:outline-none" />
            {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
            <button disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-semibold uppercase tracking-[0.2em] text-accent-fg disabled:opacity-60">{t('gate.unlock')}</button>
          </>
        )}
      </form>
    </div>
  );
}
