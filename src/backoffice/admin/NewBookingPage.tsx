import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  BOOKING_FORM_DEFAULTS,
  createBookingSchema,
  needsBillingAddress,
  OCCASIONS,
  PAYMENT_METHODS_MANUAL,
  type BookingFormInput,
  type BookingFormValues,
} from '@/lib/bookingSchema';
import { addDays, todayInBerlin } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { totalCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from '@/sections/booking/a11y';
import { Field } from '@/sections/booking/fields';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, WarnBox, smallBtn } from '../ui';
import { callAdmin } from './api';
import { hhmm } from './format';
import { unwrap, useLoad } from './useLoad';

type PaymentMethod = (typeof PAYMENT_METHODS_MANUAL)[number]['value'];

const SLOT_STATUS: Record<string, string> = {
  free: 'frei',
  taken: 'gebucht',
  blocked: 'gesperrt',
  closed: 'Schließtag',
  past: 'Buchungsschluss vorbei',
  out_of_season: 'außerhalb der Saison',
};

export function NewBookingPage() {
  const settings = useSettings();
  const schema = useMemo(() => createBookingSchema(settings.maxPersons), [settings.maxPersons]);
  const [date, setDate] = useState(() => {
    const tomorrow = addDays(todayInBerlin(), 1);
    return tomorrow < settings.seasonStart ? settings.seasonStart : tomorrow;
  });
  const [startTime, setStartTime] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('bar');
  const [inSettlement, setInSettlement] = useState(true);
  const [override, setOverride] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; ticketSent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = useLoad(
    async () =>
      unwrap(await requireClient().rpc('get_availability', { from_date: date, to_date: date })) as {
        start_time: string;
        end_time: string;
        status: string;
      }[],
    [date, result],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...BOOKING_FORM_DEFAULTS, termsAccepted: true },
    mode: 'onTouched',
  });
  const [companyName, invoiceRequested] = useWatch({
    control,
    name: ['companyName', 'invoiceRequested'],
  });
  const showBilling = needsBillingAddress({ companyName, invoiceRequested });

  const submit = async (form: BookingFormValues, confirmOverride = false) => {
    setError(null);
    if (!startTime) return setError('Bitte wähle ein Zeitfenster.');
    const r = await callAdmin<{ bookingCode: string; ticketSent: boolean }>('manual_booking', {
      date,
      startTime,
      paymentMethod: payment,
      includeInSettlement: payment === 'kostenlos' ? false : inSettlement,
      override: confirmOverride,
      form: { ...form, newsletterOptIn: false },
    });
    if (r.ok) {
      setResult({ code: r.bookingCode, ticketSent: r.ticketSent });
      setOverride(null);
      setStartTime('');
      reset({ ...BOOKING_FORM_DEFAULTS, termsAccepted: true });
      window.scrollTo({ top: 0 });
      return;
    }
    if (r.needsOverride) return setOverride(r.message);
    if (r.fields)
      for (const [path, message] of Object.entries(r.fields))
        if (path.startsWith('form.'))
          setFieldError(path.slice(5) as keyof BookingFormInput, { type: 'server', message });
    setError(r.message);
  };

  return (
    <>
      <PageHeader title="Neue Buchung" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Für Buchungen per Telefon oder Sonderfälle. Die Buchung ist sofort bezahlt, das Ticket geht
        per E-Mail raus. Doppelbuchungen sind ausgeschlossen.
      </p>

      {result && (
        <div className="mb-6">
          <SuccessBox>
            Buchung <strong className="font-mono">{result.code}</strong> angelegt.{' '}
            {result.ticketSent
              ? 'Das Ticket wurde verschickt.'
              : 'Das Ticket konnte nicht verschickt werden – bitte in der Buchung erneut senden.'}{' '}
            <Link to={`/admin/buchungen?code=${result.code}`} className="font-semibold underline">
              Buchung öffnen
            </Link>
          </SuccessBox>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => void handleSubmit((v) => submit(v))(e)}
        className="grid gap-6 lg:grid-cols-[22rem_1fr]"
      >
        <div className="space-y-6">
          <Panel title="Termin">
            <label className="block">
              <span className="field-label">Datum</span>
              <input
                type="date"
                className="field-input"
                value={date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  setStartTime('');
                  setOverride(null);
                }}
              />
            </label>
            <fieldset className="mt-4">
              <legend className="field-label">Zeitfenster</legend>
              {slots.loading && <Loading />}
              {slots.error != null && <ErrorBox>{errorText(slots.error)}</ErrorBox>}
              {slots.data?.length === 0 && (
                <p className="text-ink-soft">An diesem Wochentag gibt es keine Zeitfenster.</p>
              )}
              <div className="space-y-2">
                {slots.data?.map((s) => {
                  const st = hhmm(s.start_time);
                  return (
                    <label
                      key={st}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2 ${
                        startTime === st ? 'border-gold-deep bg-gold/15' : 'border-line bg-surface'
                      } ${s.status === 'taken' ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="slot"
                          value={st}
                          checked={startTime === st}
                          disabled={s.status === 'taken'}
                          onChange={() => {
                            setStartTime(st);
                            setOverride(null);
                          }}
                          className="h-5 w-5 accent-[#7a5a1e]"
                        />
                        <span className="whitespace-nowrap font-semibold tabular-nums">
                          {st}–{hhmm(s.end_time)}
                        </span>
                      </span>
                      <span
                        className={`text-sm ${s.status === 'free' ? 'text-emerald-800' : 'text-ink-soft'}`}
                      >
                        {SLOT_STATUS[s.status] ?? s.status}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Panel>

          <Panel title="Zahlung">
            <fieldset>
              <legend className="sr-only">Zahlungsart</legend>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS_MANUAL.map((p) => (
                  <label key={p.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      value={p.value}
                      checked={payment === p.value}
                      onChange={() => setPayment(p.value)}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm peer-checked:border-gold-deep peer-checked:bg-gold peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-gold-deep">
                      {p.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-3 text-sm text-ink-soft">
              {payment === 'kostenlos'
                ? 'Betrag 0 €, zählt nicht zur Händler-Abrechnung.'
                : `Betrag ${formatCents(totalCents(settings))} (aktueller Preis).`}
            </p>
            {payment !== 'kostenlos' && (
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#7a5a1e]"
                  checked={inSettlement}
                  onChange={(e) => setInSettlement(e.target.checked)}
                />
                <span>In die Händler-Abrechnung aufnehmen</span>
              </label>
            )}
          </Panel>
        </div>

        <Panel title="Gast">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="firstName" label="Vorname" error={errors.firstName}>
              <input
                className="field-input"
                {...a11y('firstName', errors.firstName)}
                {...register('firstName')}
              />
            </Field>
            <Field id="lastName" label="Nachname" error={errors.lastName}>
              <input
                className="field-input"
                {...a11y('lastName', errors.lastName)}
                {...register('lastName')}
              />
            </Field>
            <Field id="email" label="E-Mail (für das Ticket)" error={errors.email}>
              <input
                type="email"
                className="field-input"
                {...a11y('email', errors.email)}
                {...register('email')}
              />
            </Field>
            <Field id="phone" label="Telefon" error={errors.phone}>
              <input
                type="tel"
                className="field-input"
                {...a11y('phone', errors.phone)}
                {...register('phone')}
              />
            </Field>
            <Field id="persons" label="Personen" error={errors.persons}>
              <select
                className="field-input"
                {...a11y('persons', errors.persons)}
                {...register('persons')}
              >
                <option value="">Bitte wählen</option>
                {Array.from({ length: settings.maxPersons }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="occasion" label="Anlass (optional)" error={errors.occasion}>
              <select
                className="field-input"
                {...a11y('occasion', errors.occasion)}
                {...register('occasion')}
              >
                <option value="">Keine Angabe</option>
                {OCCASIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="companyName" label="Firmenname (optional)" error={errors.companyName}>
              <input
                className="field-input"
                {...a11y('companyName', errors.companyName)}
                {...register('companyName')}
              />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#7a5a1e]"
                {...register('invoiceRequested')}
              />
              <span>Rechnung gewünscht</span>
            </label>
            {showBilling && (
              <>
                <Field
                  id="billingStreet"
                  label="Straße und Hausnummer"
                  error={errors.billingStreet}
                >
                  <input
                    className="field-input"
                    {...a11y('billingStreet', errors.billingStreet)}
                    {...register('billingStreet')}
                  />
                </Field>
                <div className="grid grid-cols-[7rem_1fr] gap-3">
                  <Field id="billingZip" label="PLZ" error={errors.billingZip}>
                    <input
                      className="field-input"
                      {...a11y('billingZip', errors.billingZip)}
                      {...register('billingZip')}
                    />
                  </Field>
                  <Field id="billingCity" label="Ort" error={errors.billingCity}>
                    <input
                      className="field-input"
                      {...a11y('billingCity', errors.billingCity)}
                      {...register('billingCity')}
                    />
                  </Field>
                </div>
                <Field id="vatId" label="USt-ID (optional)" error={errors.vatId}>
                  <input
                    className="field-input uppercase"
                    {...a11y('vatId', errors.vatId)}
                    {...register('vatId')}
                  />
                </Field>
              </>
            )}
            <div className="sm:col-span-2">
              <Field id="notes" label="Wünsche / interne Notiz (optional)" error={errors.notes}>
                <textarea
                  rows={3}
                  className="field-input"
                  {...a11y('notes', errors.notes)}
                  {...register('notes')}
                />
              </Field>
            </div>
          </div>
          {showBilling && (
            <p className="mt-4 text-sm text-ink-soft">
              Hinweis: Bei manuellen Buchungen erstellt Stripe keine Rechnung. Bitte die Rechnung
              selbst schreiben.
            </p>
          )}

          {override && (
            <div className="mt-6 space-y-3">
              <WarnBox>{override}</WarnBox>
              <button
                type="button"
                className={smallBtn}
                disabled={isSubmitting}
                onClick={() => void handleSubmit((v) => submit(v, true))()}
              >
                Ja, trotzdem buchen
              </button>
            </div>
          )}
          {error && (
            <div className="mt-6">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
          <button
            type="submit"
            className="btn-gold mt-6 w-full sm:w-auto"
            disabled={isSubmitting || !startTime}
          >
            {isSubmitting ? 'Wird angelegt …' : 'Buchung anlegen und Ticket senden'}
          </button>
        </Panel>
      </form>
    </>
  );
}
