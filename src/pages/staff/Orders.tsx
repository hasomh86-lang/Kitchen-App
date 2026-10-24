import { useMemo, useState } from 'react';
import type { Dish, Order, OrderItem, OrderStatus } from '@shared/types';
import { ORDER_STATUS, TRANSITIONS } from '@shared/types';
import { api, imgSrc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useI18n } from '@/lib/i18n';
import { useCatalog, useInvalidate, useOrders, useWorkingMenu } from '@/lib/staff';
import { Plus } from '@/components/icons';
import { Badge, Button, Confirm, Empty, Field, Input, Modal, Segmented, Textarea, cx, useToast } from '@/components/ui';
import { PageHeader, StaffShell } from './StaffShell';

const statusMeta = (s: OrderStatus) => ORDER_STATUS.find((x) => x.id === s)!;
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  submitted: 'order.submit', preparing: 'order.startPreparing', ready: 'order.markReady', rejected: 'order.reject',
  out_for_delivery: 'order.outForDelivery', delivered: 'order.delivered', completed: 'order.complete', cancelled: 'order.cancel',
};

/* ================================ BUTLER ================================= */
export function ButlerPage() {
  const { t } = useI18n();
  const { menu } = useWorkingMenu();
  const [scope, setScope] = useState<'active' | 'closed'>('active');
  const orders = useOrders(menu?.id, scope);
  const [composing, setComposing] = useState<Order | 'new' | null>(null);
  const list = orders.data?.orders ?? [];
  const grouped = useMemo(() => {
    const g = new Map<OrderStatus, Order[]>();
    for (const o of list) g.set(o.status, [...(g.get(o.status) ?? []), o]);
    return g;
  }, [list]);
  const cols: OrderStatus[] = scope === 'active' ? ['draft', 'submitted', 'preparing', 'ready', 'out_for_delivery', 'delivered'] : ['completed', 'cancelled', 'rejected'];

  return (
    <StaffShell title={t('nav.butler')} actions={<LiveDot ok={!orders.isError} />}>
      <PageHeader title={t('nav.orders')} sub={menu?.name} actions={
        <>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'active', label: t('order.active') }, { value: 'closed', label: t('order.closed') }]} />
          <Button onClick={() => setComposing('new')} disabled={!menu}><Plus size={16} />{t('order.new')}</Button>
        </>
      } />
      {list.length === 0 && !orders.isLoading ? <Empty title={t('order.empty')} action={scope === 'active' && <Button onClick={() => setComposing('new')}>{t('order.new')}</Button>} /> : (
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {cols.filter((c) => grouped.get(c)?.length).map((c) => (
            <div key={c} className="w-[320px] shrink-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-fg-3"><Badge tone={statusMeta(c).tone}>{useLabel(statusMeta(c).label)}</Badge><span>{grouped.get(c)!.length}</span></div>
              <div className="space-y-3">{grouped.get(c)!.map((o) => <OrderCard key={o.id} o={o} mode="butler" onEdit={() => setComposing(o)} />)}</div>
            </div>
          ))}
        </div>
      )}
      {composing && menu && <OrderComposer menuId={menu.id} order={composing === 'new' ? null : composing} onClose={() => setComposing(null)} />}
    </StaffShell>
  );
}

function useLabel(l: { en: string; ar: string }) { const { l: pick } = useI18n(); return pick(l); }

/* ================================= CHEF ================================== */
export function ChefPage() {
  const { t } = useI18n();
  const { menu } = useWorkingMenu();
  const orders = useOrders(menu?.id);
  const list = (orders.data?.orders ?? []).filter((o) => ['submitted', 'preparing'].includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recent = (orders.data?.orders ?? []).filter((o) => ['ready', 'rejected'].includes(o.status));
  return (
    <StaffShell title={t('nav.chef')} actions={<LiveDot ok={!orders.isError} />}>
      <PageHeader title={t('nav.chef')} sub={`${list.length} · ${menu?.name ?? ''}`} />
      {list.length === 0 && !orders.isLoading ? <Empty title={t('order.queueEmpty')} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((o) => <OrderCard key={o.id} o={o} mode="chef" big />)}</div>
      )}
      {recent.length > 0 && (
        <>
          <div className="rule mt-10 mb-4 text-[10px] uppercase tracking-[0.25em]"><span>{t('order.history')}</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 opacity-70">{recent.map((o) => <OrderCard key={o.id} o={o} mode="chef" />)}</div>
        </>
      )}
    </StaffShell>
  );
}

