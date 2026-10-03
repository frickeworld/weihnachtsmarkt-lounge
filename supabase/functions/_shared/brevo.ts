// Minimaler Brevo-Client (API v3). Basis-URL per BREVO_API_BASE überschreibbar (Tests).
import { requireEnv } from './http.ts';

const base = () =>
  (Deno.env.get('BREVO_API_BASE') ?? 'https://api.brevo.com/v3').replace(/\/$/, '');

async function call(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: {
      'api-key': requireEnv('BREVO_API_KEY'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Brevo ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
}

export function sendTransactionalEmail(mail: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  attachments?: { name: string; content: string }[];
  tags?: string[];
}): Promise<void> {
  return call('/smtp/email', {
    sender: {
      email: requireEnv('BREVO_SENDER_EMAIL'),
      name: Deno.env.get('BREVO_SENDER_NAME') ?? 'Weihnachtsmarkt-Lounge der Händler',
    },
    to: [mail.to],
    subject: mail.subject,
    htmlContent: mail.html,
    textContent: mail.text,
    ...(mail.attachments?.length ? { attachment: mail.attachments } : {}),
    ...(mail.tags?.length ? { tags: mail.tags } : {}),
  });
}

/** Attribut-Namen sind im Brevo-Konto unterschiedlich (VORNAME oder FIRSTNAME) – per Secret anpassbar. */
export function contactAttributes(firstName: string, lastName: string, company: string | null) {
  const attrs: Record<string, string> = {
    [Deno.env.get('BREVO_ATTR_FIRSTNAME') ?? 'VORNAME']: firstName,
    [Deno.env.get('BREVO_ATTR_LASTNAME') ?? 'NACHNAME']: lastName,
  };
  if (company) attrs[Deno.env.get('BREVO_ATTR_COMPANY') ?? 'FIRMA'] = company;
  return attrs;
}

/** Kontakt in die Liste „Lounge-Buchungen“ (keine Werbeliste). */
export function upsertBookingContact(
  email: string,
  attributes: Record<string, string>,
): Promise<void> {
  return call('/contacts', {
    email,
    attributes,
    listIds: [Number(requireEnv('BREVO_LIST_BOOKINGS'))],
    updateEnabled: true,
  });
}

/** Newsletter nur per Double-Opt-in: Brevo verschickt die Bestätigungsmail. */
export function requestNewsletterDoubleOptIn(
  email: string,
  attributes: Record<string, string>,
): Promise<void> {
  const site = requireEnv('PUBLIC_SITE_URL').replace(/\/$/, '');
  return call('/contacts/doubleOptinConfirmation', {
    email,
    attributes,
    includeListIds: [Number(requireEnv('BREVO_LIST_NEWSLETTER'))],
    templateId: Number(requireEnv('BREVO_DOI_TEMPLATE_ID')),
    redirectionUrl: `${site}/newsletter/bestaetigt`,
  });
}
