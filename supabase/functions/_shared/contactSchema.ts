import { z } from 'zod';

/**
 * Kontaktformular „Fragen an STUDIO/F“ – gemeinsam für Browser und Edge Function `contact`.
 * Keine Deno- oder Browser-spezifischen APIs in dieser Datei.
 */
export const CONTACT_TOPICS = [
  { value: 'buchung', label: 'Frage zur Buchung' },
  { value: 'ticket', label: 'Kein Ticket bekommen' },
  { value: 'zahlung', label: 'Problem bei der Zahlung' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'gruppe', label: 'Größere Gruppe / Firmenfeier' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['value'];

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Bitte gib deinen Namen an.')
    .max(100, 'Bitte höchstens 100 Zeichen.'),
  email: z
    .string()
    .trim()
    .min(1, 'Bitte gib deine E-Mail-Adresse an.')
    .pipe(z.email('Bitte prüfe deine E-Mail-Adresse.')),
  topic: z.enum(['buchung', 'ticket', 'zahlung', 'rechnung', 'gruppe', 'sonstiges'], {
    message: 'Bitte wähle ein Thema.',
  }),
  bookingCode: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
    .refine((v) => v === '' || /^HL[A-Z0-9]{8}$/.test(v), {
      message: 'Der Buchungscode sieht so aus: HL-XXXX-XXXX.',
    })
    .transform((v) => (v ? `HL-${v.slice(2, 6)}-${v.slice(6)}` : '')),
  message: z
    .string()
    .trim()
    .min(10, 'Bitte beschreib dein Anliegen kurz (mindestens 10 Zeichen).')
    .max(2000, 'Bitte höchstens 2000 Zeichen.'),
  /** Honigtopf gegen Bots – muss leer bleiben (im Formular unsichtbar). */
  website: z.string().max(200).optional(),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactValues = z.output<typeof contactSchema>;

export const CONTACT_DEFAULTS: ContactInput = {
  name: '',
  email: '',
  topic: '' as unknown as ContactTopic,
  bookingCode: '',
  message: '',
  website: '',
};
