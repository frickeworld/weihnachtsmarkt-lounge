import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LightString } from '@/components/LightString';
import { useNoindex } from '@/lib/useNoindex';

/** Ziel des Brevo-Double-Opt-in-Links. */
export function NewsletterConfirmedPage() {
  useNoindex();
  useEffect(() => {
    document.title = 'Newsletter bestätigt – STUDIO/F';
  }, []);

  return (
    <>
      <Header home={false} />
      <main className="min-h-[60vh] px-4 pb-20 sm:px-6">
        <LightString variant="hero" />
        <div className="mx-auto max-w-xl text-center">
          <h1 className="mt-10 text-4xl leading-tight font-semibold sm:text-5xl">
            Danke! Du bist jetzt im STUDIO/F-Newsletter.
          </h1>
          <p className="mt-6 text-lg text-cream/80">
            Wir melden uns mit Events und Angeboten. Abmelden kannst du dich jederzeit über den Link
            in jeder Mail.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="https://www.studio-f.club" target="_blank" rel="noopener" className="btn-gold">
              Zu studio-f.club
            </a>
            <Link to="/" className="btn-outline">
              Zurück zur Lounge
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
