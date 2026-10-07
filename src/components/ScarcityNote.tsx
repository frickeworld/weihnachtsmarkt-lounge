import { useEffect, useState } from 'react';
import { fetchScarcity } from '@/lib/api';
import { scarcityMessage } from '@/lib/scarcity';

/** Hinweis „Nur noch … frei“ – erscheint nur bei echter Knappheit. */
export function ScarcityNote({ className = '' }: { className?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetchScarcity().then((s) => active && setMessage(scarcityMessage(s)));
    return () => {
      active = false;
    };
  }, []);
  if (!message) return null;
  return (
    <p
      className={`inline-flex items-center gap-2 text-sm font-semibold ${className}`}
      role="status"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-amber opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber" />
      </span>
      {message}
    </p>
  );
}
