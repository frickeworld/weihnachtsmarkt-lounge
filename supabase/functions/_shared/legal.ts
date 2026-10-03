// Kurz-Impressum für E-Mails und PDF. Platzhalter werden vor dem Livegang ersetzt (Anwalt/Impressum).
export const LEGAL_SHORT = {
  company: 'MF Coaching & Promotion GmbH',
  address: '[ADRESSE]',
  register: '[REGISTERGERICHT, HRB]',
  managingDirector: '[GESCHÄFTSFÜHRER]',
  vatId: '[USt-ID]',
};

export function legalLine(): string {
  const l = LEGAL_SHORT;
  return `${l.company} · ${l.address} · ${l.register} · Geschäftsführer: ${l.managingDirector} · USt-ID: ${l.vatId}`;
}
