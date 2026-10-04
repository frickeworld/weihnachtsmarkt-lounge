import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { sendContact } from '@/lib/api';
import {
  CONTACT_DEFAULTS,
  CONTACT_TOPICS,
  contactSchema,
  type ContactInput,
  type ContactValues,
} from '@/lib/contactSchema';
import { a11y } from './booking/a11y';
import { Field } from './booking/fields';

/** Formular-Teil des Kontaktbereichs – wird erst geladen, wenn der Bereich in Sicht kommt. */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: CONTACT_DEFAULTS,
    mode: 'onTouched',
  });

  const onSubmit = async (values: ContactValues) => {
    setError(null);
    const r = await sendContact(values);
    if (r.ok) {
      setSent(true);
      reset(CONTACT_DEFAULTS);
      return;
    }
    for (const [field, message] of Object.entries(r.fields ?? {}))
      setFieldError(field as keyof ContactInput, { type: 'server', message });
    setError(r.message);
  };

  return (
    <div className="card p-6 sm:p-8">
      {sent ? (
        <div role="status" className="flex h-full flex-col items-start justify-center gap-4">
          <p className="eyebrow">Nachricht gesendet</p>
          <h3 className="text-3xl font-medium">Danke! Wir melden uns so schnell wie möglich.</h3>
          <p className="text-ink-soft">
            Die Antwort kommt an die E-Mail-Adresse, die du angegeben hast.
          </p>
          <button type="button" className="btn-outline" onClick={() => setSent(false)}>
            Weitere Nachricht schreiben
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-5"
          aria-label="Kontaktformular"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="contact-name" label="Name" error={errors.name}>
              <input
                className="field-input"
                autoComplete="name"
                {...a11y('contact-name', errors.name)}
                {...register('name')}
              />
            </Field>
            <Field id="contact-email" label="E-Mail" error={errors.email}>
              <input
                type="email"
                inputMode="email"
                className="field-input"
                autoComplete="email"
                {...a11y('contact-email', errors.email)}
                {...register('email')}
              />
            </Field>
            <Field id="contact-topic" label="Worum geht es?" error={errors.topic}>
              <select
                className="field-input"
                {...a11y('contact-topic', errors.topic)}
                {...register('topic')}
              >
                <option value="">Bitte wählen</option>
                {CONTACT_TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="contact-code"
              label="Buchungscode (falls vorhanden)"
              error={errors.bookingCode}
            >
              <input
                className="field-input font-mono uppercase"
                placeholder="HL-XXXX-XXXX"
                autoComplete="off"
                {...a11y('contact-code', errors.bookingCode)}
                {...register('bookingCode')}
              />
            </Field>
          </div>
          <Field id="contact-message" label="Deine Nachricht" error={errors.message}>
            <textarea
              rows={5}
              className="field-input"
              {...a11y('contact-message', errors.message)}
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
            Wir nutzen deine Angaben nur, um deine Anfrage zu beantworten. Mehr in der{' '}
            <Link
              to="/datenschutz"
              className="font-semibold text-gold-deep underline underline-offset-4"
            >
              Datenschutzerklärung
            </Link>
            .
          </p>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-gold w-full sm:w-auto sm:px-10"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wird gesendet …' : 'Nachricht senden'}
          </button>
        </form>
      )}
    </div>
  );
}
