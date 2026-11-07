import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { startCheckout, type DiscountPreview } from '@/lib/api';
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
import { feeFor, feeLabel, totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from './a11y';
import { DiscountCodeField } from './DiscountCodeField';
import { ExtraTalerPicker } from './ExtraTalerPicker';
import { Field } from './fields';

interface Props {
  date: IsoDate;
  startTime: string;
  endTime: string;
  /** Endpreis dieses Zeitfensters inkl. Verarbeitungsgebühr (Anzeige; abgerechnet wird serverseitig) */
  totalCents?: number;
  talerCount?: number;
  specialTitle?: string | null;
  /** Das Zeitfenster ist inzwischen vergeben oder nicht mehr buchbar. */
  onSlotUnavailable: (message: string) => void;
}

export function BookingForm({
  date,
  startTime,
  endTime,
  totalCents: slotTotal,
  talerCount: slotTaler,
  specialTitle,
  onSlotUnavailable,
}: Props) {
  const settings = useSettings();
  const schema = useMemo(() => createBookingSchema(settings.maxPersons), [settings.maxPersons]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discount, setDiscount] = useState<{ code: string; preview: DiscountPreview } | null>(null);
  const [extraTaler, setExtraTaler] = useState(0);
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
  // Preis des gewählten Zeitfensters (Preisstaffel); Rückfall: Standardpreis
  const baseValue = slotTotal ?? totalCents(settings);
  // Auf unserer Seite steht nur der Lounge-Preis; die Verarbeitungsgebühr rechnet erst Stripe dazu
  // (Entscheidung Louis, 04.11.2026). Rabatt-Vorschau: Endpreis nach Rabatt − Gebühr.
  const fee = feeFor(baseValue, settings);
  const loungeValue = baseValue - fee;
  const loungeAfterDiscount = discount ? discount.preview.totalCents - fee : loungeValue;
  const won = discount?.preview.totalCents === 0;
  const taler = slotTaler ?? settings.talerCount;
  // Extra-Taler: 1 Taler = 1 €, ohne Gebühr und ohne Rabatt (Betrag rechnet der Server)
  const extraCents = settings.extraTalerOptions.includes(extraTaler) ? extraTaler * 100 : 0;
  const payNothing = won && extraCents === 0;

  const onSubmit = async (values: BookingFormValues) => {
    setSubmitError(null);
    const result = await startCheckout({
      date,
      startTime,
      form: values,
      discountCode: discount?.code,
      extraTaler: extraCents / 100,
    });
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
      </div>

      <fieldset aria-describedby={errors.persons ? 'persons-error' : 'persons-hint'}>
        <legend className="field-label">Wie viele Personen kommen?</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: settings.maxPersons }, (_, i) => i + 1).map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                value={String(n)}
                className="peer sr-only"
                aria-label={`${n} ${n === 1 ? 'Person' : 'Personen'}`}
                aria-invalid={errors.persons ? true : undefined}
                {...register('persons')}
              />
              <span className="flex h-12 items-center justify-center rounded-xl border-2 border-line bg-surface font-display text-xl font-medium transition-colors peer-checked:border-gold-deep peer-checked:bg-gold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep hover:border-gold">
                {n}
              </span>
            </label>
          ))}
        </div>
        {errors.persons?.message ? (
          <p id="persons-error" className="field-error" role="alert">
            {errors.persons.message}
          </p>
        ) : (
          <p id="persons-hint" className="mt-1.5 text-sm text-ink-soft">
            Bis zu {settings.maxPersons} Personen pro Lounge, der Preis bleibt gleich.
          </p>
        )}
      </fieldset>

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

      <Field
        id="notes"
        label="Wünsche und Vorbestellungen (optional)"
        error={errors.notes}
        hint="Bestell schon jetzt deine Getränke vor – auch ganze Flaschen, z. B. Sekt, Wein oder Glühwein. Auch besondere Wünsche (Geburtstag, Überraschung, Deko) kannst du hier eintragen. Wir bereiten alles vor und melden uns, falls etwas nicht möglich ist."
      >
        <textarea
          rows={4}
          className="field-input"
          placeholder="z. B. 2 Flaschen Sekt zum Anstoßen, 6 Glühwein zur Ankunft, Geburtstagsüberraschung für Anna"
          {...a11y('notes', errors.notes, true)}
          {...register('notes')}
        />
      </Field>

      <ExtraTalerPicker
        options={settings.extraTalerOptions}
        value={extraCents / 100}
        onChange={setExtraTaler}
        baseTaler={taler}
        persons={persons ? Number(persons) : undefined}
      />

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
          {specialTitle && (
            <div className="flex justify-between gap-4">
              <dt>Sonderveranstaltung</dt>
              <dd className="text-right font-semibold">{specialTitle}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Lounge inkl. {taler} € Freiverzehr</dt>
            <dd>{formatCents(loungeValue)}</dd>
          </div>
          {discount && !won && (
            <div className="flex justify-between gap-4 font-semibold text-emerald-800">
              <dt>Code −{discount.preview.percent} %</dt>
              <dd>−{formatCents(discount.preview.discountCents)}</dd>
            </div>
          )}
          {won ? (
            <div
              className={`flex justify-between gap-4 pt-2 font-bold text-emerald-800 ${extraCents ? '' : 'text-xl'}`}
            >
              <dt>{extraCents ? 'Lounge (Gewinn)' : 'Gewinn – du zahlst nichts'}</dt>
              <dd>{formatCents(0)}</dd>
            </div>
          ) : (
            <div
              className={`flex justify-between gap-4 pt-2 text-ink ${extraCents ? 'font-semibold' : 'text-xl font-bold'}`}
            >
              <dt>Lounge-Preis</dt>
              <dd>{formatCents(loungeAfterDiscount)}</dd>
            </div>
          )}
          {extraCents > 0 && (
            <>
              <div className="flex justify-between gap-4">
                <dt>Extra-Taler ({extraCents / 100} Taler)</dt>
                <dd>{formatCents(extraCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-2 text-xl font-bold text-ink">
                <dt>Zusammen</dt>
                <dd>{formatCents((won ? 0 : loungeAfterDiscount) + extraCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-sm text-ink-soft">
                <dt>Residenztaler beim Einlass</dt>
                <dd>{taler + extraCents / 100} Taler</dd>
              </div>
            </>
          )}
        </dl>
        {!won && (
          <p className="pt-1 text-sm text-ink-soft">
            zzgl. {feeLabel(settings)} Verarbeitungsgebühr
            {extraCents > 0 ? ' auf den Lounge-Preis' : ''}, die beim Bezahlen hinzugerechnet wird
            {extraCents > 0 ? ' – die Extra-Taler sind gebührenfrei' : ''}
          </p>
        )}
      </div>

      <DiscountCodeField
        date={date}
        startTime={startTime}
        onChange={(code, preview) => setDiscount(code && preview ? { code, preview } : null)}
      />

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
        {busy
          ? payNothing
            ? 'Wird gebucht …'
            : 'Weiter zur Zahlung …'
          : payNothing
            ? 'Gewinn einlösen – kostenlos buchen'
            : 'Zahlungspflichtig buchen'}
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
