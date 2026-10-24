import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Dish, PublicMenuBundle, ThemeId } from '@shared/types';
import { imgSrc } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { bundleCache, deviceToken, loadBundle } from '@/lib/menuCache';
import { ArrowStart, Globe, Key, Monogram, Search, Wifi } from '@/components/icons';
import { cx } from '@/components/ui';
import { DishDetail } from './DishDetail';
import { CoreRow, Disclaimer, Img, NutritionRow, Tags, useReveal } from './parts';

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

  const applyTheme = (theme: ThemeId) => { document.documentElement.dataset.theme = theme; };

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
  }, [slug, setLang, t]);

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
  const searchResults = useMemo(() => {
    if (!q || !bundle) return null;
    return bundle.dishes.filter((d) =>
      [d.name.en, d.name.ar, d.description.en, d.description.ar, ...d.ingredients.flatMap((i) => [i.en, i.ar]), ...d.tags.flatMap((x) => [x.label.en, x.label.ar])]
        .some((s) => s?.toLowerCase().includes(q)));
  }, [q, bundle]);

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

            {searchResults ? (
              <SearchGrid results={searchResults} onOpen={setOpen} showNutrition={s.showNutrition} />
            ) : (
              <>
                <div className="rule mt-14 mb-8 text-[10px] uppercase tracking-[0.3em]"><span>{t('menu.choose')}</span></div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

function SearchGrid({ results, onOpen, showNutrition }: { results: Dish[]; onOpen: (d: Dish) => void; showNutrition: boolean }) {
  const { t } = useI18n();
  if (!results.length) return <p className="mt-12 text-center text-sm text-fg-3">{t('menu.noResults')}</p>;
  return (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((d, i) => <DishCard key={d.id} d={d} i={i} onOpen={() => onOpen(d)} showNutrition={showNutrition} showCore={false} />)}
    </div>
  );
}

function CategoryView({ c, index, dishes, query, onQuery, onBack, onOpen, showNutrition, showCore, siblings, onSwitch }: {
  c: Category; index: number; dishes: Dish[]; query: string; onQuery: (q: string) => void; onBack: () => void; onOpen: (d: Dish) => void;
  showNutrition: boolean; showCore: boolean; siblings: Category[]; onSwitch: (c: Category) => void;
}) {
  const { l, t } = useI18n();
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

      {/* Category switcher */}
      <div className="mb-8 flex gap-2 overflow-x-auto no-scrollbar">
        {siblings.map((s) => (
          <button key={s.id} onClick={() => s.id !== c.id && onSwitch(s)} className={cx('shrink-0 rounded-full border px-4 py-2 text-xs transition', s.id === c.id ? 'border-accent bg-accent text-accent-fg' : 'border-line text-fg-2 hover:border-fg-3')}>{l(s.name)}</button>
        ))}
      </div>

      {dishes.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-3">{t('menu.noResults')}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {dishes.map((d, i) => <DishCard key={d.id} d={d} i={i} onOpen={() => onOpen(d)} showNutrition={showNutrition} showCore={showCore} />)}
        </div>
      )}
    </div>
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
