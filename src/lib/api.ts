export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers.set('content-type', 'application/json');
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    ...init,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (res.status === 304) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? res.statusText ?? 'Request failed');
  return data as T;
}
const safeJson = (t: string) => { try { return JSON.parse(t); } catch { return { error: t }; } };

export const api = {
  get: <T>(url: string, init?: RequestInit) => request<T>('GET', url, undefined, init),
  post: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('POST', url, body, init),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

/** Resolve an image reference (R2 key, /img path, http URL or data URL) to a usable src. */
export function imgSrc(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('img_')) return `/img/${ref}`;
  return ref;
}

export async function uploadImage(file: File, menuId?: string): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  if (menuId) fd.append('menuId', menuId);
  return api.post('/api/images', fd);
}
