import { useRef, useState } from 'react';
import type { L10n } from '@shared/types';
import { api, imgSrc, uploadImage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAiStatus } from '@/lib/staff';
import { Image as ImageIcon, Sparkle } from './icons';
import { Button, Spinner, cx, useToast } from './ui';

/* ------------------------- Bilingual text field ---------------------------- */
export function BilingualInput({ value, onChange, label, multiline, placeholderEn, placeholderAr }: {
  value: L10n; onChange: (v: L10n) => void; label?: string; multiline?: boolean; placeholderEn?: string; placeholderAr?: string;
}) {
  const { t } = useI18n();
  const ai = useAiStatus();
  const toast = useToast();
  const [busy, setBusy] = useState<'en' | 'ar' | null>(null);
  const translate = async (to: 'en' | 'ar') => {
    const from = to === 'en' ? value.ar : value.en;
    if (!from.trim()) return;
    setBusy(to);
    try {
      const r = await api.post<{ text: string }>('/api/ai/translate', { text: from, to });
      onChange({ ...value, [to]: r.text });
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(null); }
  };
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div>
      {label && <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{label}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(['ar', 'en'] as const).map((k) => (
          <div key={k} className="relative">
            <span className={cx('pointer-events-none absolute top-2 rounded bg-bg-3 px-1.5 text-[9px] font-semibold uppercase text-fg-3', k === 'ar' ? 'left-2' : 'right-2')}>{k}</span>
            <Tag
              dir={k === 'ar' ? 'rtl' : 'ltr'}
              value={value[k]}
              onChange={(e: any) => onChange({ ...value, [k]: e.target.value })}
              placeholder={k === 'ar' ? placeholderAr ?? t('common.arabic') : placeholderEn ?? t('common.english')}
              className={cx('input', k === 'ar' ? 'pl-10' : 'pr-10', multiline && 'min-h-24')}
              rows={multiline ? 3 : undefined}
            />
            {ai.data?.enabled && !value[k] && value[k === 'en' ? 'ar' : 'en'] && (
              <button type="button" onClick={() => translate(k)} disabled={busy !== null} title="AI translate"
                className={cx('absolute bottom-2 flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg', k === 'ar' ? 'left-2' : 'right-2')}>
                {busy === k ? <Spinner size={10} /> : <Sparkle size={10} />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Image field --------------------------------- */
export function ImageField({ value, onChange, menuId, label, aspect = 'aspect-square', aiPrompt }: {
  value: string | null; onChange: (v: string | null) => void; menuId?: string; label?: string; aspect?: string; aiPrompt?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const ai = useAiStatus();
  const inp = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.push('Not an image', 'err');
    setBusy('upload');
    try {
      const shrunk = await downscale(file, 1600);
      const r = await uploadImage(shrunk, menuId);
      onChange(r.id);
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(null); }
  };
  const aiRun = async (kind: 'hero' | 'generate') => {
    setBusy(kind);
    try {
      const r = kind === 'hero'
        ? await api.post<{ image: string }>('/api/ai/hero', { image: value, menuId })
        : await api.post<{ image: string }>('/api/ai/generate', { prompt: aiPrompt || 'a beautifully plated dish', menuId });
      onChange(r.image.replace(/^\/img\//, ''));
    } catch (e: any) { toast.push(e.message, 'err'); } finally { setBusy(null); }
  };

  return (
    <div>
      {label && <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{label}</div>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void handleFile(e.dataTransfer.files?.[0]); }}
        className={cx('relative overflow-hidden rounded-2xl border-2 border-dashed bg-bg-3 transition', aspect, drag ? 'border-accent' : 'border-line')}
      >
        {value ? <img src={imgSrc(value)} alt="" className="h-full w-full object-cover" /> : (
          <button type="button" onClick={() => inp.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-fg-3">
            <ImageIcon size={28} /><span className="text-xs">{t('common.upload')}</span>
          </button>
        )}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Spinner size={26} /></div>}
      </div>
      <input ref={inp} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="secondary" onClick={() => inp.current?.click()} disabled={!!busy}>{t('common.upload')}</Button>
        {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={!!busy}>{t('common.remove')}</Button>}
        {ai.data?.enabled && value && <Button type="button" size="sm" variant="gold" onClick={() => aiRun('hero')} disabled={!!busy}><Sparkle size={12} /> Hero</Button>}
        {ai.data?.enabled && !value && aiPrompt && <Button type="button" size="sm" variant="gold" onClick={() => aiRun('generate')} disabled={!!busy}><Sparkle size={12} /> AI</Button>}
      </div>
    </div>
  );
}

/** Downscale big phone photos client-side before upload (keeps R2 small and uploads fast). */
async function downscale(file: File, max: number): Promise<File> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1_500_000) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }) : file;
}

/* ----------------------------- Chip multi-select --------------------------- */
export function ChipSelect<T extends string>({ options, value, onChange, label }: { options: { id: T; label: L10n }[]; value: T[]; onChange: (v: T[]) => void; label?: string }) {
  const { l } = useI18n();
  return (
    <div>
      {label && <div className="mb-1.5 text-xs font-medium tracking-wide text-fg-2">{label}</div>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
              className={cx('rounded-full border px-3 py-1.5 text-xs transition', on ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2 hover:border-fg-3')}>{l(o.label)}</button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Bilingual list editor ------------------------- */
export function L10nListEditor({ value, onChange, label, hint }: { value: L10n[]; onChange: (v: L10n[]) => void; label: string; hint?: string }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-fg-2">{label}</span>
        <button type="button" onClick={() => onChange([...value, { en: '', ar: '' }])} className="text-xs text-accent">+ {t('common.add')}</button>
      </div>
      {hint && <p className="mb-2 text-[11px] text-fg-3">{hint}</p>}
      <div className="space-y-1.5">
        {value.map((it, i) => (
          <div key={i} className="flex gap-1.5">
            <input dir="rtl" value={it.ar} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)))} placeholder="عربي" className="input h-9 py-0 text-sm" />
            <input dir="ltr" value={it.en} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} placeholder="English: 120g" className="input h-9 py-0 text-sm" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-fg-3 hover:text-rose-600">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
