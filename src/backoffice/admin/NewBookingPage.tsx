import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  BOOKING_FORM_DEFAULTS,
  createBookingSchema,
  OCCASIONS,
  type BookingFormInput,
  type BookingFormValues,
} from '@/lib/bookingSchema';
import { addDays, todayInBerlin } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from '@/sections/booking/a11y';
import { Field } from '@/sections/booking/fields';
import { requireClient } from '../authClient';
import { errorText } from '../errors';
import { ErrorBox, Loading, PageHeader, Panel, SuccessBox, WarnBox, smallBtn } from '../ui';
import { callAdmin } from './api';
import { hhmm } from './format';
import { unwrap, useLoad } from './useLoad';

const SLOT_STATUS: Record<string, string> = {
  free: 'frei',
  taken: 'gebucht',
  blocked: 'gesperrt',
  closed: 'Schließtag',
  past: 'Buchungsschluss vorbei',
  out_of_season: 'außerhalb der Saison',
};

/**
 * Kostenlose Buchung nach Absprache (Entscheidung Louis, 05.11.2026: keine Bar- oder
 * Überweisungsbuchungen). Admins und Händler; nur Admins dürfen gesperrte Zeitfenster übergehen.
 */
export function NewBookingPage({ area = 'admin' }: { area?: 'admin' | 'haendler' }) {
  const settings = useSettings();
  const schema = useMemo(() => createBookingSchema(settings.maxPersons), [settings.maxPersons]);
  const [date, setDate] = useState(() => {
    const tomorrow = addDays(todayInBerlin(), 1);
    return tomorrow < settings.seasonStart ? settings.seasonStart : tomorrow;
  });
  const [startTime, setStartTime] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [override, setOverride] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; ticketSent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slots = useLoad(
    async () =>
      unwrap(
        await requireClient().rpc('get_availability_priced', { from_date: date, to_date: date }),
      ) as {
        start_time: string;
        end_time: string;
        status: string;
        total_cents: number;
        taler_count: number;
        special_title: string | null;
      }[],
    [date, result],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...BOOKING_FORM_DEFAULTS, termsAccepted: true },
    mode: 'onTouched',
  });

  const submit = async (form: BookingFormValues, confirmOverride = false) => {
    setError(null);
    if (!startTime) return setError('Bitte wähle ein Zeitfenster.');
    if (approvalNote.trim().length < 3)
      return setError('Bitte angeben, mit wem die kostenlose Buchung abgesprochen ist.');
    const r = await callAdmin<{ bookingCode: string; ticketSent: boolean }>('manual_booking', {
      date,
      startTime,
      paymentMethod: 'kostenlos',
      approvalNote: approvalNote.trim(),
      override: confirmOverride,
      form: {
        ...form,
        newsletterOptIn: false,
        invoiceRequested: false,
        billingStreet: '',
        billingZip: '',
        billingCity: '',
        vatId: '',
      },
    });
    if (r.ok) {
      setResult({ code: r.bookingCode, ticketSent: r.ticketSent });
      setOverride(null);
      setStartTime('');
      setApprovalNote('');
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
      <PageHeader title="Kostenlose Buchung" />
      <p className="mb-6 max-w-2xl text-ink-soft">
        Nur nach Absprache mit der Tanzschule Fricke und den Händlern, für ausgewählte Gäste. Betrag
        0 €, zählt nicht zur Abrechnung, keine Rechnung. Das Ticket geht sofort per E-Mail raus.
        Doppelbuchungen sind ausgeschlossen.
      </p>

      {result && (
        <div className="mb-6">
          <SuccessBox>
            Buchung <strong className="font-mono">{result.code}</strong> angelegt.{' '}
            {result.ticketSent
              ? 'Das Ticket wurde verschickt.'
              : 'Das Ticket konnte nicht verschickt werden – bitte in der Buchung erneut senden.'}{' '}
            <Link to={`/${area}/buchungen?code=${result.code}`} className="font-semibold underline">
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
                      <span className="text-right text-sm">
                        <span className="block font-semibold tabular-nums">
                          {formatCents(s.total_cents)} · {s.taler_count} € Freiverzehr
                        </span>
                        {s.special_title && (
                          <span className="block text-haendler-red">{s.special_title}</span>
                        )}
                        <span
                          className={`block ${s.status === 'free' ? 'text-emerald-800' : 'text-ink-soft'}`}
                        >
                          {SLOT_STATUS[s.status] ?? s.status}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </Panel>

          <Panel title="Absprache">
            <label className="block">
              <span className="field-label">Abgesprochen mit / Grund</span>
              <input
                className="field-input"
                maxLength={200}
                required
                aria-required="true"
                placeholder="z. B. Paul (Händler) und Louis – Gewinn Radio Lippe"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </label>
            <p className="mt-3 text-sm text-ink-soft">
              Pflichtfeld. Steht nur intern in der Buchung, nicht auf dem Ticket.
            </p>
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
            {isSubmitting ? 'Wird angelegt …' : 'Kostenlos buchen und Ticket senden'}
          </button>
        </Panel>
      </form>
    </>
  );
}
