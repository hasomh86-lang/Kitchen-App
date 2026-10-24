import { HTTPException } from 'hono/http-exception';
import type { L10n } from '@shared/types';

export function bad(msg: string): never {
  throw new HTTPException(400, { message: msg });
}

export const str = (v: unknown, field: string, { max = 2000, required = false } = {}): string => {
  if (v === undefined || v === null) {
    if (required) bad(`${field} is required`);
    return '';
  }
  if (typeof v !== 'string') bad(`${field} must be text`);
  const s = v.trim();
  if (required && !s) bad(`${field} is required`);
  if (s.length > max) bad(`${field} is too long`);
  return s;
};

export const num = (v: unknown, field: string, fallback = 0): number => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`${field} must be a number`);
  return n;
};

export const bool = (v: unknown, fallback = false): boolean => (v === undefined || v === null ? fallback : !!v);

export const l10n = (v: unknown, field: string, max = 4000): L10n => {
  if (v === undefined || v === null) return { en: '', ar: '' };
  if (typeof v === 'string') return { en: v.trim().slice(0, max), ar: '' };
  if (typeof v !== 'object') bad(`${field} must be {en, ar}`);
  const o = v as any;
  return { en: str(o.en, `${field}.en`, { max }), ar: str(o.ar, `${field}.ar`, { max }) };
};

export const l10nList = (v: unknown, field: string): L10n[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) bad(`${field} must be a list`);
  return v.map((x, i) => l10n(x, `${field}[${i}]`, 300)).filter((x) => x.en || x.ar);
};

export const strList = <T extends string>(v: unknown, field: string, allowed?: readonly T[]): T[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) bad(`${field} must be a list`);
  const out = v.map((x) => String(x));
  if (allowed) {
    for (const x of out) if (!allowed.includes(x as T)) bad(`${field} contains unknown value "${x}"`);
  }
  return out as T[];
};

export const slug = (v: unknown, field: string): string => {
  const s = str(v, field, { max: 60, required: true }).toLowerCase().replace(/[^a-z0-9؀-ۿ-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) bad(`${field} is not a valid slug`);
  return s;
};

export const email = (v: unknown): string => {
  const s = str(v, 'email', { max: 200, required: true }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) bad('email is not valid');
  return s;
};

export const imageRef = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  // Accept our own R2 image keys (served at /img/:id), data URLs for legacy imports, or https URLs.
  if (/^(img_[a-z0-9]+|\/img\/img_[a-z0-9]+|https?:\/\/[^\s]+|data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)$/.test(s)) return s.replace(/^\/img\//, '');
  bad('image reference is not valid');
};
