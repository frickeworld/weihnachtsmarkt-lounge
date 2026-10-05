import { z } from 'zod';

/**
 * Anfrage für Firmenfeiern und größere Gruppen (mehrere Zeitfenster oder Termine) –
 * gemeinsam für Browser und Edge Function `contact` (kind = 'gruppe'). Nichts wird gespeichert.
 */
export const groupRequestSchema = z.object({
  kind: z.literal('gruppe'),
  company: z
    .string()
    .trim()
    .min(1, 'Bitte gib den Namen der Firma oder Gruppe an.')
    .max(120, 'Bitte höchstens 120 Zeichen.'),
  name: z
    .string()
    .trim()
    .min(1, 'Bitte gib eine Ansprechperson an.')
    .max(100, 'Bitte höchstens 100 Zeichen.'),
  email: z
    .string()
    .trim()
    .min(1, 'Bitte gib deine E-Mail-Adresse an.')
    .pipe(z.email('Bitte prüfe deine E-Mail-Adresse.')),
  phone: z
    .string()
    .trim()
    .max(40, 'Bitte höchstens 40 Zeichen.')
    .refine((v) => v === '' || /^[+\d][\d\s/()-]{5,}$/.test(v), {
      message: 'Bitte prüfe die Telefonnummer.',
    }),
  slots: z.coerce
    .number({ message: 'Bitte wähle die Anzahl.' })
    .int()
    .min(1, 'Mindestens ein Zeitfenster.')
    .max(20, 'Für mehr als 20 Zeitfenster schreib uns bitte direkt.'),
  persons: z.coerce
    .number({ message: 'Bitte gib die Personenzahl an.' })
    .int()
    .min(1, 'Bitte gib die Personenzahl an.')
    .max(500, 'Bitte höchstens 500 Personen.'),
  dates: z
    .string()
    .trim()
    .min(3, 'Bitte nenne Wunschtermine, z. B. „Fr 4.12. ab 17:45“.')
    .max(500, 'Bitte höchstens 500 Zeichen.'),
  message: z.string().trim().max(2000, 'Bitte höchstens 2000 Zeichen.'),
  /** Honigtopf gegen Bots – muss leer bleiben. */
  website: z.string().max(200).optional(),
});

export type GroupRequestInput = z.input<typeof groupRequestSchema>;
export type GroupRequestValues = z.output<typeof groupRequestSchema>;

export const GROUP_REQUEST_DEFAULTS: GroupRequestInput = {
  kind: 'gruppe',
  company: '',
  name: '',
  email: '',
  phone: '',
  slots: 2,
  persons: 20,
  dates: '',
  message: '',
  website: '',
};
