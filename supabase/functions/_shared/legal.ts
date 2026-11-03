// Impressumsangaben für Website, E-Mails und PDF. Rechtstexte werden noch anwaltlich geprüft.
export const LEGAL_SHORT = {
  // Anbieter der Buchungsseite, Verkäufer und Rechnungssteller (Impressum studio-f.club)
  company: 'MF Coaching & Promotion GmbH',
  address: 'Ernst-Hilker-Straße 3, 32760 Detmold',
  register: 'Amtsgericht Detmold, HRB [NUMMER]',
  managingDirector: 'Oliver Fricke',
  vatId: 'DE248046234',
  phone: '05231 390715',
  contentResponsible: 'Oliver Fricke, Ernst-Hilker-Straße 3, 32760 Detmold',
  // Gastgeber und Veranstalter (Impressum die-haendler-detmold.de, Stand 10.07.2025)
  partner: 'Die Händler – Werbegemeinschaft Detmold e. V.',
  partnerAddress: 'Ernest-Solvay-Weg 2, 32760 Detmold',
  partnerPhone: '05231 9385-22',
  partnerEmail: 'info@die-haendler-detmold.de',
  partnerBoard: 'Christian Schmidt (Vorsitz), Paul Kirchgässner (Schatzmeister)',
  partnerRegister: 'Vereinsregister Amtsgericht Lemgo, VR 60389',
  supervisoryAuthority:
    'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf',
  draftDate: '3. November 2026',
};

export function legalLine(): string {
  const l = LEGAL_SHORT;
  return `${l.company} · ${l.address} · ${l.register} · Geschäftsführer: ${l.managingDirector} · USt-ID: ${l.vatId}`;
}
