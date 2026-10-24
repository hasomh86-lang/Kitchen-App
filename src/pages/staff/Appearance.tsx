import { useEffect, useState } from 'react';
import type { MenuSettings } from '@shared/types';
import { THEMES } from '@shared/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useInvalidate, useWorkingMenu } from '@/lib/staff';
import { BilingualInput, ImageField } from '@/components/forms';
import { Button, Segmented, Switch, cx, useToast } from '@/components/ui';
import { Card, PageHeader, StaffShell } from './StaffShell';

export default function AppearancePage() {
  const { t, l } = useI18n();
  const { menu } = useWorkingMenu();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [s, setS] = useState<MenuSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(menu?.settings ?? null), [menu?.id, menu?.settings]);
  if (!menu || !s) return <StaffShell title={t('nav.settings')}><div className="text-sm text-fg-3">{t('common.loading')}</div></StaffShell>;
  const set = <K extends keyof MenuSettings>(k: K, v: MenuSettings[K]) => setS({ ...s, [k]: v });
  const save = async () => {
    setBusy(true);
    try { await api.patch(`/api/admin/menus/${menu.id}`, { settings: s }); invalidate('menus'); toast.push(t('common.saved')); }
    catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); }
  };
  const dirty = JSON.stringify(s) !== JSON.stringify(menu.settings);

  return (
    <StaffShell title={t('nav.settings')} actions={<Button onClick={save} loading={busy} disabled={!dirty}>{t('common.save')}</Button>}>
      <PageHeader title={t('nav.settings')} sub={menu.name} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium tracking-wide text-fg-2">Theme</div>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((th) => (
                <button key={th.id} type="button" onClick={() => set('theme', th.id)} data-theme={th.id} className={cx('overflow-hidden rounded-xl border-2 bg-bg p-3 text-start', s.theme === th.id ? 'border-accent' : 'border-transparent ring-1 ring-line')}>
                  <div className="font-display text-xl text-accent">Aa</div>
                  <div className="mt-1 text-[11px] text-fg-2">{l(th.label)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="mb-2 text-xs font-medium tracking-wide text-fg-2">Default language</div>
              <Segmented value={s.defaultLang} onChange={(v) => set('defaultLang', v)} options={[{ value: 'ar', label: 'عربي' }, { value: 'en', label: 'English' }]} />
            </div>
            <Switch checked={s.showNutrition} onChange={(v) => set('showNutrition', v)} label="Show nutrition" />
            <Switch checked={s.showCoreComponents} onChange={(v) => set('showCoreComponents', v)} label="Show core components" />
          </div>
          <ImageField label="Logo (optional, replaces the monogram)" value={s.logoImage} onChange={(v) => set('logoImage', v)} menuId={menu.id} aspect="aspect-square w-32" />
        </Card>
        <Card className="space-y-5">
          <BilingualInput label="Brand name (eyebrow)" value={s.title} onChange={(v) => set('title', v)} />
          <BilingualInput label="Headline" value={s.subtitle} onChange={(v) => set('subtitle', v)} />
          <BilingualInput label="Tagline" value={s.tagline} onChange={(v) => set('tagline', v)} multiline />
          <BilingualInput label="Philosophy title" value={s.philosophyTitle} onChange={(v) => set('philosophyTitle', v)} />
          <BilingualInput label="Philosophy text" value={s.philosophyBody} onChange={(v) => set('philosophyBody', v)} multiline />
        </Card>
      </div>
    </StaffShell>
  );
}