function LiveDot({ ok }: { ok: boolean }) {
  const { t } = useI18n();
  return <span className="flex items-center gap-1.5 text-[11px] text-fg-3"><span className={cx('h-2 w-2 rounded-full', ok ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />{t('order.live')}</span>;
}

/* ============================== ORDER CARD =============================== */
function OrderCard({ o, mode, big, onEdit }: { o: Order; mode: 'butler' | 'chef'; big?: boolean; onEdit?: () => void }) {
  const { t, l, lang } = useI18n();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const [del, setDel] = useState(false);
  const meta = statusMeta(o.status);
  const actions = (TRANSITIONS[o.status] ?? []).filter((tr) => user && (user.role === 'admin' || tr.roles.includes(user.role)));
  const go = async (to: OrderStatus) => {
    setBusy(to);
    try { await api.post(`/api/orders/orders/${o.id}/transition`, { to }); invalidate('orders'); }
    catch (e: any) { toast.push(e.message, 'err'); invalidate('orders'); } finally { setBusy(null); }
  };
  const destructive = (s: OrderStatus) => s === 'cancelled' || s === 'rejected';
  const total = o.items.reduce((n, i) => n + i.quantity, 0);
  const ageMin = Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000);

  return (
    <article className={cx('rounded-2xl border bg-bg-2 p-4', o.status === 'submitted' && mode === 'chef' ? 'border-amber-400/60 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]' : 'border-line')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-2xl leading-none">#{o.number}</div>
          <div className="mt-1 text-sm font-medium">{o.customerName}</div>
          {mode === 'butler' && o.customerContact && <div className="text-xs text-fg-3" dir="ltr">{o.customerContact}</div>}
        </div>
        <div className="text-end">
          <Badge tone={meta.tone}>{l(meta.label)}</Badge>
          <div className="mt-1 text-[11px] text-fg-3">{ageMin < 60 ? `${ageMin}m` : fmtDate(o.createdAt, lang, { timeStyle: 'short' })}</div>
        </div>
      </div>
      {o.deliveryAt && <div className="mt-2 rounded-lg bg-bg-3 px-2.5 py-1.5 text-xs"><span className="text-fg-3">{t('order.deliveryAt')}: </span>{fmtDate(o.deliveryAt, lang)}</div>}

      <ul className={cx('mt-3 space-y-1.5 border-t border-line pt-3', big ? 'text-base' : 'text-sm')}>
        {o.items.map((it, i) => (
          <li key={i}>
            <div className="flex items-start gap-2"><span className="w-7 shrink-0 font-display text-lg leading-tight text-accent">{it.quantity}×</span><span className="leading-tight">{l(it.name)}</span></div>
            {it.notes && <div className="ms-9 text-xs text-amber-700">↳ {it.notes}</div>}
          </li>
        ))}
      </ul>
      {o.specialInstructions && <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed">{o.specialInstructions}</div>}
      {mode === 'butler' && o.internalNotes && <div className="mt-2 rounded-lg bg-bg-3 px-3 py-2 text-xs text-fg-2"><span className="text-fg-3">{t('order.internal')}: </span>{o.internalNotes}</div>}

      <div className="mt-3 flex items-center justify-between text-[11px] text-fg-3">
        <span>{total} {t('order.items')}</span>
        <span>{o.events.at(-1)?.by}</span>
      </div>

      {(actions.length > 0 || onEdit) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.filter((a) => !destructive(a.to)).map((a) => (
            <Button key={a.to} size={big ? 'lg' : 'sm'} className={big ? 'flex-1' : ''} loading={busy === a.to} onClick={() => go(a.to)}>{t(ACTION_LABEL[a.to] as any)}</Button>
          ))}
          {onEdit && ['draft', 'submitted'].includes(o.status) && <Button size="sm" variant="secondary" onClick={onEdit}>{t('common.edit')}</Button>}
          {actions.filter((a) => destructive(a.to)).map((a) => (
            <Button key={a.to} size="sm" variant="ghost" className="text-rose-600" loading={busy === a.to} onClick={() => setConfirm(a.to)}>{t(ACTION_LABEL[a.to] as any)}</Button>
          ))}
          {mode === 'butler' && ['completed', 'cancelled', 'rejected', 'draft'].includes(o.status) && <Button size="sm" variant="ghost" onClick={() => setDel(true)}>{t('common.delete')}</Button>}
        </div>
      )}
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title={confirm ? t(ACTION_LABEL[confirm] as any) : ''} body={`#${o.number} — ${o.customerName}`} onConfirm={() => go(confirm!)} />
      <Confirm open={del} onClose={() => setDel(false)} danger title={t('common.delete')} body={t('common.confirmDelete')} onConfirm={async () => { await api.del(`/api/orders/orders/${o.id}`); invalidate('orders'); }} />
    </article>
  );
}

/* ============================ ORDER COMPOSER ============================= */
function OrderComposer({ menuId, order, onClose }: { menuId: string; order: Order | null; onClose: () => void }) {
  const { t, l } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const cat = useCatalog(menuId);
  const [f, setF] = useState({
    customerName: order?.customerName ?? '', customerContact: order?.customerContact ?? '',
    deliveryAt: order?.deliveryAt ? toLocalInput(order.deliveryAt) : '', specialInstructions: order?.specialInstructions ?? '', internalNotes: order?.internalNotes ?? '',
    items: (order?.items ?? []) as OrderItem[],
  });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const dishes = (cat.data?.dishes ?? []).filter((d) => !d.isHidden);
  const qq = q.trim().toLowerCase();
  const picks = qq ? dishes.filter((d) => [d.name.en, d.name.ar].some((s) => s.toLowerCase().includes(qq))) : dishes;

  const add = (d: Dish) => setF((x) => {
    const i = x.items.findIndex((it) => it.dishId === d.id);
    if (i >= 0) return { ...x, items: x.items.map((it, j) => (j === i ? { ...it, quantity: it.quantity + 1 } : it)) };
    return { ...x, items: [...x.items, { dishId: d.id, name: d.name, quantity: 1, notes: '' }] };
  });
  const upd = (i: number, patch: Partial<OrderItem>) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)).filter((it) => it.quantity > 0) }));

  const save = async (status: 'draft' | 'submitted') => {
    if (!f.customerName.trim()) return toast.push(t('order.customer'), 'err');
    if (!f.items.length) return toast.push(t('order.addDish'), 'err');
    setBusy(status === 'draft' ? 'draft' : 'submit');
    const body = { ...f, deliveryAt: f.deliveryAt ? new Date(f.deliveryAt).toISOString() : null };
    try {
      if (order) {
        await api.patch(`/api/orders/orders/${order.id}`, body);
        if (status === 'submitted' && order.status === 'draft') await api.post(`/api/orders/orders/${order.id}/transition`, { to: 'submitted' });
      } else {
        await api.post(`/api/orders/menus/${menuId}/orders`, { ...body, status });
      }
      invalidate('orders'); toast.push(t('common.saved')); onClose();
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} wide title={order ? `#${order.number} — ${order.customerName}` : t('order.new')} footer={
      <>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        {(!order || order.status === 'draft') && <Button variant="secondary" loading={busy === 'draft'} onClick={() => save('draft')}>{t('order.saveDraft')}</Button>}
        <Button loading={busy === 'submit'} onClick={() => save('submitted')}>{order?.status === 'submitted' ? t('common.save') : t('order.submit')}</Button>
      </>
    }>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('order.customer')}><Input value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} autoFocus /></Field>
            <Field label={t('order.contact')}><Input dir="ltr" value={f.customerContact} onChange={(e) => setF({ ...f, customerContact: e.target.value })} /></Field>
          </div>
          <Field label={t('order.deliveryAt')}><Input type="datetime-local" dir="ltr" value={f.deliveryAt} onChange={(e) => setF({ ...f, deliveryAt: e.target.value })} /></Field>
          <Field label={t('order.instructions')}><Textarea value={f.specialInstructions} onChange={(e) => setF({ ...f, specialInstructions: e.target.value })} /></Field>
          <Field label={t('order.internal')}><Textarea value={f.internalNotes} onChange={(e) => setF({ ...f, internalNotes: e.target.value })} /></Field>

          <div>
            <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{t('order.items')} ({f.items.reduce((n, i) => n + i.quantity, 0)})</div>
            {f.items.length === 0 && <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-fg-3">{t('order.addDish')} →</div>}
            <div className="space-y-2">
              {f.items.map((it, i) => (
                <div key={it.dishId} className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium">{l(it.name)}</span>
                    <div className="flex items-center rounded-lg border border-line">
                      <button onClick={() => upd(i, { quantity: it.quantity - 1 })} className="px-2.5 py-1 text-fg-2">−</button>
                      <span className="w-6 text-center text-sm">{it.quantity}</span>
                      <button onClick={() => upd(i, { quantity: it.quantity + 1 })} className="px-2.5 py-1 text-fg-2">+</button>
                    </div>
                  </div>
                  <input value={it.notes} onChange={(e) => upd(i, { notes: e.target.value })} placeholder={t('order.notes')} className="input mt-2 h-8 py-0 text-xs" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pe-1 sm:grid-cols-3">
            {picks.map((d) => (
              <button key={d.id} onClick={() => add(d)} className="overflow-hidden rounded-xl border border-line bg-bg text-start transition hover:border-fg-3 active:scale-[0.98]">
                <div className="aspect-square bg-white">{d.image && <img src={imgSrc(d.image)} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                <div className="p-2 text-xs leading-tight">{l(d.name)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
