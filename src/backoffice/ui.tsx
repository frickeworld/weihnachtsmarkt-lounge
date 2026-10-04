import { useEffect, useRef, type ReactNode } from 'react';

export function Loading({ full, label = 'Lädt …' }: { full?: boolean; label?: string }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-ink-soft ${full ? 'min-h-dvh' : 'py-12'}`}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-gold-deep motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
      {children}
    </div>
  );
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900"
    >
      {children}
    </div>
  );
}

export function WarnBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      {children}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-3xl font-medium sm:text-4xl">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-xl font-medium">{title}</h2>}
      {children}
    </section>
  );
}

/** Kleine Schaltfläche für Tabellen und Werkzeugleisten (≥ 44 px Touch-Fläche). */
export const smallBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-gold-deep disabled:cursor-not-allowed disabled:opacity-50';

export const dangerBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-700 bg-red-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50';

/** Modaler Dialog über das native <dialog>-Element (Fokusfalle und Esc inklusive). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={`m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-brown/60 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
    >
      {open && (
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-2xl font-medium">{title}</h2>
            <button type="button" onClick={onClose} className={smallBtn} aria-label="Schließen">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
