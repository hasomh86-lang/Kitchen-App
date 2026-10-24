import { useState } from 'react';
import { useLocation } from 'wouter';
import { api, ApiError } from '@/lib/api';
import { roleHome, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Monogram } from '@/components/icons';
import { Button, Field, Input } from '@/components/ui';

function Shell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const { toggle, lang } = useI18n();
  return (
    <div data-theme="console" className="flex min-h-dvh items-center justify-center bg-bg p-6 text-fg">
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-bg-2 p-8 shadow-xl animate-rise">
        <button type="button" onClick={toggle} className="absolute end-4 top-4 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-3">{lang === 'ar' ? 'EN' : 'عربي'}</button>
        <Monogram size={44} className="text-fg" />
        <h1 className="mt-5 font-display text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useI18n();
  const { refresh, needsSetup } = useAuth();
  const [, nav] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (needsSetup) { nav('/setup', { replace: true }); return null; }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api.post('/api/auth/login', { email, password });
      await refresh();
      const me = await api.get<{ user: { role: keyof typeof roleHome } | null }>('/api/auth/me');
      nav(me.user ? roleHome[me.user.role] : '/denied', { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : t('common.error')); } finally { setBusy(false); }
  };
  return (
    <Shell title={t('auth.staff')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('auth.email')}><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" /></Field>
        <Field label={t('auth.password')}><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.signIn')}</Button>
      </form>
    </Shell>
  );
}

export function Setup() {
  const { t } = useI18n();
  const { refresh, needsSetup, loading } = useAuth();
  const [, nav] = useLocation();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!loading && !needsSetup) { nav('/login', { replace: true }); return null; }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/api/auth/setup', f); await refresh(); nav('/admin', { replace: true }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : t('common.error')); } finally { setBusy(false); }
  };
  return (
    <Shell title={t('auth.setupTitle')} subtitle={t('auth.setupBody')}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.firstName')}><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label={t('auth.lastName')}><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        </div>
        <Field label={t('auth.email')}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required dir="ltr" /></Field>
        <Field label={t('auth.password')} hint="8+"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} dir="ltr" /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.create')}</Button>
      </form>
    </Shell>
  );
}

export function Denied() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const [, nav] = useLocation();
  return (
    <Shell title={t('role.pending')} subtitle={t('auth.denied')}>
      <Button variant="secondary" className="w-full" onClick={async () => { await logout(); nav('/login'); }}>{t('auth.signOut')}</Button>
    </Shell>
  );
}
