// Kurz-Impressum für E-Mails und PDF. Platzhalter werden vor dem Livegang ersetzt (Anwalt/Impressum).
export const LEGAL_SHORT = {
  company: 'MF Coaching & Promotion GmbH',
  address: '[ADRESSE]',
  register: '[REGISTERGERICHT, HRB]',
  managingDirector: '[GESCHÄFTSFÜHRER]',
  vatId: '[USt-ID]',
  phone: '[TELEFON]',
  contentResponsible: '[NAME, ANSCHRIFT – verantwortlich nach § 18 Abs. 2 MStV]',
  partner: 'Die Händler – Werbegemeinschaft Detmold e. V.',
  partnerAddress: '[ADRESSE WERBEGEMEINSCHAFT]',
  supervisoryAuthority:
    'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf',
  draftDate: '[STAND/DATUM]',
};

export function legalLine(): string {
  const l = LEGAL_SHORT;
  return `${l.company} · ${l.address} · ${l.register} · Geschäftsführer: ${l.managingDirector} · USt-ID: ${l.vatId}`;
}
