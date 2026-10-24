// Staff-side data layer: working menu selection + react-query hooks.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category, Client, Device, Dish, Menu, Order, User } from '@shared/types';
import { api } from './api';
import { useAuth } from './auth';

interface WorkingMenu {
  menus: Menu[];
  menu: Menu | null;
  setMenuId: (id: string) => void;
  loading: boolean;
}
const Ctx = createContext<WorkingMenu | null>(null);

export function WorkingMenuProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['menus'], queryFn: () => api.get<{ menus: Menu[] }>('/api/admin/menus'), enabled: !!user, staleTime: 60_000 });
  const menus = q.data?.menus ?? [];
  const [menuId, setMenuIdState] = useState<string>(() => { try { return localStorage.getItem('ak.workingMenu') ?? ''; } catch { return ''; } });
  useEffect(() => {
    if (menus.length && !menus.some((m) => m.id === menuId)) setMenuIdState(menus[0].id);
  }, [menus, menuId]);
  const setMenuId = (id: string) => { setMenuIdState(id); try { localStorage.setItem('ak.workingMenu', id); } catch {} };
  const value = useMemo(() => ({ menus, menu: menus.find((m) => m.id === menuId) ?? null, setMenuId, loading: q.isLoading }), [menus, menuId, q.isLoading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkingMenu() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkingMenu outside provider');
  return v;
}

export function useCatalog(menuId: string | undefined) {
  return useQuery({
    queryKey: ['catalog', menuId],
    queryFn: () => api.get<{ categories: Category[]; dishes: Dish[] }>(`/api/catalog/menus/${menuId}/catalog`),
    enabled: !!menuId,
    staleTime: 15_000,
  });
}

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => api.get<{ clients: Client[] }>('/api/admin/clients'), staleTime: 60_000 });
}
export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.get<{ users: User[] }>('/api/admin/users'), staleTime: 30_000 });
}
export function useDevices(menuId: string | undefined) {
  return useQuery({ queryKey: ['devices', menuId], queryFn: () => api.get<{ devices: Device[] }>(`/api/admin/menus/${menuId}/devices`), enabled: !!menuId });
}
export function useAiStatus() {
  return useQuery({ queryKey: ['ai-status'], queryFn: () => api.get<{ enabled: boolean }>('/api/ai/status'), staleTime: 5 * 60_000 });
}

/** Orders with light polling so Butler/Chef boards stay live without websockets. */
export function useOrders(menuId: string | undefined, scope: 'all' | 'active' | 'closed' = 'all') {
  return useQuery({
    queryKey: ['orders', menuId, scope],
    queryFn: () => api.get<{ orders: Order[]; serverTime: string }>(`/api/orders/menus/${menuId}/orders?scope=${scope}`),
    enabled: !!menuId,
    refetchInterval: (q) => (document.visibilityState === 'visible' ? (q.state.error ? 15_000 : 5_000) : false),
    refetchOnWindowFocus: true,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
