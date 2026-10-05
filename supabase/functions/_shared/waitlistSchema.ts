import { z } from 'zod';

/**
 * Warteliste für ausgebuchte Tage – gemeinsam für Browser und Edge Function `waitlist`.
 * Keine Deno- oder Browser-spezifischen APIs in dieser Datei.
 */
export const waitlistSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte wähle einen Tag.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Bitte gib deine E-Mail-Adresse an.')
    .pipe(z.email('Bitte prüfe deine E-Mail-Adresse.')),
  consent: z.literal(true, { message: 'Bitte bestätige die Benachrichtigung.' }),
  /** Honigtopf gegen Bots – muss leer bleiben. */
  website: z.string().max(200).optional(),
});

export type WaitlistInput = z.input<typeof waitlistSchema>;
