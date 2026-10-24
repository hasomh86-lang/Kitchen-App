import { lazy, Suspense, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import type { Role } from '@shared/types';
import { can, roleHome, useAuth } from '@/lib/auth';
import { WorkingMenuProvider } from '@/lib/staff';
import { Monogram } from '@/components/icons';
import { Denied, Login, Setup } from '@/pages/auth/AuthPages';

const PublicMenu = lazy(() => import('@/pages/public/PublicMenu'));
const Dashboard = lazy(() => import('@/pages/staff/Dashboard'));
const Dishes = lazy(() => import('@/pages/staff/Dishes'));
const Categories = lazy(() => import('@/pages/staff/Categories'));
const Menus = lazy(() => import('@/pages/staff/Menus'));
const Users = lazy(() => import('@/pages/staff/Users'));
const Devices = lazy(() => import('@/pages/staff/Devices'));
const Appearance = lazy(() => import('@/pages/staff/Appearance'));
const Butler = lazy(() => import('@/pages/staff/Orders').then((m) => ({ default: m.ButlerPage })));
const Chef = lazy(() => import('@/pages/staff/Orders').then((m) => ({ default: m.ChefPage })));

const DEFAULT_SLUG = 'main-menu';

function Loading() {
  return <div className="flex min-h-dvh items-center justify-center bg-bg text-fg"><Monogram size={48} className="animate-pulse" /></div>;
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading, needsSetup } = useAuth();
  const [loc] = useLocation();
  if (loading) return <Loading />;
  if (needsSetup) return <Redirect to="/setup" replace />;
  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(loc)}`} replace />;
  if (!can(user, ...roles)) return <Redirect to={user.role === 'pending' ? '/denied' : roleHome[user.role]} replace />;
  return <WorkingMenuProvider>{children}</WorkingMenuProvider>;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Switch>
        <Route path="/"><Redirect to={`/m/${DEFAULT_SLUG}`} replace /></Route>
        <Route path="/m/:slug">{(p) => <PublicMenu slug={p.slug} />}</Route>
        {/* legacy links from the old app */}
        <Route path="/menu/:slug">{(p) => <Redirect to={`/m/${p.slug}`} replace />}</Route>
        <Route path="/menu"><Redirect to={`/m/${DEFAULT_SLUG}`} replace /></Route>

        <Route path="/login" component={Login} />
        <Route path="/setup" component={Setup} />
        <Route path="/denied" component={Denied} />

        <Route path="/admin"><Protected roles={['admin']}><Dashboard /></Protected></Route>
        <Route path="/admin/dishes"><Protected roles={['admin', 'sub-admin']}><Dishes /></Protected></Route>
        <Route path="/admin/categories"><Protected roles={['admin', 'sub-admin']}><Categories /></Protected></Route>
        <Route path="/admin/appearance"><Protected roles={['admin', 'sub-admin']}><Appearance /></Protected></Route>
        <Route path="/admin/menus"><Protected roles={['admin']}><Menus /></Protected></Route>
        <Route path="/admin/users"><Protected roles={['admin']}><Users /></Protected></Route>
        <Route path="/admin/devices"><Protected roles={['admin']}><Devices /></Protected></Route>
        <Route path="/butler"><Protected roles={['admin', 'butler']}><Butler /></Protected></Route>
        <Route path="/chef"><Protected roles={['admin', 'chef']}><Chef /></Protected></Route>

        <Route><NotFound /></Route>
      </Switch>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div data-theme="console" className="flex min-h-dvh flex-col items-center justify-center bg-bg text-fg">
      <Monogram size={48} />
      <div className="mt-4 font-display text-3xl">404</div>
      <a href="/" className="mt-2 text-sm text-accent underline">Home</a>
    </div>
  );
}
