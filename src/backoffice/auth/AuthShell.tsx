import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GlitterBand } from '@/components/GlitterBand';
import { HaendlerLogo } from '@/components/HaendlerLogo';
import { useNoindex } from '@/lib/useNoindex';

/** Rahmen für Login, 2FA und Passwort-Seiten: Glitzer-Band, Logo, helle Karte. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  useNoindex();
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-brown py-4 on-dark">
        <div className="flex justify-center px-4">
          <Link to="/" aria-label="Zur Startseite">
            <HaendlerLogo size="md" />
          </Link>
        </div>
      </header>
      <GlitterBand className="h-3" stars={false} />
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <p className="eyebrow mb-2">Lounge der Händler · Zugang</p>
          <h1 className="mb-6 text-3xl font-medium">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
