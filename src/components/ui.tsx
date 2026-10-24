import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

/* ----------------------------------- Button -------------------------------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
export function Button({ variant = 'primary', size = 'md', loading, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }[size];
  const variants: Record<Variant, string> = {
    primary: 'bg-accent text-accent-fg hover:opacity-90',
    secondary: 'bg-bg-3 text-fg hover:bg-line',
    ghost: 'text-fg-2 hover:bg-bg-3 hover:text-fg',
    danger: 'bg-rose-600/10 text-rose-600 hover:bg-rose-600/20',
    gold: 'bg-gold text-[#140f08] hover:bg-gold-2',
  };
  return (
    <button className={cx(base, sizes, variants[variant], className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ----------------------------------- Fields -------------------------------- */
export function Field({ label, hint, children, className }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium tracking-wide text-fg-2">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-fg-3">{hint}</span>}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx('input', props.className)} />;
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 text-sm text-fg-2">
      <span className={cx('relative h-6 w-10 rounded-full transition', checked ? 'bg-accent' : 'bg-bg-3 border border-line')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-[18px]' : 'start-0.5')} />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------------ Badge -------------------------------- */
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: string; className?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-bg-3 text-fg-2',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    blue: 'bg-sky-500/15 text-sky-700',
    violet: 'bg-violet-500/15 text-violet-700',
    cyan: 'bg-cyan-500/15 text-cyan-700',
    teal: 'bg-teal-500/15 text-teal-700',
    green: 'bg-emerald-500/15 text-emerald-700',
    rose: 'bg-rose-500/15 text-rose-700',
    gold: 'bg-gold/15 text-gold-3',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide', tones[tone] ?? tones.neutral, className)}>{children}</span>;
}

/* ------------------------------------ Modal -------------------------------- */
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6 animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={cx('flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-2 text-fg shadow-2xl sm:rounded-2xl animate-rise', wide ? 'sm:max-w-4xl' : 'sm:max-w-lg')}>
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-fg-3 hover:bg-bg-3 hover:text-fg" aria-label="close">✕</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------ Toast -------------------------------- */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<{ push: (text: string, tone?: 'ok' | 'err') => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = ++n.current;
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'err' ? 5000 : 2500);
  }, []);
  const v = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={v}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg animate-rise', t.tone === 'err' ? 'bg-rose-600 text-white' : 'bg-fg text-bg')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast outside provider');
  return v;
}

/* ------------------------------------ Misc --------------------------------- */
export function Empty({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-1 text-base font-medium text-fg">{title}</div>
      {body && <div className="max-w-sm text-sm text-fg-3">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, danger }: { open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: ReactNode; body?: ReactNode; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <Button variant="ghost" onClick={onClose}>✕</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>OK</Button>
      </>
    }>
      <p className="text-sm text-fg-2">{body}</p>
    </Modal>
  );
}

/** Segmented control */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-bg-3 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-medium transition', value === o.value ? 'bg-bg-2 text-fg shadow-sm' : 'text-fg-3 hover:text-fg')}>{o.label}</button>
      ))}
    </div>
  );
}
