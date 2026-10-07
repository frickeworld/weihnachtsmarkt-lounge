import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import taler192 from '@/assets/taler-192.webp';
import { Footer } from '@/components/Footer';
import { GlitterBand } from '@/components/GlitterBand';
import { Header } from '@/components/Header';
import { IconCheck } from '@/components/Icons';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '@/content/partners';
import { fetchGiveawayInfo, giveawayAction, type GiveawayInfo } from '@/lib/api';
import { formatLongDate } from '@/lib/dates';
import {
  giveawayJoinSchema,
  type GiveawayJoinInput,
  type GiveawayJoinValues,
} from '@/lib/giveawaySchema';
import { maxTalerCount } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from '@/sections/booking/a11y';
import { Field } from '@/sections/booking/fields';

/** /gewinnspiel – „Jede Woche einen Abend in der Lounge gewinnen“. */
export function GiveawayPage() {
  const s = useSettings();
  const [params] = useSearchParams();
  const ref = (params.get('ref') ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const [info, setInfo] = useState<GiveawayInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Gewinnspiel: Jede Woche einen Lounge-Abend gewinnen – Die Händler';
    let active = true;
    void fetchGiveawayInfo().then((i) => {
      if (!active) return;
      setInfo(i);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<GiveawayJoinInput, unknown, GiveawayJoinValues>({
    resolver: zodResolver(giveawayJoinSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      consent: false as unknown as true,
      adult: false as unknown as true,
      ref: ref || undefined,
      website: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (values: GiveawayJoinValues) => {
    setError(null);
    const r = await giveawayAction({ action: 'join', ...values });
    if (r.ok) return setSent(true);
    for (const [field, message] of Object.entries(r.fields ?? {}))
      setFieldError(field as keyof GiveawayJoinInput, { type: 'server', message });
    setError(r.message);
  };

  const active = info?.active ?? false;

  return (
    <>
      <Header home={false} />
      <GlitterBand className="h-3" />
      <main className="px-4 pt-10 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow mb-3">Gewinnspiel der Händler</p>
            <h1 className="text-4xl leading-tight font-medium sm:text-6xl">
              Jede Woche einen Abend in der Lounge gewinnen
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Jeden Montag verlosen wir einen Abend in unserer Lounge auf dem Weihnachtsmarkt im
              Schlosspark – für dich und bis zu {s.maxPersons - 1} Gäste, mit bis zu{' '}
              {maxTalerCount(s)} € Freiverzehr und Tischservice. Ob Firma oder Freundeskreis: Einmal
              anmelden, und du bist bei allen Ziehungen bis zum Ende der Aktion dabei.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                'Einmal mitmachen – jede Woche neue Chance',
                'Gewinner suchen sich einen freien Abend selbst aus',
                `Nicht gewonnen? Du bekommst einen persönlichen Code: ${info?.discountPercent ?? 30} % auf einen Abend Mo–Do`,
                'Freunde einladen = Extra-Los für dich',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <IconCheck className="mt-1 h-5 w-5 shrink-0 text-gold-deep" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            {info && active && (
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="card px-5 py-3">
                  <div className="text-xs text-ink-soft">Nächste Ziehung</div>
                  <div className="font-display text-xl font-medium">
                    {formatLongDate(info.nextDraw)}
                  </div>
                </div>
                {info.participants >= 20 && (
                  <div className="card px-5 py-3">
                    <div className="text-xs text-ink-soft">Im Lostopf</div>
                    <div className="font-display text-xl font-medium tabular-nums">
                      {info.participants.toLocaleString('de-DE')}
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="mt-8 text-sm text-ink-soft">
              Folge{' '}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gold-deep underline underline-offset-4"
              >
                {INSTAGRAM_HANDLE}
              </a>{' '}
              – dort zeigen wir jede Woche, wie es in der Lounge aussieht.
            </p>
          </div>

          <div className="card relative overflow-hidden p-6 sm:p-8">
            <img
              src={taler192}
              alt=""
              width={96}
              height={96}
              className="absolute -top-4 -right-4 h-24 w-24 rotate-12 opacity-90"
            />
            {!loaded && <p className="text-ink-soft">Einen Moment …</p>}
            {loaded && !active && (
              <div role="status">
                <h2 className="text-2xl font-medium">Das Gewinnspiel ist gerade nicht aktiv.</h2>
                <p className="mt-3 text-ink-soft">
                  Schau bald wieder vorbei – oder sichere dir direkt einen Abend.
                </p>
                <Link to="/#buchen" className="btn-gold mt-6">
                  Lounge buchen
                </Link>
              </div>
            )}
            {loaded && active && sent && (
              <div role="status">
                <h2 className="text-3xl font-medium">Fast geschafft!</h2>
                <p className="mt-4 text-lg">
                  Wir haben dir eine E-Mail geschickt. Bitte bestätige deine Teilnahme mit einem
                  Klick – erst dann bist du im Lostopf.
                </p>
                <p className="mt-3 text-sm text-ink-soft">
                  Keine Mail da? Schau bitte auch im Spam-Ordner nach.
                </p>
              </div>
            )}
            {loaded && active && !sent && (
              <form
                noValidate
                onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                className="space-y-5"
                aria-label="Am Gewinnspiel teilnehmen"
              >
                <h2 className="pr-16 text-2xl font-medium">Jetzt mitmachen</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="gw-first" label="Vorname" error={errors.firstName}>
                    <input
                      className="field-input"
                      autoComplete="given-name"
                      {...a11y('gw-first', errors.firstName)}
                      {...register('firstName')}
                    />
                  </Field>
                  <Field id="gw-last" label="Nachname" error={errors.lastName}>
                    <input
                      className="field-input"
                      autoComplete="family-name"
                      {...a11y('gw-last', errors.lastName)}
                      {...register('lastName')}
                    />
                  </Field>
                </div>
                <Field id="gw-email" label="E-Mail" error={errors.email}>
                  <input
                    type="email"
                    inputMode="email"
                    className="field-input"
                    autoComplete="email"
                    {...a11y('gw-email', errors.email)}
                    {...register('email')}
                  />
                </Field>
                <Field id="gw-company" label="Firma (optional)" error={errors.company}>
                  <input
                    className="field-input"
                    autoComplete="organization"
                    {...a11y('gw-company', errors.company)}
                    {...register('company')}
                  />
                </Field>
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#7a5a1e]"
                      aria-invalid={errors.consent ? true : undefined}
                      {...register('consent')}
                    />
                    <span>
                      Ich nehme am Gewinnspiel teil und akzeptiere die{' '}
                      <Link
                        to="/gewinnspiel/teilnahmebedingungen"
                        target="_blank"
                        className="font-semibold text-gold-deep underline underline-offset-4"
                      >
                        Teilnahmebedingungen
                      </Link>
                      . <strong>Mit der Teilnahme melde ich mich zum Newsletter an</strong>: Die
                      Händler und STUDIO/F informieren mich per E-Mail über die Lounge, Aktionen und
                      Veranstaltungen in Detmold. Abmelden kann ich mich jederzeit über den Link in
                      jeder Mail. Mehr in der{' '}
                      <Link
                        to="/datenschutz"
                        target="_blank"
                        className="font-semibold text-gold-deep underline underline-offset-4"
                      >
                        Datenschutzerklärung
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.consent && <p className="field-error">{errors.consent.message}</p>}
                </div>
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#7a5a1e]"
                      aria-invalid={errors.adult ? true : undefined}
                      {...register('adult')}
                    />
                    <span>Ich bin mindestens 18 Jahre alt.</span>
                  </label>
                  {errors.adult && <p className="field-error">{errors.adult.message}</p>}
                </div>
                {/* Honigtopf gegen Bots – für Menschen unsichtbar */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" {...register('website')} />
                  </label>
                </div>
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
                  >
                    {error}
                  </div>
                )}
                <button type="submit" className="btn-gold w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Wird gesendet …' : 'Jetzt teilnehmen'}
                </button>
                {ref && (
                  <p className="text-center text-sm text-ink-soft">
                    Du wurdest eingeladen – dein Gastgeber bekommt ein Extra-Los.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
