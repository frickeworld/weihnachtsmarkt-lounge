import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { sendContact } from '@/lib/api';
import {
  GROUP_REQUEST_DEFAULTS,
  groupRequestSchema,
  type GroupRequestInput,
  type GroupRequestValues,
} from '@/lib/groupRequestSchema';
import { a11y } from './booking/a11y';
import { Field } from './booking/fields';

/** Anfrage für Firmenfeiern und größere Gruppen – geht als Mail an STUDIO/F, nichts wird gespeichert. */
export function GroupRequestForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupRequestInput, unknown, GroupRequestValues>({
    resolver: zodResolver(groupRequestSchema),
    defaultValues: GROUP_REQUEST_DEFAULTS,
    mode: 'onTouched',
  });

  const onSubmit = async (values: GroupRequestValues) => {
    setError(null);
    const r = await sendContact(values);
    if (r.ok) {
      setSent(true);
      reset(GROUP_REQUEST_DEFAULTS);
      return;
    }
    for (const [field, message] of Object.entries(r.fields ?? {}))
      setFieldError(field as keyof GroupRequestInput, { type: 'server', message });
    setError(r.message);
  };

  if (sent)
    return (
      <div role="status" className="card flex flex-col items-start gap-4 p-6 sm:p-8">
        <p className="eyebrow">Anfrage gesendet</p>
        <h3 className="text-3xl font-medium">Danke! STUDIO/F meldet sich mit einem Vorschlag.</h3>
        <p className="text-ink-soft">
          Wir prüfen die Termine und schicken dir ein Angebot an die angegebene E-Mail-Adresse.
        </p>
        <button type="button" className="btn-outline" onClick={() => setSent(false)}>
          Weitere Anfrage
        </button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="card relative space-y-5 p-6 sm:p-8"
      aria-label="Anfrage für Firmen und Gruppen"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="group-company" label="Firma oder Gruppe" error={errors.company}>
          <input
            className="field-input"
            autoComplete="organization"
            {...a11y('group-company', errors.company)}
            {...register('company')}
          />
        </Field>
        <Field id="group-name" label="Ansprechperson" error={errors.name}>
          <input
            className="field-input"
            autoComplete="name"
            {...a11y('group-name', errors.name)}
            {...register('name')}
          />
        </Field>
        <Field id="group-email" label="E-Mail" error={errors.email}>
          <input
            type="email"
            inputMode="email"
            className="field-input"
            autoComplete="email"
            {...a11y('group-email', errors.email)}
            {...register('email')}
          />
        </Field>
        <Field id="group-phone" label="Telefon (optional)" error={errors.phone}>
          <input
            type="tel"
            inputMode="tel"
            className="field-input"
            autoComplete="tel"
            {...a11y('group-phone', errors.phone)}
            {...register('phone')}
          />
        </Field>
        <Field id="group-slots" label="Wie viele Zeitfenster?" error={errors.slots}>
          <input
            type="number"
            min={1}
            max={20}
            inputMode="numeric"
            className="field-input"
            {...a11y('group-slots', errors.slots)}
            {...register('slots')}
          />
        </Field>
        <Field id="group-persons" label="Personen insgesamt" error={errors.persons}>
          <input
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            className="field-input"
            {...a11y('group-persons', errors.persons)}
            {...register('persons')}
          />
        </Field>
      </div>
      <Field id="group-dates" label="Wunschtermine" error={errors.dates}>
        <input
          className="field-input"
          placeholder="z. B. Fr 4.12. ab 17:45, alternativ Do 10.12."
          {...a11y('group-dates', errors.dates)}
          {...register('dates')}
        />
      </Field>
      <Field
        id="group-message"
        label="Was sollen wir noch wissen? (optional)"
        error={errors.message}
      >
        <textarea
          rows={4}
          className="field-input"
          {...a11y('group-message', errors.message)}
          {...register('message')}
        />
      </Field>
      {/* Honigtopf gegen Bots – für Menschen unsichtbar */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>
      <p className="text-sm text-ink-soft">
        Unverbindlich. Wir nutzen deine Angaben nur für das Angebot. Mehr in der{' '}
        <Link
          to="/datenschutz"
          className="font-semibold text-gold-deep underline underline-offset-4"
        >
          Datenschutzerklärung
        </Link>
        .
      </p>
      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
        </div>
      )}
      <button type="submit" className="btn-gold w-full sm:w-auto sm:px-10" disabled={isSubmitting}>
        {isSubmitting ? 'Wird gesendet …' : 'Anfrage senden'}
      </button>
    </form>
  );
}
