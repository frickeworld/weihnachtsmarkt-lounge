import { describe, expect, it } from 'vitest';
import { inviteText, whatsappUrl } from './invite';

describe('Einladung', () => {
  it('nennt Termin und Website, aber keinen Ticket-Link', () => {
    const t = inviteText('2026-12-05', '17:45', '19:45', 'https://lounge.example/');
    expect(t).toContain('Samstag, 5. Dezember 2026, 17:45–19:45 Uhr');
    expect(t).toContain('https://lounge.example/');
    expect(t).not.toContain('/ticket/');
    expect(whatsappUrl(t)).toMatch(/^https:\/\/wa\.me\/\?text=Ich%20habe/);
  });
});
