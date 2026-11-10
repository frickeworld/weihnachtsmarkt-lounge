import { z } from 'zod';

/**
 * Validierung des Buchungsformulars – gemeinsam genutzt vom Browser (src/lib/bookingSchema.ts)
 * und von der Edge Function create-checkout. Der Server prüft immer erneut; der Browser ist nie
 * die letzte Instanz. Keine Deno- oder Browser-spezifischen APIs in dieser Datei.
 */
export const OCCASIONS = [
  { value: 'firmenfeier', label: 'Firmenfeier' },
  { value: 'familienfeier', label: 'Familienfeier' },
  { value: 'freunde', label: 'Freunde' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

export type Occasion = (typeof OCCASIONS)[number]['value'];

const trimmed = (max: number) => z.string().trim().max(max, `Bitte höchstens ${max} Zeichen.`);
const required = (msg: string, max = 100) => trimmed(max).min(1, msg);

/**
 * `billing: false` für kostenlose Buchungen im Admin: keine Rechnung, daher auch mit Firmenname
 * keine Pflicht-Rechnungsadresse.
 */
export function createBookingSchema(maxPersons: number, opts: { billing?: boolean } = {}) {
  const billing = opts.billing ?? true;
  return z
    .object({
      firstName: required('Bitte gib deinen Vornamen an.'),
      lastName: required('Bitte gib deinen Nachnamen an.'),
      email: z
        .string()
        .trim()
        .min(1, 'Bitte gib deine E-Mail-Adresse an.')
        .pipe(z.email('Bitte prüfe deine E-Mail-Adresse.')),
      phone: z
        .string()
        .trim()
        .min(1, 'Bitte gib deine Telefonnummer an.')
        .regex(/^\+?[0-9 ()/-]{6,25}$/, 'Bitte prüfe deine Telefonnummer.')
        .refine((v) => v.replace(/\D/g, '').length >= 6, 'Bitte prüfe deine Telefonnummer.'),
      persons: z.coerce
        .number({ message: 'Bitte wähle die Personenzahl.' })
        .int()
        .min(1, 'Bitte wähle die Personenzahl.')
        .max(maxPersons, `Die Lounge bietet Platz für bis zu ${maxPersons} Personen.`),
      // Anlass ist freiwillig (Design-Runde 2). Leer/null zählt als „keine Angabe“.
      occasion: z.preprocess(
        (v) => (v === '' || v === null ? undefined : v),
        z.enum(['firmenfeier', 'familienfeier', 'freunde', 'sonstiges']).optional(),
      ),
      companyName: trimmed(120),
      invoiceRequested: z.boolean(),
      vatId: z
        .string()
        .trim()
        .toUpperCase()
        .refine((v) => v === '' || /^[A-Z]{2}[A-Z0-9]{2,13}$/.test(v.replace(/\s/g, '')), {
          message: 'Bitte prüfe die USt-ID (z. B. DE123456789).',
        }),
      billingStreet: trimmed(120),
      billingZip: trimmed(10),
      billingCity: trimmed(80),
      notes: trimmed(1000),
      termsAccepted: z.literal(true, {
        message: 'Bitte bestätige die AGB und die Verbindlichkeit.',
      }),
      newsletterOptIn: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (!billing || !needsBillingAddress(v)) return;
      if (!v.billingStreet)
        ctx.addIssue({
          code: 'custom',
          path: ['billingStreet'],
          message: 'Bitte gib Straße und Hausnummer an.',
        });
      if (!/^[A-Za-z0-9 -]{4,10}$/.test(v.billingZip))
        ctx.addIssue({
          code: 'custom',
          path: ['billingZip'],
          message: 'Bitte prüfe die Postleitzahl.',
        });
      if (!v.billingCity)
        ctx.addIssue({ code: 'custom', path: ['billingCity'], message: 'Bitte gib den Ort an.' });
    });
}

export type BookingFormInput = z.input<ReturnType<typeof createBookingSchema>>;
export type BookingFormValues = z.output<ReturnType<typeof createBookingSchema>>;

/** Rechnungsadresse ist Pflicht, sobald ein Firmenname eingetragen oder eine Rechnung gewünscht ist. */
export function needsBillingAddress(v: {
  companyName?: string;
  invoiceRequested?: boolean;
}): boolean {
  return Boolean(v.companyName?.trim()) || Boolean(v.invoiceRequested);
}

export const BOOKING_FORM_DEFAULTS: BookingFormInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  persons: '' as unknown as number,
  occasion: undefined as unknown as Occasion,
  companyName: '',
  invoiceRequested: false,
  vatId: '',
  billingStreet: '',
  billingZip: '',
  billingCity: '',
  notes: '',
  termsAccepted: false as unknown as true,
  newsletterOptIn: false,
};

/** Anfrage an create-checkout: Termin + Formularwerte. Preise schickt der Browser nie mit. */
export function createCheckoutRequestSchema(maxPersons: number) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum.'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültige Uhrzeit.'),
    form: createBookingSchema(maxPersons),
    /** Gewinnspiel- oder Rabattcode (optional) */
    discountCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(24)
      .regex(/^[A-Z0-9-]*$/, 'Bitte prüfe den Code.')
      .optional()
      .transform((v) => v || undefined),
    /**
     * Zusätzliche Weihnachtsmarkt-Taler (0 = keine). Erlaubte Werte stehen in settings.extra_taler_options
     * und werden in create-checkout geprüft; der Preis (1 Taler = 1 €) entsteht in der Datenbank.
     */
    extraTaler: z.coerce.number().int().min(0).max(1000).default(0),
  });
}

/** Meldungen zu einem Code (gleich in Browser und Edge Function). */
export const DISCOUNT_REASON_TEXT: Record<string, string> = {
  unknown: 'Diesen Code kennen wir nicht. Bitte prüfe die Schreibweise.',
  expired: 'Dieser Code ist abgelaufen.',
  used: 'Dieser Code wurde bereits eingelöst.',
  weekday: 'Dieser Code gilt nur montags bis donnerstags.',
  special: 'Für Sonderveranstaltungen gilt dieser Code leider nicht.',
  used_up: 'Dieser Code ist leider schon ausgeschöpft.',
  not_yet: 'Dieser Code gilt noch nicht.',
};

/** Manuelle Buchung im Admin (Telefon, Sonderfälle). Ticket geht trotzdem per E-Mail raus. */
export const PAYMENT_METHODS_MANUAL = [
  { value: 'bar', label: 'Bar' },
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'kostenlos', label: 'Kostenlos' },
] as const;

export function createManualBookingRequestSchema(maxPersons: number) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum.'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültige Uhrzeit.'),
    form: createBookingSchema(maxPersons, { billing: false }),
    /** Manuelle Buchungen sind nur noch kostenlos (keine Bar- oder Überweisungsbuchungen). */
    paymentMethod: z.literal('kostenlos', { message: 'Manuelle Buchungen sind nur kostenlos.' }),
    /** Mit wem die kostenlose Buchung abgesprochen ist (Tanzschule Fricke und Händler). */
    approvalNote: z
      .string()
      .trim()
      .min(3, 'Bitte angeben, mit wem die kostenlose Buchung abgesprochen ist.')
      .max(200, 'Bitte höchstens 200 Zeichen.'),
    /** Admin bestätigt bewusst: Buchungsschluss, Sperre, Schließtag oder Saison übergehen. */
    override: z.boolean().default(false),
  });
}
