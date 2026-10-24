import { useEffect, useMemo, useState } from 'react';
import type { Category, Dish, L10n } from '@shared/types';
import { CORE_COMPONENTS, SUITABLE_FOR, TAG_PALETTE, emptyL10n } from '@shared/types';
import { api, imgSrc } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAiStatus, useCatalog, useInvalidate, useWorkingMenu } from '@/lib/staff';
import { BilingualInput, ChipSelect, ImageField, L10nListEditor } from '@/components/forms';
import { Grip, Plus, Sparkle } from '@/components/icons';
import { Badge, Button, Confirm, Empty, Field, Input, Modal, Segmented, Switch, cx, useToast } from '@/components/ui';
import { PageHeader, StaffShell } from './StaffShell';

export default function DishesPage() {
  const { t, l } = useI18n();
  const { menu } = useWorkingMenu();
  const cat = useCatalog(menu?.id);
  const [editing, setEditing] = useState<Dish | 'new' | null>(null);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const categories = cat.data?.categories ?? [];
  const dishes = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (cat.data?.dishes ?? [])
      .filter((d) => filterCat === 'all' || d.categoryId === filterCat)
      .filter((d) => !qq || [d.name.en, d.name.ar].some((s) => s.toLowerCase().includes(qq)));
  }, [cat.data, filterCat, q]);

  return (
    <StaffShell title={t('nav.dishes')}>
      <PageHeader title={t('nav.dishes')} sub={menu ? `${cat.data?.dishes.length ?? 0} · ${menu.name}` : undefined}
        actions={<Button onClick={() => setEditing('new')} disabled={!categories.length}><Plus size={16} />{t('common.add')}</Button>} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="h-10 max-w-xs" />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button onClick={() => setFilterCat('all')} className={cx('shrink-0 rounded-full border px-3 py-1.5 text-xs', filterCat === 'all' ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2')}>{t('common.all')}</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className={cx('shrink-0 rounded-full border px-3 py-1.5 text-xs', filterCat === c.id ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2')}>{l(c.name)}</button>
          ))}
        </div>
        <Segmented className="ms-auto" value={view} onChange={setView} options={[{ value: 'grid', label: '▦' }, { value: 'list', label: '☰' }]} />
      </div>

      {!categories.length && !cat.isLoading && <Empty title={t('nav.categories')} body="Create a category first." />}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {dishes.map((d) => (
            <button key={d.id} onClick={() => setEditing(d)} className="group overflow-hidden rounded-2xl border border-line bg-bg-2 text-start transition hover:shadow-md">
              <div className="relative aspect-square bg-white">
                {d.image ? <img src={imgSrc(d.image)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-fg-3">{t('common.image')}</div>}
                {d.isHidden && <Badge className="absolute start-2 top-2">{t('common.hidden')}</Badge>}
                {d.isFeatured && <Badge tone="gold" className="absolute end-2 top-2">★</Badge>}
              </div>
              <div className="p-3">
                <div className="line-clamp-1 text-sm font-medium">{l(d.name)}</div>
                <div className="mt-0.5 text-[11px] text-fg-3">{Math.round(d.nutrition.calories)} kcal · {l(categories.find((c) => c.id === d.categoryId)?.name)}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <ListView dishes={dishes} categories={categories} menuId={menu!.id} onEdit={setEditing} />
      )}

      {editing && menu && (
        <DishEditor dish={editing === 'new' ? null : editing} categories={categories} allDishes={cat.data?.dishes ?? []} menuId={menu.id}
          defaultCategory={filterCat !== 'all' ? filterCat : categories[0]?.id} onClose={() => setEditing(null)} />
      )}
    </StaffShell>
  );
}

/* ------------------------- Sortable list (drag & drop) ---------------------- */
function ListView({ dishes, categories, menuId, onEdit }: { dishes: Dish[]; categories: Category[]; menuId: string; onEdit: (d: Dish) => void }) {
  const { l, t } = useI18n();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [order, setOrder] = useState(dishes);
  useEffect(() => setOrder(dishes), [dishes]);
  const [dragId, setDragId] = useState<string | null>(null);

  const drop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = order.findIndex((d) => d.id === dragId), to = order.findIndex((d) => d.id === targetId);
    const next = [...order]; const [m] = next.splice(from, 1); next.splice(to, 0, m);
    setOrder(next); setDragId(null);
    try { await api.post(`/api/catalog/menus/${menuId}/dishes/reorder`, { ids: next.map((d) => d.id) }); invalidate('catalog'); }
    catch (e: any) { toast.push(e.message, 'err'); setOrder(dishes); }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-bg-2">
      {order.map((d) => (
        <div key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(d.id)}
          className={cx('flex items-center gap-3 border-b border-line px-3 py-2 last:border-0', dragId === d.id && 'opacity-40')}>
          <Grip size={16} className="cursor-grab text-fg-3" />
          <div className="h-10 w-10 overflow-hidden rounded-lg bg-bg-3">{d.image && <img src={imgSrc(d.image)} alt="" className="h-full w-full object-cover" />}</div>
          <button onClick={() => onEdit(d)} className="min-w-0 flex-1 text-start">
            <div className="truncate text-sm font-medium">{l(d.name)}</div>
            <div className="text-[11px] text-fg-3">{l(categories.find((c) => c.id === d.categoryId)?.name)} · {Math.round(d.nutrition.calories)} kcal</div>
          </button>
          {d.isHidden && <Badge>{t('common.hidden')}</Badge>}
          {d.isFeatured && <Badge tone="gold">★</Badge>}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Editor ---------------------------------- */
function DishEditor({ dish, categories, allDishes, menuId, defaultCategory, onClose }: {
  dish: Dish | null; categories: Category[]; allDishes: Dish[]; menuId: string; defaultCategory?: string; onClose: () => void;
}) {
  const { t, l } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const ai = useAiStatus();
  const [f, setF] = useState<Omit<Dish, 'id' | 'menuId' | 'updatedAt' | 'sortOrder'>>(() => dish ?? {
    categoryId: defaultCategory ?? categories[0]?.id ?? '',
    name: emptyL10n(), description: emptyL10n(), extraInfo: emptyL10n(), image: null, angleImages: [],
    ingredients: [], sideDishes: [], nutrition: { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0 },
    suitableFor: [], coreComponents: [], tags: [], recommendedDishIds: [], isHidden: false, isFeatured: false,
  });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.name.en && !f.name.ar) return toast.push(t('common.name'), 'err');
    setBusy(true);
    try {
      if (dish) await api.patch(`/api/catalog/dishes/${dish.id}`, { ...f, expectedUpdatedAt: dish.updatedAt });
      else await api.post(`/api/catalog/menus/${menuId}/dishes`, f);
      invalidate('catalog'); toast.push(t('common.saved')); onClose();
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => { await api.del(`/api/catalog/dishes/${dish!.id}`); invalidate('catalog'); onClose(); };

  const aiDescribe = async () => {
    setAiBusy('describe');
    try {
      const r = await api.post<{ result: any }>('/api/ai/describe', { image: f.image, name: f.name.en || f.name.ar, ingredients: f.ingredients.map((i) => i.en || i.ar) });
      const x = r.result;
      setF((cur) => ({
        ...cur,
        name: { en: cur.name.en || x.name?.en || '', ar: cur.name.ar || x.name?.ar || '' },
        description: { en: cur.description.en || x.description?.en || '', ar: cur.description.ar || x.description?.ar || '' },
        ingredients: cur.ingredients.length ? cur.ingredients : (x.ingredients ?? []),
        nutrition: cur.nutrition.calories ? cur.nutrition : { ...cur.nutrition, ...(x.nutrition ?? {}) },
        suitableFor: cur.suitableFor.length ? cur.suitableFor : (x.suitableFor ?? []).filter((s: string) => SUITABLE_FOR.some((o) => o.id === s)),
        coreComponents: cur.coreComponents.length ? cur.coreComponents : (x.coreComponents ?? []).filter((s: string) => CORE_COMPONENTS.some((o) => o.id === s)),
      }));
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setAiBusy(null); }
  };
  const aiAngles = async () => {
    if (!f.image) return;
    setAiBusy('angles');
    try { const r = await api.post<{ images: string[] }>('/api/ai/angles', { image: f.image, menuId }); set('angleImages', r.images.map((x) => x.replace(/^\/img\//, ''))); }
    catch (e: any) { toast.push(e.message, 'err'); } finally { setAiBusy(null); }
  };

  const nutri: { k: keyof Dish['nutrition']; label: string }[] = [
    { k: 'calories', label: t('menu.cals') }, { k: 'protein', label: t('menu.protein') }, { k: 'fat', label: t('menu.fat') }, { k: 'carbs' as any, label: t('menu.carbs') }, { k: 'fiber', label: t('menu.fiber') },
  ].map((x) => (x.k === ('carbs' as any) ? { k: 'carbohydrates', label: x.label } : x)) as any;

  return (
    <Modal open onClose={onClose} wide title={dish ? l(dish.name) : t('common.add')} footer={
      <>
        {dish && <Button variant="danger" onClick={() => setDel(true)}>{t('common.delete')}</Button>}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={busy}>{t('common.save')}</Button>
      </>
    }>
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Left: media */}
        <div className="space-y-4">
          <ImageField value={f.image} onChange={(v) => set('image', v)} menuId={menuId} label={t('common.image')} aiPrompt={f.name.en || f.name.ar} />
          {ai.data?.enabled && f.image && (
            <Button type="button" size="sm" variant="gold" className="w-full" onClick={aiAngles} loading={aiBusy === 'angles'}><Sparkle size={12} /> 3 angles</Button>
          )}
          {f.angleImages.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {f.angleImages.map((im, i) => (
                <div key={im} className="group relative aspect-square overflow-hidden rounded-lg bg-bg-3">
                  <img src={imgSrc(im)} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => set('angleImages', f.angleImages.filter((_, j) => j !== i))} className="absolute end-1 top-1 hidden rounded bg-black/60 px-1 text-[10px] text-white group-hover:block">✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 rounded-xl border border-line p-3">
            <Switch checked={!f.isHidden} onChange={(v) => set('isHidden', !v)} label={t('common.visible')} />
            <Switch checked={f.isFeatured} onChange={(v) => set('isFeatured', v)} label={t('common.featured')} />
          </div>
          <Field label={t('nav.categories')}>
            <select className="input" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{l(c.name)}</option>)}
            </select>
          </Field>
        </div>

        {/* Right: content */}
        <div className="space-y-5">
          {ai.data?.enabled && (
            <Button type="button" size="sm" variant="gold" onClick={aiDescribe} loading={aiBusy === 'describe'}><Sparkle size={12} /> AI: fill name, description, ingredients & nutrition</Button>
          )}
          <BilingualInput label={t('common.name')} value={f.name} onChange={(v) => set('name', v)} />
          <BilingualInput label={t('common.description')} value={f.description} onChange={(v) => set('description', v)} multiline />

          <div>
            <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{t('menu.composition')}</div>
            <div className="grid grid-cols-5 gap-2">
              {nutri.map(({ k, label }: any) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[10px] uppercase tracking-wider text-fg-3">{label}</span>
                  <input type="number" inputMode="decimal" min={0} value={f.nutrition[k as keyof Dish['nutrition']]} onChange={(e) => set('nutrition', { ...f.nutrition, [k]: Number(e.target.value) })} className="input h-10 px-2 text-center" />
                </label>
              ))}
            </div>
          </div>

          <ChipSelect label={t('menu.coreComponents')} options={CORE_COMPONENTS} value={f.coreComponents} onChange={(v) => set('coreComponents', v)} />
          <ChipSelect label={t('menu.suitableFor')} options={SUITABLE_FOR} value={f.suitableFor} onChange={(v) => set('suitableFor', v)} />

          <L10nListEditor label={t('menu.ingredients')} value={f.ingredients} onChange={(v) => set('ingredients', v)} hint='"Chicken breast: 150g" — the amount after the colon is shown separately.' />
          <L10nListEditor label={t('menu.sides')} value={f.sideDishes} onChange={(v) => set('sideDishes', v)} />

          <TagsEditor value={f.tags} onChange={(v) => set('tags', v)} />

          <BilingualInput label={t('menu.extra')} value={f.extraInfo} onChange={(v) => set('extraInfo', v)} multiline />

          <div>
            <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{t('menu.recommended')}</div>
            <div className="flex flex-wrap gap-1.5">
              {allDishes.filter((d) => d.id !== dish?.id).map((d) => {
                const on = f.recommendedDishIds.includes(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => set('recommendedDishIds', on ? f.recommendedDishIds.filter((x) => x !== d.id) : [...f.recommendedDishIds, d.id].slice(0, 6))}
                    className={cx('rounded-full border px-2.5 py-1 text-[11px]', on ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2')}>{l(d.name)}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} onConfirm={remove} title={t('common.delete')} body={t('common.confirmDelete')} danger />
    </Modal>
  );
}

function TagsEditor({ value, onChange }: { value: Dish['tags']; onChange: (v: Dish['tags']) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-fg-2">Tags</span>
        {value.length < 4 && <button type="button" onClick={() => onChange([...value, { label: emptyL10n(), color: TAG_PALETTE[value.length % TAG_PALETTE.length] }])} className="text-xs text-accent">+ {t('common.add')}</button>}
      </div>
      <div className="space-y-2">
        {value.map((tag, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {TAG_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, color: c } : x)))} className={cx('h-5 w-5 rounded-full border-2', tag.color === c ? 'border-fg' : 'border-transparent')} style={{ background: c }} />
              ))}
            </div>
            <input dir="rtl" value={tag.label.ar} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: { ...x.label, ar: e.target.value } } : x)))} placeholder="عربي" className="input h-9 py-0 text-sm" />
            <input dir="ltr" value={tag.label.en} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x)))} placeholder="English" className="input h-9 py-0 text-sm" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg px-2 text-fg-3 hover:text-rose-600">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { L10n };
