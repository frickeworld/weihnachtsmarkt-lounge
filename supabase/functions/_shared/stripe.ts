import Stripe from 'stripe';
import { requireEnv } from './http.ts';

export function stripeClient(): Stripe {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    httpClient: Stripe.createFetchHttpClient(),
    // Für lokale Tests gegen stripe-mock (http://host:12111). Im Betrieb nicht gesetzt.
    ...(Deno.env.get('STRIPE_API_BASE')
      ? (() => {
          const u = new URL(Deno.env.get('STRIPE_API_BASE')!);
          return {
            host: u.hostname,
            port: Number(u.port),
            protocol: u.protocol.replace(':', '') as 'http' | 'https',
          };
        })()
      : {}),
  });
}

export const cryptoProvider = Stripe.createSubtleCryptoProvider();
