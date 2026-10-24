import { useEffect, useState } from 'react';
import type { Category } from '@shared/types';
import { emptyL10n } from '@shared/types';
import { api, imgSrc } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useCatalog, useInvalidate, useWorkingMenu } from '@/lib/staff';
import { BilingualInput, ImageField } from '@/components/forms';
import { Grip, Plus } from '@/components/icons';
import { Badge, Button, Confirm, Empty, Modal, Switch, cx, useToast } from '@/components/ui';
import { PageHeader, StaffShell } from './StaffShell';

export default function CategoriesPage() {
  const { t, l } = useI18n();
  const { menu } = useWorkingMenu();
  const cat = useCatalog(menu?.id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [order, setOrder] = useState<Category[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => setOrder(cat.data?.categories ?? []), [cat.data]);

  const drop = async (targetId: string) => {
    if (!dragId || dragId === targetId || !menu) return;
    const from = order.findIndex((d) => d.id === dragId), to = order.findIndex((d) => d.id === targetId);
    const next = [...order]; const [m] = next.splice(from, 1); next.splice(to, 0, m);
    setOrder(next); setDragId(null);
    try { await api.post(`/api/catalog/menus/${menu.id}/categories/reorder`, { ids: next.map((d) => d.id) }); invalidate('catalog'); }
    catch (e: any) { toast.push(e.message, 'err'); }
  };
  const count = (id: string) => cat.data?.dishes.filter((d) => d.categoryId === id).length ?? 0;

  return (
    <StaffShell title={t('nav.categories')}>
      <PageHeader title={t('nav.categories')} sub={menu?.name} actions={<Button onClick={() => setEditing('new')}><Plus size={16} />{t('common.add')}</Button>} />
      {order.length === 0 && !cat.isLoading && <Empty title={t('nav.categories')} action={<Button onClick={() => setEditing('new')}>{t('common.add')}</Button>} />}
      <div className="space-y-2">
        {order.map((c, i) => (
          <div key={c.id} draggable onDragStart={() => setDragId(c.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(c.id)}
            className={cx('flex items-center gap-3 rounded-2xl border border-line bg-bg-2 p-3', dragId === c.id && 'opacity-40')}>
            <Grip size={16} className="cursor-grab text-fg-3" />
            <span className="w-6 text-center font-display text-lg text-fg-3">{String(i + 1).padStart(2, '0')}</span>
            <div className="h-14 w-20 overflow-hidden rounded-xl bg-bg-3">{c.image && <img src={imgSrc(c.image)} alt="" className="h-full w-full object-cover" />}</div>
            <button onClick={() => setEditing(c)} className="min-w-0 flex-1 text-start">
              <div className="truncate font-medium">{l(c.name)}</div>
              <div className="truncate text-xs text-fg-3">{count(c.id)} {t('menu.dishes')}{l(c.description) ? ` · ${l(c.description)}` : ''}</div>
            </button>
            {c.disclaimerEnabled && <Badge tone="amber">!</Badge>}
            {c.isHidden && <Badge>{t('common.hidden')}</Badge>}
            <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>{t('common.edit')}</Button>
          </div>
        ))}
      </div>
      {editing && menu && <CategoryEditor cat={editing === 'new' ? null : editing} menuId={menu.id} dishCount={editing === 'new' ? 0 : count(editing.id)} onClose={() => setEditing(null)} />}
    </StaffShell>
  );
}

function CategoryEditor({ cat, menuId, dishCount, onClose }: { cat: Category | null; menuId: string; dishCount: number; onClose: () => void }) {
  const { t, l } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [f, setF] = useState(() => cat ?? { name: emptyL10n(), description: emptyL10n(), image: null as string | null, isHidden: false, disclaimerEnabled: false, disclaimerImage: null as string | null, disclaimerText: emptyL10n() });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      if (cat) await api.patch(`/api/catalog/categories/${cat.id}`, f);
      else await api.post(`/api/catalog/menus/${menuId}/categories`, f);
      invalidate('catalog'); toast.push(t('common.saved')); onClose();
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await api.del(`/api/catalog/categories/${cat!.id}${dishCount ? '?force=1' : ''}`); invalidate('catalog'); onClose(); }
    catch (e: any) { toast.push(e.message, 'err'); }
  };
  return (
    <Modal open onClose={onClose} wide title={cat ? l(cat.name) : t('common.add')} footer={
      <>
        {cat && <Button variant="danger" onClick={() => setDel(true)}>{t('common.delete')}</Button>}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={save} loading={busy}>{t('common.save')}</Button>
      </>
    }>
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <ImageField value={f.image} onChange={(v) => set('image', v)} menuId={menuId} label={t('common.image')} aspect="aspect-[4/3]" aiPrompt={`${f.name.en || f.name.ar} food category cover, overhead spread of several dishes`} />
          <Switch checked={!f.isHidden} onChange={(v) => set('isHidden', !v)} label={t('common.visible')} />
        </div>
        <div className="space-y-5">
          <BilingualInput label={t('common.name')} value={f.name} onChange={(v) => set('name', v)} />
          <BilingualInput label={t('common.description')} value={f.description} onChange={(v) => set('description', v)} multiline />
          <div className="rounded-2xl border border-line p-4">
            <Switch checked={f.disclaimerEnabled} onChange={(v) => set('disclaimerEnabled', v)} label="Disclaimer popup when guests open this category" />
            {f.disclaimerEnabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                <ImageField value={f.disclaimerImage} onChange={(v) => set('disclaimerImage', v)} menuId={menuId} aspect="aspect-[4/3]" />
                <BilingualInput value={f.disclaimerText} onChange={(v) => set('disclaimerText', v)} multiline />
              </div>
            )}
          </div>
        </div>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} onConfirm={remove} danger title={t('common.delete')}
        body={dishCount ? `${t('common.confirmDelete')} (${dishCount} ${t('menu.dishes')})` : t('common.confirmDelete')} />
    </Modal>
  );
}
