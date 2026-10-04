import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import studioFLogo from '@/assets/studiof-logo.svg';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { sendContact } from '@/lib/api';
import {
  CONTACT_DEFAULTS,
  CONTACT_TOPICS,
  contactSchema,
  type ContactInput,
  type ContactValues,
} from '@/lib/contactSchema';
import { useSettings } from '@/lib/settingsContext';
import { a11y } from './booking/a11y';
import { Field } from './booking/fields';

/** „Fragen? STUDIO/F hilft dir“ – Kontaktformular, landet im Postfach von STUDIO/F. */
export function Contact() {
  const { contactEmail } = useSettings();
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
    <section id="kontakt" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Kontakt" title="Fragen? Wir helfen dir gern.">
          Ob zur Buchung, zur Zahlung oder wenn dein Ticket nicht angekommen ist: Schreib uns
          einfach.
        </SectionHeading>

        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <Reveal className="on-dark flex flex-col rounded-3xl bg-brown p-7 text-on-dark sm:p-9">
            <img src={studioFLogo} alt="STUDIO/F" className="h-20 w-auto self-start sm:h-24" />
            <h3 className="mt-8 text-2xl font-medium">STUDIO/F ist dein Ansprechpartner</h3>
            <p className="mt-3 leading-relaxed text-on-dark/85">
              STUDIO/F betreut die Lounge-Buchung für die Händler und kümmert sich persönlich um
              dein Anliegen – von der Frage vor der Buchung bis zum Ticket, das nicht im Postfach
              gelandet ist.
            </p>
            <ul className="mt-6 space-y-2 text-on-dark/85">
              <li>
                <span className="text-gold-light">E-Mail:</span>{' '}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-semibold underline underline-offset-4"
                >
                  {contactEmail}
                </a>
              </li>
              <li>
                <span className="text-gold-light">Tipp:</span> Mit Buchungscode (HL-XXXX-XXXX) geht
                es am schnellsten.
              </li>
            </ul>
            <a
              href="https://www.studio-f.club"
              target="_blank"
              rel="noopener"
              className="btn-outline mt-auto self-start !mt-8"
            >
              Mehr über STUDIO/F
            </a>
          </Reveal>

          <Reveal className="card p-6 sm:p-8">
            {sent ? (
              <div role="status" className="flex h-full flex-col items-start justify-center gap-4">
                <p className="eyebrow">Nachricht gesendet</p>
                <h3 className="text-3xl font-medium">
                  Danke! Wir melden uns so schnell wie möglich.
                </h3>
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}
