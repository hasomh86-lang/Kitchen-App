import { useState } from 'react';
import type { Role, User } from '@shared/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useI18n, type StringKey } from '@/lib/i18n';
import { useInvalidate, useUsers, useWorkingMenu } from '@/lib/staff';
import { Plus } from '@/components/icons';
import { Badge, Button, Confirm, Field, Input, Modal, cx, useToast } from '@/components/ui';
import { Card, PageHeader, StaffShell } from './StaffShell';

const ROLES: Role[] = ['admin', 'sub-admin', 'butler', 'chef', 'pending'];
const ROLE_DESC: Record<Role, string> = {
  admin: 'Everything: menus, team, devices, orders, kitchen.',
  'sub-admin': 'Edits dishes, categories and appearance of assigned menus. No orders, no team.',
  butler: 'Creates orders and runs delivery for assigned menus.',
  chef: 'Kitchen queue for assigned menus: start preparing, mark ready, reject.',
  pending: 'Signed up, no access yet.',
};

export default function UsersPage() {
  const { t, lang } = useI18n();
  const users = useUsers();
  const { user: me } = useAuth();
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  return (
    <StaffShell title={t('nav.users')}>
      <PageHeader title={t('nav.users')} actions={<Button onClick={() => setEditing('new')}><Plus size={16} />{t('common.add')}</Button>} />
      <Card className="divide-y divide-line p-0">
        {(users.data?.users ?? []).map((u) => (
          <button key={u.id} onClick={() => setEditing(u)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-start hover:bg-bg-3/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-3 text-sm font-semibold uppercase">{(u.firstName || u.email)[0]}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{u.firstName} {u.lastName} {u.id === me?.id && <span className="text-xs text-fg-3">(you)</span>}</div>
              <div className="truncate text-xs text-fg-3" dir="ltr">{u.email}</div>
            </div>
            <Badge tone={u.role === 'admin' ? 'gold' : u.role === 'pending' ? 'rose' : 'neutral'}>{t(`role.${u.role}` as StringKey)}</Badge>
            {u.status === 'disabled' && <Badge tone="rose">disabled</Badge>}
            <div className="hidden text-xs text-fg-3 sm:block">{u.lastLoginAt ? fmtDate(u.lastLoginAt, lang) : '—'}</div>
          </button>
        ))}
      </Card>
      {editing && <UserEditor user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </StaffShell>
  );
}

function UserEditor({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const { menus } = useWorkingMenu();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [f, setF] = useState({ email: user?.email ?? '', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', role: (user?.role ?? 'butler') as Role, menuIds: user?.menuIds ?? [], password: '', status: user?.status ?? 'active' });
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body: any = { ...f };
      if (!body.password) delete body.password;
      if (user) await api.patch(`/api/admin/users/${user.id}`, body);
      else await api.post('/api/admin/users', body);
      invalidate('users'); toast.push(t('common.saved')); onClose();
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(false); }
  };
  const isMe = user?.id === me?.id;
  return (
    <Modal open onClose={onClose} title={user ? `${user.firstName} ${user.lastName}` : t('common.add')} footer={
      <>
        {user && !isMe && <Button variant="danger" onClick={() => setDel(true)}>{t('common.delete')}</Button>}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button loading={busy} onClick={save}>{t('common.save')}</Button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.firstName')}><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label={t('auth.lastName')}><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
        </div>
        <Field label={t('auth.email')}><Input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!!user} /></Field>
        <Field label={user ? 'New password (leave empty to keep)' : t('auth.password')} hint="8+ characters"><Input type="password" dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>

        <div>
          <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">Role</div>
          <div className="grid gap-1.5">
            {ROLES.map((r) => (
              <button key={r} type="button" disabled={isMe} onClick={() => setF({ ...f, role: r })} className={cx('rounded-xl border px-3 py-2 text-start transition disabled:opacity-60', f.role === r ? 'border-fg bg-fg text-bg' : 'border-line hover:border-fg-3')}>
                <div className="text-sm font-medium">{t(`role.${r}` as StringKey)}</div>
                <div className={cx('text-[11px]', f.role === r ? 'text-bg/70' : 'text-fg-3')}>{ROLE_DESC[r]}</div>
              </button>
            ))}
          </div>
        </div>

        {f.role !== 'admin' && f.role !== 'pending' && (
          <div>
            <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">Assigned menus</div>
            <div className="flex flex-wrap gap-1.5">
              {menus.map((m) => {
                const on = f.menuIds.includes(m.id);
                return <button key={m.id} type="button" onClick={() => setF({ ...f, menuIds: on ? f.menuIds.filter((x) => x !== m.id) : [...f.menuIds, m.id] })} className={cx('rounded-full border px-3 py-1.5 text-xs', on ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2')}>{m.name}</button>;
              })}
            </div>
            {!f.menuIds.length && <p className="mt-1 text-[11px] text-rose-600">Without an assigned menu this person will see nothing.</p>}
          </div>
        )}

        {user && !isMe && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.status === 'disabled'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'disabled' : 'active' })} /> Disable account (signs them out everywhere)</label>
        )}
      </div>
      <Confirm open={del} onClose={() => setDel(false)} danger title={t('common.delete')} body={t('common.confirmDelete')} onConfirm={async () => { await api.del(`/api/admin/users/${user!.id}`); invalidate('users'); onClose(); }} />
    </Modal>
  );
}
