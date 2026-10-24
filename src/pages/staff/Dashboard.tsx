import { Link } from 'wouter';
import { ORDER_STATUS } from '@shared/types';
import { fmtDate, useI18n } from '@/lib/i18n';
import { useCatalog, useDevices, useOrders, useWorkingMenu } from '@/lib/staff';
import { Badge } from '@/components/ui';
import { Card, PageHeader, StaffShell } from './StaffShell';

export default function Dashboard() {
  const { t, l, lang } = useI18n();
  const { menu } = useWorkingMenu();
  const cat = useCatalog(menu?.id);
  const orders = useOrders(menu?.id);
  const devices = useDevices(menu?.id);
  const dishes = cat.data?.dishes ?? [];
  const list = orders.data?.orders ?? [];
  const active = list.filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status));
  const noImage = dishes.filter((d) => !d.image && !d.isHidden).length;
  const noArabic = dishes.filter((d) => !d.name.ar && !d.isHidden).length;
  const week = list.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 7 * 864e5);
  const topDishes = Object.entries(week.flatMap((o) => o.items).reduce<Record<string, { n: number; name: any }>>((acc, it) => { acc[it.dishId] = { n: (acc[it.dishId]?.n ?? 0) + it.quantity, name: it.name }; return acc; }, {}))
    .sort((a, b) => b[1].n - a[1].n).slice(0, 5);

  const stat = (label: string, value: React.ReactNode, href?: string) => {
    const inner = <Card className="h-full"><div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div><div className="mt-1 font-display text-4xl">{value}</div></Card>;
    return href ? <Link href={href} className="block">{inner}</Link> : inner;
  };

  return (
    <StaffShell title={t('nav.dashboard')}>
      <PageHeader title={menu?.name ?? t('nav.dashboard')} sub={menu ? `${location.origin}/m/${menu.slug}` : undefined} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(t('nav.dishes'), dishes.filter((d) => !d.isHidden).length, '/admin/dishes')}
        {stat(t('nav.categories'), cat.data?.categories.length ?? 0, '/admin/categories')}
        {stat(t('order.active'), active.length, '/butler')}
        {stat(t('nav.devices'), devices.data?.devices.filter((d) => d.status === 'active').length ?? 0, '/admin/devices')}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 text-sm font-semibold">Content health</div>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-fg-2">Visible dishes without a photo</span><Badge tone={noImage ? 'amber' : 'green'}>{noImage}</Badge></li>
            <li className="flex justify-between"><span className="text-fg-2">Visible dishes missing Arabic name</span><Badge tone={noArabic ? 'amber' : 'green'}>{noArabic}</Badge></li>
            <li className="flex justify-between"><span className="text-fg-2">Hidden dishes</span><Badge>{dishes.filter((d) => d.isHidden).length}</Badge></li>
            <li className="flex justify-between"><span className="text-fg-2">Last content change</span><span className="text-xs text-fg-3">{fmtDate(menu?.contentUpdatedAt, lang)}</span></li>
          </ul>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-semibold">Orders this week</div>
          <div className="grid grid-cols-3 gap-2">
            {ORDER_STATUS.map((s) => { const n = week.filter((o) => o.status === s.id).length; return n ? <div key={s.id} className="rounded-xl bg-bg-3 p-2 text-center"><div className="font-display text-2xl">{n}</div><div className="text-[10px] text-fg-3">{l(s.label)}</div></div> : null; })}
            {week.length === 0 && <div className="col-span-3 text-xs text-fg-3">{t('order.empty')}</div>}
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm font-semibold">Most ordered (7 days)</div>
          <ol className="space-y-1.5 text-sm">
            {topDishes.map(([id, v], i) => <li key={id} className="flex justify-between"><span><span className="me-2 font-display text-fg-3">{i + 1}</span>{l(v.name)}</span><span className="text-fg-3">{v.n}×</span></li>)}
            {!topDishes.length && <li className="text-xs text-fg-3">—</li>}
          </ol>
        </Card>
      </div>
    </StaffShell>
  );
}
