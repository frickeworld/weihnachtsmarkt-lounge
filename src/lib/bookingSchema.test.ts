import { describe, expect, it } from 'vitest';
import { createBookingSchema } from './bookingSchema';

const schema = createBookingSchema(10);
const valid = {
  firstName: 'Anna',
  lastName: 'Muster',
  email: 'anna@example.de',
  phone: '+49 5231 123456',
  persons: '8',
  occasion: 'firmenfeier',
  companyName: '',
  invoiceRequested: false,
  vatId: '',
  billingStreet: '',
  billingZip: '',
  billingCity: '',
  notes: '',
  termsAccepted: true,
  newsletterOptIn: false,
};

const errorPaths = (input: unknown) => {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('Buchungsformular', () => {
  it('akzeptiert eine vollständige Privatbuchung ohne Rechnungsadresse', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('verlangt die AGB-Bestätigung', () => {
    expect(errorPaths({ ...valid, termsAccepted: false })).toContain('termsAccepted');
  });

  it('begrenzt die Personenzahl auf 1 bis max', () => {
    expect(errorPaths({ ...valid, persons: '11' })).toContain('persons');
    expect(errorPaths({ ...valid, persons: '0' })).toContain('persons');
  });

  it('verlangt die Rechnungsadresse bei Firmenname', () => {
    expect(errorPaths({ ...valid, companyName: 'Muster GmbH' })).toEqual(
      expect.arrayContaining(['billingStreet', 'billingZip', 'billingCity']),
    );
  });

  it('verlangt die Rechnungsadresse bei Rechnungswunsch', () => {
    expect(errorPaths({ ...valid, invoiceRequested: true })).toContain('billingStreet');
    expect(
      schema.safeParse({
        ...valid,
        invoiceRequested: true,
        billingStreet: 'Schloßplatz 1',
        billingZip: '32756',
        billingCity: 'Detmold',
      }).success,
    ).toBe(true);
  });

  it('prüft E-Mail, Telefon und USt-ID', () => {
    expect(errorPaths({ ...valid, email: 'kein-at' })).toContain('email');
    expect(errorPaths({ ...valid, phone: '12' })).toContain('phone');
    expect(errorPaths({ ...valid, vatId: '123' })).toContain('vatId');
    expect(errorPaths({ ...valid, vatId: 'de123456789' })).toEqual([]);
  });
});
