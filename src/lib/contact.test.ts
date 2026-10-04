import { describe, expect, it } from 'vitest';
import { renderContactEmail } from '../../supabase/functions/_shared/contactEmail.ts';
import { contactSchema } from '../../supabase/functions/_shared/contactSchema.ts';

const valid = {
  name: 'Anna Muster',
  email: 'anna@example.de',
  topic: 'ticket',
  bookingCode: 'hl abcd-efgh',
  message: 'Ich habe nach der Zahlung kein Ticket bekommen.',
  website: '',
};

describe('Kontaktformular', () => {
  it('nimmt gültige Angaben an und normalisiert den Buchungscode', () => {
    const r = contactSchema.parse(valid);
    expect(r.bookingCode).toBe('HL-ABCD-EFGH');
  });

  it('prüft Pflichtfelder, Thema und Code', () => {
    const r = contactSchema.safeParse({
      ...valid,
      name: '',
      topic: '',
      bookingCode: 'XY',
      message: 'kurz',
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['name', 'topic', 'bookingCode', 'message']));
  });

  it('Mail an STUDIO/F: Betreff mit Thema und Code, alles escaped', () => {
    const v = contactSchema.parse({
      ...valid,
      name: 'Anna <script>',
      message: 'Hallo <b>Team</b>, kein Ticket da.',
    });
    const mail = renderContactEmail(v, new Date('2026-12-05T16:30:00Z'));
    expect(mail.subject).toBe(
      'Lounge-Anfrage: Kein Ticket bekommen (HL-ABCD-EFGH) – Anna <script>',
    );
    expect(mail.html).toContain('Anna &lt;script&gt;');
    expect(mail.html).toContain('Hallo &lt;b&gt;Team&lt;/b&gt;');
    expect(mail.html).not.toContain('<script>');
    expect(mail.text).toContain('Eingegangen: 05.12.2026, 17:30');
  });
});
