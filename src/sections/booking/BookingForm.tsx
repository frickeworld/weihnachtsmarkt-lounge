import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { startCheckout } from '@/lib/api';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  BOOKING_FORM_DEFAULTS,
  createBookingSchema,
  needsBillingAddress,
  OCCASIONS,
  type BookingFormInput,
  type BookingFormValues,
} from '@/lib/bookingSchema';
import { formatLongDate, formatTime, type IsoDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from './a11y';
import { Field } from './fields';

interface Props {
  date: IsoDate;
  startTime: string;
  endTime: string;
  /** Das Zeitfenster ist inzwischen vergeben oder nicht mehr buchbar. */
  onSlotUnavailable: (message: string) => void;
}

export function BookingForm({ date, startTime, endTime, onSlotUnavailable }: Props) {
  const settings = useSettings();
  const schema = useMemo(() => createBookingSchema(settings.maxPersons), [settings.maxPersons]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: BOOKING_FORM_DEFAULTS,
    mode: 'onTouched',
  });

  const [companyName, invoiceRequested, persons] = useWatch({
    control,
    name: ['companyName', 'invoiceRequested', 'persons'],
  });
  const showBilling = needsBillingAddress({ companyName, invoiceRequested });
  const total = formatCents(totalCents(settings));

  const onSubmit = async (values: BookingFormValues) => {
    setSubmitError(null);
    const result = await startCheckout({ date, startTime, form: values });
    if (result.ok) {
      // Weiter zu Stripe. Der Button bleibt gesperrt, bis die Seite wechselt.
      if (result.url.startsWith('/'))
        navigate(result.url); // nur Vorschau-Modus
      else window.location.assign(result.url);
      return;
    }
    if (result.kind === 'slot') {
      onSlotUnavailable(result.message);
      return;
    }
    if (result.kind === 'validation' && result.fields) {
      for (const [path, message] of Object.entries(result.fields)) {
        const field = path.replace(/^form\./, '') as keyof BookingFormInput;
        setError(field, { type: 'server', message }, { shouldFocus: true });
      }
    }
    setSubmitError(result.message);
    throw new Error(result.message); // markiert den Versand als fehlgeschlagen
  };

  const busy = isSubmitting || isSubmitSuccessful;

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e).catch(() => undefined)}
      noValidate
      className="space-y-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="firstName" label="Vorname" error={errors.firstName}>
          <input
            className="field-input"
            autoComplete="given-name"
            {...a11y('firstName', errors.firstName)}
            {...register('firstName')}
          />
        </Field>
        <Field id="lastName" label="Nachname" error={errors.lastName}>
          <input
            className="field-input"
            autoComplete="family-name"
            {...a11y('lastName', errors.lastName)}
            {...register('lastName')}
          />
        </Field>
        <Field
          id="email"
          label="E-Mail"
          error={errors.email}
          hint="Hierhin schicken wir dein Ticket."
        >
          <input
            type="email"
            inputMode="email"
            className="field-input"
            autoComplete="email"
            {...a11y('email', errors.email, true)}
            {...register('email')}
          />
        </Field>
        <Field
          id="phone"
          label="Telefon"
          error={errors.phone}
          hint="Nur für Rückfragen zu deiner Buchung."
        >
          <input
            type="tel"
            inputMode="tel"
            className="field-input"
            autoComplete="tel"
            {...a11y('phone', errors.phone, true)}
            {...register('phone')}
          />
        </Field>
        <Field id="persons" label="Personenzahl" error={errors.persons}>
          <select
            className="field-input"
            {...a11y('persons', errors.persons)}
            {...register('persons')}
          >
            <option value="">Bitte wählen</option>
            {Array.from({ length: settings.maxPersons }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Person' : 'Personen'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="field-label">Anlass (optional)</legend>
        <div
          className="flex flex-wrap gap-2"
          aria-describedby={errors.occasion ? 'occasion-error' : undefined}
        >
          {OCCASIONS.map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input
                type="radio"
                value={o.value}
                className="peer sr-only"
                {...register('occasion')}
              />
              <span className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm transition-colors peer-checked:border-gold-deep peer-checked:bg-gold peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep hover:border-gold">
                {o.label}
              </span>
            </label>
          ))}
        </div>
        {errors.occasion?.message && (
          <p id="occasion-error" className="field-error" role="alert">
            {errors.occasion.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-5 rounded-2xl border border-line bg-paper p-5">
        <Field id="companyName" label="Firmenname (optional)" error={errors.companyName}>
          <input
            className="field-input"
            autoComplete="organization"
            {...a11y('companyName', errors.companyName)}
            {...register('companyName')}
          />
        </Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-[#7a5a1e]"
            {...register('invoiceRequested')}
          />
          <span>Ich benötige eine Rechnung</span>
        </label>

        {showBilling && (
          <div className="grid gap-5 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <Field id="billingStreet" label="Straße und Hausnummer" error={errors.billingStreet}>
                <input
                  className="field-input"
                  autoComplete="street-address"
                  {...a11y('billingStreet', errors.billingStreet)}
                  {...register('billingStreet')}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="billingZip" label="PLZ" error={errors.billingZip}>
                <input
                  className="field-input"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  {...a11y('billingZip', errors.billingZip)}
                  {...register('billingZip')}
                />
              </Field>
            </div>
            <div className="sm:col-span-4">
              <Field id="billingCity" label="Ort" error={errors.billingCity}>
                <input
                  className="field-input"
                  autoComplete="address-level2"
                  {...a11y('billingCity', errors.billingCity)}
                  {...register('billingCity')}
                />
              </Field>
            </div>
            <div className="sm:col-span-6">
              <Field
                id="vatId"
                label="USt-ID (optional)"
                error={errors.vatId}
                hint="Erscheint auf der Rechnung, z. B. DE123456789."
              >
                <input
                  className="field-input uppercase"
                  {...a11y('vatId', errors.vatId, true)}
                  {...register('vatId')}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      <Field id="notes" label="Wünsche (optional)" error={errors.notes}>
        <textarea
          rows={3}
          className="field-input"
          {...a11y('notes', errors.notes)}
          {...register('notes')}
        />
      </Field>

      {/* Zusammenfassung */}
      <div
        className="rounded-2xl border border-gold bg-gold/10 p-5 sm:p-6"
        aria-label="Zusammenfassung"
      >
        <h4 className="mb-4 text-2xl font-medium">Deine Buchung</h4>
        <dl className="space-y-1.5 text-ink">
          <div className="flex justify-between gap-4">
            <dt>Datum</dt>
            <dd className="text-right">{formatLongDate(date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Zeitfenster</dt>
            <dd>
              {formatTime(startTime)}–{formatTime(endTime)} Uhr
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Personen</dt>
            <dd>{persons ? String(persons) : '–'}</dd>
          </div>
        </dl>
        <div className="my-4 h-px bg-gold/50" aria-hidden="true" />
        <dl className="space-y-1.5">
          <div className="flex justify-between gap-4">
            <dt>Lounge</dt>
            <dd>{formatCents(settings.priceCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Vorverkaufsgebühr</dt>
            <dd>{formatCents(settings.feeCents)}</dd>
          </div>
          <div className="flex justify-between gap-4 pt-2 text-xl font-bold text-ink">
            <dt>Gesamt</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#7a5a1e]"
              aria-invalid={errors.termsAccepted ? true : undefined}
              aria-describedby={errors.termsAccepted ? 'termsAccepted-error' : undefined}
              {...register('termsAccepted')}
            />
            <span className="text-sm leading-relaxed">
              Ich akzeptiere die{' '}
              <Link
                to="/agb"
                target="_blank"
                className="font-semibold text-gold-deep underline underline-offset-4"
              >
                AGB
              </Link>{' '}
              und habe die{' '}
              <Link
                to="/datenschutz"
                target="_blank"
                className="font-semibold text-gold-deep underline underline-offset-4"
              >
                Datenschutzerklärung
              </Link>{' '}
              gelesen. Mir ist bewusst, dass die Buchung verbindlich ist und nicht storniert werden
              kann.
            </span>
          </label>
          {errors.termsAccepted?.message && (
            <p id="termsAccepted-error" className="field-error" role="alert">
              {errors.termsAccepted.message}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#7a5a1e]"
            {...register('newsletterOptIn')}
          />
          <span className="text-sm leading-relaxed text-ink-soft">
            Ja, ich möchte den STUDIO/F-Newsletter mit Events und Angeboten erhalten. Abmeldung
            jederzeit möglich.
          </span>
        </label>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">
        Hinweis: Die Lounge-Buchung ist eine termingebundene Freizeitleistung. Ein Widerrufsrecht
        besteht daher nicht. Die Buchung ist verbindlich.
      </p>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="btn-gold w-full text-lg sm:w-auto sm:px-10"
      >
        {busy ? 'Weiter zur Zahlung …' : `Zahlungspflichtig buchen – ${total}`}
      </button>
      <p className="text-sm text-ink-soft">
        Sichere Zahlung über Stripe mit Karte, Apple Pay, Google Pay oder PayPal. Dein Termin ist
        während der Zahlung 30 Minuten für dich reserviert.
      </p>

      {submitError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {submitError}
        </div>
      )}
    </form>
  );
}
