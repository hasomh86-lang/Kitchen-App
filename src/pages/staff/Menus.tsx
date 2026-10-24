import { useState } from 'react';
import type { Client, Menu } from '@shared/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useClients, useInvalidate, useWorkingMenu } from '@/lib/staff';
import { Plus } from '@/components/icons';
import { Badge, Button, Confirm, Field, Input, Modal, useToast } from '@/components/ui';
import { Card, PageHeader, StaffShell } from './StaffShell';

export default function MenusPage() {
  const { t } = useI18n();
  const clients = useClients();
  const { menus } = useWorkingMenu();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [newClient, setNewClient] = useState(false);
  const [newMenuFor, setNewMenuFor] = useState<Client | null>(null);
  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [delMenu, setDelMenu] = useState<Menu | null>(null);
  const [delClient, setDelClient] = useState<Client | null>(null);

  const toggleClient = async (c: Client) => {
    try { await api.patch(`/api/admin/clients/${c.id}`, { status: c.status === 'active' ? 'inactive' : 'active' }); invalidate('clients', 'menus'); }
    catch (e: any) { toast.push(e.message, 'err'); }
  };
  const toggleMenu = async (m: Menu) => {
    try { await api.patch(`/api/admin/menus/${m.id}`, { status: m.status === 'active' ? 'inactive' : 'active' }); invalidate('menus'); }
    catch (e: any) { toast.push(e.message, 'err'); }
  };

  return (
    <StaffShell title={t('nav.menus')}>
      <PageHeader title={t('nav.menus')} sub="Each client can have several menus. Every menu has its own public link, devices, and appearance."
        actions={<Button onClick={() => setNewClient(true)}><Plus size={16} /> Client</Button>} />
      <div className="space-y-4">
        {(clients.data?.clients ?? []).map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-lg font-semibold">{c.name} {c.status !== 'active' && <Badge>inactive</Badge>}</div>
                <div className="text-xs text-fg-3">/{c.slug}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setNewMenuFor(c)}><Plus size={14} /> Menu</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleClient(c)}>{c.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setDelClient(c)}>{t('common.delete')}</Button>
            </div>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {menus.filter((m) => m.clientId === c.id).map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 bg-bg px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">{m.name} {m.status !== 'active' && <Badge>inactive</Badge>}</div>
                    <a href={`/m/${m.slug}`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline" dir="ltr">{location.origin}/m/{m.slug} ↗</a>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditMenu(m)}>{t('common.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleMenu(m)}>{m.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDelMenu(m)}>{t('common.delete')}</Button>
                </div>
              ))}
              {menus.filter((m) => m.clientId === c.id).length === 0 && <div className="px-4 py-3 text-xs text-fg-3">{t('common.none')}</div>}
            </div>
          </Card>
        ))}
      </div>

      {newClient && <NameSlugModal title="New client" onClose={() => setNewClient(false)} onSave={async (v) => { await api.post('/api/admin/clients', v); invalidate('clients'); }} />}
      {newMenuFor && <NameSlugModal title={`New menu — ${newMenuFor.name}`} onClose={() => setNewMenuFor(null)} onSave={async (v) => { await api.post('/api/admin/menus', { ...v, clientId: newMenuFor.id }); invalidate('menus'); }} />}
      {editMenu && <NameSlugModal title={t('common.edit')} initial={{ name: editMenu.name, slug: editMenu.slug }} onClose={() => setEditMenu(null)} onSave={async (v) => { await api.patch(`/api/admin/menus/${editMenu.id}`, v); invalidate('menus'); }} />}
      <Confirm open={!!delMenu} onClose={() => setDelMenu(null)} danger title={t('common.delete')} body={`${t('common.confirmDelete')} — all dishes, orders and devices of "${delMenu?.name}" will be removed.`}
        onConfirm={async () => { await api.del(`/api/admin/menus/${delMenu!.id}`); invalidate('menus'); }} />
      <Confirm open={!!delClient} onClose={() => setDelClient(null)} danger title={t('common.delete')} body={`${t('common.confirmDelete')} — every menu of "${delClient?.name}" will be removed.`}
        onConfirm={async () => { await api.del(`/api/admin/clients/${delClient!.id}`); invalidate('clients', 'menus'); }} />
    </StaffShell>
  );
}

function NameSlugModal({ title, initial, onClose, onSave }: { title: string; initial?: { name: string; slug: string }; onClose: () => void; onSave: (v: { name: string; slug: string }) => Promise<void> }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [touched, setTouched] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const auto = (n: string) => n.toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '');
  return (
    <Modal open onClose={onClose} title={title} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} onClick={async () => { setBusy(true); try { await onSave({ name, slug: slug || auto(name) }); onClose(); } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); } }}>{t('common.save')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('common.name')}><Input value={name} onChange={(e) => { setName(e.target.value); if (!touched) setSlug(auto(e.target.value)); }} autoFocus /></Field>
        <Field label="Link (slug)" hint={`/m/${slug || '…'}`}><Input dir="ltr" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value); }} /></Field>
      </div>
    </Modal>
  );
}
