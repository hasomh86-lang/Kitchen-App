// Public menu cache: device token + last good bundle per slug, so an iPad keeps
// showing the menu when the connection drops, and only refetches when the
// server says content changed.
import type { PublicMenuBundle } from '@shared/types';

const tokenKey = (slug: string) => `ak.device.${slug}`;
const bundleKey = (slug: string) => `ak.bundle.${slug}`;

export const deviceToken = {
  get: (slug: string) => { try { return localStorage.getItem(tokenKey(slug)) ?? ''; } catch { return ''; } },
  set: (slug: string, t: string) => { try { localStorage.setItem(tokenKey(slug), t); } catch {} },
  clear: (slug: string) => { try { localStorage.removeItem(tokenKey(slug)); } catch {} },
};

export const bundleCache = {
  get(slug: string): PublicMenuBundle | null {
    try {
      const raw = localStorage.getItem(bundleKey(slug));
      return raw ? (JSON.parse(raw) as PublicMenuBundle) : null;
    } catch { return null; }
  },
  set(slug: string, b: PublicMenuBundle) {
    try { localStorage.setItem(bundleKey(slug), JSON.stringify(b)); } catch {}
  },
};

/** Fetch the bundle, honouring ETag/304 and falling back to cache when offline. */
export async function loadBundle(slug: string, token: string): Promise<{ bundle: PublicMenuBundle; fromCache: boolean; changed: boolean }> {
  const cached = bundleCache.get(slug);
  const headers: Record<string, string> = { 'x-device-token': token };
  if (cached?.menu.contentUpdatedAt) headers['if-none-match'] = `"${cached.menu.contentUpdatedAt}"`;
  try {
    const res = await fetch(`/api/public/menu/${encodeURIComponent(slug)}`, { headers, cache: 'no-store' });
    if (res.status === 304 && cached) return { bundle: cached, fromCache: false, changed: false };
    if (res.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 });
    if (res.status === 404) throw Object.assign(new Error('notfound'), { code: 404 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bundle = (await res.json()) as PublicMenuBundle;
    bundleCache.set(slug, bundle);
    return { bundle, fromCache: false, changed: !!cached && cached.menu.contentUpdatedAt !== bundle.menu.contentUpdatedAt };
  } catch (e: any) {
    if (e?.code === 401 || e?.code === 404) throw e;
    if (cached) return { bundle: cached, fromCache: true, changed: false };
    throw e;
  }
}
