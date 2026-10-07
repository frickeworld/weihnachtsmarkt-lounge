import { z } from 'zod';

/** Version des Einwilligungstexts (wird mit der Teilnahme gespeichert). */
export const GIVEAWAY_CONSENT_VERSION = '2026-10-07';

/**
 * Teilnahme am Gewinnspiel – gemeinsam für Browser und Edge Function `giveaway`.
 * Keine Deno- oder Browser-spezifischen APIs in dieser Datei.
 */
export const giveawayJoinSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte gib deinen Vornamen an.').max(80),
  lastName: z.string().trim().min(1, 'Bitte gib deinen Nachnamen an.').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Bitte gib deine E-Mail-Adresse an.')
    .pipe(z.email('Bitte prüfe deine E-Mail-Adresse.')),
  company: z.string().trim().max(120, 'Bitte höchstens 120 Zeichen.'),
  consent: z.literal(true, {
    message: 'Bitte bestätige Teilnahmebedingungen und Newsletter.',
  }),
  adult: z.literal(true, { message: 'Teilnahme ab 18 Jahren.' }),
  /** Code aus dem Freunde-Link (optional) */
  ref: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,12}$/)
    .optional(),
  /** Honigtopf gegen Bots – muss leer bleiben. */
  website: z.string().max(200).optional(),
});

export type GiveawayJoinInput = z.input<typeof giveawayJoinSchema>;
export type GiveawayJoinValues = z.output<typeof giveawayJoinSchema>;
