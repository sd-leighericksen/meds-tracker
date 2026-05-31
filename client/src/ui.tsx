import { useEffect, type ReactNode } from 'react';

// Nimbus button class shortcuts. Tailwind apply lives in index.css for .btn-primary;
// the rest are inline-composed here for clarity.
export const btn = {
  primary:
    'btn-primary',
  secondary:
    'inline-flex items-center justify-center rounded-full bg-canvas px-6 py-3 ' +
    'text-button-md text-ink border border-hairline-strong active:bg-surface disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center rounded-full bg-brand-red-dark px-6 py-3 ' +
    'text-button-md text-on-primary active:opacity-80 disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center rounded-full px-4 py-2 ' +
    'text-button-md text-ink active:bg-surface disabled:opacity-50',
  yellow:
    'inline-flex items-center justify-center rounded-full bg-brand-yellow px-6 py-3 ' +
    'text-button-md text-primary active:bg-brand-yellow-deep',
};

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hairline-soft bg-canvas p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption-bold text-slate">{label}</span>
      {children}
      {hint && !error && <span className="text-caption text-stone">{hint}</span>}
      {error && <span className="text-caption text-brand-red-dark">{error}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-md border border-hairline-strong bg-canvas px-4 py-3 text-body-md ' +
  'text-ink placeholder:text-muted focus:border-brand-blue focus:outline-none';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputCls} min-h-[88px] resize-y ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        'h-12 rounded-full border border-hairline-strong bg-canvas px-4 ' +
        'text-body-md text-ink focus:border-brand-blue focus:outline-none ' +
        (props.className ?? '')
      }
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'flex items-center gap-3 rounded-full border border-hairline-strong px-4 py-2 ' +
        'text-button-md text-ink active:bg-surface ' +
        (checked ? 'bg-primary text-on-primary border-primary' : 'bg-canvas')
      }
    >
      <span
        className={
          'inline-flex h-5 w-9 items-center rounded-full ' +
          (checked ? 'bg-on-primary/30' : 'bg-surface')
        }
      >
        <span
          className={
            'h-4 w-4 rounded-full transition-transform ' +
            (checked
              ? 'translate-x-4 bg-on-primary'
              : 'translate-x-1 bg-stone')
          }
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6">
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-canvas shadow-elev-4"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-hairline-soft px-6 py-4">
          <h2 className="text-h4 text-ink">{title}</h2>
          <button onClick={onClose} className={btn.ghost} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-hairline-soft px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-brand-red-dark/40 bg-brand-red/60 px-4 py-3 text-body-sm text-brand-red-dark">
      {error}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-hairline-soft bg-canvas px-6 py-10 text-center text-body-md text-slate">
      {children}
    </div>
  );
}
