import { Reveal } from '@/components/Reveal';
import { formatCents } from '@/lib/money';
import { maxTalerCount, minPriceCents } from '@/lib/settings';
import { useSettings } from '@/lib/settingsContext';

/** Die Eckdaten in großen Zahlen – direkt unter dem Hero. */
export function Highlights() {
  const s = useSettings();
  const euro = (cents: number) => formatCents(cents).replace(/,00\s?€$/, ' €');
  const items = [
    {
      value: `ab ${euro(minPriceCents(s))}`,
      label: 'pro Lounge',
      note: `inkl. ${formatCents(s.feeCents)} Vorverkaufsgebühr`,
    },
    {
      value: `bis ${maxTalerCount(s)} €`,
      label: 'Freiverzehr inklusive',
      note: 'in Residenztalern',
    },
    { value: String(s.maxPersons), label: 'Personen', note: 'Platz für deine Runde' },
    { value: '2 Std.', label: 'exklusiv', note: 'nur für euch' },
  ];
  return (
    <section aria-label="Das Angebot auf einen Blick" className="px-4 pt-10 sm:px-6 sm:pt-14">
      <Reveal className="mx-auto max-w-6xl">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((i, idx) => (
            <li
              key={i.label}
              className={`rounded-2xl px-4 py-5 text-center sm:px-6 sm:py-7 ${idx === 1 ? 'glitter' : 'card'}`}
            >
              <p className="font-display text-4xl leading-none font-medium sm:text-5xl">
                {i.value}
              </p>
              <p className="mt-2 text-sm font-bold">{i.label}</p>
              <p className={`mt-0.5 text-xs ${idx === 1 ? 'text-ink' : 'text-ink-soft'}`}>
                {i.note}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
