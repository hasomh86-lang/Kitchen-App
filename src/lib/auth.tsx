import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, SessionUser } from '@shared/types';
import { api } from './api';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  needsSetup: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [me, status] = await Promise.all([
        api.get<{ user: SessionUser | null }>('/api/auth/me'),
        api.get<{ needsSetup: boolean }>('/api/auth/status'),
      ]);
      setUser(me.user);
      setNeedsSetup(status.needsSetup);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, needsSetup, refresh, logout }), [user, loading, needsSetup, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

export const roleHome: Record<Role, string> = {
  admin: '/admin',
  'sub-admin': '/admin/dishes',
  butler: '/butler',
  chef: '/chef',
  pending: '/denied',
};

export const can = (user: SessionUser | null, ...roles: Role[]) => !!user && (user.role === 'admin' || roles.includes(user.role));
