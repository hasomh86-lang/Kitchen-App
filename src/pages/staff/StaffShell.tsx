import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import type { Role } from '@shared/types';
import { can, useAuth } from '@/lib/auth';
import { useI18n, type StringKey } from '@/lib/i18n';
import { useWorkingMenu } from '@/lib/staff';
import { Globe, Monogram } from '@/components/icons';
import { cx } from '@/components/ui';

type Item = { href: string; key: StringKey; roles: Role[]; icon: string };
const NAV: Item[] = [
  { href: '/admin', key: 'nav.dashboard', roles: ['admin'], icon: '◎' },
  { href: '/admin/dishes', key: 'nav.dishes', roles: ['admin', 'sub-admin'], icon: '❖' },
  { href: '/admin/categories', key: 'nav.categories', roles: ['admin', 'sub-admin'], icon: '▤' },
  { href: '/butler', key: 'nav.butler', roles: ['admin', 'butler'], icon: '✦' },
  { href: '/chef', key: 'nav.chef', roles: ['admin', 'chef'], icon: '♨' },
  { href: '/admin/appearance', key: 'nav.settings', roles: ['admin', 'sub-admin'], icon: '◐' },
  { href: '/admin/devices', key: 'nav.devices', roles: ['admin'], icon: '▭' },
  { href: '/admin/menus', key: 'nav.menus', roles: ['admin'], icon: '☰' },
  { href: '/admin/users', key: 'nav.users', roles: ['admin'], icon: '☺' },
];

export function StaffShell({ children, title, actions }: { children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, toggle, lang } = useI18n();
  const { menus, menu, setMenuId } = useWorkingMenu();
  const [loc, nav] = useLocation();
  const items = NAV.filter((i) => can(user, ...i.roles));

  return (
    <div data-theme="console" className="flex min-h-dvh bg-bg text-fg">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-e border-line bg-bg-2 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Monogram size={30} className="text-fg" />
          <div className="text-[11px] uppercase tracking-[0.25em] text-fg-2">{t('app.name')}</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((i) => {
            const active = loc === i.href || (i.href !== '/admin' && loc.startsWith(i.href));
            return (
              <Link key={i.href} href={i.href} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', active ? 'bg-fg text-bg' : 'text-fg-2 hover:bg-bg-3 hover:text-fg')}>
                <span className="w-4 text-center text-base leading-none opacity-70">{i.icon}</span>{t(i.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-4 text-xs">
          <div className="truncate font-medium">{user?.firstName} {user?.lastName}</div>
          <div className="truncate text-fg-3">{user ? t(`role.${user.role}` as StringKey) : ''}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={toggle} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] text-fg-2"><Globe size={12} />{lang === 'ar' ? 'EN' : 'عربي'}</button>
            <button onClick={async () => { await logout(); nav('/login'); }} className="rounded-lg border border-line px-2 py-1 text-[11px] text-fg-2 hover:text-fg">{t('auth.signOut')}</button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg-2/85 px-4 py-3 backdrop-blur md:px-8">
          <Monogram size={26} className="text-fg md:hidden" />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold md:text-lg">{title}</h1>
          {menus.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-fg-3">
              <span className="hidden sm:inline">{t('nav.workingMenu')}</span>
              <select value={menu?.id ?? ''} onChange={(e) => setMenuId(e.target.value)} className="input h-9 w-auto max-w-[11rem] py-0 text-xs">
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          {menu && <a href={`/m/${menu.slug}`} target="_blank" rel="noreferrer" className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-fg-2 hover:text-fg sm:inline">{t('nav.viewMenu')} ↗</a>}
          {actions}
        </header>

        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-10">{children}</main>

        {/* Bottom tabs (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-bg-2/95 backdrop-blur md:hidden">
          {items.slice(0, 5).map((i) => {
            const active = loc === i.href || (i.href !== '/admin' && loc.startsWith(i.href));
            return (
              <Link key={i.href} href={i.href} className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]', active ? 'text-fg' : 'text-fg-3')}>
                <span className="text-lg leading-none">{i.icon}</span>{t(i.key)}
              </Link>
            );
          })}
          <button onClick={async () => { await logout(); nav('/login'); }} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-fg-3"><span className="text-lg leading-none">⏻</span>{t('auth.signOut')}</button>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-fg-3">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-bg-2 p-5', className)}>{children}</div>;
}
