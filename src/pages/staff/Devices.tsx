import { useState } from 'react';
import type { Device } from '@shared/types';
import { api } from '@/lib/api';
import { fmtDate, useI18n } from '@/lib/i18n';
import { useDevices, useInvalidate, useWorkingMenu } from '@/lib/staff';
import { Key, Plus } from '@/components/icons';
import { Badge, Button, Confirm, Empty, Field, Input, Modal, Switch, useToast } from '@/components/ui';
import { Card, PageHeader, StaffShell } from './StaffShell';

export default function DevicesPage() {
  const { t, lang } = useI18n();
  const { menu } = useWorkingMenu();
  const devices = useDevices(menu?.id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState<{ name: string; token: string } | null>(null);
  const [del, setDel] = useState<Device | null>(null);

  const setOpen = async (v: boolean) => {
    if (!menu) return;
    try { await api.patch(`/api/admin/menus/${menu.id}`, { settings: { openAccess: v } }); invalidate('menus'); }
    catch (e: any) { toast.push(e.message, 'err'); }
  };
  const act = async (d: Device, body: any) => {
    try {
      const r = await api.patch<{ device: Device; token?: string }>(`/api/admin/devices/${d.id}`, body);
      invalidate('devices');
      if (r.token) setShown({ name: d.name, token: r.token });
    } catch (e: any) { toast.push(e.message, 'err'); }
  };

  return (
    <StaffShell title={t('nav.devices')}>
      <PageHeader title={t('nav.devices')} sub={menu?.name} actions={<Button onClick={() => setAdding(true)} disabled={!menu}><Plus size={16} />{t('common.add')}</Button>} />
      {menu && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Open access</div>
            <div className="text-xs text-fg-3">When on, anyone with the link can view this menu — no device code needed.</div>
          </div>
          <Switch checked={menu.settings.openAccess} onChange={setOpen} />
        </Card>
      )}
      {devices.data?.devices.length === 0 && <Empty title={t('common.none')} body="Register the iPads / screens that may show this menu. Each gets its own access code." />}
      <div className="grid gap-3 md:grid-cols-2">
        {(devices.data?.devices ?? []).map((d) => (
          <Card key={d.id} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-3 text-fg-2"><Key size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">{d.name || 'Device'} {d.status === 'revoked' && <Badge tone="rose">revoked</Badge>}</div>
                <div className="text-xs text-fg-3">{[d.building, d.location].filter(Boolean).join(' · ')}</div>
                <div className="mt-1 text-[11px] text-fg-3" dir="ltr">code ••••{d.tokenPreview} · last seen {d.lastSeenAt ? fmtDate(d.lastSeenAt, lang) : '—'}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => act(d, { rotateToken: true })}>New code</Button>
              <Button size="sm" variant="ghost" onClick={() => act(d, { status: d.status === 'active' ? 'revoked' : 'active' })}>{d.status === 'active' ? 'Revoke' : 'Restore'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setDel(d)}>{t('common.delete')}</Button>
            </div>
          </Card>
        ))}
      </div>

      {adding && menu && <AddDevice menuId={menu.id} onClose={() => setAdding(false)} onCreated={(name, token) => setShown({ name, token })} />}
      <Modal open={!!shown} onClose={() => setShown(null)} title={shown?.name}>
        <p className="text-sm text-fg-2">Enter this code on the device. It is shown only once — write it down.</p>
        <div className="mt-4 rounded-2xl bg-bg-3 py-6 text-center font-display text-4xl tracking-[0.3em]" dir="ltr">{shown?.token}</div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title={t('common.delete')} body={t('common.confirmDelete')} onConfirm={async () => { await api.del(`/api/admin/devices/${del!.id}`); invalidate('devices'); }} />
    </StaffShell>
  );
}

function AddDevice({ menuId, onClose, onCreated }: { menuId: string; onClose: () => void; onCreated: (name: string, token: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [f, setF] = useState({ name: '', building: '', location: '', token: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ device: Device; token: string }>(`/api/admin/menus/${menuId}/devices`, { ...f, token: f.token || undefined });
      invalidate('devices'); onClose(); onCreated(f.name || 'Device', r.token);
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('common.add')} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('common.name')}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dining room iPad" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Building"><Input value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })} /></Field>
          <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        </div>
        <Field label={`Access code (${t('common.optional')})`} hint="Leave empty to generate a random 8-character code."><Input dir="ltr" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} placeholder="e.g. 482915" /></Field>
      </div>
    </Modal>
  );
}
