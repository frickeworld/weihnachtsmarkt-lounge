import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  renderTicketEmail,
  type TicketMailData,
} from '../../supabase/functions/_shared/emailTemplates.ts';

const base: TicketMailData = {
  kind: 'ticket',
  firstName: 'Anna',
  dateLabel: 'Samstag, 5. Dezember 2026',
  startTime: '17:30',
  endTime: '19:30',
  persons: 8,
  bookingCode: 'HL-ABCD-EFGH',
  qrImageUrl: 'https://x.supabase.co/storage/v1/object/public/tickets/tok.png',
  ticketUrl: 'https://lounge.example/ticket/tok',
  invoiceUrl: null,
  talerCount: 100,
  location: 'Schlosspark Detmold',
  siteUrl: 'https://lounge.example/',
  contactEmail: 'info@studio-f.club',
};

describe('Ticket-Mail', () => {
  it('Betreff mit Wochentag und Datum', () => {
    expect(renderTicketEmail(base).subject).toBe(
      'Dein Ticket: Weihnachtsmarkt-Lounge am Samstag, 5. Dezember 2026',
    );
  });

  it('Erinnerung mit Uhrzeit im Betreff', () => {
    expect(renderTicketEmail({ ...base, kind: 'reminder' }).subject).toBe(
      'Heute ist es so weit: deine Lounge um 17:30 Uhr',
    );
  });

  it('enthält alle Pflichtinhalte (HTML und Text)', () => {
    const { html, text } = renderTicketEmail(base);
    for (const s of [
      'Hallo Anna, deine Lounge ist gebucht!',
      'HL-ABCD-EFGH',
      '17:30–19:30 Uhr',
      '100 Residenztaler',
      'pro gekauftem Artikel 1 Taler',
      'Tischservice der Tanzschule Fricke',
      'dein Zeitfenster endet um 19:30 Uhr',
      'Du kannst dein Ticket aber an andere weitergeben.',
      'MF Coaching &amp; Promotion GmbH',
      'Powered by',
    ]) {
      expect(html).toContain(s);
    }
    expect(html).toContain('href="https://lounge.example/ticket/tok"');
    expect(html).toContain('src="https://lounge.example/email/kopf.jpg"');
    expect(html).toContain('src="https://lounge.example/email/haendler-logo-weiss.png"');
    expect(html).toContain('100 € Freiverzehr');
    expect(text).toContain('Dein Ticket online: https://lounge.example/ticket/tok');
    expect(html).not.toContain('Rechnung ansehen');
  });

  it('Rechnungslink nur, wenn vorhanden', () => {
    const { html, text } = renderTicketEmail({
      ...base,
      invoiceUrl: 'https://invoice.stripe.com/i/1',
    });
    expect(html).toContain('Rechnung ansehen');
    expect(text).toContain('Rechnung: https://invoice.stripe.com/i/1');
  });

  it('Gast-Eingaben werden escaped (kein HTML aus dem Formular in der Mail)', () => {
    const { html } = renderTicketEmail({ ...base, firstName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`"a" & 'b' <c>`)).toBe('&quot;a&quot; &amp; &#39;b&#39; &lt;c&gt;');
  });
});
