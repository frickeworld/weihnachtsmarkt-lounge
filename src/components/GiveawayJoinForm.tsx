import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { giveawayAction } from '@/lib/api';
import {
  giveawayJoinSchema,
  type GiveawayJoinInput,
  type GiveawayJoinValues,
} from '@/lib/giveawaySchema';
import { a11y } from '@/sections/booking/a11y';
import { Field } from '@/sections/booking/fields';

interface Props {
  /** Freunde-Code aus ?ref= (Extra-Los für den Gastgeber) */
  referral?: string;
  /** Präfix der Feld-IDs, damit Seite und Pop-up nicht kollidieren */
  idPrefix?: string;
  /** Überschrift über dem Formular; null = keine */
  heading?: string | null;
  showCompany?: boolean;
  submitLabel?: string;
  /** Nach erfolgreicher Anmeldung (z. B. für das Pop-up) */
  onJoined?: () => void;
}

/**
 * Anmeldung zum Gewinnspiel (Gewinnspiel-Seite und Pop-up auf der Startseite). Teilnahme =
 * Newsletter-Anmeldung, deutlich beschriftet; danach Double-Opt-in per Mail.
 */
export function GiveawayJoinForm({
  referral,
  idPrefix = 'gw',
  heading,
  showCompany = true,
  submitLabel = 'Jetzt teilnehmen',
  onJoined,
}: Props) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      ref: referral,
      website: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (values: GiveawayJoinValues) => {
    setError(null);
    const r = await giveawayAction({ action: 'join', ...values });
    if (r.ok) {
      setSent(true);
      onJoined?.();
      return;
    }
    for (const [field, message] of Object.entries(r.fields ?? {}))
      setFieldError(field as keyof GiveawayJoinInput, { type: 'server', message });
    setError(r.message);
  };

  if (sent)
    return (
      <div role="status">
        <h2 className="text-3xl font-medium">Fast geschafft!</h2>
        <p className="mt-4 text-lg">
          Wir haben dir eine E-Mail geschickt. Bitte bestätige deine Teilnahme mit einem Klick –
          erst dann bist du im Lostopf.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Keine Mail da? Schau bitte auch im Spam-Ordner nach.
        </p>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="space-y-5"
      aria-label="Am Gewinnspiel teilnehmen"
    >
      {heading !== null && (
        <h2 className="pr-16 text-2xl font-medium">{heading ?? 'Jetzt mitmachen'}</h2>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${idPrefix}-first`} label="Vorname" error={errors.firstName}>
          <input
            className="field-input"
            autoComplete="given-name"
            {...a11y(`${idPrefix}-first`, errors.firstName)}
            {...register('firstName')}
          />
        </Field>
        <Field id={`${idPrefix}-last`} label="Nachname" error={errors.lastName}>
          <input
            className="field-input"
            autoComplete="family-name"
            {...a11y(`${idPrefix}-last`, errors.lastName)}
            {...register('lastName')}
          />
        </Field>
      </div>
      <Field id={`${idPrefix}-email`} label="E-Mail" error={errors.email}>
        <input
          type="email"
          inputMode="email"
          className="field-input"
          autoComplete="email"
          {...a11y(`${idPrefix}-email`, errors.email)}
          {...register('email')}
        />
      </Field>
      {showCompany && (
        <Field id={`${idPrefix}-company`} label="Firma (optional)" error={errors.company}>
          <input
            className="field-input"
            autoComplete="organization"
            {...a11y(`${idPrefix}-company`, errors.company)}
            {...register('company')}
          />
        </Field>
      )}
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
            . <strong>Mit der Teilnahme melde ich mich zum Newsletter an</strong>: Die Händler und
            STUDIO/F informieren mich per E-Mail über die Lounge, Aktionen und Veranstaltungen in
            Detmold. Abmelden kann ich mich jederzeit über den Link in jeder Mail. Mehr in der{' '}
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
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
        </div>
      )}
      <button type="submit" className="btn-gold w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Wird gesendet …' : submitLabel}
      </button>
      {referral && (
        <p className="text-center text-sm text-ink-soft">
          Du wurdest eingeladen – dein Gastgeber bekommt ein Extra-Los.
        </p>
      )}
    </form>
  );
}
